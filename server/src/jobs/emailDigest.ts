/**
 * Email Digest Cron Job
 * ─────────────────────
 * Runs hourly and sends digests to users whose preferences match.
 * Weekly → matched by day-of-week + hour.
 * Daily  → matched by hour.
 * Monthly → 1st of month at preferred hour.
 */

import cron, { ScheduledTask } from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbRun, dbGet } from '../database.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';
import { logger } from '../lib/logger.js';

let cronTask: ScheduledTask | null = null;

async function runDigestJob(): Promise<void> {
  const now = new Date();
  const currentHour = now.getUTCHours();
  const currentDay = now.getUTCDay(); // 0=Sun
  const currentDate = now.getUTCDate();

  logger.info({ currentHour, currentDay }, 'Email digest job: checking for due digests');

  // Find users due for a digest
  const candidates = await dbAll<any>(`
    SELECT edp.*, u.email, u.name as user_name
    FROM email_digest_preferences edp
    JOIN users u ON u.id = edp.user_id
    WHERE edp.enabled = TRUE
      AND edp.preferred_hour = ?
      AND (
        (edp.frequency = 'daily')
        OR (edp.frequency = 'weekly' AND edp.preferred_day = ?)
        OR (edp.frequency = 'monthly' AND ? = 1)
      )
      AND (edp.last_sent_at IS NULL OR edp.last_sent_at < DATE_SUB(NOW(), INTERVAL 6 HOUR))
  `, [currentHour, currentDay, currentDate]);

  if (candidates.length === 0) {
    return;
  }

  logger.info({ count: candidates.length }, 'Email digest: processing candidates');

  const siteName = await getSiteSetting('site_name', 'BookDiscovery');
  const siteUrl = await getSiteSetting('site_url', 'http://localhost:5173');
  let sent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const logId = uuidv4();
    try {
      const digestHtml = await buildDigestForUser(candidate.user_id, siteUrl);
      const frequencyLabel = candidate.frequency === 'daily' ? 'Daily' : candidate.frequency === 'weekly' ? 'Weekly' : 'Monthly';
      const subject = `Your ${frequencyLabel} ${siteName} Digest`;

      const html = await wrapInBaseTemplate(digestHtml.html, subject);
      const result = await sendEmail({ to: candidate.email, subject, html });

      await dbRun(
        `INSERT INTO email_digest_log (id, user_id, book_count, sections, status, error_message) VALUES (?, ?, ?, ?, ?, ?)`,
        [logId, candidate.user_id, digestHtml.bookCount, JSON.stringify(digestHtml.sectionNames), result.success ? 'sent' : 'failed', result.error || null],
      );

      await dbRun(
        `UPDATE email_digest_preferences SET last_sent_at = NOW() WHERE user_id = ?`,
        [candidate.user_id],
      );

      if (result.success) sent++; else failed++;

      // Throttle
      await new Promise(r => setTimeout(r, 200));
    } catch (err: any) {
      failed++;
      logger.error({ err, userId: candidate.user_id }, 'Digest send failed');
      await dbRun(
        `INSERT INTO email_digest_log (id, user_id, book_count, sections, status, error_message) VALUES (?, ?, 0, '[]', 'failed', ?)`,
        [logId, candidate.user_id, err.message || 'Unknown error'],
      );
    }
  }

  logger.info({ sent, failed }, 'Email digest job completed');
}

async function buildDigestForUser(userId: string, siteUrl: string): Promise<{ html: string; bookCount: number; sectionNames: string[] }> {
  const sectionNames: string[] = [];
  const sections: string[] = [];
  let bookCount = 0;

  // Reading progress summary
  try {
    const progress = await dbAll<any>(
      `SELECT status, COUNT(*) as cnt FROM reading_progress WHERE user_id = ? GROUP BY status`,
      [userId],
    );
    if (progress.length > 0) {
      const stats = Object.fromEntries(progress.map((p: any) => [p.status, p.cnt]));
      sections.push(`
        <h2>📖 Your Reading Progress</h2>
        <p><strong>${stats['reading'] || 0}</strong> currently reading · <strong>${stats['finished'] || 0}</strong> finished · <strong>${stats['want-to-read'] || 0}</strong> on your list</p>
      `);
      sectionNames.push('reading_progress');
    }
  } catch { /* table may not exist */ }

  // New releases
  try {
    const books = await dbAll<any>(
      `SELECT id, title, author, cover_image, google_rating as rating FROM books WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY google_rating DESC LIMIT 5`,
      [],
    );
    if (books.length > 0) {
      bookCount += books.length;
      sections.push(`<h2>🆕 New This Week</h2>${books.map((b: any) => bookCard(b, siteUrl)).join('')}`);
      sectionNames.push('new_releases');
    }
  } catch { /* */ }

  // Trending
  try {
    const books = await dbAll<any>(
      `SELECT id, title, author, cover_image, google_rating as rating FROM books ORDER BY computed_score DESC LIMIT 5`,
      [],
    );
    if (books.length > 0) {
      bookCount += books.length;
      sections.push(`<h2>🔥 Trending</h2>${books.map((b: any) => bookCard(b, siteUrl)).join('')}`);
      sectionNames.push('trending');
    }
  } catch { /* */ }

  // From followed authors
  try {
    const books = await dbAll<any>(
      `SELECT b.id, b.title, b.author, b.cover_image, b.google_rating as rating
       FROM books b JOIN authors a ON b.author_id = a.id
       JOIN author_follows af ON af.author_id = a.id AND af.user_id = ?
       WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) ORDER BY b.created_at DESC LIMIT 5`,
      [userId],
    );
    if (books.length > 0) {
      bookCount += books.length;
      sections.push(`<h2>✍️ From Authors You Follow</h2>${books.map((b: any) => bookCard(b, siteUrl)).join('')}`);
      sectionNames.push('followed_authors');
    }
  } catch { /* */ }

  if (sections.length === 0) {
    sections.push(`<h2>📚 Keep exploring!</h2><p>Browse our collection to find your next great read.</p>`);
  }

  sections.push(`<p style="text-align:center;margin-top:24px"><a href="${siteUrl}" style="display:inline-block;background:#c2631a;color:#fff!important;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600">Browse Books</a></p>`);

  return {
    html: sections.join('<hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0" />'),
    bookCount,
    sectionNames,
  };
}

function bookCard(book: any, siteUrl: string): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div style="border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:12px 0;display:flex;gap:12px">
      ${book.cover_image ? `<img src="${book.cover_image}" alt="${esc(book.title)}" style="width:60px;height:90px;object-fit:cover;border-radius:4px" />` : ''}
      <div>
        <strong><a href="${siteUrl}/book/${book.id}" style="color:#18181b;text-decoration:none">${esc(book.title)}</a></strong>
        <br/><span style="color:#71717a">${esc(book.author || 'Unknown')}</span>
        ${book.rating ? `<br/>⭐ ${Number(book.rating).toFixed(1)}` : ''}
      </div>
    </div>`;
}

export function startDigestCron(schedule = '0 * * * *'): void {
  if (cronTask) return;

  cronTask = cron.schedule(schedule, () => {
    runDigestJob().catch(err => logger.error({ err }, 'Email digest job failed'));
  });

  logger.info({ schedule }, 'Email digest cron started (hourly)');
}

export function stopDigestCron(): void {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
  }
}

export { runDigestJob };
