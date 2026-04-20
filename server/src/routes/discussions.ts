import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, requireAdmin, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

function mapDiscussionSummary(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    content: row.content,
    isPinned: !!row.is_pinned,
    isLocked: !!row.is_locked,
    replyCount: Number(row.reply_count || 0),
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      avatarUrl: row.user_avatar || null,
    },
  };
}

function mapReply(row: any) {
  return {
    id: row.id,
    discussionId: row.discussion_id,
    content: row.content,
    isEdited: !!row.is_edited,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      avatarUrl: row.user_avatar || null,
    },
  };
}

async function resolveBook(bookIdOrSlug: string) {
  return dbGet<any>('SELECT id, slug, title FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookIdOrSlug, bookIdOrSlug]);
}

router.get('/books/:bookId/discussions', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.bookId as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim().toLowerCase();

    const where = ['d.book_id = ?'];
    const params: any[] = [book.id];

    if (search) {
      where.push('(LOWER(d.title) LIKE ? OR LOWER(d.content) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [rows, countRow] = await Promise.all([
      dbAll<any>(
        `SELECT d.*, u.name AS user_name, u.avatar_url AS user_avatar
         FROM discussions d
         JOIN users u ON u.id = d.user_id
         ${whereSql}
         ORDER BY d.is_pinned DESC, d.last_activity_at DESC, d.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      dbGet<any>(`SELECT COUNT(*) AS total FROM discussions d ${whereSql}`, params),
    ]);

    res.json({
      discussions: rows.map(mapDiscussionSummary),
      total: Number(countRow?.total || 0),
      page,
      limit,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get discussions error');
    res.status(500).json({ error: 'Failed to fetch discussions' });
  }
});

router.post(
  '/books/:bookId/discussions',
  authenticate,
  rateLimit('discussion-create', 15, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const book = await resolveBook(req.params.bookId as string);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const title = typeof req.body?.title === 'string' ? req.body.title.replace(/\s+/g, ' ').trim() : '';
      const content = typeof req.body?.content === 'string' ? req.body.content.replace(/\s+/g, ' ').trim() : '';

      if (!title) {
        res.status(400).json({ error: 'Title is required' });
        return;
      }
      if (title.length > 300) {
        res.status(400).json({ error: 'Title must be 300 characters or fewer' });
        return;
      }
      if (!content) {
        res.status(400).json({ error: 'Content is required' });
        return;
      }
      if (content.length > 5000) {
        res.status(400).json({ error: 'Content must be 5000 characters or fewer' });
        return;
      }

      const id = uuidv4();
      await dbRun(
        `INSERT INTO discussions (id, book_id, user_id, title, content, last_activity_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [id, book.id, req.user!.userId, title, content],
      );

      const created = await dbGet<any>(
        `SELECT d.*, u.name AS user_name, u.avatar_url AS user_avatar
         FROM discussions d
         JOIN users u ON u.id = d.user_id
         WHERE d.id = ?`,
        [id],
      );

      res.status(201).json(mapDiscussionSummary(created));
    } catch (err: any) {
      logger.error({ err }, 'Create discussion error');
      res.status(500).json({ error: 'Failed to create discussion' });
    }
  },
);

router.get('/discussions/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const discussion = await dbGet<any>(
      `SELECT d.*, b.title AS book_title, b.slug AS book_slug, u.name AS user_name, u.avatar_url AS user_avatar
       FROM discussions d
       LEFT JOIN books b ON b.id = d.book_id
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?
       LIMIT 1`,
      [req.params.id],
    );

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    const replies = await dbAll<any>(
      `SELECT dr.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM discussion_replies dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.discussion_id = ?
       ORDER BY dr.created_at ASC`,
      [req.params.id],
    );

    res.json({
      ...mapDiscussionSummary(discussion),
      book: discussion.book_id
        ? {
            id: discussion.book_id,
            title: discussion.book_title,
            slug: discussion.book_slug,
          }
        : null,
      replies: replies.map(mapReply),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get discussion detail error');
    res.status(500).json({ error: 'Failed to fetch discussion' });
  }
});

router.post(
  '/discussions/:id/replies',
  authenticate,
  rateLimit('discussion-reply', 30, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const discussion = await dbGet<any>('SELECT * FROM discussions WHERE id = ? LIMIT 1', [req.params.id]);
      if (!discussion) {
        res.status(404).json({ error: 'Discussion not found' });
        return;
      }
      if (discussion.is_locked) {
        res.status(403).json({ error: 'This discussion is locked' });
        return;
      }

      const content = typeof req.body?.content === 'string' ? req.body.content.replace(/\s+/g, ' ').trim() : '';
      if (!content) {
        res.status(400).json({ error: 'Reply content is required' });
        return;
      }
      if (content.length > 3000) {
        res.status(400).json({ error: 'Reply must be 3000 characters or fewer' });
        return;
      }

      const id = uuidv4();
      await dbRun(
        `INSERT INTO discussion_replies (id, discussion_id, user_id, content)
         VALUES (?, ?, ?, ?)`,
        [id, req.params.id, req.user!.userId, content],
      );

      await dbRun(
        `UPDATE discussions
         SET reply_count = reply_count + 1,
             last_activity_at = NOW()
         WHERE id = ?`,
        [req.params.id],
      );

      const created = await dbGet<any>(
        `SELECT dr.*, u.name AS user_name, u.avatar_url AS user_avatar
         FROM discussion_replies dr
         JOIN users u ON u.id = dr.user_id
         WHERE dr.id = ?`,
        [id],
      );

      res.status(201).json(mapReply(created));
    } catch (err: any) {
      logger.error({ err }, 'Create discussion reply error');
      res.status(500).json({ error: 'Failed to post reply' });
    }
  },
);

router.put('/admin/discussions/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const discussion = await dbGet<any>(
      `SELECT d.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM discussions d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id],
    );

    if (!discussion) {
      res.status(404).json({ error: 'Discussion not found' });
      return;
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (req.body?.isPinned !== undefined) {
      updates.push('is_pinned = ?');
      params.push(req.body.isPinned ? 1 : 0);
    }

    if (req.body?.isLocked !== undefined) {
      updates.push('is_locked = ?');
      params.push(req.body.isLocked ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(req.params.id);
    await dbRun(`UPDATE discussions SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await dbGet<any>(
      `SELECT d.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM discussions d
       JOIN users u ON u.id = d.user_id
       WHERE d.id = ?`,
      [req.params.id],
    );

    res.json(mapDiscussionSummary(updated));
  } catch (err: any) {
    logger.error({ err }, 'Admin discussion update error');
    res.status(500).json({ error: 'Failed to update discussion' });
  }
});

export default router;
