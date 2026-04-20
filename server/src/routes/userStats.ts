import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, optionalAuth } from '../middleware.js';
import { getLinkedAccounts, unlinkSocialAccount, verifySocialIdentity, upsertSocialAccountForUser } from '../services/socialAuth.js';

const router = Router();

// ── Helper: refresh follow counts for a user ──────────────────────────────────
export async function refreshUserFollowCounts(userId: string): Promise<void> {
  try {
    await dbRun(
      `UPDATE users
       SET follower_count = (SELECT COUNT(*) FROM user_follows WHERE following_id = ?),
           following_count = (SELECT COUNT(*) FROM user_follows WHERE follower_id = ?)
       WHERE id = ?`,
      [userId, userId, userId],
    );
  } catch (err) {
    logger.error({ err, userId }, 'Failed to refresh user follow counts');
  }
}

// ── Helper: refresh reading streak for a user ─────────────────────────────────
export async function refreshStreak(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().substring(0, 10);

    // Get existing streak record
    let streak = await dbGet<any>(
      'SELECT * FROM reading_streaks WHERE user_id = ?',
      [userId]
    );

    if (!streak) {
      // Create new streak record
      const id = uuidv4();
      await dbRun(
        'INSERT INTO reading_streaks (id, user_id, current_streak_days, longest_streak_days, last_reading_date) VALUES (?, ?, 1, 1, ?)',
        [id, userId, today]
      );
      return;
    }

    const lastDate = streak.last_reading_date
      ? new Date(streak.last_reading_date).toISOString().substring(0, 10)
      : null;

    if (lastDate === today) {
      // Already updated today
      return;
    }

    // Check if yesterday was the last reading date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    let newCurrent: number;
    if (lastDate === yesterdayStr) {
      // Continuing streak
      newCurrent = streak.current_streak_days + 1;
    } else {
      // Streak broken, start fresh
      newCurrent = 1;
    }

    const newLongest = Math.max(streak.longest_streak_days, newCurrent);

    await dbRun(
      'UPDATE reading_streaks SET current_streak_days = ?, longest_streak_days = ?, last_reading_date = ? WHERE id = ?',
      [newCurrent, newLongest, today, streak.id]
    );
  } catch (err) {
    logger.error({ err, userId }, 'Failed to refresh reading streak');
  }
}

router.get('/me/linked-accounts', authenticate, async (req: Request, res: Response) => {
  try {
    res.json(await getLinkedAccounts(req.user!.userId));
  } catch (err: any) {
    logger.error({ err }, 'Get linked accounts error');
    res.status(500).json({ error: 'Failed to fetch linked accounts' });
  }
});

router.post('/me/link-account', authenticate, async (req: Request, res: Response) => {
  try {
    const provider = String(req.body.provider || '').trim();
    if (provider !== 'google' && provider !== 'apple') {
      res.status(400).json({ error: 'provider must be google or apple' });
      return;
    }

    const token = provider === 'google' ? req.body.idToken : req.body.identityToken || req.body.idToken;
    const identity = await verifySocialIdentity(provider, String(token || ''));
    if (!identity) {
      res.status(401).json({ error: `Invalid or expired ${provider} token` });
      return;
    }

    const currentUser = await dbGet<any>('SELECT email FROM users WHERE id = ?', [req.user!.userId]);
    if (currentUser?.email && identity.email && currentUser.email.toLowerCase() !== identity.email.toLowerCase()) {
      res.status(409).json({ error: 'This social account email does not match your current account' });
      return;
    }

    await upsertSocialAccountForUser(req.user!.userId, identity);
    res.json({ success: true, ...(await getLinkedAccounts(req.user!.userId)) });
  } catch (err: any) {
    logger.error({ err }, 'Link social account error');
    if (String(err?.message || '').includes('already linked')) {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to link account' });
  }
});

router.delete('/me/linked-accounts/:provider', authenticate, async (req: Request, res: Response) => {
  try {
    const provider = String(req.params.provider || '').trim();
    if (provider !== 'google' && provider !== 'apple') {
      res.status(400).json({ error: 'provider must be google or apple' });
      return;
    }

    const result = await unlinkSocialAccount(req.user!.userId, provider);
    res.json({ ...result, ...(await getLinkedAccounts(req.user!.userId)) });
  } catch (err: any) {
    logger.error({ err }, 'Unlink social account error');
    if (String(err?.message || '').toLowerCase().includes('password')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// ── GET /me/stats — Full reading statistics for current user ─────────────────
router.get('/me/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const yearParam = req.query.year as string;
    const year = yearParam ? parseInt(yearParam) : null;
    const period = year ? String(year) : 'all-time';

    // Build WHERE clause for year filter
    const yearFilter = year ? `AND YEAR(rp.finished_at) = ${parseInt(String(year))}` : '';
    const yearFilterReview = year ? `AND YEAR(rp.finished_at) = ${parseInt(String(year))}` : '';

    // Basic counts
    const basicStats = await dbGet<any>(`
      SELECT
        COUNT(*) AS books_read,
        COALESCE(SUM(COALESCE(b.page_count, 0)), 0) AS pages_read,
        ROUND(AVG(COALESCE(b.page_count, 0)), 0) AS avg_page_count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' ${yearFilter}
    `, [userId]);

    // Average rating from reviews
    const avgRating = await dbGet<any>(`
      SELECT ROUND(AVG(r.rating), 1) AS avg_rating
      FROM reviews r
      JOIN reading_progress rp ON rp.book_id = r.book_id AND rp.user_id = r.user_id
      WHERE r.user_id = ? AND rp.status = 'finished' ${yearFilterReview}
    `, [userId]);

    // Shortest & longest book
    const shortestBook = await dbGet<any>(`
      SELECT b.title, b.page_count, b.slug
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND b.page_count > 0 ${yearFilter}
      ORDER BY b.page_count ASC LIMIT 1
    `, [userId]);

    const longestBook = await dbGet<any>(`
      SELECT b.title, b.page_count, b.slug
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND b.page_count > 0 ${yearFilter}
      ORDER BY b.page_count DESC LIMIT 1
    `, [userId]);

    // Books per month
    const booksPerMonth = await dbAll<any>(`
      SELECT DATE_FORMAT(rp.finished_at, '%Y-%m') AS month, COUNT(*) AS count
      FROM reading_progress rp
      WHERE rp.user_id = ? AND rp.status = 'finished' AND rp.finished_at IS NOT NULL ${yearFilter}
      GROUP BY month
      ORDER BY month ASC
    `, [userId]);

    // Pages per month
    const pagesPerMonth = await dbAll<any>(`
      SELECT DATE_FORMAT(rp.finished_at, '%Y-%m') AS month, COALESCE(SUM(b.page_count), 0) AS pages
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND rp.finished_at IS NOT NULL ${yearFilter}
      GROUP BY month
      ORDER BY month ASC
    `, [userId]);

    // Genre distribution
    const genreDistribution = await dbAll<any>(`
      SELECT c.name AS genre, COUNT(*) AS count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      JOIN book_categories bc ON bc.book_id = b.id
      JOIN categories c ON c.id = bc.category_id
      WHERE rp.user_id = ? AND rp.status = 'finished' ${yearFilter}
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `, [userId]);

    const genreTotal = genreDistribution.reduce((sum: number, g: any) => sum + g.count, 0);

    // Rating distribution
    const ratingDistribution = await dbAll<any>(`
      SELECT FLOOR(r.rating) AS rating, COUNT(*) AS count
      FROM reviews r
      JOIN reading_progress rp ON rp.book_id = r.book_id AND rp.user_id = r.user_id
      WHERE r.user_id = ? AND rp.status = 'finished' ${yearFilterReview}
      GROUP BY FLOOR(r.rating)
      ORDER BY rating DESC
    `, [userId]);

    // Reading streak
    const streak = await dbGet<any>(
      'SELECT current_streak_days, longest_streak_days, last_reading_date FROM reading_streaks WHERE user_id = ?',
      [userId]
    );

    // Top authors
    const topAuthors = await dbAll<any>(`
      SELECT b.author AS name, COUNT(*) AS books_read
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' ${yearFilter}
      GROUP BY b.author
      ORDER BY books_read DESC
      LIMIT 5
    `, [userId]);

    // Reading pace
    const paceStats = await dbAll<any>(`
      SELECT b.title, b.slug,
        DATEDIFF(rp.finished_at, rp.started_at) AS days
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished'
        AND rp.started_at IS NOT NULL AND rp.finished_at IS NOT NULL
        AND rp.finished_at >= rp.started_at
        ${yearFilter}
      ORDER BY days ASC
    `, [userId]);

    let readingPace: any = {
      averageDaysPerBook: 0,
      fastestBook: null,
      slowestBook: null,
    };

    if (paceStats.length > 0) {
      const totalDays = paceStats.reduce((sum: number, r: any) => sum + (r.days || 0), 0);
      readingPace = {
        averageDaysPerBook: Math.round((totalDays / paceStats.length) * 10) / 10,
        fastestBook: paceStats[0] ? { title: paceStats[0].title, slug: paceStats[0].slug, days: paceStats[0].days } : null,
        slowestBook: paceStats[paceStats.length - 1] ? { title: paceStats[paceStats.length - 1].title, slug: paceStats[paceStats.length - 1].slug, days: paceStats[paceStats.length - 1].days } : null,
      };
    }

    res.json({
      period,
      booksRead: basicStats?.books_read ?? 0,
      pagesRead: basicStats?.pages_read ?? 0,
      averageRating: avgRating?.avg_rating ? parseFloat(avgRating.avg_rating) : 0,
      averagePageCount: basicStats?.avg_page_count ?? 0,
      shortestBook: shortestBook ? { title: shortestBook.title, pageCount: shortestBook.page_count, slug: shortestBook.slug } : null,
      longestBook: longestBook ? { title: longestBook.title, pageCount: longestBook.page_count, slug: longestBook.slug } : null,
      booksPerMonth: booksPerMonth.map((r: any) => ({ month: r.month, count: r.count })),
      pagesPerMonth: pagesPerMonth.map((r: any) => ({ month: r.month, pages: r.pages })),
      genreDistribution: genreDistribution.map((g: any) => ({
        genre: g.genre,
        count: g.count,
        percentage: genreTotal > 0 ? Math.round((g.count / genreTotal) * 100) : 0,
      })),
      ratingDistribution: ratingDistribution.map((r: any) => ({
        rating: r.rating,
        count: r.count,
      })),
      streak: {
        currentDays: streak?.current_streak_days ?? 0,
        longestDays: streak?.longest_streak_days ?? 0,
        lastReadingDate: streak?.last_reading_date ? new Date(streak.last_reading_date).toISOString().substring(0, 10) : null,
      },
      topAuthors: topAuthors.map((a: any) => ({
        name: a.name,
        booksRead: a.books_read,
      })),
      readingPace,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get reading stats error');
    res.status(500).json({ error: 'Failed to fetch reading statistics' });
  }
});

// ── GET /:id/stats/public — Public stats (limited fields) ───────────────────
router.get('/:id/stats/public', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const yearParam = req.query.year as string;
    const year = yearParam ? parseInt(yearParam) : null;
    const period = year ? String(year) : 'all-time';

    // Verify user exists
    const user = await dbGet<any>('SELECT id, name FROM users WHERE id = ?', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const yearFilter = year ? `AND YEAR(rp.finished_at) = ${parseInt(String(year))}` : '';

    const basicStats = await dbGet<any>(`
      SELECT
        COUNT(*) AS books_read,
        COALESCE(SUM(COALESCE(b.page_count, 0)), 0) AS pages_read
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' ${yearFilter}
    `, [id]);

    const genreDistribution = await dbAll<any>(`
      SELECT c.name AS genre, COUNT(*) AS count
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      JOIN book_categories bc ON bc.book_id = b.id
      JOIN categories c ON c.id = bc.category_id
      WHERE rp.user_id = ? AND rp.status = 'finished' ${yearFilter}
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `, [id]);

    const genreTotal = genreDistribution.reduce((sum: number, g: any) => sum + g.count, 0);

    const streak = await dbGet<any>(
      'SELECT current_streak_days, longest_streak_days FROM reading_streaks WHERE user_id = ?',
      [id]
    );

    res.json({
      userName: user.name,
      period,
      booksRead: basicStats?.books_read ?? 0,
      pagesRead: basicStats?.pages_read ?? 0,
      genreDistribution: genreDistribution.map((g: any) => ({
        genre: g.genre,
        count: g.count,
        percentage: genreTotal > 0 ? Math.round((g.count / genreTotal) * 100) : 0,
      })),
      streak: {
        currentDays: streak?.current_streak_days ?? 0,
        longestDays: streak?.longest_streak_days ?? 0,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Get public reading stats error');
    res.status(500).json({ error: 'Failed to fetch public reading statistics' });
  }
});

// ── POST /api/users/:id/follow — Follow a user ───────────────────────────────
router.post('/:id/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user!.userId;

    if (targetUserId === currentUserId) {
      res.status(400).json({ error: 'You cannot follow yourself' });
      return;
    }

    const targetUser = await dbGet<any>('SELECT id FROM users WHERE id = ? AND is_active = 1', [targetUserId]);
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await dbRun(
      'INSERT IGNORE INTO user_follows (id, follower_id, following_id) VALUES (?, ?, ?)',
      [uuidv4(), currentUserId, targetUserId],
    );

    await Promise.all([
      refreshUserFollowCounts(currentUserId),
      refreshUserFollowCounts(targetUserId),
    ]);

    const count = await dbGet<any>('SELECT follower_count FROM users WHERE id = ?', [targetUserId]);
    res.json({ following: true, followerCount: Number(count?.follower_count || 0) });
  } catch (err: any) {
    logger.error({ err }, 'Follow user error');
    res.status(500).json({ error: 'Failed to follow user' });
  }
});

// ── DELETE /api/users/:id/follow — Unfollow a user ──────────────────────────
router.delete('/:id/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user!.userId;

    await dbRun('DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?', [currentUserId, targetUserId]);

    await Promise.all([
      refreshUserFollowCounts(currentUserId),
      refreshUserFollowCounts(targetUserId),
    ]);

    const count = await dbGet<any>('SELECT follower_count FROM users WHERE id = ?', [targetUserId]);
    res.json({ following: false, followerCount: Number(count?.follower_count || 0) });
  } catch (err: any) {
    logger.error({ err }, 'Unfollow user error');
    res.status(500).json({ error: 'Failed to unfollow user' });
  }
});

// ── GET /api/users/:id/followers — Get followers list ───────────────────────
router.get('/:id/followers', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const totalRow = await dbGet<any>('SELECT COUNT(*) AS total FROM user_follows WHERE following_id = ?', [id]);
    const users = await dbAll<any>(
      `SELECT u.id, u.name, u.avatar_url, u.created_at, u.follower_count, u.following_count,
              (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id AND r.is_approved = 1) AS review_count,
              ${req.user ? '(SELECT COUNT(*) FROM user_follows uf2 WHERE uf2.follower_id = ? AND uf2.following_id = u.id)' : '0'} AS is_following
       FROM user_follows uf
       JOIN users u ON u.id = uf.follower_id
       WHERE uf.following_id = ?
       ORDER BY uf.created_at DESC
       LIMIT ? OFFSET ?`,
      req.user ? [req.user.userId, id, limit, offset] : [id, limit, offset],
    );

    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        followerCount: Number(user.follower_count || 0),
        followingCount: Number(user.following_count || 0),
        reviewCount: Number(user.review_count || 0),
        isFollowing: !!user.is_following,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalRow?.total || 0),
        totalPages: Math.ceil(Number(totalRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Get followers error');
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// ── GET /api/users/:id/following — Get following list ───────────────────────
router.get('/:id/following', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    const totalRow = await dbGet<any>('SELECT COUNT(*) AS total FROM user_follows WHERE follower_id = ?', [id]);
    const users = await dbAll<any>(
      `SELECT u.id, u.name, u.avatar_url, u.created_at, u.follower_count, u.following_count,
              (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id AND r.is_approved = 1) AS review_count,
              ${req.user ? '(SELECT COUNT(*) FROM user_follows uf2 WHERE uf2.follower_id = ? AND uf2.following_id = u.id)' : '0'} AS is_following
       FROM user_follows uf
       JOIN users u ON u.id = uf.following_id
       WHERE uf.follower_id = ?
       ORDER BY uf.created_at DESC
       LIMIT ? OFFSET ?`,
      req.user ? [req.user.userId, id, limit, offset] : [id, limit, offset],
    );

    res.json({
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
        followerCount: Number(user.follower_count || 0),
        followingCount: Number(user.following_count || 0),
        reviewCount: Number(user.review_count || 0),
        isFollowing: !!user.is_following,
      })),
      pagination: {
        page,
        limit,
        total: Number(totalRow?.total || 0),
        totalPages: Math.ceil(Number(totalRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Get following error');
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// ── GET /api/users/:id — Public user profile ────────────────────────────────
router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await dbGet<any>(
      `SELECT u.id, u.name, u.avatar_url, u.created_at, u.follower_count, u.following_count,
              (SELECT COUNT(*) FROM reviews r WHERE r.user_id = u.id AND r.is_approved = 1) AS review_count,
              (SELECT COUNT(*) FROM reading_progress rp WHERE rp.user_id = u.id AND rp.status = 'finished') AS books_read,
              ${req.user ? '(SELECT COUNT(*) FROM user_follows uf WHERE uf.follower_id = ? AND uf.following_id = u.id)' : '0'} AS is_following
       FROM users u
       WHERE u.id = ? AND u.is_active = 1
       LIMIT 1`,
      req.user ? [req.user.userId, id] : [id],
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      reviewCount: Number(user.review_count || 0),
      booksRead: Number(user.books_read || 0),
      followerCount: Number(user.follower_count || 0),
      followingCount: Number(user.following_count || 0),
      isFollowing: !!user.is_following,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get public user profile error');
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

export default router;
