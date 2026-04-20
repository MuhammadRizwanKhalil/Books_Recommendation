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
import { migration015 } from '../migrations/015_series_information.js';
import { migration016 } from '../migrations/016_mood_tags.js';
import { migration017 } from '../migrations/017_pace_indicator.js';
import { migration018 } from '../migrations/018_reading_counts.js';
import { migration019 } from '../migrations/019_nullable_review_content.js';
import { migration020 } from '../migrations/020_half_star_ratings.js';
import { migration021 } from '../migrations/021_dnf_status.js';
import { migration022 } from '../migrations/022_reading_challenge.js';
import { migration023 } from '../migrations/023_reading_stats.js';
import { migration024 } from '../migrations/024_goodreads_import.js';
import { migration025 } from '../migrations/025_content_warnings.js';
import { migration026 } from '../migrations/026_spoiler_tags.js';
import { migration027 } from '../migrations/027_review_search.js';
import { migration028 } from '../migrations/028_review_comments.js';
import { migration029 } from '../migrations/029_blog_book_mentions.js';
import { migration030 } from '../migrations/030_community_lists.js';
import { migration031 } from '../migrations/031_characters.js';
import { migration032 } from '../migrations/032_tbr_queue.js';
import { migration033 } from '../migrations/033_user_following.js';
import { migration034 } from '../migrations/034_activity_feed.js';
import { migration035 } from '../migrations/035_social_login.js';
import { migration036 } from '../migrations/036_discussions.js';
import { migration037 } from '../migrations/037_community_prompts.js';
import { migration038 } from '../migrations/038_book_clubs.js';
import { migration039 } from '../migrations/039_owned_books.js';
import { migration040 } from '../migrations/040_editions.js';
import { migration041 } from '../migrations/041_progress_tracker.js';
import { migration042 } from '../migrations/042_cover_gallery.js';
import { migration043 } from '../migrations/043_custom_user_tags.js';
import { migration044 } from '../migrations/044_choice_awards.js';
import { migration045 } from '../migrations/045_reading_journal.js';
import { migration046 } from '../migrations/046_quizzes.js';
import { migration047 } from '../migrations/047_story_arc.js';
import { migration048 } from '../migrations/048_ai_mood_detection.js';
import { migration049 } from '../migrations/049_author_self_service.js';
import { migration050 } from '../migrations/050_giveaways.js';
import { migration051 } from '../migrations/051_famous_reviews.js';
import { migration052 } from '../migrations/052_ai_batch_jobs.js';

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
  migration015,
  migration016,
  migration017,
  migration018,
  migration019,
  migration020,
  migration021,
  migration022,
  migration023,
  migration024,
  migration025,
  migration026,
  migration027,
  migration028,
  migration029,
  migration030,
  migration031,
  migration032,
  migration033,
  migration034,
  migration035,
  migration036,
  migration037,
  migration038,
  migration039,
  migration040,
  migration041,
  migration042,
  migration043,
  migration044,
  migration045,
  migration046,
  migration047,
  migration048,
  migration049,
  migration050,
  migration051,
  migration052,
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
