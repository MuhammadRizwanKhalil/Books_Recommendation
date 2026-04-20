import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, requireAdmin, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

const VERIFICATION_METHODS = new Set(['email', 'social_media', 'publisher', 'manual']);
const CLAIM_STATUSES = new Set(['approved', 'rejected']);

function normalizeText(value: unknown, max = 500): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function sanitizeSocialLinks(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const allowedKeys = new Set([
    'twitter',
    'instagram',
    'facebook',
    'youtube',
    'tiktok',
    'goodreads',
    'amazon',
    'wikipedia',
    'website',
  ]);

  const out: Record<string, string> = {};
  for (const [key, rawVal] of Object.entries(value as Record<string, unknown>)) {
    if (!allowedKeys.has(key)) continue;
    const text = normalizeText(rawVal, 500);
    if (text) out[key] = text;
  }

  return out;
}

function parseSocialLinks(value: unknown): Record<string, string> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, string>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

async function getManagedAuthor(userId: string, authorId?: string) {
  if (authorId) {
    return dbGet<any>('SELECT * FROM authors WHERE id = ? AND claimed_by = ? LIMIT 1', [authorId, userId]);
  }

  return dbGet<any>('SELECT * FROM authors WHERE claimed_by = ? ORDER BY updated_at DESC LIMIT 1', [userId]);
}

function mapClaim(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    authorId: row.author_id,
    verificationMethod: row.verification_method,
    verificationProof: row.verification_proof || null,
    status: row.status,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at || null,
    createdAt: row.created_at,
    authorName: row.author_name || null,
    claimantName: row.claimant_name || null,
  };
}

router.post('/author-claims', authenticate, rateLimit('author-claims-submit', 10, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const authorId = normalizeText(req.body?.authorId, 36);
    const verificationMethod = normalizeText(req.body?.verificationMethod, 50).toLowerCase();
    const proof = normalizeText(req.body?.proof, 2000);

    if (!authorId) {
      res.status(400).json({ error: 'authorId is required' });
      return;
    }
    if (!VERIFICATION_METHODS.has(verificationMethod)) {
      res.status(400).json({ error: 'verificationMethod must be email, social_media, publisher, or manual' });
      return;
    }

    const author = await dbGet<any>('SELECT id, claimed_by FROM authors WHERE id = ? LIMIT 1', [authorId]);
    if (!author) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }
    if (author.claimed_by) {
      res.status(409).json({ error: 'This author profile is already claimed' });
      return;
    }

    const duplicate = await dbGet<any>(
      'SELECT id, status FROM author_claims WHERE user_id = ? AND author_id = ? LIMIT 1',
      [req.user!.userId, authorId],
    );
    if (duplicate) {
      res.status(409).json({ error: `You already submitted a claim for this author (status: ${duplicate.status})` });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO author_claims (id, user_id, author_id, verification_method, verification_proof)
       VALUES (?, ?, ?, ?, ?)`,
      [id, req.user!.userId, authorId, verificationMethod, proof || null],
    );

    const created = await dbGet<any>('SELECT * FROM author_claims WHERE id = ? LIMIT 1', [id]);
    res.status(201).json(mapClaim(created));
  } catch (err: any) {
    logger.error({ err }, 'Submit author claim error');
    res.status(500).json({ error: 'Failed to submit author claim' });
  }
});

router.get('/author-claims/mine', authenticate, async (req: Request, res: Response) => {
  try {
    const authorId = normalizeText(req.query.authorId, 36);

    const where = ['ac.user_id = ?'];
    const params: any[] = [req.user!.userId];
    if (authorId) {
      where.push('ac.author_id = ?');
      params.push(authorId);
    }

    const claims = await dbAll<any>(
      `SELECT ac.*, a.name AS author_name
       FROM author_claims ac
       JOIN authors a ON a.id = ac.author_id
       WHERE ${where.join(' AND ')}
       ORDER BY ac.created_at DESC`,
      params,
    );

    res.json({ claims: claims.map(mapClaim) });
  } catch (err: any) {
    logger.error({ err }, 'Get my author claims error');
    res.status(500).json({ error: 'Failed to fetch your claims' });
  }
});

router.get('/author-portal/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const authorId = normalizeText(req.query.authorId, 36);
    const author = await getManagedAuthor(req.user!.userId, authorId || undefined);

    if (!author) {
      res.status(403).json({ error: 'Author portal is available only for approved claimed authors' });
      return;
    }

    const stats = await dbGet<any>(
      `SELECT
         COUNT(DISTINCT b.id) AS total_books,
         COALESCE(COUNT(DISTINCT r.id), 0) AS total_reviews,
         COALESCE(ROUND(AVG(r.rating), 2), 0) AS avg_rating,
         COALESCE((
           SELECT COUNT(*)
           FROM page_views pv
           JOIN books b2 ON pv.page_path LIKE CONCAT('/book/', b2.slug, '%')
           WHERE b2.author_id = ?
         ), 0) AS total_views,
         COALESCE((SELECT COUNT(*) FROM author_follows af WHERE af.author_id = ?), 0) AS follower_count
       FROM books b
       LEFT JOIN reviews r ON r.book_id = b.id AND r.is_approved = 1
       WHERE b.author_id = ? AND b.status = 'PUBLISHED' AND b.is_active = 1`,
      [author.id, author.id, author.id],
    );

    const posts = await dbAll<any>(
      `SELECT id, title, content, is_published, created_at
       FROM author_posts
       WHERE author_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [author.id],
    );

    const recentReviews = await dbAll<any>(
      `SELECT r.id, r.book_id, r.user_name, r.rating, r.title, r.content, r.created_at,
              r.author_response, r.author_response_at,
              b.title AS book_title, b.slug AS book_slug
       FROM reviews r
       JOIN books b ON b.id = r.book_id
       WHERE b.author_id = ? AND r.is_approved = 1
       ORDER BY r.created_at DESC
       LIMIT 20`,
      [author.id],
    );

    res.json({
      author: {
        id: author.id,
        name: author.name,
        slug: author.slug,
        bio: author.bio || '',
        imageUrl: author.image_url || null,
        website: author.website || author.website_url || null,
        socialLinks: parseSocialLinks(author.social_links),
      },
      stats: {
        totalBooks: Number(stats?.total_books || 0),
        totalReviews: Number(stats?.total_reviews || 0),
        avgRating: Number(stats?.avg_rating || 0),
        totalViews: Number(stats?.total_views || 0),
        followerCount: Number(stats?.follower_count || 0),
      },
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        isPublished: !!post.is_published,
        createdAt: post.created_at,
      })),
      recentReviews: recentReviews.map((review) => ({
        id: review.id,
        bookId: review.book_id,
        bookTitle: review.book_title,
        bookSlug: review.book_slug,
        userName: review.user_name,
        rating: Number(review.rating),
        title: review.title || '',
        content: review.content || '',
        createdAt: review.created_at,
        authorResponse: review.author_response
          ? {
              content: review.author_response,
              respondedAt: review.author_response_at,
            }
          : null,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get author portal dashboard error');
    res.status(500).json({ error: 'Failed to fetch author dashboard' });
  }
});

router.put('/author-portal/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const authorId = normalizeText(req.body?.authorId, 36);
    const author = await getManagedAuthor(req.user!.userId, authorId || undefined);

    if (!author) {
      res.status(403).json({ error: 'Author portal is available only for approved claimed authors' });
      return;
    }

    const bio = normalizeText(req.body?.bio, 5000);
    const imageUrl = normalizeText(req.body?.imageUrl, 2000);
    const website = normalizeText(req.body?.website, 500);
    const socialLinks = sanitizeSocialLinks(req.body?.socialLinks);

    await dbRun(
      `UPDATE authors
       SET bio = ?,
           image_url = ?,
           website = ?,
           website_url = ?,
           social_links = ?,
           twitter_url = ?,
           instagram_url = ?,
           facebook_url = ?,
           youtube_url = ?,
           tiktok_url = ?,
           goodreads_url = ?,
           amazon_url = ?,
           wikipedia_url = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        bio || null,
        imageUrl || null,
        website || null,
        website || null,
        JSON.stringify(socialLinks),
        socialLinks.twitter || null,
        socialLinks.instagram || null,
        socialLinks.facebook || null,
        socialLinks.youtube || null,
        socialLinks.tiktok || null,
        socialLinks.goodreads || null,
        socialLinks.amazon || null,
        socialLinks.wikipedia || null,
        author.id,
      ],
    );

    const updated = await dbGet<any>('SELECT * FROM authors WHERE id = ? LIMIT 1', [author.id]);

    res.json({
      id: updated.id,
      bio: updated.bio || '',
      imageUrl: updated.image_url || null,
      website: updated.website || updated.website_url || null,
      socialLinks: parseSocialLinks(updated.social_links),
      updatedAt: updated.updated_at,
    });
  } catch (err: any) {
    logger.error({ err }, 'Update author portal profile error');
    res.status(500).json({ error: 'Failed to update author profile' });
  }
});

router.post('/author-portal/posts', authenticate, rateLimit('author-portal-post-create', 20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const authorId = normalizeText(req.body?.authorId, 36);
    const author = await getManagedAuthor(req.user!.userId, authorId || undefined);

    if (!author) {
      res.status(403).json({ error: 'Author portal is available only for approved claimed authors' });
      return;
    }

    const title = normalizeText(req.body?.title, 300);
    const content = normalizeText(req.body?.content, 10000);
    const isPublished = req.body?.isPublished !== false;

    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }
    if (!content) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO author_posts (id, author_id, title, content, is_published)
       VALUES (?, ?, ?, ?, ?)`,
      [id, author.id, title, content, isPublished ? 1 : 0],
    );

    const created = await dbGet<any>('SELECT * FROM author_posts WHERE id = ? LIMIT 1', [id]);
    res.status(201).json({
      id: created.id,
      authorId: created.author_id,
      title: created.title,
      content: created.content,
      isPublished: !!created.is_published,
      createdAt: created.created_at,
    });
  } catch (err: any) {
    logger.error({ err }, 'Create author post error');
    res.status(500).json({ error: 'Failed to create author post' });
  }
});

router.post('/author-portal/reviews/:id/response', authenticate, rateLimit('author-portal-review-response', 40, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const reviewId = normalizeText(req.params.id, 36);
    const responseText = normalizeText(req.body?.response, 5000);

    if (!responseText) {
      res.status(400).json({ error: 'response is required' });
      return;
    }

    const review = await dbGet<any>(
      `SELECT r.id, r.book_id, b.author_id
       FROM reviews r
       JOIN books b ON b.id = r.book_id
       WHERE r.id = ?
       LIMIT 1`,
      [reviewId],
    );

    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    const author = await getManagedAuthor(req.user!.userId, review.author_id);
    if (!author) {
      res.status(403).json({ error: 'You can only respond to reviews for your claimed author profile' });
      return;
    }

    await dbRun(
      `UPDATE reviews
       SET author_response = ?, author_response_at = NOW(), author_response_by = ?, updated_at = NOW()
       WHERE id = ?`,
      [responseText, req.user!.userId, reviewId],
    );

    const updated = await dbGet<any>('SELECT author_response, author_response_at FROM reviews WHERE id = ? LIMIT 1', [reviewId]);
    res.json({
      reviewId,
      response: {
        content: updated?.author_response || responseText,
        respondedAt: updated?.author_response_at || new Date().toISOString(),
      },
      message: 'Author response saved',
    });
  } catch (err: any) {
    logger.error({ err }, 'Respond to review as author error');
    res.status(500).json({ error: 'Failed to save author response' });
  }
});

router.get('/admin/author-claims', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = normalizeText(req.query.status, 50).toLowerCase();
    const where: string[] = [];
    const params: any[] = [];

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.push('ac.status = ?');
      params.push(status);
    }

    const rows = await dbAll<any>(
      `SELECT ac.*, a.name AS author_name, u.name AS claimant_name
       FROM author_claims ac
       JOIN authors a ON a.id = ac.author_id
       JOIN users u ON u.id = ac.user_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY CASE ac.status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 ELSE 3 END, ac.created_at DESC`,
      params,
    );

    res.json({ claims: rows.map(mapClaim) });
  } catch (err: any) {
    logger.error({ err }, 'Admin list author claims error');
    res.status(500).json({ error: 'Failed to fetch author claims' });
  }
});

router.put('/admin/author-claims/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const claimId = normalizeText(req.params.id, 36);
    const status = normalizeText(req.body?.status, 20).toLowerCase();

    if (!CLAIM_STATUSES.has(status)) {
      res.status(400).json({ error: 'status must be approved or rejected' });
      return;
    }

    const claim = await dbGet<any>('SELECT * FROM author_claims WHERE id = ? LIMIT 1', [claimId]);
    if (!claim) {
      res.status(404).json({ error: 'Author claim not found' });
      return;
    }

    if (status === 'approved') {
      const existingOwner = await dbGet<any>('SELECT claimed_by FROM authors WHERE id = ? LIMIT 1', [claim.author_id]);
      if (!existingOwner) {
        res.status(404).json({ error: 'Author not found' });
        return;
      }
      if (existingOwner.claimed_by && existingOwner.claimed_by !== claim.user_id) {
        res.status(409).json({ error: 'Author is already claimed by another user' });
        return;
      }

      await dbRun('UPDATE authors SET claimed_by = ? WHERE id = ?', [claim.user_id, claim.author_id]);
    }

    await dbRun(
      `UPDATE author_claims
       SET status = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [status, req.user!.userId, claimId],
    );

    if (status === 'approved') {
      await dbRun(
        `UPDATE author_claims
         SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW()
         WHERE author_id = ? AND id <> ? AND status = 'pending'`,
        [req.user!.userId, claim.author_id, claimId],
      );
    }

    const updated = await dbGet<any>(
      `SELECT ac.*, a.name AS author_name, u.name AS claimant_name
       FROM author_claims ac
       JOIN authors a ON a.id = ac.author_id
       JOIN users u ON u.id = ac.user_id
       WHERE ac.id = ? LIMIT 1`,
      [claimId],
    );

    res.json(mapClaim(updated));
  } catch (err: any) {
    logger.error({ err }, 'Admin update author claim error');
    res.status(500).json({ error: 'Failed to update author claim' });
  }
});

export default router;
