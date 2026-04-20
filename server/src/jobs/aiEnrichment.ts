/**
 * Post-Import AI Enrichment Job
 *
 * After books are imported, this submits newly imported books (that lack
 * AI analysis) to the OpenAI Batch API for:
 *  1. Mood/theme/pace/difficulty analysis (via aiMoodAnalysis)
 *  2. Famous review quote generation (via famousReviews)
 *
 * Batch API is 50% cheaper than individual calls and results are processed
 * automatically by the batch processor cron (batchProcessor.ts).
 *
 * This is fire-and-forget: batches complete within 24h and results are
 * picked up by the batchProcessor cron every 30 minutes.
 */

import { logger } from '../lib/logger.js';
import { dbAll } from '../database.js';
import { config } from '../config.js';
import { submitBatchMoodAnalysis, type BatchMoodInput } from '../services/aiMoodAnalysis.js';
import { submitBatchFamousReviews } from '../services/famousReviews.js';

export interface AIEnrichmentResult {
  moodBatchId?: string;
  reviewsBatchId?: string;
  moodSubmitted: number;
  reviewsSubmitted: number;
}

/**
 * Submit newly imported books for AI enrichment via Batch API.
 * Called automatically after book import completes.
 *
 * @param log Optional progress logger (used when called from import job)
 */
export async function runPostImportEnrichment(
  log?: (msg: string) => void,
): Promise<AIEnrichmentResult> {
  const _log = (msg: string) => {
    logger.info(`[AIEnrich] ${msg}`);
    log?.(msg);
  };

  if (!config.openaiApiKey) {
    _log('Skipping AI enrichment — OPENAI_API_KEY not configured');
    return { moodSubmitted: 0, reviewsSubmitted: 0 };
  }

  if (!config.aiEnrichment.enabled) {
    _log('AI enrichment disabled (AI_ENRICHMENT_ENABLED=false) — skipping');
    return { moodSubmitted: 0, reviewsSubmitted: 0 };
  }

  const batchSize = config.aiEnrichment.batchSize;
  let moodBatchId: string | undefined;
  let reviewsBatchId: string | undefined;
  let moodSubmitted = 0;
  let reviewsSubmitted = 0;

  // ── 1. Mood Analysis ────────────────────────────────────────────────

  try {
    const booksNeedingMood = await dbAll<{
      id: string; title: string; author: string; description: string | null;
    }>(
      `SELECT b.id, b.title, b.author, b.description
       FROM books b
       LEFT JOIN ai_book_analysis a ON a.book_id = b.id AND a.analysis_type = 'mood'
       WHERE b.is_active = 1 AND b.status = 'PUBLISHED'
         AND a.id IS NULL
         AND b.description IS NOT NULL AND b.description != ''
       ORDER BY b.created_at DESC
       LIMIT ?`,
      [batchSize],
    );

    if (booksNeedingMood.length > 0) {
      const moodInputs: BatchMoodInput[] = booksNeedingMood.map(b => ({
        bookId: b.id,
        title: b.title,
        author: b.author,
        description: b.description,
      }));

      const result = await submitBatchMoodAnalysis(moodInputs);
      moodBatchId = result.batchId;
      moodSubmitted = result.submitted;
      _log(`📦 Mood batch submitted: ${result.submitted} books (batch: ${result.batchId}, ${result.heuristicFallbacks} heuristic fallbacks)`);
    } else {
      _log('All books already have mood analysis — nothing to submit');
    }
  } catch (err: any) {
    _log(`⚠️ Mood analysis batch failed: ${err.message}`);
  }

  // ── 2. Famous Reviews ───────────────────────────────────────────────

  try {
    const booksNeedingReviews = await dbAll<{ id: string }>(
      `SELECT b.id FROM books b
       LEFT JOIN famous_reviews fr ON fr.book_id = b.id
       WHERE b.is_active = 1 AND b.status = 'PUBLISHED'
         AND fr.id IS NULL
       ORDER BY b.computed_score DESC, b.ratings_count DESC
       LIMIT ?`,
      [batchSize],
    );

    if (booksNeedingReviews.length > 0) {
      const result = await submitBatchFamousReviews(booksNeedingReviews.map(b => b.id));
      reviewsBatchId = result.batchId;
      reviewsSubmitted = result.submitted;
      _log(`📦 Reviews batch submitted: ${result.submitted} books (batch: ${result.batchId}, ${result.skipped} skipped)`);
    } else {
      _log('All books already have famous reviews — nothing to submit');
    }
  } catch (err: any) {
    _log(`⚠️ Famous reviews batch failed: ${err.message}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────

  if (moodSubmitted > 0 || reviewsSubmitted > 0) {
    _log(`AI enrichment submitted: ${moodSubmitted} mood + ${reviewsSubmitted} reviews via Batch API (50% cost savings). Results will be processed automatically.`);
  } else {
    _log('No books needed AI enrichment — all up to date');
  }

  return { moodBatchId, reviewsBatchId, moodSubmitted, reviewsSubmitted };
}
