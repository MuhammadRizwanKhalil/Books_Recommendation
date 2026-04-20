import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration042: Migration = {
  version: 42,
  description: 'Cover zoom gallery - additional book images',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_images (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        image_type ENUM('cover_front', 'cover_back', 'spine', 'sample_page', 'author_signed') DEFAULT 'cover_front',
        display_order INT DEFAULT 0,
        alt_text VARCHAR(255) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        INDEX idx_book_images (book_id, display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};