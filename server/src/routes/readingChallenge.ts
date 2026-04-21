import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, optionalAuth } from '../middleware.js';
import { rateLimit } from '../middleware.js';
import { recordUserActivity } from '../services/activityFeed.js';

const router = Router();

// ── Helper: refresh cached books_completed for a user's current-year challenge ─
export async function refreshChallengeCount(userId: string): Promise<void> {
  try {
    const year = new Date().getFullYear();
    const challenge = await dbGet<any>(
      'SELECT id FROM reading_challenges WHERE user_id = ? AND year = ?',
      [userId, year]
    );
    if (!challenge) return;

    const row = await dbGet<any>(`
      SELECT COUNT(*) AS cnt
      FROM reading_progress
      WHERE user_id = ? AND status = 'finished'
        AND YEAR(finished_at) = ?
    `, [userId, year]);

    await dbRun(
      'UPDATE reading_challenges SET books_completed = ? WHERE id = ?',
      [row?.cnt ?? 0, challenge.id]
    );
  } catch (err) {
    logger.error({ err, userId }, 'Failed to refresh challenge count');
  }
}

// ── Helper: compute challenge response ────────────────────────────────────────
function computeChallenge(row: any, recentBooks: any[] = []) {
  const year = row.year;
  const goalBooks = row.goal_books;
  const booksCompleted = row.books_completed;
  const percentComplete = goalBooks > 0 ? Math.round((booksCompleted / goalBooks) * 100) : 0;

  // On-track calculation: how many books should be done by today
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31);
  const totalDays = (endOfYear.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24) + 1;
  const daysPassed = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  const expectedBooks = Math.round((daysPassed / totalDays) * goalBooks);
  const booksAhead = booksCompleted - expectedBooks;
  const projectedTotal = goalBooks > 0
    ? Math.round((booksCompleted / daysPassed) * totalDays)
    : 0;
  const onTrack = booksCompleted >= expectedBooks;

  return {
    id: row.id,
    year,
    goalBooks,
    booksCompleted,
    percentComplete,
    onTrack,
    booksAhead,
    projectedTotal,
    startedAt: row.started_at,
    updatedAt: row.updated_at,
    recentBooks: recentBooks.map(b => ({
      id: b.id,
      title: b.title,
      slug: b.slug,
      coverImage: b.cover_image || null,
      finishedAt: b.finished_at,
    })),
  };
}

// ── GET / — Get current user's challenge for a year ──────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const challenge = await dbGet<any>(
      'SELECT * FROM reading_challenges WHERE user_id = ? AND year = ?',
      [req.user!.userId, year]
    );

    if (!challenge) {
      res.json(null);
      return;
    }

    // Fetch recent finished books for this year
    const recentBooks = await dbAll<any>(`
      SELECT b.id, b.title, b.slug, b.cover_image, rp.finished_at
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND YEAR(rp.finished_at) = ?
      ORDER BY rp.finished_at DESC
      LIMIT 20
    `, [req.user!.userId, year]);

    res.json(computeChallenge(challenge, recentBooks));
  } catch (err: any) {
    logger.error({ err }, 'Get reading challenge error');
    res.status(500).json({ error: 'Failed to fetch reading challenge' });
  }
});

// ── POST / — Create a new challenge ─────────────────────────────────────────
router.post('/', authenticate, rateLimit('create-challenge', 10, 900000), async (req: Request, res: Response) => {
  try {
    const { year, goalBooks } = req.body;

    const effectiveYear = parseInt(year) || new Date().getFullYear();
    const goal = parseInt(goalBooks);

    if (!goal || goal < 1 || goal > 999) {
      res.status(400).json({ error: 'goalBooks must be between 1 and 999' });
      return;
    }

    // Check for existing challenge
    const existing = await dbGet<any>(
      'SELECT id FROM reading_challenges WHERE user_id = ? AND year = ?',
      [req.user!.userId, effectiveYear]
    );
    if (existing) {
      res.status(409).json({ error: 'A reading challenge already exists for this year' });
      return;
    }

    // Count already-finished books for this year
    const countRow = await dbGet<any>(`
      SELECT COUNT(*) AS cnt FROM reading_progress
      WHERE user_id = ? AND status = 'finished' AND YEAR(finished_at) = ?
    `, [req.user!.userId, effectiveYear]);

    const id = uuidv4();
    await dbRun(`
      INSERT INTO reading_challenges (id, user_id, year, goal_books, books_completed)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.user!.userId, effectiveYear, goal, countRow?.cnt ?? 0]);

    const created = await dbGet<any>('SELECT * FROM reading_challenges WHERE id = ?', [id]);

    res.status(201).json(computeChallenge(created));

    setImmediate(() => {
      recordUserActivity({
        userId: req.user!.userId,
        type: 'challenge_set',
        referenceId: id,
        metadata: {
          year: effectiveYear,
          goalBooks: goal,
        },
      }).catch(() => undefined);
    });
  } catch (err: any) {
    logger.error({ err }, 'Create reading challenge error');
    res.status(500).json({ error: 'Failed to create reading challenge' });
  }
});

// ── PUT /:id — Update challenge goal ────────────────────────────────────────
router.put('/:id', authenticate, rateLimit('update-challenge', 20, 900000), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { goalBooks } = req.body;

    const goal = parseInt(goalBooks);
    if (!goal || goal < 1 || goal > 999) {
      res.status(400).json({ error: 'goalBooks must be between 1 and 999' });
      return;
    }

    const challenge = await dbGet<any>(
      'SELECT * FROM reading_challenges WHERE id = ? AND user_id = ?',
      [id, req.user!.userId]
    );
    if (!challenge) {
      res.status(404).json({ error: 'Challenge not found' });
      return;
    }

    await dbRun('UPDATE reading_challenges SET goal_books = ? WHERE id = ?', [goal, id]);

    const updated = await dbGet<any>('SELECT * FROM reading_challenges WHERE id = ?', [id]);

    // Fetch recent books
    const recentBooks = await dbAll<any>(`
      SELECT b.id, b.title, b.slug, b.cover_image, rp.finished_at
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND YEAR(rp.finished_at) = ?
      ORDER BY rp.finished_at DESC
      LIMIT 20
    `, [req.user!.userId, updated.year]);

    res.json(computeChallenge(updated, recentBooks));
  } catch (err: any) {
    logger.error({ err }, 'Update reading challenge error');
    res.status(500).json({ error: 'Failed to update reading challenge' });
  }
});

// ── GET /:userId/public — Public challenge view ─────────────────────────────
router.get('/:userId/public', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    // Verify user exists
    const user = await dbGet<any>('SELECT id, name FROM users WHERE id = ?', [userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const challenge = await dbGet<any>(
      'SELECT * FROM reading_challenges WHERE user_id = ? AND year = ?',
      [userId, year]
    );

    if (!challenge) {
      res.status(404).json({ error: 'No reading challenge found for this user and year' });
      return;
    }

    // Fetch recent finished books
    const recentBooks = await dbAll<any>(`
      SELECT b.id, b.title, b.slug, b.cover_image, rp.finished_at
      FROM reading_progress rp
      JOIN books b ON b.id = rp.book_id
      WHERE rp.user_id = ? AND rp.status = 'finished' AND YEAR(rp.finished_at) = ?
      ORDER BY rp.finished_at DESC
      LIMIT 20
    `, [userId, year]);

    const data = computeChallenge(challenge, recentBooks);

    res.json({
      userName: user.name,
      ...data,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get public reading challenge error');
    res.status(500).json({ error: 'Failed to fetch public reading challenge' });
  }
});

export default router;
