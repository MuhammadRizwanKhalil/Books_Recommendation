import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration024: Migration = {
  version: 24,
  description: 'Goodreads CSV import — import_jobs + import_job_items tables',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_jobs (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        source ENUM('goodreads', 'storygraph', 'librarything') NOT NULL DEFAULT 'goodreads',
        status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending',
        total_rows INT DEFAULT 0,
        processed_rows INT DEFAULT 0,
        matched_books INT DEFAULT 0,
        new_books INT DEFAULT 0,
        skipped_rows INT DEFAULT 0,
        error_message TEXT DEFAULT NULL,
        file_name VARCHAR(255) NOT NULL,
        started_at DATETIME DEFAULT NULL,
        completed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_imports (user_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS import_job_items (
        id VARCHAR(36) PRIMARY KEY,
        import_job_id VARCHAR(36) NOT NULL,
        \`row_number\` INT NOT NULL,
        goodreads_book_id VARCHAR(50),
        isbn VARCHAR(13),
        isbn13 VARCHAR(13),
        title VARCHAR(500),
        author VARCHAR(500),
        status ENUM('matched', 'created', 'skipped', 'failed') NOT NULL DEFAULT 'skipped',
        matched_book_id VARCHAR(36) DEFAULT NULL,
        rating DECIMAL(2,1) DEFAULT NULL,
        shelf VARCHAR(50) DEFAULT NULL,
        date_read DATE DEFAULT NULL,
        review_text TEXT DEFAULT NULL,
        error_reason VARCHAR(255) DEFAULT NULL,
        FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
        INDEX idx_job_items (import_job_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
