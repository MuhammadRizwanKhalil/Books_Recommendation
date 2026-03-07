/**
 * Migration 006 — Author Follows & Activity Feed
 * ────────────────────────────────────────────────
 * Allows users to follow authors and generates an activity feed.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS author_follows (
      user_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, author_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_af_user ON author_follows(user_id)');
  await safeIdx('CREATE INDEX idx_af_author ON author_follows(author_id)');
}

export const migration006: Migration = {
  version: 6,
  description: 'Author follows — users can follow their favorite authors',
  up,
};
