import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, optionalAuth, rateLimit } from '../middleware.js';

const router = Router();

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Anonymize IPv4 by zeroing the last octet; IPv6 by zeroing the last 80 bits */
function anonymizeIp(ip: string | undefined): string | null {
  if (!ip) return null;
  // IPv4
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
    return ip.replace(/\.\d{1,3}$/, '.0');
  }
  // IPv4-mapped IPv6 (::ffff:1.2.3.4)
  if (ip.startsWith('::ffff:')) {
    const v4 = ip.slice(7);
    return `::ffff:${v4.replace(/\.\d{1,3}$/, '.0')}`;
  }
  // Full IPv6 — zero last 5 groups
  const parts = ip.split(':');
  if (parts.length >= 4) {
    return parts.slice(0, 3).join(':') + ':0:0:0:0:0';
  }
  return ip;
}

/** Allowed event types for the analytics event endpoint */
const ALLOWED_EVENT_TYPES = new Set([
  'page_view', 'book_view', 'book_click', 'search', 'category_click',
  'author_click', 'review_view', 'affiliate_click', 'newsletter_signup',
  'wishlist_add', 'wishlist_remove', 'share', 'external_link', 'cta_click',
]);

// ── GET /api/analytics/public-stats — public site statistics ────────────────
// Provides real counts for the frontend hero section, newsletter, etc.
router.get('/public-stats', async (_req: Request, res: Response) => {
  try {
    const totalBooks = (await dbGet<any>("SELECT COUNT(*) as c FROM books WHERE status = 'PUBLISHED' AND is_active = 1", [])).c;
    const totalCategories = (await dbGet<any>('SELECT COUNT(*) as c FROM categories', [])).c;
    const totalReviews = (await dbGet<any>('SELECT COUNT(*) as c FROM reviews WHERE is_approved = 1', [])).c;
    const totalSubscribers = (await dbGet<any>('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE is_active = 1', [])).c;
    const totalAuthors = (await dbGet<any>("SELECT COUNT(DISTINCT author) as c FROM books WHERE status = 'PUBLISHED' AND is_active = 1", [])).c;
    const avgRating = (await dbGet<any>('SELECT ROUND(AVG(google_rating), 1) as avg FROM books WHERE google_rating > 0 AND is_active = 1', [])).avg || 0;

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({
      totalBooks,
      totalCategories,
      totalReviews,
      totalSubscribers,
      totalAuthors,
      avgRating,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ── POST /api/analytics/event ───────────────────────────────────────────────
// Public: track any event from the frontend
router.post('/event', rateLimit('analytics-event', 60, 60 * 1000), optionalAuth, async (req: Request, res: Response) => {
  try {
    const { eventType, entityType, entityId, sessionId, metadata } = req.body;

    if (!eventType) {
      res.status(400).json({ error: 'Event type is required' });
      return;
    }

    // Validate event type against allowlist
    if (!ALLOWED_EVENT_TYPES.has(eventType)) {
      res.status(400).json({ error: `Invalid event type: ${eventType}` });
      return;
    }

    // Cap metadata size to 2 KB
    const metadataStr = metadata ? JSON.stringify(metadata) : null;
    if (metadataStr && metadataStr.length > 2048) {
      res.status(400).json({ error: 'Metadata too large (max 2 KB)' });
      return;
    }

    await dbRun(`
      INSERT INTO analytics_events (id, event_type, entity_type, entity_id, user_id, session_id, metadata, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      eventType,
      entityType || null,
      entityId || null,
      req.user?.userId || null,
      sessionId || null,
      metadataStr,
      anonymizeIp(req.ip),
      req.headers['user-agent'] || null
    ]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ── POST /api/analytics/pageview ────────────────────────────────────────────
router.post('/pageview', rateLimit('analytics-pageview', 30, 60 * 1000), optionalAuth, async (req: Request, res: Response) => {
  try {
    const { pagePath, pageTitle, sessionId, referrer, durationMs } = req.body;

    await dbRun(`
      INSERT INTO page_views (id, page_path, page_title, user_id, session_id, referrer, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), pagePath, pageTitle || null, req.user?.userId || null, sessionId || null, referrer || null, durationMs || null]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to track page view' });
  }
});

// ── POST /api/analytics/affiliate-click ─────────────────────────────────────
router.post('/affiliate-click', rateLimit('analytics-affiliate', 20, 60 * 1000), optionalAuth, async (req: Request, res: Response) => {
  try {
    const { bookId, source, sessionId } = req.body;

    if (!bookId) {
      res.status(400).json({ error: 'Book ID is required' });
      return;
    }

    await dbRun(`
      INSERT INTO affiliate_clicks (id, book_id, user_id, session_id, source)
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), bookId, req.user?.userId || null, sessionId || null, source || null]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to track affiliate click' });
  }
});

// ── POST /api/analytics/web-vitals — Core Web Vitals tracking ───────────────
router.post('/web-vitals', rateLimit('analytics-vitals', 30, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { name, value, rating, delta, id, navigationType, url } = req.body;

    if (!name || value === undefined) {
      res.status(400).json({ error: 'name and value are required' });
      return;
    }

    // web_vitals table is created in initDatabase() — just insert
    await dbRun(`
      INSERT INTO web_vitals (id, metric_name, metric_value, rating, delta, metric_id, navigation_type, url, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuidv4(), name, value, rating || null, delta || null, id || null, navigationType || null, url || null, req.headers['user-agent'] || null]);

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err.message }, 'Web vitals tracking error');
    res.status(500).json({ error: 'Failed to track web vital' });
  }
});

// ── GET /api/analytics/overview (Admin) ─────────────────────────────────────
// Main dashboard overview stats
router.get('/overview', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const last7 = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0];
    const lastMonth = new Date(now.getTime() - 60 * 86400000).toISOString().split('T')[0];

    // Total counts
    const totalBooks = (await dbGet<any>("SELECT COUNT(*) as c FROM books WHERE status = 'PUBLISHED'", [])).c;
    const totalUsers = (await dbGet<any>('SELECT COUNT(*) as c FROM users', [])).c;
    const totalReviews = (await dbGet<any>('SELECT COUNT(*) as c FROM reviews', [])).c;
    const totalSubscribers = (await dbGet<any>('SELECT COUNT(*) as c FROM newsletter_subscribers WHERE is_active = 1', [])).c;
    const totalCategories = (await dbGet<any>('SELECT COUNT(*) as c FROM categories', [])).c;
    const totalBlogPosts = (await dbGet<any>("SELECT COUNT(*) as c FROM blog_posts WHERE status = 'PUBLISHED'", [])).c;

    // Page views
    const pageViewsToday = (await dbGet<any>(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ?`, [today])).c;
    const pageViews7d = (await dbGet<any>(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ?`, [last7])).c;
    const pageViews30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ?`, [last30])).c;
    const pageViewsPrev30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM page_views WHERE created_at >= ? AND created_at < ?`, [lastMonth, last30])).c;

    // Affiliate clicks
    const affiliateClicks30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM affiliate_clicks WHERE created_at >= ?`, [last30])).c;
    const affiliateClicksPrev30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM affiliate_clicks WHERE created_at >= ? AND created_at < ?`, [lastMonth, last30])).c;

    // New users
    const newUsers30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM users WHERE created_at >= ?`, [last30])).c;
    const newUsersPrev30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM users WHERE created_at >= ? AND created_at < ?`, [lastMonth, last30])).c;

    // New reviews
    const newReviews30d = (await dbGet<any>(`SELECT COUNT(*) as c FROM reviews WHERE created_at >= ?`, [last30])).c;

    res.json({
      totals: {
        books: totalBooks,
        users: totalUsers,
        reviews: totalReviews,
        subscribers: totalSubscribers,
        categories: totalCategories,
        blogPosts: totalBlogPosts,
      },
      pageViews: {
        today: pageViewsToday,
        last7Days: pageViews7d,
        last30Days: pageViews30d,
        changePercent: pageViewsPrev30d > 0 ? Math.round(((pageViews30d - pageViewsPrev30d) / pageViewsPrev30d) * 100) : 0,
      },
      affiliateClicks: {
        last30Days: affiliateClicks30d,
        changePercent: affiliateClicksPrev30d > 0 ? Math.round(((affiliateClicks30d - affiliateClicksPrev30d) / affiliateClicksPrev30d) * 100) : 0,
      },
      newUsers: {
        last30Days: newUsers30d,
        changePercent: newUsersPrev30d > 0 ? Math.round(((newUsers30d - newUsersPrev30d) / newUsersPrev30d) * 100) : 0,
      },
      newReviews: { last30Days: newReviews30d },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Analytics overview error');
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

// ── GET /api/analytics/page-views (Admin) ───────────────────────────────────
// Daily page view counts for chart
router.get('/page-views', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = Math.min(365, Math.max(1, parseInt(days as string, 10)));
    const since = new Date(Date.now() - daysNum * 86400000).toISOString().split('T')[0];

    const data = await dbAll<any>(`
      SELECT DATE(created_at) as date, COUNT(*) as views
      FROM page_views WHERE created_at >= ?
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, [since]);

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch page view data' });
  }
});

// ── GET /api/analytics/top-books (Admin) ────────────────────────────────────
// Most viewed books
router.get('/top-books', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '30', limit = '10' } = req.query;
    const since = new Date(Date.now() - parseInt(days as string, 10) * 86400000).toISOString().split('T')[0];
    const limitNum = Math.min(50, parseInt(limit as string, 10));

    const data = await dbAll<any>(`
      SELECT ae.entity_id as book_id, b.title, b.author, b.cover_image, b.google_rating,
             COUNT(*) as views,
             (SELECT COUNT(*) FROM affiliate_clicks ac WHERE ac.book_id = ae.entity_id AND ac.created_at >= ?) as clicks
      FROM analytics_events ae
      JOIN books b ON b.id = ae.entity_id
      WHERE ae.event_type = 'view' AND ae.entity_type = 'book' AND ae.created_at >= ?
      GROUP BY ae.entity_id
      ORDER BY views DESC
      LIMIT ?
    `, [since, since, limitNum]);

    res.json(data.map(d => ({
      bookId: d.book_id,
      title: d.title,
      author: d.author,
      coverImage: d.cover_image,
      googleRating: d.google_rating,
      views: d.views,
      clicks: d.clicks,
      ctr: d.views > 0 ? Math.round((d.clicks / d.views) * 100 * 10) / 10 : 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch top books' });
  }
});

// ── GET /api/analytics/top-pages (Admin) ────────────────────────────────────
router.get('/top-pages', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '30', limit = '10' } = req.query;
    const since = new Date(Date.now() - parseInt(days as string, 10) * 86400000).toISOString().split('T')[0];

    const data = await dbAll<any>(`
      SELECT page_path, ANY_VALUE(page_title) as page_title, COUNT(*) as views,
             AVG(duration_ms) as avg_duration
      FROM page_views WHERE created_at >= ?
      GROUP BY page_path ORDER BY views DESC
      LIMIT ?
    `, [since, parseInt(limit as string, 10)]);

    res.json(data.map(d => ({
      pagePath: d.page_path,
      pageTitle: d.page_title,
      views: d.views,
      avgDuration: d.avg_duration ? Math.round(d.avg_duration / 1000) : 0,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch top pages' });
  }
});

// ── GET /api/analytics/events-summary (Admin) ───────────────────────────────
router.get('/events-summary', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const since = new Date(Date.now() - parseInt(days as string, 10) * 86400000).toISOString().split('T')[0];

    const data = await dbAll<any>(`
      SELECT event_type, COUNT(*) as count
      FROM analytics_events WHERE created_at >= ?
      GROUP BY event_type ORDER BY count DESC
    `, [since]);

    res.json(data.map(d => ({ eventType: d.event_type, count: d.count })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch events summary' });
  }
});

// ── GET /api/analytics/affiliate-report (Admin) ─────────────────────────────
router.get('/affiliate-report', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { days = '30' } = req.query;
    const since = new Date(Date.now() - parseInt(days as string, 10) * 86400000).toISOString().split('T')[0];

    // Daily clicks
    const daily = await dbAll<any>(`
      SELECT DATE(created_at) as date, COUNT(*) as clicks
      FROM affiliate_clicks WHERE created_at >= ?
      GROUP BY DATE(created_at) ORDER BY date ASC
    `, [since]);

    // Top books by clicks
    const topBooks = await dbAll<any>(`
      SELECT ac.book_id, b.title, b.author, b.price, b.currency, COUNT(*) as clicks
      FROM affiliate_clicks ac
      JOIN books b ON b.id = ac.book_id
      WHERE ac.created_at >= ?
      GROUP BY ac.book_id ORDER BY clicks DESC
      LIMIT 10
    `, [since]);

    // Total clicks and estimated revenue (assume ~5% conversion, ~4% commission avg)
    const totalClicks = daily.reduce((sum: number, d: any) => sum + d.clicks, 0);

    res.json({
      daily,
      topBooks: topBooks.map(b => ({
        bookId: b.book_id,
        title: b.title,
        author: b.author,
        price: b.price,
        currency: b.currency,
        clicks: b.clicks,
        estimatedRevenue: b.price ? Math.round(b.clicks * 0.05 * b.price * 0.04 * 100) / 100 : 0,
      })),
      summary: {
        totalClicks,
        estimatedConversions: Math.round(totalClicks * 0.05),
        estimatedRevenue: Math.round(totalClicks * 0.05 * 15 * 0.04 * 100) / 100, // avg $15 book, 4% commission
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch affiliate report' });
  }
});

// ── GET /api/analytics/google (Admin) ───────────────────────────────────────
// Google Analytics data proxy — returns GA4 data or mock data if GA not configured
router.get('/google', authenticate, requireAdmin, (_req: Request, res: Response) => {
  try {
    // In production, this would call the Google Analytics Data API (GA4)
    // using @google-analytics/data library with service account credentials.
    // For now, return realistic mock data that matches GA4 response format.

    const now = new Date();
    const days30: { date: string; sessions: number; users: number; pageViews: number; bounceRate: number; avgSessionDuration: number }[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dateStr = d.toISOString().split('T')[0];
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      const base = isWeekend ? 45 : 80;

      days30.push({
        date: dateStr,
        sessions: base + Math.floor(Math.random() * 40),
        users: Math.floor((base + Math.random() * 30) * 0.8),
        pageViews: Math.floor((base + Math.random() * 50) * 2.3),
        bounceRate: Math.round((35 + Math.random() * 20) * 10) / 10,
        avgSessionDuration: Math.round((120 + Math.random() * 180) * 10) / 10,
      });
    }

    const totalSessions = days30.reduce((s, d) => s + d.sessions, 0);
    const totalUsers = days30.reduce((s, d) => s + d.users, 0);
    const totalPageViews = days30.reduce((s, d) => s + d.pageViews, 0);

    res.json({
      reporting: {
        dateRange: { start: days30[0].date, end: days30[days30.length - 1].date },
        dailyData: days30,
        summary: {
          totalSessions,
          totalUsers,
          totalPageViews,
          avgBounceRate: Math.round(days30.reduce((s, d) => s + d.bounceRate, 0) / 30 * 10) / 10,
          avgSessionDuration: Math.round(days30.reduce((s, d) => s + d.avgSessionDuration, 0) / 30),
          pagesPerSession: Math.round((totalPageViews / totalSessions) * 10) / 10,
        },
      },
      // Audience demographics
      demographics: {
        countries: [
          { country: 'United States', sessions: Math.floor(totalSessions * 0.42), percentage: 42 },
          { country: 'United Kingdom', sessions: Math.floor(totalSessions * 0.15), percentage: 15 },
          { country: 'India', sessions: Math.floor(totalSessions * 0.12), percentage: 12 },
          { country: 'Canada', sessions: Math.floor(totalSessions * 0.08), percentage: 8 },
          { country: 'Germany', sessions: Math.floor(totalSessions * 0.06), percentage: 6 },
          { country: 'Australia', sessions: Math.floor(totalSessions * 0.05), percentage: 5 },
          { country: 'Other', sessions: Math.floor(totalSessions * 0.12), percentage: 12 },
        ],
        devices: [
          { device: 'Desktop', sessions: Math.floor(totalSessions * 0.55), percentage: 55 },
          { device: 'Mobile', sessions: Math.floor(totalSessions * 0.38), percentage: 38 },
          { device: 'Tablet', sessions: Math.floor(totalSessions * 0.07), percentage: 7 },
        ],
        browsers: [
          { browser: 'Chrome', percentage: 63 },
          { browser: 'Safari', percentage: 19 },
          { browser: 'Firefox', percentage: 8 },
          { browser: 'Edge', percentage: 7 },
          { browser: 'Other', percentage: 3 },
        ],
      },
      // Traffic sources
      trafficSources: [
        { source: 'Organic Search', sessions: Math.floor(totalSessions * 0.45), percentage: 45 },
        { source: 'Direct', sessions: Math.floor(totalSessions * 0.25), percentage: 25 },
        { source: 'Social', sessions: Math.floor(totalSessions * 0.15), percentage: 15 },
        { source: 'Referral', sessions: Math.floor(totalSessions * 0.10), percentage: 10 },
        { source: 'Email', sessions: Math.floor(totalSessions * 0.05), percentage: 5 },
      ],
      // Top pages from GA
      topPages: [
        { page: '/', title: 'Home', pageViews: Math.floor(totalPageViews * 0.3), avgTime: 45 },
        { page: '/books', title: 'Browse Books', pageViews: Math.floor(totalPageViews * 0.2), avgTime: 120 },
        { page: '/categories/fiction', title: 'Fiction', pageViews: Math.floor(totalPageViews * 0.1), avgTime: 90 },
        { page: '/categories/technology', title: 'Technology', pageViews: Math.floor(totalPageViews * 0.08), avgTime: 95 },
        { page: '/blog', title: 'Blog', pageViews: Math.floor(totalPageViews * 0.07), avgTime: 180 },
      ],
      // Real-time (simulated)
      realtime: {
        activeUsers: Math.floor(Math.random() * 15) + 3,
        topActivePages: [
          { page: '/', users: Math.floor(Math.random() * 5) + 1 },
          { page: '/books/atomic-habits', users: Math.floor(Math.random() * 3) + 1 },
          { page: '/categories/self-help', users: Math.floor(Math.random() * 2) + 1 },
        ],
      },
      // GA configuration status
      isConfigured: false,
      measurementId: 'G-XXXXXXXXXX',
      note: 'Using simulated data. Configure GA_MEASUREMENT_ID and GOOGLE_APPLICATION_CREDENTIALS in .env for real Google Analytics data.',
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch Google Analytics data' });
  }
});

export default router;
