import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration035: Migration = {
  version: 35,
  description: 'Social login accounts',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_social_accounts (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        provider ENUM('google', 'apple') NOT NULL,
        provider_user_id VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        access_token TEXT DEFAULT NULL,
        refresh_token TEXT DEFAULT NULL,
        token_expires_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_provider_user (provider, provider_user_id),
        INDEX idx_user_social (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [avatarRows] = await pool.query<any[]>(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar_url'
    `);
    if (!Array.isArray(avatarRows) || avatarRows.length === 0) {
      await pool.query(`ALTER TABLE users ADD COLUMN avatar_url TEXT DEFAULT NULL`);
    }

    await pool.query(`
      ALTER TABLE users
      MODIFY COLUMN password_hash VARCHAR(255) NULL COMMENT 'NULL for social-only accounts'
    `);
  },
};
