/**
 * Input Sanitization Middleware
 * ─────────────────────────────
 * Strips HTML tags and trims whitespace from all string values in
 * req.body, req.query, and req.params before they reach route handlers.
 *
 * Exceptions:
 *   - Fields listed in `ALLOW_HTML_FIELDS` are left untouched (e.g.
 *     rich-text content that is meant to contain HTML).
 *   - Non-string values are passed through unchanged.
 *
 * Usage:
 *   import { sanitizeInput } from './lib/sanitize.js';
 *   app.use(sanitizeInput);
 */

import { Request, Response, NextFunction } from 'express';

// Fields that legitimately contain HTML (admin-authored rich text).
// These are still sanitized on the frontend with DOMPurify before rendering.
const ALLOW_HTML_FIELDS = new Set([
  'content',         // blog post / email body
  'html_content',    // email template / campaign HTML
  'plain_content',   // email plain-text (no HTML but allow angle brackets)
  'description',     // book / category / author descriptions (may have basic HTML)
  'bio',             // author bio
  'generated_content',
]);

/**
 * Strip all HTML tags from a string using a simple regex.
 * This is NOT a full XSS sanitizer — it only strips `<…>` sequences.
 * For rendering user HTML, always use DOMPurify on the client.
 */
function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

/**
 * Recursively walk an object and strip HTML tags from string values
 * whose keys are not in the allow-list.
 */
function sanitizeValue(value: any, key?: string): any {
  if (typeof value === 'string') {
    // Allow HTML for certain fields
    if (key && ALLOW_HTML_FIELDS.has(key)) {
      return value;
    }
    return stripTags(value);
  }

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeValue(v));
  }

  if (value !== null && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = sanitizeValue(v, k);
    }
    return result;
  }

  return value;
}

/**
 * Express middleware that sanitizes req.body, req.query, and req.params.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query) as any;
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeValue(req.params) as any;
  }
  next();
}
