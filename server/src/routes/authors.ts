import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../lib/logger.js';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, requireAdmin } from '../middleware.js';

const router = Router();

// ── Helper: generate unique slug ────────────────────────────────────────────
async function generateAuthorSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80);

  let slug = base;
  let suffix = 1;
  while (await dbGet<any>('SELECT id FROM authors WHERE slug = ?', [slug])) {
    slug = `${base}-${suffix++}`;
  }
  return slug;
}

// ── Helper: map DB row to response ──────────────────────────────────────────
function mapAuthorToResponse(author: any) {
  const socialLinks = safeJsonParse(author.social_links, {});

  return {
    id: author.id,
    name: author.name,
    slug: author.slug,
    bio: author.bio || null,
    imageUrl: author.image_url || null,
    websiteUrl: author.website_url || author.website || null,
    twitterUrl: author.twitter_url || null,
    instagramUrl: author.instagram_url || null,
    goodreadsUrl: author.goodreads_url || null,
    amazonUrl: author.amazon_url || null,
    wikipediaUrl: author.wikipedia_url || null,
    facebookUrl: author.facebook_url || null,
    youtubeUrl: author.youtube_url || null,
    tiktokUrl: author.tiktok_url || null,
    socialLinks,
    isVerified: !!author.claimed_by,
    claimedBy: author.claimed_by || null,
    bornDate: author.born_date || null,
    diedDate: author.died_date || null,
    nationality: author.nationality || null,
    genres: safeJsonParse(author.genres, []),
    awards: safeJsonParse(author.awards, []),
    totalWorks: author.total_works || 0,
    metaTitle: author.meta_title || null,
    metaDescription: author.meta_description || null,
    createdAt: author.created_at,
    updatedAt: author.updated_at,
  };
}

/** Safely parse a JSON string or return fallback */
function safeJsonParse(val: any, fallback: any): any {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

// ── GET /api/authors ────────────────────────────────────────────────────────
// List all authors with book counts. Supports ?search= for filtering.
router.get('/', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim();
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string || '200', 10)));

    let authors: any[];
    if (search) {
      authors = await dbAll<any>(`
        SELECT a.*, 
          (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1) as book_count,
          (SELECT ROUND(AVG(b.google_rating), 1) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.google_rating IS NOT NULL) as avg_rating
        FROM authors a
        WHERE a.name LIKE ?
        ORDER BY book_count DESC, a.name ASC
        LIMIT ?
      `, [`%${search}%`, limit]);
    } else {
      authors = await dbAll<any>(`
        SELECT a.*, 
          (SELECT COUNT(*) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.is_active = 1) as book_count,
          (SELECT ROUND(AVG(b.google_rating), 1) FROM books b WHERE b.author_id = a.id AND b.status = 'PUBLISHED' AND b.google_rating IS NOT NULL) as avg_rating
        FROM authors a
        ORDER BY book_count DESC, a.name ASC
        LIMIT ?
      `, [limit]);
    }

    res.json(authors.map((a: any) => ({
      ...mapAuthorToResponse(a),
      bookCount: a.book_count || 0,
      avgRating: a.avg_rating || 0,
    })));
  } catch (err: any) {
    logger.error({ err: err }, 'List authors error');
    res.status(500).json({ error: 'Failed to fetch authors' });
  }
});

// ── GET /api/authors/:slug ──────────────────────────────────────────────────
// Public author detail page with their books
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const author = await dbGet<any>('SELECT * FROM authors WHERE slug = ?', [req.params.slug]);
    if (!author) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    // Get author's books with pagination
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const offset = (page - 1) * limit;

    const totalRow = await dbGet<any>(`
      SELECT COUNT(*) as total FROM books
      WHERE author_id = ? AND status = 'PUBLISHED' AND is_active = 1
    `, [author.id]);
    const totalBooks = totalRow.total;

    const books = await dbAll<any>(`
      SELECT * FROM books 
      WHERE author_id = ? AND status = 'PUBLISHED' AND is_active = 1
      ORDER BY computed_score DESC
      LIMIT ? OFFSET ?
    `, [author.id, limit, offset]);

    // Get categories for all these books
    const bookIds = books.map((b: any) => b.id);
    let catMap = new Map<string, string[]>();
    if (bookIds.length > 0) {
      const placeholders = bookIds.map(() => '?').join(',');
      const allCats = await dbAll<any>(`
        SELECT bc.book_id, c.name FROM categories c
        JOIN book_categories bc ON bc.category_id = c.id
        WHERE bc.book_id IN (${placeholders})
      `, bookIds);
      for (const row of allCats) {
        const existing = catMap.get(row.book_id) || [];
        existing.push(row.name);
        catMap.set(row.book_id, existing);
      }
    }

    // Get author specialties (top categories)
    const specialties = await dbAll<any>(`
      SELECT c.name FROM categories c
      JOIN book_categories bc ON bc.category_id = c.id
      JOIN books b ON b.id = bc.book_id
      WHERE b.author_id = ? AND b.status = 'PUBLISHED'
      GROUP BY c.name
      ORDER BY COUNT(*) DESC
      LIMIT 5
    `, [author.id]);

    const avgRating = await dbGet<any>(`
      SELECT ROUND(AVG(google_rating), 1) as avg 
      FROM books WHERE author_id = ? AND status = 'PUBLISHED' AND google_rating IS NOT NULL
    `, [author.id]);

    const authorPosts = await dbAll<any>(
      `SELECT id, title, content, created_at
       FROM author_posts
       WHERE author_id = ? AND is_published = TRUE
       ORDER BY created_at DESC
       LIMIT 10`,
      [author.id],
    );

    res.json({
      ...mapAuthorToResponse(author),
      bookCount: totalBooks,
      avgRating: avgRating?.avg || 0,
      specialties: specialties.map((s: any) => s.name),
      books: books.map((book: any) => ({
        id: book.id,
        slug: book.slug,
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        coverImage: book.cover_image,
        googleRating: book.google_rating,
        ratingsCount: book.ratings_count,
        computedScore: book.computed_score,
        publishedDate: book.published_date,
        categories: catMap.get(book.id) || [],
        price: book.price,
        currency: book.currency,
        amazonUrl: book.amazon_url,
      })),
      posts: authorPosts.map((post: any) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        createdAt: post.created_at,
      })),
      pagination: { page, limit, total: totalBooks, totalPages: Math.ceil(totalBooks / limit) },
    });
  } catch (err: any) {
    logger.error({ err: err }, 'Get author error');
    res.status(500).json({ error: 'Failed to fetch author' });
  }
});

// ── POST /api/authors (Admin) ───────────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      name, bio, imageUrl, websiteUrl,
      twitterUrl, instagramUrl, goodreadsUrl, amazonUrl,
      wikipediaUrl, facebookUrl, youtubeUrl, tiktokUrl,
      bornDate, diedDate, nationality, genres, awards,
      totalWorks, metaTitle, metaDescription,
    } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Author name is required' });
      return;
    }

    // Check for duplicate name
    const existing = await dbGet<any>('SELECT id FROM authors WHERE name = ?', [name.trim()]);
    if (existing) {
      res.status(409).json({ error: 'An author with this name already exists', existingId: existing.id });
      return;
    }

    const id = uuidv4();
    const slug = await generateAuthorSlug(name.trim());

    await dbRun(`
      INSERT INTO authors (
        id, name, slug, bio, image_url, website_url,
        twitter_url, instagram_url, goodreads_url, amazon_url,
        wikipedia_url, facebook_url, youtube_url, tiktok_url,
        born_date, died_date, nationality, genres, awards,
        total_works, meta_title, meta_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, name.trim(), slug, bio || null, imageUrl || null, websiteUrl || null,
      twitterUrl || null, instagramUrl || null, goodreadsUrl || null, amazonUrl || null,
      wikipediaUrl || null, facebookUrl || null, youtubeUrl || null, tiktokUrl || null,
      bornDate || null, diedDate || null, nationality || null,
      genres ? JSON.stringify(genres) : null,
      awards ? JSON.stringify(awards) : null,
      totalWorks || 0, metaTitle || null, metaDescription || null,
    ]);

    const author = await dbGet<any>('SELECT * FROM authors WHERE id = ?', [id]);
    res.status(201).json(mapAuthorToResponse(author));
  } catch (err: any) {
    logger.error({ err: err }, 'Create author error');
    res.status(500).json({ error: 'Failed to create author' });
  }
});

// ── PUT /api/authors/:id (Admin) ────────────────────────────────────────────
router.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet<any>('SELECT * FROM authors WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }

    const {
      name, bio, imageUrl, websiteUrl,
      twitterUrl, instagramUrl, goodreadsUrl, amazonUrl,
      wikipediaUrl, facebookUrl, youtubeUrl, tiktokUrl,
      bornDate, diedDate, nationality, genres, awards,
      totalWorks, metaTitle, metaDescription,
    } = req.body;

    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({ error: 'Author name cannot be empty' });
      return;
    }

    // If name changed, regenerate slug
    let newSlug = existing.slug;
    if (name && name.trim() !== existing.name) {
      newSlug = await generateAuthorSlug(name.trim());
      // Also update the author text field on linked books
      await dbRun('UPDATE books SET author = ? WHERE author_id = ?', [name.trim(), id]);
    }

    await dbRun(`
      UPDATE authors SET
        name = COALESCE(?, name),
        slug = ?,
        bio = COALESCE(?, bio),
        image_url = COALESCE(?, image_url),
        website_url = COALESCE(?, website_url),
        twitter_url = COALESCE(?, twitter_url),
        instagram_url = COALESCE(?, instagram_url),
        goodreads_url = COALESCE(?, goodreads_url),
        amazon_url = COALESCE(?, amazon_url),
        wikipedia_url = COALESCE(?, wikipedia_url),
        facebook_url = COALESCE(?, facebook_url),
        youtube_url = COALESCE(?, youtube_url),
        tiktok_url = COALESCE(?, tiktok_url),
        born_date = COALESCE(?, born_date),
        died_date = COALESCE(?, died_date),
        nationality = COALESCE(?, nationality),
        genres = COALESCE(?, genres),
        awards = COALESCE(?, awards),
        total_works = COALESCE(?, total_works),
        meta_title = COALESCE(?, meta_title),
        meta_description = COALESCE(?, meta_description),
        updated_at = NOW()
      WHERE id = ?
    `, [
      name?.trim() ?? null, newSlug, bio ?? null, imageUrl ?? null, websiteUrl ?? null,
      twitterUrl ?? null, instagramUrl ?? null, goodreadsUrl ?? null, amazonUrl ?? null,
      wikipediaUrl ?? null, facebookUrl ?? null, youtubeUrl ?? null, tiktokUrl ?? null,
      bornDate ?? null, diedDate ?? null, nationality ?? null,
      genres !== undefined ? JSON.stringify(genres) : null,
      awards !== undefined ? JSON.stringify(awards) : null,
      totalWorks ?? null, metaTitle ?? null, metaDescription ?? null,
      id,
    ]);

    const author = await dbGet<any>('SELECT * FROM authors WHERE id = ?', [id]);
    res.json(mapAuthorToResponse(author));
  } catch (err: any) {
    logger.error({ err: err }, 'Update author error');
    res.status(500).json({ error: 'Failed to update author' });
  }
});

// ── DELETE /api/authors/:id (Admin) ─────────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    // Unlink books first (set author_id to NULL but keep author text)
    await dbRun('UPDATE books SET author_id = NULL WHERE author_id = ?', [req.params.id]);

    const result = await dbRun('DELETE FROM authors WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      res.status(404).json({ error: 'Author not found' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    logger.error({ err: err }, 'Delete author error');
    res.status(500).json({ error: 'Failed to delete author' });
  }
});

// ── POST /api/authors/find-or-create (Admin) ────────────────────────────────
// Used by book editor and import scripts to get or create an author by name
router.post('/find-or-create', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'Author name is required' });
      return;
    }

    const trimmedName = name.trim();

    // Try to find existing author
    let author = await dbGet<any>('SELECT * FROM authors WHERE name = ?', [trimmedName]);
    if (author) {
      res.json(mapAuthorToResponse(author));
      return;
    }

    // Create new author
    const id = uuidv4();
    const slug = await generateAuthorSlug(trimmedName);
    await dbRun('INSERT INTO authors (id, name, slug) VALUES (?, ?, ?)', [id, trimmedName, slug]);

    author = await dbGet<any>('SELECT * FROM authors WHERE id = ?', [id]);
    res.status(201).json(mapAuthorToResponse(author));
  } catch (err: any) {
    logger.error({ err: err }, 'Find-or-create author error');
    res.status(500).json({ error: 'Failed to find or create author' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHOR FOLLOWS
// ═══════════════════════════════════════════════════════════════════════════════

// ── POST /api/authors/:id/follow — Follow an author ─────────────────────────
router.post('/:id/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const author = await dbGet<any>('SELECT id FROM authors WHERE id = ?', [req.params.id]);
    if (!author) { res.status(404).json({ error: 'Author not found' }); return; }

    await dbRun(
      'INSERT IGNORE INTO author_follows (user_id, author_id) VALUES (?, ?)',
      [req.user!.userId, req.params.id]
    );

    const count = await dbGet<any>('SELECT COUNT(*) as c FROM author_follows WHERE author_id = ?', [req.params.id]);
    res.json({ following: true, followerCount: count?.c || 0 });
  } catch (err: any) {
    logger.error({ err }, 'Follow author error');
    res.status(500).json({ error: 'Failed to follow author' });
  }
});

// ── DELETE /api/authors/:id/follow — Unfollow an author ─────────────────────
router.delete('/:id/follow', authenticate, async (req: Request, res: Response) => {
  try {
    await dbRun(
      'DELETE FROM author_follows WHERE user_id = ? AND author_id = ?',
      [req.user!.userId, req.params.id]
    );

    const count = await dbGet<any>('SELECT COUNT(*) as c FROM author_follows WHERE author_id = ?', [req.params.id]);
    res.json({ following: false, followerCount: count?.c || 0 });
  } catch (err: any) {
    logger.error({ err }, 'Unfollow author error');
    res.status(500).json({ error: 'Failed to unfollow author' });
  }
});

// ── GET /api/authors/:id/follow — Check follow status ───────────────────────
router.get('/:id/follow', authenticate, async (req: Request, res: Response) => {
  try {
    const row = await dbGet<any>(
      'SELECT 1 FROM author_follows WHERE user_id = ? AND author_id = ?',
      [req.user!.userId, req.params.id]
    );
    const count = await dbGet<any>('SELECT COUNT(*) as c FROM author_follows WHERE author_id = ?', [req.params.id]);
    res.json({ following: !!row, followerCount: count?.c || 0 });
  } catch (err: any) {
    logger.error({ err }, 'Check follow error');
    res.status(500).json({ error: 'Failed to check follow status' });
  }
});

// ── GET /api/authors/following — Get user's followed authors ────────────────
router.get('/following/list', authenticate, async (req: Request, res: Response) => {
  try {
    const authors = await dbAll<any>(`
      SELECT a.* FROM authors a
      JOIN author_follows af ON af.author_id = a.id
      WHERE af.user_id = ?
      ORDER BY af.created_at DESC
    `, [req.user!.userId]);

    res.json({ authors: authors.map(mapAuthorToResponse) });
  } catch (err: any) {
    logger.error({ err }, 'Get followed authors error');
    res.status(500).json({ error: 'Failed to fetch followed authors' });
  }
});

export default router;
