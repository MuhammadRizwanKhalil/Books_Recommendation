import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, requireAdmin } from '../middleware.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ── GET /api/testimonials — Public: get active testimonials ─────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const testimonials = await dbAll<any>(`
      SELECT id, name, role, avatar_url, content, rating, sort_order, created_at
      FROM testimonials
      WHERE is_active = 1
      ORDER BY sort_order ASC, created_at DESC
    `, []);

    res.json({
      testimonials: testimonials.map((t: any) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        avatarUrl: t.avatar_url,
        content: t.content,
        rating: t.rating,
        sortOrder: t.sort_order,
        createdAt: t.created_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get testimonials error');
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// ── GET /api/testimonials/all — Admin: get all testimonials ─────────────────
router.get('/all', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const testimonials = await dbAll<any>(`
      SELECT id, name, role, avatar_url, content, rating, is_active, sort_order, created_at
      FROM testimonials
      ORDER BY sort_order ASC, created_at DESC
    `, []);

    res.json({
      testimonials: testimonials.map((t: any) => ({
        id: t.id,
        name: t.name,
        role: t.role,
        avatarUrl: t.avatar_url,
        content: t.content,
        rating: t.rating,
        isActive: !!t.is_active,
        sortOrder: t.sort_order,
        createdAt: t.created_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get all testimonials error');
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// ── POST /api/testimonials — Admin: create testimonial ──────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, role, avatarUrl, content, rating, isActive, sortOrder } = req.body;

    if (!name || !content) {
      res.status(400).json({ error: 'Name and content are required' });
      return;
    }

    const id = uuidv4();
    await dbRun(`
      INSERT INTO testimonials (id, name, role, avatar_url, content, rating, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, name, role || 'Book Enthusiast', avatarUrl || null, content, rating || 5, isActive !== false ? 1 : 0, sortOrder || 0]);

    res.status(201).json({ id, message: 'Testimonial created' });
  } catch (err: any) {
    logger.error({ err: err }, 'Create testimonial error');
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

// ── PUT /api/testimonials/:id — Admin: update testimonial ───────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, avatarUrl, content, rating, isActive, sortOrder } = req.body;

    const existing = await dbGet<any>('SELECT id FROM testimonials WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }

    await dbRun(`
      UPDATE testimonials
      SET name = COALESCE(?, name),
          role = COALESCE(?, role),
          avatar_url = ?,
          content = COALESCE(?, content),
          rating = COALESCE(?, rating),
          is_active = COALESCE(?, is_active),
          sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `, [name, role, avatarUrl ?? null, content, rating, isActive !== undefined ? (isActive ? 1 : 0) : null, sortOrder, id]);

    res.json({ message: 'Testimonial updated' });
  } catch (err: any) {
    logger.error({ err: err }, 'Update testimonial error');
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
});

// ── DELETE /api/testimonials/:id — Admin: delete testimonial ────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await dbRun('DELETE FROM testimonials WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Testimonial not found' });
      return;
    }
    res.json({ message: 'Testimonial deleted' });
  } catch (err: any) {
    logger.error({ err: err }, 'Delete testimonial error');
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

export default router;
