/**
 * Migration 009 — A/B Testing & Feature Flags
 * ─────────────────────────────────────────────
 * Stores experiments, their variants, and user assignments.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS experiments (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description TEXT,
      status ENUM('draft', 'running', 'paused', 'completed') NOT NULL DEFAULT 'draft',
      type ENUM('ab_test', 'feature_flag', 'multivariate') NOT NULL DEFAULT 'ab_test',
      traffic_percentage INT NOT NULL DEFAULT 100 COMMENT '% of eligible users included',
      start_date TIMESTAMP NULL,
      end_date TIMESTAMP NULL,
      created_by VARCHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS experiment_variants (
      id VARCHAR(36) PRIMARY KEY,
      experiment_id VARCHAR(36) NOT NULL,
      name VARCHAR(100) NOT NULL COMMENT 'e.g. control, variant_a',
      weight INT NOT NULL DEFAULT 50 COMMENT 'Relative weight (sums to 100)',
      config JSON COMMENT 'Variant-specific configuration',
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      UNIQUE KEY uq_exp_variant (experiment_id, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS experiment_assignments (
      id VARCHAR(36) PRIMARY KEY,
      experiment_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) DEFAULT NULL,
      session_id VARCHAR(100) DEFAULT NULL,
      variant_id VARCHAR(36) NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES experiment_variants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS experiment_events (
      id VARCHAR(36) PRIMARY KEY,
      experiment_id VARCHAR(36) NOT NULL,
      variant_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36) DEFAULT NULL,
      session_id VARCHAR(100) DEFAULT NULL,
      event_type VARCHAR(100) NOT NULL COMMENT 'e.g. page_view, click, conversion',
      event_value DECIMAL(10,2) DEFAULT NULL,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (experiment_id) REFERENCES experiments(id) ON DELETE CASCADE,
      FOREIGN KEY (variant_id) REFERENCES experiment_variants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_ea_experiment ON experiment_assignments(experiment_id)');
  await safeIdx('CREATE INDEX idx_ea_user ON experiment_assignments(user_id)');
  await safeIdx('CREATE INDEX idx_ea_session ON experiment_assignments(session_id)');
  await safeIdx('CREATE UNIQUE INDEX uq_ea_exp_user ON experiment_assignments(experiment_id, user_id)');
  await safeIdx('CREATE INDEX idx_ee_experiment ON experiment_events(experiment_id)');
  await safeIdx('CREATE INDEX idx_ee_variant ON experiment_events(variant_id)');
  await safeIdx('CREATE INDEX idx_ee_type ON experiment_events(event_type)');
}

export const migration009: Migration = {
  version: 9,
  description: 'A/B testing — experiments, variants, assignments, events',
  up,
};
