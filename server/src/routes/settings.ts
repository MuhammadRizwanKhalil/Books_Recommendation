import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, rateLimit } from '../middleware.js';
import { testSmtpConnection } from '../services/email.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Default settings seed data ──────────────────────────────────────────────

const DEFAULT_SETTINGS = [
  // General
  { key: 'site_name', value: 'The Book Times', category: 'general', label: 'Site Name', description: 'Name of the website', field_type: 'text', sort_order: 1 },
  { key: 'site_url', value: 'http://localhost:5173', category: 'general', label: 'Site URL', description: 'Public URL of the website', field_type: 'url', sort_order: 2 },
  { key: 'site_tagline', value: 'Discover your next favorite book', category: 'general', label: 'Site Tagline', description: 'Short tagline or slogan', field_type: 'text', sort_order: 3 },
  { key: 'site_description', value: 'The Book Times is a curated platform for book lovers to find, review, and discover new books.', category: 'general', label: 'Site Description', description: 'Short description of the website', field_type: 'textarea', sort_order: 4 },
  { key: 'admin_email', value: 'admin@thebooktimes.com', category: 'general', label: 'Admin Email', description: 'Primary admin email for receiving notifications', field_type: 'email', sort_order: 5 },
  { key: 'contact_email', value: 'contact@thebooktimes.com', category: 'general', label: 'Contact Email', description: 'Public contact email', field_type: 'email', sort_order: 6 },
  { key: 'items_per_page', value: '20', category: 'general', label: 'Items Per Page', description: 'Default number of items per page', field_type: 'number', sort_order: 7 },
  { key: 'maintenance_mode', value: 'false', category: 'general', label: 'Maintenance Mode', description: 'Enable maintenance mode (disables public access)', field_type: 'boolean', sort_order: 8 },

  // SMTP / Email
  { key: 'smtp_host', value: '', category: 'smtp', label: 'SMTP Host', description: 'e.g. smtp.gmail.com', field_type: 'text', sort_order: 1 },
  { key: 'smtp_port', value: '587', category: 'smtp', label: 'SMTP Port', description: 'Usually 587 for TLS, 465 for SSL', field_type: 'number', sort_order: 2 },
  { key: 'smtp_secure', value: 'false', category: 'smtp', label: 'SMTP Secure (SSL)', description: 'Use SSL (true for port 465)', field_type: 'boolean', sort_order: 3 },
  { key: 'smtp_user', value: '', category: 'smtp', label: 'SMTP Username', description: 'SMTP login username / email', field_type: 'email', sort_order: 4 },
  { key: 'smtp_pass', value: '', category: 'smtp', label: 'SMTP Password', description: 'App password or SMTP password', field_type: 'password', sort_order: 5 },
  { key: 'smtp_from_name', value: 'The Book Times', category: 'smtp', label: 'From Name', description: 'Display name in sent emails', field_type: 'text', sort_order: 6 },
  { key: 'smtp_from_email', value: 'noreply@thebooktimes.com', category: 'smtp', label: 'From Email', description: 'Sender email address', field_type: 'email', sort_order: 7 },

  // Branding
  { key: 'site_logo_url', value: '', category: 'branding', label: 'Logo URL', description: 'URL to site logo (leave empty for text logo)', field_type: 'url', sort_order: 1 },
  { key: 'site_favicon_url', value: '', category: 'branding', label: 'Favicon URL', description: 'URL to site favicon', field_type: 'url', sort_order: 2 },
  { key: 'brand_primary_color', value: '#c2631a', category: 'branding', label: 'Primary Color', description: 'Primary brand color (hex)', field_type: 'color', sort_order: 3 },
  { key: 'brand_secondary_color', value: '#1e293b', category: 'branding', label: 'Secondary Color', description: 'Secondary brand color (hex)', field_type: 'color', sort_order: 4 },
  { key: 'google_analytics_id', value: '', category: 'branding', label: 'Google Analytics ID', description: 'GA Measurement ID (e.g. G-XXXXXXXXXX)', field_type: 'text', sort_order: 5 },

  // Social Links
  { key: 'social_facebook', value: '', category: 'social', label: 'Facebook URL', description: 'Facebook page URL', field_type: 'url', sort_order: 1 },
  { key: 'social_twitter', value: '', category: 'social', label: 'Twitter / X URL', description: 'Twitter profile URL', field_type: 'url', sort_order: 2 },
  { key: 'social_instagram', value: '', category: 'social', label: 'Instagram URL', description: 'Instagram profile URL', field_type: 'url', sort_order: 3 },
  { key: 'social_linkedin', value: '', category: 'social', label: 'LinkedIn URL', description: 'LinkedIn company URL', field_type: 'url', sort_order: 4 },
  { key: 'social_youtube', value: '', category: 'social', label: 'YouTube URL', description: 'YouTube channel URL', field_type: 'url', sort_order: 5 },
  { key: 'social_tiktok', value: '', category: 'social', label: 'TikTok URL', description: 'TikTok profile URL', field_type: 'url', sort_order: 6 },
  { key: 'social_pinterest', value: '', category: 'social', label: 'Pinterest URL', description: 'Pinterest profile URL', field_type: 'url', sort_order: 7 },
  { key: 'social_goodreads', value: '', category: 'social', label: 'Goodreads URL', description: 'Goodreads profile URL', field_type: 'url', sort_order: 8 },

  // Legal
  { key: 'privacy_policy', value: '<h2>Privacy Policy</h2><p>Your privacy policy content goes here. Describe how you collect, use, and protect user data.</p>', category: 'legal', label: 'Privacy Policy', description: 'Privacy policy content (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'terms_conditions', value: '<h2>Terms & Conditions</h2><p>Your terms and conditions content goes here. Outline the rules and guidelines for using your site.</p>', category: 'legal', label: 'Terms & Conditions', description: 'Terms and conditions content (HTML)', field_type: 'richtext', sort_order: 2 },
  { key: 'cookie_policy', value: '<h2>Cookie Policy</h2><p>Your cookie policy content goes here. Explain how your site uses cookies and tracking technologies.</p>', category: 'legal', label: 'Cookie Policy', description: 'Cookie policy content (HTML)', field_type: 'richtext', sort_order: 3 },
  { key: 'refund_policy', value: '<h2>Refund Policy</h2><p>Since we provide book recommendations and affiliate links, outline your refund policy here.</p>', category: 'legal', label: 'Refund Policy', description: 'Refund policy (HTML)', field_type: 'richtext', sort_order: 4 },

  // Notifications
  { key: 'notify_new_user', value: 'true', category: 'notifications', label: 'New User Notification', description: 'Email admin when a new user registers', field_type: 'boolean', sort_order: 1 },
  { key: 'notify_new_review', value: 'true', category: 'notifications', label: 'New Review Notification', description: 'Email admin when a new review is submitted', field_type: 'boolean', sort_order: 2 },
  { key: 'notify_new_subscriber', value: 'true', category: 'notifications', label: 'New Subscriber Notification', description: 'Email admin when someone subscribes to newsletter', field_type: 'boolean', sort_order: 3 },
  { key: 'notify_contact_form', value: 'true', category: 'notifications', label: 'Contact Form Notification', description: 'Email admin on contact form submissions', field_type: 'boolean', sort_order: 4 },
  { key: 'welcome_email_enabled', value: 'true', category: 'notifications', label: 'Welcome Email', description: 'Send welcome email to new subscribers', field_type: 'boolean', sort_order: 5 },
  { key: 'welcome_email_subject', value: 'Welcome to The Book Times! 📚', category: 'notifications', label: 'Welcome Email Subject', description: 'Subject line for welcome email', field_type: 'text', sort_order: 6 },
  { key: 'welcome_email_content', value: '<h2>Welcome, {{subscriber_name}}!</h2><p>Thank you for subscribing to The Book Times newsletter. You\'ll receive curated book recommendations, exclusive deals, and reading tips straight to your inbox.</p><p>Happy reading! 📖</p>', category: 'notifications', label: 'Welcome Email Content', description: 'HTML content for welcome email', field_type: 'richtext', sort_order: 7 },

  // Security
  { key: 'admin_url_slug', value: 'ctrl-panel', category: 'security', label: 'Admin URL Slug', description: 'Secret URL slug to access admin dashboard (e.g. yoursite.com/ctrl-panel). Change this to any custom string.', field_type: 'text', sort_order: 1 },

  // Affiliate
  { key: 'affiliate_disclosure', value: '<h2>Affiliate Disclosure</h2><p>The Book Times participates in affiliate programs. When you click on links and make purchases, we may earn a commission at no extra cost to you. This helps us maintain and improve the platform.</p>', category: 'affiliate', label: 'Affiliate Disclosure', description: 'Affiliate disclosure statement (HTML)', field_type: 'richtext', sort_order: 1 },
  { key: 'affiliate_amazon_tag', value: '', category: 'affiliate', label: 'Amazon Affiliate Tag', description: 'Your Amazon Associates tag', field_type: 'text', sort_order: 2 },
  { key: 'affiliate_default_commission', value: '4.5', category: 'affiliate', label: 'Default Commission %', description: 'Default affiliate commission percentage', field_type: 'number', sort_order: 3 },
  { key: 'affiliate_cookie_days', value: '30', category: 'affiliate', label: 'Cookie Duration (days)', description: 'Affiliate cookie duration in days', field_type: 'number', sort_order: 4 },
  { key: 'affiliate_auto_link', value: 'true', category: 'affiliate', label: 'Auto-Link Books', description: 'Automatically add affiliate tags to book links', field_type: 'boolean', sort_order: 5 },

  // Homepage Content — editable section text
  { key: 'hero_badge_text', value: 'AI-Powered Book Discovery', category: 'homepage', label: 'Hero Badge Text', description: 'Badge label shown above the hero heading', field_type: 'text', sort_order: 1 },
  { key: 'popular_searches', value: 'Atomic Habits,Self Help,Business,Fiction,Technology', category: 'homepage', label: 'Popular Searches', description: 'Comma-separated list of popular search terms shown in hero', field_type: 'text', sort_order: 2 },
  { key: 'trending_badge', value: 'Hot Right Now', category: 'homepage', label: 'Trending Badge', description: 'Badge text for the trending section', field_type: 'text', sort_order: 3 },
  { key: 'trending_description', value: 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.', category: 'homepage', label: 'Trending Description', description: 'Description for the trending section', field_type: 'textarea', sort_order: 4 },
  { key: 'new_releases_badge', value: 'Fresh Arrivals', category: 'homepage', label: 'New Releases Badge', description: 'Badge text for the new releases section', field_type: 'text', sort_order: 5 },
  { key: 'new_releases_description', value: 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.', category: 'homepage', label: 'New Releases Description', description: 'Description for the new releases section', field_type: 'textarea', sort_order: 6 },
  { key: 'categories_description', value: 'From fiction to technology, find exactly what you are looking for.', category: 'homepage', label: 'Categories Description', description: 'Description for the categories section', field_type: 'textarea', sort_order: 7 },
  { key: 'newsletter_heading', value: 'Never Miss a Great Read', category: 'homepage', label: 'Newsletter Heading', description: 'Heading for the newsletter signup section', field_type: 'text', sort_order: 8 },
  { key: 'newsletter_description', value: 'Subscribe to our newsletter and get personalized book recommendations, new release alerts, and curated reading lists delivered to your inbox.', category: 'homepage', label: 'Newsletter Description', description: 'Description for the newsletter section', field_type: 'textarea', sort_order: 9 },
  { key: 'footer_tagline', value: 'Made with ♥ for book lovers', category: 'homepage', label: 'Footer Tagline', description: 'Tagline shown at the bottom of the footer', field_type: 'text', sort_order: 10 },
];

// ── GET /api/settings — public settings (non-sensitive) ─────────────────────

router.get('/', async (_req: Request, res: Response) => {
  try {
    const sensitiveKeys = ['smtp_user', 'smtp_pass', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_from_name', 'smtp_from_email', 'admin_url_slug', 'admin_email', 'affiliate_amazon_tag', 'google_analytics_id'];
    const rows = await dbAll<any>(`
      SELECT \`key\`, value, category, label, description, field_type, sort_order
      FROM site_settings
      WHERE \`key\` NOT IN (${sensitiveKeys.map(() => '?').join(',')})
      ORDER BY category, sort_order
    `, sensitiveKeys);

    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=240');
    res.json({ settings: grouped });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── GET /api/settings/admin — all settings (admin only) ─────────────────────

router.get('/admin', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await dbAll<any>(`
      SELECT \`key\`, value, category, label, description, field_type, sort_order, updated_at
      FROM site_settings
      ORDER BY category, sort_order
    `, []);

    const grouped: Record<string, any[]> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }
    res.set('Cache-Control', 'no-store');
    res.json({ settings: grouped, categories: Object.keys(grouped) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ── PUT /api/settings — bulk update (admin only) ────────────────────────────

// Allowed setting keys for bulk update (prevent arbitrary key injection)
const ALLOWED_SETTING_KEYS = new Set(DEFAULT_SETTINGS.map(s => s.key));

router.put('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Settings object is required' });
      return;
    }

    const entries = Object.entries(settings).map(([k, v]) => [k, String(v)] as [string, string]);

    for (const [key, value] of entries) {
      if (!ALLOWED_SETTING_KEYS.has(key)) continue; // Skip unknown keys
      // Prevent excessively large values (legal/richtext pages up to 100 KB, others up to 2 KB)
      const maxLen = ['privacy_policy', 'terms_conditions', 'cookie_policy', 'refund_policy', 'affiliate_disclosure', 'welcome_email_content'].includes(key) ? 102400 : 2048;
      if (value.length > maxLen) continue;
      await dbRun(`
        INSERT INTO site_settings (\`key\`, value, updated_at)
        VALUES (?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)
      `, [key, String(value)]);
    }

    res.json({ message: 'Settings updated', updated: entries.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ── PUT /api/settings/:key — update single setting ──────────────────────────

router.put('/:key', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const key = req.params.key as string;
    const { value } = req.body;

    if (value === undefined) {
      res.status(400).json({ error: 'Value is required' });
      return;
    }

    // Validate key exists in allowed settings
    if (!ALLOWED_SETTING_KEYS.has(key)) {
      res.status(400).json({ error: 'Unknown setting key' });
      return;
    }

    await dbRun(`
      INSERT INTO site_settings (\`key\`, value, updated_at)
      VALUES (?, ?, NOW())
      ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = VALUES(updated_at)
    `, [key, String(value)]);

    res.json({ message: 'Setting updated', key, value: String(value) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// ── POST /api/settings/seed — seed default settings ─────────────────────────

router.post('/seed', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    for (const s of DEFAULT_SETTINGS) {
      await dbRun(`
        INSERT IGNORE INTO site_settings (\`key\`, value, category, label, description, field_type, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `, [s.key, s.value, s.category, s.label, s.description, s.field_type, s.sort_order]);
    }

    res.json({ message: 'Default settings seeded', count: DEFAULT_SETTINGS.length });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to seed settings' });
  }
});

// ── GET /api/settings/verify-admin-access/:slug — verify admin URL slug ─────

router.get('/verify-admin-access/:slug', rateLimit('admin-slug', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    if (!slug) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const row = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', ['admin_url_slug']);
    const storedSlug = row?.value || '';
    if (storedSlug && slug === storedSlug) {
      res.json({ valid: true });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── POST /api/settings/test-smtp — test SMTP connection ────────────────────

router.post('/test-smtp', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await testSmtpConnection();
    res.json(result);
  } catch (err: any) {
    logger.error({ err: err.message }, 'SMTP test failed');
    res.status(500).json({ success: false, error: 'SMTP connection test failed' });
  }
});

export default router;
