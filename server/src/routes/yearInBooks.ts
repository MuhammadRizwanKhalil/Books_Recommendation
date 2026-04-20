import { Router, Request, Response } from 'express';
import sharp from 'sharp';
import { dbAll, dbGet } from '../database.js';
import { authenticate, optionalAuth } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface YearInBooksPayload {
  year: number;
  totalBooks: number;
  totalPages: number;
  averageRating: number;
  genreBreakdown: { genre: string; count: number }[];
  shortestBook: { title: string; pages: number; slug?: string } | null;
  longestBook: { title: string; pages: number; slug?: string } | null;
  monthlyBreakdown: { month: string; booksRead: number }[];
  topRatedBooks: { title: string; slug: string; rating: number; coverImage?: string | null }[];
  readingStreak: { longest: number; current: number };
  shareImageUrl: string;
}

function parseYear(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < 1900 || parsed > 2100) return null;
  return parsed;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function resolveTargetUserId(req: Request, res: Response): Promise<string | null> {
  const id = String(req.params.id || '').trim();
  if (id !== 'me') return id;

  if (!req.user?.userId) {
    res.status(401).json({ error: 'Authentication required for me endpoint' });
    return null;
  }

  return req.user.userId;
}

async function ensureProfileVisible(userId: string, res: Response): Promise<{ id: string; name: string } | null> {
  const user = await dbGet<any>('SELECT id, name, is_active FROM users WHERE id = ? LIMIT 1', [userId]);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return null;
  }

  // We treat deactivated accounts as non-public for recap endpoints.
  if (!user.is_active) {
    res.status(403).json({ error: 'This profile is private' });
    return null;
  }

  return { id: user.id, name: user.name };
}

async function buildYearInBooks(userId: string, year: number): Promise<YearInBooksPayload> {
  const params = [userId, year];

  const totals = await dbGet<any>(
    `SELECT COUNT(*) AS total_books,
            COALESCE(SUM(COALESCE(b.page_count, 0)), 0) AS total_pages
     FROM reading_progress rp
     JOIN books b ON b.id = rp.book_id
     WHERE rp.user_id = ?
       AND rp.status = 'finished'
       AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?`,
    params,
  );

  const avgRating = await dbGet<any>(
    `SELECT ROUND(AVG(t.rating), 1) AS average_rating
     FROM (
       SELECT COALESCE(r.rating, rp.personal_rating) AS rating
       FROM reading_progress rp
       LEFT JOIN reviews r ON r.user_id = rp.user_id AND r.book_id = rp.book_id
       WHERE rp.user_id = ?
         AND rp.status = 'finished'
         AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
         AND COALESCE(r.rating, rp.personal_rating) IS NOT NULL
     ) t`,
    params,
  );

  const shortestBook = await dbGet<any>(
    `SELECT b.title, b.slug, b.page_count
     FROM reading_progress rp
     JOIN books b ON b.id = rp.book_id
     WHERE rp.user_id = ?
       AND rp.status = 'finished'
       AND b.page_count IS NOT NULL
       AND b.page_count > 0
       AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
     ORDER BY b.page_count ASC, b.title ASC
     LIMIT 1`,
    params,
  );

  const longestBook = await dbGet<any>(
    `SELECT b.title, b.slug, b.page_count
     FROM reading_progress rp
     JOIN books b ON b.id = rp.book_id
     WHERE rp.user_id = ?
       AND rp.status = 'finished'
       AND b.page_count IS NOT NULL
       AND b.page_count > 0
       AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
     ORDER BY b.page_count DESC, b.title ASC
     LIMIT 1`,
    params,
  );

  const genreBreakdown = await dbAll<any>(
    `SELECT t.genre, COUNT(*) AS count
     FROM (
       SELECT rp.book_id, COALESCE(MIN(c.name), 'Uncategorized') AS genre
       FROM reading_progress rp
       LEFT JOIN book_categories bc ON bc.book_id = rp.book_id
       LEFT JOIN categories c ON c.id = bc.category_id
       WHERE rp.user_id = ?
         AND rp.status = 'finished'
         AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
       GROUP BY rp.book_id
     ) t
     GROUP BY t.genre
     ORDER BY count DESC, t.genre ASC`,
    params,
  );

  const monthRows = await dbAll<any>(
    `SELECT MONTH(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) AS month_number,
            COUNT(*) AS books_read
     FROM reading_progress rp
     WHERE rp.user_id = ?
       AND rp.status = 'finished'
       AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
     GROUP BY month_number`,
    params,
  );

  const byMonth = new Map<number, number>();
  monthRows.forEach((row) => byMonth.set(Number(row.month_number), Number(row.books_read || 0)));
  const monthlyBreakdown = MONTH_LABELS.map((month, index) => ({
    month,
    booksRead: byMonth.get(index + 1) || 0,
  }));

  const topRatedBooks = await dbAll<any>(
    `SELECT b.title, b.slug, b.cover_image, COALESCE(r.rating, rp.personal_rating) AS rating,
            COALESCE(r.created_at, rp.updated_at, rp.created_at) AS rated_at
     FROM reading_progress rp
     JOIN books b ON b.id = rp.book_id
     LEFT JOIN reviews r ON r.user_id = rp.user_id AND r.book_id = rp.book_id
     WHERE rp.user_id = ?
       AND rp.status = 'finished'
       AND YEAR(COALESCE(rp.finished_at, rp.updated_at, rp.created_at)) = ?
       AND COALESCE(r.rating, rp.personal_rating) IS NOT NULL
     ORDER BY rating DESC, rated_at DESC
     LIMIT 5`,
    params,
  );

  const streak = await dbGet<any>(
    'SELECT current_streak_days, longest_streak_days FROM reading_streaks WHERE user_id = ? LIMIT 1',
    [userId],
  );

  return {
    year,
    totalBooks: Number(totals?.total_books || 0),
    totalPages: Number(totals?.total_pages || 0),
    averageRating: Number(avgRating?.average_rating || 0),
    genreBreakdown: genreBreakdown.map((row) => ({
      genre: String(row.genre),
      count: Number(row.count || 0),
    })),
    shortestBook: shortestBook
      ? { title: shortestBook.title, pages: Number(shortestBook.page_count || 0), slug: shortestBook.slug || undefined }
      : null,
    longestBook: longestBook
      ? { title: longestBook.title, pages: Number(longestBook.page_count || 0), slug: longestBook.slug || undefined }
      : null,
    monthlyBreakdown,
    topRatedBooks: topRatedBooks.map((row) => ({
      title: String(row.title),
      slug: String(row.slug),
      rating: Number(row.rating || 0),
      coverImage: row.cover_image || null,
    })),
    readingStreak: {
      longest: Number(streak?.longest_streak_days || 0),
      current: Number(streak?.current_streak_days || 0),
    },
    shareImageUrl: `/api/users/${userId}/year-in-books/${year}/share-image`,
  };
}

router.get('/:id/year-in-books/:year', optionalAuth, async (req: Request, res: Response) => {
  try {
    const year = parseYear(String(req.params.year || ''));
    if (year === null) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }

    const userId = await resolveTargetUserId(req, res);
    if (!userId) return;

    const user = await ensureProfileVisible(userId, res);
    if (!user) return;

    const payload = await buildYearInBooks(user.id, year);
    res.json(payload);
  } catch (err: any) {
    logger.error({ err }, 'Get year in books error');
    res.status(500).json({ error: 'Failed to fetch year in books data' });
  }
});

router.get('/:id/year-in-books/:year/share-image', optionalAuth, async (req: Request, res: Response) => {
  try {
    const year = parseYear(String(req.params.year || ''));
    if (year === null) {
      res.status(400).json({ error: 'Invalid year parameter' });
      return;
    }

    const userId = await resolveTargetUserId(req, res);
    if (!userId) return;

    const user = await ensureProfileVisible(userId, res);
    if (!user) return;

    const recap = await buildYearInBooks(user.id, year);

    const topGenre = recap.genreBreakdown[0]?.genre || 'No genre data yet';
    const favoriteTitle = recap.topRatedBooks[0]?.title || 'Add ratings to unlock favorites';
    const safeUser = escapeXml(user.name);
    const safeFavorite = escapeXml(favoriteTitle.length > 42 ? `${favoriteTitle.slice(0, 39)}...` : favoriteTitle);
    const safeGenre = escapeXml(topGenre.length > 24 ? `${topGenre.slice(0, 21)}...` : topGenre);

    const svg = `
      <svg width="1200" height="628" viewBox="0 0 1200 628" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#0f172a" />
            <stop offset="50%" stop-color="#1e293b" />
            <stop offset="100%" stop-color="#334155" />
          </linearGradient>
        </defs>
        <rect width="1200" height="628" fill="url(#bg)" />
        <text x="70" y="92" fill="#f8fafc" font-family="Georgia, serif" font-size="48" font-weight="700">Year in Books ${year}</text>
        <text x="70" y="136" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="28">${safeUser}'s reading recap</text>

        <rect x="70" y="186" width="250" height="155" rx="18" fill="#0ea5e933" stroke="#38bdf8" />
        <text x="95" y="240" fill="#e0f2fe" font-family="Arial, sans-serif" font-size="24">Books Read</text>
        <text x="95" y="300" fill="#f0f9ff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${recap.totalBooks}</text>

        <rect x="350" y="186" width="250" height="155" rx="18" fill="#22c55e33" stroke="#4ade80" />
        <text x="375" y="240" fill="#dcfce7" font-family="Arial, sans-serif" font-size="24">Pages Read</text>
        <text x="375" y="300" fill="#f0fdf4" font-family="Arial, sans-serif" font-size="56" font-weight="700">${recap.totalPages}</text>

        <rect x="630" y="186" width="250" height="155" rx="18" fill="#f59e0b33" stroke="#fbbf24" />
        <text x="655" y="240" fill="#fef3c7" font-family="Arial, sans-serif" font-size="24">Avg Rating</text>
        <text x="655" y="300" fill="#fffbeb" font-family="Arial, sans-serif" font-size="56" font-weight="700">${recap.averageRating.toFixed(1)}</text>

        <rect x="910" y="186" width="220" height="155" rx="18" fill="#a855f733" stroke="#c084fc" />
        <text x="935" y="240" fill="#f3e8ff" font-family="Arial, sans-serif" font-size="24">Longest Streak</text>
        <text x="935" y="300" fill="#faf5ff" font-family="Arial, sans-serif" font-size="56" font-weight="700">${recap.readingStreak.longest}</text>

        <text x="70" y="412" fill="#f8fafc" font-family="Arial, sans-serif" font-size="30" font-weight="700">Top Genre: ${safeGenre}</text>
        <text x="70" y="472" fill="#f8fafc" font-family="Arial, sans-serif" font-size="30" font-weight="700">Favorite Rated: ${safeFavorite}</text>

        <text x="70" y="560" fill="#94a3b8" font-family="Arial, sans-serif" font-size="24">thebooktimes.com/year-in-books/${year}</text>
      </svg>
    `.trim();

    const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.send(imageBuffer);
  } catch (err: any) {
    logger.error({ err }, 'Generate year in books share image error');
    res.status(500).json({ error: 'Failed to generate share image' });
  }
});

export default router;
