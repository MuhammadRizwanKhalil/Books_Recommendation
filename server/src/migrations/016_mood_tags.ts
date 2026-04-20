/**
 * Migration 016 — Mood Tags
 * ─────────────────────────
 * Adds:
 *  1. mood_taxonomy table (12 predefined moods with emoji + color)
 *  2. book_mood_votes table (user votes linking books → moods)
 *
 * Enables community-voted mood percentages on book detail pages
 * and mood-based book discovery.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // ── 1. Mood Taxonomy ────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mood_taxonomy (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      slug VARCHAR(100) NOT NULL UNIQUE,
      emoji VARCHAR(10) DEFAULT NULL,
      color VARCHAR(7) DEFAULT NULL COMMENT 'Hex color for pill display',
      display_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── 2. Seed 12 predefined moods ────────────────────────────────────────
  await pool.query(`
    INSERT IGNORE INTO mood_taxonomy (id, name, slug, emoji, color, display_order) VALUES
      (UUID(), 'Adventurous', 'adventurous', '🗺️', '#F59E0B', 1),
      (UUID(), 'Dark', 'dark', '🌑', '#1F2937', 2),
      (UUID(), 'Emotional', 'emotional', '💔', '#EC4899', 3),
      (UUID(), 'Funny', 'funny', '😂', '#10B981', 4),
      (UUID(), 'Hopeful', 'hopeful', '🌅', '#6366F1', 5),
      (UUID(), 'Informative', 'informative', '📚', '#3B82F6', 6),
      (UUID(), 'Inspiring', 'inspiring', '✨', '#8B5CF6', 7),
      (UUID(), 'Lighthearted', 'lighthearted', '☀️', '#FBBF24', 8),
      (UUID(), 'Mysterious', 'mysterious', '🔮', '#7C3AED', 9),
      (UUID(), 'Romantic', 'romantic', '❤️', '#EF4444', 10),
      (UUID(), 'Sad', 'sad', '😢', '#6B7280', 11),
      (UUID(), 'Tense', 'tense', '😰', '#DC2626', 12)
  `);

  // ── 3. Book Mood Votes ──────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_mood_votes (
      id VARCHAR(36) PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      mood_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (mood_id) REFERENCES mood_taxonomy(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY uq_book_mood_user (book_id, mood_id, user_id),
      INDEX idx_book_moods (book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export const migration016: Migration = {
  version: 16,
  description: 'Mood tags — taxonomy + community votes',
  up,
};
