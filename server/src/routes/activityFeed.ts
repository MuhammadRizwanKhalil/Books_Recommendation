import { Router, Request, Response } from 'express';
import { dbAll } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate } from '../middleware.js';
import { parseActivityMetadata, VALID_ACTIVITY_TYPES, type ActivityType } from '../services/activityFeed.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const requestedTypes = String(req.query.type || '')
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is ActivityType => VALID_ACTIVITY_TYPES.includes(value as ActivityType));

    const where: string[] = ['uf.follower_id = ?'];
    const params: any[] = [req.user!.userId];

    if (requestedTypes.length > 0) {
      where.push(`ua.activity_type IN (${requestedTypes.map(() => '?').join(', ')})`);
      params.push(...requestedTypes);
    }

    const rows = await dbAll<any>(
      `SELECT ua.*, u.name AS user_name, u.avatar_url,
              b.title AS book_title, b.slug AS book_slug, b.cover_image
       FROM user_activities ua
       JOIN user_follows uf ON uf.following_id = ua.user_id
       JOIN users u ON u.id = ua.user_id
       LEFT JOIN books b ON b.id = ua.book_id
       WHERE ${where.join(' AND ')}
       ORDER BY CASE ua.activity_type
         WHEN 'review' THEN 1
         WHEN 'rating' THEN 2
         WHEN 'finished' THEN 3
         WHEN 'started' THEN 4
         WHEN 'shelved' THEN 5
         WHEN 'progress' THEN 6
         WHEN 'list_created' THEN 7
         WHEN 'challenge_set' THEN 8
         ELSE 9
       END ASC,
       ua.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit + 1, offset],
    );

    const hasMore = rows.length > limit;
    const activities = rows.slice(0, limit).map((row) => ({
      id: row.id,
      type: row.activity_type,
      user: {
        id: row.user_id,
        name: row.user_name,
        avatarUrl: row.avatar_url || null,
      },
      book: row.book_id
        ? {
            id: row.book_id,
            title: row.book_title,
            slug: row.book_slug,
            coverImage: row.cover_image || null,
          }
        : null,
      metadata: parseActivityMetadata(row.metadata),
      createdAt: row.created_at,
    }));

    res.json({ activities, hasMore, page });
  } catch (err: any) {
    logger.error({ err }, 'Get activity feed error');
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

export default router;
