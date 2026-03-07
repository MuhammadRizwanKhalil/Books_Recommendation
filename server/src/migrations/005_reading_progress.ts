/**
 * Migration 005 — Reading Progress
 * ─────────────────────────────────
 * Tracks user reading status per book: want-to-read, reading, finished.
 * Includes current page, start/finish dates, and optional rating.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      status ENUM('want-to-read', 'reading', 'finished') NOT NULL DEFAULT 'want-to-read',
      current_page INT NOT NULL DEFAULT 0,
      total_pages INT NOT NULL DEFAULT 0,
      started_at DATE DEFAULT NULL,
      finished_at DATE DEFAULT NULL,
      personal_rating DECIMAL(2,1) DEFAULT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_book_progress (user_id, book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_rp_user ON reading_progress(user_id)');
  await safeIdx('CREATE INDEX idx_rp_user_status ON reading_progress(user_id, status)');
  await safeIdx('CREATE INDEX idx_rp_book ON reading_progress(book_id)');
}

export const migration005: Migration = {
  version: 5,
  description: 'Reading progress tracking — status, pages, dates per user-book',
  up,
};
