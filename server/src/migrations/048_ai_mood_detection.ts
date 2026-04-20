import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration048: Migration = {
  version: 48,
  description: 'AI mood detection and analysis insights',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_book_analysis (
        id VARCHAR(36) PRIMARY KEY,
        book_id VARCHAR(36) NOT NULL,
        analysis_type ENUM('mood', 'pace', 'content_warnings', 'themes', 'difficulty') NOT NULL,
        result JSON NOT NULL,
        model_version VARCHAR(50) DEFAULT 'gpt-4o-mini',
        analyzed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
        UNIQUE KEY uq_book_analysis (book_id, analysis_type),
        INDEX idx_analysis_book (book_id),
        INDEX idx_analysis_type (analysis_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};