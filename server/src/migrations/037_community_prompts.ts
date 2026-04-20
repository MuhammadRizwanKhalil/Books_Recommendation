import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration037: Migration = {
  version: 37,
  description: 'Community prompts and prompt responses',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS book_prompts (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        prompt_text VARCHAR(500) NOT NULL,
        created_by VARCHAR(36) DEFAULT NULL COMMENT 'NULL = system prompt',
        response_count INT NOT NULL DEFAULT 0,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_book_prompts (book_id, response_count, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS prompt_responses (
        id VARCHAR(36) PRIMARY KEY,
        prompt_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        content TEXT NOT NULL,
        like_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prompt_id) REFERENCES book_prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uq_user_prompt (prompt_id, user_id),
        INDEX idx_prompt_responses (prompt_id, like_count, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
