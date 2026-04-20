import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

function normalizeText(value: unknown, max = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function mapEdition(row: any) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    format: row.edition_format || null,
    language: row.edition_language || 'en',
    publisher: row.edition_publisher || null,
    year: row.edition_year ? Number(row.edition_year) : null,
    coverImage: row.cover_image || null,
    isbn: row.isbn || null,
    pageCount: row.page_count ? Number(row.page_count) : null,
  };
}

// ── GET /api/books/:id/editions ──────────────────────────────────────────────
router.get('/books/:id/editions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Resolve book by id or slug
    const book = await dbGet<any>(
      `SELECT id, work_id FROM books WHERE id = ? OR slug = ? LIMIT 1`,
      [id, id],
    );
    if (!book) return res.status(404).json({ error: 'Book not found' });

    if (!book.work_id) {
      return res.json({ workTitle: null, canonicalEditionId: book.id, editions: [], totalEditions: 0 });
    }

    const work = await dbGet<any>(`SELECT * FROM works WHERE id = ?`, [book.work_id]);
    if (!work) {
      return res.json({ workTitle: null, canonicalEditionId: book.id, editions: [], totalEditions: 0 });
    }

    const editions = await dbAll<any>(
            `SELECT id, title, slug, edition_format, edition_language, edition_publisher, edition_year,
              cover_image, isbn13 AS isbn, page_count
       FROM books WHERE work_id = ? ORDER BY edition_year ASC, title ASC`,
      [book.work_id],
    );

    res.json({
      workTitle: work.title,
      canonicalEditionId: work.canonical_book_id,
      editions: editions.map(mapEdition),
      totalEditions: editions.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get editions error');
    res.status(500).json({ error: 'Failed to fetch editions' });
  }
});

// ── POST /api/admin/works ─────────────────────────────────────────────────────
router.post('/admin/works', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const title = normalizeText(req.body.title, 500);
    const canonicalBookId = normalizeText(req.body.canonicalBookId, 36);

    if (!title) return res.status(400).json({ error: 'title is required' });
    if (!canonicalBookId) return res.status(400).json({ error: 'canonicalBookId is required' });

    const canonicalBook = await dbGet<any>(`SELECT id FROM books WHERE id = ?`, [canonicalBookId]);
    if (!canonicalBook) return res.status(404).json({ error: 'Canonical book not found' });

    const id = uuidv4();
    await dbRun(
      `INSERT INTO works (id, canonical_book_id, title) VALUES (?, ?, ?)`,
      [id, canonicalBookId, title],
    );

    const work = await dbGet<any>(`SELECT * FROM works WHERE id = ?`, [id]);
    res.status(201).json(work);
  } catch (err: any) {
    logger.error({ err }, 'Create work error');
    res.status(500).json({ error: 'Failed to create work' });
  }
});

// ── PUT /api/admin/books/:id/work ─────────────────────────────────────────────
router.put('/admin/books/:id/work', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { id } = req.params;
    const workId = req.body.workId != null ? normalizeText(req.body.workId, 36) : null;
    const editionFormat = req.body.editionFormat != null ? normalizeText(req.body.editionFormat, 50) : null;
    const editionLanguage = req.body.editionLanguage != null ? normalizeText(req.body.editionLanguage, 10) : null;
    const editionPublisher = req.body.editionPublisher != null ? normalizeText(req.body.editionPublisher, 255) : null;
    const editionYear = req.body.editionYear != null ? Number(req.body.editionYear) : null;

    const book = await dbGet<any>(`SELECT id FROM books WHERE id = ?`, [id]);
    if (!book) return res.status(404).json({ error: 'Book not found' });

    if (workId) {
      const work = await dbGet<any>(`SELECT id FROM works WHERE id = ?`, [workId]);
      if (!work) return res.status(404).json({ error: 'Work not found' });
    }

    await dbRun(
      `UPDATE books SET work_id = ?, edition_format = ?, edition_language = ?, edition_publisher = ?, edition_year = ? WHERE id = ?`,
      [workId || null, editionFormat || null, editionLanguage || null, editionPublisher || null, editionYear || null, id],
    );

    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'Assign book to work error');
    res.status(500).json({ error: 'Failed to assign book to work' });
  }
});

// ── GET /api/admin/works ──────────────────────────────────────────────────────
router.get('/admin/works', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const works = await dbAll<any>(
      `SELECT w.*, b.title AS canonical_title
       FROM works w JOIN books b ON b.id = w.canonical_book_id
       ORDER BY w.title ASC`,
      [],
    );

    res.json({ works });
  } catch (err: any) {
    logger.error({ err }, 'List works error');
    res.status(500).json({ error: 'Failed to fetch works' });
  }
});

export default router;
