/**
 * Migration 017 — Pace Indicator
 * ───────────────────────────────
 * Adds:
 *  1. book_pace_votes table (user votes: slow/medium/fast per book)
 *
 * Enables community-voted pace bars on book detail pages.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_pace_votes (
      id VARCHAR(36) PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      pace ENUM('slow', 'medium', 'fast') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_book_pace_user (book_id, user_id),
      INDEX idx_book_pace (book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export const migration017: Migration = {
  version: 17,
  description: 'Pace indicator — community-voted pacing (slow/medium/fast)',
  up,
};
