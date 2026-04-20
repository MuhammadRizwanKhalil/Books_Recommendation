import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration023: Migration = {
  version: 23,
  description: 'Reading streaks tracking for stats dashboard',
  async up() {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_streaks (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        current_streak_days INT NOT NULL DEFAULT 0,
        longest_streak_days INT NOT NULL DEFAULT 0,
        last_reading_date DATE DEFAULT NULL,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_streak (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
