import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration041: Migration = {
  version: 41,
  description: 'Progress tracker bar — percentage field and progress history timeline',
  up: async () => {
    const pool = getPool();

    const [rows] = await pool.query(
      `
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'reading_progress'
          AND COLUMN_NAME = 'percentage'
        LIMIT 1
      `,
    );

    const hasPercentage = Array.isArray(rows) && rows.length > 0;
    if (!hasPercentage) {
      await pool.query(`
        ALTER TABLE reading_progress
          ADD COLUMN percentage DECIMAL(5,2) DEFAULT NULL
      `);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reading_progress_history (
        id VARCHAR(36) PRIMARY KEY,
        reading_progress_id VARCHAR(36) NOT NULL,
        current_page INT DEFAULT NULL,
        percentage DECIMAL(5,2) DEFAULT NULL,
        note VARCHAR(500) DEFAULT NULL COMMENT 'Optional reading note',
        logged_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reading_progress_id) REFERENCES reading_progress(id) ON DELETE CASCADE,
        INDEX idx_progress_history (reading_progress_id, logged_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};