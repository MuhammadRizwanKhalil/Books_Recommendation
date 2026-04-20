import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration021: Migration = {
  version: 21,
  description: 'Add DNF (Did Not Finish) reading status with percentage and reason',
  up: async () => {
    const pool = getPool();

    // Add 'dnf' to the status ENUM
    await pool.query(`
      ALTER TABLE reading_progress
        MODIFY COLUMN status ENUM('want-to-read', 'reading', 'finished', 'dnf') NOT NULL DEFAULT 'want-to-read'
    `);

    // Add DNF-specific columns
    await pool.query(`
      ALTER TABLE reading_progress
        ADD COLUMN dnf_percentage TINYINT UNSIGNED DEFAULT NULL COMMENT 'How far through before stopping (0-100)',
        ADD COLUMN dnf_reason TEXT DEFAULT NULL COMMENT 'Optional reason for not finishing'
    `);

    // Add dnf column to the reading counts cache table
    await pool.query(`
      ALTER TABLE book_reading_counts
        ADD COLUMN dnf INT NOT NULL DEFAULT 0 AFTER have_read
    `);
  },
};
