import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration051: Migration = {
  version: 51,
  description: 'Famous reviews / critic quotes for books (AI-fetched)',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS famous_reviews (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        reviewer_name VARCHAR(255) NOT NULL,
        publication VARCHAR(255) DEFAULT NULL,
        quote_text TEXT NOT NULL,
        source_url VARCHAR(500) DEFAULT NULL,
        ai_model VARCHAR(100) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        INDEX idx_famous_reviews_book (book_id),
        INDEX idx_famous_reviews_reviewer (reviewer_name),
        UNIQUE KEY uq_famous_review (book_id, reviewer_name, publication)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
