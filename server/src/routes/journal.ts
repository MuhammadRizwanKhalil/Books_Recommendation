import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

const router = Router();

const ENTRY_TYPES = new Set(['note', 'quote', 'highlight', 'reaction']);

function normalizeEntryType(value: unknown): string {
  const type = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ENTRY_TYPES.has(type) ? type : 'note';
}

function normalizeContent(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeChapter(value: unknown): string | null | '' | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) return '';
  return trimmed;
}

function normalizePageNumber(value: unknown): number | null | '' | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0 || n > 10000) return '';
  return n;
}

function mapEntry(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    entryType: row.entry_type,
    content: row.content,
    pageNumber: row.page_number === null ? null : Number(row.page_number),
    chapter: row.chapter || null,
    isPrivate: !!row.is_private,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    book: row.book_title ? {
      id: row.book_id,
      title: row.book_title,
      slug: row.book_slug,
      author: row.book_author,
      coverImage: row.book_cover_image,
    } : undefined,
  };
}

// GET /api/journal?bookId=uuid - current user's journal entries
router.get('/journal', authenticate, async (req: Request, res: Response) => {
  try {
    const rawBookId = req.query.bookId;
    const bookId = typeof rawBookId === 'string' ? rawBookId.trim() : '';

    if (bookId) {
      const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookId, bookId]);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const rows = await dbAll<any>(
        `SELECT je.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
         FROM journal_entries je
         JOIN books b ON b.id = je.book_id
         WHERE je.user_id = ? AND je.book_id = ?
         ORDER BY je.created_at DESC`,
        [req.user!.userId, book.id],
      );

      res.json({ entries: rows.map(mapEntry) });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT je.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM journal_entries je
       JOIN books b ON b.id = je.book_id
       WHERE je.user_id = ?
       ORDER BY je.created_at DESC`,
      [req.user!.userId],
    );

    res.json({ entries: rows.map(mapEntry) });
  } catch (err: any) {
    logger.error({ err }, 'List reading journal entries error');
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// POST /api/journal - create journal entry
router.post('/journal', authenticate, rateLimit('journal-create', 120, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const bookId = String(req.body?.bookId || '').trim();
    const content = normalizeContent(req.body?.content);
    const entryType = normalizeEntryType(req.body?.entryType);
    const pageNumber = normalizePageNumber(req.body?.pageNumber);
    const chapter = normalizeChapter(req.body?.chapter);
    const isPrivate = req.body?.isPrivate === undefined ? true : !!req.body?.isPrivate;

    if (!bookId) {
      res.status(400).json({ error: 'bookId is required' });
      return;
    }
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    if (content.length > 5000) {
      res.status(400).json({ error: 'content cannot exceed 5000 characters' });
      return;
    }
    if (pageNumber === '') {
      res.status(400).json({ error: 'pageNumber must be a positive integer <= 10000' });
      return;
    }
    if (chapter === '') {
      res.status(400).json({ error: 'chapter cannot exceed 100 characters' });
      return;
    }

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookId, bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO journal_entries (id, user_id, book_id, entry_type, content, page_number, chapter, is_private)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user!.userId, book.id, entryType, content, pageNumber, chapter, isPrivate ? 1 : 0],
    );

    const created = await dbGet<any>(
      `SELECT je.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM journal_entries je
       JOIN books b ON b.id = je.book_id
       WHERE je.id = ? LIMIT 1`,
      [id],
    );

    res.status(201).json({ entry: mapEntry(created) });
  } catch (err: any) {
    logger.error({ err }, 'Create reading journal entry error');
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// PUT /api/journal/:id - update own journal entry
router.put('/journal/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }

    const existing = await dbGet<any>('SELECT * FROM journal_entries WHERE id = ? LIMIT 1', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }
    if (existing.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only edit your own entries' });
      return;
    }

    const content = req.body?.content !== undefined ? normalizeContent(req.body?.content) : existing.content;
    const entryType = req.body?.entryType !== undefined ? normalizeEntryType(req.body?.entryType) : existing.entry_type;
    const pageNumberRaw = req.body?.pageNumber !== undefined ? normalizePageNumber(req.body?.pageNumber) : existing.page_number;
    const chapterRaw = req.body?.chapter !== undefined ? normalizeChapter(req.body?.chapter) : existing.chapter;
    const isPrivate = req.body?.isPrivate !== undefined ? !!req.body?.isPrivate : !!existing.is_private;

    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }
    if (content.length > 5000) {
      res.status(400).json({ error: 'content cannot exceed 5000 characters' });
      return;
    }
    if (pageNumberRaw === '') {
      res.status(400).json({ error: 'pageNumber must be a positive integer <= 10000' });
      return;
    }
    if (chapterRaw === '') {
      res.status(400).json({ error: 'chapter cannot exceed 100 characters' });
      return;
    }

    await dbRun(
      `UPDATE journal_entries
       SET entry_type = ?, content = ?, page_number = ?, chapter = ?, is_private = ?
       WHERE id = ? AND user_id = ?`,
      [entryType, content, pageNumberRaw, chapterRaw, isPrivate ? 1 : 0, id, req.user!.userId],
    );

    const updated = await dbGet<any>(
      `SELECT je.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM journal_entries je
       JOIN books b ON b.id = je.book_id
       WHERE je.id = ? LIMIT 1`,
      [id],
    );

    res.json({ entry: mapEntry(updated) });
  } catch (err: any) {
    logger.error({ err }, 'Update reading journal entry error');
    res.status(500).json({ error: 'Failed to update journal entry' });
  }
});

// DELETE /api/journal/:id - delete own entry
router.delete('/journal/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) {
      res.status(400).json({ error: 'Entry id is required' });
      return;
    }

    const existing = await dbGet<any>('SELECT id, user_id FROM journal_entries WHERE id = ? LIMIT 1', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Journal entry not found' });
      return;
    }
    if (existing.user_id !== req.user!.userId) {
      res.status(403).json({ error: 'You can only delete your own entries' });
      return;
    }

    await dbRun('DELETE FROM journal_entries WHERE id = ? AND user_id = ?', [id, req.user!.userId]);
    res.json({ success: true, message: 'Journal entry deleted' });
  } catch (err: any) {
    logger.error({ err }, 'Delete reading journal entry error');
    res.status(500).json({ error: 'Failed to delete journal entry' });
  }
});

// GET /api/books/:id/quotes - public journal quotes for a book
router.get('/books/:id/quotes', optionalAuth, async (req: Request, res: Response) => {
  try {
    const bookRef = String(req.params.id || '').trim();
    const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookRef, bookRef]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT je.id, je.book_id, je.entry_type, je.content, je.page_number, je.chapter, je.created_at,
              u.id AS user_id, u.name AS user_name, u.avatar_url AS user_avatar
       FROM journal_entries je
       JOIN users u ON u.id = je.user_id
       WHERE je.book_id = ?
         AND je.is_private = 0
         AND je.entry_type = 'quote'
       ORDER BY je.created_at DESC
       LIMIT ?`,
      [book.id, limit],
    );

    res.json({
      quotes: rows.map((row) => ({
        id: row.id,
        bookId: row.book_id,
        entryType: row.entry_type,
        content: row.content,
        pageNumber: row.page_number === null ? null : Number(row.page_number),
        chapter: row.chapter || null,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          name: row.user_name,
          avatarUrl: row.user_avatar || null,
        },
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'List public book journal quotes error');
    res.status(500).json({ error: 'Failed to fetch book quotes' });
  }
});

export default router;
