import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate } from '../middleware.js';

const router = Router();

// ── Helper: generate slug ────────────────────────────────────────────────────
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 250);
}

// ── Helper: map list row to response ─────────────────────────────────────────
function mapList(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || null,
    name: row.name,
    slug: row.slug,
    description: row.description || null,
    coverImage: row.cover_image || null,
    isPublic: !!row.is_public,
    bookCount: row.book_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapListItem(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    slug: row.book_slug,
    coverImage: row.cover_image || null,
    googleRating: row.google_rating,
    ratingsCount: row.ratings_count,
    computedScore: row.computed_score,
    publishedDate: row.published_date,
    categories: row.categories ? row.categories.split(',').filter(Boolean) : [],
    price: row.price,
    currency: row.currency,
    amazonUrl: row.amazon_url,
    notes: row.notes || null,
    sortOrder: row.sort_order,
    addedAt: row.added_at,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/reading-lists/public — Browse public lists ──────────────────────
router.get('/public', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const [lists, countRow] = await Promise.all([
      dbAll<any>(`
        SELECT rl.*, u.name as user_name
        FROM reading_lists rl
        JOIN users u ON u.id = rl.user_id
        WHERE rl.is_public = TRUE AND rl.book_count > 0
        ORDER BY rl.updated_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]),
      dbGet<any>('SELECT COUNT(*) as total FROM reading_lists WHERE is_public = TRUE AND book_count > 0'),
    ]);

    res.json({
      lists: lists.map(mapList),
      pagination: {
        page,
        limit,
        total: countRow?.total || 0,
        totalPages: Math.ceil((countRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'List public reading lists error');
    res.status(500).json({ error: 'Failed to fetch reading lists' });
  }
});

// ── GET /api/reading-lists/public/:userId/:slug — View a public list ─────────
router.get('/public/:userId/:slug', async (req: Request, res: Response) => {
  try {
    const { userId, slug } = req.params;
    const list = await dbGet<any>(`
      SELECT rl.*, u.name as user_name
      FROM reading_lists rl
      JOIN users u ON u.id = rl.user_id
      WHERE rl.user_id = ? AND rl.slug = ? AND rl.is_public = TRUE
    `, [userId, slug]);

    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    const items = await dbAll<any>(`
      SELECT rli.*, b.title, b.author, b.slug as book_slug, b.cover_image,
             b.google_rating, b.ratings_count, b.computed_score,
             b.published_date, b.price, b.currency, b.amazon_url,
             GROUP_CONCAT(DISTINCT c.name) as categories
      FROM reading_list_items rli
      JOIN books b ON b.id = rli.book_id
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      LEFT JOIN categories c ON c.id = bc.category_id
      WHERE rli.list_id = ?
      GROUP BY rli.id
      ORDER BY rli.sort_order ASC, rli.added_at DESC
    `, [list.id]);

    res.json({
      ...mapList(list),
      items: items.map(mapListItem),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get public reading list error');
    res.status(500).json({ error: 'Failed to fetch reading list' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATED ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── GET /api/reading-lists — Get current user's reading lists ────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const lists = await dbAll<any>(`
      SELECT * FROM reading_lists WHERE user_id = ? ORDER BY updated_at DESC
    `, [req.user!.userId]);

    res.json({ lists: lists.map(mapList) });
  } catch (err: any) {
    logger.error({ err }, 'Get user reading lists error');
    res.status(500).json({ error: 'Failed to fetch reading lists' });
  }
});

// ── POST /api/reading-lists — Create a new reading list ──────────────────────
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, description, isPublic, coverImage } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'List name is required' });
      return;
    }
    if (name.trim().length > 255) {
      res.status(400).json({ error: 'List name cannot exceed 255 characters' });
      return;
    }

    const id = uuidv4();
    const baseSlug = toSlug(name.trim());

    // Ensure unique slug per user
    let slug = baseSlug;
    let tries = 0;
    while (tries < 20) {
      const existing = await dbGet<any>(
        'SELECT id FROM reading_lists WHERE user_id = ? AND slug = ?',
        [req.user!.userId, slug]
      );
      if (!existing) break;
      tries++;
      slug = `${baseSlug}-${tries}`;
    }

    await dbRun(`
      INSERT INTO reading_lists (id, user_id, name, slug, description, cover_image, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user!.userId, name.trim(), slug, description || null, coverImage || null, isPublic !== false ? 1 : 0]);

    const list = await dbGet<any>('SELECT * FROM reading_lists WHERE id = ?', [id]);
    res.status(201).json(mapList(list));
  } catch (err: any) {
    logger.error({ err }, 'Create reading list error');
    res.status(500).json({ error: 'Failed to create reading list' });
  }
});

// ── GET /api/reading-lists/:id — Get a specific list with items ──────────────
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT * FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    const items = await dbAll<any>(`
      SELECT rli.*, b.title, b.author, b.slug as book_slug, b.cover_image,
             b.google_rating, b.ratings_count, b.computed_score,
             b.published_date, b.price, b.currency, b.amazon_url,
             GROUP_CONCAT(DISTINCT c.name) as categories
      FROM reading_list_items rli
      JOIN books b ON b.id = rli.book_id
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      LEFT JOIN categories c ON c.id = bc.category_id
      WHERE rli.list_id = ?
      GROUP BY rli.id
      ORDER BY rli.sort_order ASC, rli.added_at DESC
    `, [list.id]);

    res.json({
      ...mapList(list),
      items: items.map(mapListItem),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get reading list error');
    res.status(500).json({ error: 'Failed to fetch reading list' });
  }
});

// ── PUT /api/reading-lists/:id — Update a reading list ───────────────────────
router.put('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT * FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    const { name, description, isPublic, coverImage } = req.body;

    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({ error: 'List name cannot be empty' });
      return;
    }

    // Regenerate slug if name changed
    let newSlug = list.slug;
    if (name && name.trim() !== list.name) {
      newSlug = toSlug(name.trim());
      let tries = 0;
      while (tries < 20) {
        const existing = await dbGet<any>(
          'SELECT id FROM reading_lists WHERE user_id = ? AND slug = ? AND id != ?',
          [req.user!.userId, newSlug, list.id]
        );
        if (!existing) break;
        tries++;
        newSlug = `${toSlug(name.trim())}-${tries}`;
      }
    }

    await dbRun(`
      UPDATE reading_lists SET
        name = COALESCE(?, name),
        slug = ?,
        description = COALESCE(?, description),
        cover_image = COALESCE(?, cover_image),
        is_public = COALESCE(?, is_public)
      WHERE id = ?
    `, [
      name?.trim() ?? null, newSlug,
      description ?? null, coverImage ?? null,
      isPublic !== undefined ? (isPublic ? 1 : 0) : null,
      list.id,
    ]);

    const updated = await dbGet<any>('SELECT * FROM reading_lists WHERE id = ?', [list.id]);
    res.json(mapList(updated));
  } catch (err: any) {
    logger.error({ err }, 'Update reading list error');
    res.status(500).json({ error: 'Failed to update reading list' });
  }
});

// ── DELETE /api/reading-lists/:id — Delete a reading list ────────────────────
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT id FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    await dbRun('DELETE FROM reading_lists WHERE id = ?', [list.id]);
    res.json({ success: true, message: 'Reading list deleted' });
  } catch (err: any) {
    logger.error({ err }, 'Delete reading list error');
    res.status(500).json({ error: 'Failed to delete reading list' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIST ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/reading-lists/:id/books — Add a book to the list ───────────────
router.post('/:id/books', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT id FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    const { bookId, notes } = req.body;
    if (!bookId) {
      res.status(400).json({ error: 'bookId is required' });
      return;
    }

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Check if already in list
    const existing = await dbGet<any>(
      'SELECT id FROM reading_list_items WHERE list_id = ? AND book_id = ?',
      [list.id, bookId]
    );
    if (existing) {
      res.status(409).json({ error: 'Book already in this list' });
      return;
    }

    // Get next sort order
    const maxOrder = await dbGet<any>(
      'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM reading_list_items WHERE list_id = ?',
      [list.id]
    );

    const itemId = uuidv4();
    await dbRun(`
      INSERT INTO reading_list_items (id, list_id, book_id, notes, sort_order)
      VALUES (?, ?, ?, ?, ?)
    `, [itemId, list.id, bookId, notes || null, (maxOrder?.max_order ?? -1) + 1]);

    // Update book count
    await dbRun(
      'UPDATE reading_lists SET book_count = (SELECT COUNT(*) FROM reading_list_items WHERE list_id = ?) WHERE id = ?',
      [list.id, list.id]
    );

    res.status(201).json({ success: true, itemId, message: 'Book added to list' });
  } catch (err: any) {
    logger.error({ err }, 'Add book to reading list error');
    res.status(500).json({ error: 'Failed to add book to list' });
  }
});

// ── DELETE /api/reading-lists/:id/books/:bookId — Remove a book ──────────────
router.delete('/:id/books/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT id FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    await dbRun(
      'DELETE FROM reading_list_items WHERE list_id = ? AND book_id = ?',
      [list.id, req.params.bookId]
    );

    // Update book count
    await dbRun(
      'UPDATE reading_lists SET book_count = (SELECT COUNT(*) FROM reading_list_items WHERE list_id = ?) WHERE id = ?',
      [list.id, list.id]
    );

    res.json({ success: true, message: 'Book removed from list' });
  } catch (err: any) {
    logger.error({ err }, 'Remove book from reading list error');
    res.status(500).json({ error: 'Failed to remove book from list' });
  }
});

// ── PUT /api/reading-lists/:id/books/reorder — Reorder items ─────────────────
router.put('/:id/books/reorder', authenticate, async (req: Request, res: Response) => {
  try {
    const list = await dbGet<any>(
      'SELECT id FROM reading_lists WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    if (!list) {
      res.status(404).json({ error: 'Reading list not found' });
      return;
    }

    const { order } = req.body; // [{ bookId: string, sortOrder: number }]
    if (!Array.isArray(order)) {
      res.status(400).json({ error: 'order must be an array of { bookId, sortOrder }' });
      return;
    }

    for (const item of order) {
      if (item.bookId && typeof item.sortOrder === 'number') {
        await dbRun(
          'UPDATE reading_list_items SET sort_order = ? WHERE list_id = ? AND book_id = ?',
          [item.sortOrder, list.id, item.bookId]
        );
      }
    }

    res.json({ success: true, message: 'Order updated' });
  } catch (err: any) {
    logger.error({ err }, 'Reorder reading list error');
    res.status(500).json({ error: 'Failed to reorder list' });
  }
});

// ── GET /api/reading-lists/book/:bookId — Check which lists contain a book ───
router.get('/book/:bookId', authenticate, async (req: Request, res: Response) => {
  try {
    const lists = await dbAll<any>(`
      SELECT rl.id, rl.name, rl.slug
      FROM reading_lists rl
      JOIN reading_list_items rli ON rli.list_id = rl.id
      WHERE rl.user_id = ? AND rli.book_id = ?
    `, [req.user!.userId, req.params.bookId]);

    res.json({ lists });
  } catch (err: any) {
    logger.error({ err }, 'Check book in lists error');
    res.status(500).json({ error: 'Failed to check lists' });
  }
});

export default router;
