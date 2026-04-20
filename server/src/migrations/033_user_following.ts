import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration033: Migration = {
  version: 33,
  description: 'User following social graph',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_follows (
        id VARCHAR(36) PRIMARY KEY,
        follower_id VARCHAR(36) NOT NULL,
        following_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_follow (follower_id, following_id),
        INDEX idx_follower (follower_id),
        INDEX idx_following (following_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [followerCountColumn] = await pool.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'follower_count'`
    );
    if ((followerCountColumn as any[]).length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN follower_count INT DEFAULT 0');
    }

    const [followingCountColumn] = await pool.query<any[]>(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'following_count'`
    );
    if ((followingCountColumn as any[]).length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN following_count INT DEFAULT 0');
    }

    await pool.query(`
      UPDATE users u
      SET follower_count = (
        SELECT COUNT(*) FROM user_follows uf WHERE uf.following_id = u.id
      ),
      following_count = (
        SELECT COUNT(*) FROM user_follows uf WHERE uf.follower_id = u.id
      )
    `);
  },
};
