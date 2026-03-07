import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun } from '../database.js';

// ── SMTP Configuration (loaded from site_settings) ─────────────────────────

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

async function getSmtpConfig(): Promise<SmtpConfig> {
  const getSetting = async (key: string, fallback: string) => {
    const row = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
    return row?.value || fallback;
  };

  return {
    host: await getSetting('smtp_host', 'smtp.gmail.com'),
    port: parseInt(await getSetting('smtp_port', '587'), 10),
    secure: (await getSetting('smtp_secure', 'false')) === 'true',
    user: await getSetting('smtp_user', ''),
    pass: await getSetting('smtp_pass', ''),
    fromName: await getSetting('smtp_from_name', 'BookDiscovery'),
    fromEmail: await getSetting('smtp_from_email', 'noreply@bookdiscovery.com'),
  };
}

async function createTransporter(): Promise<Transporter | null> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) {
    logger.warn('⚠️  SMTP not configured — emails will be logged only');
    return null;
  }

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

// ── Send a single email ─────────────────────────────────────────────────────

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cfg = await getSmtpConfig();
  const transporter = await createTransporter();

  if (!transporter) {
    // Dev mode — just log
    logger.info(`📧 [DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`);
    logger.info(`   Body length: ${options.html.length} chars`);
    return { success: true, messageId: `dev-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
      replyTo: options.replyTo || cfg.fromEmail,
    });
    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    logger.error({ err: err.message }, 'Email send failed');
    return { success: false, error: err.message };
  }
}

// ── Bulk email sending (for campaigns) ──────────────────────────────────────

export async function sendBulkEmails(
  recipients: { id: string; email: string; name?: string }[],
  subject: string,
  htmlTemplate: string,
  campaignId: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const cfg = await getSmtpConfig();

  for (const recipient of recipients) {
    // Personalize template
    const siteUrl = await getSiteSetting('site_url', 'http://localhost:5173');
    const personalizedHtml = personalizeEmail(htmlTemplate, {
      subscriber_name: recipient.name || 'Reader',
      subscriber_email: recipient.email,
      unsubscribe_url: `${siteUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      campaign_id: campaignId,
    });

    const result = await sendEmail({
      to: recipient.email,
      subject: personalizeText(subject, { subscriber_name: recipient.name || 'Reader' }),
      html: personalizedHtml,
    });

    if (result.success) {
      await dbRun(
        `UPDATE campaign_recipients SET status = ?, sent_at = NOW(), error_message = ? WHERE id = ?`,
        ['sent', null, recipient.id],
      );
      await dbRun(
        `UPDATE email_campaigns SET sent_count = sent_count + 1 WHERE id = ?`,
        [campaignId],
      );
      sent++;
    } else {
      await dbRun(
        `UPDATE campaign_recipients SET status = ?, sent_at = NOW(), error_message = ? WHERE id = ?`,
        ['failed', result.error || 'Unknown error', recipient.id],
      );
      failed++;
    }

    // Throttle: 100ms between emails to avoid rate limits
    await new Promise(r => setTimeout(r, 100));
  }

  return { sent, failed };
}

// ── Test SMTP connection ────────────────────────────────────────────────────

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const transporter = await createTransporter();
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }
  try {
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ── Email templates ─────────────────────────────────────────────────────────

export async function getBaseEmailTemplate(): Promise<string> {
  const logo = await getSiteSetting('site_logo_url', '');
  const siteName = await getSiteSetting('site_name', 'BookDiscovery');
  const primaryColor = await getSiteSetting('brand_primary_color', '#c2631a');
  const siteUrl = await getSiteSetting('site_url', 'http://localhost:5173');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; color: #18181b; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: ${primaryColor}; padding: 24px 32px; text-align: center; }
    .header img { max-height: 40px; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 8px 0 0; }
    .content { padding: 32px; line-height: 1.6; }
    .content h2 { color: ${primaryColor}; font-size: 20px; margin-top: 0; }
    .btn { display: inline-block; background: ${primaryColor}; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 16px 0; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7; }
    .footer a { color: ${primaryColor}; text-decoration: underline; }
    .book-card { border: 1px solid #e4e4e7; border-radius: 8px; padding: 16px; margin: 12px 0; display: flex; gap: 12px; }
    .book-card img { width: 60px; height: 90px; object-fit: cover; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      ${logo ? `<img src="${logo}" alt="${siteName}" />` : `<h1>📚 ${siteName}</h1>`}
    </div>
    <div class="content">
      {{content}}
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
      <p><a href="${siteUrl}">Visit our website</a> · <a href="{{unsubscribe_url}}">Unsubscribe</a></p>
      <p>You are receiving this because you subscribed to ${siteName} newsletter.</p>
    </div>
  </div>
</body>
</html>`;
}

export async function wrapInBaseTemplate(content: string, subject: string): Promise<string> {
  return (await getBaseEmailTemplate())
    .replace('{{content}}', content)
    .replace('{{subject}}', subject);
}

// ── Personalization helpers ─────────────────────────────────────────────────

function personalizeEmail(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

function personalizeText(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return result;
}

// ── Utility ─────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function getSiteSetting(key: string, fallback: string = ''): Promise<string> {
  const row = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
  return row?.value || fallback;
}
