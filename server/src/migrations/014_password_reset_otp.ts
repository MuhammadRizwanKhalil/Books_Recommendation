/**
 * Migration 014 — Password Reset OTP
 * ────────────────────────────────────
 * Adds a table to store time-limited OTP codes for password reset.
 * OTPs expire after 10 minutes and are single-use.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      otp_hash VARCHAR(255) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 3,
      expires_at DATETIME NOT NULL,
      used_at DATETIME,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_reset_email (email),
      INDEX idx_reset_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export const migration014: Migration = {
  version: 14,
  description: 'Password reset OTP table',
  up,
};
