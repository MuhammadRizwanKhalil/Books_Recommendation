/**
 * Book Import Job
 *
 * Automated daily job that:
 *  1. On first run (empty DB) → fetches top/popular books across all categories
 *  2. On subsequent runs → fetches newly published & trending books
 *  3. Validates every image before storing (clear, correct, not placeholder)
 *  4. Deduplicates by google_books_id and ISBN
 *  5. Updates existing books if their Google data has changed
 *  6. Runs daily via node-cron at a configurable hour
 *
 * Can also be triggered manually via the admin API.
 */

import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbAll, dbRun, dbTransaction } from '../database.js';
import { config } from '../config.js';
import {
  fetchTopBooks,
  fetchDailyNewBooks,
  type NormalizedBook,
} from '../services/googleBooks.js';
import { calculateCompositeScore, recalculateAllScores, invalidatePriorCache } from '../services/scoring.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface ImportJobResult {
  startedAt: string;
  completedAt: string;
  type: 'initial' | 'daily';
  totalFetched: number;
  newBooksInserted: number;
  existingBooksUpdated: number;
  skippedDuplicates: number;
  skippedNoImage: number;
  errors: string[];
}

interface ImportJobLog {
  id: string;
  type: string;
  status: string;
  total_fetched: number;
  new_inserted: number;
  updated: number;
  skipped: number;
  errors: string;
  started_at: string;
  completed_at: string;
}

// ── Database Setup ──────────────────────────────────────────────────────

/** Create the import_jobs log table if it doesn't exist */
export async function initImportJobsTable() {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id VARCHAR(36) PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'running',
      total_fetched INT NOT NULL DEFAULT 0,
      new_inserted INT NOT NULL DEFAULT 0,
      updated INT NOT NULL DEFAULT 0,
      skipped INT NOT NULL DEFAULT 0,
      errors TEXT,
      started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await dbRun(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_import_jobs_type ON import_jobs(type)');
  await safeIdx('CREATE INDEX idx_import_jobs_status ON import_jobs(status)');
  await safeIdx('CREATE INDEX idx_import_jobs_started ON import_jobs(started_at)');
}

// ── Core Import Logic ───────────────────────────────────────────────────

/**
 * Check if this is the first import (no Google Books in DB yet).
 */
async function isFirstImport(): Promise<boolean> {
  const result = await dbGet<any>(
    "SELECT COUNT(*) as count FROM books WHERE google_books_id IS NOT NULL AND google_books_id NOT LIKE 'gb%'",
    []
  );
  return (result?.count || 0) === 0;
}

/**
 * Generate a unique slug for a book title + author.
 */
async function generateUniqueSlug(title: string, author: string): Promise<string> {
  const base = `${title}-${author}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);

  let slug = base;
  let suffix = 1;
  while (await dbGet<any>('SELECT id FROM books WHERE slug = ?', [slug])) {
    slug = `${base}-${suffix}`;
    suffix++;
  }
  return slug;
}

/**
 * Compute an initial score for newly imported books (Google data only).
 * After import, the full composite scoring engine will recalculate scores
 * considering local reviews, engagement, recency, and content quality.
 */
function computeInitialScore(rating: number | null, ratingsCount: number): number {
  if (!rating || ratingsCount === 0) return 0;

  // Bayesian average with dynamic prior
  const C = 3.8; // Conservative prior for imports
  const m = 50;
  const bayesian = (ratingsCount / (ratingsCount + m)) * rating + (m / (ratingsCount + m)) * C;

  // Scale to 0-100
  return Math.round(bayesian * 20 * 10) / 10;
}

/**
 * Find an existing book by Google ID or ISBN.
 * Returns the book's DB id or null.
 */
async function findExistingBook(book: NormalizedBook): Promise<string | null> {
  // Check by Google Books ID
  const byGoogleId = await dbGet<any>('SELECT id FROM books WHERE google_books_id = ?', [book.googleBooksId]);
  if (byGoogleId) return byGoogleId.id;

  // Check by ISBN
  if (book.isbn10) {
    const byIsbn10 = await dbGet<any>('SELECT id FROM books WHERE isbn10 = ? AND isbn10 IS NOT NULL', [book.isbn10]);
    if (byIsbn10) return byIsbn10.id;
  }
  if (book.isbn13) {
    const byIsbn13 = await dbGet<any>('SELECT id FROM books WHERE isbn13 = ? AND isbn13 IS NOT NULL', [book.isbn13]);
    if (byIsbn13) return byIsbn13.id;
  }

  return null;
}

/**
 * Find or create an author by name. Returns the author's DB id.
 */
async function findOrCreateAuthor(authorName: string): Promise<string | null> {
  if (!authorName || authorName.trim().length === 0) return null;
  const trimmed = authorName.trim();

  const existing = await dbGet<any>('SELECT id FROM authors WHERE name = ?', [trimmed]);
  if (existing) return existing.id;

  const id = uuidv4();
  const baseSlug = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);

  let slug = baseSlug;
  let suffix = 1;
  while (await dbGet<any>('SELECT id FROM authors WHERE slug = ?', [slug])) {
    slug = `${baseSlug}-${suffix++}`;
  }

  try {
    await dbRun('INSERT INTO authors (id, name, slug) VALUES (?, ?, ?)', [id, trimmed, slug]);
    return id;
  } catch {
    // Race condition or duplicate — try to find again
    const retry = await dbGet<any>('SELECT id FROM authors WHERE name = ?', [trimmed]);
    return retry?.id || null;
  }
}

/**
 * Insert or update a single book in the database.
 * Returns 'inserted', 'updated', or 'skipped'.
 */
async function upsertBook(book: NormalizedBook): Promise<'inserted' | 'updated' | 'skipped'> {
  const existingId = await findExistingBook(book);
  const score = computeInitialScore(book.googleRating, book.ratingsCount);
  const authorId = await findOrCreateAuthor(book.author);

  if (existingId) {
    // Update existing book with fresher data
    await dbRun(`
      UPDATE books SET
        google_rating = COALESCE(?, google_rating),
        ratings_count = CASE WHEN ? > ratings_count THEN ? ELSE ratings_count END,
        computed_score = CASE WHEN ? > computed_score THEN ? ELSE computed_score END,
        cover_image = COALESCE(?, cover_image),
        description = COALESCE(?, description),
        price = COALESCE(?, price),
        amazon_url = COALESCE(?, amazon_url),
        author_id = COALESCE(?, author_id),
        updated_at = NOW()
      WHERE id = ?
    `, [
      book.googleRating,
      book.ratingsCount, book.ratingsCount,
      score, score,
      book.coverImage,
      book.description,
      book.price,
      book.amazonUrl,
      authorId,
      existingId,
    ]);

    // Link any new categories
    await linkCategories(existingId, book.categories);
    return 'updated';
  }

  // Insert new book
  const id = uuidv4();
  const slug = await generateUniqueSlug(book.title, book.author);

  // Auto-generate SEO metadata from Google Books data
  const metaTitle = `${book.title} by ${book.author} | The Book Times`.slice(0, 70);
  const descText = (book.description || '').replace(/<[^>]*>/g, '').trim();
  const metaDescription = descText
    ? descText.slice(0, 160)
    : `Discover ${book.title} by ${book.author}. Read reviews, ratings, and find the best deals.`.slice(0, 160);

  // Generate additional SEO fields (aligned with add-book route)
  const ogImage = book.coverImage; // Use validated cover as OG image
  const canonicalUrl = `/books/${slug}`;
  const focusKeyword = `${book.title} ${book.author}`.slice(0, 200);

  await dbRun(`
    INSERT INTO books (
      id, google_books_id, isbn10, isbn13, slug, title, subtitle, author, author_id,
      description, cover_image, publisher, published_date, page_count,
      language, google_rating, ratings_count, computed_score,
      price, currency, amazon_url, meta_title, meta_description,
      og_image, canonical_url, focus_keyword, seo_robots,
      goodreads_url, status, is_active
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, 'index, follow',
      ?, 'PUBLISHED', 1
    )
  `, [
    id,
    book.googleBooksId,
    book.isbn10,
    book.isbn13,
    slug,
    book.title,
    book.subtitle,
    book.author,
    authorId,
    book.description,
    book.coverImage,
    book.publisher,
    book.publishedDate,
    book.pageCount,
    book.language,
    book.googleRating,
    book.ratingsCount,
    score,
    book.price,
    book.currency,
    book.amazonUrl,
    metaTitle,
    metaDescription,
    ogImage,
    canonicalUrl,
    focusKeyword,
    book.isbn10 ? `https://www.goodreads.com/search?q=${book.isbn10}` : null,
  ]);

  await linkCategories(id, book.categories);
  return 'inserted';
}

/**
 * Link a book to its categories (creating junctions).
 */
async function linkCategories(bookId: string, categoryNames: string[]) {
  for (const name of categoryNames) {
    const cat = await dbGet<any>('SELECT id FROM categories WHERE name = ?', [name]);
    if (cat) {
      await dbRun('INSERT IGNORE INTO book_categories (book_id, category_id) VALUES (?, ?)', [bookId, cat.id]);
    }
  }
}

/**
 * Process a batch of normalized books into the database.
 */
async function processBatch(books: NormalizedBook[]): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const book of books) {
    try {
      const result = await upsertBook(book);
      if (result === 'inserted') inserted++;
      else if (result === 'updated') updated++;
      else skipped++;
    } catch (err: any) {
      errors.push(`${book.title}: ${err.message}`);
      skipped++;
    }
  }

  // Update category book counts
  await dbRun(`
    UPDATE categories SET book_count = (
      SELECT COUNT(*) FROM book_categories bc
      JOIN books b ON b.id = bc.book_id
      WHERE bc.category_id = categories.id AND b.status = 'PUBLISHED' AND b.is_active = 1
    )
  `);

  return { inserted, updated, skipped, errors };
}

// ── Job Execution ───────────────────────────────────────────────────────

/** Flag to prevent concurrent runs */
let isRunning = false;

/**
 * Run the import job.
 * If the DB has no Google Books data yet, does a full initial import.
 * Otherwise, does a daily incremental import.
 */
export async function runImportJob(
  forceType?: 'initial' | 'daily',
  onProgress?: (message: string) => void,
): Promise<ImportJobResult> {
  if (isRunning) {
    throw new Error('Import job is already running');
  }

  // Pre-flight check: warn if no Google Books API key is configured
  if (!config.googleBooksApiKey) {
    const msg = 'WARNING: No GOOGLE_BOOKS_API_KEY configured. Google Books API may reject requests or heavily rate-limit them. Set GOOGLE_BOOKS_API_KEY in your environment for reliable imports.';
    logger.warn(`[BookImport] ${msg}`);
    onProgress?.(msg);
  }

  isRunning = true;
  const startedAt = new Date().toISOString();
  const type = forceType || (await isFirstImport() ? 'initial' : 'daily');
  const jobId = uuidv4();

  const log = (msg: string) => {
    logger.info(`[BookImport] ${msg}`);
    onProgress?.(msg);
  };

  // Log job start
  await dbRun(
    `INSERT INTO import_jobs (id, type, status, started_at) VALUES (?, ?, 'running', NOW())`,
    [jobId, type]
  );

  log(`Starting ${type} import job (id: ${jobId})...`);

  try {
    // Fetch books from Google API
    let fetchedBooks: NormalizedBook[];

    if (type === 'initial') {
      log('Running initial import – fetching top books across all categories...');
      fetchedBooks = await fetchTopBooks(
        config.importJob.booksPerCategory,
        log,
      );
    } else {
      log('Running daily import – fetching new and trending books...');
      fetchedBooks = await fetchDailyNewBooks(
        config.importJob.dailyBooksPerQuery,
        log,
      );
    }

    log(`Fetched ${fetchedBooks.length} books with valid images. Processing...`);

    // Process into database
    const { inserted, updated, skipped, errors } = await processBatch(fetchedBooks);

    const completedAt = new Date().toISOString();
    const result: ImportJobResult = {
      startedAt,
      completedAt,
      type,
      totalFetched: fetchedBooks.length,
      newBooksInserted: inserted,
      existingBooksUpdated: updated,
      skippedDuplicates: skipped,
      skippedNoImage: 0, // Already filtered during fetch
      errors,
    };

    // Log job completion
    await dbRun(`
      UPDATE import_jobs SET
        status = ?, total_fetched = ?, new_inserted = ?, updated = ?,
        skipped = ?, errors = ?, completed_at = NOW()
      WHERE id = ?
    `, [
      'completed',
      fetchedBooks.length,
      inserted,
      updated,
      skipped,
      errors.length > 0 ? JSON.stringify(errors) : null,
      jobId,
    ]);

    log(`Import complete! Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`);
    if (errors.length > 0) {
      log(`Errors: ${errors.length}`);
    }

    // Recalculate all composite scores after import (includes local reviews, engagement, recency)
    if (inserted > 0 || updated > 0) {
      try {
        invalidatePriorCache(); // Reset cached priors since data changed
        const scoreResult = await recalculateAllScores();
        log(`Score recalculation: ${scoreResult.updated} books updated in ${scoreResult.duration}ms`);
      } catch (e: any) {
        log(`Score recalculation warning: ${e.message}`);
      }
    }

    return result;
  } catch (err: any) {
    log(`Import job FAILED: ${err.message}`);

    await dbRun(`
      UPDATE import_jobs SET
        status = ?, total_fetched = ?, new_inserted = ?, updated = ?,
        skipped = ?, errors = ?, completed_at = NOW()
      WHERE id = ?
    `, [
      'failed', 0, 0, 0, 0, JSON.stringify([err.message]), jobId,
    ]);

    throw err;
  } finally {
    isRunning = false;
  }
}

/**
 * Get the status/history of import jobs.
 */
export async function getImportJobHistory(limit: number = 20): Promise<ImportJobLog[]> {
  return await dbAll<ImportJobLog>('SELECT * FROM import_jobs ORDER BY started_at DESC LIMIT ?', [limit]);
}

/**
 * Check if an import is currently in progress.
 */
export function isImportRunning(): boolean {
  return isRunning;
}

/**
 * Force-reset the running flag (for stuck import recovery).
 * Also marks any DB records stuck in 'running' status as 'failed'.
 */
export async function resetImportState(): Promise<void> {
  isRunning = false;
  await dbRun(
    `UPDATE import_jobs SET status = 'failed', errors = '["Force-reset by admin"]', completed_at = NOW() WHERE status = 'running'`,
    []
  );
  logger.info('[BookImport] Import state force-reset (running flag cleared, stuck DB jobs marked failed)');
}

// ── Cron Scheduler ──────────────────────────────────────────────────────

let cronTask: ReturnType<typeof cron.schedule> | null = null;

/**
 * Start the daily import cron job.
 * Default schedule: every day at 3:00 AM server time.
 */
export async function startImportCron(schedule?: string) {
  const cronSchedule = schedule || config.importJob.cronSchedule;

  if (!cron.validate(cronSchedule)) {
    logger.error(`[BookImport] Invalid cron schedule: "${cronSchedule}". Job not started.`);
    return;
  }

  // Initialize the import_jobs table
  await initImportJobsTable();

  // Clean up any jobs stuck in 'running' from a previous process crash
  await dbRun(
    `UPDATE import_jobs SET status = 'failed', errors = '["Server restarted while job was running"]', completed_at = NOW() WHERE status = 'running'`,
    []
  );

  cronTask = cron.schedule(cronSchedule, async () => {
    logger.info(`[BookImport] Cron triggered at ${new Date().toISOString()}`);
    try {
      await runImportJob();
    } catch (err: any) {
      logger.error(`[BookImport] Cron job failed:`, err.message);
    }
  }, {
    timezone: config.importJob.timezone,
  } as any);

  logger.info(`📅 Book import cron scheduled: "${cronSchedule}" (${config.importJob.timezone})`);

  // If enabled, run initial import on startup if DB is empty
  if (config.importJob.runOnStartup) {
    const countResult = await dbGet<any>('SELECT COUNT(*) as count FROM books', []);
    const bookCount = countResult?.count || 0;
    if (bookCount === 0 || await isFirstImport()) {
      logger.info('[BookImport] Empty or seed-only DB detected – scheduling initial import in 10s...');
      setTimeout(async () => {
        try {
          await runImportJob('initial');
        } catch (err: any) {
          logger.error({ err: err.message }, '[BookImport] Initial import failed');
        }
      }, 10_000);
    }
  }
}

/**
 * Stop the cron job.
 */
export function stopImportCron() {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    logger.info('[BookImport] Cron job stopped');
  }
}
