import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { dbGet, dbRun } from '../database.js';

// â”€â”€ Resend Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!config.resendApiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(config.resendApiKey);
  }
  return resendClient;
}

// â”€â”€ SMTP Fallback (loaded from site_settings) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    fromName: await getSetting('smtp_from_name', 'The Book Times'),
    fromEmail: await getSetting('smtp_from_email', 'noreply@thebooktimes.com'),
  };
}

async function createTransporter(): Promise<Transporter | null> {
  const cfg = await getSmtpConfig();
  if (!cfg.host || !cfg.user || !cfg.pass) return null;

  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

// â”€â”€ Send a single email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 1. Try Resend first
  const resend = getResend();
  if (resend) {
    try {
      const result = await resend.emails.send({
        from: config.emailFrom,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
        replyTo: options.replyTo ? [options.replyTo] : undefined,
      });
      if (result.error) {
        logger.error({ err: result.error }, 'Resend email send failed');
        return { success: false, error: result.error.message };
      }
      logger.info({ to: options.to, subject: options.subject, id: result.data?.id }, 'Email sent via Resend');
      return { success: true, messageId: result.data?.id };
    } catch (err: any) {
      logger.error({ err: err.message }, 'Resend email exception');
      // fall through to SMTP
    }
  }

  // 2. Try SMTP fallback
  const cfg = await getSmtpConfig();
  const transporter = await createTransporter();
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
        replyTo: options.replyTo || cfg.fromEmail,
      });
      logger.info({ to: options.to, subject: options.subject }, 'Email sent via SMTP');
      return { success: true, messageId: info.messageId };
    } catch (err: any) {
      logger.error({ err: err.message }, 'SMTP email send failed');
      return { success: false, error: err.message };
    }
  }

  // 3. Dev mode â€” just log
  logger.info(`ðŸ“§ [DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`);
  logger.info(`   Body length: ${options.html.length} chars`);
  return { success: true, messageId: `dev-${Date.now()}` };
}

// â”€â”€ Bulk email sending (for campaigns) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendBulkEmails(
  recipients: { id: string; email: string; name?: string }[],
  subject: string,
  htmlTemplate: string,
  campaignId: string,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');
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

// â”€â”€ Test email connection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (resend) {
    return { success: true };
  }

  const transporter = await createTransporter();
  if (!transporter) {
    return { success: false, error: 'No email provider configured (set RESEND_API_KEY or SMTP settings)' };
  }
  try {
    await transporter.verify();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// â”€â”€ Email Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getBaseLayout(subject: string): Promise<{ header: string; footer: string }> {
  const logo = await getSiteSetting('site_logo_url', '');
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const primaryColor = await getSiteSetting('brand_primary_color', '#c2631a');
  const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');

  const header = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(subject)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7f5f2; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
    .wrapper { max-width: 600px; margin: 0 auto; }
    .email-body { background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.06); margin: 24px 16px; }
    .header { background: linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, -20)}); padding: 32px; text-align: center; }
    .header img { max-height: 44px; }
    .header h1 { color: #ffffff; font-size: 22px; margin: 8px 0 0; font-weight: 700; letter-spacing: -0.3px; }
    .content { padding: 36px 32px; line-height: 1.7; font-size: 15px; color: #333333; }
    .content h2 { color: ${primaryColor}; font-size: 22px; margin: 0 0 16px; font-weight: 700; }
    .content p { margin: 0 0 16px; }
    .btn { display: inline-block; background: ${primaryColor}; color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin: 8px 0; }
    .btn:hover { opacity: 0.9; }
    .btn-outline { display: inline-block; border: 2px solid ${primaryColor}; color: ${primaryColor} !important; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; background: transparent; }
    .divider { height: 1px; background: #e8e5e1; margin: 24px 0; }
    .highlight-box { background: #fef9f3; border-left: 4px solid ${primaryColor}; padding: 16px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .code-box { background: #f4f1ed; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${primaryColor}; }
    .footer { padding: 24px 32px; text-align: center; font-size: 12px; color: #999999; }
    .footer a { color: ${primaryColor}; text-decoration: underline; }
    .footer p { margin: 4px 0; }
    .social-links { margin: 12px 0; }
    .social-links a { display: inline-block; margin: 0 6px; color: #888; text-decoration: none; font-size: 13px; }
    @media (max-width: 600px) {
      .content { padding: 24px 20px; }
      .header { padding: 24px 20px; }
      .code-box { font-size: 24px; letter-spacing: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="email-body">
      <div class="header">
        ${logo ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(siteName)}" />` : `<table cellpadding="0" cellspacing="0" border="0" align="center"><tr><td style="font-size:28px;padding-right:8px;">&#x1F4DA;</td><td><h1 style="margin:0;color:#fff;font-size:22px;">${escapeHtml(siteName)}</h1></td></tr></table>`}
      </div>
      <div class="content">`;

  const footer = `
      </div>
      <div class="footer">
        <div class="social-links">
          <a href="${escapeHtml(siteUrl)}">&#x1F310; Website</a>
        </div>
        <p>&copy; ${new Date().getFullYear()} ${escapeHtml(siteName)}. All rights reserved.</p>
        <p><a href="${escapeHtml(siteUrl)}/legal/privacy_policy">Privacy Policy</a> &middot; <a href="${escapeHtml(siteUrl)}/legal/terms_conditions">Terms</a></p>
        <p style="margin-top:12px;color:#bbb;">{{unsubscribe_link}}</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { header, footer };
}

/** Darken/lighten a hex color by amount (-/+) */
function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xFF) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xFF) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xFF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// â”€â”€ Public Template Functions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getBaseEmailTemplate(): Promise<string> {
  const layout = await getBaseLayout('{{subject}}');
  return `${layout.header}
      {{content}}
${layout.footer}`;
}

export async function wrapInBaseTemplate(content: string, subject: string): Promise<string> {
  const layout = await getBaseLayout(subject);
  return `${layout.header}
${content}
${layout.footer}`.replace('{{unsubscribe_link}}', '');
}

// â”€â”€ Specific Email Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function buildWelcomeEmail(userName: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');
  const subject = `Welcome to ${siteName}, ${userName}!`;

  const layout = await getBaseLayout(subject);
  const html = `${layout.header}
        <h2>Welcome aboard, ${escapeHtml(userName)}! &#x1F389;</h2>
        <p>We're thrilled to have you join our community of book lovers. ${escapeHtml(siteName)} is your personal gateway to discovering amazing reads, tracking your favorites, and connecting with fellow bibliophiles.</p>

        <div class="divider"></div>

        <h3 style="color:#333;margin-bottom:12px;">Here's what you can do now:</h3>

        <div class="highlight-box">
          <p style="margin:0 0 8px;"><strong>&#x1F4D6; Discover Books</strong> &mdash; Browse our curated collections and find your next great read</p>
        </div>
        <div class="highlight-box">
          <p style="margin:0 0 8px;"><strong>&#x2B50; Write Reviews</strong> &mdash; Share your thoughts and help others discover great books</p>
        </div>
        <div class="highlight-box">
          <p style="margin:0 0 8px;"><strong>&#x1F4CB; Create Reading Lists</strong> &mdash; Organize your TBR and track what you've read</p>
        </div>
        <div class="highlight-box">
          <p style="margin:0 0 8px;"><strong>&#x2764; Build Your Wishlist</strong> &mdash; Save books you want to read later</p>
        </div>

        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeHtml(siteUrl)}" class="btn">Start Exploring &rarr;</a>
        </div>

        <div class="divider"></div>

        <p style="font-size:14px;color:#666;">Have questions? Just reply to this email &mdash; we'd love to hear from you.</p>
        <p style="font-size:14px;color:#666;">Happy reading! &#x1F4DA;</p>
        <p style="font-size:14px;color:#666;margin-bottom:0;"><strong>&mdash; The ${escapeHtml(siteName)} Team</strong></p>
${layout.footer}`.replace('{{unsubscribe_link}}', '');

  return { subject, html };
}

export async function buildNewsletterWelcomeEmail(subscriberName: string, subscriberEmail: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');
  const subject = `You're in! Welcome to ${siteName} Newsletter`;

  const layout = await getBaseLayout(subject);
  const displayName = subscriberName || 'Book Lover';
  const html = `${layout.header}
        <h2>Welcome to the newsletter, ${escapeHtml(displayName)}! &#x1F4EC;</h2>
        <p>You've successfully subscribed to the <strong>${escapeHtml(siteName)}</strong> newsletter. Get ready for handpicked book recommendations, exclusive reviews, and literary inspiration delivered straight to your inbox.</p>

        <div class="divider"></div>

        <h3 style="color:#333;margin-bottom:12px;">What to expect:</h3>

        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;">
          <tr>
            <td style="padding:12px 16px;background:#fef9f3;border-radius:8px;margin-bottom:8px;">
              <strong>&#x1F4DA; Curated Picks</strong><br>
              <span style="color:#666;font-size:14px;">Handpicked books tailored to what's trending</span>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
          <tr>
            <td style="padding:12px 16px;background:#fef9f3;border-radius:8px;">
              <strong>&#x270D; Exclusive Reviews</strong><br>
              <span style="color:#666;font-size:14px;">In-depth reviews and author spotlights</span>
            </td>
          </tr>
          <tr><td style="height:8px;"></td></tr>
          <tr>
            <td style="padding:12px 16px;background:#fef9f3;border-radius:8px;">
              <strong>&#x1F381; Special Offers</strong><br>
              <span style="color:#666;font-size:14px;">Deals, giveaways, and early access to new features</span>
            </td>
          </tr>
        </table>

        <div style="text-align:center;margin:28px 0;">
          <a href="${escapeHtml(siteUrl)}" class="btn">Browse Books Now &rarr;</a>
        </div>

        <div class="divider"></div>

        <p style="font-size:13px;color:#999;">You're receiving this because ${escapeHtml(subscriberEmail)} was subscribed to the ${escapeHtml(siteName)} newsletter.</p>
${layout.footer}`.replace('{{unsubscribe_link}}', `<a href="${escapeHtml(siteUrl)}/unsubscribe?email=${encodeURIComponent(subscriberEmail)}">Unsubscribe</a>`);

  return { subject, html };
}

export async function buildAdminLoginAlertEmail(adminEmail: string, ip: string, userAgent: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');
  const time = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC';
  const subject = `Admin Login Alert â€” ${siteName}`;

  const layout = await getBaseLayout(subject);
  const html = `${layout.header}
        <h2>Admin Login Detected &#x1F510;</h2>
        <p>A successful admin sign-in was detected on your <strong>${escapeHtml(siteName)}</strong> account. If this was you, no action is needed.</p>

        <div class="highlight-box" style="border-left-color:#e67e22;">
          <table cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="padding:4px 0;color:#888;font-size:14px;width:90px;">Account</td>
              <td style="padding:4px 0;font-size:14px;font-weight:600;">${escapeHtml(adminEmail)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#888;font-size:14px;">Time</td>
              <td style="padding:4px 0;font-size:14px;font-weight:600;">${time}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#888;font-size:14px;">IP Address</td>
              <td style="padding:4px 0;font-size:14px;font-weight:600;">${escapeHtml(ip)}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#888;font-size:14px;">Device</td>
              <td style="padding:4px 0;font-size:14px;font-weight:600;">${escapeHtml(parseUserAgent(userAgent))}</td>
            </tr>
          </table>
        </div>

        <p><strong>Wasn't you?</strong> If you didn't sign in, your account may be compromised. Change your password immediately:</p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(siteUrl)}/admin" class="btn" style="background:#dc3545;">Change Password &rarr;</a>
        </div>

        <div class="divider"></div>

        <p style="font-size:13px;color:#999;">This is an automated security alert from ${escapeHtml(siteName)}. You're receiving this because you are an administrator.</p>
${layout.footer}`.replace('{{unsubscribe_link}}', '');

  return { subject, html };
}

export async function build2FASetupEmail(userName: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const subject = `Two-Factor Authentication Enabled â€” ${siteName}`;

  const layout = await getBaseLayout(subject);
  const html = `${layout.header}
        <h2>2FA is now enabled &#x2705;</h2>
        <p>Hi ${escapeHtml(userName)},</p>
        <p>Two-factor authentication has been successfully enabled on your <strong>${escapeHtml(siteName)}</strong> admin account. This adds an extra layer of security to protect your account.</p>

        <div class="highlight-box">
          <p style="margin:0;"><strong>&#x1F6E1; What this means:</strong></p>
          <p style="margin:8px 0 0;font-size:14px;">Every time you sign in, you'll need to enter a 6-digit code from your authenticator app in addition to your password.</p>
        </div>

        <div class="highlight-box" style="border-left-color:#dc3545;">
          <p style="margin:0;"><strong>&#x26A0; Important &mdash; Save your backup codes!</strong></p>
          <p style="margin:8px 0 0;font-size:14px;">Make sure you've saved your backup codes in a safe place. If you lose access to your authenticator app, these are the only way to recover your account.</p>
        </div>

        <div class="divider"></div>

        <p style="font-size:13px;color:#999;">If you did not enable 2FA, please contact support immediately.</p>
${layout.footer}`.replace('{{unsubscribe_link}}', '');

  return { subject, html };
}

export async function build2FACodeEmail(code: string, userName: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const subject = `Your ${siteName} verification code: ${code}`;

  const layout = await getBaseLayout(subject);
  const html = `${layout.header}
        <h2>Verification Code</h2>
        <p>Hi ${escapeHtml(userName)}, here's your one-time verification code:</p>

        <div class="code-box">${escapeHtml(code)}</div>

        <p style="text-align:center;color:#888;font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>

        <div class="divider"></div>

        <p style="font-size:13px;color:#999;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
${layout.footer}`.replace('{{unsubscribe_link}}', '');

  return { subject, html };
}

export async function buildPasswordResetEmail(userName: string, otp: string): Promise<{ subject: string; html: string }> {
  const siteName = await getSiteSetting('site_name', 'The Book Times');
  const siteUrl = await getSiteSetting('site_url', 'https://thebooktimes.com');
  const subject = `Reset Your Password — ${siteName}`;

  const layout = await getBaseLayout(subject);
  const html = `${layout.header}
        <h2>Password Reset Request &#x1F511;</h2>
        <p>Hi ${escapeHtml(userName)},</p>
        <p>We received a request to reset your password on <strong>${escapeHtml(siteName)}</strong>. Use the verification code below to proceed:</p>

        <div class="code-box">${escapeHtml(otp)}</div>

        <p style="text-align:center;color:#888;font-size:14px;">This code expires in <strong>10 minutes</strong>.</p>
        <p style="text-align:center;color:#888;font-size:14px;">You have up to <strong>3 attempts</strong> to enter it correctly.</p>

        <div class="divider"></div>

        <div class="highlight-box" style="border-left-color:#dc3545;">
          <p style="margin:0;"><strong>&#x26A0; Didn\'t request this?</strong></p>
          <p style="margin:8px 0 0;font-size:14px;">If you didn\'t request a password reset, you can safely ignore this email. Your password will remain unchanged and no one else can access your account.</p>
        </div>

        <div class="divider"></div>

        <p style="font-size:13px;color:#999;">For security reasons, never share this code with anyone. ${escapeHtml(siteName)} staff will never ask for your OTP.</p>
${layout.footer}`.replace('{{unsubscribe_link}}', '');

  return { subject, html };
}

// â”€â”€ Personalization helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Utility â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function parseUserAgent(ua: string): string {
  if (!ua) return 'Unknown device';
  if (ua.includes('Firefox')) return 'Firefox Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome Browser';
  if (ua.includes('Edg')) return 'Microsoft Edge';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari Browser';
  if (ua.includes('curl')) return 'curl / API client';
  return ua.substring(0, 60);
}

export async function getSiteSetting(key: string, fallback: string = ''): Promise<string> {
  const row = await dbGet<any>('SELECT value FROM site_settings WHERE `key` = ?', [key]);
  return row?.value || fallback;
}
