import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

export const config = {
  port: (() => {
    const p = parseInt(process.env.PORT || '3001', 10);
    if (Number.isNaN(p) || p < 1 || p > 65535) {
      throw new Error(`Invalid PORT: "${process.env.PORT}" — must be a number between 1 and 65535`);
    }
    return p;
  })(),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: (() => {
      const s = process.env.JWT_SECRET;
      if (!s && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      return s || 'dev-thebooktimes-jwt-secret-do-not-use-in-production';
    })(),
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    userExpiresIn: process.env.JWT_USER_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '24h',
    adminExpiresIn: process.env.JWT_ADMIN_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '24h',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@thebooktimes.com',
    password: (() => {
      const p = process.env.ADMIN_PASSWORD;
      if (!p && process.env.NODE_ENV === 'production') {
        throw new Error('ADMIN_PASSWORD environment variable is required in production');
      }
      return p || 'admin123456';
    })(),
  },
  ga: {
    measurementId: process.env.GA_MEASUREMENT_ID || 'G-TDW096P47M',
    propertyId: process.env.GA_PROPERTY_ID || '',
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || './ga-credentials.json',
  },
  frontendUrl: (() => {
    const url = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (process.env.NODE_ENV === 'production' && /(localhost|127\.0\.0\.1)/i.test(url)) {
      console.warn('⚠️  FRONTEND_URL is still set to localhost — CORS will reject production requests. Set FRONTEND_URL to your real domain.');
    }
    return url;
  })(),

  // ── MySQL Database ──────────────────────────────────────────────────────
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'thebooktimes',
    password: (() => {
      const p = process.env.MYSQL_PASSWORD;
      if (!p && process.env.NODE_ENV === 'production') {
        throw new Error('MYSQL_PASSWORD environment variable is required in production');
      }
      return p || 'thebooktimes';
    })(),
    database: process.env.MYSQL_DATABASE || 'thebooktimes',
    connectionLimit: parseInt(process.env.MYSQL_POOL_SIZE || '10', 10),
  },

  // Google Books API
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',

  // Google OAuth (Sign-In)
  googleAuth: {
    clientIds: String(
      process.env.GOOGLE_OAUTH_CLIENT_IDS
      || process.env.GOOGLE_CLIENT_ID
      || process.env.VITE_GOOGLE_CLIENT_ID
      || '',
    )
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  },

  // Resend email API
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'The Book Times <noreply@thebooktimes.com>',

  // OpenAI API (for AI blog generation)
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

  // Book Import Job configuration
  importJob: {
    enabled: process.env.IMPORT_JOB_ENABLED !== 'false',
    cronSchedule: process.env.IMPORT_CRON_SCHEDULE || '0 3 * * *',
    timezone: process.env.IMPORT_CRON_TIMEZONE || 'UTC',
    runOnStartup: process.env.IMPORT_RUN_ON_STARTUP === 'true',
    booksPerCategory: Math.max(1, parseInt(process.env.IMPORT_BOOKS_PER_CATEGORY || '40', 10) || 40),
    dailyBooksPerQuery: Math.max(1, parseInt(process.env.IMPORT_DAILY_PER_QUERY || '30', 10) || 30),
  },

  // AI Blog auto-posting cron
  aiBlog: {
    enabled: process.env.AI_BLOG_ENABLED === 'true',
    cronSchedule: process.env.AI_BLOG_CRON_SCHEDULE || '0 9 * * *',  // Daily at 9 AM UTC
    postsPerRun: Math.max(1, parseInt(process.env.AI_BLOG_POSTS_PER_RUN || '1', 10) || 1),
  },

  // AI Enrichment — auto-submit newly imported books for batch AI analysis
  aiEnrichment: {
    enabled: process.env.AI_ENRICHMENT_ENABLED !== 'false',  // Enabled by default when OPENAI_API_KEY is set
    batchSize: Math.max(1, parseInt(process.env.AI_ENRICHMENT_BATCH_SIZE || '100', 10) || 100),
  },
};
