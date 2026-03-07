/**
 * Structured Logger — production-grade logging with pino.
 *
 * Usage:
 *   import { logger } from '../lib/logger.js';
 *   logger.info({ bookId }, 'Book created');
 *   logger.error({ err, userId }, 'Payment failed');
 *
 * Features:
 *   - JSON output in production, pretty in development
 *   - Request ID propagation via pino-http
 *   - Automatic redaction of sensitive fields
 *   - Log levels controllable via LOG_LEVEL env
 */

import pino from 'pino';
import pinoHttp from 'pino-http';
import { config } from '../config.js';

const isDev = config.nodeEnv === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev
    ? {
        transport: {
          target: 'pino/file',
          options: { destination: 1 },  // stdout
        },
      }
    : {}),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'password_hash',
      'token',
      'secret',
      'apiKey',
    ],
    censor: '[REDACTED]',
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Express middleware for request/response logging.
 * Attaches a child logger with requestId to `req.log`.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req.headers['x-request-id'] as string) || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  autoLogging: {
    ignore: (req) => {
      // Skip logging for health checks and static assets
      const url = req.url || '';
      return url === '/api/health' || url.startsWith('/assets/') || url.endsWith('.js') || url.endsWith('.css');
    },
  },
  customLogLevel: (_req, res, err) => {
    if (err || (res.statusCode && res.statusCode >= 500)) return 'error';
    if (res.statusCode && res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage: (req, res) => {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage: (req, _res, err) => {
    return `${req.method} ${req.url} failed: ${err.message}`;
  },
});
