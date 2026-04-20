import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration039: Migration = {
  version: 39,
  description: 'Owned books tracking by format',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS owned_books (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        format ENUM('hardcover', 'paperback', 'ebook', 'audiobook') NOT NULL,
        condition_note VARCHAR(255) DEFAULT NULL,
        purchase_date DATE DEFAULT NULL,
        is_lendable BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_book_format (user_id, book_id, format),
        INDEX idx_user_owned (user_id),
        INDEX idx_user_book (user_id, book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
