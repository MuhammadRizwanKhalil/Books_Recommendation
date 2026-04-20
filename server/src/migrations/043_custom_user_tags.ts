import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration043: Migration = {
  version: 43,
  description: 'Custom user tags for personal book organization',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_tags (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT NULL COMMENT 'Hex color for display',
        book_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_tag (user_id, name),
        INDEX idx_user_tags_user (user_id),
        INDEX idx_user_tags_user_created (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_user_tags (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        tag_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES user_tags(id) ON DELETE CASCADE,
        UNIQUE KEY uq_book_tag (book_id, tag_id),
        INDEX idx_book_user_tags_tag (tag_id),
        INDEX idx_book_user_tags_book (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
