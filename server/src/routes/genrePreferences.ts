/**
 * Genre Preferences Route — Onboarding & CF seeding
 * GET  /api/genre-preferences           — get current user's preferences
 * POST /api/genre-preferences           — save genre preferences (onboarding)
 * POST /api/genre-preferences/complete  — mark onboarding complete
 */

import { Router, Request, Response } from 'express';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// GET /api/genre-preferences — get user's genre preferences
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const prefs = await dbAll<any>(
      `SELECT ugp.category_id, ugp.weight, ugp.source, c.name, c.slug
       FROM user_genre_preferences ugp
       JOIN categories c ON c.id = ugp.category_id
       WHERE ugp.user_id = ?
       ORDER BY ugp.weight DESC`,
      [req.user!.userId],
    );
    const user = await dbGet<any>('SELECT onboarding_completed FROM users WHERE id = ?', [req.user!.userId]);
    res.json({ preferences: prefs, onboardingCompleted: !!user?.onboarding_completed });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch genre preferences');
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// POST /api/genre-preferences — save genre selections (max 8 genres)
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { categoryIds, source = 'onboarding' } = req.body;

  if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
    res.status(400).json({ error: 'categoryIds must be a non-empty array' });
    return;
  }
  if (categoryIds.length > 8) {
    res.status(400).json({ error: 'Select up to 8 genres' });
    return;
  }

  try {
    // Verify all categories exist
    for (const catId of categoryIds) {
      const cat = await dbGet<any>('SELECT id FROM categories WHERE id = ? OR slug = ?', [catId, catId]);
      if (!cat) {
        res.status(400).json({ error: `Category not found: ${catId}` });
        return;
      }
    }

    // Clear existing onboarding preferences, keep implicit ones
    await dbRun(
      `DELETE FROM user_genre_preferences WHERE user_id = ? AND source = ?`,
      [req.user!.userId, source],
    );

    // Insert new preferences — weight decreases by position (first choice = highest weight)
    for (let i = 0; i < categoryIds.length; i++) {
      const catId = categoryIds[i];
      // Resolve to actual DB id if slug was passed
      const cat = await dbGet<any>('SELECT id FROM categories WHERE id = ? OR slug = ?', [catId, catId]);
      if (!cat) continue;

      const weight = 1.0 - (i * 0.05); // 1.0, 0.95, 0.90, ...
      await dbRun(
        `INSERT INTO user_genre_preferences (user_id, category_id, weight, source)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE weight = VALUES(weight), source = VALUES(source)`,
        [req.user!.userId, cat.id, weight, source],
      );
    }

    res.json({ message: 'Genre preferences saved', count: categoryIds.length });
  } catch (err) {
    logger.error({ err }, 'Failed to save genre preferences');
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// POST /api/genre-preferences/complete — mark onboarding done
router.post('/complete', authenticate, async (req: Request, res: Response) => {
  try {
    await dbRun('UPDATE users SET onboarding_completed = 1 WHERE id = ?', [req.user!.userId]);
    res.json({ message: 'Onboarding complete' });
  } catch (err) {
    logger.error({ err }, 'Failed to complete onboarding');
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

export default router;
