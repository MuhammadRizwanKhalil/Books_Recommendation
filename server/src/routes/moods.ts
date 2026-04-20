import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { sanitizeString } from '../lib/sanitize.js';

const router = Router();

// ── GET /api/moods — List all moods (public) ────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const moods = await dbAll<any>(
      'SELECT id, name, slug, emoji, color, display_order FROM mood_taxonomy ORDER BY display_order ASC',
      []
    );
    res.json(moods.map(m => ({
      id: m.id,
      name: m.name,
      slug: m.slug,
      emoji: m.emoji,
      color: m.color,
    })));
  } catch (err: any) {
    logger.error({ err }, 'List moods error');
    res.status(500).json({ error: 'Failed to fetch moods' });
  }
});

// ── GET /api/moods/books/:bookId — Get mood votes for a book ────────────────
router.get('/books/:bookId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const userId = req.user?.userId || null;

    // Get total unique voters for this book
    const totalRow = await dbGet<any>(
      'SELECT COUNT(DISTINCT user_id) as totalVoters FROM book_mood_votes WHERE book_id = ?',
      [bookId]
    );
    const totalVoters = totalRow?.totalVoters || 0;

    // Get vote counts per mood
    const moodVotes = await dbAll<any>(
      `SELECT mt.id, mt.name, mt.slug, mt.emoji, mt.color,
              COUNT(bmv.id) as votes
       FROM mood_taxonomy mt
       LEFT JOIN book_mood_votes bmv ON bmv.mood_id = mt.id AND bmv.book_id = ?
       GROUP BY mt.id, mt.name, mt.slug, mt.emoji, mt.color, mt.display_order
       HAVING votes > 0
       ORDER BY votes DESC, mt.display_order ASC`,
      [bookId]
    );

    // Get user's own votes if authenticated
    let userVotes: Set<string> = new Set();
    if (userId) {
      const userMoodVotes = await dbAll<any>(
        'SELECT mood_id FROM book_mood_votes WHERE book_id = ? AND user_id = ?',
        [bookId, userId]
      );
      userVotes = new Set(userMoodVotes.map((v: any) => v.mood_id));
    }

    // Calculate total votes (sum of all mood votes, not unique voters)
    const totalVotes = moodVotes.reduce((sum: number, m: any) => sum + (m.votes || 0), 0);

    res.json({
      totalVotes,
      totalVoters,
      moods: moodVotes.map((m: any) => ({
        id: m.id,
        name: m.name,
        slug: m.slug,
        emoji: m.emoji,
        color: m.color,
        votes: m.votes,
        percentage: totalVotes > 0 ? Math.round((m.votes / totalVotes) * 100) : 0,
        userVoted: userVotes.has(m.id),
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get book moods error');
    res.status(500).json({ error: 'Failed to fetch book moods' });
  }
});

// ── POST /api/moods/books/:bookId/vote — Vote on moods for a book ───────────
router.post(
  '/books/:bookId/vote',
  authenticate,
  rateLimit('mood-vote', 30, 15 * 60 * 1000), // 30 votes per 15 minutes
  async (req: Request, res: Response) => {
    try {
      const { bookId } = req.params;
      const userId = req.user!.userId;
      const { moodIds } = req.body;

      // Validate input
      if (!Array.isArray(moodIds) || moodIds.length === 0) {
        res.status(400).json({ error: 'moodIds must be a non-empty array' });
        return;
      }
      if (moodIds.length > 5) {
        res.status(400).json({ error: 'Maximum 5 moods per book per user' });
        return;
      }

      // Sanitize each mood ID
      const sanitizedIds = moodIds.map((id: string) => sanitizeString(String(id)));

      // Verify book exists
      const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      // Verify all mood IDs exist
      const placeholders = sanitizedIds.map(() => '?').join(',');
      const validMoods = await dbAll<any>(
        `SELECT id FROM mood_taxonomy WHERE id IN (${placeholders})`,
        sanitizedIds
      );
      if (validMoods.length !== sanitizedIds.length) {
        res.status(400).json({ error: 'One or more invalid mood IDs' });
        return;
      }

      // Remove existing votes for this user + book
      await dbRun(
        'DELETE FROM book_mood_votes WHERE book_id = ? AND user_id = ?',
        [bookId, userId]
      );

      // Insert new votes
      for (const moodId of sanitizedIds) {
        await dbRun(
          'INSERT INTO book_mood_votes (id, book_id, mood_id, user_id) VALUES (?, ?, ?, ?)',
          [uuidv4(), bookId, moodId, userId]
        );
      }

      // Return updated moods for this book
      const totalRow = await dbGet<any>(
        'SELECT COUNT(DISTINCT user_id) as totalVoters FROM book_mood_votes WHERE book_id = ?',
        [bookId]
      );
      const totalVoters = totalRow?.totalVoters || 0;

      const moodVotes = await dbAll<any>(
        `SELECT mt.id, mt.name, mt.slug, mt.emoji, mt.color,
                COUNT(bmv.id) as votes
         FROM mood_taxonomy mt
         LEFT JOIN book_mood_votes bmv ON bmv.mood_id = mt.id AND bmv.book_id = ?
         GROUP BY mt.id, mt.name, mt.slug, mt.emoji, mt.color, mt.display_order
         HAVING votes > 0
         ORDER BY votes DESC, mt.display_order ASC`,
        [bookId]
      );

      const totalVotes = moodVotes.reduce((sum: number, m: any) => sum + (m.votes || 0), 0);

      res.json({
        message: 'Mood votes updated',
        totalVotes,
        totalVoters,
        moods: moodVotes.map((m: any) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          emoji: m.emoji,
          color: m.color,
          votes: m.votes,
          percentage: totalVotes > 0 ? Math.round((m.votes / totalVotes) * 100) : 0,
          userVoted: sanitizedIds.includes(m.id),
        })),
      });
    } catch (err: any) {
      logger.error({ err }, 'Vote on moods error');
      res.status(500).json({ error: 'Failed to submit mood votes' });
    }
  }
);

// ── DELETE /api/moods/books/:bookId/vote/:moodId — Remove a single mood vote ─
router.delete(
  '/books/:bookId/vote/:moodId',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { bookId, moodId } = req.params;
      const userId = req.user!.userId;

      const existing = await dbGet<any>(
        'SELECT id FROM book_mood_votes WHERE book_id = ? AND mood_id = ? AND user_id = ?',
        [bookId, moodId, userId]
      );
      if (!existing) {
        res.status(404).json({ error: 'Vote not found' });
        return;
      }

      await dbRun(
        'DELETE FROM book_mood_votes WHERE book_id = ? AND mood_id = ? AND user_id = ?',
        [bookId, moodId, userId]
      );

      res.json({ message: 'Mood vote removed' });
    } catch (err: any) {
      logger.error({ err }, 'Remove mood vote error');
      res.status(500).json({ error: 'Failed to remove mood vote' });
    }
  }
);

// ── GET /api/moods/discover/:slug — Discover books by mood ──────────────────
router.get('/discover/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    // Verify mood exists
    const mood = await dbGet<any>(
      'SELECT id, name, slug, emoji, color FROM mood_taxonomy WHERE slug = ?',
      [slug]
    );
    if (!mood) {
      res.status(404).json({ error: 'Mood not found' });
      return;
    }

    // Count total books with this mood
    const countRow = await dbGet<any>(
      `SELECT COUNT(DISTINCT bmv.book_id) as total
       FROM book_mood_votes bmv
       INNER JOIN books b ON b.id = bmv.book_id AND b.status = 'PUBLISHED'
       WHERE bmv.mood_id = ?`,
      [mood.id]
    );
    const total = countRow?.total || 0;

    // Get books sorted by vote count for this mood
    const books = await dbAll<any>(
      `SELECT b.id, b.title, b.slug, b.author, b.cover_image, b.google_rating,
              b.computed_score, b.page_count, b.published_date, b.description,
              COUNT(bmv.id) as moodVotes
       FROM books b
       INNER JOIN book_mood_votes bmv ON bmv.book_id = b.id AND bmv.mood_id = ?
       WHERE b.status = 'PUBLISHED'
       GROUP BY b.id
       ORDER BY moodVotes DESC, b.computed_score DESC
       LIMIT ? OFFSET ?`,
      [mood.id, limit, offset]
    );

    res.json({
      mood: {
        id: mood.id,
        name: mood.name,
        slug: mood.slug,
        emoji: mood.emoji,
        color: mood.color,
      },
      books: books.map((b: any) => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        author: b.author,
        coverImage: b.cover_image,
        googleRating: b.google_rating,
        computedScore: b.computed_score,
        pageCount: b.page_count,
        publishedDate: b.published_date,
        description: b.description,
        moodVotes: b.moodVotes,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Discover by mood error');
    res.status(500).json({ error: 'Failed to discover books by mood' });
  }
});

export default router;
