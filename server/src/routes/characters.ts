import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimitByTier, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();
const VALID_ROLES = new Set(['protagonist', 'antagonist', 'supporting', 'minor']);

function mapCharacter(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    name: row.name,
    description: row.description || '',
    role: row.role,
    displayOrder: Number(row.display_order || 0),
    submittedBy: row.submitted_by || null,
    isApproved: !!row.is_approved,
    createdAt: row.created_at,
  };
}

async function resolveBook(bookIdOrSlug: string) {
  return dbGet<any>('SELECT id, slug, title FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookIdOrSlug, bookIdOrSlug]);
}

router.get('/books/:bookId/characters', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.bookId as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const params: any[] = [book.id];
    let visibilityClause = 'bc.is_approved = TRUE';

    if (req.user?.userId) {
      visibilityClause = '(bc.is_approved = TRUE OR bc.submitted_by = ?)';
      params.push(req.user.userId);
    }

    const characters = await dbAll<any>(
      `SELECT bc.*
       FROM book_characters bc
       WHERE bc.book_id = ?
         AND ${visibilityClause}
       ORDER BY bc.display_order ASC,
         CASE bc.role
           WHEN 'protagonist' THEN 1
           WHEN 'antagonist' THEN 2
           WHEN 'supporting' THEN 3
           ELSE 4
         END ASC,
         bc.name ASC`,
      params,
    );

    res.json({
      characters: characters.map(mapCharacter),
      totalCharacters: characters.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get book characters error');
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

router.post(
  '/books/:bookId/characters',
  authenticate,
  rateLimitByTier('character-submit', {
    anonymous: { max: 1, windowMs: 60 * 60 * 1000 },
    user: { max: 10, windowMs: 60 * 60 * 1000 },
    admin: { max: 100, windowMs: 60 * 60 * 1000 },
  }),
  async (req: Request, res: Response) => {
    try {
      const book = await resolveBook(req.params.bookId as string);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const name = typeof req.body?.name === 'string' ? req.body.name.replace(/\s+/g, ' ').trim() : '';
      const description = typeof req.body?.description === 'string'
        ? req.body.description.replace(/\s+/g, ' ').trim().slice(0, 1000)
        : '';
      const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : 'supporting';

      if (!name || name.length < 2 || name.length > 255) {
        res.status(400).json({ error: 'Character name must be between 2 and 255 characters' });
        return;
      }

      if (!VALID_ROLES.has(role)) {
        res.status(400).json({ error: 'role must be protagonist, antagonist, supporting, or minor' });
        return;
      }

      const duplicate = await dbGet<any>(
        'SELECT id FROM book_characters WHERE book_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
        [book.id, name],
      );

      if (duplicate) {
        res.status(409).json({ error: 'This character has already been submitted for the book' });
        return;
      }

      const orderRow = await dbGet<any>(
        'SELECT COALESCE(MAX(display_order), -1) AS maxOrder FROM book_characters WHERE book_id = ?',
        [book.id],
      );

      const isApproved = req.user?.role === 'admin';
      const id = uuidv4();

      await dbRun(
        `INSERT INTO book_characters (id, book_id, name, description, role, display_order, submitted_by, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, book.id, name, description || null, role, Number(orderRow?.maxOrder || 0) + 1, req.user!.userId, isApproved ? 1 : 0],
      );

      const created = await dbGet<any>('SELECT * FROM book_characters WHERE id = ?', [id]);

      res.status(201).json({
        message: isApproved ? 'Character added successfully' : 'Character submitted for review',
        character: mapCharacter(created),
      });
    } catch (err: any) {
      logger.error({ err }, 'Submit character error');
      res.status(500).json({ error: 'Failed to submit character' });
    }
  },
);

router.get('/admin/characters/pending', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pending = await dbAll<any>(
      `SELECT bc.id, bc.book_id, bc.name, bc.description, bc.role, bc.created_at,
              b.title AS book_title,
              u.name AS user_name,
              u.email AS user_email
       FROM book_characters bc
       JOIN books b ON b.id = bc.book_id
       LEFT JOIN users u ON u.id = bc.submitted_by
       WHERE bc.is_approved = FALSE
       ORDER BY bc.created_at DESC`,
      [],
    );

    res.json(pending.map((row) => ({
      id: row.id,
      bookId: row.book_id,
      bookTitle: row.book_title,
      name: row.name,
      description: row.description || '',
      role: row.role,
      userName: row.user_name || 'Unknown user',
      userEmail: row.user_email || '',
      createdAt: row.created_at,
    })));
  } catch (err: any) {
    logger.error({ err }, 'Get pending characters error');
    res.status(500).json({ error: 'Failed to fetch pending characters' });
  }
});

router.put('/admin/characters/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet<any>('SELECT * FROM book_characters WHERE id = ?', [id]);

    if (!existing) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }

    await dbRun('UPDATE book_characters SET is_approved = TRUE WHERE id = ?', [id]);
    const approved = await dbGet<any>('SELECT * FROM book_characters WHERE id = ?', [id]);

    res.json({
      message: 'Character approved',
      character: mapCharacter(approved),
    });
  } catch (err: any) {
    logger.error({ err }, 'Approve character error');
    res.status(500).json({ error: 'Failed to approve character' });
  }
});

export default router;
