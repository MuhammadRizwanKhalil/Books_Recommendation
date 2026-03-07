/**
 * A/B Testing & Experiments Routes
 * ─────────────────────────────────
 * Admin: CRUD experiments, manage variants, view results
 * Public: Get assignment for current user/session, track events
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Public: Get all running experiments + user assignments ──────────────────
router.get('/active', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId || null;
    const sessionId = req.headers['x-session-id'] as string || null;

    const experiments = await dbAll<any>(
      `SELECT id, name, type, traffic_percentage FROM experiments WHERE status = 'running'`,
      [],
    );

    const result: any[] = [];

    for (const exp of experiments) {
      // Check for existing assignment
      let assignment = await dbGet<any>(
        `SELECT ea.id, ev.name as variant_name, ev.config
         FROM experiment_assignments ea
         JOIN experiment_variants ev ON ev.id = ea.variant_id
         WHERE ea.experiment_id = ? AND (ea.user_id = ? OR ea.session_id = ?)`,
        [exp.id, userId, sessionId],
      );

      if (!assignment) {
        // Check traffic eligibility
        const hash = simpleHash(`${exp.id}:${userId || sessionId || 'anon'}`);
        if ((hash % 100) >= exp.traffic_percentage) continue;

        // Assign variant by weighted random
        const variants = await dbAll<any>(
          'SELECT id, name, weight, config FROM experiment_variants WHERE experiment_id = ? ORDER BY weight DESC',
          [exp.id],
        );
        if (variants.length === 0) continue;

        const variant = weightedSelect(variants);
        const assignId = uuidv4();

        await dbRun(
          `INSERT INTO experiment_assignments (id, experiment_id, user_id, session_id, variant_id) VALUES (?, ?, ?, ?, ?)`,
          [assignId, exp.id, userId, sessionId, variant.id],
        );

        assignment = { id: assignId, variant_name: variant.name, config: variant.config };
      }

      result.push({
        experimentId: exp.id,
        experimentName: exp.name,
        variant: assignment.variant_name,
        config: safeJsonParse(assignment.config, {}),
      });
    }

    res.json({ experiments: result });
  } catch (err) {
    logger.error({ err }, 'Failed to get active experiments');
    res.status(500).json({ error: 'Failed to get experiments' });
  }
});

// ── Public: Track experiment event ──────────────────────────────────────────
router.post('/event', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { experimentId, eventType, eventValue, metadata } = req.body;
    const userId = req.user?.userId || null;
    const sessionId = req.headers['x-session-id'] as string || null;

    if (!experimentId || !eventType) {
      res.status(400).json({ error: 'experimentId and eventType required' });
      return;
    }

    // Find assignment to get variant
    const assignment = await dbGet<any>(
      `SELECT variant_id FROM experiment_assignments
       WHERE experiment_id = ? AND (user_id = ? OR session_id = ?)`,
      [experimentId, userId, sessionId],
    );

    if (!assignment) {
      res.status(404).json({ error: 'No assignment for this experiment' });
      return;
    }

    await dbRun(
      `INSERT INTO experiment_events (id, experiment_id, variant_id, user_id, session_id, event_type, event_value, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), experimentId, assignment.variant_id, userId, sessionId, eventType, eventValue ?? null, metadata ? JSON.stringify(metadata) : null],
    );

    res.json({ tracked: true });
  } catch (err) {
    logger.error({ err }, 'Failed to track experiment event');
    res.status(500).json({ error: 'Failed to track event' });
  }
});

// ── Admin: List all experiments ─────────────────────────────────────────────
router.get('/', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const experiments = await dbAll<any>(
      `SELECT e.*, COUNT(DISTINCT ea.id) as total_assignments
       FROM experiments e
       LEFT JOIN experiment_assignments ea ON ea.experiment_id = e.id
       GROUP BY e.id ORDER BY e.created_at DESC`,
      [],
    );

    res.json({
      experiments: experiments.map((e: any) => ({
        id: e.id,
        name: e.name,
        description: e.description,
        status: e.status,
        type: e.type,
        trafficPercentage: e.traffic_percentage,
        totalAssignments: e.total_assignments,
        startDate: e.start_date,
        endDate: e.end_date,
        createdAt: e.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list experiments');
    res.status(500).json({ error: 'Failed to list experiments' });
  }
});

// ── Admin: Create experiment ────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, description, type = 'ab_test', trafficPercentage = 100, variants } = req.body;

    if (!name) { res.status(400).json({ error: 'Name is required' }); return; }

    const expId = uuidv4();
    await dbRun(
      `INSERT INTO experiments (id, name, description, type, traffic_percentage, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [expId, name, description || null, type, trafficPercentage, req.user!.userId],
    );

    // Create variants (default: control + variant_a)
    const variantList = variants && variants.length > 0
      ? variants
      : [{ name: 'control', weight: 50 }, { name: 'variant_a', weight: 50 }];

    for (const v of variantList) {
      await dbRun(
        `INSERT INTO experiment_variants (id, experiment_id, name, weight, config)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), expId, v.name, v.weight || 50, v.config ? JSON.stringify(v.config) : null],
      );
    }

    res.status(201).json({ id: expId, message: 'Experiment created' });
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: 'Experiment name already exists' });
      return;
    }
    logger.error({ err }, 'Failed to create experiment');
    res.status(500).json({ error: 'Failed to create experiment' });
  }
});

// ── Admin: Update experiment status ─────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { status, description, trafficPercentage, startDate, endDate } = req.body;

    await dbRun(`
      UPDATE experiments SET
        status = COALESCE(?, status),
        description = COALESCE(?, description),
        traffic_percentage = COALESCE(?, traffic_percentage),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date)
      WHERE id = ?
    `, [status ?? null, description ?? null, trafficPercentage ?? null, startDate ?? null, endDate ?? null, req.params.id]);

    res.json({ message: 'Experiment updated' });
  } catch (err) {
    logger.error({ err }, 'Failed to update experiment');
    res.status(500).json({ error: 'Failed to update experiment' });
  }
});

// ── Admin: Delete experiment ────────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM experiments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Experiment deleted' });
  } catch (err) {
    logger.error({ err }, 'Failed to delete experiment');
    res.status(500).json({ error: 'Failed to delete experiment' });
  }
});

// ── Admin: Get experiment results/stats ─────────────────────────────────────
router.get('/:id/results', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const expId = req.params.id;

    const experiment = await dbGet<any>('SELECT * FROM experiments WHERE id = ?', [expId]);
    if (!experiment) { res.status(404).json({ error: 'Experiment not found' }); return; }

    const variants = await dbAll<any>(
      'SELECT id, name, weight, config FROM experiment_variants WHERE experiment_id = ?',
      [expId],
    );

    const results = [];
    for (const v of variants) {
      const assignments = await dbGet<any>(
        'SELECT COUNT(*) as cnt FROM experiment_assignments WHERE variant_id = ?',
        [v.id],
      );
      const events = await dbAll<any>(
        `SELECT event_type, COUNT(*) as cnt, AVG(event_value) as avg_value
         FROM experiment_events WHERE variant_id = ? GROUP BY event_type`,
        [v.id],
      );

      results.push({
        variantId: v.id,
        variantName: v.name,
        weight: v.weight,
        config: safeJsonParse(v.config, {}),
        assignments: assignments?.cnt || 0,
        events: events.map((e: any) => ({
          type: e.event_type,
          count: e.cnt,
          avgValue: e.avg_value ? Number(e.avg_value) : null,
        })),
      });
    }

    res.json({
      experiment: {
        id: experiment.id,
        name: experiment.name,
        status: experiment.status,
        type: experiment.type,
      },
      results,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get experiment results');
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function weightedSelect(variants: any[]): any {
  const totalWeight = variants.reduce((s, v) => s + (v.weight || 1), 0);
  let rand = Math.random() * totalWeight;
  for (const v of variants) {
    rand -= (v.weight || 1);
    if (rand <= 0) return v;
  }
  return variants[variants.length - 1];
}

function safeJsonParse(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
