import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration045: Migration = {
  version: 45,
  description: 'Reading journal entries with public quote sharing',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        entry_type ENUM('note', 'quote', 'highlight', 'reaction') NOT NULL DEFAULT 'note',
        content TEXT NOT NULL,
        page_number INT DEFAULT NULL,
        chapter VARCHAR(100) DEFAULT NULL,
        is_private BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        INDEX idx_journal_user_book_created (user_id, book_id, created_at),
        INDEX idx_journal_user_created (user_id, created_at),
        INDEX idx_journal_book_public_quotes (book_id, is_private, entry_type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
