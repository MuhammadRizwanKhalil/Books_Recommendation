import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration049: Migration = {
  version: 49,
  description: 'Author self-service portal (claims, dashboard posts, profile metadata)',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS author_claims (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        author_id VARCHAR(36) NOT NULL,
        verification_method ENUM('email', 'social_media', 'publisher', 'manual') NOT NULL,
        verification_proof TEXT DEFAULT NULL,
        status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        reviewed_by VARCHAR(36) DEFAULT NULL,
        reviewed_at DATETIME DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uq_user_author (user_id, author_id),
        INDEX idx_author_claims_status (status, created_at),
        INDEX idx_author_claims_author (author_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const safeAlter = async (sql: string) => {
      try {
        await pool.query(sql);
      } catch {
        // Ignore duplicate column/index/constraint errors.
      }
    };

    await safeAlter('ALTER TABLE authors ADD COLUMN claimed_by VARCHAR(36) DEFAULT NULL');
    await safeAlter('ALTER TABLE authors ADD COLUMN website VARCHAR(500) DEFAULT NULL');
    await safeAlter('ALTER TABLE authors ADD COLUMN social_links JSON DEFAULT NULL');
    await safeAlter('ALTER TABLE authors ADD INDEX idx_authors_claimed_by (claimed_by)');
    await safeAlter('ALTER TABLE authors ADD CONSTRAINT fk_authors_claimed_by FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS author_posts (
        id VARCHAR(36) PRIMARY KEY,
        author_id VARCHAR(36) NOT NULL,
        title VARCHAR(300) NOT NULL,
        content TEXT NOT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
        INDEX idx_author_posts (author_id, created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await safeAlter('ALTER TABLE reviews ADD COLUMN author_response TEXT DEFAULT NULL');
    await safeAlter('ALTER TABLE reviews ADD COLUMN author_response_at DATETIME DEFAULT NULL');
    await safeAlter('ALTER TABLE reviews ADD COLUMN author_response_by VARCHAR(36) DEFAULT NULL');
    await safeAlter('ALTER TABLE reviews ADD INDEX idx_reviews_author_response (author_response_at)');
    await safeAlter('ALTER TABLE reviews ADD CONSTRAINT fk_reviews_author_response_by FOREIGN KEY (author_response_by) REFERENCES users(id) ON DELETE SET NULL');
  },
};
