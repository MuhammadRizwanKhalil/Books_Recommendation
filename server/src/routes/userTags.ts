import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware.js';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';

const router = Router();

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return '';
  return trimmed.toLowerCase();
}

function mapTag(row: any) {
  return {
    id: row.id,
    name: row.name,
    color: row.color || null,
    bookCount: Number(row.book_count || 0),
    createdAt: row.created_at,
  };
}

function mapTaggedBook(row: any) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author,
    coverImage: row.cover_image,
    googleRating: row.google_rating,
    ratingsCount: Number(row.ratings_count || 0),
    computedScore: Number(row.computed_score || 0),
    taggedAt: row.tagged_at,
  };
}

async function recalculateBookCounts(tagIds: string[]) {
  if (!Array.isArray(tagIds) || tagIds.length === 0) return;

  const unique = Array.from(new Set(tagIds.filter(Boolean)));
  if (unique.length === 0) return;

  for (const tagId of unique) {
    await dbRun(
      `UPDATE user_tags
       SET book_count = (SELECT COUNT(*) FROM book_user_tags WHERE tag_id = ?)
       WHERE id = ?`,
      [tagId, tagId],
    );
  }
}

// GET /api/tags - List current user's tags
router.get('/tags', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll<any>(
      `SELECT t.id, t.name, t.color, t.book_count, t.created_at
       FROM user_tags t
       WHERE t.user_id = ?
       ORDER BY t.name ASC`,
      [req.user!.userId],
    );

    res.json({ tags: rows.map(mapTag) });
  } catch (err: any) {
    logger.error({ err }, 'List user tags error');
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// POST /api/tags - Create tag
router.post('/tags', authenticate, async (req: Request, res: Response) => {
  try {
    const name = normalizeName(req.body?.name);
    const color = normalizeColor(req.body?.color);

    if (!name) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    if (name.length > 100) {
      res.status(400).json({ error: 'Tag name cannot exceed 100 characters' });
      return;
    }

    if (color === '') {
      res.status(400).json({ error: 'Tag color must be a valid hex code (#RRGGBB)' });
      return;
    }

    const id = uuidv4();

    try {
      await dbRun(
        `INSERT INTO user_tags (id, user_id, name, color)
         VALUES (?, ?, ?, ?)`,
        [id, req.user!.userId, name, color],
      );
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: 'Tag with this name already exists' });
        return;
      }
      throw err;
    }

    const created = await dbGet<any>(
      `SELECT id, name, color, book_count, created_at
       FROM user_tags
       WHERE id = ?`,
      [id],
    );

    res.status(201).json({ tag: mapTag(created) });
  } catch (err: any) {
    logger.error({ err }, 'Create user tag error');
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// PUT /api/tags/:id - Update tag
router.put('/tags/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const existing = await dbGet<any>(
      `SELECT id, name, color, book_count, created_at
       FROM user_tags
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user!.userId],
    );

    if (!existing) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const nextName = req.body?.name !== undefined ? normalizeName(req.body.name) : existing.name;
    const nextColorRaw = req.body?.color !== undefined ? normalizeColor(req.body.color) : (existing.color || null);

    if (!nextName) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    if (nextName.length > 100) {
      res.status(400).json({ error: 'Tag name cannot exceed 100 characters' });
      return;
    }

    if (nextColorRaw === '') {
      res.status(400).json({ error: 'Tag color must be a valid hex code (#RRGGBB)' });
      return;
    }

    try {
      await dbRun(
        `UPDATE user_tags
         SET name = ?, color = ?
         WHERE id = ? AND user_id = ?`,
        [nextName, nextColorRaw, req.params.id, req.user!.userId],
      );
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        res.status(409).json({ error: 'Tag with this name already exists' });
        return;
      }
      throw err;
    }

    const updated = await dbGet<any>(
      `SELECT id, name, color, book_count, created_at
       FROM user_tags
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user!.userId],
    );

    res.json({ tag: mapTag(updated) });
  } catch (err: any) {
    logger.error({ err }, 'Update user tag error');
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// DELETE /api/tags/:id - Delete tag and all book links
router.delete('/tags/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const existing = await dbGet<any>(
      'SELECT id FROM user_tags WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId],
    );

    if (!existing) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    await dbRun('DELETE FROM user_tags WHERE id = ? AND user_id = ?', [req.params.id, req.user!.userId]);
    res.json({ success: true, message: 'Tag deleted' });
  } catch (err: any) {
    logger.error({ err }, 'Delete user tag error');
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

// GET /api/books/:id/tags - Current user's tags applied to a specific book
router.get('/books/:id/tags', authenticate, async (req: Request, res: Response) => {
  try {
    const book = await dbGet<any>(
      'SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1',
      [req.params.id, req.params.id],
    );

    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT t.id, t.name, t.color, t.book_count, t.created_at
       FROM book_user_tags bt
       JOIN user_tags t ON t.id = bt.tag_id
       WHERE bt.book_id = ? AND t.user_id = ?
       ORDER BY t.name ASC`,
      [book.id, req.user!.userId],
    );

    res.json({ tags: rows.map(mapTag) });
  } catch (err: any) {
    logger.error({ err }, 'List book tags error');
    res.status(500).json({ error: 'Failed to fetch book tags' });
  }
});

// POST /api/books/:id/tags - Add tags to book
router.post('/books/:id/tags', authenticate, async (req: Request, res: Response) => {
  try {
    const tagIds: string[] = Array.isArray(req.body?.tagIds)
      ? req.body.tagIds.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    if (tagIds.length === 0) {
      res.status(400).json({ error: 'tagIds must be a non-empty array' });
      return;
    }

    const uniqueTagIds: string[] = Array.from(new Set(tagIds));

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [req.params.id, req.params.id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const placeholders = uniqueTagIds.map(() => '?').join(',');
    const ownedTags = await dbAll<any>(
      `SELECT id FROM user_tags WHERE user_id = ? AND id IN (${placeholders})`,
      [req.user!.userId, ...uniqueTagIds],
    );

    if (ownedTags.length !== uniqueTagIds.length) {
      res.status(400).json({ error: 'One or more tags are invalid for this user' });
      return;
    }

    for (const tagId of uniqueTagIds) {
      await dbRun(
        `INSERT IGNORE INTO book_user_tags (id, book_id, tag_id)
         VALUES (?, ?, ?)`,
        [uuidv4(), book.id, tagId],
      );
    }

    await recalculateBookCounts(uniqueTagIds);

    const rows = await dbAll<any>(
      `SELECT t.id, t.name, t.color, t.book_count, t.created_at
       FROM book_user_tags bt
       JOIN user_tags t ON t.id = bt.tag_id
       WHERE bt.book_id = ? AND t.user_id = ?
       ORDER BY t.name ASC`,
      [book.id, req.user!.userId],
    );

    res.json({ success: true, tags: rows.map(mapTag) });
  } catch (err: any) {
    logger.error({ err }, 'Add tags to book error');
    res.status(500).json({ error: 'Failed to add tags to book' });
  }
});

// DELETE /api/books/:id/tags/:tagId - Remove one tag from book
router.delete('/books/:id/tags/:tagId', authenticate, async (req: Request, res: Response) => {
  try {
    const tagId = String(req.params.tagId);
    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [req.params.id, req.params.id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const tag = await dbGet<any>('SELECT id FROM user_tags WHERE id = ? AND user_id = ?', [tagId, req.user!.userId]);
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    await dbRun('DELETE FROM book_user_tags WHERE book_id = ? AND tag_id = ?', [book.id, tagId]);
    await recalculateBookCounts([tagId]);

    const rows = await dbAll<any>(
      `SELECT t.id, t.name, t.color, t.book_count, t.created_at
       FROM book_user_tags bt
       JOIN user_tags t ON t.id = bt.tag_id
       WHERE bt.book_id = ? AND t.user_id = ?
       ORDER BY t.name ASC`,
      [book.id, req.user!.userId],
    );

    res.json({ success: true, tags: rows.map(mapTag) });
  } catch (err: any) {
    logger.error({ err }, 'Remove tag from book error');
    res.status(500).json({ error: 'Failed to remove tag from book' });
  }
});

// GET /api/tags/:id/books - List books for one tag
router.get('/tags/:id/books', authenticate, async (req: Request, res: Response) => {
  try {
    const tag = await dbGet<any>(
      `SELECT id, name, color, book_count, created_at
       FROM user_tags
       WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user!.userId],
    );

    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }

    const books = await dbAll<any>(
      `SELECT b.id, b.slug, b.title, b.author, b.cover_image, b.google_rating, b.ratings_count, b.computed_score,
              bt.created_at AS tagged_at
       FROM book_user_tags bt
       JOIN books b ON b.id = bt.book_id
       WHERE bt.tag_id = ?
       ORDER BY bt.created_at DESC`,
      [tag.id],
    );

    res.json({
      tag: mapTag(tag),
      books: books.map(mapTaggedBook),
    });
  } catch (err: any) {
    logger.error({ err }, 'List books by tag error');
    res.status(500).json({ error: 'Failed to fetch books for tag' });
  }
});

export default router;
