import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

const VALID_FORMATS = ['hardcover', 'paperback', 'ebook', 'audiobook'] as const;
type OwnedFormat = typeof VALID_FORMATS[number];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  return false;
}

function mapOwnedBook(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    format: row.format as OwnedFormat,
    conditionNote: row.condition_note || null,
    purchaseDate: row.purchase_date || null,
    isLendable: !!row.is_lendable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.title && {
      title: row.title,
      author: row.author,
      slug: row.slug,
      coverImage: row.cover_image || null,
    }),
  };
}

router.get('/owned-books', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await dbAll<any>(
      `SELECT ob.*, b.title, b.author, b.slug, b.cover_image
       FROM owned_books ob
       JOIN books b ON b.id = ob.book_id
       WHERE ob.user_id = ?
       ORDER BY ob.created_at DESC`,
      [req.user!.userId],
    );

    res.json({ items: items.map(mapOwnedBook) });
  } catch (err: any) {
    logger.error({ err }, 'List owned books error');
    res.status(500).json({ error: 'Failed to fetch owned books' });
  }
});

router.post('/owned-books', authenticate, rateLimit('owned-books-add', 120, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const bookId = normalizeText(req.body?.bookId);
    const format = normalizeText(req.body?.format).toLowerCase() as OwnedFormat;
    const conditionNote = normalizeText(req.body?.conditionNote);
    const purchaseDate = normalizeText(req.body?.purchaseDate);
    const isLendable = normalizeBoolean(req.body?.isLendable);

    if (!bookId) {
      res.status(400).json({ error: 'bookId is required' });
      return;
    }
    if (!VALID_FORMATS.includes(format)) {
      res.status(400).json({ error: `format must be one of: ${VALID_FORMATS.join(', ')}` });
      return;
    }
    if (conditionNote.length > 255) {
      res.status(400).json({ error: 'conditionNote must be 255 characters or fewer' });
      return;
    }

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? LIMIT 1', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO owned_books (id, user_id, book_id, format, condition_note, purchase_date, is_lendable)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, bookId, format, conditionNote || null, purchaseDate || null, isLendable ? 1 : 0],
    );

    const created = await dbGet<any>('SELECT * FROM owned_books WHERE id = ? LIMIT 1', [id]);
    res.status(201).json(mapOwnedBook(created));
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'You already track this format for the selected book' });
      return;
    }
    logger.error({ err }, 'Add owned book error');
    res.status(500).json({ error: 'Failed to add owned book' });
  }
});

router.put('/owned-books/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const ownedId = req.params.id;
    const format = normalizeText(req.body?.format).toLowerCase() as OwnedFormat;
    const conditionNote = normalizeText(req.body?.conditionNote);
    const purchaseDate = normalizeText(req.body?.purchaseDate);
    const isLendable = req.body?.isLendable;

    const existing = await dbGet<any>('SELECT * FROM owned_books WHERE id = ? AND user_id = ? LIMIT 1', [ownedId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Owned book entry not found' });
      return;
    }

    if (format && !VALID_FORMATS.includes(format)) {
      res.status(400).json({ error: `format must be one of: ${VALID_FORMATS.join(', ')}` });
      return;
    }
    if (conditionNote.length > 255) {
      res.status(400).json({ error: 'conditionNote must be 255 characters or fewer' });
      return;
    }

    await dbRun(
      `UPDATE owned_books
       SET format = ?,
           condition_note = ?,
           purchase_date = ?,
           is_lendable = ?
       WHERE id = ? AND user_id = ?`,
      [
        format || existing.format,
        conditionNote || null,
        purchaseDate || null,
        isLendable === undefined ? existing.is_lendable : (normalizeBoolean(isLendable) ? 1 : 0),
        ownedId,
        userId,
      ],
    );

    const updated = await dbGet<any>('SELECT * FROM owned_books WHERE id = ? LIMIT 1', [ownedId]);
    res.json(mapOwnedBook(updated));
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'You already track this format for the selected book' });
      return;
    }
    logger.error({ err }, 'Update owned book error');
    res.status(500).json({ error: 'Failed to update owned book entry' });
  }
});

router.delete('/owned-books/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const ownedId = req.params.id;
    const userId = req.user!.userId;

    const existing = await dbGet<any>('SELECT id FROM owned_books WHERE id = ? AND user_id = ? LIMIT 1', [ownedId, userId]);
    if (!existing) {
      res.status(404).json({ error: 'Owned book entry not found' });
      return;
    }

    await dbRun('DELETE FROM owned_books WHERE id = ? AND user_id = ?', [ownedId, userId]);
    res.json({ success: true, message: 'Removed from owned books' });
  } catch (err: any) {
    logger.error({ err }, 'Delete owned book error');
    res.status(500).json({ error: 'Failed to remove owned book entry' });
  }
});

router.get('/books/:id/ownership', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll<any>(
      `SELECT format
       FROM owned_books
       WHERE user_id = ? AND book_id = ?
       ORDER BY created_at ASC`,
      [req.user!.userId, req.params.id],
    );

    const formats = rows.map((row) => String(row.format));
    res.json({ owns: formats.length > 0, formats });
  } catch (err: any) {
    logger.error({ err }, 'Get book ownership error');
    res.status(500).json({ error: 'Failed to fetch ownership' });
  }
});

export default router;
