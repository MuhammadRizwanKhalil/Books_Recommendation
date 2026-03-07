import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { logger } from '../lib/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import {
  authenticate, generateToken, rateLimit, type JwtPayload,
  generateRefreshToken, storeRefreshToken, consumeRefreshToken,
  revokeRefreshToken, revokeAllRefreshTokens,
} from '../middleware.js';
import { sendEmail, wrapInBaseTemplate, getSiteSetting } from '../services/email.js';
import { validate, registerSchema, loginSchema, updateProfileSchema } from '../lib/validation.js';

const router = Router();

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── POST /api/auth/register ─────────────────────────────────────────────────
// Zod validates email (format, lowercase, trim), password (6-128 chars), name (1-100, trimmed)
router.post('/register', rateLimit('register', 5, 60 * 60 * 1000), validate(registerSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
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

    // ── Fire-and-forget: Admin notification ─────────────────────────────
    try {
      if (await getSiteSetting('notify_new_user', 'true') === 'true') {
        const adminEmail = await getSiteSetting('admin_email', '');
        if (adminEmail) {
          const siteName = await getSiteSetting('site_name', 'BookDiscovery');
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

// ── POST /api/auth/login ────────────────────────────────────────────────────
// Zod validates email + password presence
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
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = generateToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken();
    await storeRefreshToken(user.id, refreshToken);

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
  } catch (err: any) {
    logger.error({ err: err }, 'Login error');
    res.status(500).json({ error: 'Failed to login' });
  }
});

// ── POST /api/auth/refresh ──────────────────────────────────────────────────
// Exchange a valid refresh token for a new access + refresh token pair (token rotation)
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

    // Issue new token pair
    const newAccessToken = generateToken({ userId: user.userId, email: user.email, role: user.role as 'user' | 'admin' });
    const newRefreshToken = generateRefreshToken();
    await storeRefreshToken(user.userId, newRefreshToken);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (err: any) {
    logger.error({ err: err }, 'Token refresh error');
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// ── POST /api/auth/logout ───────────────────────────────────────────────────
// Revoke a specific refresh token
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

// ── POST /api/auth/logout-all ───────────────────────────────────────────────
// Revoke ALL refresh tokens for the user (sign out everywhere)
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  try {
    await revokeAllRefreshTokens(req.user!.userId);
    res.json({ message: 'All sessions revoked successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

// ── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await dbGet<any>('SELECT id, email, name, avatar_url, role, created_at FROM users WHERE id = ?', [req.user!.userId]);
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
      createdAt: user.created_at,
      reviewCount,
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get profile error');
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ── PUT /api/auth/me ────────────────────────────────────────────────────────
// Zod validates name (optional, 1-100), newPassword (optional, 6-128), requires currentPassword if newPassword
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
