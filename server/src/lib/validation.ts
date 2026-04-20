/**
 * Zod Validation Middleware & Shared Schemas
 *
 * Centralizes all request validation. Each route can import the `validate`
 * middleware and a schema to get automatic 400 errors with helpful messages.
 *
 * Usage:
 *   router.post('/register', validate(registerSchema), async (req, res) => { ... });
 */

import { z, ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── Generic Validation Middleware ────────────────────────────────────────────

interface ValidateOptions {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Express middleware that validates req.body, req.query, and/or req.params
 * against Zod schemas. On failure, returns 400 with structured error details.
 */
export function validate(schema: ValidateOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Array<{ location: string; path: string; message: string }> = [];

    if (schema.body) {
      const result = schema.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'body',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        req.body = result.data; // Use parsed (coerced/trimmed) data
      }
    }

    if (schema.query) {
      const result = schema.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'query',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        (req as any).query = result.data;
      }
    }

    if (schema.params) {
      const result = schema.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            location: 'params',
            path: issue.path.join('.'),
            message: issue.message,
          });
        }
      } else {
        req.params = result.data as any;
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

// ── Shared Field Validators ─────────────────────────────────────────────────

const email = z.string().email('Please provide a valid email address').max(255).transform(v => v.toLowerCase().trim());
const password = z.string().min(6, 'Password must be at least 6 characters').max(128, 'Password must be at most 128 characters');
const name = z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').transform(v => v.trim());
const uuid = z.string().uuid();
const slug = z.string().min(1).max(500).regex(/^[a-z0-9-]+$/, 'Invalid slug format');
const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();
const paginationPage = z.coerce.number().int().min(1).default(1);
const paginationLimit = z.coerce.number().int().min(1).max(100).default(20);

// ── Auth Schemas ────────────────────────────────────────────────────────────

export const registerSchema = {
  body: z.object({
    email,
    password,
    name,
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email().max(255).transform(v => v.toLowerCase().trim()),
    password: z.string().min(1, 'Password is required').max(128),
  }),
};

export const updateProfileSchema = {
  body: z.object({
    name: z.string().min(1).max(100).transform(v => v.trim()).optional(),
    currentPassword: z.string().max(128).optional(),
    newPassword: password.optional(),
  }).refine(
    data => !data.newPassword || data.currentPassword,
    { message: 'Current password is required to set a new password', path: ['currentPassword'] },
  ),
};

// ── Book Schemas ────────────────────────────────────────────────────────────

export const bookListSchema = {
  query: z.object({
    page: paginationPage,
    limit: paginationLimit,
    sort: z.enum(['computed_score', 'google_rating', 'published_date', 'title', 'created_at', 'ratings_count']).default('computed_score'),
    order: z.enum(['asc', 'desc']).default('desc'),
    category: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),
    language: z.string().max(10).optional(),
    status: z.enum(['PUBLISHED', 'DRAFT', 'ARCHIVED']).optional(),
  }),
};

export const bookSearchSchema = {
  query: z.object({
    q: z.string().min(1, 'Search query is required').max(200),
    page: paginationPage,
    limit: paginationLimit,
    sort: z.string().max(50).default('computed_score'),
    order: z.enum(['asc', 'desc']).default('desc'),
    category: z.string().max(100).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),
    language: z.string().max(10).optional(),
  }),
};

export const bookSlugSchema = {
  params: z.object({
    slug: z.string().min(1).max(500),
  }),
};

// ── Review Schemas ──────────────────────────────────────────────────────────

export const createReviewSchema = {
  body: z.object({
    bookId: z.string().min(1, 'Book ID is required').max(100),
    rating: z.number().min(0.5, 'Rating must be 0.5-5').max(5, 'Rating must be 0.5-5').multipleOf(0.5, 'Rating must be in 0.5 increments'),
    title: z.string().max(200, 'Title must be under 200 characters').optional(),
    content: z.string().min(20, 'Review must be at least 20 characters').max(5000, 'Review must be under 5,000 characters'),
  }),
};

// ── Newsletter Schemas ──────────────────────────────────────────────────────

export const newsletterSubscribeSchema = {
  body: z.object({
    email,
    name: z.string().max(100).transform(v => v.trim()).optional(),
  }),
};

// ── Blog Schemas ────────────────────────────────────────────────────────────

export const blogListSchema = {
  query: z.object({
    page: paginationPage,
    limit: paginationLimit,
    category: z.string().max(100).optional(),
    tag: z.string().max(100).optional(),
    search: z.string().max(200).optional(),
  }),
};

export const blogSlugSchema = {
  params: z.object({
    slug: z.string().min(1).max(500),
  }),
};

// ── Analytics Schemas ───────────────────────────────────────────────────────

export const trackEventSchema = {
  body: z.object({
    eventType: z.string().min(1).max(50),
    entityType: z.string().min(1).max(50).optional(),
    entityId: z.string().max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
};

export const pageViewSchema = {
  body: z.object({
    path: z.string().min(1).max(500),
    referrer: z.string().max(1000).optional(),
    title: z.string().max(500).optional(),
  }),
};

// ── Wishlist Schema ─────────────────────────────────────────────────────────

export const wishlistToggleSchema = {
  body: z.object({
    bookId: z.string().min(1, 'Book ID is required').max(100),
  }),
};

// ── Import Schema ───────────────────────────────────────────────────────────

export const importTriggerSchema = {
  body: z.object({
    queries: z.array(z.string().min(1).max(200)).min(1).max(50).optional(),
    maxResults: z.number().int().min(1).max(40).optional(),
  }),
};

// ── Settings Schema ─────────────────────────────────────────────────────────

export const updateSettingsSchema = {
  body: z.record(z.string(), z.string().max(10000)),
};

// ── Campaign Schema ─────────────────────────────────────────────────────────

export const createCampaignSchema = {
  body: z.object({
    subject: z.string().min(1, 'Subject is required').max(200),
    content: z.string().min(1, 'Content is required').max(100000),
    previewText: z.string().max(200).optional(),
  }),
};
