import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration025: Migration = {
  version: 25,
  description: 'Content warnings taxonomy, book warnings, and votes',

  async up() {
    const pool = getPool();

    // ── Taxonomy table ───────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_warning_taxonomy (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        slug VARCHAR(100) NOT NULL UNIQUE,
        category ENUM('violence', 'sexual', 'mental_health', 'discrimination', 'death', 'other') NOT NULL,
        description VARCHAR(500) DEFAULT NULL,
        display_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Seed 25 predefined warnings ──────────────────────────────────────
    await pool.query(`
      INSERT IGNORE INTO content_warning_taxonomy (id, name, slug, category, display_order) VALUES
        (UUID(), 'Abuse', 'abuse', 'violence', 1),
        (UUID(), 'Addiction', 'addiction', 'mental_health', 2),
        (UUID(), 'Animal Cruelty', 'animal-cruelty', 'violence', 3),
        (UUID(), 'Body Image', 'body-image', 'mental_health', 4),
        (UUID(), 'Bullying', 'bullying', 'violence', 5),
        (UUID(), 'Death', 'death', 'death', 6),
        (UUID(), 'Domestic Violence', 'domestic-violence', 'violence', 7),
        (UUID(), 'Eating Disorders', 'eating-disorders', 'mental_health', 8),
        (UUID(), 'Gore', 'gore', 'violence', 9),
        (UUID(), 'Grief', 'grief', 'death', 10),
        (UUID(), 'Homophobia', 'homophobia', 'discrimination', 11),
        (UUID(), 'Kidnapping', 'kidnapping', 'violence', 12),
        (UUID(), 'Mental Health', 'mental-health', 'mental_health', 13),
        (UUID(), 'Murder', 'murder', 'violence', 14),
        (UUID(), 'Racism', 'racism', 'discrimination', 15),
        (UUID(), 'Rape/Sexual Assault', 'rape-sexual-assault', 'sexual', 16),
        (UUID(), 'Self-Harm', 'self-harm', 'mental_health', 17),
        (UUID(), 'Sexism', 'sexism', 'discrimination', 18),
        (UUID(), 'Sexual Content', 'sexual-content', 'sexual', 19),
        (UUID(), 'Slavery', 'slavery', 'discrimination', 20),
        (UUID(), 'Suicide', 'suicide', 'mental_health', 21),
        (UUID(), 'Terminal Illness', 'terminal-illness', 'death', 22),
        (UUID(), 'Torture', 'torture', 'violence', 23),
        (UUID(), 'Transphobia', 'transphobia', 'discrimination', 24),
        (UUID(), 'War', 'war', 'violence', 25)
    `);

    // ── Book content warnings ────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_content_warnings (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        warning_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        severity ENUM('mild', 'moderate', 'severe') NOT NULL DEFAULT 'moderate',
        details TEXT DEFAULT NULL,
        is_approved BOOLEAN DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (warning_id) REFERENCES content_warning_taxonomy(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_book_warning_user (book_id, warning_id, user_id),
        INDEX idx_book_warnings (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ── Votes on content warnings ────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS content_warning_votes (
        id VARCHAR(36) PRIMARY KEY,
        book_content_warning_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        vote ENUM('agree', 'disagree') NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_content_warning_id) REFERENCES book_content_warnings(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_cw_vote_user (book_content_warning_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
