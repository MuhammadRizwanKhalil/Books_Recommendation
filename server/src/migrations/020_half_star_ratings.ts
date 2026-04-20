import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration020: Migration = {
  version: 20,
  description: 'Change reviews.rating from TINYINT to DECIMAL(2,1) for half-star ratings',
  up: async () => {
    const pool = getPool();

    // Change rating column to support 0.5 increments (0.5 – 5.0)
    // Existing integer values auto-convert to DECIMAL (e.g. 4 → 4.0)
    await pool.query(`ALTER TABLE reviews MODIFY COLUMN rating DECIMAL(2,1) NOT NULL`);
  },
};
