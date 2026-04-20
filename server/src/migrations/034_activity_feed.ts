import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration034: Migration = {
  version: 34,
  description: 'Social activity feed',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        activity_type ENUM('review', 'rating', 'shelved', 'started', 'finished', 'dnf', 'progress', 'list_created', 'challenge_set') NOT NULL,
        book_id VARCHAR(36) DEFAULT NULL,
        reference_id VARCHAR(36) DEFAULT NULL,
        metadata JSON DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL,
        INDEX idx_user_activity (user_id, created_at DESC),
        INDEX idx_activity_time (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
