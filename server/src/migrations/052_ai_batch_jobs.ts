import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration052: Migration = {
  version: 52,
  description: 'AI batch jobs tracking table for OpenAI Batch API',
  up: async () => {
    const pool = getPool();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_batch_jobs (
        id VARCHAR(36) PRIMARY KEY,
        batch_id VARCHAR(100) NOT NULL,
        job_type ENUM('famous_reviews', 'mood_analysis', 'blog_generation') NOT NULL,
        total_requests INT NOT NULL DEFAULT 0,
        processed INT DEFAULT NULL,
        stored INT DEFAULT NULL,
        failed INT DEFAULT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'submitted',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME DEFAULT NULL,
        INDEX idx_batch_jobs_batch_id (batch_id),
        INDEX idx_batch_jobs_type (job_type),
        INDEX idx_batch_jobs_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },
};
