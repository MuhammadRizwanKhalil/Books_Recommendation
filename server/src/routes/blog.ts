import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import multer from 'multer';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin, optionalAuth } from '../middleware.js';

const router = Router();

// ── Upload config ───────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads', 'blog');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are allowed'));
  },
});

// ── AI Blog Generation ──────────────────────────────────────────────────────

import { generateBlogPost } from '../services/blogGenerator.js';
import { testOpenAIConnection } from '../services/openai.js';
import { config } from '../config.js';

// POST /api/blog/generate-ai — Generate an AI blog post (admin only)
router.post('/generate-ai', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { autoPublish } = req.body || {};
    const post = await generateBlogPost({ autoPublish: !!autoPublish });
    res.json({
      success: true,
      post: {
        title: post.title,
        slug: post.slug,
        category: post.category,
        excerpt: post.excerpt,
        tokensUsed: post.tokensUsed,
        model: post.model,
        featuredBooks: post.featuredBookIds.length,
      },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'AI blog generation error');
    res.status(500).json({ error: err.message || 'Failed to generate AI blog post' });
  }
});

// GET /api/blog/ai-status — Check AI blog configuration status
router.get('/ai-status', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const openaiStatus = await testOpenAIConnection();
    const recentAiPosts = await dbAll<any>(
      "SELECT id, title, slug, status, created_at FROM blog_posts WHERE generated_by = 'ai' ORDER BY created_at DESC LIMIT 5",
    );

    res.json({
      openai: {
        configured: !!config.openaiApiKey,
        connected: openaiStatus.success,
        error: openaiStatus.error,
        model: config.openaiModel,
      },
      cron: {
        enabled: config.aiBlog.enabled,
        schedule: config.aiBlog.cronSchedule,
        postsPerRun: config.aiBlog.postsPerRun,
      },
      recentPosts: recentAiPosts,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helper: map DB row → API response ───────────────────────────────────────
async function mapPostToResponse(p: any) {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    content: p.content,
    excerpt: p.excerpt || null,
    metaTitle: p.meta_title || null,
    metaDescription: p.meta_description || null,
    featuredImage: p.featured_image || null,
    ogImage: p.og_image || null,
    canonicalUrl: p.canonical_url || null,
    focusKeyword: p.focus_keyword || null,
    seoRobots: p.seo_robots || 'index, follow',
    tags: p.tags || null,
    category: p.category || null,
    customLinkLabel: p.custom_link_label || null,
    customLinkUrl: p.custom_link_url || null,
    adminNotes: p.admin_notes || null,
    allowComments: p.allow_comments === 1 || p.allow_comments === true,
    isFeatured: p.is_featured === 1 || p.is_featured === true,
    featuredBookIds: await getFeaturedBookIds(p.id),
    status: p.status,
    publishedAt: p.published_at || null,
    generatedBy: p.generated_by || 'manual',
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// ── GET /api/blog ───────────────────────────────────────────────────────────
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '10', status } = req.query;
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = "WHERE status = 'PUBLISHED'";
    const params: any[] = [];

    // Admin can filter by any status; also return ALL statuses when no filter
    if (req.user?.role === 'admin') {
      if (status) {
        whereClause = 'WHERE status = ?';
        params.push(status);
      } else {
        whereClause = '';
      }
    }

    const totalRow = await dbGet<any>(`SELECT COUNT(*) as total FROM blog_posts ${whereClause}`, params);
    const total = totalRow.total;
    const posts = await dbAll<any>(`
      SELECT * FROM blog_posts ${whereClause}
      ORDER BY COALESCE(published_at, created_at) DESC
      LIMIT ? OFFSET ?
    `, [...params, limitNum, offset]);

    res.json({
      posts: await Promise.all(posts.map(mapPostToResponse)),
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Blog list error');
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// ── GET /api/blog/:slug ─────────────────────────────────────────────────────
router.get('/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const post = await dbGet<any>('SELECT * FROM blog_posts WHERE slug = ?', [req.params.slug]);
    if (!post) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    // Non-admin users can only see published posts
    if (post.status !== 'PUBLISHED' && req.user?.role !== 'admin') {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    res.json(await mapPostToResponse(post));
  } catch (err: any) {
    logger.error({ err: err }, 'Blog get error');
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
});

// ── POST /api/blog/upload-image (Admin) ─────────────────────────────────────
router.post('/upload-image', authenticate, requireAdmin, upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, WebP, GIF, and AVIF images are allowed.' });
      return;
    }

    const filename = `${uuidv4()}.webp`;
    const outputPath = path.join(UPLOADS_DIR, filename);

    // Convert to WebP and optimise (max 1200px wide for featured images)
    await sharp(req.file.buffer)
      .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outputPath);

    const url = `/uploads/blog/${filename}`;
    res.json({ url, filename });
  } catch (err: any) {
    logger.error({ err: err }, 'Blog image upload error');
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// ── POST /api/blog (Admin) ──────────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      title, content, excerpt, featuredImage, status, publishedAt,
      featuredBookIds, metaTitle, metaDescription,
      ogImage, canonicalUrl, focusKeyword, seoRobots,
      tags, category, customLinkLabel, customLinkUrl,
      adminNotes, allowComments, isFeatured,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    const errors: string[] = [];
    if (!title || typeof title !== 'string' || title.trim().length === 0) errors.push('Title is required');
    if (!content || typeof content !== 'string' || content.trim().length === 0) errors.push('Content is required');
    if (title && title.length > 300) errors.push('Title must be under 300 characters');
    if (metaTitle && metaTitle.length > 70) errors.push('Meta title should be under 70 characters');
    if (metaDescription && metaDescription.length > 170) errors.push('Meta description should be under 170 characters');
    if (focusKeyword && focusKeyword.length > 100) errors.push('Focus keyword must be under 100 characters');
    if (canonicalUrl && !/^https?:\/\//.test(canonicalUrl)) errors.push('Canonical URL must be a valid URL');
    if (customLinkUrl && !/^https?:\/\//.test(customLinkUrl)) errors.push('Custom link URL must be a valid URL');
    if (featuredImage && !/^(https?:\/\/|\/uploads\/)/.test(featuredImage)) errors.push('Featured image must be a valid URL');
    if (ogImage && !/^(https?:\/\/|\/uploads\/)/.test(ogImage)) errors.push('OG image must be a valid URL');

    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    const id = uuidv4();
    let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Ensure slug uniqueness
    const existing = await dbGet<any>('SELECT id FROM blog_posts WHERE slug = ?', [slug]);
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    await dbRun(`
      INSERT INTO blog_posts (
        id, title, slug, content, excerpt, featured_image,
        meta_title, meta_description, og_image, canonical_url,
        focus_keyword, seo_robots, tags, category,
        custom_link_label, custom_link_url, admin_notes,
        allow_comments, is_featured,
        status, published_at, generated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')
    `, [
      id, title.trim(), slug, content, excerpt || null, featuredImage || null,
      metaTitle || null, metaDescription || null, ogImage || null, canonicalUrl || null,
      focusKeyword || null, seoRobots || 'index, follow', tags || null, category || null,
      customLinkLabel || null, customLinkUrl || null, adminNotes || null,
      allowComments !== false ? 1 : 0, isFeatured ? 1 : 0,
      status || 'DRAFT', status === 'PUBLISHED' ? (publishedAt || new Date().toISOString()) : (publishedAt || null),
    ]);

    if (featuredBookIds && Array.isArray(featuredBookIds)) {
      for (const bookId of featuredBookIds) {
        await dbRun('INSERT IGNORE INTO blog_featured_books (blog_id, book_id) VALUES (?, ?)', [id, bookId]);
      }
    }

    const post = await dbGet<any>('SELECT * FROM blog_posts WHERE id = ?', [id]);
    res.status(201).json(await mapPostToResponse(post));
  } catch (err: any) {
    logger.error({ err: err }, 'Blog create error');
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// ── PUT /api/blog/:id (Admin) ───────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const existingPost = await dbGet<any>('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    if (!existingPost) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }

    const {
      title, content, excerpt, featuredImage, status, publishedAt,
      featuredBookIds, metaTitle, metaDescription,
      ogImage, canonicalUrl, focusKeyword, seoRobots,
      tags, category, customLinkLabel, customLinkUrl,
      adminNotes, allowComments, isFeatured,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    const errors: string[] = [];
    if (title !== undefined && (!title || title.trim().length === 0)) errors.push('Title cannot be empty');
    if (title && title.length > 300) errors.push('Title must be under 300 characters');
    if (content !== undefined && (!content || content.trim().length === 0)) errors.push('Content cannot be empty');
    if (metaTitle && metaTitle.length > 70) errors.push('Meta title should be under 70 characters');
    if (metaDescription && metaDescription.length > 170) errors.push('Meta description should be under 170 characters');
    if (focusKeyword && focusKeyword.length > 100) errors.push('Focus keyword must be under 100 characters');
    if (canonicalUrl && !/^https?:\/\//.test(canonicalUrl)) errors.push('Canonical URL must be a valid URL');
    if (customLinkUrl && !/^https?:\/\//.test(customLinkUrl)) errors.push('Custom link URL must be a valid URL');

    if (errors.length > 0) {
      res.status(400).json({ error: errors.join('; ') });
      return;
    }

    // Build slug from title if title changed
    let newSlug: string | null = null;
    if (title && title !== existingPost.title) {
      newSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slugConflict = await dbGet<any>('SELECT id FROM blog_posts WHERE slug = ? AND id != ?', [newSlug, req.params.id]);
      if (slugConflict) newSlug = `${newSlug}-${Date.now().toString(36)}`;
    }

    // Auto-set published_at for first publish
    let resolvedPublishedAt = publishedAt ?? null;
    if (status === 'PUBLISHED' && existingPost.status !== 'PUBLISHED' && !resolvedPublishedAt) {
      resolvedPublishedAt = new Date().toISOString();
    }

    await dbRun(`
      UPDATE blog_posts SET
        title = COALESCE(?, title),
        slug = COALESCE(?, slug),
        content = COALESCE(?, content),
        excerpt = ?,
        featured_image = ?,
        meta_title = ?,
        meta_description = ?,
        og_image = ?,
        canonical_url = ?,
        focus_keyword = ?,
        seo_robots = COALESCE(?, seo_robots),
        tags = ?,
        category = ?,
        custom_link_label = ?,
        custom_link_url = ?,
        admin_notes = ?,
        allow_comments = COALESCE(?, allow_comments),
        is_featured = COALESCE(?, is_featured),
        status = COALESCE(?, status),
        published_at = COALESCE(?, published_at),
        updated_at = NOW()
      WHERE id = ?
    `, [
      title ?? null,
      newSlug,
      content ?? null,
      excerpt !== undefined ? (excerpt || null) : existingPost.excerpt,
      featuredImage !== undefined ? (featuredImage || null) : existingPost.featured_image,
      metaTitle !== undefined ? (metaTitle || null) : existingPost.meta_title,
      metaDescription !== undefined ? (metaDescription || null) : existingPost.meta_description,
      ogImage !== undefined ? (ogImage || null) : existingPost.og_image,
      canonicalUrl !== undefined ? (canonicalUrl || null) : existingPost.canonical_url,
      focusKeyword !== undefined ? (focusKeyword || null) : existingPost.focus_keyword,
      seoRobots ?? null,
      tags !== undefined ? (tags || null) : existingPost.tags,
      category !== undefined ? (category || null) : existingPost.category,
      customLinkLabel !== undefined ? (customLinkLabel || null) : existingPost.custom_link_label,
      customLinkUrl !== undefined ? (customLinkUrl || null) : existingPost.custom_link_url,
      adminNotes !== undefined ? (adminNotes || null) : existingPost.admin_notes,
      allowComments !== undefined ? (allowComments ? 1 : 0) : null,
      isFeatured !== undefined ? (isFeatured ? 1 : 0) : null,
      status ?? null,
      resolvedPublishedAt,
      req.params.id,
    ]);

    if (featuredBookIds && Array.isArray(featuredBookIds)) {
      await dbRun('DELETE FROM blog_featured_books WHERE blog_id = ?', [req.params.id]);
      for (const bookId of featuredBookIds) {
        await dbRun('INSERT IGNORE INTO blog_featured_books (blog_id, book_id) VALUES (?, ?)', [req.params.id, bookId]);
      }
    }

    const post = await dbGet<any>('SELECT * FROM blog_posts WHERE id = ?', [req.params.id]);
    res.json(await mapPostToResponse(post));
  } catch (err: any) {
    logger.error({ err: err }, 'Blog update error');
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// ── DELETE /api/blog/:id (Admin) ────────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await dbRun('DELETE FROM blog_posts WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Blog post not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err }, 'Blog delete error');
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

// AI routes moved above /:slug to avoid route conflict

async function getFeaturedBookIds(blogId: string): Promise<string[]> {
  const rows = await dbAll<any>('SELECT book_id FROM blog_featured_books WHERE blog_id = ?', [blogId]);
  return rows.map(r => r.book_id);
}

export default router;
