/**
 * Famous Reviews Routes
 *
 * Public endpoint to get famous critic reviews for a book.
 * Admin endpoints to trigger AI fetching of reviews.
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireAdmin, optionalAuth } from '../middleware.js';
import {
  getFamousReviews,
  fetchFamousReviews,
  fetchReviewsForTopBooks,
  submitBatchFamousReviews,
  getBatchReviewStatus,
  processBatchReviewResults,
} from '../services/famousReviews.js';
import { listBatches } from '../services/openAIBatch.js';
import { dbGet } from '../database.js';

const router = Router();

// ── GET /api/books/:id/famous-reviews ───────────────────────────────────────
// Public: get cached famous reviews for a book
router.get('/books/:id/famous-reviews', optionalAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    // Verify book exists
    const book = await dbGet<{ id: string }>('SELECT id FROM books WHERE id = ?', [id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const reviews = await getFamousReviews(id);
    res.json({ reviews });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/books/:id/famous-reviews/fetch ────────────────────────────────
// Admin: trigger AI fetch of famous reviews for a specific book
router.post('/books/:id/famous-reviews/fetch', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const force = req.query.force === 'true';

    const book = await dbGet<{ id: string; title: string }>('SELECT id, title FROM books WHERE id = ?', [id]);
    if (!book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    const result = await fetchFamousReviews(id, { force });
    const reviews = await getFamousReviews(id);

    res.json({
      ...result,
      reviews,
      message: result.skipped
        ? `Reviews already exist for "${book.title}". Use ?force=true to re-fetch.`
        : `Fetched ${result.fetched} famous reviews for "${book.title}"`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/import/fetch-famous-reviews ───────────────────────────────────
// Admin: batch-fetch famous reviews for top books that don't have any
router.post('/import/fetch-famous-reviews', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);

    // Start async processing (respond immediately)
    res.json({
      started: true,
      limit,
      message: `Fetching famous reviews for up to ${limit} top-rated books without reviews`,
    });

    // Process in background
    fetchReviewsForTopBooks(limit, (msg) => {
      // Progress logging only — no SSE for simplicity
      console.log(`[FamousReviews] ${msg}`);
    }).catch((err) => {
      console.error('[FamousReviews] Batch fetch failed:', err.message);
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/import/batch-famous-reviews ───────────────────────────────────
// Admin: submit batch famous reviews via OpenAI Batch API (50% cheaper)
router.post('/import/batch-famous-reviews', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10), 200);
    const force = req.query.force === 'true';

    // Get top books without reviews
    const { dbAll } = await import('../database.js');
    const books = await dbAll<{ id: string }>(
      `SELECT b.id FROM books b
       LEFT JOIN famous_reviews fr ON fr.book_id = b.id
       WHERE b.is_active = 1 AND b.status = 'PUBLISHED'
         AND fr.id IS NULL
       ORDER BY b.computed_score DESC, b.ratings_count DESC
       LIMIT ?`,
      [limit],
    );

    if (books.length === 0) {
      return res.json({ message: 'No books found without famous reviews' });
    }

    const result = await submitBatchFamousReviews(books.map(b => b.id), { force });

    res.json({
      ...result,
      message: `Batch submitted: ${result.submitted} books queued for famous review generation (50% cost savings). Use GET /api/admin/batch/:batchId to check status.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/batch/:batchId ───────────────────────────────────────────
// Admin: check status of a batch job
router.get('/admin/batch/:batchId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await getBatchReviewStatus(req.params.batchId as string);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/admin/batch/:batchId/process ──────────────────────────────────
// Admin: process completed batch results and store in DB
router.post('/admin/batch/:batchId/process', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await processBatchReviewResults(req.params.batchId as string);
    res.json({
      ...result,
      message: `Processed ${result.processed} results: ${result.stored} reviews stored, ${result.failed} failed`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/admin/batches ──────────────────────────────────────────────────
// Admin: list recent batch jobs
router.get('/admin/batches', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const batches = await listBatches(20);
    res.json({ batches });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
