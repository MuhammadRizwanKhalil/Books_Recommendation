import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { sanitizeString } from '../lib/sanitize.js';

const router = Router();

const VALID_PACES = ['slow', 'medium', 'fast'] as const;

// ── GET /api/pace/books/:bookId — Get pace data for a book ──────────────────
router.get('/books/:bookId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const userId = req.user?.userId || null;

    // Get vote counts per pace
    const rows = await dbAll<any>(
      `SELECT pace, COUNT(*) as votes
       FROM book_pace_votes
       WHERE book_id = ?
       GROUP BY pace`,
      [bookId]
    );

    const counts: Record<string, number> = { slow: 0, medium: 0, fast: 0 };
    for (const row of rows) {
      counts[row.pace] = row.votes;
    }
    const totalVotes = counts.slow + counts.medium + counts.fast;

    // Get user's vote if authenticated
    let userVote: string | null = null;
    if (userId) {
      const vote = await dbGet<any>(
        'SELECT pace FROM book_pace_votes WHERE book_id = ? AND user_id = ?',
        [bookId, userId]
      );
      userVote = vote?.pace || null;
    }

    res.json({
      totalVotes,
      slow: {
        votes: counts.slow,
        percentage: totalVotes > 0 ? Math.round((counts.slow / totalVotes) * 100) : 0,
      },
      medium: {
        votes: counts.medium,
        percentage: totalVotes > 0 ? Math.round((counts.medium / totalVotes) * 100) : 0,
      },
      fast: {
        votes: counts.fast,
        percentage: totalVotes > 0 ? Math.round((counts.fast / totalVotes) * 100) : 0,
      },
      userVote,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get book pace error');
    res.status(500).json({ error: 'Failed to fetch pace data' });
  }
});

// ── POST /api/pace/books/:bookId/vote — Vote on pace ────────────────────────
router.post(
  '/books/:bookId/vote',
  authenticate,
  rateLimit('pace-vote', 30, 15 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const { bookId } = req.params;
      const userId = req.user!.userId;
      const pace = sanitizeString(String(req.body.pace || '')).toLowerCase();

      if (!VALID_PACES.includes(pace as any)) {
        res.status(400).json({ error: 'Invalid pace value. Must be slow, medium, or fast.' });
        return;
      }

      // Verify book exists
      const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      // Upsert: delete existing vote then insert new one
      const existing = await dbGet<any>(
        'SELECT id FROM book_pace_votes WHERE book_id = ? AND user_id = ?',
        [bookId, userId]
      );

      if (existing) {
        await dbRun(
          'UPDATE book_pace_votes SET pace = ?, updated_at = NOW() WHERE id = ?',
          [pace, existing.id]
        );
      } else {
        await dbRun(
          'INSERT INTO book_pace_votes (id, book_id, user_id, pace) VALUES (?, ?, ?, ?)',
          [uuidv4(), bookId, userId, pace]
        );
      }

      // Return updated counts
      const rows = await dbAll<any>(
        `SELECT pace, COUNT(*) as votes
         FROM book_pace_votes
         WHERE book_id = ?
         GROUP BY pace`,
        [bookId]
      );

      const counts: Record<string, number> = { slow: 0, medium: 0, fast: 0 };
      for (const row of rows) {
        counts[row.pace] = row.votes;
      }
      const totalVotes = counts.slow + counts.medium + counts.fast;

      res.json({
        message: 'Pace vote recorded',
        totalVotes,
        slow: {
          votes: counts.slow,
          percentage: totalVotes > 0 ? Math.round((counts.slow / totalVotes) * 100) : 0,
        },
        medium: {
          votes: counts.medium,
          percentage: totalVotes > 0 ? Math.round((counts.medium / totalVotes) * 100) : 0,
        },
        fast: {
          votes: counts.fast,
          percentage: totalVotes > 0 ? Math.round((counts.fast / totalVotes) * 100) : 0,
        },
        userVote: pace,
      });
    } catch (err: any) {
      logger.error({ err }, 'Vote on pace error');
      res.status(500).json({ error: 'Failed to submit pace vote' });
    }
  }
);

// ── DELETE /api/pace/books/:bookId/vote — Remove pace vote ──────────────────
router.delete('/books/:bookId/vote', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const userId = req.user!.userId;

    const existing = await dbGet<any>(
      'SELECT id FROM book_pace_votes WHERE book_id = ? AND user_id = ?',
      [bookId, userId]
    );
    if (!existing) {
      res.status(404).json({ error: 'No pace vote found' });
      return;
    }

    await dbRun('DELETE FROM book_pace_votes WHERE id = ?', [existing.id]);
    res.json({ message: 'Pace vote removed' });
  } catch (err: any) {
    logger.error({ err }, 'Remove pace vote error');
    res.status(500).json({ error: 'Failed to remove pace vote' });
  }
});

export default router;
