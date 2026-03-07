/**
 * Migration 008 — Subscription Tiers
 * ────────────────────────────────────
 * Adds a `tier` column to users and a `subscriptions` table for
 * tracking payment / entitlement history.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // Add tier column to users (safe: IF NOT EXISTS via try/catch)
  const addCol = async (sql: string) => { try { await pool.execute(sql); } catch { /* col exists */ } };
  await addCol("ALTER TABLE users ADD COLUMN tier ENUM('free','plus','premium') NOT NULL DEFAULT 'free' AFTER role");
  await addCol("ALTER TABLE users ADD COLUMN tier_expires_at TIMESTAMP NULL DEFAULT NULL AFTER tier");

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      plan ENUM('free','plus','premium') NOT NULL DEFAULT 'free',
      status ENUM('active','cancelled','expired','past_due') NOT NULL DEFAULT 'active',
      payment_provider VARCHAR(50) DEFAULT NULL COMMENT 'stripe / paypal / manual',
      external_id VARCHAR(255) DEFAULT NULL COMMENT 'provider subscription ID',
      amount_cents INT NOT NULL DEFAULT 0,
      currency VARCHAR(3) NOT NULL DEFAULT 'USD',
      interval_unit ENUM('month','year') NOT NULL DEFAULT 'month',
      current_period_start TIMESTAMP NULL,
      current_period_end TIMESTAMP NULL,
      cancelled_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Feature entitlements per tier
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS tier_features (
      id VARCHAR(36) PRIMARY KEY,
      tier ENUM('free','plus','premium') NOT NULL,
      feature_key VARCHAR(100) NOT NULL,
      feature_value VARCHAR(255) NOT NULL DEFAULT 'true',
      description VARCHAR(255),
      UNIQUE KEY uq_tier_feature (tier, feature_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Seed default features
  const features = [
    // Free
    ['free', 'max_reading_lists', '3', 'Max reading lists'],
    ['free', 'max_list_items', '25', 'Max items per list'],
    ['free', 'daily_recommendations', '5', 'Recommendations per day'],
    ['free', 'export_lists', 'false', 'Export lists to CSV'],
    ['free', 'ad_free', 'false', 'Ad-free experience'],
    ['free', 'email_digest', 'true', 'Weekly email digest'],
    // Plus
    ['plus', 'max_reading_lists', '20', 'Max reading lists'],
    ['plus', 'max_list_items', '100', 'Max items per list'],
    ['plus', 'daily_recommendations', '25', 'Recommendations per day'],
    ['plus', 'export_lists', 'true', 'Export lists to CSV'],
    ['plus', 'ad_free', 'true', 'Ad-free experience'],
    ['plus', 'email_digest', 'true', 'Daily/Weekly digest'],
    ['plus', 'priority_support', 'true', 'Priority support'],
    // Premium
    ['premium', 'max_reading_lists', 'unlimited', 'Unlimited lists'],
    ['premium', 'max_list_items', 'unlimited', 'Max items per list'],
    ['premium', 'daily_recommendations', 'unlimited', 'Unlimited recommendations'],
    ['premium', 'export_lists', 'true', 'Export lists to CSV'],
    ['premium', 'ad_free', 'true', 'Ad-free experience'],
    ['premium', 'email_digest', 'true', 'All digest frequencies'],
    ['premium', 'priority_support', 'true', 'Priority support'],
    ['premium', 'early_access', 'true', 'Early access to new features'],
    ['premium', 'api_access', 'true', 'Public API access'],
  ];

  for (const [tier, key, value, desc] of features) {
    await pool.execute(
      `INSERT IGNORE INTO tier_features (id, tier, feature_key, feature_value, description) VALUES (UUID(), ?, ?, ?, ?)`,
      [tier, key, value, desc],
    );
  }

  const safeIdx = async (sql: string) => { try { await pool.execute(sql); } catch { /* exists */ } };
  await safeIdx('CREATE INDEX idx_sub_user ON subscriptions(user_id)');
  await safeIdx('CREATE INDEX idx_sub_status ON subscriptions(status)');
  await safeIdx('CREATE INDEX idx_tf_tier ON tier_features(tier)');
}

export const migration008: Migration = {
  version: 8,
  description: 'Subscription tiers, entitlements, and feature gates',
  up,
};
