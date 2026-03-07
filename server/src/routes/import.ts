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

export default router;
