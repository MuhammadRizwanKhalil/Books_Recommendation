import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun } from '../database.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';
import { rateLimit } from '../middleware.js';
import { validate, newsletterSubscribeSchema } from '../lib/validation.js';

const router = Router();

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── POST /api/newsletter/subscribe ──────────────────────────────────────────
router.post('/subscribe', rateLimit('newsletter', 5, 60 * 60 * 1000), validate(newsletterSubscribeSchema), async (req: Request, res: Response) => {
  try {
    const { email, name } = req.body;
    const normalizedEmail = email; // Already lowercased & trimmed by Zod

    // Check if already subscribed
    const existing = await dbGet<any>('SELECT id, is_active FROM newsletter_subscribers WHERE email = ?', [normalizedEmail]);
    if (existing) {
      if (existing.is_active) {
        res.status(409).json({ error: 'Email already subscribed' });
        return;
      }
      // Re-activate
      await dbRun('UPDATE newsletter_subscribers SET is_active = 1, unsubscribed_at = NULL WHERE id = ?', [existing.id]);
      res.json({ message: 'Welcome back! Your subscription has been reactivated.' });
      return;
    }

    await dbRun(`
      INSERT INTO newsletter_subscribers (id, email, name)
      VALUES (?, ?, ?)
    `, [uuidv4(), normalizedEmail, name?.trim() || null]);

    res.status(201).json({ message: 'Successfully subscribed to the newsletter!' });

    // ── Fire-and-forget: Welcome email ──────────────────────────────────
    try {
      if (await getSiteSetting('welcome_email_enabled', 'false') === 'true') {
        const subject = await getSiteSetting('welcome_email_subject', 'Welcome to our newsletter!');
        const content = await getSiteSetting('welcome_email_content', '<h2>Welcome!</h2><p>Thank you for subscribing to our newsletter.</p>');
        const html = await wrapInBaseTemplate(content, subject);
        await sendEmail({ to: normalizedEmail, subject, html });
      }
    } catch (e) {
      logger.error({ err: e }, 'Welcome email failed');
    }

    // ── Fire-and-forget: Admin notification ─────────────────────────────
    try {
      if (await getSiteSetting('notify_new_subscriber', 'true') === 'true') {
        const adminEmail = await getSiteSetting('admin_email', '');
        if (adminEmail) {
          const siteName = await getSiteSetting('site_name', 'BookDiscovery');
          const html = await wrapInBaseTemplate(
            `<h2>New Newsletter Subscriber</h2><p>A new user subscribed to the newsletter:</p><p><strong>Email:</strong> ${escapeHtml(normalizedEmail)}</p><p><strong>Name:</strong> ${name?.trim() ? escapeHtml(name.trim()) : 'Not provided'}</p>`,
            `New Subscriber - ${siteName}`,
          );
          await sendEmail({ to: adminEmail, subject: `[${siteName}] New Newsletter Subscriber: ${normalizedEmail}`, html });
        }
      }
    } catch (e) {
      logger.error({ err: e }, 'Admin notification failed');
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ── POST /api/newsletter/unsubscribe ────────────────────────────────────────
router.post('/unsubscribe', rateLimit('unsubscribe', 10, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await dbRun(`
      UPDATE newsletter_subscribers SET is_active = 0, unsubscribed_at = NOW()
      WHERE email = ? AND is_active = 1
    `, [email.toLowerCase().trim()]);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Subscription not found' });
      return;
    }
    res.json({ message: 'Successfully unsubscribed' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
