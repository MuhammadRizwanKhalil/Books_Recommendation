/**
 * Email Digest Routes
 * ────────────────────
 * GET    /api/email-digest/preferences        — Get current user's preferences
 * PUT    /api/email-digest/preferences        — Update preferences
 * POST   /api/email-digest/preview            — Preview digest email (admin)
 * POST   /api/email-digest/send-test          — Send test digest to self
 * GET    /api/email-digest/history             — User's digest history
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getPool, dbGet, dbRun, dbAll } from '../database.js';
import { authenticate } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET /preferences ────────────────────────────────────────────────────────
router.get('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    let prefs = await dbGet<any>(
      'SELECT * FROM email_digest_preferences WHERE user_id = ?',
      [userId],
    );

    if (!prefs) {
      // Auto-create defaults
      const id = uuidv4();
      await dbRun(
        `INSERT INTO email_digest_preferences (id, user_id) VALUES (?, ?)`,
        [id, userId],
      );
      prefs = await dbGet<any>('SELECT * FROM email_digest_preferences WHERE id = ?', [id]);
    }

    res.json({
      preferences: {
        enabled: !!prefs.enabled,
        frequency: prefs.frequency,
        preferredDay: prefs.preferred_day,
        preferredHour: prefs.preferred_hour,
        includeNewReleases: !!prefs.include_new_releases,
        includeTrending: !!prefs.include_trending,
        includeFollowedAuthors: !!prefs.include_followed_authors,
        includeReadingProgress: !!prefs.include_reading_progress,
        includeRecommendations: !!prefs.include_recommendations,
        lastSentAt: prefs.last_sent_at,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get digest preferences');
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// ── PUT /preferences ────────────────────────────────────────────────────────
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const {
      enabled, frequency, preferredDay, preferredHour,
      includeNewReleases, includeTrending, includeFollowedAuthors,
      includeReadingProgress, includeRecommendations,
    } = req.body;

    // Ensure row exists
    const exists = await dbGet<any>(
      'SELECT id FROM email_digest_preferences WHERE user_id = ?',
      [userId],
    );

    if (!exists) {
      await dbRun(
        `INSERT INTO email_digest_preferences (id, user_id) VALUES (?, ?)`,
        [uuidv4(), userId],
      );
    }

    await dbRun(`
      UPDATE email_digest_preferences SET
        enabled = COALESCE(?, enabled),
        frequency = COALESCE(?, frequency),
        preferred_day = COALESCE(?, preferred_day),
        preferred_hour = COALESCE(?, preferred_hour),
        include_new_releases = COALESCE(?, include_new_releases),
        include_trending = COALESCE(?, include_trending),
        include_followed_authors = COALESCE(?, include_followed_authors),
        include_reading_progress = COALESCE(?, include_reading_progress),
        include_recommendations = COALESCE(?, include_recommendations)
      WHERE user_id = ?
    `, [
      enabled ?? null, frequency ?? null, preferredDay ?? null, preferredHour ?? null,
      includeNewReleases ?? null, includeTrending ?? null, includeFollowedAuthors ?? null,
      includeReadingProgress ?? null, includeRecommendations ?? null,
      userId,
    ]);

    res.json({ message: 'Preferences updated' });
  } catch (err) {
    logger.error({ err }, 'Failed to update digest preferences');
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// ── POST /send-test ─────────────────────────────────────────────────────────
router.post('/send-test', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user = await dbGet<any>('SELECT email, name FROM users WHERE id = ?', [userId]);
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const digestHtml = await buildDigestHtml(userId);
    const siteName = await getSiteSetting('site_name', 'BookDiscovery');
    const subject = `[Test] Your ${siteName} Weekly Digest`;

    const html = await wrapInBaseTemplate(digestHtml, subject);
    const result = await sendEmail({ to: user.email, subject, html });

    res.json({ success: result.success, message: result.success ? 'Test digest sent!' : result.error });
  } catch (err) {
    logger.error({ err }, 'Failed to send test digest');
    res.status(500).json({ error: 'Failed to send test digest' });
  }
});

// ── GET /history ────────────────────────────────────────────────────────────
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const logs = await dbAll<any>(
      `SELECT id, sent_at, book_count, sections, status, error_message
       FROM email_digest_log WHERE user_id = ? ORDER BY sent_at DESC LIMIT 20`,
      [userId],
    );

    res.json({
      history: logs.map((l: any) => ({
        id: l.id,
        sentAt: l.sent_at,
        bookCount: l.book_count,
        sections: safeJsonParse(l.sections, []),
        status: l.status,
        errorMessage: l.error_message,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get digest history');
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ── Digest Builder ──────────────────────────────────────────────────────────

async function buildDigestHtml(userId: string): Promise<string> {
  const siteUrl = await getSiteSetting('site_url', 'http://localhost:5173');
  const sections: string[] = [];

  // 1. Reading progress summary
  const progress = await dbAll<any>(
    `SELECT rp.status, COUNT(*) as cnt
     FROM reading_progress rp WHERE rp.user_id = ? GROUP BY rp.status`,
    [userId],
  );
  if (progress.length > 0) {
    const stats = Object.fromEntries(progress.map((p: any) => [p.status, p.cnt]));
    sections.push(`
      <h2>📖 Your Reading Progress</h2>
      <p>
        <strong>${stats['reading'] || 0}</strong> currently reading ·
        <strong>${stats['finished'] || 0}</strong> finished ·
        <strong>${stats['want-to-read'] || 0}</strong> on your list
      </p>
    `);
  }

  // 2. New releases this week
  const newBooks = await dbAll<any>(
    `SELECT id, title, author, cover_image, google_rating as rating
     FROM books WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY google_rating DESC LIMIT 5`,
    [],
  );
  if (newBooks.length > 0) {
    sections.push(`
      <h2>🆕 New This Week</h2>
      ${newBooks.map((b: any) => bookCard(b, siteUrl)).join('')}
    `);
  }

  // 3. Trending (top rated recent)
  const trending = await dbAll<any>(
    `SELECT id, title, author, cover_image, google_rating as rating
     FROM books ORDER BY computed_score DESC LIMIT 5`,
    [],
  );
  if (trending.length > 0) {
    sections.push(`
      <h2>🔥 Trending</h2>
      ${trending.map((b: any) => bookCard(b, siteUrl)).join('')}
    `);
  }

  // 4. From followed authors
  const followedBooks = await dbAll<any>(
    `SELECT b.id, b.title, b.author, b.cover_image, b.google_rating as rating
     FROM books b
     JOIN authors a ON b.author_id = a.id
     JOIN author_follows af ON af.author_id = a.id AND af.user_id = ?
     WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY b.created_at DESC LIMIT 5`,
    [userId],
  );
  if (followedBooks.length > 0) {
    sections.push(`
      <h2>✍️ From Authors You Follow</h2>
      ${followedBooks.map((b: any) => bookCard(b, siteUrl)).join('')}
    `);
  }

  if (sections.length === 0) {
    sections.push(`<h2>📚 Keep exploring!</h2><p>Browse our collection to find your next great read.</p>`);
  }

  sections.push(`<p style="text-align:center;margin-top:24px"><a href="${siteUrl}" class="btn">Browse Books</a></p>`);
  return sections.join('<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />');
}

function bookCard(book: any, siteUrl: string): string {
  return `
    <div class="book-card">
      ${book.cover_image ? `<img src="${book.cover_image}" alt="${esc(book.title)}" />` : ''}
      <div>
        <strong><a href="${siteUrl}/book/${book.id}" style="color:#18181b;text-decoration:none">${esc(book.title)}</a></strong>
        <br/><span style="color:#71717a">${esc(book.author || 'Unknown')}</span>
        ${book.rating ? `<br/>⭐ ${Number(book.rating).toFixed(1)}` : ''}
      </div>
    </div>`;
}

function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function safeJsonParse(val: any, fallback: any): any {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return fallback; }
}

export default router;
