/**
 * Subscription / Tier Routes
 * ──────────────────────────
 * GET    /api/subscriptions/tiers           — List available tiers & features
 * GET    /api/subscriptions/current         — Current user's subscription
 * POST   /api/subscriptions/subscribe       — Subscribe / upgrade (placeholder for payment)
 * POST   /api/subscriptions/cancel          — Cancel subscription
 * GET    /api/subscriptions/features        — Current user's feature entitlements
 * GET    /api/subscriptions/check/:feature  — Check a single feature gate
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── Public: List tiers ──────────────────────────────────────────────────────
router.get('/tiers', async (_req: Request, res: Response) => {
  try {
    const features = await dbAll<any>('SELECT tier, feature_key, feature_value, description FROM tier_features ORDER BY tier, feature_key', []);

    const tiers: Record<string, { features: Record<string, string>; descriptions: Record<string, string> }> = {
      free: { features: {}, descriptions: {} },
      plus: { features: {}, descriptions: {} },
      premium: { features: {}, descriptions: {} },
    };

    for (const f of features) {
      tiers[f.tier].features[f.feature_key] = f.feature_value;
      tiers[f.tier].descriptions[f.feature_key] = f.description || '';
    }

    res.json({
      tiers: [
        { id: 'free', name: 'Free', price: 0, interval: 'month', ...tiers.free },
        { id: 'plus', name: 'Plus', price: 499, interval: 'month', ...tiers.plus },
        { id: 'premium', name: 'Premium', price: 999, interval: 'month', ...tiers.premium },
      ],
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list tiers');
    res.status(500).json({ error: 'Failed to list tiers' });
  }
});

// ── Auth: Current subscription ──────────────────────────────────────────────
router.get('/current', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await dbGet<any>('SELECT tier, tier_expires_at FROM users WHERE id = ?', [userId]);
    const sub = await dbGet<any>(
      `SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );

    res.json({
      tier: user?.tier || 'free',
      expiresAt: user?.tier_expires_at || null,
      subscription: sub ? {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        amountCents: sub.amount_cents,
        currency: sub.currency,
        intervalUnit: sub.interval_unit,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelledAt: sub.cancelled_at,
      } : null,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get subscription');
    res.status(500).json({ error: 'Failed to get subscription' });
  }
});

// ── Auth: Subscribe / Upgrade ───────────────────────────────────────────────
router.post('/subscribe', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { plan, intervalUnit = 'month' } = req.body;

    if (!['plus', 'premium'].includes(plan)) {
      res.status(400).json({ error: 'Invalid plan. Choose "plus" or "premium".' });
      return;
    }

    // In a real app, this would create a Stripe checkout session.
    // For now, we simulate immediate activation.
    const prices: Record<string, Record<string, number>> = {
      plus:    { month: 499, year: 4990 },
      premium: { month: 999, year: 9990 },
    };

    const interval = intervalUnit === 'year' ? 'year' : 'month';
    const amount = prices[plan]?.[interval] || 0;
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (interval === 'year' ? 12 : 1));

    // Cancel any existing active subscription
    await dbRun(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE user_id = ? AND status = 'active'`,
      [userId],
    );

    const subId = uuidv4();
    await dbRun(`
      INSERT INTO subscriptions (id, user_id, plan, status, payment_provider, amount_cents, currency, interval_unit, current_period_start, current_period_end)
      VALUES (?, ?, ?, 'active', 'manual', ?, 'USD', ?, NOW(), ?)
    `, [subId, userId, plan, amount, interval, periodEnd.toISOString()]);

    // Update user tier
    await dbRun(
      `UPDATE users SET tier = ?, tier_expires_at = ? WHERE id = ?`,
      [plan, periodEnd.toISOString(), userId],
    );

    res.json({
      message: `Subscribed to ${plan} plan successfully!`,
      subscriptionId: subId,
      tier: plan,
      expiresAt: periodEnd.toISOString(),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to subscribe');
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ── Auth: Cancel ────────────────────────────────────────────────────────────
router.post('/cancel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const result = await dbRun(
      `UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE user_id = ? AND status = 'active'`,
      [userId],
    );

    if (result.changes === 0) {
      res.status(404).json({ error: 'No active subscription found' });
      return;
    }

    // Revert to free (or keep until period end in real implementation)
    await dbRun('UPDATE users SET tier = ?, tier_expires_at = NULL WHERE id = ?', ['free', userId]);

    res.json({ message: 'Subscription cancelled', tier: 'free' });
  } catch (err) {
    logger.error({ err }, 'Failed to cancel subscription');
    res.status(500).json({ error: 'Failed to cancel' });
  }
});

// ── Auth: Get feature entitlements ──────────────────────────────────────────
router.get('/features', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await dbGet<any>('SELECT tier FROM users WHERE id = ?', [userId]);
    const tier = user?.tier || 'free';

    const features = await dbAll<any>(
      'SELECT feature_key, feature_value, description FROM tier_features WHERE tier = ?',
      [tier],
    );

    res.json({
      tier,
      features: Object.fromEntries(features.map((f: any) => [f.feature_key, f.feature_value])),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get features');
    res.status(500).json({ error: 'Failed to get features' });
  }
});

// ── Auth: Check single feature ──────────────────────────────────────────────
router.get('/check/:feature', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    let tier = 'free';

    if (userId) {
      const user = await dbGet<any>('SELECT tier FROM users WHERE id = ?', [userId]);
      tier = user?.tier || 'free';
    }

    const feature = await dbGet<any>(
      'SELECT feature_value FROM tier_features WHERE tier = ? AND feature_key = ?',
      [tier, req.params.feature],
    );

    const value = feature?.feature_value || 'false';
    const allowed = value === 'true' || value === 'unlimited' || parseInt(value, 10) > 0;

    res.json({ feature: req.params.feature, tier, value, allowed });
  } catch (err) {
    logger.error({ err }, 'Failed to check feature');
    res.status(500).json({ error: 'Failed to check feature' });
  }
});

export default router;
