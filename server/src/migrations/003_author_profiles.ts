/**
 * Migration 003 — Enhanced Author Profiles
 * ─────────────────────────────────────────
 * Adds social media links, born/died dates, nationality,
 * and genre specialization to the authors table.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // Helper to add column if not exists (MySQL safe)
  const addCol = async (col: string, def: string) => {
    try {
      await pool.query(`ALTER TABLE authors ADD COLUMN ${col} ${def}`);
    } catch { /* column already exists */ }
  };

  await addCol('twitter_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('instagram_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('goodreads_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('amazon_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('wikipedia_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('facebook_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('youtube_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('tiktok_url', 'VARCHAR(500) DEFAULT NULL');
  await addCol('born_date', 'VARCHAR(30) DEFAULT NULL');
  await addCol('died_date', 'VARCHAR(30) DEFAULT NULL');
  await addCol('nationality', 'VARCHAR(100) DEFAULT NULL');
  await addCol('genres', 'TEXT DEFAULT NULL');        // JSON array of genre strings
  await addCol('awards', 'TEXT DEFAULT NULL');         // JSON array of award strings
  await addCol('total_works', 'INT DEFAULT 0');
  await addCol('meta_title', 'VARCHAR(300) DEFAULT NULL');
  await addCol('meta_description', 'TEXT DEFAULT NULL');
}

export const migration003: Migration = {
  version: 3,
  description: 'Enhanced author profiles — social links, biography metadata, awards',
  up,
};
