import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration019: Migration = {
  version: 19,
  description: 'Make reviews.content nullable for rating-only reviews',
  up: async () => {
    const pool = getPool();

    // Allow rating-only reviews (no title or content required)
    await pool.query(`ALTER TABLE reviews MODIFY content TEXT DEFAULT NULL`);
  },
};
