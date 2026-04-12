/**
 * Book Quotes Route
 * GET  /api/quotes/:bookId          — get approved quotes for a book
 * POST /api/quotes/:bookId          — submit a new quote (auth required)
 * POST /api/quotes/:id/upvote       — upvote a quote (auth required)
 * GET  /api/quotes/admin/pending    — get pending quotes (admin)
 * PUT  /api/quotes/:id/approve      — approve/reject a quote (admin)
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// GET /api/quotes/:bookId — top approved quotes for a book
router.get('/:bookId', optionalAuth, async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string || '10', 10), 50);

  try {
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ?', [bookId, bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const quotes = await dbAll<any>(
      `SELECT q.id, q.quote, q.page_number, q.upvotes, q.created_at,
              u.name as submitter_name, u.avatar_url as submitter_avatar
       FROM book_quotes q
       LEFT JOIN users u ON u.id = q.submitted_by
       WHERE q.book_id = ? AND q.is_approved = 1
       ORDER BY q.upvotes DESC, q.created_at DESC
       LIMIT ?`,
      [book.id, limit],
    );

    res.json(quotes);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch quotes');
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// POST /api/quotes/:bookId — submit a quote (auth required)
router.post('/:bookId', authenticate, rateLimit('submit-quote', 5, 60 * 60 * 1000), async (req: Request, res: Response) => {
  const { bookId } = req.params;
  const { quote, page_number } = req.body;

  if (!quote || typeof quote !== 'string' || quote.trim().length < 10) {
    res.status(400).json({ error: 'Quote must be at least 10 characters' });
    return;
  }
  if (quote.trim().length > 1000) {
    res.status(400).json({ error: 'Quote must be under 1000 characters' });
    return;
  }

  try {
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ?', [bookId, bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Check for duplicate quote from same user
    const existing = await dbGet<any>(
      'SELECT id FROM book_quotes WHERE book_id = ? AND submitted_by = ? AND quote = ?',
      [book.id, req.user!.userId, quote.trim()],
    );
    if (existing) {
      res.status(409).json({ error: 'You already submitted this quote' });
      return;
    }

    const id = uuidv4();
    // Auto-approve for admins, pending for users
    const isApproved = req.user!.role === 'admin';

    await dbRun(
      `INSERT INTO book_quotes (id, book_id, quote, page_number, submitted_by, is_approved)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, book.id, quote.trim(), page_number || null, req.user!.userId, isApproved],
    );

    res.status(201).json({
      id,
      message: isApproved ? 'Quote published!' : 'Quote submitted for review. Thank you!',
    });
  } catch (err) {
    logger.error({ err }, 'Failed to submit quote');
    res.status(500).json({ error: 'Failed to submit quote' });
  }
});

// POST /api/quotes/:id/upvote — upvote a quote
router.post('/:id/upvote', authenticate, rateLimit('upvote-quote', 20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const quote = await dbGet<any>('SELECT id, upvotes FROM book_quotes WHERE id = ? AND is_approved = 1', [id]);
    if (!quote) {
      res.status(404).json({ error: 'Quote not found' });
      return;
    }
    await dbRun('UPDATE book_quotes SET upvotes = upvotes + 1 WHERE id = ?', [id]);
    res.json({ upvotes: quote.upvotes + 1 });
  } catch (err) {
    logger.error({ err }, 'Failed to upvote quote');
    res.status(500).json({ error: 'Failed to upvote quote' });
  }
});

// GET /api/quotes/admin/pending — pending quotes (admin)
router.get('/admin/pending', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const quotes = await dbAll<any>(
      `SELECT q.id, q.quote, q.page_number, q.created_at,
              b.title as book_title, b.slug as book_slug, b.id as book_id,
              u.name as submitter_name, u.email as submitter_email
       FROM book_quotes q
       JOIN books b ON b.id = q.book_id
       LEFT JOIN users u ON u.id = q.submitted_by
       WHERE q.is_approved = 0
       ORDER BY q.created_at ASC
       LIMIT 50`,
    );
    res.json(quotes);
  } catch (err) {
    logger.error({ err }, 'Failed to fetch pending quotes');
    res.status(500).json({ error: 'Failed to fetch pending quotes' });
  }
});

// PUT /api/quotes/:id/approve — approve or reject (admin)
router.put('/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { approved } = req.body; // boolean
  try {
    if (approved === false) {
      await dbRun('DELETE FROM book_quotes WHERE id = ?', [id]);
      res.json({ message: 'Quote rejected and removed' });
    } else {
      await dbRun('UPDATE book_quotes SET is_approved = 1 WHERE id = ?', [id]);
      res.json({ message: 'Quote approved' });
    }
  } catch (err) {
    logger.error({ err }, 'Failed to approve quote');
    res.status(500).json({ error: 'Failed to approve/reject quote' });
  }
});

export default router;
