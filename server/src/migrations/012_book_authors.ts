/**
 * Migration 012 — Book-Authors Many-to-Many
 * ──────────────────────────────────────────
 * Creates a junction table so a book can have multiple authors.
 * Migrates existing author_id relationships into the junction table.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // 1. Create the book_authors junction table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_authors (
      book_id VARCHAR(36) NOT NULL,
      author_id VARCHAR(36) NOT NULL,
      position INT NOT NULL DEFAULT 0,
      PRIMARY KEY (book_id, author_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
      INDEX idx_book_authors_author (author_id),
      INDEX idx_book_authors_position (book_id, position)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // 2. Migrate existing single author_id relationships into the junction
  await pool.query(`
    INSERT IGNORE INTO book_authors (book_id, author_id, position)
    SELECT id, author_id, 0 FROM books
    WHERE author_id IS NOT NULL
  `);
}

export const migration012: Migration = {
  version: 12,
  description: 'Book-authors many-to-many junction table',
  up,
};
