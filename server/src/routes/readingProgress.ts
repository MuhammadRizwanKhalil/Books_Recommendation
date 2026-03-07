import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate } from '../middleware.js';

const router = Router();

const VALID_STATUSES = ['want-to-read', 'reading', 'finished'] as const;

function mapProgress(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    status: row.status,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    personalRating: row.personal_rating ? parseFloat(row.personal_rating) : null,
    notes: row.notes || null,
    // If joined with books
    ...(row.title && {
      title: row.title,
      author: row.author,
      slug: row.book_slug || row.slug,
      coverImage: row.cover_image || null,
      pageCount: row.page_count,
    }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── GET /api/reading-progress — Get all reading progress for current user ────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    let where = 'WHERE rp.user_id = ?';
    const params: any[] = [req.user!.userId];

    if (status && VALID_STATUSES.includes(status as any)) {
      where += ' AND rp.status = ?';
      params.push(status);
    }

    const [items, countRow] = await Promise.all([
      dbAll<any>(`
        SELECT rp.*, b.title, b.author, b.slug as book_slug, b.cover_image, b.page_count
        FROM reading_progress rp
        JOIN books b ON b.id = rp.book_id
        ${where}
        ORDER BY rp.updated_at DESC
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]),
      dbGet<any>(`SELECT COUNT(*) as total FROM reading_progress rp ${where}`, params),
    ]);

    // Stats
    const stats = await dbGet<any>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'want-to-read' THEN 1 ELSE 0 END) AS wantToRead,
        SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END) AS reading,
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) AS finished,
        SUM(CASE WHEN status = 'finished' THEN total_pages ELSE current_page END) AS totalPagesRead
      FROM reading_progress
      WHERE user_id = ?
    `, [req.user!.userId]);

    res.json({
      items: items.map(mapProgress),
      stats: {
        total: stats?.total || 0,
        wantToRead: stats?.wantToRead || 0,
        reading: stats?.reading || 0,
        finished: stats?.finished || 0,
        totalPagesRead: stats?.totalPagesRead || 0,
      },
      pagination: {
        page,
        limit,
        total: countRow?.total || 0,
        totalPages: Math.ceil((countRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Get reading progress error');
    res.status(500).json({ error: 'Failed to fetch reading progress' });
  }
});

// ── GET /api/reading-progress/:bookId — Get progress for a specific book ─────
router.get('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const row = await dbGet<any>(
      'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, req.params.bookId]
    );

    if (!row) {
      res.json({ progress: null });
      return;
    }

    res.json({ progress: mapProgress(row) });
  } catch (err: any) {
    logger.error({ err }, 'Get book progress error');
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// ── PUT /api/reading-progress/:bookId — Set/update progress for a book ───────
router.put('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const { status, currentPage, totalPages, startedAt, finishedAt, personalRating, notes } = req.body;

    // Validate book
    const book = await dbGet<any>('SELECT id, page_count FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}` });
      return;
    }

    if (personalRating !== undefined && personalRating !== null) {
      const r = parseFloat(personalRating);
      if (isNaN(r) || r < 0 || r > 5) {
        res.status(400).json({ error: 'personalRating must be between 0 and 5' });
        return;
      }
    }

    const existing = await dbGet<any>(
      'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, bookId]
    );

    const effectiveStatus = status || existing?.status || 'want-to-read';
    const effectivePages = totalPages ?? existing?.total_pages ?? book.page_count ?? 0;

    // Auto-set dates
    let effectiveStarted = startedAt ?? existing?.started_at ?? null;
    let effectiveFinished = finishedAt ?? existing?.finished_at ?? null;

    if (effectiveStatus === 'reading' && !effectiveStarted) {
      effectiveStarted = new Date().toISOString().substring(0, 10);
    }
    if (effectiveStatus === 'finished' && !effectiveFinished) {
      effectiveFinished = new Date().toISOString().substring(0, 10);
      if (!effectiveStarted) effectiveStarted = effectiveFinished;
    }

    if (existing) {
      await dbRun(`
        UPDATE reading_progress SET
          status = ?, current_page = ?, total_pages = ?,
          started_at = ?, finished_at = ?,
          personal_rating = ?, notes = ?
        WHERE id = ?
      `, [
        effectiveStatus,
        currentPage ?? existing.current_page ?? 0,
        effectivePages,
        effectiveStarted, effectiveFinished,
        personalRating ?? existing.personal_rating ?? null,
        notes ?? existing.notes ?? null,
        existing.id,
      ]);
    } else {
      const id = uuidv4();
      await dbRun(`
        INSERT INTO reading_progress (id, user_id, book_id, status, current_page, total_pages, started_at, finished_at, personal_rating, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, req.user!.userId, bookId, effectiveStatus,
        currentPage ?? 0, effectivePages,
        effectiveStarted, effectiveFinished,
        personalRating ?? null, notes ?? null,
      ]);
    }

    const updated = await dbGet<any>(
      'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, bookId]
    );

    res.json({ progress: mapProgress(updated) });
  } catch (err: any) {
    logger.error({ err }, 'Update reading progress error');
    res.status(500).json({ error: 'Failed to update reading progress' });
  }
});

// ── DELETE /api/reading-progress/:bookId — Remove progress tracking ──────────
router.delete('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    await dbRun(
      'DELETE FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, req.params.bookId]
    );
    res.json({ success: true, message: 'Progress removed' });
  } catch (err: any) {
    logger.error({ err }, 'Delete reading progress error');
    res.status(500).json({ error: 'Failed to remove progress' });
  }
});

export default router;
