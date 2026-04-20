import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate } from '../middleware.js';
import { refreshReadingCounts } from './readingCounts.js';
import { refreshChallengeCount } from './readingChallenge.js';
import { refreshStreak } from './userStats.js';
import { removeBookFromTbrQueue } from './tbrQueue.js';
import { recordUserActivity, type ActivityType } from '../services/activityFeed.js';

const router = Router();

const VALID_STATUSES = ['want-to-read', 'reading', 'finished', 'dnf'] as const;

function parseNumericInput(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function clampPercentage(value: number) {
  if (!Number.isFinite(value)) return null;
  return Math.max(0, Math.min(100, Number(value.toFixed(2))));
}

function calculatePercentageFromPages(currentPage: number | null, totalPages: number | null) {
  if (currentPage === null || totalPages === null || totalPages <= 0) return null;
  return clampPercentage((currentPage / totalPages) * 100);
}

function getProgressActivityType(previousStatus: string | null | undefined, nextStatus: string, hasExplicitPageUpdate: boolean): ActivityType | null {
  if (nextStatus === 'finished' && previousStatus !== 'finished') return 'finished';
  if (nextStatus === 'dnf' && previousStatus !== 'dnf') return 'dnf';
  if (nextStatus === 'reading' && previousStatus !== 'reading') return 'started';
  if (nextStatus === 'want-to-read' && previousStatus !== 'want-to-read') return 'shelved';
  if (nextStatus === 'reading' && hasExplicitPageUpdate) return 'progress';
  return null;
}

function mapProgress(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    status: row.status,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    percentage: row.percentage !== null && row.percentage !== undefined ? parseFloat(row.percentage) : null,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    personalRating: row.personal_rating ? parseFloat(row.personal_rating) : null,
    notes: row.notes || null,
    dnfPercentage: row.dnf_percentage ?? null,
    dnfReason: row.dnf_reason || null,
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

function mapProgressHistory(row: any) {
  return {
    id: row.id,
    readingProgressId: row.reading_progress_id,
    currentPage: row.current_page,
    percentage: row.percentage !== null && row.percentage !== undefined ? parseFloat(row.percentage) : null,
    note: row.note || null,
    loggedAt: row.logged_at,
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
        SUM(CASE WHEN status = 'dnf' THEN 1 ELSE 0 END) AS dnf,
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
        dnf: stats?.dnf || 0,
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
    const { status, currentPage, totalPages, startedAt, finishedAt, personalRating, notes, dnfPercentage, dnfReason } = req.body;

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

    // Validate DNF fields
    if (dnfPercentage !== undefined && dnfPercentage !== null) {
      const p = parseInt(dnfPercentage, 10);
      if (isNaN(p) || p < 0 || p > 100) {
        res.status(400).json({ error: 'dnfPercentage must be between 0 and 100' });
        return;
      }
    }
    if (dnfReason !== undefined && dnfReason !== null && typeof dnfReason === 'string' && dnfReason.length > 500) {
      res.status(400).json({ error: 'dnfReason must be 500 characters or fewer' });
      return;
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

    // DNF fields: only keep when status is 'dnf', clear otherwise
    const effectiveDnfPercentage = effectiveStatus === 'dnf'
      ? (dnfPercentage ?? existing?.dnf_percentage ?? null)
      : null;
    const effectiveDnfReason = effectiveStatus === 'dnf'
      ? (dnfReason ?? existing?.dnf_reason ?? null)
      : null;

    const effectiveCurrentPage = currentPage ?? existing?.current_page ?? 0;
    const effectivePercentage = calculatePercentageFromPages(effectiveCurrentPage, effectivePages);

    if (existing) {
      await dbRun(`
        UPDATE reading_progress SET
          status = ?, current_page = ?, total_pages = ?,
          percentage = ?,
          started_at = ?, finished_at = ?,
          personal_rating = ?, notes = ?,
          dnf_percentage = ?, dnf_reason = ?
        WHERE id = ?
      `, [
        effectiveStatus,
        effectiveCurrentPage,
        effectivePages,
        effectivePercentage,
        effectiveStarted, effectiveFinished,
        personalRating ?? existing.personal_rating ?? null,
        notes ?? existing.notes ?? null,
        effectiveDnfPercentage, effectiveDnfReason,
        existing.id,
      ]);
    } else {
      const id = uuidv4();
      await dbRun(`
        INSERT INTO reading_progress (id, user_id, book_id, status, current_page, total_pages, percentage, started_at, finished_at, personal_rating, notes, dnf_percentage, dnf_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id, req.user!.userId, bookId, effectiveStatus,
        effectiveCurrentPage, effectivePages, effectivePercentage,
        effectiveStarted, effectiveFinished,
        personalRating ?? null, notes ?? null,
        effectiveDnfPercentage, effectiveDnfReason,
      ]);
    }

    const updated = await dbGet<any>(
      'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, bookId]
    );

    res.json({ progress: mapProgress(updated) });

    const activityType = getProgressActivityType(existing?.status, effectiveStatus, currentPage !== undefined);
    if (activityType) {
      setImmediate(() => {
        recordUserActivity({
          userId: req.user!.userId,
          type: activityType,
          bookId,
          referenceId: updated?.id || null,
          metadata: {
            status: effectiveStatus,
            currentPage: updated?.current_page ?? 0,
            totalPages: updated?.total_pages ?? effectivePages ?? 0,
          },
        }).catch(() => undefined);
      });
    }

    if (['reading', 'finished', 'dnf'].includes(effectiveStatus)) {
      setImmediate(() => {
        removeBookFromTbrQueue(req.user!.userId, String(bookId)).catch(() => undefined);
      });
    }

    // Refresh reading counts cache (non-blocking)
    setImmediate(() => refreshReadingCounts(String(bookId)));

    // Refresh annual reading challenge count when status changes to/from finished
    if (effectiveStatus === 'finished' || existing?.status === 'finished') {
      setImmediate(() => refreshChallengeCount(req.user!.userId));
    }

    // Refresh reading streak (any reading activity counts)
    setImmediate(() => refreshStreak(req.user!.userId));
  } catch (err: any) {
    logger.error({ err }, 'Update reading progress error');
    res.status(500).json({ error: 'Failed to update reading progress' });
  }
});

// ── PUT /api/reading-progress/:bookId/update — Update page/percentage progress ──
router.put('/:bookId/update', authenticate, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const currentPageRaw = parseNumericInput(req.body?.currentPage);
    const percentageRaw = parseNumericInput(req.body?.percentage);
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';

    if (Number.isNaN(currentPageRaw) || Number.isNaN(percentageRaw)) {
      res.status(400).json({ error: 'currentPage and percentage must be valid numbers' });
      return;
    }

    if (note.length > 500) {
      res.status(400).json({ error: 'note must be 500 characters or fewer' });
      return;
    }

    const progress = await dbGet<any>(
      `SELECT rp.*, b.page_count
       FROM reading_progress rp
       JOIN books b ON b.id = rp.book_id
       WHERE rp.user_id = ? AND rp.book_id = ?`,
      [req.user!.userId, bookId],
    );

    if (!progress) {
      res.status(404).json({ error: 'Reading progress not found for this book' });
      return;
    }

    if (progress.status !== 'reading') {
      res.status(400).json({ error: 'Book must be in reading status to update progress' });
      return;
    }

    const totalPages = progress.total_pages || progress.page_count || 0;
    const currentPage = currentPageRaw !== null ? Math.floor(currentPageRaw) : null;

    if (currentPage !== null && (currentPage < 0 || !Number.isFinite(currentPage))) {
      res.status(400).json({ error: 'currentPage must be a non-negative number' });
      return;
    }

    if (totalPages > 0 && currentPage !== null && currentPage > totalPages) {
      res.status(400).json({ error: 'currentPage cannot exceed total pages' });
      return;
    }

    if (percentageRaw !== null && (percentageRaw < 0 || percentageRaw > 100)) {
      res.status(400).json({ error: 'percentage must be between 0 and 100' });
      return;
    }

    const effectiveCurrentPage = currentPage ?? progress.current_page;
    const computedPercentage = currentPage !== null
      ? calculatePercentageFromPages(effectiveCurrentPage, totalPages)
      : null;
    const effectivePercentage = computedPercentage ?? clampPercentage(percentageRaw ?? progress.percentage ?? 0);

    await dbRun(
      `UPDATE reading_progress
       SET current_page = ?, percentage = ?
       WHERE id = ?`,
      [effectiveCurrentPage, effectivePercentage, progress.id],
    );

    const historyId = uuidv4();
    await dbRun(
      `INSERT INTO reading_progress_history (id, reading_progress_id, current_page, percentage, note)
       VALUES (?, ?, ?, ?, ?)`,
      [historyId, progress.id, effectiveCurrentPage, effectivePercentage, note || null],
    );

    const updated = await dbGet<any>(
      'SELECT * FROM reading_progress WHERE id = ? LIMIT 1',
      [progress.id],
    );

    res.json({ progress: mapProgress(updated) });

    setImmediate(() => {
      recordUserActivity({
        userId: req.user!.userId,
        type: 'progress',
        bookId,
        referenceId: updated?.id || null,
        metadata: {
          status: updated?.status,
          currentPage: updated?.current_page ?? 0,
          totalPages: updated?.total_pages ?? totalPages,
          percentage: updated?.percentage ?? null,
        },
      }).catch(() => undefined);
    });
  } catch (err: any) {
    logger.error({ err }, 'Update tracker progress error');
    res.status(500).json({ error: 'Failed to update tracker progress' });
  }
});

// ── GET /api/reading-progress/:bookId/history — Progress update timeline ─────
router.get('/:bookId/history', authenticate, async (req: Request, res: Response) => {
  try {
    const progress = await dbGet<any>(
      'SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1',
      [req.user!.userId, req.params.bookId],
    );

    if (!progress) {
      res.json({ history: [] });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT *
       FROM reading_progress_history
       WHERE reading_progress_id = ?
       ORDER BY logged_at DESC`,
      [progress.id],
    );

    res.json({ history: rows.map(mapProgressHistory) });
  } catch (err: any) {
    logger.error({ err }, 'Get progress history error');
    res.status(500).json({ error: 'Failed to fetch progress history' });
  }
});

// ── DELETE /api/reading-progress/:bookId — Remove progress tracking ──────────
router.delete('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    // Check if the book was finished (affects challenge count)
    const existing = await dbGet<any>(
      'SELECT status FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, req.params.bookId]
    );

    await dbRun(
      'DELETE FROM reading_progress WHERE user_id = ? AND book_id = ?',
      [req.user!.userId, req.params.bookId]
    );
    res.json({ success: true, message: 'Progress removed' });

    // Refresh reading counts cache (non-blocking)
    setImmediate(() => refreshReadingCounts(String(req.params.bookId)));

    // Refresh challenge count if the removed book was finished
    if (existing?.status === 'finished') {
      setImmediate(() => refreshChallengeCount(req.user!.userId));
    }
  } catch (err: any) {
    logger.error({ err }, 'Delete reading progress error');
    res.status(500).json({ error: 'Failed to remove progress' });
  }
});

export default router;
