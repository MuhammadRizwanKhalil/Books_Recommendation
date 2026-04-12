import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { dbGet, dbAll, dbRun, dbTransaction } from '../database.js';
import { authenticate, requireAdmin, optionalAuth, rateLimit } from '../middleware.js';
import {
  getTrending,
  getTopRated,
  getRecommendations,
  getPersonalizedRecommendations,
  getBookOfTheDay,
  getBookOfTheDayHistory,
  setBookOfTheDayOverride,
  recalculateBookScore,
} from '../services/scoring.js';

const router = Router();

// ── File Upload Setup ───────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads', 'covers');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});

// ── Fuzzy / N-gram helpers ──────────────────────────────────────────────────

/**
 * Generate overlapping n-grams (bigrams + trigrams) from a string.
 * e.g. "atomic" → ["at","to","om","mi","ic","ato","tom","omi","mic"]
 */
function ngrams(str: string, minN = 2, maxN = 3): string[] {
  const s = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const result: string[] = [];
  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= s.length - n; i++) {
      result.push(s.substring(i, i + n));
    }
  }
  return result;
}

/**
 * Split a query into meaningful tokens, generating word-level fragments
 * for fuzzy matching. Returns an array of LIKE patterns.
 * e.g. "atmic hbits" → ["%atmic%", "%hbits%", "%atm%", "%tmi%", "%mic%", "%hbi%", "%bit%", "%its%"]
 */
function fuzzyPatterns(query: string): string[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(w => w.length >= 2);
  const patterns = new Set<string>();

  // Full words as LIKE patterns (for partial matching already)
  for (const word of words) {
    patterns.add(`%${word}%`);
  }

  // Add trigrams for each word (enables typo tolerance)
  for (const word of words) {
    if (word.length >= 3) {
      for (const gram of ngrams(word, 3, 3)) {
        patterns.add(`%${gram}%`);
      }
    }
  }

  return Array.from(patterns);
}

/**
 * Build a fuzzy search query that scores results by how many patterns match.
 * Uses a subquery to compute fuzzy_score, then filters by threshold.
 */
function buildFuzzyQuery(
  baseTable: string,
  columns: string[],
  patterns: string[],
  extraConditions: string = '',
  extraParams: any[] = [],
  selectCols: string = '*',
  limit: number = 20
): { sql: string; params: any[] } {
  if (patterns.length === 0) {
    return { sql: `SELECT ${selectCols}, 0 AS fuzzy_score FROM ${baseTable} WHERE 1=0`, params: [] };
  }

  // Each pattern adds to fuzzy_score when it matches any of the target columns
  const scoreCases = patterns.map(() => {
    const colChecks = columns.map(col => `${col} LIKE ?`).join(' OR ');
    return `CASE WHEN (${colChecks}) THEN 1 ELSE 0 END`;
  });

  const scoreExpr = scoreCases.join(' + ');

  // At least 30% of patterns must match (minimum 1)
  const threshold = Math.max(1, Math.floor(patterns.length * 0.3));

  const params: any[] = [...extraParams];
  // Params for inner score expression
  for (const pattern of patterns) {
    for (const _col of columns) {
      params.push(pattern);
    }
  }
  params.push(threshold, limit);

  const sql = `
    SELECT * FROM (
      SELECT ${selectCols}, (${scoreExpr}) AS fuzzy_score
      FROM ${baseTable}
      ${extraConditions ? `WHERE ${extraConditions}` : ''}
    ) sub
    WHERE sub.fuzzy_score >= ?
    ORDER BY sub.fuzzy_score DESC, sub.computed_score DESC
    LIMIT ?
  `;

  return { sql, params };
}

// ── Prepared Statements ─────────────────────────────────────────────────────

// Helper: build book response with categories (single book)
async function buildBookResponse(book: any) {
  const categories = await dbAll<any>(`
    SELECT c.id, c.name, c.slug FROM categories c
    JOIN book_categories bc ON bc.category_id = c.id
    WHERE bc.book_id = ?
  `, [book.id]);
  return await mapBookToResponse(book, categories.map(c => c.name));
}

// Helper: batch build book responses (prevents N+1 queries)
async function buildBookResponses(books: any[]) {
  if (books.length === 0) return [];
  
  // Batch load all categories for all books in one query
  const bookIds = books.map(b => b.id);
  const placeholders = bookIds.map(() => '?').join(',');
  const allCats = await dbAll<any>(`
    SELECT bc.book_id, c.name FROM categories c
    JOIN book_categories bc ON bc.category_id = c.id
    WHERE bc.book_id IN (${placeholders})
  `, bookIds);
  
  // Group categories by book_id
  const catMap = new Map<string, string[]>();
  for (const row of allCats) {
    const existing = catMap.get(row.book_id) || [];
    existing.push(row.name);
    catMap.set(row.book_id, existing);
  }
  
  return Promise.all(books.map(book => mapBookToResponse(book, catMap.get(book.id) || [])));
}

// Map a raw DB book row to API response format
async function mapBookToResponse(book: any, categoryNames: string[]) {
  // Look up all authors via book_authors junction (multi-author support)
  let authorData: any = null;
  let authorsData: any[] = [];
  
  const authorRows = await dbAll<any>(
    `SELECT a.id, a.name, a.slug, a.image_url
     FROM book_authors ba
     JOIN authors a ON a.id = ba.author_id
     WHERE ba.book_id = ?
     ORDER BY ba.position ASC`,
    [book.id],
  );

  if (authorRows.length > 0) {
    authorsData = authorRows.map(r => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      imageUrl: r.image_url || null,
    }));
    // Primary author (first) for backward compatibility
    authorData = authorsData[0];
  } else if (book.author_id) {
    // Fallback to legacy author_id
    const authorRow = await dbGet<any>('SELECT id, name, slug, image_url FROM authors WHERE id = ?', [book.author_id]);
    if (authorRow) {
      authorData = {
        id: authorRow.id,
        name: authorRow.name,
        slug: authorRow.slug,
        imageUrl: authorRow.image_url || null,
      };
      authorsData = [authorData];
    }
  }

  return {
    id: book.id,
    googleBooksId: book.google_books_id,
    isbn10: book.isbn10,
    isbn13: book.isbn13,
    slug: book.slug,
    title: book.title,
    subtitle: book.subtitle,
    author: book.author,
    authorId: book.author_id || null,
    authorData,
    authorsData,
    description: book.description,
    coverImage: book.cover_image,
    publisher: book.publisher,
    publishedDate: book.published_date,
    pageCount: book.page_count,
    language: book.language,
    categories: categoryNames,
    googleRating: book.google_rating,
    ratingsCount: book.ratings_count,
    computedScore: book.computed_score,
    price: book.price,
    currency: book.currency,
    amazonUrl: book.amazon_url,
    metaTitle: book.meta_title,
    metaDescription: book.meta_description,
    ogImage: book.og_image || null,
    canonicalUrl: book.canonical_url || null,
    focusKeyword: book.focus_keyword || null,
    seoRobots: book.seo_robots || 'index, follow',
    goodreadsUrl: book.goodreads_url || null,
    customLinkLabel: book.custom_link_label || null,
    customLinkUrl: book.custom_link_url || null,
    adminNotes: book.admin_notes || null,
    status: book.status,
    isActive: !!book.is_active,
    indexedAt: book.indexed_at,
    createdAt: book.created_at,
    updatedAt: book.updated_at,
  };
}

// ── GET /api/books ──────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      sort = 'computed_score',
      order = 'desc',
      category,
      search,
      status,
      minRating,
      maxRating,
      yearFrom,
      yearTo,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clauses
    const conditions: string[] = [];
    const params: any[] = [];

    // Non-admin users only see published books
    if (!req.user || req.user.role !== 'admin') {
      conditions.push('b.status = ?');
      params.push('PUBLISHED');
      conditions.push('b.is_active = 1');
    } else if (status) {
      conditions.push('b.status = ?');
      params.push(status);
    }

    if (category) {
      conditions.push('EXISTS (SELECT 1 FROM book_categories bc JOIN categories c ON c.id = bc.category_id WHERE bc.book_id = b.id AND c.slug = ?)');
      params.push(category);
    }

    if (search) {
      const searchStr = String(search).slice(0, 200); // Cap search input length
      // Use MySQL FULLTEXT search for fast, ranked results
      let ftsMatched = false;
      try {
        const ftsIds = await dbAll<any>(`
          SELECT b.id FROM books b
          WHERE MATCH(b.title, b.author, b.description) AGAINST(? IN BOOLEAN MODE)
        `, [searchStr.replace(/[^\w\s]/g, '') + '*']);
        if (ftsIds.length > 0) {
          const idPlaceholders = ftsIds.map(() => '?').join(',');
          conditions.push(`b.id IN (${idPlaceholders})`);
          params.push(...ftsIds.map(r => r.id));
          ftsMatched = true;
        }
      } catch { /* FULLTEXT not available */ }

      if (!ftsMatched) {
        // Try simple LIKE first
        const likeCheck = await dbGet<any>(`
          SELECT id FROM books
          WHERE (title LIKE ? OR author LIKE ?)
            AND status = 'PUBLISHED' AND is_active = 1
          LIMIT 1
        `, [`%${searchStr}%`, `%${searchStr}%`]);

        if (likeCheck) {
          conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)');
          const searchTerm = `%${searchStr}%`;
          params.push(searchTerm, searchTerm, searchTerm);
        } else {
          // Fuzzy fallback — use n-gram matching for typo-tolerant search
          const patterns = fuzzyPatterns(searchStr);
          if (patterns.length > 0) {
            const scoreParts = patterns.map(() => `CASE WHEN (title LIKE ? OR author LIKE ?) THEN 1 ELSE 0 END`);
            const scoreExpr = scoreParts.join(' + ');
            const threshold = Math.max(1, Math.floor(patterns.length * 0.3));

            const fuzzyParams: any[] = [];
            for (const p of patterns) { fuzzyParams.push(p, p); }

            const fuzzyIds = await dbAll<any>(`
              SELECT * FROM (
                SELECT id, (${scoreExpr}) AS score
                FROM books
                WHERE status = 'PUBLISHED' AND is_active = 1
              ) sub
              WHERE sub.score >= ?
              ORDER BY sub.score DESC
              LIMIT 200
            `, [...fuzzyParams, threshold]);

            if (fuzzyIds.length > 0) {
              const idPlaceholders = fuzzyIds.map(() => '?').join(',');
              conditions.push(`b.id IN (${idPlaceholders})`);
              params.push(...fuzzyIds.map(r => r.id));
            } else {
              // Nothing found at all — push impossible condition
              conditions.push('1 = 0');
            }
          } else {
            conditions.push('(b.title LIKE ? OR b.author LIKE ? OR b.description LIKE ?)');
            const searchTerm = `%${searchStr}%`;
            params.push(searchTerm, searchTerm, searchTerm);
          }
        }
      }
    }

    if (minRating) {
      conditions.push('b.google_rating >= ?');
      params.push(parseFloat(minRating as string));
    }

    if (maxRating) {
      conditions.push('b.google_rating <= ?');
      params.push(parseFloat(maxRating as string));
    }

    if (yearFrom) {
      conditions.push("CAST(SUBSTRING(b.published_date, 1, 4) AS UNSIGNED) >= ?");
      params.push(parseInt(yearFrom as string, 10));
    }

    if (yearTo) {
      conditions.push("CAST(SUBSTRING(b.published_date, 1, 4) AS UNSIGNED) <= ?");
      params.push(parseInt(yearTo as string, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Validate sort column
    const validSorts = ['computed_score', 'google_rating', 'ratings_count', 'title', 'author', 'created_at', 'published_date', 'price'];
    const sortCol = validSorts.includes(sort as string) ? sort : 'computed_score';
    const sortOrder = (order as string).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Count total
    const countRow = await dbGet<any>(`SELECT COUNT(*) as total FROM books b ${whereClause}`, params);
    const total = countRow.total;

    // Build relevance-boosted ORDER BY when searching
    let orderClause: string;
    const queryParams = [...params];

    if (search && sort === 'computed_score') {
      // Boost exact and partial title/author matches for better search relevance
      const searchStr = String(search).slice(0, 200).toLowerCase();
      orderClause = `ORDER BY
        (CASE WHEN LOWER(b.title) = ? THEN 100
              WHEN LOWER(b.title) LIKE ? THEN 50
              WHEN LOWER(b.author) = ? THEN 40
              WHEN LOWER(b.author) LIKE ? THEN 20
              ELSE 0 END
         + LOG(1 + b.ratings_count) * 2
         + b.computed_score * 0.5) DESC`;
      queryParams.push(searchStr, `${searchStr}%`, searchStr, `${searchStr}%`);
    } else {
      orderClause = `ORDER BY b.${sortCol} ${sortOrder}`;
    }

    // Fetch books
    const books = await dbAll<any>(`
      SELECT b.* FROM books b
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `, [...queryParams, limitNum, offset]);

    res.json({
      books: await buildBookResponses(books),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get books error');
    res.status(500).json({ error: 'Failed to fetch books' });
  }
});

// ── GET /api/books/search-suggestions ───────────────────────────────────────
// Fast autocomplete with fuzzy matching (trigram-based)
router.get('/search-suggestions', rateLimit('search-suggest', 30, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 200); // Cap input length
    if (!q || q.length < 2) {
      res.json({ suggestions: [], categories: [], authors: [] });
      return;
    }

    const sanitized = q.replace(/[^\w\s]/g, '');

    // ─── Book suggestions ─────────────────────────────────────────────
    let bookSuggestions: any[] = [];

    // 1) Try MySQL FULLTEXT first (fastest, prefix-matching)
    try {
      bookSuggestions = await dbAll<any>(`
        SELECT b.id, b.title, b.author, b.slug, b.cover_image, b.google_rating, b.computed_score
        FROM books b
        WHERE MATCH(b.title, b.author, b.description) AGAINST(? IN BOOLEAN MODE)
          AND b.status = 'PUBLISHED' AND b.is_active = 1
        ORDER BY b.computed_score DESC
        LIMIT 6
      `, [sanitized + '*']);
    } catch { /* FULLTEXT not available */ }

    // 2) If FULLTEXT returned nothing, try LIKE (partial substring)
    if (bookSuggestions.length === 0) {
      bookSuggestions = await dbAll<any>(`
        SELECT id, title, author, slug, cover_image, google_rating, computed_score
        FROM books
        WHERE (title LIKE ? OR author LIKE ?)
          AND status = 'PUBLISHED' AND is_active = 1
        ORDER BY computed_score DESC
        LIMIT 6
      `, [`%${q}%`, `%${q}%`]);
    }

    // 3) If still nothing, use fuzzy n-gram matching (typo tolerance)
    if (bookSuggestions.length === 0) {
      const patterns = fuzzyPatterns(q);
      if (patterns.length > 0) {
        const scoreParts = patterns.map(() => `CASE WHEN (title LIKE ? OR author LIKE ?) THEN 1 ELSE 0 END`);
        const scoreExpr = scoreParts.join(' + ');
        const threshold = Math.max(1, Math.floor(patterns.length * 0.3));

        const fuzzyParams: any[] = [];
        for (const p of patterns) { fuzzyParams.push(p, p); }

        bookSuggestions = await dbAll<any>(`
          SELECT * FROM (
            SELECT id, title, author, slug, cover_image, google_rating, computed_score,
                   (${scoreExpr}) AS score
            FROM books
            WHERE status = 'PUBLISHED' AND is_active = 1
          ) sub
          WHERE sub.score >= ?
          ORDER BY sub.score DESC, sub.computed_score DESC
          LIMIT 6
        `, [...fuzzyParams, threshold]);
      }
    }

    // ─── Category suggestions ─────────────────────────────────────────
    let categorySuggestions = await dbAll<any>(`
      SELECT c.id, c.name, c.slug, COUNT(bc.book_id) as book_count
      FROM categories c
      LEFT JOIN book_categories bc ON bc.category_id = c.id
      WHERE c.name LIKE ?
      GROUP BY c.id
      ORDER BY book_count DESC
      LIMIT 3
    `, [`%${q}%`]);

    // Fuzzy fallback for categories
    if (categorySuggestions.length === 0) {
      const patterns = fuzzyPatterns(q);
      for (const p of patterns) {
        categorySuggestions = await dbAll<any>(`
          SELECT c.id, c.name, c.slug, COUNT(bc.book_id) as book_count
          FROM categories c
          LEFT JOIN book_categories bc ON bc.category_id = c.id
          WHERE c.name LIKE ?
          GROUP BY c.id
          ORDER BY book_count DESC
          LIMIT 3
        `, [p]);
        if (categorySuggestions.length > 0) break;
      }
    }

    // ─── Author suggestions (from authors table with slugs) ────────────
    let authorSuggestions = await dbAll<any>(`
      SELECT a.id, a.name, a.slug, a.image_url,
        (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1) as book_count,
        (SELECT MAX(b.computed_score) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED') as top_score
      FROM authors a
      WHERE a.name LIKE ?
      ORDER BY top_score DESC
      LIMIT 4
    `, [`%${q}%`]);

    // Fuzzy fallback for authors
    if (authorSuggestions.length === 0) {
      const patterns = fuzzyPatterns(q);
      for (const p of patterns) {
        authorSuggestions = await dbAll<any>(`
          SELECT a.id, a.name, a.slug, a.image_url,
            (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1) as book_count,
            (SELECT MAX(b.computed_score) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED') as top_score
          FROM authors a
          WHERE a.name LIKE ?
          ORDER BY top_score DESC
          LIMIT 4
        `, [p]);
        if (authorSuggestions.length > 0) break;
      }
    }

    const totalResults = bookSuggestions.length + categorySuggestions.length + authorSuggestions.length;

    // Log search query for analytics (non-blocking, best-effort)
    const { v4: uuidv4Sq } = await import('uuid');
    dbRun(
      `INSERT INTO search_queries (id, query, results_count, user_id, ip_address) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4Sq(), q, totalResults, req.user?.userId || null, req.ip || null],
    ).catch(() => { /* non-critical */ });

    res.json({
      suggestions: bookSuggestions.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        slug: b.slug,
        coverImage: b.cover_image,
        googleRating: b.google_rating,
      })),
      categories: categorySuggestions.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        bookCount: c.book_count,
      })),
      authors: authorSuggestions.map(a => ({
        id: a.id,
        name: a.name,
        slug: a.slug,
        imageUrl: a.image_url || null,
        bookCount: a.book_count || 0,
      })),
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Search suggestions error');
    res.status(500).json({ suggestions: [], categories: [], authors: [] });
  }
});

// ── GET /api/books/authors ──────────────────────────────────────────────────
// Top authors from the authors table with stats
router.get('/authors', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit as string || '12', 10)));

    const authors = await dbAll<any>(`
      SELECT 
        a.id, a.name, a.slug, a.bio, a.image_url,
        COUNT(b.id) as book_count,
        ROUND(AVG(b.google_rating), 1) as avg_rating,
        MAX(b.computed_score) as top_score,
        (SELECT cover_image FROM books WHERE author_id = a.id AND status = 'PUBLISHED' ORDER BY computed_score DESC LIMIT 1) as top_cover
      FROM authors a
      LEFT JOIN books b ON b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1
      GROUP BY a.id
      HAVING book_count >= 1
      ORDER BY top_score DESC
      LIMIT ?
    `, [limit]);

    // For each author, get their top categories
    const result = await Promise.all(authors.map(async (a: any) => {
      const cats = await dbAll<any>(`
        SELECT c.name FROM categories c
        JOIN book_categories bc ON bc.category_id = c.id
        JOIN books b ON b.id = bc.book_id
        WHERE b.author_id = ? AND b.status = 'PUBLISHED'
        GROUP BY c.name
        ORDER BY COUNT(*) DESC
        LIMIT 3
      `, [a.id]);

      return {
        id: a.id,
        name: a.name,
        slug: a.slug,
        bookCount: a.book_count,
        avgRating: a.avg_rating || 0,
        topCover: a.top_cover || '',
        imageUrl: a.image_url || null,
        specialties: cats.map((c: any) => c.name),
      };
    }));

    res.json(result);
  } catch (err: any) {
    logger.error({ err: err }, 'Authors error');
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
});

// ── GET /api/books/trending ─────────────────────────────────────────────────
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '8', 10)));
    const trendingBooks = await getTrending(limit);
    res.json(await buildBookResponses(trendingBooks));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch trending books' });
  }
});

// ── GET /api/books/new-releases ─────────────────────────────────────────────
router.get('/new-releases', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || 'this-month';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '8', 10)));

    // Calculate date range based on period
    const now = new Date();
    let startDate: string;
    let endDate: string = now.toISOString().split('T')[0];

    switch (period) {
      case 'this-week': {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay()); // Start of week (Sunday)
        startDate = d.toISOString().split('T')[0];
        break;
      }
      case 'last-week': {
        const d = new Date(now);
        d.setDate(d.getDate() - d.getDay() - 7);
        startDate = d.toISOString().split('T')[0];
        const e = new Date(d);
        e.setDate(e.getDate() + 6);
        endDate = e.toISOString().split('T')[0];
        break;
      }
      case 'this-month': {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        break;
      }
      case 'last-month': {
        const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        startDate = d.toISOString().split('T')[0];
        const e = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of prev month
        endDate = e.toISOString().split('T')[0];
        break;
      }
      default:
        startDate = `${now.getFullYear()}-01-01`;
    }

    // Try date-range query first; if not enough results, just get latest
    let books = await dbAll<any>(`
      SELECT * FROM books 
      WHERE status = 'PUBLISHED' AND is_active = 1
        AND published_date >= ? AND published_date <= ?
      ORDER BY published_date DESC LIMIT ?
    `, [startDate, endDate, limit]);

    if (books.length === 0) {
      // Fallback: just get recent books regardless of period
      books = await dbAll<any>(`
        SELECT * FROM books WHERE status = 'PUBLISHED' AND is_active = 1
        ORDER BY published_date DESC LIMIT ?
      `, [limit]);
    }

    res.json(await buildBookResponses(books));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch new releases' });
  }
});

// ── GET /api/books/top-rated ────────────────────────────────────────────────
router.get('/top-rated', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string || '8', 10)));
    const books = await getTopRated(limit);
    res.json(await buildBookResponses(books));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch top rated books' });
  }
});

// ── GET /api/books/book-of-the-day ──────────────────────────────────────────
router.get('/book-of-the-day', async (req: Request, res: Response) => {
  try {
    const book = await getBookOfTheDay();
    if (!book) {
      res.status(200).json(null);
      return;
    }
    const response = (await buildBookResponses([book]))[0];
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch book of the day' });
  }
});

// ── GET /api/books/book-of-the-day/history ─────────────────────────────────
router.get('/book-of-the-day/history', async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(7, parseInt(req.query.days as string || '30', 10)));
    const history = await getBookOfTheDayHistory(days);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch BOTD history' });
  }
});

// ── POST /api/books/book-of-the-day/override (Admin) ───────────────────────
router.post('/book-of-the-day/override', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { bookId, date, adminNote } = req.body;
  if (!bookId || !date) {
    res.status(400).json({ error: 'bookId and date are required' });
    return;
  }
  try {
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? AND status = \'PUBLISHED\'', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found or not published' });
      return;
    }
    await setBookOfTheDayOverride(bookId, date, adminNote);
    res.json({ message: `Book of the Day for ${date} set to book ${bookId}` });
  } catch (err: any) {
    logger.error({ err }, 'BOTD override error');
    res.status(500).json({ error: 'Failed to set BOTD override' });
  }
});

// ── GET /api/books/recommendations/:bookId ──────────────────────────────────
router.get('/recommendations/:bookId', async (req: Request, res: Response) => {
  try {
    const bookId = req.params.bookId as string;
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit as string || '6', 10)));

    const result = await getRecommendations(bookId, limit);
    res.json({
      books: await buildBookResponses(result.books),
      strategy: result.strategy,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
});

// ── GET /api/books/for-you ──────────────────────────────────────────────────
// Personalized ML-style recommendations using collaborative + content-based filtering
router.get('/for-you', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit as string || '12', 10)));

    const result = await getPersonalizedRecommendations(userId, limit);
    res.json({
      books: await buildBookResponses(result.books),
      strategies: result.strategies,
      confidence: result.confidence,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to get personalized recommendations');
    res.status(500).json({ error: 'Failed to fetch personalized recommendations' });
  }
});

// ── GET /api/books/:slug ────────────────────────────────────────────────────
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await dbGet<any>('SELECT * FROM books WHERE slug = ?', [req.params.slug]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Track page view (non-blocking — don't delay response)
    setImmediate(async () => {
      try {
        await dbRun(`
          INSERT INTO page_views (id, page_path, page_title, user_id, session_id)
          VALUES (?, ?, ?, ?, ?)
        `, [uuidv4(), `/books/${book.slug}`, book.title, req.user?.userId || null, null]);

        await dbRun(`
          INSERT INTO analytics_events (id, event_type, entity_type, entity_id, user_id)
          VALUES (?, 'view', 'book', ?, ?)
        `, [uuidv4(), book.id, req.user?.userId || null]);
      } catch (e) {
        // Analytics failure should never block
      }
    });

    res.json(await buildBookResponse(book));
  } catch (err: any) {
    logger.error({ err: err }, 'Get book error');
    res.status(500).json({ error: 'Failed to fetch book' });
  }
});

// ── POST /api/books/upload-cover (Admin) ────────────────────────────────────
router.post('/upload-cover', authenticate, requireAdmin, upload.single('cover'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const id = uuidv4();
    const baseFilename = `${id}`;

    // Generate 3 responsive sizes + full size, all as WebP
    // This enables srcset for faster loading on different devices
    const sizes = [
      { suffix: '_thumb', width: 120, height: 180, quality: 80 },   // Card thumbnails
      { suffix: '_card',  width: 300, height: 450, quality: 85 },   // Book cards
      { suffix: '_full',  width: 600, height: 900, quality: 88 },   // Detail pages
    ];

    const generatedFiles: string[] = [];

    for (const { suffix, width, height, quality } of sizes) {
      const filename = `${baseFilename}${suffix}.webp`;
      const outputPath = path.join(UPLOADS_DIR, filename);
      await sharp(req.file.buffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality })
        .toFile(outputPath);
      generatedFiles.push(filename);
    }

    // Primary URL points to full size; other sizes available via _thumb and _card suffixes
    const url = `/uploads/covers/${baseFilename}_full.webp`;
    const thumbUrl = `/uploads/covers/${baseFilename}_thumb.webp`;
    const cardUrl = `/uploads/covers/${baseFilename}_card.webp`;

    res.json({ url, thumbUrl, cardUrl, filename: `${baseFilename}_full.webp` });
  } catch (err: any) {
    logger.error({ err: err }, 'Cover upload error');
    res.status(500).json({ error: 'Failed to upload cover image' });
  }
});

// ── POST /api/books (Admin) ─────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { title, subtitle, author, authorId, description, coverImage, publisher, publishedDate, pageCount, language, googleRating, ratingsCount, computedScore, price, currency, amazonUrl, isbn10, isbn13, googleBooksId, categories, status, metaTitle, metaDescription, ogImage, canonicalUrl, focusKeyword, seoRobots, goodreadsUrl, customLinkLabel, customLinkUrl, adminNotes } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: string[] = [];
    if (!title || typeof title !== 'string' || title.trim().length === 0) errors.push('Title is required');
    if (!author || typeof author !== 'string' || author.trim().length === 0) errors.push('Author is required');
    if (!coverImage || typeof coverImage !== 'string' || coverImage.trim().length === 0) errors.push('Cover image is required');
    if (title && title.length > 300) errors.push('Title must be under 300 characters');
    if (metaTitle && metaTitle.length > 70) errors.push('Meta title should be under 70 characters');
    if (metaDescription && metaDescription.length > 170) errors.push('Meta description should be under 170 characters');
    if (isbn10 && !/^\d{9}[\dXx]$/.test(isbn10)) errors.push('ISBN-10 must be exactly 10 characters (digits, last may be X)');
    if (isbn13 && !/^\d{13}$/.test(isbn13)) errors.push('ISBN-13 must be exactly 13 digits');
    if (amazonUrl && !/^https?:\/\//.test(amazonUrl)) errors.push('Amazon URL must be a valid URL');
    if (goodreadsUrl && !/^https?:\/\//.test(goodreadsUrl)) errors.push('Goodreads URL must be a valid URL');
    if (customLinkUrl && !/^https?:\/\//.test(customLinkUrl)) errors.push('Custom link URL must be a valid URL');
    if (googleRating !== undefined && googleRating !== null && (googleRating < 0 || googleRating > 5)) errors.push('Rating must be between 0 and 5');
    if (price !== undefined && price !== null && price < 0) errors.push('Price cannot be negative');

    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    const id = uuidv4();
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Ensure slug uniqueness
    let finalSlug = slug;
    let slugSuffix = 1;
    while (await dbGet<any>('SELECT id FROM books WHERE slug = ?', [finalSlug])) {
      finalSlug = `${slug}-${slugSuffix++}`;
    }

    await dbRun(`
      INSERT INTO books (id, google_books_id, isbn10, isbn13, slug, title, subtitle, author, author_id, description, cover_image, publisher, published_date, page_count, language, google_rating, ratings_count, computed_score, price, currency, amazon_url, meta_title, meta_description, og_image, canonical_url, focus_keyword, seo_robots, goodreads_url, custom_link_label, custom_link_url, admin_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, googleBooksId || null, isbn10 || null, isbn13 || null, finalSlug, title, subtitle || null, author, authorId || null, description || null, coverImage || null, publisher || null, publishedDate || null, pageCount || null, language || 'en', googleRating || null, ratingsCount || 0, computedScore || 0, price || null, currency || 'USD', amazonUrl || null, metaTitle || null, metaDescription || null, ogImage || null, canonicalUrl || null, focusKeyword || null, seoRobots || 'index, follow', goodreadsUrl || null, customLinkLabel || null, customLinkUrl || null, adminNotes || null, status || 'DRAFT']);

    // Link categories
    if (categories && Array.isArray(categories)) {
      for (const catName of categories) {
        const cat = await dbGet<any>('SELECT id FROM categories WHERE name = ? OR slug = ?', [catName, catName]);
        if (cat) {
          await dbRun('INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)', [id, cat.id]);
        }
      }
      // Update category counts
      await updateCategoryCounts();
    }

    const book = await dbGet<any>('SELECT * FROM books WHERE id = ?', [id]);
    res.status(201).json(await buildBookResponse(book));
  } catch (err: any) {
    logger.error({ err: err }, 'Create book error');
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// ── PUT /api/books/:id (Admin) ──────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet<any>('SELECT * FROM books WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const { title, subtitle, author, authorId, description, coverImage, publisher, publishedDate, pageCount, language, googleRating, ratingsCount, computedScore, price, currency, amazonUrl, isbn10, isbn13, categories, status, isActive, metaTitle, metaDescription, ogImage, canonicalUrl, focusKeyword, seoRobots, goodreadsUrl, customLinkLabel, customLinkUrl, adminNotes } = req.body;

    // ── Validation ──────────────────────────────────────────────────────────
    const errors: string[] = [];
    if (title !== undefined && title !== null && typeof title === 'string' && title.trim().length === 0) errors.push('Title cannot be empty');
    if (title && title.length > 300) errors.push('Title must be under 300 characters');
    if (author !== undefined && author !== null && typeof author === 'string' && author.trim().length === 0) errors.push('Author cannot be empty');
    if (metaTitle && metaTitle.length > 70) errors.push('Meta title should be under 70 characters');
    if (metaDescription && metaDescription.length > 170) errors.push('Meta description should be under 170 characters');
    if (isbn10 && !/^\d{9}[\dXx]$/.test(isbn10)) errors.push('ISBN-10 must be exactly 10 characters (digits, last may be X)');
    if (isbn13 && !/^\d{13}$/.test(isbn13)) errors.push('ISBN-13 must be exactly 13 digits');
    if (amazonUrl && !/^https?:\/\//.test(amazonUrl)) errors.push('Amazon URL must be a valid URL');
    if (goodreadsUrl && !/^https?:\/\//.test(goodreadsUrl)) errors.push('Goodreads URL must be a valid URL');
    if (customLinkUrl && !/^https?:\/\//.test(customLinkUrl)) errors.push('Custom link URL must be a valid URL');
    if (googleRating !== undefined && googleRating !== null && (googleRating < 0 || googleRating > 5)) errors.push('Rating must be between 0 and 5');
    if (price !== undefined && price !== null && price < 0) errors.push('Price cannot be negative');

    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    await dbRun(`
      UPDATE books SET
        title = COALESCE(?, title),
        subtitle = COALESCE(?, subtitle),
        author = COALESCE(?, author),
        author_id = COALESCE(?, author_id),
        description = COALESCE(?, description),
        cover_image = COALESCE(?, cover_image),
        publisher = COALESCE(?, publisher),
        published_date = COALESCE(?, published_date),
        page_count = COALESCE(?, page_count),
        language = COALESCE(?, language),
        google_rating = COALESCE(?, google_rating),
        ratings_count = COALESCE(?, ratings_count),
        computed_score = COALESCE(?, computed_score),
        price = COALESCE(?, price),
        currency = COALESCE(?, currency),
        amazon_url = COALESCE(?, amazon_url),
        isbn10 = COALESCE(?, isbn10),
        isbn13 = COALESCE(?, isbn13),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        og_image = COALESCE(?, og_image),
        canonical_url = COALESCE(?, canonical_url),
        focus_keyword = COALESCE(?, focus_keyword),
        seo_robots = COALESCE(?, seo_robots),
        goodreads_url = COALESCE(?, goodreads_url),
        custom_link_label = COALESCE(?, custom_link_label),
        custom_link_url = COALESCE(?, custom_link_url),
        admin_notes = COALESCE(?, admin_notes),
        status = COALESCE(?, status),
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
      WHERE id = ?
    `, [
      title ?? null, subtitle ?? null, author ?? null, authorId ?? null,
      description ?? null,
      coverImage ?? null, publisher ?? null, publishedDate ?? null, pageCount ?? null,
      language ?? null, googleRating ?? null, ratingsCount ?? null, computedScore ?? null,
      price ?? null, currency ?? null, amazonUrl ?? null, isbn10 ?? null, isbn13 ?? null,
      metaTitle ?? null, metaDescription ?? null,
      ogImage ?? null, canonicalUrl ?? null, focusKeyword ?? null, seoRobots ?? null,
      goodreadsUrl ?? null, customLinkLabel ?? null, customLinkUrl ?? null, adminNotes ?? null,
      status ?? null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      id
    ]);

    // Update categories if provided
    if (categories && Array.isArray(categories)) {
      await dbRun('DELETE FROM book_categories WHERE book_id = ?', [id]);
      for (const catName of categories) {
        const cat = await dbGet<any>('SELECT id FROM categories WHERE name = ? OR slug = ?', [catName, catName]);
        if (cat) await dbRun('INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)', [id, cat.id]);
      }
      await updateCategoryCounts();
    }

    const book = await dbGet<any>('SELECT * FROM books WHERE id = ?', [id]);
    res.json(await buildBookResponse(book));
  } catch (err: any) {
    logger.error({ err: err }, 'Update book error');
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// ── DELETE /api/books/:id (Admin) ───────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await dbRun('DELETE FROM books WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }
    await updateCategoryCounts();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// Helper: update category book counts
async function updateCategoryCounts() {
  await dbRun(`
    UPDATE categories SET book_count = (
      SELECT COUNT(*) FROM book_categories bc
      JOIN books b ON b.id = bc.book_id
      WHERE bc.category_id = categories.id AND b.status = 'PUBLISHED' AND b.is_active = 1
    )
  `, []);
}

export default router;
