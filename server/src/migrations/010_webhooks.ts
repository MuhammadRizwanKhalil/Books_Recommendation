/**
 * Migration 010 — Webhooks
 * ─────────────────────────
 * Outbound webhook endpoints, event subscriptions, and delivery log.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS webhooks (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      url VARCHAR(2048) NOT NULL,
      secret VARCHAR(255) NOT NULL COMMENT 'HMAC signing secret',
      events JSON NOT NULL COMMENT '["book.created","review.created", …]',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      failure_count INT NOT NULL DEFAULT 0,
      last_triggered_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id VARCHAR(36) PRIMARY KEY,
      webhook_id VARCHAR(36) NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload JSON NOT NULL,
      response_status INT DEFAULT NULL,
      response_body TEXT DEFAULT NULL,
      duration_ms INT DEFAULT NULL,
      status ENUM('pending', 'success', 'failed') NOT NULL DEFAULT 'pending',
      attempt INT NOT NULL DEFAULT 1,
      next_retry_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_wh_user ON webhooks(user_id)');
  await safeIdx('CREATE INDEX idx_wh_active ON webhooks(is_active)');
  await safeIdx('CREATE INDEX idx_whd_webhook ON webhook_deliveries(webhook_id)');
  await safeIdx('CREATE INDEX idx_whd_status ON webhook_deliveries(status)');
  await safeIdx('CREATE INDEX idx_whd_retry ON webhook_deliveries(next_retry_at)');
}

export const migration010: Migration = {
  version: 10,
  description: 'Webhook endpoints and delivery log',
  up,
};
