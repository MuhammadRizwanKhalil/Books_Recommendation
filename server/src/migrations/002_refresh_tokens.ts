/**
 * Migration 002 — Refresh Tokens Table
 * ─────────────────────────────────────
 * Adds the refresh_tokens table for JWT token rotation.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      token VARCHAR(256) NOT NULL,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const idx = async (name: string, table: string, columns: string) => {
    try { await pool.query(`CREATE INDEX ${name} ON ${table}(${columns})`); } catch { /* exists */ }
  };

  await idx('idx_refresh_tokens_token', 'refresh_tokens', 'token');
  await idx('idx_refresh_tokens_user', 'refresh_tokens', 'user_id');
  await idx('idx_refresh_tokens_expires', 'refresh_tokens', 'expires_at');
}

export const migration002: Migration = {
  version: 2,
  description: 'Add refresh_tokens table for JWT rotation',
  up,
};
