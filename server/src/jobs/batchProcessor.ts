/**
 * Batch Result Processor Cron
 *
 * Periodically checks for pending AI batch jobs (submitted via Batch API)
 * and automatically processes their results when complete.
 *
 * Runs every 30 minutes. Handles:
 *  - mood_analysis batches → persists mood/pace/themes/difficulty to ai_book_analysis
 *  - famous_reviews batches → persists review quotes to famous_reviews table
 *
 * This closes the loop: bookImport → aiEnrichment (submit) → batchProcessor (collect results)
 */

import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbAll, dbRun } from '../database.js';
import { config } from '../config.js';
import { getBatchStatus } from '../services/openAIBatch.js';
import { processBatchMoodResults, type AIMoodAnalysisResult, type PaceValue } from '../services/aiMoodAnalysis.js';
import { processBatchReviewResults } from '../services/famousReviews.js';

let cronTask: ScheduledTask | null = null;

/**
 * Persist mood analysis results to ai_book_analysis table.
 * Same logic as the admin route handler but extracted for reuse.
 */
async function persistMoodAnalysis(
  bookId: string,
  modelVersion: string,
  analysis: AIMoodAnalysisResult,
): Promise<void> {
  const entries: Array<{ type: string; result: any }> = [
    { type: 'mood', result: analysis.mood },
    { type: 'pace', result: analysis.pace },
    { type: 'content_warnings', result: analysis.content_warnings },
    { type: 'themes', result: analysis.themes },
    { type: 'difficulty', result: analysis.difficulty },
  ];

  for (const entry of entries) {
    await dbRun(
      `INSERT INTO ai_book_analysis (id, book_id, analysis_type, result, model_version)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         result = VALUES(result),
         model_version = VALUES(model_version),
         analyzed_at = CURRENT_TIMESTAMP`,
      [uuidv4(), bookId, entry.type, JSON.stringify(entry.result), modelVersion],
    );
  }
}

/**
 * Check all pending batch jobs and process completed ones.
 */
async function processPendingBatches(): Promise<void> {
  let pendingJobs: Array<{ id: string; batch_id: string; job_type: string }>;

  try {
    pendingJobs = await dbAll<{ id: string; batch_id: string; job_type: string }>(
      `SELECT id, batch_id, job_type FROM ai_batch_jobs WHERE status = 'submitted' ORDER BY created_at ASC`,
    );
  } catch {
    // Table might not exist yet
    return;
  }

  if (pendingJobs.length === 0) return;

  logger.info(`[BatchProcessor] Checking ${pendingJobs.length} pending batch job(s)...`);

  for (const job of pendingJobs) {
    try {
      const status = await getBatchStatus(job.batch_id);

      if (status.status === 'completed') {
        logger.info(`[BatchProcessor] Batch ${job.batch_id} (${job.job_type}) completed — processing results`);

        if (job.job_type === 'famous_reviews') {
          // processBatchReviewResults handles DB persistence + updates ai_batch_jobs
          const result = await processBatchReviewResults(job.batch_id);
          logger.info(`[BatchProcessor] ✅ Reviews batch done: ${result.stored} quotes stored, ${result.failed} failed`);

        } else if (job.job_type === 'mood_analysis') {
          const analysisMap = await processBatchMoodResults(job.batch_id);
          let stored = 0;
          let failed = 0;

          for (const [bookId, analysis] of analysisMap) {
            try {
              await persistMoodAnalysis(bookId, 'gpt-4o-mini-batch', analysis);
              stored++;
            } catch (err: any) {
              failed++;
              logger.warn(`[BatchProcessor] Failed to persist mood for book ${bookId}: ${err.message}`);
            }
          }

          // Update tracking record
          await dbRun(
            `UPDATE ai_batch_jobs SET status = 'completed', processed = ?, stored = ?, failed = ?, completed_at = NOW()
             WHERE batch_id = ?`,
            [analysisMap.size, stored, failed, job.batch_id],
          ).catch(() => {});

          logger.info(`[BatchProcessor] ✅ Mood batch done: ${stored} books analyzed, ${failed} failed`);
        }

      } else if (['failed', 'expired', 'cancelled'].includes(status.status)) {
        await dbRun(
          `UPDATE ai_batch_jobs SET status = ?, completed_at = NOW() WHERE batch_id = ?`,
          [status.status, job.batch_id],
        ).catch(() => {});
        logger.warn(`[BatchProcessor] ❌ Batch ${job.batch_id} (${job.job_type}) ${status.status}`);

      } else {
        // Still in progress — log update
        const pct = status.totalRequests > 0
          ? Math.round((status.completedRequests / status.totalRequests) * 100)
          : 0;
        logger.info(
          `[BatchProcessor] ⏳ Batch ${job.batch_id} (${job.job_type}): ${status.completedRequests}/${status.totalRequests} (${pct}%) — status: ${status.status}`,
        );
      }
    } catch (err: any) {
      logger.error(`[BatchProcessor] Error checking batch ${job.batch_id}: ${err.message}`);
    }
  }
}

/**
 * Start the batch result processor cron (every 30 minutes).
 */
export function startBatchProcessorCron(): void {
  if (!config.openaiApiKey) {
    logger.info('  🔄 Batch processor cron: disabled (no OPENAI_API_KEY)');
    return;
  }

  cronTask = cron.schedule('*/30 * * * *', async () => {
    try {
      await processPendingBatches();
    } catch (err: any) {
      logger.error({ err }, 'Batch processor cron error');
    }
  }, { timezone: 'UTC' });

  logger.info('  🔄 Batch processor cron: enabled (every 30 min — auto-processes completed AI batches)');
}

/**
 * Stop the batch processor cron.
 */
export function stopBatchProcessorCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}
