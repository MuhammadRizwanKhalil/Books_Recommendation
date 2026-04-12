import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initPool, initDatabase, closePool, dbGet } from './database.js';
import { createSeoRenderer } from './middleware/seoRenderer.js';
import { rateLimit, rateLimitByTier } from './middleware.js';
import { logger, httpLogger } from './lib/logger.js';
import { sanitizeInput } from './lib/sanitize.js';

// Route imports
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import authorsRoutes from './routes/authors.js';
import blogRoutes from './routes/blog.js';
import reviewsRoutes from './routes/reviews.js';
import analyticsRoutes from './routes/analytics.js';
import newsletterRoutes from './routes/newsletter.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes, { seedDefaultSettings } from './routes/settings.js';
import categoriesRoutes, { ensureDefaultCategories } from './routes/categories.js';
import campaignsRoutes from './routes/campaigns.js';
import importRoutes from './routes/import.js';
import seoRoutes from './routes/seo.js';
import wishlistRoutes from './routes/wishlist.js';
import readingListsRoutes from './routes/readingLists.js';
import readingProgressRoutes from './routes/readingProgress.js';
import emailDigestRoutes from './routes/emailDigest.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import experimentsRoutes from './routes/experiments.js';
import webhooksRoutes from './routes/webhooks.js';
import testimonialsRoutes from './routes/testimonials.js';
import imageProxyRoutes from './routes/imageProxy.js';
import quotesRoutes from './routes/quotes.js';
import genrePreferencesRoutes from './routes/genrePreferences.js';

// Job imports
import { startImportCron, stopImportCron } from './jobs/bookImport.js';
import { startBlogCron, stopBlogCron } from './jobs/blogGeneration.js';
import { startRetentionCron, stopRetentionCron } from './jobs/dataRetention.js';
import { startDigestCron, stopDigestCron } from './jobs/emailDigest.js';
import { recalculateAllScores } from './services/scoring.js';
import cron from 'node-cron';

const app = express();

// ── Performance & Security Middleware ────────────────────────────────────────

// Trust proxy (required behind reverse proxy / Docker for correct req.ip / rate limiting)
app.set('trust proxy', 1);

// Gzip/deflate compression for all text responses (threshold 1 KB)
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", config.frontendUrl, "https://books.google.com", "https://www.googleapis.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Support comma-separated CORS origins (e.g. "http://localhost:5173,https://thebooktimes.com")
const allowedOrigins = config.frontendUrl.split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeInput);

// ── Request ID Tracking ─────────────────────────────────────────────────────
app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] as string || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
});

// Enable weak ETags on all responses for conditional caching (304 Not Modified)
app.set('etag', 'weak');

// ── Cache Control Middleware ────────────────────────────────────────────────

// Cache public GET endpoints (5 min for lists, 1 min for dynamic)
function cacheControl(maxAge: number) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (_req.method === 'GET') {
      res.set('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${maxAge * 2}`);
    }
    next();
  };
}

// Request logging (structured, all environments)
app.use(httpLogger);

// ── Maintenance Mode Middleware ─────────────────────────────────────────────
// Check the `maintenance_mode` setting and block public access when enabled.
// In-memory cache avoids a DB query on every single request.
let maintenanceCache: { value: boolean; expiresAt: number } = { value: false, expiresAt: 0 };
const MAINTENANCE_CACHE_TTL = 30_000; // 30 seconds

app.use(async (req, res, next) => {
  // Always allow: health check, admin routes, auth, settings, SEO
  if (
    req.path === '/api/health' ||
    req.path.startsWith('/api/auth') ||
    req.path.startsWith('/api/admin') ||
    req.path.startsWith('/api/settings') ||
    req.path.startsWith('/api/import') ||
    req.path.startsWith('/api/campaigns') ||
    req.path === '/robots.txt' ||
    req.path === '/sitemap.xml'
  ) {
    return next();
  }
  try {
    const now = Date.now();
    if (now > maintenanceCache.expiresAt) {
      const row = await dbGet<any>("SELECT value FROM site_settings WHERE `key` = 'maintenance_mode'");
      maintenanceCache = {
        value: row?.value === 'true',
        expiresAt: now + MAINTENANCE_CACHE_TTL,
      };
    }
    if (maintenanceCache.value) {
      res.status(503).json({
        error: 'Site is under maintenance. Please check back shortly.',
        maintenance: true,
      });
      return;
    }
  } catch { /* proceed if settings unavailable */ }
  next();
});

// ── Global API Rate Limiting ────────────────────────────────────────────────
// Allow 120 requests per minute per IP across all API endpoints
app.use('/api', rateLimitByTier('global-api', {
  anonymous: { max: 60,  windowMs: 60 * 1000 },  // 60 req/min for anonymous
  user:      { max: 120, windowMs: 60 * 1000 },  // 120 req/min for authenticated users
  admin:     { max: 300, windowMs: 60 * 1000 },  // 300 req/min for admins
}));

// ── API Routes ──────────────────────────────────────────────────────────────

app.use('/api/auth', authRoutes);
app.use('/api/books', cacheControl(60), booksRoutes);          // 1 min cache
app.use('/api/authors', cacheControl(300), authorsRoutes);       // 5 min cache
app.use('/api/categories', cacheControl(300), categoriesRoutes); // 5 min cache
app.use('/api/blog', cacheControl(300), blogRoutes);             // 5 min cache
app.use('/api/reviews', cacheControl(60), reviewsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/admin', dashboardRoutes);
app.use('/api/settings', settingsRoutes);     // settings has own cache logic
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reading-lists', readingListsRoutes);
app.use('/api/reading-progress', readingProgressRoutes);
app.use('/api/email-digest', emailDigestRoutes);
app.use('/api/subscriptions', subscriptionsRoutes);
app.use('/api/experiments', experimentsRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/testimonials', cacheControl(300), testimonialsRoutes);
app.use('/api', imageProxyRoutes); // Image optimization proxy
app.use('/api/quotes', cacheControl(60), quotesRoutes);             // Book quotes
app.use('/api/genre-preferences', genrePreferencesRoutes);           // User genre onboarding

// SEO routes (sitemap, robots.txt, structured data)
app.use('/', seoRoutes);

// ── Health Check ────────────────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  let dbStatus = 'error';
  try {
    const pool = (await import('./database.js')).getPool();
    const [rows] = await pool.execute('SELECT 1 AS ok');
    if (Array.isArray(rows) && rows.length > 0) dbStatus = 'ok';
  } catch { /* DB unreachable */ }

  const healthy = dbStatus === 'ok';
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    env: config.nodeEnv,
    uptime: Math.floor(process.uptime()),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    services: {
      database: dbStatus,
    },
  });
});

// ── Production Static File Serving + SEO Renderer ──────────────────────────
// In production, the Express server serves the built frontend AND injects
// dynamic meta tags / JSON-LD for crawlers and social media bots.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDistPath = path.resolve(__dirname, '../../app/dist');

// Serve uploaded files (cover images, etc.)
const uploadsPath = path.resolve(process.cwd(), 'data', 'uploads');
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
app.use('/uploads', express.static(uploadsPath, {
  maxAge: '30d',
  etag: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=2592000');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// Serve static assets (JS, CSS, images) from the build output
// Hashed assets (assets/) get immutable caching; others get shorter cache
app.use('/assets', express.static(path.join(frontendDistPath, 'assets'), {
  maxAge: '1y',
  immutable: true,          // Hashed filenames never change
  etag: true,
  lastModified: false,
  index: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

app.use(express.static(frontendDistPath, {
  maxAge: '1h',             // Non-hashed files (favicon, manifest, sw.js) — shorter cache
  etag: true,
  index: false,             // Don't auto-serve index.html (SEO renderer handles it)
  setHeaders: (res, filePath) => {
    // Service worker must never be cached long
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// For ALL other routes (SPA page URLs), inject SEO meta and serve index.html
app.use(createSeoRenderer(frontendDistPath));

// ── Error handling ──────────────────────────────────────────────────────────

// Only return JSON 404 for /api/* paths that weren't matched
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'Route not found' });
  } else {
    next();
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err, requestId: _req.headers['x-request-id'] }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start Server ────────────────────────────────────────────────────────────

// ── Async Bootstrap ─────────────────────────────────────────────────────────
async function bootstrap() {
  // Initialize MySQL pool + schema
  await initPool();
  await initDatabase();
  await seedDefaultSettings();
  await ensureDefaultCategories();

  const server = app.listen(config.port, () => {
    logger.info({
      url: `http://localhost:${config.port}`,
      env: config.nodeEnv,
      db: `${config.mysql.host}:${config.mysql.port}/${config.mysql.database}`,
      cors: config.frontendUrl,
    }, '🚀 The Book Times API Server started');

    // Warn about missing optional but important API keys
    if (!config.googleBooksApiKey) {
      logger.warn('⚠️  GOOGLE_BOOKS_API_KEY is not set. Book imports will use unauthenticated API (100 req/min limit). Set GOOGLE_BOOKS_API_KEY in .env for 1000 req/100s.');
    }
    if (!config.openaiApiKey) {
      logger.warn('⚠️  OPENAI_API_KEY is not set. AI blog generation is disabled.');
    }
    if (!config.resendApiKey) {
      logger.warn('⚠️  RESEND_API_KEY is not set. Email features (digest, welcome, 2FA) are disabled.');
    }

    // Start the daily book import cron job
    if (config.importJob.enabled) {
      startImportCron();
    }

    // Start AI blog generation cron
    startBlogCron();

    // Start data retention cron (purge old analytics)
    startRetentionCron();

    // Start email digest cron (hourly check)
    startDigestCron();

    // Score recalculation cron — runs every 2 hours to keep composite scores fresh
    cron.schedule('0 */2 * * *', async () => {
      try {
        const result = await recalculateAllScores();
        if (result.updated > 0) {
          logger.info(`📊 Score recalculation: ${result.updated} books updated in ${result.duration}ms`);
        }
      } catch (err) {
        logger.error({ err: err }, 'Score recalculation error');
      }
    });

    // Run initial score recalculation on startup (non-blocking)
    setTimeout(async () => {
      try {
        const result = await recalculateAllScores();
        logger.info(`📊 Initial score recalculation: ${result.updated} books updated in ${result.duration}ms`);
      } catch (err) {
        logger.error({ err: err }, 'Initial score recalculation error');
      }
    }, 5000);
  });

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  function shutdown(signal: string) {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    // Stop scheduled jobs
    try { stopImportCron(); } catch {}
    try { stopBlogCron(); } catch {}
    try { stopRetentionCron(); } catch {}
    try { stopDigestCron(); } catch {}
    server.close(async () => {
      try { await closePool(); } catch {}
      logger.info('Server closed.');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10_000);
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  logger.error({ err: err }, 'Failed to start server');
  process.exit(1);
});

// Catch unhandled promise rejections and uncaught exceptions to prevent silent crashes
process.on('unhandledRejection', (reason: any) => {
  logger.error({ err: reason }, 'Unhandled Promise Rejection');
});
process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught Exception');
  // Give time to flush logs, then exit
  setTimeout(() => process.exit(1), 1000);
});
