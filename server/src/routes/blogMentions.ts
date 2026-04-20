import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/books/:id/blog-mentions ────────────────────────────────────────
// Public: get blog posts that mention a specific book
router.get('/books/:bookId/blog-mentions', async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;

    // Verify book exists
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const mentions = await dbAll<any>(`
      SELECT bp.id, bp.title, bp.slug, bp.excerpt, bp.featured_image, bp.published_at
      FROM blog_book_mentions bbm
      JOIN blog_posts bp ON bp.id = bbm.blog_post_id
      WHERE bbm.book_id = ? AND bp.status = 'PUBLISHED'
      ORDER BY bp.published_at DESC
    `, [bookId]);

    res.json({
      mentions: mentions.map((m: any) => ({
        id: m.id,
        title: m.title,
        slug: m.slug,
        excerpt: m.excerpt || null,
        featuredImage: m.featured_image || null,
        publishedAt: m.published_at,
      })),
      totalMentions: mentions.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch blog mentions for book');
    res.status(500).json({ error: 'Failed to fetch blog mentions' });
  }
});

// ── POST /api/admin/blog/:postId/book-mentions ──────────────────────────────
// Admin: manually link books to a blog post
router.post('/admin/blog/:postId/book-mentions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;
    const { bookIds } = req.body;

    if (!Array.isArray(bookIds) || bookIds.length === 0) {
      res.status(400).json({ error: 'bookIds must be a non-empty array' });
      return;
    }

    // Verify blog post exists
    const post = await dbGet<any>('SELECT id FROM blog_posts WHERE id = ?', [postId]);
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    // Verify all books exist
    for (const bookId of bookIds) {
      const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
      if (!book) {
        res.status(400).json({ error: `Book not found: ${bookId}` });
        return;
      }
    }

    // Insert mentions (ignore duplicates)
    let added = 0;
    for (const bookId of bookIds) {
      await dbRun('INSERT IGNORE INTO blog_featured_books (blog_id, book_id) VALUES (?, ?)', [postId, bookId]);
      const result = await dbRun(
        'INSERT IGNORE INTO blog_book_mentions (id, blog_post_id, book_id, is_auto_detected) VALUES (?, ?, ?, FALSE)',
        [uuidv4(), postId, bookId],
      );
      if ((result as any)?.changes > 0 || (result as any)?.affectedRows > 0) {
        added++;
      }
    }

    res.json({ success: true, added });
  } catch (err: any) {
    logger.error({ err }, 'Failed to add book mentions to blog post');
    res.status(500).json({ error: 'Failed to add book mentions' });
  }
});

// ── DELETE /api/books/admin/blog/:postId/book-mentions/:bookId ──────────────
// Admin: remove a book mention from a blog post
router.delete('/admin/blog/:postId/book-mentions/:bookId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { postId, bookId } = req.params;

    await dbRun('DELETE FROM blog_featured_books WHERE blog_id = ? AND book_id = ?', [postId, bookId]);
    const result = await dbRun(
      'DELETE FROM blog_book_mentions WHERE blog_post_id = ? AND book_id = ?',
      [postId, bookId],
    );

    if (result.changes === 0) {
      res.status(404).json({ error: 'Mention not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Failed to remove book mention');
    res.status(500).json({ error: 'Failed to remove book mention' });
  }
});

// ── GET /api/books/admin/blog/:postId/book-mentions ─────────────────────────
// Admin: get all book mentions for a blog post
router.get('/admin/blog/:postId/book-mentions', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { postId } = req.params;

    const mentions = await dbAll<any>(`
      SELECT bbm.id, bbm.book_id, bbm.is_auto_detected, bbm.created_at,
             b.title AS book_title, b.cover_image
      FROM blog_book_mentions bbm
      JOIN books b ON b.id = bbm.book_id
      WHERE bbm.blog_post_id = ?
      ORDER BY bbm.created_at DESC
    `, [postId]);

    res.json({
      mentions: mentions.map((m: any) => ({
        id: m.id,
        bookId: m.book_id,
        bookTitle: m.book_title,
        coverImage: m.cover_image || null,
        isAutoDetected: m.is_auto_detected === 1 || m.is_auto_detected === true,
        createdAt: m.created_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to fetch blog post book mentions');
    res.status(500).json({ error: 'Failed to fetch book mentions' });
  }
});

export default router;
