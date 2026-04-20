import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, requireAdmin, rateLimit } from '../middleware.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';
import { logger } from '../lib/logger.js';
import { validateReviewContent, calculateReviewTrust, recalculateBookScore } from '../services/scoring.js';
import { validate, createReviewSchema } from '../lib/validation.js';
import { recordUserActivity } from '../services/activityFeed.js';

const router = Router();

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── GET /api/reviews/book/:bookId ───────────────────────────────────────────
router.get('/book/:bookId', async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { page = '1', limit = '20', sort = 'helpful', includeSpoilers } = req.query;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
    const ratingFilter = req.query.rating ? parseFloat(req.query.rating as string) : undefined;
    const minRating = req.query.minRating ? parseFloat(req.query.minRating as string) : undefined;
    const maxRating = req.query.maxRating ? parseFloat(req.query.maxRating as string) : undefined;
    const hasSpoilerFilter = req.query.hasSpoiler as string | undefined;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    // Build WHERE clause with filters
    const conditions: string[] = ['book_id = ?', 'is_approved = 1'];
    const params: any[] = [bookId];

    if (q) {
      conditions.push('MATCH(title, content) AGAINST(? IN BOOLEAN MODE)');
      params.push(q);
    }
    if (ratingFilter !== undefined && !isNaN(ratingFilter)) {
      conditions.push('rating = ?');
      params.push(ratingFilter);
    }
    if (minRating !== undefined && !isNaN(minRating)) {
      conditions.push('rating >= ?');
      params.push(minRating);
    }
    if (maxRating !== undefined && !isNaN(maxRating)) {
      conditions.push('rating <= ?');
      params.push(maxRating);
    }
    if (hasSpoilerFilter === 'true') {
      conditions.push('has_spoiler = 1');
    } else if (hasSpoilerFilter === 'false') {
      conditions.push('has_spoiler = 0');
    }

    const whereClause = conditions.join(' AND ');

    // Total unfiltered for the book (for stats)
    const totalRow = await dbGet<any>('SELECT COUNT(*) as total FROM reviews WHERE book_id = ? AND is_approved = 1', [bookId]);
    const total = totalRow.total;

    // Total matching filters
    const filteredRow = await dbGet<any>(`SELECT COUNT(*) as total FROM reviews WHERE ${whereClause}`, [...params]);
    const totalFiltered = filteredRow.total;

    // Sort options: helpful (default), newest, highest, lowest
    let orderBy = 'helpful_count DESC, created_at DESC';
    if (sort === 'newest') orderBy = 'created_at DESC';
    else if (sort === 'oldest') orderBy = 'created_at ASC';
    else if (sort === 'highest') orderBy = 'rating DESC, helpful_count DESC';
    else if (sort === 'lowest') orderBy = 'rating ASC, helpful_count DESC';

    const reviews = await dbAll<any>(`
      SELECT * FROM reviews WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    // Get rating distribution (always unfiltered for the book)
    const distribution = await dbAll<any>(`
      SELECT rating, COUNT(*) as count FROM reviews
      WHERE book_id = ? AND is_approved = 1
      GROUP BY rating ORDER BY rating DESC
    `, [bookId]);

    const avgRating = await dbGet<any>(`
      SELECT AVG(rating) as avg, COUNT(*) as total FROM reviews
      WHERE book_id = ? AND is_approved = 1
    `, [bookId]);

    // Calculate trust-weighted average (reviews with higher trust count more)
    let trustWeightedAvg = avgRating.avg || 0;
    if (reviews.length > 0) {
      let weightedSum = 0;
      let weightTotal = 0;
      for (const r of reviews) {
        const trust = await calculateReviewTrust(r, bookId as string);
        weightedSum += r.rating * trust;
        weightTotal += trust;
      }
      if (weightTotal > 0) {
        trustWeightedAvg = Math.round((weightedSum / weightTotal) * 10) / 10;
      }
    }

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        bookId: r.book_id,
        userId: r.user_id,
        userName: r.user_name,
        userAvatar: r.user_avatar,
        rating: r.rating,
        title: r.title,
        content: r.content,
        helpfulCount: r.helpful_count,
        isVerified: !!r.user_id, // Has an authenticated account
        hasSpoiler: !!r.has_spoiler,
        ...(includeSpoilers === 'true' && r.spoiler_text ? { spoilerText: r.spoiler_text } : {}),
        authorResponse: r.author_response
          ? {
              content: r.author_response,
              respondedAt: r.author_response_at,
            }
          : null,
        createdAt: r.created_at,
      })),
      stats: {
        averageRating: avgRating.avg ? Math.round(avgRating.avg * 10) / 10 : 0,
        trustWeightedRating: trustWeightedAvg,
        totalReviews: avgRating.total,
        distribution: [5, 4, 3, 2, 1].map(rating => {
          const found = distribution.find((d: any) => d.rating === rating);
          return { rating, count: found ? found.count : 0 };
        }),
      },
      pagination: { page: pageNum, limit: limitNum, total, totalFiltered, totalPages: Math.ceil(totalFiltered / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ── POST /api/reviews ───────────────────────────────────────────────────────
// Zod validates bookId, rating (1-5 int), content (20-5000 chars)
router.post('/', authenticate, rateLimit('create-review', 10, 60 * 60 * 1000), validate(createReviewSchema), async (req: Request, res: Response) => {
  try {
    const { bookId, rating, title, content } = req.body;
    const hasSpoiler = !!req.body.hasSpoiler;
    const spoilerText = req.body.spoilerText ? String(req.body.spoilerText).slice(0, 5000) : null;

    // Content validation (spam detection, length checks)
    const validation = validateReviewContent(content, rating, title);
    if (!validation.valid) {
      res.status(400).json({ error: validation.issues[0] || 'Invalid review content' });
      return;
    }

    // Check if user already reviewed this book
    const existing = await dbGet<any>('SELECT id FROM reviews WHERE book_id = ? AND user_id = ?', [bookId, req.user!.userId]);
    if (existing) {
      res.status(409).json({ error: 'You have already reviewed this book' });
      return;
    }

    // Verify the book exists
    const bookExists = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!bookExists) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const user = await dbGet<any>('SELECT name, avatar_url FROM users WHERE id = ?', [req.user!.userId]);

    const id = uuidv4();
    // Auto-approve based on content validation; flagged reviews need moderation
    const isApproved = validation.autoApprove ? 1 : 0;

    await dbRun(`
      INSERT INTO reviews (id, book_id, user_id, user_name, user_avatar, rating, title, content, is_approved, has_spoiler, spoiler_text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, bookId, req.user!.userId, user.name, user.avatar_url, rating, title || null, content, isApproved, hasSpoiler ? 1 : 0, spoilerText]);

    // Recalculate the book's composite score now that a new review exists
    if (isApproved) {
      try { await recalculateBookScore(bookId); } catch (e) { /* non-blocking */ }
    }

    const review = await dbGet<any>('SELECT * FROM reviews WHERE id = ?', [id]);
    res.status(201).json({
      id: review.id,
      bookId: review.book_id,
      userId: review.user_id,
      userName: review.user_name,
      userAvatar: review.user_avatar,
      rating: review.rating,
      title: review.title,
      content: review.content,
      helpfulCount: review.helpful_count,
      isVerified: true,
      isApproved: !!review.is_approved,
      hasSpoiler: !!review.has_spoiler,
      spoilerText: review.spoiler_text || null,
      createdAt: review.created_at,
      ...(validation.issues.length > 0 && !validation.autoApprove ? { moderation: 'Your review has been submitted and will be visible after moderation.' } : {}),
    });

    if (isApproved) {
      setImmediate(() => {
        recordUserActivity({
          userId: req.user!.userId,
          type: 'review',
          bookId,
          referenceId: id,
          metadata: {
            rating,
            title: title || null,
            reviewExcerpt: content.slice(0, 180),
          },
        }).catch(() => undefined);
      });
    }

    // ── Fire-and-forget: Admin notification ─────────────────────────────
    try {
      if (await getSiteSetting('notify_new_review', 'true') === 'true') {
        const adminEmail = await getSiteSetting('admin_email', '');
        if (adminEmail) {
          const siteName = await getSiteSetting('site_name', 'The Book Times');
          const html = await wrapInBaseTemplate(
            `<h2>New Book Review</h2><p>A new review has been posted:</p><p><strong>User:</strong> ${escapeHtml(user.name)}</p><p><strong>Book ID:</strong> ${escapeHtml(bookId)}</p><p><strong>Rating:</strong> ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</p>${title ? `<p><strong>Title:</strong> ${escapeHtml(title)}</p>` : ''}<p><strong>Content:</strong> ${escapeHtml(content.substring(0, 200))}${content.length > 200 ? '...' : ''}</p>`,
            `New Review - ${siteName}`,
          );
          sendEmail({ to: adminEmail, subject: `[${siteName}] New Review (${rating}★) by ${escapeHtml(user.name)}`, html }).catch(e => logger.error({ err: e }, 'Admin notification failed'));
        }
      }
    } catch (e) {
      logger.error({ err: e }, 'Admin notification failed');
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

// ── PUT /api/reviews/:id (User edits own review) ────────────────────────────
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const review = await dbGet<any>('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    // Only the author or admin can edit
    if (review.user_id !== req.user!.userId && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'You can only edit your own reviews' });
      return;
    }
    const { rating, title, content } = req.body;
    const hasSpoiler = req.body.hasSpoiler !== undefined ? !!req.body.hasSpoiler : undefined;
    const spoilerText = req.body.spoilerText !== undefined ? (req.body.spoilerText ? String(req.body.spoilerText).slice(0, 5000) : null) : undefined;
    if (rating !== undefined && (typeof rating !== 'number' || rating < 0.5 || rating > 5 || (rating * 2) % 1 !== 0)) {
      res.status(400).json({ error: 'Rating must be between 0.5 and 5 in 0.5 increments' });
      return;
    }
    await dbRun(`
      UPDATE reviews SET rating = COALESCE(?, rating), title = COALESCE(?, title),
      content = COALESCE(?, content), has_spoiler = COALESCE(?, has_spoiler),
      spoiler_text = COALESCE(?, spoiler_text),
      updated_at = NOW(), is_approved = 0
      WHERE id = ?
    `, [rating || null, title !== undefined ? title : null, content || null, hasSpoiler !== undefined ? (hasSpoiler ? 1 : 0) : null, spoilerText !== undefined ? spoilerText : null, req.params.id]);
    const updated = await dbGet<any>('SELECT * FROM reviews WHERE id = ?', [req.params.id]);
    res.json({
      id: updated.id, bookId: updated.book_id, userId: updated.user_id,
      userName: updated.user_name, rating: updated.rating, title: updated.title,
      content: updated.content, helpfulCount: updated.helpful_count,
      hasSpoiler: !!updated.has_spoiler, spoilerText: updated.spoiler_text || null,
      createdAt: updated.created_at,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// ── DELETE /api/reviews/:id/own (User deletes own review) ───────────────────
router.delete('/:id/own', authenticate, async (req: Request, res: Response) => {
  try {
    const review = await dbGet<any>('SELECT user_id FROM reviews WHERE id = ?', [req.params.id]);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    if (review.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only delete your own reviews' });
      return;
    }
    await dbRun('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

// ── POST /api/reviews/:id/helpful ───────────────────────────────────────────
router.post('/:id/helpful', optionalAuth, rateLimit('helpful', 30, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const reviewId = req.params.id;
    const review = await dbGet<any>('SELECT id, user_id FROM reviews WHERE id = ?', [reviewId]);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    // Prevent voting on own review
    if (req.user && review.user_id === req.user.userId) {
      res.status(400).json({ error: 'You cannot vote on your own review' });
      return;
    }
    await dbRun('UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = ?', [reviewId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to mark review as helpful' });
  }
});

// ── GET /api/reviews/all (Admin) ────────────────────────────────────────────
router.get('/all', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20', approved } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: any[] = [];
    if (approved !== undefined) {
      whereClause = 'WHERE r.is_approved = ?';
      params.push(approved === 'true' ? 1 : 0);
    }

    const totalRow = await dbGet<any>(`SELECT COUNT(*) as total FROM reviews r ${whereClause}`, [...params]);
    const total = totalRow.total;
    const reviews = await dbAll<any>(`
      SELECT r.*, b.title as book_title FROM reviews r
      LEFT JOIN books b ON b.id = r.book_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      reviews: reviews.map(r => ({
        id: r.id,
        bookId: r.book_id,
        bookTitle: r.book_title,
        userId: r.user_id,
        userName: r.user_name,
        userAvatar: r.user_avatar,
        rating: r.rating,
        title: r.title,
        content: r.content,
        helpfulCount: r.helpful_count,
        isApproved: !!r.is_approved,
        createdAt: r.created_at,
      })),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// ── PUT /api/reviews/:id/approve (Admin) ────────────────────────────────────
router.put('/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { isApproved } = req.body;
    const review = await dbGet<any>('SELECT book_id FROM reviews WHERE id = ?', [req.params.id]);
    await dbRun('UPDATE reviews SET is_approved = ?, updated_at = NOW() WHERE id = ?', [isApproved ? 1 : 0, req.params.id]);

    // Recalculate book score when review approval status changes
    if (review) {
      try { await recalculateBookScore(review.book_id); } catch (e) { /* non-blocking */ }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update review' });
  }
});

// ── DELETE /api/reviews/:id (Admin) ─────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const review = await dbGet<any>('SELECT book_id FROM reviews WHERE id = ?', [req.params.id]);
    const result = await dbRun('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    // Recalculate book score after review deletion
    if (review) {
      try { await recalculateBookScore(review.book_id); } catch (e) { /* non-blocking */ }
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete review' });
  }
});

export default router;
