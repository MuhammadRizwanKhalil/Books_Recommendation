/**
 * Cover Resolver — Multi-source high-quality book cover image fetcher.
 *
 * Tries multiple sources in quality order:
 *  1. Open Library Covers API (L size) — free, no key, often 600-800px
 *  2. Google Books with zoom=0 — full-size cover (400-600px)
 *  3. Google Books extraLarge / large from API response
 *  4. Original Google Books thumbnail (fallback)
 *
 * Used during import and as a bulk upgrade endpoint for existing books.
 */

import { logger } from '../lib/logger.js';

// ── Configuration ───────────────────────────────────────────────────────────

const OL_COVERS_BASE = 'https://covers.openlibrary.org/b';
const OL_COVERS_TIMEOUT = 8000; // 8s per image check
const REQUEST_DELAY_MS = 300;   // Delay between requests to avoid rate limits

// Open Library rate limit: 100 requests / 5 min = 20/min
// We'll stay well under with REQUEST_DELAY_MS

const USER_AGENT = 'Mozilla/5.0 (compatible; TheBookTimes/1.0; +https://thebooktimes.com)';

// ── Types ───────────────────────────────────────────────────────────────────

export interface CoverResult {
  url: string;
  source: 'openlibrary' | 'google-hd' | 'google-original';
  width?: number;
  height?: number;
}

export interface BookIdentifiers {
  isbn13?: string | null;
  isbn10?: string | null;
  googleBooksId?: string | null;
  /** The current cover URL (Google Books thumbnail) */
  currentCoverUrl?: string | null;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Find the best available cover image for a book.
 * Tries sources in quality order, returns the first valid HD cover.
 * Falls back to the current cover URL if nothing better is found.
 */
export async function resolveHDCover(
  identifiers: BookIdentifiers,
): Promise<CoverResult | null> {
  const { isbn13, isbn10, googleBooksId, currentCoverUrl } = identifiers;

  // 1. Try Open Library (best quality, large scans)
  const olCover = await tryOpenLibrary(isbn13, isbn10);
  if (olCover) return olCover;

  // 2. Try Amazon product image (reliable for popular books)
  const amazonCover = tryAmazonCoverImage(isbn13, isbn10);
  if (amazonCover) {
    const isValid = await validateCoverUrl(amazonCover.url);
    if (isValid) return amazonCover;
  }

  // 3. Try Google Books zoom=0 (full-size, no crop)
  const googleHD = tryGoogleBooksHD(googleBooksId, currentCoverUrl);
  if (googleHD) return googleHD;

  // 4. Keep original if nothing better found
  return null;
}

/**
 * Batch-resolve HD covers for multiple books.
 * Yields progress callbacks for UI updates.
 */
export async function batchResolveCovers(
  books: Array<{ id: string } & BookIdentifiers>,
  onProgress?: (msg: string) => void,
): Promise<{ upgraded: number; failed: number; skipped: number }> {
  let upgraded = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    try {
      const result = await resolveHDCover(book);
      if (result) {
        // Return the result for the caller to update the DB
        onProgress?.(`[${i + 1}/${books.length}] ✓ Upgraded (${result.source}): ${book.id}`);
        // The caller should handle DB updates
        (book as any)._resolvedCover = result;
        upgraded++;
      } else {
        skipped++;
      }
    } catch (err: any) {
      failed++;
      onProgress?.(`[${i + 1}/${books.length}] ✗ Failed: ${book.id} — ${err.message}`);
    }

    // Respect rate limits
    if (i < books.length - 1) {
      await delay(REQUEST_DELAY_MS);
    }
  }

  return { upgraded, failed, skipped };
}

// ── Open Library ────────────────────────────────────────────────────────────

/**
 * Try to get a large cover from Open Library Covers API.
 * Uses ISBN-13 first, then ISBN-10.
 * Returns null if no cover found or image is a placeholder.
 */
async function tryOpenLibrary(
  isbn13?: string | null,
  isbn10?: string | null,
): Promise<CoverResult | null> {
  // Try ISBN-13 first (more reliable)
  if (isbn13) {
    const result = await checkOpenLibraryCover('isbn', isbn13);
    if (result) return result;
  }

  // Fall back to ISBN-10
  if (isbn10) {
    const result = await checkOpenLibraryCover('isbn', isbn10);
    if (result) return result;
  }

  return null;
}

/**
 * Check a single Open Library cover URL.
 * The L (large) size gives the highest resolution scans.
 * Uses ?default=false to get 404 instead of blank image.
 */
async function checkOpenLibraryCover(
  key: 'isbn' | 'olid',
  value: string,
): Promise<CoverResult | null> {
  const url = `${OL_COVERS_BASE}/${key}/${value}-L.jpg?default=false`;

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(OL_COVERS_TIMEOUT),
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    if (!response.ok) {
      return null; // 404 = no cover available
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      return null;
    }

    // Check content-length — reject tiny placeholders (< 1KB)
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (contentLength > 0 && contentLength < 1000) {
      return null; // Likely a 1x1 pixel or tiny placeholder
    }

    // Return the cover URL without ?default=false for actual use
    const coverUrl = `${OL_COVERS_BASE}/${key}/${value}-L.jpg`;

    return {
      url: coverUrl,
      source: 'openlibrary',
    };
  } catch {
    return null; // Timeout or network error
  }
}

// ── Amazon Product Images ───────────────────────────────────────────────────

/**
 * Build an Amazon product image URL from ISBN.
 * Amazon hosts cover images at images-na.ssl-images-amazon.com using the ISBN
 * as the product ASIN. Works for many popular books.
 */
function tryAmazonCoverImage(
  isbn13?: string | null,
  isbn10?: string | null,
): CoverResult | null {
  // ISBN-10 is the Amazon ASIN for most books
  const asin = isbn10 || isbn13;
  if (!asin) return null;

  // Amazon image URL pattern — large size (._SL500_)
  const url = `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SL500_.jpg`;
  return { url, source: 'openlibrary' as const }; // credited as external
}

/**
 * Validate a cover URL by issuing a HEAD request.
 * Returns true if the URL returns a valid image response > 1KB.
 */
async function validateCoverUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(OL_COVERS_TIMEOUT),
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) return false;
    const cl = parseInt(res.headers.get('content-length') || '0', 10);
    if (cl > 0 && cl < 1000) return false; // tiny placeholder
    return true;
  } catch {
    return false;
  }
}

// ── Google Books HD ─────────────────────────────────────────────────────────

/**
 * Build a Google Books cover URL with zoom=0 (full-size, no crop).
 * 
 * Google Books image URL format:
 *   books.google.com/books/content?id=XXXXX&printsec=frontcover&img=1&zoom=N
 *   
 * zoom=0: Full-size (~800px)
 * zoom=1: Standard thumbnail (~128px)  
 * zoom=2: Medium (~200px)
 * zoom=3: Large (~400px)
 * zoom=5: Tiny (~100px, used for smallThumbnail)
 *
 * We construct the zoom=0 URL from the Google Books ID.
 */
function tryGoogleBooksHD(
  googleBooksId?: string | null,
  currentCoverUrl?: string | null,
): CoverResult | null {
  // Build HD URL from Google Books ID
  if (googleBooksId) {
    const hdUrl = `https://books.google.com/books/content?id=${googleBooksId}&printsec=frontcover&img=1&zoom=0&source=gbs_api`;
    return {
      url: hdUrl,
      source: 'google-hd',
    };
  }

  // Try to extract ID from existing cover URL and rebuild with zoom=0
  if (currentCoverUrl) {
    const idMatch = currentCoverUrl.match(/[?&]id=([^&]+)/);
    if (idMatch) {
      const hdUrl = `https://books.google.com/books/content?id=${idMatch[1]}&printsec=frontcover&img=1&zoom=0&source=gbs_api`;
      return {
        url: hdUrl,
        source: 'google-hd',
      };
    }
  }

  return null;
}

// ── Author Image Resolution ─────────────────────────────────────────────────

/**
 * Try to find an author photo from Open Library Authors API.
 * Uses the search endpoint to find the OLID, then builds the photo URL.
 */
export async function resolveAuthorImage(authorName: string): Promise<string | null> {
  if (!authorName || authorName.trim().length < 2) return null;

  try {
    // 1. Try Open Library Author search
    const olImage = await tryOpenLibraryAuthorImage(authorName);
    if (olImage) return olImage;

    return null;
  } catch (err) {
    logger.debug(`Author image resolution failed for "${authorName}": ${err}`);
    return null;
  }
}

/**
 * Search Open Library for an author and get their photo.
 * Open Library Authors API: https://openlibrary.org/dev/docs/api/authors
 */
async function tryOpenLibraryAuthorImage(authorName: string): Promise<string | null> {
  try {
    // Search for author
    const searchUrl = `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(authorName)}&limit=1`;
    const response = await fetch(searchUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) return null;

    const data = await response.json() as any;
    if (!data.docs || data.docs.length === 0) return null;

    const author = data.docs[0];
    const olKey = author.key; // e.g. "OL1234A"

    if (!olKey) return null;

    // Check if the author photo exists
    const photoUrl = `${OL_COVERS_BASE}/olid/${olKey}-L.jpg?default=false`;

    const headRes = await fetch(photoUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
    });

    if (!headRes.ok) return null;

    const contentType = headRes.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;

    const contentLength = parseInt(headRes.headers.get('content-length') || '0', 10);
    if (contentLength > 0 && contentLength < 1000) return null; // tiny placeholder

    // Return the actual image URL (without default=false)
    return `${OL_COVERS_BASE}/olid/${olKey}-L.jpg`;
  } catch {
    return null;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
