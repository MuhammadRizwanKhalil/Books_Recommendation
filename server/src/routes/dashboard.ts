import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, requireAdmin } from '../middleware.js';
import { recalculateAllScores } from '../services/scoring.js';

const router = Router();

// ── GET /api/admin/dashboard ────────────────────────────────────────────────
// Aggregate dashboard stats for the admin panel
router.get('/dashboard', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Book stats by status
    const booksByStatus = await dbAll<any>(`
      SELECT status, COUNT(*) as count FROM books GROUP BY status
    `, []);

    // Recent activity
    const recentBooks = await dbAll<any>(`
      SELECT id, title, author, status, created_at FROM books ORDER BY created_at DESC LIMIT 5
    `, []);

    const recentReviews = await dbAll<any>(`
      SELECT r.id, r.user_name, r.rating, r.content, r.created_at, b.title as book_title
      FROM reviews r LEFT JOIN books b ON b.id = r.book_id
      ORDER BY r.created_at DESC LIMIT 5
    `, []);

    const recentUsers = await dbAll<any>(`
      SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5
    `, []);

    const recentSubscribers = await dbAll<any>(`
      SELECT id, email, name, subscribed_at FROM newsletter_subscribers WHERE is_active = 1
      ORDER BY subscribed_at DESC LIMIT 5
    `, []);

    // Average rating across all books
    const avgRating = (await dbGet<any>('SELECT AVG(google_rating) as avg FROM books WHERE google_rating IS NOT NULL', [])).avg;

    // Top categories by book count
    const topCategories = await dbAll<any>(`
      SELECT c.name, c.slug, c.book_count FROM categories c
      ORDER BY c.book_count DESC LIMIT 5
    `, []);

    res.json({
      booksByStatus: booksByStatus.map(b => ({ status: b.status, count: b.count })),
      averageRating: avgRating ? Math.round(avgRating * 10) / 10 : 0,
      topCategories: topCategories.map(c => ({ name: c.name, slug: c.slug, bookCount: c.book_count })),
      recentActivity: {
        books: recentBooks.map(b => ({
          id: b.id, title: b.title, author: b.author, status: b.status, createdAt: b.created_at,
        })),
        reviews: recentReviews.map(r => ({
          id: r.id, userName: r.user_name, rating: r.rating,
          content: r.content?.substring(0, 100),
          bookTitle: r.book_title,
          createdAt: r.created_at,
        })),
        users: recentUsers.map(u => ({
          id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.created_at,
        })),
        subscribers: recentSubscribers.map(s => ({
          id: s.id, email: s.email, name: s.name, subscribedAt: s.subscribed_at,
        })),
      },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Dashboard error');
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ── GET /api/admin/users ────────────────────────────────────────────────────
router.get('/users', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', role, search } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    const conditions: string[] = [];
    const params: any[] = [];

    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = (await dbGet<any>(`SELECT COUNT(*) as c FROM users ${whereClause}`, params)).c;
    const users = await dbAll<any>(`
      SELECT id, email, name, avatar_url, role, is_active, created_at, updated_at
      FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    // Batch get review and wishlist counts (avoids N+1)
    let reviewCounts: Record<string, number> = {};
    let wishlistCounts: Record<string, number> = {};
    if (users.length > 0) {
      const userIds = users.map(u => u.id);
      const placeholders = userIds.map(() => '?').join(',');
      const reviews = await dbAll<any>(`SELECT user_id, COUNT(*) as c FROM reviews WHERE user_id IN (${placeholders}) GROUP BY user_id`, userIds);
      const wishlists = await dbAll<any>(`SELECT user_id, COUNT(*) as c FROM wishlist WHERE user_id IN (${placeholders}) GROUP BY user_id`, userIds);
      for (const r of reviews) reviewCounts[r.user_id] = r.c;
      for (const w of wishlists) wishlistCounts[w.user_id] = w.c;
    }

    const result = users.map(u => ({
      id: u.id, email: u.email, name: u.name, avatarUrl: u.avatar_url,
      role: u.role, isActive: !!u.is_active,
      reviewCount: reviewCounts[u.id] || 0,
      wishlistCount: wishlistCounts[u.id] || 0,
      createdAt: u.created_at, updatedAt: u.updated_at,
    }));

    res.json({
      users: result,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ── PUT /api/admin/users/:id/role ───────────────────────────────────────────
router.put('/users/:id/role', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      res.status(400).json({ error: 'Invalid role' });
      return;
    }
    await dbRun('UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?', [role, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// ── PUT /api/admin/users/:id/status ─────────────────────────────────────────
router.put('/users/:id/status', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    await dbRun('UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?', [isActive ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// ── GET /api/admin/newsletter ───────────────────────────────────────────────
router.get('/newsletter', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', active } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: any[] = [];
    if (active !== undefined) {
      whereClause = 'WHERE is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    const total = (await dbGet<any>(`SELECT COUNT(*) as c FROM newsletter_subscribers ${whereClause}`, params)).c;
    const subscribers = await dbAll<any>(`
      SELECT * FROM newsletter_subscribers ${whereClause}
      ORDER BY subscribed_at DESC LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      subscribers: subscribers.map(s => ({
        id: s.id, email: s.email, name: s.name,
        isActive: !!s.is_active,
        subscribedAt: s.subscribed_at, unsubscribedAt: s.unsubscribed_at,
      })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// ── POST /api/admin/recalculate-scores ──────────────────────────────────────
// Manually trigger score recalculation for all books
router.post('/recalculate-scores', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const result = await recalculateAllScores();
    res.json({
      success: true,
      updated: result.updated,
      duration: result.duration,
      message: `Recalculated scores for ${result.updated} books in ${result.duration}ms`,
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Score recalculation error');
    res.status(500).json({ error: 'Failed to recalculate scores' });
  }
});

// ── GET /api/admin/enhanced-stats — Extended analytics ──────────────────────
// Reading progress, reading lists, author engagement, growth trends
router.get('/enhanced-stats', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Reading progress stats
    const rpStats = await dbGet<any>(`
      SELECT
        COUNT(*) AS total_progress_entries,
        SUM(CASE WHEN status = 'want-to-read' THEN 1 ELSE 0 END) AS want_to_read,
        SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS currently_reading,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished,
        COUNT(DISTINCT user_id) AS users_tracking,
        COUNT(DISTINCT book_id) AS books_tracked,
        SUM(CASE WHEN status = 'finished' THEN total_pages ELSE current_page END) AS total_pages_read
      FROM reading_progress
    `);

    // Reading lists stats
    const rlStats = await dbGet<any>(`
      SELECT
        COUNT(*) AS total_lists,
        SUM(CASE WHEN is_public = TRUE THEN 1 ELSE 0 END) AS public_lists,
        SUM(book_count) AS total_items,
        COUNT(DISTINCT user_id) AS users_with_lists,
        AVG(book_count) AS avg_books_per_list
      FROM reading_lists
    `);

    // Top authors by engagement (most tracked books)
    const topAuthors = await dbAll<any>(`
      SELECT b.author, COUNT(DISTINCT rp.user_id) AS user_count,
             COUNT(*) AS tracking_count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      GROUP BY b.author
      ORDER BY user_count DESC
      LIMIT 10
    `);

    // Growth: new users last 7 days vs previous 7 days
    const userGrowth = await dbGet<any>(`
      SELECT
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS last_7_days,
        SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS prev_7_days
      FROM users
    `);

    // Daily active events (last 14 days)
    const dailyActivity = await dbAll<any>(`
      SELECT DATE(created_at) AS day, COUNT(*) as events
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).catch(() => []); // analytics_events may not exist yet

    // Most wishlisted books
    const topWishlisted = await dbAll<any>(`
      SELECT b.title, b.slug, b.author, COUNT(*) AS wishlist_count
      FROM wishlist w
      JOIN books b ON b.id = w.book_id
      GROUP BY w.book_id
      ORDER BY wishlist_count DESC
      LIMIT 10
    `);

    res.json({
      readingProgress: {
        totalEntries: rpStats?.total_progress_entries || 0,
        wantToRead: rpStats?.want_to_read || 0,
        currentlyReading: rpStats?.currently_reading || 0,
        finished: rpStats?.finished || 0,
        usersTracking: rpStats?.users_tracking || 0,
        booksTracked: rpStats?.books_tracked || 0,
        totalPagesRead: rpStats?.total_pages_read || 0,
      },
      readingLists: {
        totalLists: rlStats?.total_lists || 0,
        publicLists: rlStats?.public_lists || 0,
        totalItems: rlStats?.total_items || 0,
        usersWithLists: rlStats?.users_with_lists || 0,
        avgBooksPerList: rlStats?.avg_books_per_list ? Math.round(rlStats.avg_books_per_list * 10) / 10 : 0,
      },
      topAuthorsByEngagement: topAuthors.map((a: any) => ({
        author: a.author,
        userCount: a.user_count,
        trackingCount: a.tracking_count,
      })),
      userGrowth: {
        last7Days: userGrowth?.last_7_days || 0,
        prev7Days: userGrowth?.prev_7_days || 0,
        trend: (userGrowth?.last_7_days || 0) - (userGrowth?.prev_7_days || 0),
      },
      dailyActivity: dailyActivity.map((d: any) => ({
        day: d.day,
        events: d.events,
      })),
      topWishlisted: topWishlisted.map((b: any) => ({
        title: b.title,
        slug: b.slug,
        author: b.author,
        wishlistCount: b.wishlist_count,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Enhanced stats error');
    res.status(500).json({ error: 'Failed to fetch enhanced stats' });
  }
});

export default router;
