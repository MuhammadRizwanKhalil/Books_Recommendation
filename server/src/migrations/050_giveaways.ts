import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration050: Migration = {
  version: 50,
  description: 'Giveaways and giveaway entries',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS giveaways (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        created_by VARCHAR(36) NOT NULL,
        title VARCHAR(300) NOT NULL,
        description TEXT DEFAULT NULL,
        format ENUM('ebook', 'paperback', 'hardcover', 'audiobook') DEFAULT 'ebook',
        copies_available INT NOT NULL DEFAULT 1,
        entry_count INT DEFAULT 0,
        country_restriction VARCHAR(255) DEFAULT NULL COMMENT 'Comma-separated ISO codes, NULL=worldwide',
        start_date DATETIME NOT NULL,
        end_date DATETIME NOT NULL,
        status ENUM('draft', 'active', 'ended', 'winners_selected') DEFAULT 'draft',
        auto_add_to_tbr BOOLEAN DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_active_giveaways (status, end_date),
        INDEX idx_giveaways_creator (created_by),
        INDEX idx_giveaways_book (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS giveaway_entries (
        id VARCHAR(36) PRIMARY KEY,
        giveaway_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        is_winner BOOLEAN DEFAULT FALSE,
        entered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_giveaway_user (giveaway_id, user_id),
        INDEX idx_giveaway_entries_giveaway (giveaway_id),
        INDEX idx_giveaway_entries_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
