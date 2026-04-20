/**
 * Migration 015 — Series Information
 * ────────────────────────────────────
 * Adds:
 *  1. book_series table (series metadata)
 *  2. book_series_entries table (junction linking books → series with position)
 *
 * Enables series badges on book pages and dedicated series browsing pages.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // ── 1. Book Series ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_series (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      slug VARCHAR(500) NOT NULL,
      description TEXT,
      cover_image TEXT,
      total_books INT NOT NULL DEFAULT 0,
      is_complete BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_series_slug (slug),
      FULLTEXT INDEX ft_series_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 2. Book Series Entries (junction) ───────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_series_entries (
      id VARCHAR(36) PRIMARY KEY,
      series_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      position DECIMAL(5,1) NOT NULL COMMENT 'Supports 0.5 for novellas',
      is_main_entry BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (series_id) REFERENCES book_series(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE KEY uq_series_book (series_id, book_id),
      INDEX idx_series_position (series_id, position)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export const migration015: Migration = {
  version: 15,
  description: 'Series information tables',
  up,
};
