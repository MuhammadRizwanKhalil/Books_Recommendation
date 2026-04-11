import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { logger } from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import {
  authenticate, requireAdmin, generateToken, rateLimit, type JwtPayload,
  generateRefreshToken, storeRefreshToken, consumeRefreshToken,
  revokeRefreshToken, revokeAllRefreshTokens,
} from '../middleware.js';
import {
  sendEmail, wrapInBaseTemplate, getSiteSetting,
  buildWelcomeEmail, buildAdminLoginAlertEmail,
  build2FASetupEmail, build2FACodeEmail,
} from '../services/email.js';
import { validate, registerSchema, loginSchema, updateProfileSchema } from '../lib/validation.js';
import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const router = Router();

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Log a login event for audit trail */
async function logLoginEvent(userId: string, eventType: string, req: Request): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO login_events (id, user_id, event_type, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), userId, eventType, req.ip || 'unknown', (req.headers['user-agent'] || '').substring(0, 500)],
    );
  } catch (e) {
    logger.error({ err: e }, 'Failed to log login event');
  }
}

/** Short-lived token for 2FA step (5 minutes) */
function generate2FATempToken(userId: string, email: string, role: string): string {
  const payload = { userId, email, role, purpose: '2fa-pending' };
  return jwt.sign(payload, config.jwt.secret + ':2fa', { expiresIn: '5m' } as jwt.SignOptions);
}

function verify2FATempToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const payload = jwt.verify(token, config.jwt.secret + ':2fa') as any;
    if (payload.purpose !== '2fa-pending') return null;
    return { userId: payload.userId, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

/** Generate random backup codes */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}

/** Hash backup codes for storage */
function hashBackupCodes(codes: string[]): string[] {
  return codes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
}

// â”€â”€ POST /api/auth/register â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/register', rateLimit('register', 5, 60 * 60 * 1000), validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    const existing = await dbGet<any>('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`;

    await dbRun(`
      INSERT INTO users (id, email, name, password_hash, avatar_url, role)
      VALUES (?, ?, ?, ?, ?, 'user')
    `, [id, email, name, passwordHash, avatarUrl]);

    const token = generateToken({ userId: id, email, role: 'user' });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(id, refreshToken);

    res.status(201).json({
      token,
      refreshToken,
      user: { id, email, name, avatarUrl, role: 'user' },
    });

    // â”€â”€ Fire-and-forget: Welcome email to user â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const welcomeEmail = await buildWelcomeEmail(name.trim());
      sendEmail({ to: email, subject: welcomeEmail.subject, html: welcomeEmail.html })
        .catch(e => logger.error({ err: e }, 'Welcome email failed'));
    } catch (e) {
      logger.error({ err: e }, 'Welcome email build failed');
    }

    // â”€â”€ Fire-and-forget: Admin notification â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      if (await getSiteSetting('notify_new_user', 'true') === 'true') {
        const adminEmail = await getSiteSetting('admin_email', '');
        if (adminEmail) {
          const siteName = await getSiteSetting('site_name', 'The Book Times');
          const html = await wrapInBaseTemplate(
            `<h2>New User Registration</h2><p>A new user has registered:</p><p><strong>Name:</strong> ${escapeHtml(name.trim())}</p><p><strong>Email:</strong> ${escapeHtml(email.toLowerCase().trim())}</p>`,
            `New User - ${siteName}`,
          );
          sendEmail({ to: adminEmail, subject: `[${siteName}] New User Registration: ${escapeHtml(name.trim())}`, html }).catch(e => logger.error({ err: e }, 'Admin notification failed'));
        }
      }
    } catch (e) {
      logger.error({ err: e }, 'Admin notification failed');
    }
  } catch (err: any) {
    logger.error({ err: err }, 'Register error');
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// â”€â”€ POST /api/auth/login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/login', rateLimit('login', 10, 15 * 60 * 1000), validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await dbGet<any>('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({ error: 'Account is disabled' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      await logLoginEvent(user.id, 'failed_login', req);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // â”€â”€ 2FA check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (user.totp_enabled) {
      const tempToken = generate2FATempToken(user.id, user.email, user.role);
      res.json({
        requires2FA: true,
        tempToken,
        user: { email: user.email, name: user.name },
      });
      return;
    }

    // â”€â”€ Normal login (no 2FA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);
    await logLoginEvent(user.id, 'login', req);

    res.json({
      token,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        role: user.role,
      },
    });

    // â”€â”€ Fire-and-forget: Admin login alert email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (user.role === 'admin') {
      try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const ua = req.headers['user-agent'] || 'unknown';
        const alertEmail = await buildAdminLoginAlertEmail(user.email, ip, ua);
        sendEmail({ to: user.email, subject: alertEmail.subject, html: alertEmail.html })
          .catch(e => logger.error({ err: e }, 'Admin login alert email failed'));
      } catch (e) {
        logger.error({ err: e }, 'Admin login alert build failed');
      }
    }
  } catch (err: any) {
    logger.error({ err: err }, 'Login error');
    res.status(500).json({ error: 'Failed to login' });
  }
});

// â”€â”€ POST /api/auth/verify-2fa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Complete login with 2FA code after password verification
router.post('/verify-2fa', rateLimit('2fa-verify', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) {
      res.status(400).json({ error: 'Temporary token and 2FA code are required' });
      return;
    }

    const pending = verify2FATempToken(tempToken);
    if (!pending) {
      res.status(401).json({ error: 'Invalid or expired 2FA session. Please login again.' });
      return;
    }

    const user = await dbGet<any>('SELECT * FROM users WHERE id = ?', [pending.userId]);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      res.status(401).json({ error: '2FA is not enabled for this account' });
      return;
    }

    const normalizedCode = code.replace(/\s+/g, '');

    // Try TOTP code first
    const totp = new OTPAuth.TOTP({
      issuer: 'The Book Times',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.totp_secret),
    });

    const tokenDelta = totp.validate({ token: normalizedCode, window: 1 });

    if (tokenDelta !== null) {
      // Valid TOTP code
      const token = generateToken({ userId: user.id, email: user.email, role: user.role });
      const refreshToken = generateRefreshToken();
      await storeRefreshToken(user.id, refreshToken);
      await logLoginEvent(user.id, 'login_2fa', req);

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          role: user.role,
        },
      });

      // Admin login alert
      if (user.role === 'admin') {
        try {
          const ip = req.ip || req.socket.remoteAddress || 'unknown';
          const ua = req.headers['user-agent'] || 'unknown';
          const alertEmail = await buildAdminLoginAlertEmail(user.email, ip, ua);
          sendEmail({ to: user.email, subject: alertEmail.subject, html: alertEmail.html })
            .catch(e => logger.error({ err: e }, 'Admin login alert email failed'));
        } catch (e) {
          logger.error({ err: e }, 'Admin login alert build failed');
        }
      }
      return;
    }

    // Try backup code
    if (user.totp_backup_codes) {
      const backupHashes: string[] = JSON.parse(user.totp_backup_codes);
      const inputHash = crypto.createHash('sha256').update(normalizedCode.toUpperCase()).digest('hex');
      const idx = backupHashes.indexOf(inputHash);

      if (idx !== -1) {
        // Valid backup code â€” consume it
        backupHashes.splice(idx, 1);
        await dbRun('UPDATE users SET totp_backup_codes = ? WHERE id = ?', [JSON.stringify(backupHashes), user.id]);

        const token = generateToken({ userId: user.id, email: user.email, role: user.role });
        const refreshToken = generateRefreshToken();
        await storeRefreshToken(user.id, refreshToken);
        await logLoginEvent(user.id, 'login_2fa', req);

        res.json({
          token,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatar_url,
            role: user.role,
          },
          backupCodeUsed: true,
          remainingBackupCodes: backupHashes.length,
        });
        return;
      }
    }

    // Invalid code
    await logLoginEvent(user.id, 'failed_2fa', req);
    res.status(401).json({ error: 'Invalid verification code' });
  } catch (err: any) {
    logger.error({ err: err }, '2FA verification error');
    res.status(500).json({ error: 'Failed to verify 2FA code' });
  }
});

// â”€â”€ POST /api/auth/2fa/setup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Generate TOTP secret and QR code for setup (admin only)
router.post('/2fa/setup', authenticate, requireAdmin, rateLimit('2fa-setup', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const user = await dbGet<any>('SELECT id, email, name, totp_enabled FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.totp_enabled) {
      res.status(400).json({ error: '2FA is already enabled. Disable it first to reconfigure.' });
      return;
    }

    // Generate new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const siteName = await getSiteSetting('site_name', 'The Book Times');

    const totp = new OTPAuth.TOTP({
      issuer: siteName,
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Store secret temporarily (not yet enabled)
    await dbRun('UPDATE users SET totp_secret = ? WHERE id = ?', [secret.base32, user.id]);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    });
  } catch (err: any) {
    logger.error({ err: err }, '2FA setup error');
    res.status(500).json({ error: 'Failed to set up 2FA' });
  }
});

// â”€â”€ POST /api/auth/2fa/enable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Verify the TOTP code and enable 2FA, returning backup codes
router.post('/2fa/enable', authenticate, requireAdmin, rateLimit('2fa-enable', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Verification code is required' });
      return;
    }

    const user = await dbGet<any>('SELECT id, email, name, totp_secret, totp_enabled FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.totp_enabled) {
      res.status(400).json({ error: '2FA is already enabled' });
      return;
    }

    if (!user.totp_secret) {
      res.status(400).json({ error: 'Please call /2fa/setup first' });
      return;
    }

    // Validate the code
    const totp = new OTPAuth.TOTP({
      issuer: 'The Book Times',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.totp_secret),
    });

    const tokenDelta = totp.validate({ token: code.replace(/\s+/g, ''), window: 1 });
    if (tokenDelta === null) {
      res.status(400).json({ error: 'Invalid verification code. Please try again.' });
      return;
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = hashBackupCodes(backupCodes);

    // Enable 2FA
    await dbRun(
      'UPDATE users SET totp_enabled = TRUE, totp_backup_codes = ? WHERE id = ?',
      [JSON.stringify(hashedCodes), user.id],
    );

    await logLoginEvent(user.id, 'enable_2fa', req);

    res.json({
      enabled: true,
      backupCodes,
      message: 'Two-factor authentication has been enabled. Save your backup codes securely!',
    });

    // Fire-and-forget: 2FA enabled confirmation email
    try {
      const emailData = await build2FASetupEmail(user.name);
      sendEmail({ to: user.email, subject: emailData.subject, html: emailData.html })
        .catch(e => logger.error({ err: e }, '2FA setup confirmation email failed'));
    } catch (e) {
      logger.error({ err: e }, '2FA email build failed');
    }
  } catch (err: any) {
    logger.error({ err: err }, '2FA enable error');
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// â”€â”€ POST /api/auth/2fa/disable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Disable 2FA (requires current password)
router.post('/2fa/disable', authenticate, requireAdmin, rateLimit('2fa-disable', 5, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Current password is required to disable 2FA' });
      return;
    }

    const user = await dbGet<any>('SELECT id, password_hash, totp_enabled FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.totp_enabled) {
      res.status(400).json({ error: '2FA is not enabled' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    await dbRun(
      'UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, totp_backup_codes = NULL WHERE id = ?',
      [user.id],
    );

    await logLoginEvent(user.id, 'disable_2fa', req);

    res.json({ disabled: true, message: 'Two-factor authentication has been disabled.' });
  } catch (err: any) {
    logger.error({ err: err }, '2FA disable error');
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// â”€â”€ GET /api/auth/2fa/status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Check if 2FA is enabled for the current user
router.get('/2fa/status', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await dbGet<any>('SELECT totp_enabled FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ enabled: !!user.totp_enabled });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to check 2FA status' });
  }
});

// â”€â”€ POST /api/auth/refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/refresh', rateLimit('token-refresh', 30, 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const user = await consumeRefreshToken(refreshToken);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const newAccessToken = generateToken({ userId: user.userId, email: user.email, role: user.role as 'user' | 'admin' });
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.userId, newRefreshToken);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    logger.error({ err: err }, 'Token refresh error');
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// â”€â”€ POST /api/auth/logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// â”€â”€ POST /api/auth/logout-all â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  try {
    await revokeAllRefreshTokens(req.user!.userId);
    res.json({ message: 'All sessions revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// â”€â”€ GET /api/auth/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await dbGet<any>('SELECT id, email, name, avatar_url, role, totp_enabled, created_at FROM users WHERE id = ?', [req.user!.userId]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const reviewCount = (await dbGet<any>('SELECT COUNT(*) as count FROM reviews WHERE user_id = ?', [user.id]))?.count || 0;

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      role: user.role,
      twoFactorEnabled: !!user.totp_enabled,
      createdAt: user.created_at,
      reviewCount,
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get profile error');
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// â”€â”€ PUT /api/auth/me â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.put('/me', authenticate, rateLimit('update-profile', 10, 15 * 60 * 1000), validate(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body;

    if (newPassword) {
      const user = await dbGet<any>('SELECT password_hash FROM users WHERE id = ?', [req.user!.userId]);
      const isValid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }
      const newHash = await bcrypt.hash(newPassword, 12);
      await dbRun('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newHash, req.user!.userId]);
    }

    if (name) {
      await dbRun('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?', [name.trim(), req.user!.userId]);
    }

    const user = await dbGet<any>('SELECT id, email, name, avatar_url, role FROM users WHERE id = ?', [req.user!.userId]);
    res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatar_url, role: user.role });
  } catch (err: any) {
    logger.error({ err: err }, 'Update profile error');
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

