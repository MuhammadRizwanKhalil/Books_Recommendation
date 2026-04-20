import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration022: Migration = {
  version: 22,
  description: 'Annual reading challenge — goal tracking with cached book counts',
  async up() {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_challenges (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        year INT NOT NULL,
        goal_books INT NOT NULL DEFAULT 12 COMMENT 'Number of books to read',
        books_completed INT NOT NULL DEFAULT 0 COMMENT 'Cached count of finished books',
        started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_year (user_id, year),
        INDEX idx_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
