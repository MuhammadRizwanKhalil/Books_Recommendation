import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration036: Migration = {
  version: 36,
  description: 'Book discussion forums and replies',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS discussions (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) DEFAULT NULL,
        category_id VARCHAR(36) DEFAULT NULL COMMENT 'Reserved for future category-wide discussions',
        user_id VARCHAR(36) NOT NULL,
        title VARCHAR(300) NOT NULL,
        content TEXT NOT NULL,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        is_locked BOOLEAN NOT NULL DEFAULT FALSE,
        reply_count INT NOT NULL DEFAULT 0,
        last_activity_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_book_discussions (book_id, is_pinned, last_activity_at),
        FULLTEXT INDEX ft_discussion (title, content)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS discussion_replies (
        id VARCHAR(36) PRIMARY KEY,
        discussion_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        is_edited BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_discussion_replies (discussion_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
