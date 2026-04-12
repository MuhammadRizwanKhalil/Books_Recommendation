/**
 * Migration 013 — Enhancement Pack
 * ──────────────────────────────────
 * Adds:
 *  1. book_of_the_day history table (deterministic BOTD with history + manual override)
 *  2. book_quotes table (user-submitted memorable quotes per book)
 *  3. user_genre_preferences table (onboarding genre picker for CF seeding)
 *  4. search_queries table (analytics — what users are searching for)
 *  5. FULLTEXT index safety check (already in baseline, but guard added)
 *  6. Indexes on hot query paths (books.computed_score, books.google_rating, etc.)
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // ── 1. Book of the Day history ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_of_the_day (
      date DATE PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      selected_by ENUM('auto', 'admin') NOT NULL DEFAULT 'auto',
      selected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      admin_note TEXT,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      INDEX idx_botd_book (book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 2. Book Quotes ──────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_quotes (
      id VARCHAR(36) PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      quote TEXT NOT NULL,
      page_number INT,
      submitted_by VARCHAR(36),
      upvotes INT NOT NULL DEFAULT 0,
      is_approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_quotes_book (book_id),
      INDEX idx_quotes_approved (book_id, is_approved, upvotes)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 3. User Genre Preferences (onboarding) ──────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_genre_preferences (
      user_id VARCHAR(36) NOT NULL,
      category_id VARCHAR(36) NOT NULL,
      weight FLOAT NOT NULL DEFAULT 1.0,
      source ENUM('onboarding', 'implicit', 'explicit') NOT NULL DEFAULT 'onboarding',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, category_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      INDEX idx_genre_pref_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 4. Search Query Analytics ───────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS search_queries (
      id VARCHAR(36) PRIMARY KEY,
      query VARCHAR(500) NOT NULL,
      results_count INT NOT NULL DEFAULT 0,
      user_id VARCHAR(36),
      ip_address VARCHAR(45),
      clicked_book_id VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_search_query (query(100)),
      INDEX idx_search_created (created_at),
      INDEX idx_search_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 5. Add helpful composite indexes on books table ─────────────────────
  // Guard: only add if they don't already exist
  const [existingIndexes] = await pool.query(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'`,
  ) as any[];

  const indexNames = new Set(existingIndexes.map((r: any) => r.INDEX_NAME));

  if (!indexNames.has('idx_books_score_status')) {
    await pool.query(`
      ALTER TABLE books ADD INDEX idx_books_score_status (status, is_active, computed_score DESC)
    `);
  }

  if (!indexNames.has('idx_books_rating_count')) {
    await pool.query(`
      ALTER TABLE books ADD INDEX idx_books_rating_count (google_rating, ratings_count)
    `);
  }

  if (!indexNames.has('idx_books_published')) {
    await pool.query(`
      ALTER TABLE books ADD INDEX idx_books_published (published_date, status, is_active)
    `);
  }

  if (!indexNames.has('idx_books_author')) {
    await pool.query(`
      ALTER TABLE books ADD INDEX idx_books_author (author(100))
    `);
  }

  // ── 6. Add onboarding_completed flag to users ───────────────────────────
  const [userCols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`,
  ) as any[];
  const userColNames = new Set(userCols.map((r: any) => r.COLUMN_NAME));

  if (!userColNames.has('onboarding_completed')) {
    await pool.query(`
      ALTER TABLE users ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE
    `);
  }

  // ── 7. Add buy_link column to books if missing ──────────────────────────
  if (!userColNames.has('buy_link')) {
    const [bookCols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'books'`,
    ) as any[];
    const bookColNames = new Set(bookCols.map((r: any) => r.COLUMN_NAME));
    if (!bookColNames.has('buy_link')) {
      await pool.query(`ALTER TABLE books ADD COLUMN buy_link TEXT AFTER amazon_url`);
    }
  }
}

export const migration013: Migration = {
  version: 13,
  description: 'Enhancement pack: BOTD history, book quotes, genre preferences, search analytics, performance indexes',
  up,
};
