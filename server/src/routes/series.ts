import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/series — List all series (paginated, searchable) ───────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses: string[] = [];
    let params: any[] = [];

    if (search && typeof search === 'string' && search.trim()) {
      whereClauses.push('name LIKE ?');
      params.push(`%${search.trim()}%`);
    }

    const whereSQL = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = await dbGet<any>(`SELECT COUNT(*) as total FROM book_series ${whereSQL}`, params);
    const total = countRow?.total || 0;

    const series = await dbAll<any>(
      `SELECT * FROM book_series ${whereSQL} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    res.json({
      series: series.map(mapSeriesToResponse),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'List series error');
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// ── GET /api/series/:slug — Get series detail with all books ────────────────
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const series = await dbGet<any>(
      'SELECT * FROM book_series WHERE slug = ?',
      [req.params.slug]
    );

    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    // Get all books in the series, ordered by position
    const books = await dbAll<any>(`
      SELECT 
        b.id, b.title, b.slug, b.author, b.cover_image, b.page_count,
        b.google_rating, b.computed_score, b.published_date, b.description,
        bse.position, bse.is_main_entry,
        a.id AS author_id, a.name AS author_name, a.slug AS author_slug, a.image_url AS author_image
      FROM book_series_entries bse
      JOIN books b ON b.id = bse.book_id
      LEFT JOIN book_authors ba ON ba.book_id = b.id AND ba.position = 1
      LEFT JOIN authors a ON a.id = ba.author_id
      WHERE bse.series_id = ?
      ORDER BY bse.position ASC
    `, [series.id]);

    res.json({
      ...mapSeriesToResponse(series),
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        slug: b.slug,
        author: b.author,
        coverImage: b.cover_image,
        pageCount: b.page_count,
        googleRating: b.google_rating,
        computedScore: b.computed_score,
        publishedDate: b.published_date,
        description: b.description,
        position: parseFloat(b.position),
        isMainEntry: !!b.is_main_entry,
        authorData: b.author_id ? {
          id: b.author_id,
          name: b.author_name,
          slug: b.author_slug,
          imageUrl: b.author_image || null,
        } : null,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get series detail error');
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// ── POST /api/series (Admin) — Create a new series ──────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, coverImage, isComplete } = req.body;

    // Validation
    const errors: string[] = [];
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('Name is required');
    }
    if (name && name.length > 500) {
      errors.push('Name must be under 500 characters');
    }
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    // Generate slug
    let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    let slugSuffix = 1;
    while (await dbGet<any>('SELECT id FROM book_series WHERE slug = ?', [slug])) {
      slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${slugSuffix++}`;
    }

    const id = uuidv4();
    await dbRun(`
      INSERT INTO book_series (id, name, slug, description, cover_image, is_complete)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, name.trim(), slug, description || null, coverImage || null, isComplete ? 1 : 0]);

    const created = await dbGet<any>('SELECT * FROM book_series WHERE id = ?', [id]);
    res.status(201).json(mapSeriesToResponse(created));
  } catch (err: any) {
    logger.error({ err }, 'Create series error');
    res.status(500).json({ error: 'Failed to create series' });
  }
});

// ── PUT /api/series/:id (Admin) — Update a series ───────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const series = await dbGet<any>('SELECT * FROM book_series WHERE id = ?', [req.params.id]);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const { name, description, coverImage, isComplete } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name cannot be empty' });
        return;
      }
      updates.push('name = ?');
      params.push(name.trim());

      // Regenerate slug if name changed
      let slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      let slugSuffix = 1;
      while (await dbGet<any>('SELECT id FROM book_series WHERE slug = ? AND id != ?', [slug, req.params.id])) {
        slug = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${slugSuffix++}`;
      }
      updates.push('slug = ?');
      params.push(slug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (coverImage !== undefined) {
      updates.push('cover_image = ?');
      params.push(coverImage || null);
    }
    if (isComplete !== undefined) {
      updates.push('is_complete = ?');
      params.push(isComplete ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(req.params.id);
    await dbRun(`UPDATE book_series SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = await dbGet<any>('SELECT * FROM book_series WHERE id = ?', [req.params.id]);
    res.json(mapSeriesToResponse(updated));
  } catch (err: any) {
    logger.error({ err }, 'Update series error');
    res.status(500).json({ error: 'Failed to update series' });
  }
});

// ── DELETE /api/series/:id (Admin) — Delete a series ────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const series = await dbGet<any>('SELECT * FROM book_series WHERE id = ?', [req.params.id]);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    await dbRun('DELETE FROM book_series WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Delete series error');
    res.status(500).json({ error: 'Failed to delete series' });
  }
});

// ── POST /api/series/:id/books (Admin) — Add a book to a series ─────────────
router.post('/:id/books', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const series = await dbGet<any>('SELECT * FROM book_series WHERE id = ?', [req.params.id]);
    if (!series) {
      res.status(404).json({ error: 'Series not found' });
      return;
    }

    const { bookId, position, isMainEntry } = req.body;

    // Validation
    const errors: string[] = [];
    if (!bookId || typeof bookId !== 'string') errors.push('bookId is required');
    if (position === undefined || position === null || isNaN(Number(position))) errors.push('position is required and must be a number');
    if (Number(position) < 0 || Number(position) > 99999) errors.push('position must be between 0 and 99999');
    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    // Verify book exists
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    // Check for duplicate
    const existing = await dbGet<any>(
      'SELECT id FROM book_series_entries WHERE series_id = ? AND book_id = ?',
      [req.params.id, bookId]
    );
    if (existing) {
      res.status(409).json({ error: 'Book is already in this series' });
      return;
    }

    const id = uuidv4();
    await dbRun(`
      INSERT INTO book_series_entries (id, series_id, book_id, position, is_main_entry)
      VALUES (?, ?, ?, ?, ?)
    `, [id, req.params.id, bookId, Number(position), isMainEntry !== false ? 1 : 0]);

    // Update total_books count
    await recalculateSeriesCount(String(req.params.id));

    res.status(201).json({ id, seriesId: req.params.id, bookId, position: Number(position), isMainEntry: isMainEntry !== false });
  } catch (err: any) {
    logger.error({ err }, 'Add book to series error');
    res.status(500).json({ error: 'Failed to add book to series' });
  }
});

// ── PUT /api/series/:id/books/:bookId (Admin) — Update book position ────────
router.put('/:id/books/:bookId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const entry = await dbGet<any>(
      'SELECT * FROM book_series_entries WHERE series_id = ? AND book_id = ?',
      [req.params.id, req.params.bookId]
    );
    if (!entry) {
      res.status(404).json({ error: 'Book not found in this series' });
      return;
    }

    const { position, isMainEntry } = req.body;
    const updates: string[] = [];
    const params: any[] = [];

    if (position !== undefined) {
      if (isNaN(Number(position)) || Number(position) < 0) {
        res.status(400).json({ error: 'Invalid position' });
        return;
      }
      updates.push('position = ?');
      params.push(Number(position));
    }
    if (isMainEntry !== undefined) {
      updates.push('is_main_entry = ?');
      params.push(isMainEntry ? 1 : 0);
    }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    params.push(entry.id);
    await dbRun(`UPDATE book_series_entries SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Update series entry error');
    res.status(500).json({ error: 'Failed to update series entry' });
  }
});

// ── DELETE /api/series/:id/books/:bookId (Admin) — Remove book from series ──
router.delete('/:id/books/:bookId', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const entry = await dbGet<any>(
      'SELECT id FROM book_series_entries WHERE series_id = ? AND book_id = ?',
      [req.params.id, req.params.bookId]
    );
    if (!entry) {
      res.status(404).json({ error: 'Book not found in this series' });
      return;
    }

    await dbRun('DELETE FROM book_series_entries WHERE id = ?', [entry.id]);

    // Update total_books count
    await recalculateSeriesCount(String(req.params.id));

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Remove book from series error');
    res.status(500).json({ error: 'Failed to remove book from series' });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapSeriesToResponse(series: any) {
  return {
    id: series.id,
    name: series.name,
    slug: series.slug,
    description: series.description || null,
    coverImage: series.cover_image || null,
    totalBooks: series.total_books || 0,
    isComplete: !!series.is_complete,
    createdAt: series.created_at,
    updatedAt: series.updated_at,
  };
}

async function recalculateSeriesCount(seriesId: string): Promise<void> {
  const countRow = await dbGet<any>(
    'SELECT COUNT(*) as total FROM book_series_entries WHERE series_id = ?',
    [seriesId]
  );
  await dbRun('UPDATE book_series SET total_books = ? WHERE id = ?', [countRow?.total || 0, seriesId]);
}

export default router;
