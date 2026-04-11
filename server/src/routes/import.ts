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
import {
  runImportJob,
  getImportJobHistory,
  isImportRunning,
  initImportJobsTable,
  resetImportState,
} from '../jobs/bookImport.js';
import { resolveHDCover } from '../services/coverResolver.js';
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

  // Return immediately, run in background
  res.json({
    message: `Cover upgrade started (limit: ${limit}, forceAll: ${forceAll})`,
    running: true,
  });

  coverUpgradeRunning = true;

  try {
    // Fetch books that need cover upgrades
    // By default, only upgrade books still using Google Books thumbnail URLs
    const whereClause = forceAll
      ? '1=1'
      : "cover_image LIKE '%books.google%' AND cover_image LIKE '%zoom=1%'";

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

export default router;
