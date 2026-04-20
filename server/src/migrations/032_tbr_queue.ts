import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration032: Migration = {
  version: 32,
  description: 'Up next TBR queue',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tbr_queue (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        position INT NOT NULL,
        added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_book_tbr (user_id, book_id),
        INDEX idx_user_queue (user_id, position)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  },
};
