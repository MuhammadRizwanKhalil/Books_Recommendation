import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

export type SocialProvider = 'google' | 'apple';

export interface SocialIdentity {
  provider: SocialProvider;
  providerUserId: string;
  email: string | null;
  name: string;
  avatarUrl: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
}

function normalizeString(value: unknown, max = 255): string {
  return String(value || '').trim().slice(0, max);
}

function fallbackAvatar(seed: string) {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || 'reader')}`;
}

const googleOAuthClient = new OAuth2Client();

function parseMockToken(provider: SocialProvider, token: string): SocialIdentity | null {
  const prefixes = [`${provider}-mock:`, `mock-${provider}:`];
  const prefix = prefixes.find((value) => token.startsWith(value));
  if (!prefix) return null;

  try {
    const decoded = Buffer.from(token.slice(prefix.length), 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);
    const providerUserId = normalizeString(payload.sub || payload.id || payload.providerUserId, 255);
    const email = normalizeString(payload.email, 255) || null;
    const name = normalizeString(payload.name || payload.given_name || payload.email || `${provider} user`, 255);
    const avatarUrl = normalizeString(payload.picture || payload.avatarUrl, 500) || fallbackAvatar(email || name);

    if (!providerUserId) return null;

    return {
      provider,
      providerUserId,
      email,
      name,
      avatarUrl,
      accessToken: token,
      refreshToken: null,
      tokenExpiresAt: null,
    };
  } catch (err) {
    logger.warn({ err, provider }, 'Failed to parse mock social token');
    return null;
  }
}

function parseDevJwtLikeToken(provider: SocialProvider, token: string): SocialIdentity | null {
  if (config.nodeEnv === 'production') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    const providerUserId = normalizeString(payload.sub || payload.user_id, 255);
    if (!providerUserId) return null;

    const email = normalizeString(payload.email, 255) || null;
    const name = normalizeString(payload.name || payload.email || `${provider} user`, 255);
    const avatarUrl = normalizeString(payload.picture, 500) || fallbackAvatar(email || name);

    return {
      provider,
      providerUserId,
      email,
      name,
      avatarUrl,
      accessToken: token,
      refreshToken: null,
      tokenExpiresAt: null,
    };
  } catch (err) {
    logger.warn({ err, provider }, 'Failed to parse jwt-like social token');
    return null;
  }
}

export async function verifySocialIdentity(provider: SocialProvider, token: string): Promise<SocialIdentity | null> {
  const normalized = normalizeString(token, 4000);
  if (!normalized) return null;

  // Never allow mock tokens in production.
  if (config.nodeEnv !== 'production') {
    const mock = parseMockToken(provider, normalized);
    if (mock) return mock;
  }

  if (provider === 'google') {
    if (!config.googleAuth.clientIds.length) {
      logger.warn('Google OAuth client IDs are not configured; set GOOGLE_OAUTH_CLIENT_IDS (or GOOGLE_CLIENT_ID)');
      return null;
    }

    try {
      const ticket = await googleOAuthClient.verifyIdToken({
        idToken: normalized,
        audience: config.googleAuth.clientIds,
      });

      const payload = ticket.getPayload();
      const providerUserId = normalizeString(payload?.sub, 255);
      if (!providerUserId) return null;

      const email = normalizeString(payload?.email, 255) || null;
      const emailVerified = !!payload?.email_verified;
      const name = normalizeString(payload?.name || payload?.given_name || payload?.email || 'Google user', 255);
      const avatarUrl = normalizeString(payload?.picture, 500) || fallbackAvatar(email || name);
      const issuer = normalizeString(payload?.iss, 255);

      if (!issuer || (issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com')) {
        return null;
      }

      if (email && !emailVerified) {
        return null;
      }

      return {
        provider,
        providerUserId,
        email,
        name,
        avatarUrl,
        accessToken: normalized,
        refreshToken: null,
        tokenExpiresAt: null,
      };
    } catch (err) {
      logger.warn({ err }, 'Failed to verify Google ID token');
      return null;
    }
  }

  return parseDevJwtLikeToken(provider, normalized);
}

export async function upsertSocialAccountForUser(userId: string, identity: SocialIdentity): Promise<void> {
  const existing = await dbGet<any>(
    'SELECT user_id FROM user_social_accounts WHERE provider = ? AND provider_user_id = ?',
    [identity.provider, identity.providerUserId],
  );

  if (existing && existing.user_id !== userId) {
    throw new Error('This social account is already linked to another user');
  }

  if (existing) {
    await dbRun(
      `UPDATE user_social_accounts
       SET email = ?, access_token = ?, refresh_token = ?, token_expires_at = ?
       WHERE provider = ? AND provider_user_id = ?`,
      [
        identity.email,
        identity.accessToken ?? null,
        identity.refreshToken ?? null,
        identity.tokenExpiresAt ?? null,
        identity.provider,
        identity.providerUserId,
      ],
    );
    return;
  }

  await dbRun(
    `INSERT INTO user_social_accounts
     (id, user_id, provider, provider_user_id, email, access_token, refresh_token, token_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      userId,
      identity.provider,
      identity.providerUserId,
      identity.email,
      identity.accessToken ?? null,
      identity.refreshToken ?? null,
      identity.tokenExpiresAt ?? null,
    ],
  );
}

export async function findOrCreateUserFromSocial(identity: SocialIdentity): Promise<any> {
  const existingLinked = await dbGet<any>(
    `SELECT u.*
     FROM user_social_accounts usa
     JOIN users u ON u.id = usa.user_id
     WHERE usa.provider = ? AND usa.provider_user_id = ?
     LIMIT 1`,
    [identity.provider, identity.providerUserId],
  );

  if (existingLinked) {
    await dbRun(
      'UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?',
      [identity.name || existingLinked.name, identity.avatarUrl || existingLinked.avatar_url, existingLinked.id],
    );
    await upsertSocialAccountForUser(existingLinked.id, identity);
    return await dbGet<any>('SELECT * FROM users WHERE id = ?', [existingLinked.id]);
  }

  let user = identity.email
    ? await dbGet<any>('SELECT * FROM users WHERE email = ?', [identity.email.toLowerCase()])
    : null;

  if (!user) {
    const id = uuidv4();
    const email = identity.email || `${identity.provider}_${identity.providerUserId}@example.invalid`;
    await dbRun(
      `INSERT INTO users (id, email, name, password_hash, avatar_url, role)
       VALUES (?, ?, ?, NULL, ?, 'user')`,
      [id, email.toLowerCase(), identity.name || `${identity.provider} user`, identity.avatarUrl || fallbackAvatar(email)],
    );
    user = await dbGet<any>('SELECT * FROM users WHERE id = ?', [id]);
  } else {
    await dbRun(
      'UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = NOW() WHERE id = ?',
      [identity.name || user.name, identity.avatarUrl || user.avatar_url, user.id],
    );
    user = await dbGet<any>('SELECT * FROM users WHERE id = ?', [user.id]);
  }

  await upsertSocialAccountForUser(user.id, identity);
  return user;
}

export async function getLinkedAccounts(userId: string): Promise<{ google: boolean; apple: boolean; hasPassword: boolean }> {
  const rows = await dbAll<any>('SELECT provider FROM user_social_accounts WHERE user_id = ?', [userId]);
  const user = await dbGet<any>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  const providers = new Set(rows.map((row) => row.provider));
  return {
    google: providers.has('google'),
    apple: providers.has('apple'),
    hasPassword: !!user?.password_hash,
  };
}

export async function unlinkSocialAccount(userId: string, provider: SocialProvider): Promise<{ success: boolean }> {
  const rows = await dbAll<any>('SELECT id, provider FROM user_social_accounts WHERE user_id = ?', [userId]);
  const user = await dbGet<any>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  const socialCount = rows.length;
  const hasPassword = !!user?.password_hash;
  const linked = rows.find((row) => row.provider === provider);

  if (!linked) {
    return { success: true };
  }

  if (!hasPassword && socialCount <= 1) {
    throw new Error('Set a password first before unlinking your last social sign-in method');
  }

  await dbRun('DELETE FROM user_social_accounts WHERE user_id = ? AND provider = ?', [userId, provider]);
  return { success: true };
}
