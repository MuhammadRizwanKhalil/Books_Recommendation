/**
 * Database Migration System
 * ─────────────────────────
 * Versioned schema changes tracked in `schema_migrations` table.
 * Each migration has an `up()` that runs SQL and a `version` number.
 * Already-applied migrations are skipped automatically.
 *
 * Usage:
 *   import { runMigrations } from './lib/migrator.js';
 *   await runMigrations();   // call after initPool(), before app.listen()
 */

import { getPool, dbAll, dbRun } from '../database.js';
import { logger } from './logger.js';

// ── Migration interface ──────────────────────────────────────────────────

export interface Migration {
  /** Monotonically-increasing integer version (e.g. 1, 2, 3 …) */
  version: number;
  /** Short human-readable description shown in logs */
  description: string;
  /** The SQL or logic to apply. Receives pool for raw queries. */
  up: () => Promise<void>;
}

// ── Migrations registry ─────────────────────────────────────────────────
// Import every migration and register here in ascending order.

import { migration001 } from '../migrations/001_baseline.js';
import { migration002 } from '../migrations/002_refresh_tokens.js';
import { migration003 } from '../migrations/003_author_profiles.js';
import { migration004 } from '../migrations/004_reading_lists.js';
import { migration005 } from '../migrations/005_reading_progress.js';
import { migration006 } from '../migrations/006_author_follows.js';
import { migration007 } from '../migrations/007_email_digest.js';
import { migration008 } from '../migrations/008_subscriptions.js';
import { migration009 } from '../migrations/009_ab_testing.js';
import { migration010 } from '../migrations/010_webhooks.js';
import { migration011 } from '../migrations/011_two_factor_auth.js';
import { migration012 } from '../migrations/012_book_authors.js';
import { migration013 } from '../migrations/013_enhancement_pack.js';
import { migration014 } from '../migrations/014_password_reset_otp.js';

const migrations: Migration[] = [
  migration001,
  migration002,
  migration003,
  migration004,
  migration005,
  migration006,
  migration007,
  migration008,
  migration009,
  migration010,
  migration011,
  migration012,
  migration013,
  migration014,
];

// ── Runner ──────────────────────────────────────────────────────────────

/**
 * Ensure the `schema_migrations` tracking table exists.
 */
async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INT PRIMARY KEY,
      description VARCHAR(500) NOT NULL,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

/**
 * Return the set of already-applied version numbers.
 */
async function getAppliedVersions(): Promise<Set<number>> {
  const rows = await dbAll<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(rows.map(r => r.version));
}

/**
 * Run all pending migrations in order.
 * Safe to call on every startup — already-applied migrations are skipped.
 */
export async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getAppliedVersions();

  // Sort ascending just in case the array is out of order
  const sorted = [...migrations].sort((a, b) => a.version - b.version);

  let pending = 0;
  for (const m of sorted) {
    if (applied.has(m.version)) continue;
    pending++;
    const start = Date.now();
    logger.info(`  ⬆ Migration ${String(m.version).padStart(3, '0')}: ${m.description} …`);

    try {
      await m.up();
      await dbRun(
        'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
        [m.version, m.description],
      );
      logger.info(`  ✅ Migration ${String(m.version).padStart(3, '0')} applied in ${Date.now() - start}ms`);
    } catch (err: any) {
      logger.error(`  ❌ Migration ${String(m.version).padStart(3, '0')} FAILED: ${err.message}`);
      throw err; // abort startup
    }
  }

  if (pending === 0) {
    logger.info('  📋 Database schema is up to date (no pending migrations)');
  } else {
    logger.info(`  📋 Applied ${pending} migration(s)`);
  }
}
