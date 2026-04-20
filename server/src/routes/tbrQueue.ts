import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { dbAll, dbGet, dbRun, dbTransaction, getPool } from '../database.js';
import { authenticate } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();
const MAX_QUEUE_ITEMS = 10;

function mapQueueItem(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    bookId: row.book_id,
    position: Number(row.position),
    addedAt: row.added_at,
    title: row.title,
    author: row.author,
    slug: row.slug,
    coverImage: row.cover_image,
    pageCount: row.page_count,
    status: row.reading_status || null,
  };
}

async function queryRows(sql: string, params: any[], conn?: PoolConnection) {
  if (conn) {
    const [rows] = await conn.query<RowDataPacket[]>(sql, params);
    return rows as any[];
  }
  return dbAll<any>(sql, params);
}

async function execSql(sql: string, params: any[], conn?: PoolConnection) {
  if (conn) {
    await conn.query(sql, params);
    return;
  }
  await dbRun(sql, params);
}

async function normalizeQueuePositions(userId: string, conn?: PoolConnection) {
  const rows = await queryRows(
    'SELECT id FROM tbr_queue WHERE user_id = ? ORDER BY position ASC, added_at ASC',
    [userId],
    conn,
  );

  for (let index = 0; index < rows.length; index++) {
    await execSql('UPDATE tbr_queue SET position = ? WHERE id = ?', [index + 1, rows[index].id], conn);
  }
}

export async function removeBookFromTbrQueue(userId: string, bookId: string): Promise<void> {
  await dbTransaction(async (conn) => {
    await execSql('DELETE FROM tbr_queue WHERE user_id = ? AND book_id = ?', [userId, bookId], conn);
    await normalizeQueuePositions(userId, conn);
  });
}

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await dbAll<any>(
      `SELECT q.*, b.title, b.author, b.slug, b.cover_image, b.page_count, rp.status AS reading_status
       FROM tbr_queue q
       JOIN books b ON b.id = q.book_id
       LEFT JOIN reading_progress rp ON rp.user_id = q.user_id AND rp.book_id = q.book_id
       WHERE q.user_id = ?
       ORDER BY q.position ASC, q.added_at ASC
       LIMIT ?`,
      [req.user!.userId, MAX_QUEUE_ITEMS],
    );

    res.json({
      items: items.map(mapQueueItem),
      maxItems: MAX_QUEUE_ITEMS,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get TBR queue error');
    res.status(500).json({ error: 'Failed to fetch your up next queue' });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const bookId = typeof req.body?.bookId === 'string' ? req.body.bookId.trim() : '';

    if (!bookId) {
      res.status(400).json({ error: 'bookId is required' });
      return;
    }

    const book = await dbGet<any>('SELECT id, page_count FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    await dbTransaction(async (conn) => {
      const duplicateRows = await queryRows(
        'SELECT id FROM tbr_queue WHERE user_id = ? AND book_id = ? LIMIT 1',
        [userId, bookId],
        conn,
      );
      if (duplicateRows.length > 0) {
        const error = new Error('duplicate');
        (error as any).status = 409;
        throw error;
      }

      const countRows = await queryRows('SELECT COUNT(*) AS total FROM tbr_queue WHERE user_id = ?', [userId], conn);
      const total = Number(countRows[0]?.total || 0);
      if (total >= MAX_QUEUE_ITEMS) {
        const error = new Error('full');
        (error as any).status = 400;
        throw error;
      }

      await execSql(
        'INSERT INTO tbr_queue (id, user_id, book_id, position) VALUES (?, ?, ?, ?)',
        [uuidv4(), userId, bookId, total + 1],
        conn,
      );

      const progressRows = await queryRows(
        'SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1',
        [userId, bookId],
        conn,
      );

      if (progressRows.length === 0) {
        await execSql(
          `INSERT INTO reading_progress (id, user_id, book_id, status, current_page, total_pages)
           VALUES (?, ?, ?, 'want-to-read', 0, ?)`,
          [uuidv4(), userId, bookId, book.page_count || 0],
          conn,
        );
      }

      await normalizeQueuePositions(userId, conn);
    });

    const added = await dbGet<any>(
      `SELECT q.*, b.title, b.author, b.slug, b.cover_image, b.page_count, rp.status AS reading_status
       FROM tbr_queue q
       JOIN books b ON b.id = q.book_id
       LEFT JOIN reading_progress rp ON rp.user_id = q.user_id AND rp.book_id = q.book_id
       WHERE q.user_id = ? AND q.book_id = ?`,
      [userId, bookId],
    );

    res.json({
      success: true,
      item: mapQueueItem(added),
      message: 'Added to your Up Next queue',
    });
  } catch (err: any) {
    if (err?.status === 409) {
      res.status(409).json({ error: 'This book is already in your Up Next queue' });
      return;
    }
    if (err?.status === 400) {
      res.status(400).json({ error: 'Your Up Next queue can only hold 10 books' });
      return;
    }
    logger.error({ err }, 'Add to TBR queue error');
    res.status(500).json({ error: 'Failed to add book to your queue' });
  }
});

router.put('/reorder', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const bookIds = Array.isArray(req.body?.bookIds)
      ? req.body.bookIds.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (bookIds.length === 0 || bookIds.length > MAX_QUEUE_ITEMS) {
      res.status(400).json({ error: 'bookIds must contain between 1 and 10 book IDs' });
      return;
    }

    const uniqueIds = new Set(bookIds);
    if (uniqueIds.size !== bookIds.length) {
      res.status(400).json({ error: 'bookIds must be unique' });
      return;
    }

    const existing = await dbAll<any>('SELECT book_id FROM tbr_queue WHERE user_id = ? ORDER BY position ASC', [userId]);
    const existingIds = existing.map((row) => row.book_id);

    if (existingIds.length !== bookIds.length || existingIds.some((id) => !uniqueIds.has(id))) {
      res.status(400).json({ error: 'bookIds must match the current queue contents' });
      return;
    }

    await dbTransaction(async (conn) => {
      for (let index = 0; index < bookIds.length; index++) {
        await execSql(
          'UPDATE tbr_queue SET position = ? WHERE user_id = ? AND book_id = ?',
          [index + 1, userId, bookIds[index]],
          conn,
        );
      }
    });

    const updated = await dbAll<any>(
      `SELECT q.*, b.title, b.author, b.slug, b.cover_image, b.page_count, rp.status AS reading_status
       FROM tbr_queue q
       JOIN books b ON b.id = q.book_id
       LEFT JOIN reading_progress rp ON rp.user_id = q.user_id AND rp.book_id = q.book_id
       WHERE q.user_id = ?
       ORDER BY q.position ASC`,
      [userId],
    );

    res.json({ success: true, items: updated.map(mapQueueItem), message: 'Queue order updated' });
  } catch (err: any) {
    logger.error({ err }, 'Reorder TBR queue error');
    res.status(500).json({ error: 'Failed to reorder your queue' });
  }
});

router.delete('/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { bookId } = req.params;

    const existing = await dbGet<any>('SELECT id FROM tbr_queue WHERE user_id = ? AND book_id = ? LIMIT 1', [userId, bookId]);
    if (!existing) {
      res.status(404).json({ error: 'Book is not in your queue' });
      return;
    }

    await removeBookFromTbrQueue(userId, bookId);
    res.json({ success: true, message: 'Removed from your Up Next queue' });
  } catch (err: any) {
    logger.error({ err }, 'Delete TBR queue item error');
    res.status(500).json({ error: 'Failed to remove the book from your queue' });
  }
});

export default router;
