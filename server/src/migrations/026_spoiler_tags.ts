import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

export const migration026: Migration = {
  version: 26,
  description: 'Add spoiler fields to reviews table',

  async up() {
    const pool = getPool();

    // Check if column already exists before adding
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'has_spoiler'`
    );
    if ((cols as any[]).length === 0) {
      await pool.query(`ALTER TABLE reviews ADD COLUMN has_spoiler BOOLEAN NOT NULL DEFAULT FALSE`);
    }

    const [cols2] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews' AND COLUMN_NAME = 'spoiler_text'`
    );
    if ((cols2 as any[]).length === 0) {
      await pool.query(`ALTER TABLE reviews ADD COLUMN spoiler_text TEXT DEFAULT NULL`);
    }
  },
};
