import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration044: Migration = {
  version: 44,
  description: 'Annual Choice Awards tables for categories, nominees, and votes',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS choice_awards (
        id VARCHAR(36) PRIMARY KEY,
        year YEAR NOT NULL,
        is_active BOOLEAN DEFAULT FALSE,
        nomination_start DATE NOT NULL,
        nomination_end DATE NOT NULL,
        voting_start DATE NOT NULL,
        voting_end DATE NOT NULL,
        results_published BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_choice_awards_year (year)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS award_categories (
        id VARCHAR(36) PRIMARY KEY,
        award_id VARCHAR(36) NOT NULL,
        name VARCHAR(255) NOT NULL COMMENT 'e.g. Best Fiction',
        display_order INT DEFAULT 0,
        FOREIGN KEY (award_id) REFERENCES choice_awards(id) ON DELETE CASCADE,
        INDEX idx_award_categories_award (award_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS award_nominees (
        id VARCHAR(36) PRIMARY KEY,
        category_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        is_official BOOLEAN DEFAULT FALSE COMMENT 'Admin-nominated vs community',
        vote_count INT DEFAULT 0,
        is_winner BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (category_id) REFERENCES award_categories(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE KEY uq_award_nominees_category_book (category_id, book_id),
        INDEX idx_award_nominees_category (category_id),
        INDEX idx_award_nominees_book (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS award_votes (
        id VARCHAR(36) PRIMARY KEY,
        nominee_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (nominee_id) REFERENCES award_nominees(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_award_votes_user_nominee (user_id, nominee_id),
        INDEX idx_award_votes_nominee (nominee_id),
        INDEX idx_award_votes_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
