/**
 * Data Retention Job
 *
 * Automatically purges old analytics data to prevent unbounded table growth.
 * Default schedule: daily at 3:30 AM UTC.
 *
 * Retention periods (configurable via env):
 *   - analytics_events:  90 days
 *   - page_views:        90 days
 *   - web_vitals:        30 days
 *   - rate_limit cleanup: automatic (in-memory)
 */

import cron, { ScheduledTask } from 'node-cron';
import { dbRun } from '../database.js';
import { cleanExpiredRefreshTokens } from '../middleware.js';
import { logger } from '../lib/logger.js';

let cronTask: ScheduledTask | null = null;

const RETENTION = {
  analyticsEvents: parseInt(process.env.RETENTION_ANALYTICS_DAYS || '90', 10),
  pageViews: parseInt(process.env.RETENTION_PAGEVIEWS_DAYS || '90', 10),
  webVitals: parseInt(process.env.RETENTION_WEBVITALS_DAYS || '30', 10),
  aiEmailLog: parseInt(process.env.RETENTION_AI_LOG_DAYS || '180', 10),
};

async function runRetention(): Promise<void> {
  logger.info('🧹 Data retention: starting cleanup...');

  const tables = [
    { name: 'analytics_events', column: 'created_at', days: RETENTION.analyticsEvents },
    { name: 'page_views', column: 'created_at', days: RETENTION.pageViews },
    { name: 'web_vitals', column: 'created_at', days: RETENTION.webVitals },
    { name: 'ai_email_log', column: 'created_at', days: RETENTION.aiEmailLog },
  ];

  let totalDeleted = 0;

  for (const { name, column, days } of tables) {
    try {
      const result = await dbRun(
        `DELETE FROM ${name} WHERE ${column} < DATE_SUB(NOW(), INTERVAL ? DAY)`,
        [days],
      );
      if (result.changes > 0) {
        logger.info({ table: name, deleted: result.changes, retentionDays: days }, `Purged old records from ${name}`);
        totalDeleted += result.changes;
      }
    } catch (err: any) {
      // Table may not exist yet — that's OK
      if (!err.message?.includes('doesn\'t exist')) {
        logger.error({ err, table: name }, `Data retention error for ${name}`);
      }
    }
  }

  logger.info({ totalDeleted }, '🧹 Data retention complete');

  // Clean expired/revoked refresh tokens
  try {
    const cleaned = await cleanExpiredRefreshTokens();
    if (cleaned > 0) {
      logger.info({ deleted: cleaned }, 'Cleaned expired refresh tokens');
    }
  } catch (err: any) {
    if (!err.message?.includes("doesn't exist")) {
      logger.error({ err }, 'Refresh token cleanup error');
    }
  }
}

export function startRetentionCron(schedule = '30 3 * * *'): void {
  if (cronTask) return;

  cronTask = cron.schedule(schedule, () => {
    runRetention().catch(err => {
      logger.error({ err }, 'Data retention job failed');
    });
  });

  logger.info({ schedule }, 'Data retention cron started');
}

export function stopRetentionCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

export { runRetention };
