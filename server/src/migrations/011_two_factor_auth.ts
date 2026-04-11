/**
 * Migration 011 — Two-Factor Authentication
 * ──────────────────────────────────────────
 * Adds TOTP 2FA columns to users table and a login_events audit log.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // Add 2FA columns to users table (MySQL 8.0 doesn't support IF NOT EXISTS for ADD COLUMN)
  const [columns] = await pool.query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'totp_secret'`);
  if (!(columns as any[]).length) {
    await pool.query(`ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) DEFAULT NULL`);
    await pool.query(`ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE`);
    await pool.query(`ALTER TABLE users ADD COLUMN totp_backup_codes TEXT DEFAULT NULL`);
  }

  // Login events audit log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS login_events (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      event_type ENUM('login','login_2fa','failed_login','failed_2fa','enable_2fa','disable_2fa') NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_login_events_user (user_id),
      INDEX idx_login_events_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

export const migration011: Migration = {
  version: 11,
  description: 'Two-factor authentication (TOTP) and login events audit log',
  up,
};
