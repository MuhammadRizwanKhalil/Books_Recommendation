import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './config.js';
import { dbGet, dbRun } from './database.js';

// JWT payload type
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

// Extend Express Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Generate short-lived access token (15 min in prod, 7d in dev)
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.nodeEnv === 'production' ? '15m' : config.jwt.expiresIn,
  } as jwt.SignOptions);
}

// Generate a cryptographically random refresh token (stored in DB)
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

// Store refresh token in DB (linked to user, with 30-day expiry)
export async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await dbRun(
    `INSERT INTO refresh_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
    [crypto.randomUUID(), userId, token, expiresAt],
  );
}

// Validate and consume a refresh token (one-time use: token rotation)
export async function consumeRefreshToken(token: string): Promise<{ userId: string; email: string; role: string } | null> {
  const row = await dbGet<any>(
    `SELECT rt.id, rt.user_id, u.email, u.role, u.is_active, rt.expires_at
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token = ? AND rt.revoked_at IS NULL`,
    [token],
  );

  if (!row) return null;

  // Check expiry
  if (new Date(row.expires_at) < new Date()) {
    await dbRun(`DELETE FROM refresh_tokens WHERE id = ?`, [row.id]);
    return null;
  }

  // Check user still active
  if (!row.is_active) return null;

  // Revoke used token (rotation — each refresh token is single-use)
  await dbRun(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?`, [row.id]);

  return { userId: row.user_id, email: row.email, role: row.role };
}

// Revoke all refresh tokens for a user (used on password change / logout-all)
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await dbRun(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`, [userId]);
}

// Revoke a single refresh token (used on logout)
export async function revokeRefreshToken(token: string): Promise<void> {
  await dbRun(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL`, [token]);
}

// Clean up expired refresh tokens (called by data retention cron)
export async function cleanExpiredRefreshTokens(): Promise<number> {
  const result = await dbRun(`DELETE FROM refresh_tokens WHERE expires_at < NOW() OR (revoked_at IS NOT NULL AND revoked_at < DATE_SUB(NOW(), INTERVAL 7 DAY))`);
  return result.changes;
}

// Verify JWT token
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

// Auth middleware — requires valid JWT
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Verify user still exists and is active — read latest role from DB
  dbGet<any>('SELECT id, role, is_active FROM users WHERE id = ?', [payload.userId])
    .then(user => {
      if (!user || !user.is_active) {
        res.status(401).json({ error: 'User account is disabled or not found' });
        return;
      }
      // Always use the DB role (in case it changed since token was issued)
      req.user = { ...payload, role: user.role };
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid or expired token' });
    });
}

// Admin middleware — requires admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// Optional auth — attaches user if token present, but doesn't require it
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const payload = verifyToken(token);
        dbGet<any>('SELECT id, role, is_active FROM users WHERE id = ?', [payload.userId])
          .then(user => {
            if (user && user.is_active) {
              req.user = { ...payload, role: user.role };
            }
            next();
          })
          .catch(() => {
            next();
          });
        return; // Don't call next() synchronously — it will be called in the promise
      } catch {
        // Token invalid — proceed without user
      }
    }
  }
  next();
}

// ── Rate Limiter ────────────────────────────────────────────────────────────
// Simple in-memory rate limiter. Key = IP + action.

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean expired entries every 5 minutes — keep reference for graceful shutdown
const rateLimitCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (entry.resetAt <= now) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);
// Allow the process to exit even if the interval is still running
rateLimitCleanupInterval.unref();

export function rateLimit(action: string, maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${action}:${ip}`;
    const now = Date.now();

    const entry = rateLimitStore.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= maxAttempts) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', maxAttempts);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter,
        });
        return;
      }
      entry.count++;
      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - entry.count));
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', maxAttempts - 1);
    }
    next();
  };
}

// ── Tier-based Rate Limiter ─────────────────────────────────────────────────
// Different limits for anonymous, authenticated users, and admins.
// Tiers: anonymous < user < admin

export interface TierLimits {
  anonymous: { max: number; windowMs: number };
  user:      { max: number; windowMs: number };
  admin:     { max: number; windowMs: number };
}

/**
 * Rate limiter that applies different limits based on auth tier.
 * Authenticated requests are keyed by userId; anonymous by IP.
 */
export function rateLimitByTier(action: string, limits: TierLimits) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();

    // Determine tier
    let tier: 'anonymous' | 'user' | 'admin' = 'anonymous';
    let identity: string;

    if (req.user) {
      tier = req.user.role === 'admin' ? 'admin' : 'user';
      identity = req.user.userId;
    } else {
      // Try to silently decode token (non-blocking)
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        try {
          const decoded = jwt.verify(authHeader.slice(7), config.jwt.secret) as JwtPayload;
          tier = decoded.role === 'admin' ? 'admin' : 'user';
          identity = decoded.userId;
        } catch {
          identity = req.ip || req.socket.remoteAddress || 'unknown';
        }
      } else {
        identity = req.ip || req.socket.remoteAddress || 'unknown';
      }
    }

    const { max, windowMs } = limits[tier];
    const key = `${action}:${tier}:${identity}`;

    const entry = rateLimitStore.get(key);
    if (entry && entry.resetAt > now) {
      if (entry.count >= max) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retryAfter);
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Tier', tier);
        res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter,
          tier,
        });
        return;
      }
      entry.count++;
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    } else {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
    }
    res.setHeader('X-RateLimit-Tier', tier);
    next();
  };
}
