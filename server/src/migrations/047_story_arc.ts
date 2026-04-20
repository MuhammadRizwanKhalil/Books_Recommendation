import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration047: Migration = {
  version: 47,
  description: 'Story arc visualization points and community votes',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_arc_points (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        position_percent DECIMAL(5,2) NOT NULL COMMENT '0-100 position in book',
        intensity DECIMAL(3,2) NOT NULL COMMENT '0-1 emotional intensity',
        label VARCHAR(100) DEFAULT NULL COMMENT 'e.g. Inciting incident, Climax',
        source ENUM('ai', 'community_avg', 'admin') NOT NULL DEFAULT 'ai',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        INDEX idx_book_arc (book_id, position_percent),
        INDEX idx_book_arc_source (book_id, source)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS story_arc_votes (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        position_percent DECIMAL(5,2) NOT NULL,
        intensity DECIMAL(3,2) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_story_arc_votes_book (book_id, position_percent),
        INDEX idx_story_arc_votes_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
