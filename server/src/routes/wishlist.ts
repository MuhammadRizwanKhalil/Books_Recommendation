import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate } from '../middleware.js';

const router = Router();

// ── GET /api/wishlist — Get user's wishlist ─────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await dbAll<any>(`
      SELECT b.id, b.title, b.author, b.slug, b.cover_image, b.google_rating,
             b.ratings_count, b.published_date, b.amazon_url, w.created_at as added_at
      FROM wishlist w
      JOIN books b ON b.id = w.book_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `, [req.user!.userId]);

    res.json({
      items: items.map((item: any) => ({
        id: item.id,
        title: item.title,
        author: item.author,
        slug: item.slug,
        coverImage: item.cover_image,
        googleRating: item.google_rating,
        ratingsCount: item.ratings_count,
        publishedDate: item.published_date,
        amazonUrl: item.amazon_url,
        addedAt: item.added_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get wishlist error');
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
});

// ── POST /api/wishlist/:bookId — Add book to wishlist ───────────────────────
router.post('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;

    // Verify book exists
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    await dbRun('INSERT IGNORE INTO wishlist (user_id, book_id) VALUES (?, ?)', [req.user!.userId, bookId]);

    res.json({ success: true, message: 'Added to wishlist' });
  } catch (err: any) {
    logger.error({ err: err }, 'Add to wishlist error');
    res.status(500).json({ error: 'Failed to add to wishlist' });
  }
});

// ── DELETE /api/wishlist/:bookId — Remove book from wishlist ────────────────
router.delete('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    await dbRun('DELETE FROM wishlist WHERE user_id = ? AND book_id = ?', [req.user!.userId, bookId]);
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (err: any) {
    logger.error({ err: err }, 'Remove from wishlist error');
    res.status(500).json({ error: 'Failed to remove from wishlist' });
  }
});

// ── DELETE /api/wishlist — Clear entire wishlist ────────────────────────────
router.delete('/', authenticate, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM wishlist WHERE user_id = ?', [req.user!.userId]);
    res.json({ success: true, message: 'Wishlist cleared' });
  } catch (err: any) {
    logger.error({ err: err }, 'Clear wishlist error');
    res.status(500).json({ error: 'Failed to clear wishlist' });
  }
});

// ── GET /api/wishlist/check/:bookId — Check if book is in wishlist ──────────
router.get('/check/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await dbGet<any>('SELECT 1 FROM wishlist WHERE user_id = ? AND book_id = ?', [req.user!.userId, req.params.bookId]);
    res.json({ inWishlist: !!item });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check wishlist' });
  }
});

export default router;
