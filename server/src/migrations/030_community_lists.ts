import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration030: Migration = {
  version: 30,
  description: 'Add community list metadata and per-book voting',
  up: async () => {
    const pool = getPool();
    const safe = async (sql: string) => {
      try {
        await pool.query(sql);
      } catch {
        // Ignore already-existing columns or indexes
      }
    };

    await safe('ALTER TABLE reading_lists ADD COLUMN is_community BOOLEAN NOT NULL DEFAULT FALSE AFTER is_public');
    await safe('ALTER TABLE reading_lists ADD COLUMN vote_count INT NOT NULL DEFAULT 0 AFTER is_community');
    await safe('ALTER TABLE reading_lists ADD COLUMN view_count INT NOT NULL DEFAULT 0 AFTER vote_count');
    await safe('ALTER TABLE reading_lists ADD COLUMN is_featured BOOLEAN NOT NULL DEFAULT FALSE AFTER view_count');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS list_book_votes (
        id VARCHAR(36) PRIMARY KEY,
        list_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        vote TINYINT NOT NULL DEFAULT 1 COMMENT '1=upvote, -1=downvote',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (list_id) REFERENCES reading_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_list_book_vote (list_id, book_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safe('CREATE INDEX idx_reading_lists_community ON reading_lists(is_community, is_public)');
    await safe('CREATE INDEX idx_reading_lists_featured ON reading_lists(is_featured, vote_count)');
    await safe('CREATE INDEX idx_list_book_votes_list_book ON list_book_votes(list_id, book_id)');
    await safe('CREATE INDEX idx_list_book_votes_user ON list_book_votes(user_id)');
  },
};
