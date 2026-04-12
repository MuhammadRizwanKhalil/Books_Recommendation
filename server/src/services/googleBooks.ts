/**
 * Google Books API Service
 *
 * Fetches books from the Google Books API (volumes endpoint).
 * Supports:
 *  - Searching by query (bestseller, new releases, category-specific)
 *  - Fetching individual volumes by Google Books ID
 *  - Pagination through large result sets
 *  - Image validation before storing covers
 *
 * API docs: https://developers.google.com/books/docs/v1/reference/volumes
 *
 * Rate limits (no API key): ~100 requests/min
 * Rate limits (with API key): ~1000 requests/100 seconds
 */

import { config } from '../config.js';
import { validateImageUrl, findBestValidImage, type ImageValidationResult } from './imageValidator.js';
import { resolveHDCover } from './coverResolver.js';
import { logger } from '../lib/logger.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface GoogleBookVolume {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    pageCount?: number;
    categories?: string[];
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      smallThumbnail?: string;
      thumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    language?: string;
    previewLink?: string;
    infoLink?: string;
    canonicalVolumeLink?: string;
  };
  saleInfo?: {
    listPrice?: { amount: number; currencyCode: string };
    retailPrice?: { amount: number; currencyCode: string };
    buyLink?: string;
  };
}

export interface GoogleBooksSearchResult {
  totalItems: number;
  items?: GoogleBookVolume[];
}

/** Validate ISBN-10 check digit */
export function isValidIsbn10(isbn: string): boolean {
  const cleaned = isbn.replace(/[\s-]/g, '');
  if (cleaned.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (isNaN(digit)) return false;
    sum += digit * (10 - i);
  }
  const last = cleaned[9].toUpperCase();
  sum += last === 'X' ? 10 : parseInt(last, 10);
  if (isNaN(sum)) return false;
  return sum % 11 === 0;
}

/** Build an Amazon search URL (always works, unlike /dp/ links) */
export function buildAmazonSearchUrl(book: { isbn10?: string | null; isbn13?: string | null; title: string; author: string }): string {
  const searchTerm = book.isbn13 || book.isbn10 || `${book.title} ${book.author}`;
  return `https://www.amazon.com/s?k=${encodeURIComponent(searchTerm)}&tag=thebooktimes-20`;
}

/** Normalized book data ready for DB insertion */
export interface NormalizedBook {
  googleBooksId: string;
  isbn10: string | null;
  isbn13: string | null;
  title: string;
  subtitle: string | null;
  author: string;
  /** Individual author names from Google Books (for multi-author linking) */
  authors: string[];
  description: string | null;
  coverImage: string;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  language: string;
  categories: string[];
  googleRating: number | null;
  ratingsCount: number;
  price: number | null;
  currency: string;
  amazonUrl: string | null;
  buyLink: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = 'https://www.googleapis.com/books/v1/volumes';
const MAX_RESULTS_PER_PAGE = 40; // Google API max
const REQUEST_DELAY_MS = 1500;    // Throttle between requests (generous to avoid 429)

// Search queries for the initial "top books" fetch — wider net across sub-genres
const TOP_BOOKS_QUERIES = [
  // Fiction — multiple angles for depth
  { query: 'subject:fiction bestseller award winning', category: 'Fiction' },
  { query: 'subject:fiction NYT bestseller popular', category: 'Fiction' },
  { query: 'subject:literary fiction Pulitzer Booker prize', category: 'Fiction' },
  { query: 'subject:fiction thriller mystery top rated', category: 'Fiction' },

  // Business & Economics
  { query: 'subject:business bestseller leadership strategy', category: 'Business' },
  { query: 'subject:business economics finance investing', category: 'Business' },

  // Technology & Programming
  { query: 'subject:computers programming bestseller', category: 'Technology' },
  { query: 'subject:technology artificial intelligence machine learning', category: 'Technology' },

  // Self-Help & Personal Development
  { query: 'subject:self-help bestseller habits productivity', category: 'Self-Help' },
  { query: 'subject:self-help personal development mindfulness', category: 'Self-Help' },

  // Science
  { query: 'subject:science popular bestseller', category: 'Science' },
  { query: 'subject:science physics cosmology evolution', category: 'Science' },

  // History
  { query: 'subject:history bestseller civilization', category: 'History' },
  { query: 'subject:history war revolution modern', category: 'History' },

  // Psychology
  { query: 'subject:psychology bestseller behavior cognitive', category: 'Psychology' },
  { query: 'subject:psychology thinking brain neuroscience', category: 'Psychology' },

  // Biography & Memoir
  { query: 'subject:biography memoir bestseller', category: 'Biography' },
  { query: 'subject:biography autobiography inspiring', category: 'Biography' },
];

// Generate daily queries with the current year for freshness
function getDailyQueries(): string[] {
  const year = new Date().getFullYear();
  return [
    `new releases ${year} bestseller`,
    `trending books ${year} popular`,
    `award winning books ${year}`,
    `new york times bestseller list ${year}`,
    `most anticipated books ${year}`,
    `best new fiction ${year}`,
    `best new nonfiction ${year}`,
  ];
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Search Google Books API by query string.
 * Returns raw API response.
 */
export async function searchBooks(
  query: string,
  options: {
    startIndex?: number;
    maxResults?: number;
    orderBy?: 'relevance' | 'newest';
    langRestrict?: string;
    printType?: 'all' | 'books' | 'magazines';
  } = {},
): Promise<GoogleBooksSearchResult> {
  const {
    startIndex = 0,
    maxResults = MAX_RESULTS_PER_PAGE,
    orderBy = 'relevance',
    langRestrict = 'en',
    printType = 'books',
  } = options;

  const params = new URLSearchParams({
    q: query,
    startIndex: startIndex.toString(),
    maxResults: Math.min(maxResults, MAX_RESULTS_PER_PAGE).toString(),
    orderBy,
    langRestrict,
    printType,
  });

  if (config.googleBooksApiKey) {
    params.set('key', config.googleBooksApiKey);
  }

  const url = `${BASE_URL}?${params.toString()}`;
  const response = await fetchWithRetry(url);

  if (!response.ok) {
    throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<GoogleBooksSearchResult>;
}

/**
 * Fetch a single volume by its Google Books ID.
 */
export async function getVolumeById(volumeId: string): Promise<GoogleBookVolume | null> {
  const params = new URLSearchParams();
  if (config.googleBooksApiKey) {
    params.set('key', config.googleBooksApiKey);
  }
  const url = `${BASE_URL}/${volumeId}?${params.toString()}`;
  const response = await fetchWithRetry(url);
  if (!response.ok) return null;
  return response.json() as Promise<GoogleBookVolume>;
}

/**
 * Search and fetch ALL top/popular books across all categories.
 * Used for the initial import.
 * Returns normalized books with validated images.
 */
export async function fetchTopBooks(
  booksPerCategory: number = 30,
  onProgress?: (message: string) => void,
): Promise<NormalizedBook[]> {
  const allBooks: NormalizedBook[] = [];
  const seenIds = new Set<string>();
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3; // Stop early if API keeps failing

  for (const { query, category } of TOP_BOOKS_QUERIES) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      onProgress?.(`Aborting: ${consecutiveFailures} consecutive API failures — check your GOOGLE_BOOKS_API_KEY.`);
      break;
    }
    onProgress?.(`Fetching top books for category: ${category}...`);
    try {
      const books = await fetchAllPages(query, booksPerCategory);
      consecutiveFailures = 0; // Reset on success
      for (const volume of books) {
        if (seenIds.has(volume.id)) continue;
        seenIds.add(volume.id);

        const normalized = await normalizeVolume(volume, category);
        if (normalized) {
          // Quality gate: skip books with very low engagement for initial import
          if (normalized.googleRating && normalized.googleRating < 3.0 && normalized.ratingsCount < 10) {
            continue;
          }
          allBooks.push(normalized);
          onProgress?.(`  ✓ ${normalized.title} by ${normalized.author} (★${normalized.googleRating ?? '?'} · ${normalized.ratingsCount} ratings)`);
        }
      }
    } catch (err: any) {
      consecutiveFailures++;
      onProgress?.(`  ✗ Error fetching ${category}: ${err.message}`);
    }
    await delay(REQUEST_DELAY_MS);
  }

  if (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
    // Also fetch general bestsellers
    onProgress?.('Fetching general bestsellers...');
    try {
      const generalBooks = await fetchAllPages('bestseller books highly rated', 40);
      for (const volume of generalBooks) {
        if (seenIds.has(volume.id)) continue;
        seenIds.add(volume.id);
        const normalized = await normalizeVolume(volume);
        if (normalized) {
          if (normalized.googleRating && normalized.googleRating < 3.0 && normalized.ratingsCount < 10) {
            continue;
          }
          allBooks.push(normalized);
        }
      }
    } catch (err: any) {
      onProgress?.(`  ✗ Error fetching general: ${err.message}`);
    }
  }

  onProgress?.(`Total books fetched: ${allBooks.length}`);
  return allBooks;
}

/**
 * Fetch new/trending books for the daily update.
 * Returns normalized books with validated images.
 */
export async function fetchDailyNewBooks(
  maxPerQuery: number = 20,
  onProgress?: (message: string) => void,
): Promise<NormalizedBook[]> {
  const allBooks: NormalizedBook[] = [];
  const seenIds = new Set<string>();
  let consecutiveFailures = 0;
  const MAX_CONSECUTIVE_FAILURES = 3; // Stop early if API keeps failing

  const dailyQueries = getDailyQueries();
  for (const query of dailyQueries) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      onProgress?.(`Aborting: ${consecutiveFailures} consecutive API failures — check your GOOGLE_BOOKS_API_KEY.`);
      break;
    }
    onProgress?.(`Searching: "${query}"...`);
    try {
      const result = await searchBooks(query, {
        maxResults: maxPerQuery,
        orderBy: 'newest',
      });
      consecutiveFailures = 0; // Reset on success
      if (result.items) {
        for (const volume of result.items) {
          if (seenIds.has(volume.id)) continue;
          seenIds.add(volume.id);
          const normalized = await normalizeVolume(volume);
          if (normalized) {
            allBooks.push(normalized);
            onProgress?.(`  ✓ ${normalized.title} by ${normalized.author}`);
          }
        }
      }
    } catch (err: any) {
      consecutiveFailures++;
      onProgress?.(`  ✗ Error: ${err.message}`);
    }
    await delay(REQUEST_DELAY_MS);
  }

  // Also fetch newest across categories
  for (const { query, category } of TOP_BOOKS_QUERIES) {
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      onProgress?.(`Aborting categories: repeated API failures.`);
      break;
    }
    onProgress?.(`Checking new in ${category}...`);
    try {
      const result = await searchBooks(query, {
        maxResults: 10,
        orderBy: 'newest',
      });
      consecutiveFailures = 0;
      if (result.items) {
        for (const volume of result.items) {
          if (seenIds.has(volume.id)) continue;
          seenIds.add(volume.id);
          const normalized = await normalizeVolume(volume, category);
          if (normalized) {
            allBooks.push(normalized);
          }
        }
      }
    } catch (err: any) {
      consecutiveFailures++;
      onProgress?.(`  ✗ Error: ${err.message}`);
    }
    await delay(REQUEST_DELAY_MS);
  }

  onProgress?.(`Daily new books found: ${allBooks.length}`);
  return allBooks;
}

// ── Normalization ───────────────────────────────────────────────────────────

/**
 * Convert a Google Books API volume into our normalized format.
 * Validates the cover image before accepting.
 * Returns null if the book is incomplete or has no valid image.
 */
async function normalizeVolume(
  volume: GoogleBookVolume,
  categoryHint?: string,
): Promise<NormalizedBook | null> {
  const info = volume.volumeInfo;

  // Skip books with no title or author
  if (!info.title || !info.authors || info.authors.length === 0) {
    return null;
  }

  // Skip non-English books (unless explicitly fetched)
  if (info.language && info.language !== 'en') {
    return null;
  }

  // Build image URL candidates (prefer larger sizes, fall back to thumbnail)
  const imageLinks = info.imageLinks || {};
  const imageCandidates = [
    imageLinks.large,
    imageLinks.medium,
    imageLinks.small,
    imageLinks.thumbnail,
    imageLinks.smallThumbnail,
  ]
    .filter(Boolean)
    .map((url) => {
      let cleaned = url || '';
      // Google Books serves HTTP by default; upgrade to HTTPS
      if (cleaned.startsWith('http://')) {
        cleaned = cleaned.replace('http://', 'https://');
      }
      // Remove edge=curl parameter for cleaner images
      cleaned = cleaned.replace('&edge=curl', '');
      return cleaned;
    }) as string[];

  if (imageCandidates.length === 0) {
    return null; // No images at all → skip
  }

  // Validate images — find the best valid one
  const validImage = await findBestValidImage(imageCandidates);
  if (!validImage) {
    return null; // No valid image → skip this book
  }

  // Extract ISBNs
  let isbn10: string | null = null;
  let isbn13: string | null = null;
  for (const ident of info.industryIdentifiers || []) {
    if (ident.type === 'ISBN_10') isbn10 = ident.identifier;
    if (ident.type === 'ISBN_13') isbn13 = ident.identifier;
  }

  // Extract categories
  const categories: string[] = [];
  if (info.categories) {
    for (const cat of info.categories) {
      // Google sometimes returns nested categories like "Fiction / Fantasy"
      const parts = cat.split('/').map((p) => p.trim());
      for (const part of parts) {
        const mapped = mapToLocalCategory(part);
        if (mapped && !categories.includes(mapped)) {
          categories.push(mapped);
        }
      }
    }
  }
  // Add hint category if not already present
  if (categoryHint && !categories.includes(categoryHint)) {
    categories.push(categoryHint);
  }
  // Default to Fiction if no categories found
  if (categories.length === 0) {
    categories.push('Fiction');
  }

  // Extract price
  const priceInfo = volume.saleInfo?.retailPrice || volume.saleInfo?.listPrice;
  const price = priceInfo?.amount || null;
  const currency = priceInfo?.currencyCode || 'USD';

  // Build Amazon URL — prefer direct product link for valid ISBN-10,
  // otherwise use search URL which always shows results
  const amazonUrl = isbn10 && isValidIsbn10(isbn10)
    ? `https://www.amazon.com/dp/${isbn10}?tag=thebooktimes-20`
    : isbn13
      ? `https://www.amazon.com/s?k=${isbn13}&tag=thebooktimes-20`
      : `https://www.amazon.com/s?k=${encodeURIComponent(info.title + ' ' + (info.authors?.[0] || ''))}&tag=thebooktimes-20`;

  // Try to upgrade to HD cover (Open Library → Google zoom=0)
  let finalCoverUrl = validImage.url;
  try {
    const hdCover = await resolveHDCover({
      isbn13,
      isbn10,
      googleBooksId: volume.id,
      currentCoverUrl: validImage.url,
    });
    if (hdCover) {
      finalCoverUrl = hdCover.url;
    }
  } catch {
    // HD upgrade failed, keep original thumbnail
  }

  return {
    googleBooksId: volume.id,
    isbn10,
    isbn13,
    title: info.title,
    subtitle: info.subtitle || null,
    author: info.authors.join(', '),
    authors: info.authors,
    description: info.description || null,
    coverImage: finalCoverUrl,
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    pageCount: info.pageCount || null,
    language: info.language || 'en',
    categories,
    googleRating: info.averageRating || null,
    ratingsCount: info.ratingsCount || 0,
    price,
    currency,
    amazonUrl,
    buyLink: volume.saleInfo?.buyLink || null,
  };
}

// ── Category Mapping ────────────────────────────────────────────────────────

/** Map Google Books categories to our local category names.
 * Expanded to 20+ genres for richer browsing and better search filtering.
 */
const CATEGORY_MAP: Record<string, string> = {
  // ── Literary & General Fiction ──────────────────────────────────────
  'fiction': 'Fiction',
  'literary fiction': 'Fiction',
  'general fiction': 'Fiction',
  'literary collections': 'Fiction',

  // ── Fantasy ─────────────────────────────────────────────────────────
  'fantasy': 'Fantasy',
  'epic fantasy': 'Fantasy',
  'urban fantasy': 'Fantasy',
  'dark fantasy': 'Fantasy',
  'paranormal fiction': 'Fantasy',

  // ── Science Fiction ─────────────────────────────────────────────────
  'science fiction': 'Science Fiction',
  'dystopian': 'Science Fiction',
  'space opera': 'Science Fiction',
  'cyberpunk': 'Science Fiction',

  // ── Mystery & Thriller ──────────────────────────────────────────────
  'mystery': 'Mystery & Thriller',
  'thriller': 'Mystery & Thriller',
  'suspense': 'Mystery & Thriller',
  'detective': 'Mystery & Thriller',
  'crime fiction': 'Mystery & Thriller',
  'espionage': 'Mystery & Thriller',
  'mystery & detective': 'Mystery & Thriller',
  'thrillers': 'Mystery & Thriller',

  // ── Romance ─────────────────────────────────────────────────────────
  'romance': 'Romance',
  'contemporary romance': 'Romance',
  'historical romance': 'Romance',
  'romantic suspense': 'Romance',
  'love stories': 'Romance',

  // ── Horror ──────────────────────────────────────────────────────────
  'horror': 'Horror',
  'occult': 'Horror',
  'supernatural': 'Horror',
  'gothic fiction': 'Horror',

  // ── Historical Fiction ──────────────────────────────────────────────
  'historical fiction': 'Historical Fiction',
  'historical': 'Historical Fiction',

  // ── Young Adult ─────────────────────────────────────────────────────
  'young adult fiction': 'Young Adult',
  'young adult': 'Young Adult',
  'juvenile fiction': 'Young Adult',
  'children\'s fiction': 'Young Adult',
  'teen': 'Young Adult',

  // ── Adventure ───────────────────────────────────────────────────────
  'adventure': 'Adventure',
  'action & adventure': 'Adventure',

  // ── Business & Economics ────────────────────────────────────────────
  'business': 'Business',
  'business & economics': 'Business',
  'economics': 'Business',
  'management': 'Business',
  'entrepreneurship': 'Business',
  'finance': 'Business',
  'marketing': 'Business',
  'investing': 'Business',
  'leadership': 'Business',

  // ── Technology & Programming ────────────────────────────────────────
  'technology': 'Technology',
  'technology & engineering': 'Technology',
  'computers': 'Technology',
  'programming': 'Technology',
  'artificial intelligence': 'Technology',
  'computer science': 'Technology',
  'engineering': 'Technology',
  'data science': 'Technology',
  'software': 'Technology',
  'web development': 'Technology',

  // ── Self-Help & Personal Development ────────────────────────────────
  'self-help': 'Self-Help',
  'personal development': 'Self-Help',
  'self improvement': 'Self-Help',
  'motivation': 'Self-Help',
  'mindfulness': 'Self-Help',
  'body, mind & spirit': 'Self-Help',
  'happiness': 'Self-Help',
  'productivity': 'Self-Help',
  'habits': 'Self-Help',

  // ── Science & Nature ────────────────────────────────────────────────
  'science': 'Science',
  'popular science': 'Science',
  'mathematics': 'Science',
  'physics': 'Science',
  'biology': 'Science',
  'nature': 'Science',
  'astronomy': 'Science',
  'chemistry': 'Science',
  'environmental science': 'Science',

  // ── History ─────────────────────────────────────────────────────────
  'history': 'History',
  'world history': 'History',
  'political science': 'History',
  'social science': 'History',
  'military history': 'History',
  'ancient history': 'History',

  // ── Psychology & Philosophy ─────────────────────────────────────────
  'psychology': 'Psychology',
  'mental health': 'Psychology',
  'cognitive psychology': 'Psychology',
  'behavioral sciences': 'Psychology',
  'neuroscience': 'Psychology',

  // ── Philosophy (separate) ───────────────────────────────────────────
  'philosophy': 'Philosophy',
  'ethics': 'Philosophy',
  'stoicism': 'Philosophy',
  'existentialism': 'Philosophy',

  // ── Biography & Memoir ──────────────────────────────────────────────
  'biography': 'Biography',
  'biography & autobiography': 'Biography',
  'memoir': 'Biography',
  'autobiography': 'Biography',

  // ── True Crime ──────────────────────────────────────────────────────
  'true crime': 'True Crime',
  'crime': 'True Crime',

  // ── Health & Wellness ───────────────────────────────────────────────
  'health & fitness': 'Health & Wellness',
  'health': 'Health & Wellness',
  'fitness': 'Health & Wellness',
  'nutrition': 'Health & Wellness',
  'diet': 'Health & Wellness',
  'wellness': 'Health & Wellness',
  'medical': 'Health & Wellness',

  // ── Cooking & Food ──────────────────────────────────────────────────
  'cooking': 'Cooking',
  'food': 'Cooking',
  'cookbooks': 'Cooking',
  'baking': 'Cooking',

  // ── Art & Design ────────────────────────────────────────────────────
  'art': 'Art & Design',
  'design': 'Art & Design',
  'photography': 'Art & Design',
  'architecture': 'Art & Design',
  'music': 'Art & Design',

  // ── Travel ──────────────────────────────────────────────────────────
  'travel': 'Travel',
  'travel writing': 'Travel',

  // ── Religion & Spirituality ─────────────────────────────────────────
  'religion': 'Religion & Spirituality',
  'spirituality': 'Religion & Spirituality',
  'christianity': 'Religion & Spirituality',
  'islam': 'Religion & Spirituality',
  'buddhism': 'Religion & Spirituality',

  // ── Education & Reference ───────────────────────────────────────────
  'education': 'Education',
  'study aids': 'Education',
  'reference': 'Education',
  'language arts': 'Education',
};

export function mapToLocalCategory(rawCategory: string): string | null {
  const lower = rawCategory.toLowerCase().trim();
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower];

  // Partial matching
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key) || key.includes(lower)) {
      return value;
    }
  }
  return null;
}

// ── Pagination ──────────────────────────────────────────────────────────────

/** Fetch multiple pages of results for a query */
async function fetchAllPages(query: string, maxTotal: number): Promise<GoogleBookVolume[]> {
  const results: GoogleBookVolume[] = [];
  let startIndex = 0;

  while (results.length < maxTotal) {
    const pageSize = Math.min(MAX_RESULTS_PER_PAGE, maxTotal - results.length);
    const data = await searchBooks(query, { startIndex, maxResults: pageSize });

    if (!data.items || data.items.length === 0) break;
    results.push(...data.items);

    startIndex += data.items.length;
    if (startIndex >= data.totalItems) break;

    await delay(REQUEST_DELAY_MS);
  }

  return results;
}

// ── HTTP Helpers ────────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 5): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        // True rate limit — back off exponentially
        const backoff = 2000 * Math.pow(2, attempt);
        logger.warn(`[GoogleBooks] Rate limited (429), retrying in ${backoff}ms... (attempt ${attempt}/${retries})`);
        await delay(backoff);
        continue;
      }

      if (response.status === 503 || response.status === 502) {
        // Transient server error — retry with backoff
        const backoff = 3000 * Math.pow(2, attempt);
        logger.warn(`[GoogleBooks] Server error (${response.status}), retrying in ${backoff}ms... (attempt ${attempt}/${retries})`);
        await delay(backoff);
        continue;
      }

      if (response.status === 403) {
        // 403 can be rate limiting OR access denied.
        // Try to read the error body to distinguish.
        let errorBody = '';
        try { errorBody = await response.clone().text(); } catch {}

        if (errorBody.includes('rateLimitExceeded') || errorBody.includes('userRateLimitExceeded')) {
          // Google's 403 rate limit response — retry with backoff
          const backoff = 2000 * Math.pow(2, attempt);
          logger.warn(`[GoogleBooks] Rate limited via 403, retrying in ${backoff}ms... (attempt ${attempt}/${retries})`);
          await delay(backoff);
          continue;
        }

        // True 403 (forbidden / no API key / quota exhausted) — don't retry
        const hint = config.googleBooksApiKey
          ? 'Check that your GOOGLE_BOOKS_API_KEY is valid and has quota remaining.'
          : 'No GOOGLE_BOOKS_API_KEY is configured. Set it in your .env or docker-compose environment.';
        throw new Error(`Google Books API returned 403 Forbidden. ${hint}`);
      }

      return response;
    } catch (err: any) {
      if (err.message?.includes('403 Forbidden')) throw err; // Don't retry hard 403s
      if (attempt === retries) throw err;
      await delay(2000 * attempt);
    }
  }
  throw new Error('Max retries exceeded — Google Books API rate limit. Consider adding GOOGLE_BOOKS_API_KEY to .env');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
