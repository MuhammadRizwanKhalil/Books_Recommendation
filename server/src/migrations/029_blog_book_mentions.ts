import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration029: Migration = {
  version: 29,
  description: 'Create blog_book_mentions table for "Featured In" cross-links',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS blog_book_mentions (
        id VARCHAR(36) PRIMARY KEY,
        blog_post_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        is_auto_detected BOOLEAN DEFAULT FALSE COMMENT 'Auto-extracted from blog content',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE KEY uq_blog_book (blog_post_id, book_id),
        INDEX idx_book_mentions (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed blog_book_mentions from existing blog_featured_books entries
    await pool.query(`
      INSERT IGNORE INTO blog_book_mentions (id, blog_post_id, book_id, is_auto_detected, created_at)
      SELECT UUID(), blog_id, book_id, FALSE, NOW()
      FROM blog_featured_books
    `);
  },
};
