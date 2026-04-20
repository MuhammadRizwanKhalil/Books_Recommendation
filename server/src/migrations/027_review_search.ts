import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration027: Migration = {
  version: 27,
  description: 'Add FULLTEXT index on reviews for search',
  up: async () => {
    const pool = getPool();

    // Check if FULLTEXT index already exists
    const [rows]: any = await pool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'
         AND INDEX_NAME = 'ft_review_content'`
    );
    if (rows[0].cnt === 0) {
      await pool.query('ALTER TABLE reviews ADD FULLTEXT INDEX ft_review_content (title, content)');
    }
  },
};
