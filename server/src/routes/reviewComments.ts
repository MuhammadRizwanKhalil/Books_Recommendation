import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, requireAdmin, rateLimit } from '../middleware.js';

const router = Router();

// ── GET /api/review-comments/:reviewId ───────────────────────────────────
router.get('/:reviewId', async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));

    // Verify review exists
    const review = await dbGet<any>('SELECT id FROM reviews WHERE id = ?', [reviewId]);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    // Count total comments for this review
    const countRow = await dbGet<any>(
      'SELECT COUNT(*) as total FROM review_comments WHERE review_id = ?',
      [reviewId]
    );
    const totalComments = countRow.total;

    // Get all top-level comments (no parent) with pagination
    const topLevel = await dbAll<any>(`
      SELECT rc.*, u.name AS user_name, u.avatar_url AS user_avatar
      FROM review_comments rc
      JOIN users u ON rc.user_id = u.id
      WHERE rc.review_id = ? AND rc.parent_comment_id IS NULL
      ORDER BY rc.created_at ASC
      LIMIT ? OFFSET ?
    `, [reviewId, limitNum, (pageNum - 1) * limitNum]);

    // Get all replies for this review (to build the tree)
    const allReplies = await dbAll<any>(`
      SELECT rc.*, u.name AS user_name, u.avatar_url AS user_avatar
      FROM review_comments rc
      JOIN users u ON rc.user_id = u.id
      WHERE rc.review_id = ? AND rc.parent_comment_id IS NOT NULL
      ORDER BY rc.created_at ASC
    `, [reviewId]);

    // Build reply map: parentId -> replies[]
    const replyMap = new Map<string, any[]>();
    for (const reply of allReplies) {
      const parentId = reply.parent_comment_id;
      if (!replyMap.has(parentId)) replyMap.set(parentId, []);
      replyMap.get(parentId)!.push(reply);
    }

    // Recursively build nested replies
    function buildReplies(parentId: string, depth: number): any[] {
      const replies = replyMap.get(parentId) || [];
      return replies.map(r => ({
        id: r.id,
        content: r.content,
        user: { id: r.user_id, name: r.user_name, avatarUrl: r.user_avatar },
        parentCommentId: r.parent_comment_id,
        isEdited: !!r.is_edited,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        replies: depth < 10 ? buildReplies(r.id, depth + 1) : [],
      }));
    }

    const comments = topLevel.map(c => ({
      id: c.id,
      content: c.content,
      user: { id: c.user_id, name: c.user_name, avatarUrl: c.user_avatar },
      parentCommentId: null,
      isEdited: !!c.is_edited,
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      replies: buildReplies(c.id, 1),
    }));

    res.json({ comments, totalComments });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// ── POST /api/review-comments/:reviewId ──────────────────────────────────
router.post('/:reviewId', authenticate, rateLimit('review-comment', 20, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { reviewId } = req.params;
    const { content, parentCommentId } = req.body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
      return;
    }

    // Verify review exists
    const review = await dbGet<any>('SELECT id FROM reviews WHERE id = ?', [reviewId]);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    // Verify parent comment exists if provided
    if (parentCommentId) {
      const parent = await dbGet<any>(
        'SELECT id FROM review_comments WHERE id = ? AND review_id = ?',
        [parentCommentId, reviewId]
      );
      if (!parent) {
        res.status(404).json({ error: 'Parent comment not found' });
        return;
      }
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO review_comments (id, review_id, user_id, parent_comment_id, content)
       VALUES (?, ?, ?, ?, ?)`,
      [id, reviewId, req.user!.userId, parentCommentId || null, content.trim()]
    );

    const user = await dbGet<any>('SELECT name, avatar_url FROM users WHERE id = ?', [req.user!.userId]);

    res.status(201).json({
      id,
      content: content.trim(),
      user: { id: req.user!.userId, name: user.name, avatarUrl: user.avatar_url },
      parentCommentId: parentCommentId || null,
      isEdited: false,
      createdAt: new Date().toISOString(),
      replies: [],
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

// ── PUT /api/review-comments/comments/:commentId ──────────────────────────
router.put('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment content is required' });
      return;
    }
    if (content.trim().length > 2000) {
      res.status(400).json({ error: 'Comment must be 2000 characters or fewer' });
      return;
    }

    const comment = await dbGet<any>('SELECT * FROM review_comments WHERE id = ?', [commentId]);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Only the author can edit
    if (comment.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only edit your own comments' });
      return;
    }

    await dbRun(
      'UPDATE review_comments SET content = ?, is_edited = TRUE WHERE id = ?',
      [content.trim(), commentId]
    );

    const updated = await dbGet<any>('SELECT * FROM review_comments WHERE id = ?', [commentId]);
    const user = await dbGet<any>('SELECT name, avatar_url FROM users WHERE id = ?', [updated.user_id]);

    res.json({
      id: updated.id,
      content: updated.content,
      user: { id: updated.user_id, name: user.name, avatarUrl: user.avatar_url },
      parentCommentId: updated.parent_comment_id,
      isEdited: !!updated.is_edited,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update comment' });
  }
});

// ── DELETE /api/review-comments/comments/:commentId ───────────────────────
router.delete('/comments/:commentId', authenticate, async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;

    const comment = await dbGet<any>('SELECT * FROM review_comments WHERE id = ?', [commentId]);
    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    // Owner or admin can delete
    if (comment.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    // CASCADE will remove child replies
    await dbRun('DELETE FROM review_comments WHERE id = ?', [commentId]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

export default router;
