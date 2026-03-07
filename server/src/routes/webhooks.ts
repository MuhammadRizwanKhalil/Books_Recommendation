/**
 * Webhook Routes
 * ──────────────
 * CRUD for webhook endpoints, delivery log, and a test ping.
 *
 * POST   /api/webhooks                — Create webhook
 * GET    /api/webhooks                — List user's webhooks
 * GET    /api/webhooks/:id            — Get webhook details + recent deliveries
 * PUT    /api/webhooks/:id            — Update webhook
 * DELETE /api/webhooks/:id            — Delete webhook
 * POST   /api/webhooks/:id/test       — Send test ping
 * GET    /api/webhooks/:id/deliveries — Delivery log
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();
router.use(authenticate);

// ── List webhooks ───────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const webhooks = await dbAll<any>(
      `SELECT id, name, url, events, is_active, failure_count, last_triggered_at, created_at
       FROM webhooks WHERE user_id = ? ORDER BY created_at DESC`,
      [userId],
    );

    res.json({
      webhooks: webhooks.map((w: any) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        events: safeJsonParse(w.events, []),
        isActive: !!w.is_active,
        failureCount: w.failure_count,
        lastTriggeredAt: w.last_triggered_at,
        createdAt: w.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list webhooks');
    res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// ── Create webhook ──────────────────────────────────────────────────────────
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, url, events } = req.body;

    if (!name || !url) {
      res.status(400).json({ error: 'Name and URL are required' });
      return;
    }

    // Generate HMAC secret
    const secret = crypto.randomBytes(32).toString('hex');
    const id = uuidv4();

    await dbRun(
      `INSERT INTO webhooks (id, user_id, name, url, secret, events) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, userId, name, url, secret, JSON.stringify(events || [])],
    );

    res.status(201).json({
      id,
      secret,
      message: 'Webhook created. Store the secret securely — it won\'t be shown again.',
    });
  } catch (err) {
    logger.error({ err }, 'Failed to create webhook');
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// ── Get webhook ─────────────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const webhook = await dbGet<any>(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, userId],
    );

    if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }

    const deliveries = await dbAll<any>(
      `SELECT id, event_type, response_status, status, duration_ms, attempt, created_at
       FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
    );

    res.json({
      webhook: {
        id: webhook.id,
        name: webhook.name,
        url: webhook.url,
        events: safeJsonParse(webhook.events, []),
        isActive: !!webhook.is_active,
        failureCount: webhook.failure_count,
        lastTriggeredAt: webhook.last_triggered_at,
        createdAt: webhook.created_at,
      },
      recentDeliveries: deliveries.map((d: any) => ({
        id: d.id,
        eventType: d.event_type,
        responseStatus: d.response_status,
        status: d.status,
        durationMs: d.duration_ms,
        attempt: d.attempt,
        createdAt: d.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get webhook');
    res.status(500).json({ error: 'Failed to get webhook' });
  }
});

// ── Update webhook ──────────────────────────────────────────────────────────
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { name, url, events, isActive } = req.body;

    await dbRun(`
      UPDATE webhooks SET
        name = COALESCE(?, name),
        url = COALESCE(?, url),
        events = COALESCE(?, events),
        is_active = COALESCE(?, is_active)
      WHERE id = ? AND user_id = ?
    `, [name ?? null, url ?? null, events ? JSON.stringify(events) : null, isActive ?? null, req.params.id, userId]);

    res.json({ message: 'Webhook updated' });
  } catch (err) {
    logger.error({ err }, 'Failed to update webhook');
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// ── Delete webhook ──────────────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    await dbRun('DELETE FROM webhooks WHERE id = ? AND user_id = ?', [req.params.id, userId]);
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    logger.error({ err }, 'Failed to delete webhook');
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// ── Test ping ───────────────────────────────────────────────────────────────
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const webhook = await dbGet<any>(
      'SELECT * FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, userId],
    );

    if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }

    const payload = {
      event: 'ping',
      timestamp: new Date().toISOString(),
      webhookId: webhook.id,
    };

    const deliveryResult = await deliverWebhook(webhook, 'ping', payload);

    res.json({
      success: deliveryResult.success,
      status: deliveryResult.responseStatus,
      durationMs: deliveryResult.durationMs,
    });
  } catch (err) {
    logger.error({ err }, 'Failed to test webhook');
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// ── Delivery log ────────────────────────────────────────────────────────────
router.get('/:id/deliveries', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const webhook = await dbGet<any>(
      'SELECT id FROM webhooks WHERE id = ? AND user_id = ?',
      [req.params.id, userId],
    );
    if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const deliveries = await dbAll<any>(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset],
    );

    res.json({
      deliveries: deliveries.map((d: any) => ({
        id: d.id,
        eventType: d.event_type,
        payload: safeJsonParse(d.payload, {}),
        responseStatus: d.response_status,
        responseBody: d.response_body,
        status: d.status,
        durationMs: d.duration_ms,
        attempt: d.attempt,
        createdAt: d.created_at,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get deliveries');
    res.status(500).json({ error: 'Failed to get deliveries' });
  }
});

// ── Webhook Delivery Engine ─────────────────────────────────────────────────

export async function deliverWebhook(
  webhook: any,
  eventType: string,
  payload: any,
): Promise<{ success: boolean; responseStatus?: number; durationMs: number }> {
  const deliveryId = uuidv4();
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  const start = Date.now();
  let responseStatus: number | undefined;
  let responseBody = '';
  let success = false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const resp = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': eventType,
        'X-Webhook-Delivery': deliveryId,
        'User-Agent': 'BookDiscovery-Webhook/1.0',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    responseStatus = resp.status;
    responseBody = await resp.text().catch(() => '');
    success = resp.ok;
  } catch (err: any) {
    responseBody = err.message || 'Request failed';
  }

  const durationMs = Date.now() - start;

  // Log delivery
  await dbRun(
    `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, response_status, response_body, duration_ms, status, attempt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [deliveryId, webhook.id, eventType, JSON.stringify(payload), responseStatus ?? null, responseBody.slice(0, 5000), durationMs, success ? 'success' : 'failed'],
  );

  // Update webhook stats
  if (success) {
    await dbRun(
      `UPDATE webhooks SET last_triggered_at = NOW(), failure_count = 0 WHERE id = ?`,
      [webhook.id],
    );
  } else {
    await dbRun(
      `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?`,
      [webhook.id],
    );
    // Auto-disable after 10 consecutive failures
    await dbRun(
      `UPDATE webhooks SET is_active = FALSE WHERE id = ? AND failure_count >= 10`,
      [webhook.id],
    );
  }

  return { success, responseStatus, durationMs };
}

// ── Fire webhook event (called from other services) ─────────────────────────

export async function fireWebhookEvent(eventType: string, payload: any): Promise<void> {
  try {
    const webhooks = await dbAll<any>(
      `SELECT * FROM webhooks WHERE is_active = TRUE AND JSON_CONTAINS(events, ?)`,
      [JSON.stringify(eventType)],
    );

    for (const webhook of webhooks) {
      // Fire-and-forget
      deliverWebhook(webhook, eventType, {
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
      }).catch(err => logger.error({ err, webhookId: webhook.id }, 'Webhook delivery failed'));
    }
  } catch (err) {
    logger.error({ err, eventType }, 'Failed to fire webhook event');
  }
}

function safeJsonParse(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
