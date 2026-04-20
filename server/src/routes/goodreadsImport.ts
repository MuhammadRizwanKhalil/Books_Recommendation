/**
 * Goodreads CSV Import Routes
 * ─────────────────────────────
 * Allows users to import reading history from Goodreads CSV export.
 * Parses CSV, matches books by ISBN / title+author, imports progress + ratings.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, rateLimit } from '../middleware.js';
import { refreshReadingCounts } from './readingCounts.js';
import { refreshChallengeCount } from './readingChallenge.js';
import { refreshStreak } from './userStats.js';

const router = Router();

// ── Multer setup for CSV upload ─────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// ── CSV Parser (RFC 4180) ───────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentField += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        currentField += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        currentRow.push(currentField.trim());
        currentField = '';
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        if (currentRow.length > 1 || currentRow[0] !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        i++;
      } else {
        currentField += ch;
        i++;
      }
    }
  }

  // Final field
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.replace(/^\uFEFF/, '')); // Strip BOM
  const records: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = rows[r][c] || '';
    }
    records.push(record);
  }

  return records;
}

// ── Goodreads Column Validation ─────────────────────────────────────────────

const REQUIRED_COLUMNS = ['Title', 'Author'];
const KNOWN_COLUMNS = [
  'Book Id', 'Title', 'Author', 'Author l-f', 'Additional Authors',
  'ISBN', 'ISBN13', 'My Rating', 'Average Rating', 'Publisher', 'Binding',
  'Number of Pages', 'Year Published', 'Original Publication Year',
  'Date Read', 'Date Added', 'Bookshelves', 'Bookshelves with positions',
  'Exclusive Shelf', 'My Review', 'Spoiler', 'Private Notes',
  'Read Count', 'Owned Copies',
];

function validateGoodreadsCSV(records: Record<string, string>[]): string | null {
  if (records.length === 0) return 'CSV file is empty or contains only headers';
  const headers = Object.keys(records[0]);
  const missing = REQUIRED_COLUMNS.filter(c => !headers.includes(c));
  if (missing.length > 0) return `Missing required columns: ${missing.join(', ')}`;
  return null;
}

// ── Shelf Mapping ───────────────────────────────────────────────────────────

function mapShelf(exclusiveShelf: string): string {
  switch (exclusiveShelf.toLowerCase().trim()) {
    case 'read': return 'finished';
    case 'currently-reading': return 'reading';
    case 'to-read': return 'want-to-read';
    default: return 'want-to-read';
  }
}

// ── ISBN Normalization ──────────────────────────────────────────────────────

function cleanISBN(raw: string): string {
  return raw.replace(/[=""\s]/g, '').trim();
}

// ── Book Matching ───────────────────────────────────────────────────────────

async function matchBook(row: Record<string, string>): Promise<string | null> {
  const isbn13 = cleanISBN(row['ISBN13'] || '');
  const isbn = cleanISBN(row['ISBN'] || '');
  const title = (row['Title'] || '').trim();
  const author = (row['Author'] || '').trim();

  // 1. Match by ISBN13
  if (isbn13 && isbn13.length >= 10) {
    const book = await dbGet<any>('SELECT id FROM books WHERE isbn13 = ? LIMIT 1', [isbn13]);
    if (book) return book.id;
  }

  // 2. Match by ISBN
  if (isbn && isbn.length >= 10) {
    const book = await dbGet<any>('SELECT id FROM books WHERE isbn = ? LIMIT 1', [isbn]);
    if (book) return book.id;
  }

  // 3. Fuzzy match by title + author
  if (title && author) {
    // Exact match first
    const exact = await dbGet<any>(
      'SELECT id FROM books WHERE LOWER(title) = LOWER(?) AND LOWER(author) = LOWER(?) LIMIT 1',
      [title, author]
    );
    if (exact) return exact.id;

    // Partial match: title LIKE + author LIKE
    const partial = await dbGet<any>(
      'SELECT id FROM books WHERE LOWER(title) LIKE LOWER(?) AND LOWER(author) LIKE LOWER(?) LIMIT 1',
      [`%${title.substring(0, 50)}%`, `%${author.split(',')[0].trim()}%`]
    );
    if (partial) return partial.id;
  }

  // 4. Title-only fallback
  if (title && title.length > 5) {
    const titleOnly = await dbGet<any>(
      'SELECT id FROM books WHERE LOWER(title) = LOWER(?) LIMIT 1',
      [title]
    );
    if (titleOnly) return titleOnly.id;
  }

  return null;
}

// ── Process Import Job (async background) ───────────────────────────────────

async function processImportJob(jobId: string, userId: string, records: Record<string, string>[]) {
  try {
    await dbRun(
      "UPDATE import_jobs SET status = 'processing', started_at = NOW() WHERE id = ?",
      [jobId]
    );

    let matched = 0;
    let skipped = 0;
    const affectedBookIds = new Set<string>();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const itemId = uuidv4();
      const title = (row['Title'] || '').substring(0, 500);
      const author = (row['Author'] || '').substring(0, 500);
      const isbn = cleanISBN(row['ISBN'] || '').substring(0, 13);
      const isbn13 = cleanISBN(row['ISBN13'] || '').substring(0, 13);
      const ratingStr = row['My Rating'] || '0';
      const rating = Math.min(5, Math.max(0, parseFloat(ratingStr) || 0));
      const shelf = mapShelf(row['Exclusive Shelf'] || 'to-read');
      const dateRead = row['Date Read'] || null;
      const reviewText = (row['My Review'] || '').substring(0, 10000) || null;
      const goodreadsBookId = (row['Book Id'] || '').substring(0, 50);

      try {
        const bookId = await matchBook(row);

        if (!bookId) {
          await dbRun(
            `INSERT INTO import_job_items (id, import_job_id, \`row_number\`, goodreads_book_id, isbn, isbn13, title, author, status, rating, shelf, date_read, review_text, error_reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'skipped', ?, ?, ?, ?, 'Book not found in database')`,
            [itemId, jobId, i + 1, goodreadsBookId, isbn, isbn13, title, author, rating || null, shelf, dateRead, reviewText]
          );
          skipped++;
        } else {
          // Check existing progress
          const existing = await dbGet<any>(
            'SELECT id, status FROM reading_progress WHERE user_id = ? AND book_id = ?',
            [userId, bookId]
          );

          // Get book page count
          const book = await dbGet<any>('SELECT page_count FROM books WHERE id = ?', [bookId]);
          const pageCount = book?.page_count || parseInt(row['Number of Pages'] || '0', 10) || 0;

          // Parse date
          let parsedDate: string | null = null;
          if (dateRead) {
            const d = new Date(dateRead);
            if (!isNaN(d.getTime())) {
              parsedDate = d.toISOString().substring(0, 10);
            }
          }

          if (existing) {
            // Only update if import has more info (don't downgrade)
            // Skip if already tracked — but update rating if higher
            if (rating > 0) {
              await dbRun(
                'UPDATE reading_progress SET personal_rating = GREATEST(COALESCE(personal_rating, 0), ?) WHERE id = ?',
                [rating, existing.id]
              );
            }
          } else {
            // Create new reading progress
            const progressId = uuidv4();
            const startedAt = shelf === 'reading' || shelf === 'finished' ? (parsedDate || new Date().toISOString().substring(0, 10)) : null;
            const finishedAt = shelf === 'finished' ? (parsedDate || new Date().toISOString().substring(0, 10)) : null;

            await dbRun(
              `INSERT INTO reading_progress (id, user_id, book_id, status, current_page, total_pages, started_at, finished_at, personal_rating)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [progressId, userId, bookId, shelf, shelf === 'finished' ? pageCount : 0, pageCount, startedAt, finishedAt, rating > 0 ? rating : null]
            );
          }

          // Import review if present and rating > 0
          if (rating > 0) {
            const existingReview = await dbGet<any>(
              'SELECT id FROM reviews WHERE user_id = ? AND book_id = ?',
              [userId, bookId]
            );
            if (!existingReview) {
              const reviewId = uuidv4();
              await dbRun(
                `INSERT INTO reviews (id, user_id, book_id, rating, content, created_at)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [reviewId, userId, bookId, rating, reviewText || null]
              );
            }
          }

          affectedBookIds.add(bookId);

          await dbRun(
            `INSERT INTO import_job_items (id, import_job_id, \`row_number\`, goodreads_book_id, isbn, isbn13, title, author, status, matched_book_id, rating, shelf, date_read, review_text)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'matched', ?, ?, ?, ?, ?)`,
            [itemId, jobId, i + 1, goodreadsBookId, isbn, isbn13, title, author, bookId, rating || null, shelf, dateRead, reviewText]
          );
          matched++;
        }
      } catch (rowErr: any) {
        await dbRun(
          `INSERT INTO import_job_items (id, import_job_id, \`row_number\`, title, author, status, error_reason)
           VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
          [itemId, jobId, i + 1, title, author, (rowErr.message || 'Unknown error').substring(0, 255)]
        );
        skipped++;
      }

      // Update progress every 10 rows
      if ((i + 1) % 10 === 0 || i === records.length - 1) {
        await dbRun(
          'UPDATE import_jobs SET processed_rows = ?, matched_books = ?, skipped_rows = ? WHERE id = ?',
          [i + 1, matched, skipped, jobId]
        );
      }
    }

    await dbRun(
      "UPDATE import_jobs SET status = 'completed', processed_rows = ?, matched_books = ?, skipped_rows = ?, completed_at = NOW() WHERE id = ?",
      [records.length, matched, skipped, jobId]
    );

    // Refresh counts for affected books (non-blocking)
    for (const bookId of affectedBookIds) {
      setImmediate(() => refreshReadingCounts(bookId));
    }
    setImmediate(() => refreshChallengeCount(userId));
    setImmediate(() => refreshStreak(userId));

    logger.info({ jobId, total: records.length, matched, skipped }, 'Goodreads import completed');
  } catch (err: any) {
    logger.error({ err, jobId }, 'Goodreads import failed');
    await dbRun(
      "UPDATE import_jobs SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?",
      [(err.message || 'Unknown error').substring(0, 500), jobId]
    ).catch(() => {});
  }
}

// ── POST /api/import/goodreads — Upload and import CSV ──────────────────────
router.post(
  '/goodreads',
  authenticate,
  rateLimit('goodreads-import', 3, 60 * 60 * 1000), // 3 per hour
  (req: Request, res: Response, next) => {
    upload.single('file')(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB)' : err.message });
        } else {
          res.status(400).json({ error: err.message || 'File upload error' });
        }
        return;
      }
      next();
    });
  },
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No CSV file uploaded' });
        return;
      }

      // Parse CSV
      const csvText = req.file.buffer.toString('utf-8');
      const records = parseCSV(csvText);

      // Validate
      const err = validateGoodreadsCSV(records);
      if (err) {
        res.status(400).json({ error: err });
        return;
      }

      // Create import job
      const jobId = uuidv4();
      await dbRun(
        `INSERT INTO import_jobs (id, user_id, source, status, total_rows, file_name)
         VALUES (?, ?, 'goodreads', 'pending', ?, ?)`,
        [jobId, req.user!.userId, records.length, req.file.originalname.substring(0, 255)]
      );

      // Return immediately, process in background
      res.status(202).json({
        jobId,
        status: 'processing',
        totalRows: records.length,
        preview: records.slice(0, 5).map(r => ({
          title: r['Title'] || '',
          author: r['Author'] || '',
          rating: r['My Rating'] || '0',
          shelf: r['Exclusive Shelf'] || '',
          dateRead: r['Date Read'] || '',
        })),
      });

      // Process in background
      setImmediate(() => processImportJob(jobId, req.user!.userId, records));
    } catch (err: any) {
      logger.error({ err }, 'Goodreads import upload error');
      res.status(500).json({ error: 'Failed to start import' });
    }
  }
);

// ── GET /api/import/goodreads/:jobId — Get job progress ─────────────────────
router.get('/goodreads/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const job = await dbGet<any>(
      'SELECT * FROM import_jobs WHERE id = ? AND source = ?',
      [req.params.jobId, 'goodreads']
    );

    if (!job) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }

    if (job.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get item breakdown
    const items = await dbAll<any>(
      'SELECT `row_number`, title, author, status, matched_book_id, error_reason FROM import_job_items WHERE import_job_id = ? ORDER BY `row_number`',
      [job.id]
    );

    res.json({
      id: job.id,
      status: job.status,
      source: job.source,
      totalRows: job.total_rows,
      processedRows: job.processed_rows,
      matchedBooks: job.matched_books,
      newBooks: job.new_books,
      skippedRows: job.skipped_rows,
      errorMessage: job.error_message,
      fileName: job.file_name,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      createdAt: job.created_at,
      items: items.map((it: any) => ({
        rowNumber: it.row_number,
        title: it.title,
        author: it.author,
        status: it.status,
        matchedBookId: it.matched_book_id,
        errorReason: it.error_reason,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get import job error');
    res.status(500).json({ error: 'Failed to fetch import job' });
  }
});

// ── GET /api/import/goodreads/history — Get past import jobs ────────────────
router.get('/goodreads', authenticate, async (req: Request, res: Response) => {
  try {
    const jobs = await dbAll<any>(
      `SELECT id, source, status, total_rows, processed_rows, matched_books, skipped_rows,
              file_name, started_at, completed_at, created_at
       FROM import_jobs
       WHERE user_id = ? AND source = 'goodreads'
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user!.userId]
    );

    res.json({
      jobs: jobs.map((j: any) => ({
        id: j.id,
        status: j.status,
        totalRows: j.total_rows,
        processedRows: j.processed_rows,
        matchedBooks: j.matched_books,
        skippedRows: j.skipped_rows,
        fileName: j.file_name,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        createdAt: j.created_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get import history error');
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

export default router;
