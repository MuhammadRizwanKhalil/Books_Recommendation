import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration031: Migration = {
  version: 31,
  description: 'Book characters and moderation',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_characters (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        role ENUM('protagonist', 'antagonist', 'supporting', 'minor') DEFAULT 'supporting',
        display_order INT DEFAULT 0,
        submitted_by VARCHAR(36) DEFAULT NULL,
        is_approved BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (submitted_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_book_character_name (book_id, name),
        INDEX idx_book_characters (book_id, is_approved, display_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
