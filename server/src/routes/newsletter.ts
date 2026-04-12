import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun, dbAll } from '../database.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting, buildNewsletterWelcomeEmail } from '../services/email.js';
import { rateLimit } from '../middleware.js';
import { validate, newsletterSubscribeSchema } from '../lib/validation.js';
import { config } from '../config.js';

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
        // Already subscribed — return success silently (don't store again)
        res.json({ message: 'Successfully subscribed to the newsletter!' });
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
      const welcomeEmail = await buildNewsletterWelcomeEmail(name?.trim() || '', normalizedEmail);
      sendEmail({ to: normalizedEmail, subject: welcomeEmail.subject, html: welcomeEmail.html })
        .catch(e => logger.error({ err: e }, 'Newsletter welcome email failed'));
    } catch (e) {
      logger.error({ err: e }, 'Newsletter welcome email build failed');
    }

    // ── Fire-and-forget: Admin notification ─────────────────────────────
    try {
      if (await getSiteSetting('notify_new_subscriber', 'true') === 'true') {
        const dbAdminEmail = await getSiteSetting('admin_email', '');
        const adminEmail = dbAdminEmail && dbAdminEmail !== 'admin@thebooktimes.com'
          ? dbAdminEmail
          : config.admin.email || '';
        if (adminEmail) {
          const siteName = await getSiteSetting('site_name', 'The Book Times');
          const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');

          // Count total subscribers
          const countResult = await dbAll<any>('SELECT COUNT(*) as cnt FROM newsletter_subscribers WHERE is_active = 1', []);
          const totalSubs = countResult[0]?.cnt || 0;

          const html = await wrapInBaseTemplate(
            `<h2 style="color:#c2631a;">🔔 New Newsletter Subscriber</h2>
             <p>Someone just subscribed to your newsletter!</p>

             <div style="background:#fef9f3;border-left:4px solid #c2631a;padding:16px 20px;border-radius:0 8px 8px 0;margin:20px 0;">
               <p style="margin:0 0 8px;"><strong>📧 Email:</strong> ${escapeHtml(normalizedEmail)}</p>
               <p style="margin:0;"><strong>👤 Name:</strong> ${name?.trim() ? escapeHtml(name.trim()) : '<em>Not provided</em>'}</p>
             </div>

             <p style="font-size:14px;color:#666;">📊 <strong>Total active subscribers:</strong> ${totalSubs}</p>

             <div style="text-align:center;margin:24px 0;">
               <a href="${escapeHtml(siteUrl)}/admin/newsletter" style="display:inline-block;background:#c2631a;color:#ffffff !important;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View All Subscribers →</a>
             </div>`,
            `New Subscriber - ${siteName}`,
          );
          sendEmail({ to: adminEmail, subject: `[${siteName}] 🎉 New Subscriber: ${normalizedEmail}`, html })
            .catch(e => logger.error({ err: e }, 'Admin subscriber notification failed'));
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
