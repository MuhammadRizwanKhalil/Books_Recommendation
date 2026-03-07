/**
 * Migration 004 — Reading Lists / Collections
 * ─────────────────────────────────────────────
 * Creates reading_lists and reading_list_items tables for
 * shareable, SEO-friendly book collections.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS reading_lists (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(300) NOT NULL,
      description TEXT,
      cover_image VARCHAR(500),
      is_public BOOLEAN NOT NULL DEFAULT TRUE,
      book_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_user_list_slug (user_id, slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS reading_list_items (
      id VARCHAR(36) PRIMARY KEY,
      list_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      notes TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES reading_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE KEY uq_list_book (list_id, book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Indexes (safe to create if not exists)
  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_rl_user ON reading_lists(user_id)');
  await safeIdx('CREATE INDEX idx_rl_public ON reading_lists(is_public)');
  await safeIdx('CREATE INDEX idx_rli_list ON reading_list_items(list_id)');
  await safeIdx('CREATE INDEX idx_rli_book ON reading_list_items(book_id)');
}

export const migration004: Migration = {
  version: 4,
  description: 'Reading lists / collections — shareable book collections with ordering',
  up,
};
