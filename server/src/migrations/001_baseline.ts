/**
 * Migration 001 — Baseline Schema
 * ────────────────────────────────
 * Creates all initial tables if they don't exist.
 * This is a "baseline" migration: when running against an existing database
 * that already has all tables, every CREATE TABLE IF NOT EXISTS is a no-op,
 * and the migration simply records itself as applied.
 */

import { getPool } from '../database.js';
import type { Migration } from '../lib/migrator.js';

async function up(): Promise<void> {
  const pool = getPool();

  // Users
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      role ENUM('user','admin') NOT NULL DEFAULT 'user',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Books
  await pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id VARCHAR(36) PRIMARY KEY,
      google_books_id VARCHAR(50),
      isbn10 VARCHAR(20),
      isbn13 VARCHAR(20),
      slug VARCHAR(400) UNIQUE NOT NULL,
      title VARCHAR(500) NOT NULL,
      subtitle TEXT,
      author VARCHAR(300) NOT NULL,
      author_id VARCHAR(36),
      description TEXT,
      cover_image TEXT NOT NULL,
      publisher VARCHAR(300),
      published_date VARCHAR(20),
      page_count INT,
      language VARCHAR(10) NOT NULL DEFAULT 'en',
      google_rating DOUBLE,
      ratings_count INT NOT NULL DEFAULT 0,
      computed_score DOUBLE NOT NULL DEFAULT 0,
      price DOUBLE,
      currency VARCHAR(10) NOT NULL DEFAULT 'USD',
      amazon_url TEXT,
      meta_title VARCHAR(300),
      meta_description TEXT,
      og_image TEXT,
      canonical_url TEXT,
      focus_keyword VARCHAR(200),
      seo_robots VARCHAR(100) DEFAULT 'index, follow',
      goodreads_url TEXT,
      custom_link_label VARCHAR(200),
      custom_link_url TEXT,
      admin_notes TEXT,
      status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'PUBLISHED',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      indexed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FULLTEXT INDEX ft_books_search (title, author, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Authors
  await pool.query(`
    CREATE TABLE IF NOT EXISTS authors (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      slug VARCHAR(400) UNIQUE NOT NULL,
      bio TEXT,
      image_url TEXT,
      website_url TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Categories
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(200) UNIQUE NOT NULL,
      slug VARCHAR(250) UNIQUE NOT NULL,
      description TEXT,
      image_url TEXT,
      meta_title VARCHAR(300),
      meta_description TEXT,
      book_count INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Book-Category junction
  await pool.query(`
    CREATE TABLE IF NOT EXISTS book_categories (
      book_id VARCHAR(36) NOT NULL,
      category_id VARCHAR(36) NOT NULL,
      PRIMARY KEY (book_id, category_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Blog posts
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id VARCHAR(36) PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(500) UNIQUE NOT NULL,
      content LONGTEXT NOT NULL,
      excerpt TEXT,
      meta_title VARCHAR(300),
      meta_description TEXT,
      featured_image TEXT,
      og_image TEXT,
      canonical_url TEXT,
      focus_keyword VARCHAR(200),
      seo_robots VARCHAR(100) DEFAULT 'index, follow',
      tags TEXT,
      category VARCHAR(200),
      custom_link_label VARCHAR(200),
      custom_link_url TEXT,
      admin_notes TEXT,
      allow_comments BOOLEAN DEFAULT TRUE,
      is_featured BOOLEAN DEFAULT FALSE,
      status ENUM('DRAFT','PUBLISHED','SCHEDULED') NOT NULL DEFAULT 'DRAFT',
      published_at DATETIME,
      generated_by ENUM('ai','cron','manual') DEFAULT 'manual',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Blog featured books junction
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_featured_books (
      blog_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      PRIMARY KEY (blog_id, book_id),
      FOREIGN KEY (blog_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Reviews
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id VARCHAR(36) PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36),
      user_name VARCHAR(255) NOT NULL,
      user_avatar TEXT,
      rating TINYINT NOT NULL CHECK(rating >= 1 AND rating <= 5),
      title VARCHAR(500),
      content TEXT NOT NULL,
      helpful_count INT NOT NULL DEFAULT 0,
      is_approved BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Wishlist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      user_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Reading history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reading_history (
      id VARCHAR(36) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,
      book_id VARCHAR(36) NOT NULL,
      read_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Testimonials
  await pool.query(`
    CREATE TABLE IF NOT EXISTS testimonials (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(200) NOT NULL DEFAULT 'Book Enthusiast',
      avatar_url TEXT,
      content TEXT NOT NULL,
      rating TINYINT NOT NULL DEFAULT 5,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Newsletter subscribers
  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id VARCHAR(36) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      name VARCHAR(255),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      subscribed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Analytics events
  await pool.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id VARCHAR(36) PRIMARY KEY,
      event_type VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(36),
      user_id VARCHAR(36),
      session_id VARCHAR(100),
      metadata JSON,
      ip_address VARCHAR(100),
      user_agent TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Page views
  await pool.query(`
    CREATE TABLE IF NOT EXISTS page_views (
      id VARCHAR(36) PRIMARY KEY,
      page_path VARCHAR(500) NOT NULL,
      page_title VARCHAR(500),
      user_id VARCHAR(36),
      session_id VARCHAR(100),
      referrer TEXT,
      duration_ms INT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Affiliate clicks
  await pool.query(`
    CREATE TABLE IF NOT EXISTS affiliate_clicks (
      id VARCHAR(36) PRIMARY KEY,
      book_id VARCHAR(36) NOT NULL,
      user_id VARCHAR(36),
      session_id VARCHAR(100),
      source VARCHAR(200),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Site settings (key-value store)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      \`key\` VARCHAR(200) PRIMARY KEY,
      value TEXT NOT NULL,
      category VARCHAR(100) NOT NULL DEFAULT 'general',
      label VARCHAR(300),
      description TEXT,
      field_type ENUM('text','textarea','email','url','number','boolean','json','richtext','password','color') NOT NULL DEFAULT 'text',
      sort_order INT NOT NULL DEFAULT 0,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Email campaigns
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_campaigns (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(500) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      preview_text TEXT,
      html_content LONGTEXT NOT NULL,
      plain_content LONGTEXT,
      status ENUM('draft','scheduled','sending','sent','failed','cancelled') NOT NULL DEFAULT 'draft',
      campaign_type ENUM('manual','ai_generated','automated','welcome','digest') NOT NULL DEFAULT 'manual',
      target_audience ENUM('all_subscribers','active_only','segment') NOT NULL DEFAULT 'all_subscribers',
      segment_filter TEXT,
      scheduled_at DATETIME,
      sent_at DATETIME,
      total_recipients INT NOT NULL DEFAULT 0,
      sent_count INT NOT NULL DEFAULT 0,
      open_count INT NOT NULL DEFAULT 0,
      click_count INT NOT NULL DEFAULT 0,
      bounce_count INT NOT NULL DEFAULT 0,
      unsubscribe_count INT NOT NULL DEFAULT 0,
      created_by VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Campaign recipients tracking
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaign_recipients (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36) NOT NULL,
      subscriber_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      status ENUM('pending','sent','delivered','opened','clicked','bounced','failed','unsubscribed') NOT NULL DEFAULT 'pending',
      sent_at DATETIME,
      opened_at DATETIME,
      clicked_at DATETIME,
      error_message TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Email templates
  await pool.query(`
    CREATE TABLE IF NOT EXISTS email_templates (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      subject VARCHAR(500) NOT NULL,
      html_content LONGTEXT NOT NULL,
      plain_content LONGTEXT,
      template_type ENUM('campaign','welcome','digest','notification','ai_generated') NOT NULL DEFAULT 'campaign',
      variables TEXT,
      is_default BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // AI email generation log
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_email_log (
      id VARCHAR(36) PRIMARY KEY,
      campaign_id VARCHAR(36),
      prompt TEXT NOT NULL,
      generated_subject VARCHAR(500),
      generated_content LONGTEXT,
      model_used VARCHAR(100),
      tokens_used INT,
      status ENUM('generating','generated','approved','rejected','sent') NOT NULL DEFAULT 'generated',
      created_by VARCHAR(36),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (campaign_id) REFERENCES email_campaigns(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Web Vitals
  await pool.query(`
    CREATE TABLE IF NOT EXISTS web_vitals (
      id VARCHAR(36) PRIMARY KEY,
      metric_name VARCHAR(50) NOT NULL,
      metric_value DOUBLE NOT NULL,
      rating VARCHAR(20),
      delta DOUBLE,
      metric_id VARCHAR(100),
      navigation_type VARCHAR(50),
      url TEXT,
      user_agent TEXT,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // ── Indexes ─────────────────────────────────────────────────────────────
  const idx = async (name: string, table: string, columns: string) => {
    try { await pool.query(`CREATE INDEX ${name} ON ${table}(${columns})`); } catch { /* exists */ }
  };

  await idx('idx_books_slug', 'books', 'slug');
  await idx('idx_books_status', 'books', 'status');
  await idx('idx_books_google_rating', 'books', 'google_rating DESC');
  await idx('idx_books_computed_score', 'books', 'computed_score DESC');
  await idx('idx_books_created_at', 'books', 'created_at DESC');
  await idx('idx_books_published_date', 'books', 'published_date DESC');
  await idx('idx_books_google_id', 'books', 'google_books_id');
  await idx('idx_books_isbn10', 'books', 'isbn10');
  await idx('idx_books_isbn13', 'books', 'isbn13');
  await idx('idx_books_active_score', 'books', 'status, is_active, computed_score DESC');
  await idx('idx_books_active_date', 'books', 'status, is_active, published_date DESC');
  await idx('idx_books_author_id', 'books', 'author_id');
  await idx('idx_authors_slug', 'authors', 'slug');
  await idx('idx_authors_name', 'authors', 'name');
  await idx('idx_categories_slug', 'categories', 'slug');
  await idx('idx_book_categories_book', 'book_categories', 'book_id');
  await idx('idx_book_categories_cat', 'book_categories', 'category_id');
  await idx('idx_reviews_book', 'reviews', 'book_id');
  await idx('idx_reviews_user', 'reviews', 'user_id');
  await idx('idx_blog_posts_slug', 'blog_posts', 'slug');
  await idx('idx_blog_posts_status', 'blog_posts', 'status');
  await idx('idx_analytics_events_type', 'analytics_events', 'event_type');
  await idx('idx_analytics_events_created', 'analytics_events', 'created_at');
  await idx('idx_page_views_path', 'page_views', 'page_path');
  await idx('idx_page_views_created', 'page_views', 'created_at');
  await idx('idx_affiliate_clicks_book', 'affiliate_clicks', 'book_id');
  await idx('idx_affiliate_clicks_created', 'affiliate_clicks', 'created_at');
  await idx('idx_newsletter_email', 'newsletter_subscribers', 'email');
  await idx('idx_wishlist_user', 'wishlist', 'user_id');
  await idx('idx_reading_history_user', 'reading_history', 'user_id');
  await idx('idx_site_settings_category', 'site_settings', 'category');
  await idx('idx_email_campaigns_status', 'email_campaigns', 'status');
  await idx('idx_campaign_recipients_campaign', 'campaign_recipients', 'campaign_id');
  await idx('idx_email_templates_type', 'email_templates', 'template_type');
}

export const migration001: Migration = {
  version: 1,
  description: 'Baseline schema — all initial tables and indexes',
  up,
};
