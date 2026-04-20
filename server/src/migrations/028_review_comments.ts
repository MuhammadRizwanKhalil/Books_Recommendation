import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration028: Migration = {
  version: 28,
  description: 'Create review_comments table for threaded replies',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS review_comments (
        id VARCHAR(36) PRIMARY KEY,
        review_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        parent_comment_id VARCHAR(36) DEFAULT NULL COMMENT 'For threaded replies',
        content TEXT NOT NULL,
        is_edited BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_comment_id) REFERENCES review_comments(id) ON DELETE CASCADE,
        INDEX idx_review_comments (review_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
