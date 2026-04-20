import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration018: Migration = {
  version: 18,
  description: 'Add book_reading_counts cache table',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_reading_counts (
        book_id VARCHAR(36) PRIMARY KEY,
        currently_reading INT NOT NULL DEFAULT 0,
        want_to_read INT NOT NULL DEFAULT 0,
        have_read INT NOT NULL DEFAULT 0,
        total INT NOT NULL DEFAULT 0,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed the cache table from existing reading_progress data
    await pool.query(`
      INSERT INTO book_reading_counts (book_id, currently_reading, want_to_read, have_read, total)
      SELECT
        book_id,
        SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS currently_reading,
        SUM(CASE WHEN status = 'want-to-read' THEN 1 ELSE 0 END) AS want_to_read,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS have_read,
        COUNT(*) AS total
      FROM reading_progress
      GROUP BY book_id
      ON DUPLICATE KEY UPDATE
        currently_reading = VALUES(currently_reading),
        want_to_read = VALUES(want_to_read),
        have_read = VALUES(have_read),
        total = VALUES(total)
    `);
  },
};
