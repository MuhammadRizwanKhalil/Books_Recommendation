/**
 * Migration 007 — Email Digest Preferences
 * ──────────────────────────────────────────
 * Stores per-user digest frequency & content preferences.
 * Also tracks when last digest was sent so the cron can pick
 * up users that are due.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS email_digest_preferences (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL UNIQUE,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      frequency ENUM('daily', 'weekly', 'monthly') NOT NULL DEFAULT 'weekly',
      preferred_day TINYINT NOT NULL DEFAULT 1 COMMENT '0=Sun … 6=Sat (for weekly)',
      preferred_hour TINYINT NOT NULL DEFAULT 9 COMMENT 'Hour in UTC (0-23)',
      include_new_releases BOOLEAN NOT NULL DEFAULT TRUE,
      include_trending BOOLEAN NOT NULL DEFAULT TRUE,
      include_followed_authors BOOLEAN NOT NULL DEFAULT TRUE,
      include_reading_progress BOOLEAN NOT NULL DEFAULT TRUE,
      include_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
      last_sent_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS email_digest_log (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      book_count INT NOT NULL DEFAULT 0,
      sections JSON,
      status ENUM('sent', 'failed') NOT NULL DEFAULT 'sent',
      error_message TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_edp_user ON email_digest_preferences(user_id)');
  await safeIdx('CREATE INDEX idx_edp_enabled ON email_digest_preferences(enabled, frequency)');
  await safeIdx('CREATE INDEX idx_edl_user ON email_digest_log(user_id)');
  await safeIdx('CREATE INDEX idx_edl_sent ON email_digest_log(sent_at)');
}

export const migration007: Migration = {
  version: 7,
  description: 'Email digest preferences and send log',
  up,
};
