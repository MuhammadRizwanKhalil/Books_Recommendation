/**
 * Import Job Admin Routes
 *
 * Provides admin endpoints to:
 *  - Trigger an import manually (initial or daily)
 *  - View import job history/status
 *  - Check if an import is currently running
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { runImportJob, getImportJobHistory, isImportRunning, initImportJobsTable, resetImportState } from '../jobs/bookImport.js';
import { resolveHDCover, resolveAuthorImage } from '../services/coverResolver.js';
import { isValidIsbn10, buildAmazonSearchUrl } from '../services/googleBooks.js';
import { dbAll, dbRun } from '../database.js';

const router = Router();

// Ensure table exists (deferred until first request so DB pool is ready)
let tableInitialized = false;
router.use(async (_req, _res, next) => {
  if (!tableInitialized) {
    try { await initImportJobsTable(); tableInitialized = true; } catch (e) {
      logger.warn({ err: e }, 'initImportJobsTable deferred — will retry');
    }
  }
  next();
});

// All routes require admin auth
router.use(authenticate, requireAdmin);

// ── GET /api/import/status ──────────────────────────────────────────────────
// Check if an import is currently running
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    running: isImportRunning(),
  });
});

// ── GET /api/import/history ─────────────────────────────────────────────────
// Get recent import job history
router.get('/history', async (req: Request, res: Response) => {
  try {
  const limit = parseInt(req.query.limit as string || '20', 10);
  const jobs = await getImportJobHistory(Math.min(limit, 100));
  res.json({
    jobs: jobs.map((j: any) => ({
      id: j.id,
      type: j.type,
      status: j.status,
      totalFetched: j.total_fetched,
      newInserted: j.new_inserted,
      updated: j.updated,
      skipped: j.skipped,
      errors: j.errors ? JSON.parse(j.errors) : [],
      startedAt: j.started_at,
      completedAt: j.completed_at,
    })),
  });
  } catch (err: any) {
    logger.error({ err: err }, 'Import history error');
    res.status(500).json({ error: 'Failed to fetch import history' });
  }
});

// ── POST /api/import/run ────────────────────────────────────────────────────
// Trigger an import manually
router.post('/run', async (req: Request, res: Response) => {
  try {
    if (isImportRunning()) {
      res.status(409).json({ error: 'An import job is already running' });
      return;
    }

    const type = req.body.type as 'initial' | 'daily' | undefined;
    if (type && type !== 'initial' && type !== 'daily') {
      res.status(400).json({ error: 'Invalid type. Must be "initial" or "daily"' });
      return;
    }

    // Run asynchronously — return immediately with job started confirmation
    res.json({
      message: `Import job started (type: ${type || 'auto'})`,
      running: true,
    });

    // Execute in background
    runImportJob(type).then((result) => {
      logger.info({ type: result.type, inserted: result.newBooksInserted, updated: result.existingBooksUpdated }, '[ImportAPI] Job completed');
    }).catch((err) => {
      logger.error({ err }, '[ImportAPI] Job failed');
    });
  } catch (err: any) {
    logger.error({ err: err.message }, '[ImportAPI] Error');
    res.status(500).json({ error: 'Import operation failed' });
  }
});

// ── POST /api/import/cancel ─────────────────────────────────────────────────
// Force-reset a stuck import (clears running flag, marks DB records as failed)
router.post('/cancel', async (_req: Request, res: Response) => {
  try {
    await resetImportState();
    res.json({ message: 'Import state reset successfully', running: false });
  } catch (err: any) {
    logger.error({ err: err.message }, '[ImportAPI] Cancel error');
    res.status(500).json({ error: 'Failed to reset import state' });
  }
});

// ── POST /api/import/upgrade-covers ─────────────────────────────────────────
// Upgrade existing book covers to HD from Open Library / Google Books zoom=0.
// Processes books that still have low-res Google Books thumbnails.
let coverUpgradeRunning = false;

router.get('/upgrade-covers/status', (_req: Request, res: Response) => {
  res.json({ running: coverUpgradeRunning });
});

router.post('/upgrade-covers', async (req: Request, res: Response) => {
  if (coverUpgradeRunning) {
    res.status(409).json({ error: 'Cover upgrade is already running' });
    return;
  }

  const limit = Math.min(parseInt(req.body.limit as string || '500', 10), 5000);
  const forceAll = req.body.forceAll === true;

  // Count eligible books first
  const eligibleWhere = forceAll
    ? '1=1'
    : "(cover_image LIKE '%books.google%' AND cover_image LIKE '%zoom=1%') OR (cover_image LIKE '%zoom=5%') OR (cover_image LIKE '%smallThumbnail%')";

  const countResult = await dbAll<any>(`SELECT COUNT(*) as cnt FROM books WHERE ${eligibleWhere}`, []);
  const booksToProcess = Math.min(countResult[0]?.cnt || 0, limit);

  // Return immediately, run in background
  res.json({
    message: `Cover upgrade started (limit: ${limit}, forceAll: ${forceAll})`,
    started: true,
    booksToProcess,
  });

  coverUpgradeRunning = true;

  try {
    // Fetch books that need cover upgrades
    // Target: low-res Google thumbnails, small thumbnails, and zoom=5 (tiny)
    const whereClause = forceAll
      ? '1=1'
      : "(cover_image LIKE '%books.google%' AND cover_image LIKE '%zoom=1%') OR (cover_image LIKE '%zoom=5%') OR (cover_image LIKE '%smallThumbnail%')";

    const books = await dbAll<any>(
      `SELECT id, isbn10, isbn13, google_books_id, cover_image
       FROM books
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit],
    );

    logger.info(`[CoverUpgrade] Starting upgrade for ${books.length} books (limit: ${limit}, forceAll: ${forceAll})`);

    let upgraded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < books.length; i++) {
      const book = books[i];
      try {
        const result = await resolveHDCover({
          isbn13: book.isbn13,
          isbn10: book.isbn10,
          googleBooksId: book.google_books_id,
          currentCoverUrl: book.cover_image,
        });

        if (result && result.url !== book.cover_image) {
          await dbRun(
            `UPDATE books SET cover_image = ?, og_image = ?, updated_at = NOW() WHERE id = ?`,
            [result.url, result.url, book.id],
          );
          upgraded++;

          if (upgraded % 50 === 0) {
            logger.info(`[CoverUpgrade] Progress: ${upgraded} upgraded, ${skipped} skipped, ${failed} failed (${i + 1}/${books.length})`);
          }
        } else {
          skipped++;
        }
      } catch (err: any) {
        failed++;
        logger.warn(`[CoverUpgrade] Failed for book ${book.id}: ${err.message}`);
      }

      // Rate limit: 300ms between books to respect Open Library limits
      if (i < books.length - 1) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    logger.info(`[CoverUpgrade] Complete! Upgraded: ${upgraded}, Skipped: ${skipped}, Failed: ${failed}`);
  } catch (err: any) {
    logger.error({ err }, '[CoverUpgrade] Job failed');
  } finally {
    coverUpgradeRunning = false;
  }
});

// ── POST /api/import/upgrade-author-images ──────────────────────────────────
// Fetch missing author images from Open Library in bulk.
let authorImageUpgradeRunning = false;

router.get('/upgrade-author-images/status', (_req: Request, res: Response) => {
  res.json({ running: authorImageUpgradeRunning });
});

router.post('/upgrade-author-images', async (req: Request, res: Response) => {
  if (authorImageUpgradeRunning) {
    res.status(409).json({ error: 'Author image upgrade is already running' });
    return;
  }

  const limit = Math.min(parseInt(req.body.limit as string || '200', 10), 2000);

  // Count eligible authors
  const countResult = await dbAll<any>('SELECT COUNT(*) as cnt FROM authors WHERE image_url IS NULL OR image_url = ?', ['']);
  const authorsToProcess = Math.min(countResult[0]?.cnt || 0, limit);

  res.json({
    message: `Author image upgrade started (limit: ${limit})`,
    started: true,
    authorsToProcess,
  });

  authorImageUpgradeRunning = true;

  try {
    const authors = await dbAll<any>(
      `SELECT id, name FROM authors WHERE image_url IS NULL OR image_url = '' ORDER BY RAND() LIMIT ?`,
      [limit],
    );

    logger.info(`[AuthorImageUpgrade] Starting for ${authors.length} authors`);

    let upgraded = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < authors.length; i++) {
      const author = authors[i];
      try {
        const imageUrl = await resolveAuthorImage(author.name);
        if (imageUrl) {
          await dbRun('UPDATE authors SET image_url = ? WHERE id = ?', [imageUrl, author.id]);
          upgraded++;
        } else {
          skipped++;
        }
      } catch (err: any) {
        failed++;
        logger.warn(`[AuthorImageUpgrade] Failed for "${author.name}": ${err.message}`);
      }

      // Respect rate limits
      if (i < authors.length - 1) {
        await new Promise(r => setTimeout(r, 400));
      }

      if ((i + 1) % 50 === 0) {
        logger.info(`[AuthorImageUpgrade] Progress: ${upgraded} upgraded, ${skipped} skipped, ${failed} failed (${i + 1}/${authors.length})`);
      }
    }

    logger.info(`[AuthorImageUpgrade] Complete! Upgraded: ${upgraded}, Skipped: ${skipped}, Failed: ${failed}`);
  } catch (err: any) {
    logger.error({ err }, '[AuthorImageUpgrade] Job failed');
  } finally {
    authorImageUpgradeRunning = false;
  }
});

// ── POST /api/import/fix-amazon-urls ────────────────────────────────────────
// Verify and fix broken Amazon /dp/ URLs by replacing them with reliable search URLs.
let amazonFixRunning = false;

router.get('/fix-amazon-urls/status', (_req: Request, res: Response) => {
  res.json({ running: amazonFixRunning });
});

router.post('/fix-amazon-urls', async (req: Request, res: Response) => {
  if (amazonFixRunning) {
    res.status(409).json({ error: 'Amazon URL fix is already running' });
    return;
  }

  const mode: string = req.body.mode || 'invalid-isbn'; // 'invalid-isbn' | 'all-dp' | 'missing'

  let whereClause: string;
  let description: string;

  switch (mode) {
    case 'all-dp':
      // Replace ALL /dp/ links with search URLs (safest option)
      whereClause = `amazon_url LIKE '%/dp/%' AND is_active = 1`;
      description = 'all /dp/ links';
      break;
    case 'missing':
      // Generate Amazon URLs for books that have none
      whereClause = `(amazon_url IS NULL OR amazon_url = '') AND is_active = 1`;
      description = 'books with no Amazon URL';
      break;
    case 'invalid-isbn':
    default:
      // Only fix /dp/ links where the ISBN-10 fails check digit validation
      whereClause = `amazon_url LIKE '%/dp/%' AND is_active = 1`;
      description = '/dp/ links with invalid ISBN-10 check digits';
      break;
  }

  const books = await dbAll<any>(
    `SELECT id, title, author, isbn10, isbn13, amazon_url FROM books WHERE ${whereClause} ORDER BY indexed_at DESC`,
    [],
  );

  // For 'invalid-isbn' mode, filter down to only books with bad ISBN-10s
  let toFix: any[] = books;
  if (mode === 'invalid-isbn') {
    toFix = books.filter((b: any) => {
      const match = b.amazon_url?.match(/\/dp\/([A-Z0-9]{10})/i);
      if (!match) return false;
      return !isValidIsbn10(match[1]);
    });
  }

  res.json({
    message: `Amazon URL fix started (mode: ${mode})`,
    started: true,
    booksToProcess: toFix.length,
    description,
  });

  amazonFixRunning = true;

  try {
    let fixed = 0;
    let skipped = 0;

    for (const book of toFix) {
      try {
        if (mode === 'missing') {
          // Generate a new search URL
          const searchUrl = buildAmazonSearchUrl(book);
          await dbRun('UPDATE books SET amazon_url = ? WHERE id = ?', [searchUrl, book.id]);
          fixed++;
        } else {
          // Replace /dp/ with search URL
          const searchUrl = buildAmazonSearchUrl(book);
          await dbRun('UPDATE books SET amazon_url = ? WHERE id = ?', [searchUrl, book.id]);
          fixed++;
        }
      } catch (err: any) {
        skipped++;
        logger.warn(`[AmazonFix] Failed for "${book.title}": ${err.message}`);
      }
    }

    logger.info(`[AmazonFix] Complete (mode: ${mode})! Fixed: ${fixed}, Skipped: ${skipped}, Total: ${toFix.length}`);
  } catch (err: any) {
    logger.error({ err }, '[AmazonFix] Job failed');
  } finally {
    amazonFixRunning = false;
  }
});

export default router;
