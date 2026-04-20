import { Router, Request, Response } from 'express';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun } from '../database.js';

const router = Router();

/**
 * Refresh the cached reading counts for a specific book.
 * Called automatically when any reading progress is updated.
 */
export async function refreshReadingCounts(bookId: string): Promise<void> {
  try {
    await dbRun(`
      INSERT INTO book_reading_counts (book_id, currently_reading, want_to_read, have_read, dnf, total)
      SELECT
        ? AS book_id,
        SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'want-to-read' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END),
        SUM(CASE WHEN status = 'dnf' THEN 1 ELSE 0 END),
        COUNT(*)
      FROM reading_progress
      WHERE book_id = ?
      ON DUPLICATE KEY UPDATE
        currently_reading = VALUES(currently_reading),
        want_to_read = VALUES(want_to_read),
        have_read = VALUES(have_read),
        dnf = VALUES(dnf),
        total = VALUES(total)
    `, [bookId, bookId]);
  } catch (err) {
    logger.error({ err, bookId }, 'Failed to refresh reading counts cache');
  }
}

// ── GET /api/reading-counts/books/:bookId ───────────────────────────────────
router.get('/books/:bookId', async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;

    // Verify book exists
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Try cache table first
    let row = await dbGet<any>(
      'SELECT currently_reading, want_to_read, have_read, dnf, total FROM book_reading_counts WHERE book_id = ?',
      [bookId],
    );

    // If no cached row, compute live and cache it
    if (!row) {
      row = await dbGet<any>(`
        SELECT
          COALESCE(SUM(CASE WHEN status = 'reading' THEN 1 ELSE 0 END), 0) AS currently_reading,
          COALESCE(SUM(CASE WHEN status = 'want-to-read' THEN 1 ELSE 0 END), 0) AS want_to_read,
          COALESCE(SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END), 0) AS have_read,
          COALESCE(SUM(CASE WHEN status = 'dnf' THEN 1 ELSE 0 END), 0) AS dnf,
          COALESCE(COUNT(*), 0) AS total
        FROM reading_progress
        WHERE book_id = ?
      `, [bookId]);

      // Cache the result (non-blocking)
      setImmediate(() => refreshReadingCounts(String(bookId)));
    }

    res.json({
      currentlyReading: row?.currently_reading ?? 0,
      wantToRead: row?.want_to_read ?? 0,
      haveRead: row?.have_read ?? 0,
      dnf: row?.dnf ?? 0,
      total: row?.total ?? 0,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get reading counts error');
    res.status(500).json({ error: 'Failed to fetch reading counts' });
  }
});

export default router;
