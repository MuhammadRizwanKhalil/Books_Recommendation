import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration038: Migration = {
  version: 38,
  description: 'Book clubs, membership, and monthly picks',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_clubs (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT NULL,
        cover_image VARCHAR(500) DEFAULT NULL,
        owner_id VARCHAR(36) NOT NULL,
        is_public BOOLEAN NOT NULL DEFAULT TRUE,
        member_count INT NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_public_clubs (is_public, member_count, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_club_members (
        id VARCHAR(36) PRIMARY KEY,
        club_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        role ENUM('owner', 'moderator', 'member') NOT NULL DEFAULT 'member',
        joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_club_member (club_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_club_picks (
        id VARCHAR(36) PRIMARY KEY,
        club_id VARCHAR(36) NOT NULL,
        book_id VARCHAR(36) NOT NULL,
        month_label VARCHAR(50) NOT NULL COMMENT 'e.g. June 2026',
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        discussion_id VARCHAR(36) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (club_id) REFERENCES book_clubs(id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (discussion_id) REFERENCES discussions(id) ON DELETE SET NULL,
        INDEX idx_book_club_picks_club_date (club_id, start_date, end_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
