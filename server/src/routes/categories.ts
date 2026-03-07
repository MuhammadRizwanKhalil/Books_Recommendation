import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/categories ─────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const categories = await dbAll<any>(`
      SELECT * FROM categories ORDER BY name ASC
    `, []);

    res.json(categories.map(c => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      imageUrl: c.image_url,
      metaTitle: c.meta_title,
      metaDescription: c.meta_description,
      bookCount: c.book_count,
    })));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// ── GET /api/categories/:slug ───────────────────────────────────────────────
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const cat = await dbGet<any>('SELECT * FROM categories WHERE slug = ?', [req.params.slug]);
    if (!cat) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    res.json({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      imageUrl: cat.image_url,
      metaTitle: cat.meta_title,
      metaDescription: cat.meta_description,
      bookCount: cat.book_count,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch category' });
  }
});

// ── GET /api/categories/:slug/books ─────────────────────────────────────────
router.get('/:slug/books', async (req: Request, res: Response) => {
  try {
    const cat = await dbGet<any>('SELECT id FROM categories WHERE slug = ?', [req.params.slug]);
    if (!cat) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const sort = (req.query.sort as string) || 'google_rating';
    const order = (req.query.order as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const validSorts = ['google_rating', 'computed_score', 'ratings_count', 'title', 'published_date'];
    const sortCol = validSorts.includes(sort) ? sort : 'google_rating';

    // Pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    const totalRow = await dbGet<any>(`
      SELECT COUNT(*) as total FROM books b
      JOIN book_categories bc ON bc.book_id = b.id
      WHERE bc.category_id = ? AND b.status = 'PUBLISHED' AND b.is_active = 1
    `, [cat.id]);
    const total = totalRow.total;

    const books = await dbAll<any>(`
      SELECT b.* FROM books b
      JOIN book_categories bc ON bc.book_id = b.id
      WHERE bc.category_id = ? AND b.status = 'PUBLISHED' AND b.is_active = 1
      ORDER BY b.${sortCol} ${order}
      LIMIT ? OFFSET ?
    `, [cat.id, limit, offset]);

    // Batch-load categories for all books (avoids N+1)
    const bookIds = books.map((b: any) => b.id);
    const categoryMap = new Map<string, string[]>();
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(',');
      const allCats = await dbAll<any>(`
        SELECT bc2.book_id, c.name FROM categories c
        JOIN book_categories bc2 ON bc2.category_id = c.id
        WHERE bc2.book_id IN (${placeholders})
      `, bookIds);
      for (const row of allCats) {
        const existing = categoryMap.get(row.book_id) || [];
        existing.push(row.name);
        categoryMap.set(row.book_id, existing);
      }
    }

    const result = books.map(book => {

      return {
        id: book.id,
        googleBooksId: book.google_books_id,
        isbn10: book.isbn10,
        isbn13: book.isbn13,
        slug: book.slug,
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        description: book.description,
        coverImage: book.cover_image,
        publisher: book.publisher,
        publishedDate: book.published_date,
        pageCount: book.page_count,
        language: book.language,
        categories: categoryMap.get(book.id) || [],
        googleRating: book.google_rating,
        ratingsCount: book.ratings_count,
        computedScore: book.computed_score,
        price: book.price,
        currency: book.currency,
        amazonUrl: book.amazon_url,
        status: book.status,
        isActive: !!book.is_active,
        indexedAt: book.indexed_at,
        createdAt: book.created_at,
        updatedAt: book.updated_at,
      };
    });

    res.json({
      books: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get category books error');
    res.status(500).json({ error: 'Failed to fetch category books' });
  }
});

// ── POST /api/categories (Admin) ────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, metaTitle, metaDescription } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Category name is required' });
      return;
    }

    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    await dbRun(`
      INSERT INTO categories (id, name, slug, description, image_url, meta_title, meta_description)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, name, slug, description || null, imageUrl || null, metaTitle || null, metaDescription || null]);

    const cat = await dbGet<any>('SELECT * FROM categories WHERE id = ?', [id]);
    res.status(201).json({
      id: cat.id, name: cat.name, slug: cat.slug, description: cat.description,
      imageUrl: cat.image_url, bookCount: cat.book_count,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ── PUT /api/categories/:id (Admin) ─────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, metaTitle, metaDescription } = req.body;

    await dbRun(`
      UPDATE categories SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        description = COALESCE(?, description),
        image_url = COALESCE(?, image_url),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        updated_at = NOW()
      WHERE id = ?
    `, [
      name ?? null,
      name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : null,
      description ?? null, imageUrl ?? null, metaTitle ?? null, metaDescription ?? null,
      req.params.id
    ]);

    const cat = await dbGet<any>('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    if (!cat) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json({
      id: cat.id, name: cat.name, slug: cat.slug, description: cat.description,
      imageUrl: cat.image_url, bookCount: cat.book_count,
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update category' });
  }
});

// ── DELETE /api/categories/:id (Admin) ──────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await dbRun('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
