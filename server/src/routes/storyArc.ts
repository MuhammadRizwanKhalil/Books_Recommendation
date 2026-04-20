import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { sanitizeString } from '../lib/sanitize.js';
import { generateStoryArcPoints } from '../services/storyArc.js';

const router = Router();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeLabel(value: unknown): string | null {
  const safe = sanitizeString(typeof value === 'string' ? value : '').trim();
  if (!safe) return null;
  return safe.slice(0, 100);
}

async function resolveBook(bookIdOrSlug: string) {
  return dbGet<any>('SELECT id, title, author, description FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookIdOrSlug, bookIdOrSlug]);
}

async function getStoryArcForBook(bookId: string) {
  const community = await dbAll<any>(
    `SELECT position_percent, intensity, label, source
     FROM story_arc_points
     WHERE book_id = ? AND source = 'community_avg'
     ORDER BY position_percent ASC`,
    [bookId],
  );

  const selected = community.length > 0
    ? community
    : await dbAll<any>(
      `SELECT position_percent, intensity, label, source
       FROM story_arc_points
       WHERE book_id = ?
         AND source IN ('admin', 'ai')
       ORDER BY FIELD(source, 'admin', 'ai'), position_percent ASC`,
      [bookId],
    );

  const voterCountRow = await dbGet<any>(
    'SELECT COUNT(DISTINCT user_id) AS total FROM story_arc_votes WHERE book_id = ?',
    [bookId],
  );

  const source = selected[0]?.source || 'ai';

  return {
    arc: selected.map((row) => ({
      position: Number(row.position_percent),
      intensity: Number(row.intensity),
      label: row.label || null,
    })),
    source,
    voterCount: Number(voterCountRow?.total || 0),
  };
}

async function rebuildCommunityAverageArc(bookId: string): Promise<void> {
  const averages = await dbAll<any>(
    `SELECT
       ROUND(position_percent / 10) * 10 AS bucket_position,
       ROUND(AVG(intensity), 2) AS avg_intensity,
       COUNT(*) AS bucket_votes
     FROM story_arc_votes
     WHERE book_id = ?
     GROUP BY ROUND(position_percent / 10)
     HAVING bucket_votes >= 1
     ORDER BY bucket_position ASC`,
    [bookId],
  );

  await dbRun("DELETE FROM story_arc_points WHERE book_id = ? AND source = 'community_avg'", [bookId]);

  const labelsByBucket: Record<number, string> = {
    0: 'Introduction',
    10: 'Setup',
    20: 'Inciting Incident',
    50: 'Midpoint',
    70: 'Escalation',
    80: 'Climax',
    90: 'Resolution',
    100: 'Resolution',
  };

  for (const row of averages) {
    const position = Math.round(clamp(Number(row.bucket_position), 0, 100) * 100) / 100;
    const intensity = Math.round(clamp(Number(row.avg_intensity), 0, 1) * 100) / 100;
    const label = labelsByBucket[Math.round(position)] || null;

    await dbRun(
      `INSERT INTO story_arc_points (id, book_id, position_percent, intensity, label, source)
       VALUES (?, ?, ?, ?, ?, 'community_avg')`,
      [uuidv4(), bookId, position, intensity, label],
    );
  }
}

router.get('/books/:id/story-arc', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.id as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const payload = await getStoryArcForBook(book.id);
    res.json(payload);
  } catch (err: any) {
    logger.error({ err }, 'Get story arc error');
    res.status(500).json({ error: 'Failed to fetch story arc' });
  }
});

router.post(
  '/books/:id/story-arc/vote',
  authenticate,
  rateLimit('story-arc-vote', 50, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const book = await resolveBook(req.params.id as string);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const positionPercent = toNumber(req.body?.positionPercent);
      const intensity = toNumber(req.body?.intensity);
      const label = normalizeLabel(req.body?.label);

      if (positionPercent === null || positionPercent < 0 || positionPercent > 100) {
        res.status(400).json({ error: 'positionPercent must be a number between 0 and 100' });
        return;
      }

      if (intensity === null || intensity < 0 || intensity > 1) {
        res.status(400).json({ error: 'intensity must be a number between 0 and 1' });
        return;
      }

      await dbRun(
        `INSERT INTO story_arc_votes (id, book_id, user_id, position_percent, intensity)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), book.id, req.user!.userId, Math.round(positionPercent * 100) / 100, Math.round(intensity * 100) / 100],
      );

      if (label) {
        await dbRun(
          `INSERT INTO story_arc_points (id, book_id, position_percent, intensity, label, source)
           VALUES (?, ?, ?, ?, ?, 'community_avg')`,
          [uuidv4(), book.id, Math.round(positionPercent * 100) / 100, Math.round(intensity * 100) / 100, label],
        );
      }

      await rebuildCommunityAverageArc(book.id);
      const payload = await getStoryArcForBook(book.id);

      res.status(201).json({
        message: 'Story arc vote recorded',
        ...payload,
      });
    } catch (err: any) {
      logger.error({ err }, 'Vote story arc error');
      res.status(500).json({ error: 'Failed to submit story arc vote' });
    }
  },
);

router.post(
  '/admin/books/:id/story-arc/generate',
  authenticate,
  requireAdmin,
  rateLimit('story-arc-generate', 20, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const book = await resolveBook(req.params.id as string);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const points = await generateStoryArcPoints({
        title: book.title,
        author: book.author,
        description: book.description,
      });

      await dbRun("DELETE FROM story_arc_points WHERE book_id = ? AND source IN ('ai', 'admin')", [book.id]);

      for (const point of points) {
        await dbRun(
          `INSERT INTO story_arc_points (id, book_id, position_percent, intensity, label, source)
           VALUES (?, ?, ?, ?, ?, 'ai')`,
          [
            uuidv4(),
            book.id,
            Math.round(clamp(point.position, 0, 100) * 100) / 100,
            Math.round(clamp(point.intensity, 0, 1) * 100) / 100,
            normalizeLabel(point.label),
          ],
        );
      }

      const payload = await getStoryArcForBook(book.id);
      res.json({
        message: 'Story arc generated',
        ...payload,
      });
    } catch (err: any) {
      logger.error({ err }, 'Generate story arc error');
      res.status(500).json({ error: 'Failed to generate story arc' });
    }
  },
);

export default router;
