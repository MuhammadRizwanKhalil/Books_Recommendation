import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';

const router = Router();

function mapCommunityList(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || null,
    name: row.name,
    slug: row.slug,
    description: row.description || null,
    coverImage: row.cover_image || null,
    isPublic: !!row.is_public,
    isCommunity: !!row.is_community,
    isFeatured: !!row.is_featured,
    bookCount: row.book_count || 0,
    voteCount: row.vote_count || 0,
    viewCount: row.view_count || 0,
    categories: row.categories ? String(row.categories).split(',').filter(Boolean) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCommunityItem(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    title: row.title,
    author: row.author,
    slug: row.book_slug,
    coverImage: row.cover_image || null,
    googleRating: row.google_rating,
    ratingsCount: row.ratings_count,
    computedScore: row.computed_score,
    publishedDate: row.published_date,
    categories: row.categories ? String(row.categories).split(',').filter(Boolean) : [],
    price: row.price,
    currency: row.currency,
    amazonUrl: row.amazon_url,
    notes: row.notes || null,
    sortOrder: row.sort_order,
    addedAt: row.added_at,
    voteScore: Number(row.vote_score || 0),
    upvotes: Number(row.upvotes || 0),
    downvotes: Number(row.downvotes || 0),
    userVote: Number(row.user_vote || 0),
  };
}

function resolveSort(sort?: string) {
  switch ((sort || 'popular').toLowerCase()) {
    case 'newest':
      return 'rl.created_at DESC, rl.updated_at DESC';
    case 'featured':
      return 'rl.is_featured DESC, rl.vote_count DESC, rl.view_count DESC, rl.updated_at DESC';
    case 'popular':
    default:
      return 'rl.vote_count DESC, rl.view_count DESC, rl.book_count DESC, rl.updated_at DESC';
  }
}

router.get('/discover', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim().toLowerCase();
    const category = String(req.query.category || '').trim().toLowerCase();
    const orderBy = resolveSort(String(req.query.sort || 'popular'));

    const where: string[] = ['rl.is_public = TRUE', 'rl.is_community = TRUE'];
    const params: any[] = [];

    if (search) {
      where.push('(LOWER(rl.name) LIKE ? OR LOWER(COALESCE(rl.description, "")) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category) {
      where.push(`EXISTS (
        SELECT 1
        FROM reading_list_items rli2
        JOIN book_categories bc2 ON bc2.book_id = rli2.book_id
        JOIN categories c2 ON c2.id = bc2.category_id
        WHERE rli2.list_id = rl.id
          AND (LOWER(c2.slug) = ? OR LOWER(c2.name) = ?)
      )`);
      params.push(category, category);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [lists, countRow] = await Promise.all([
      dbAll<any>(`
        SELECT
          rl.*,
          u.name AS user_name,
          GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',') AS categories
        FROM reading_lists rl
        JOIN users u ON u.id = rl.user_id
        LEFT JOIN reading_list_items rli ON rli.list_id = rl.id
        LEFT JOIN book_categories bc ON bc.book_id = rli.book_id
        LEFT JOIN categories c ON c.id = bc.category_id
        ${whereSql}
        GROUP BY rl.id
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `, [...params, limit, offset]),
      dbGet<any>(`
        SELECT COUNT(*) AS total
        FROM reading_lists rl
        ${whereSql}
      `, params),
    ]);

    res.json({
      lists: lists.map(mapCommunityList),
      pagination: {
        page,
        limit,
        total: countRow?.total || 0,
        totalPages: Math.ceil((countRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Discover community lists error');
    res.status(500).json({ error: 'Failed to fetch community lists' });
  }
});

router.get('/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const viewerId = req.user?.userId || '';

    const list = await dbGet<any>(`
      SELECT
        rl.*,
        u.name AS user_name,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',') AS categories
      FROM reading_lists rl
      JOIN users u ON u.id = rl.user_id
      LEFT JOIN reading_list_items rli ON rli.list_id = rl.id
      LEFT JOIN book_categories bc ON bc.book_id = rli.book_id
      LEFT JOIN categories c ON c.id = bc.category_id
      WHERE rl.id = ?
        AND rl.is_community = TRUE
        AND (rl.is_public = TRUE OR rl.user_id = ?)
      GROUP BY rl.id
    `, [id, viewerId]);

    if (!list) {
      res.status(404).json({ error: 'Community list not found' });
      return;
    }

    await dbRun('UPDATE reading_lists SET view_count = view_count + 1 WHERE id = ?', [id]);

    const items = await dbAll<any>(`
      SELECT
        rli.*,
        b.title,
        b.author,
        b.slug AS book_slug,
        b.cover_image,
        b.google_rating,
        b.ratings_count,
        b.computed_score,
        b.published_date,
        b.price,
        b.currency,
        b.amazon_url,
        GROUP_CONCAT(DISTINCT c.name ORDER BY c.name SEPARATOR ',') AS categories,
        COALESCE(SUM(lbv.vote), 0) AS vote_score,
        COALESCE(SUM(CASE WHEN lbv.vote = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
        COALESCE(SUM(CASE WHEN lbv.vote = -1 THEN 1 ELSE 0 END), 0) AS downvotes,
        COALESCE(MAX(CASE WHEN lbv.user_id = ? THEN lbv.vote ELSE 0 END), 0) AS user_vote
      FROM reading_list_items rli
      JOIN books b ON b.id = rli.book_id
      LEFT JOIN book_categories bc ON bc.book_id = b.id
      LEFT JOIN categories c ON c.id = bc.category_id
      LEFT JOIN list_book_votes lbv ON lbv.list_id = rli.list_id AND lbv.book_id = rli.book_id
      WHERE rli.list_id = ?
      GROUP BY rli.id
      ORDER BY vote_score DESC, rli.sort_order ASC, rli.added_at DESC
    `, [viewerId, id]);

    res.json({
      ...mapCommunityList({ ...list, view_count: Number(list.view_count || 0) + 1 }),
      items: items.map(mapCommunityItem),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get community list detail error');
    res.status(500).json({ error: 'Failed to fetch community list' });
  }
});

router.post('/:id/books/:bookId/vote', authenticate, rateLimit('community-list-vote', 60, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const { id, bookId } = req.params;
    const vote = Number(req.body?.vote);

    if (![1, -1].includes(vote)) {
      res.status(400).json({ error: 'vote must be 1 or -1' });
      return;
    }

    const list = await dbGet<any>(
      'SELECT id, is_community, is_public, user_id FROM reading_lists WHERE id = ?',
      [id],
    );
    if (!list || !list.is_community || (!list.is_public && list.user_id !== req.user!.userId)) {
      res.status(404).json({ error: 'Community list not found' });
      return;
    }

    const item = await dbGet<any>(
      'SELECT id FROM reading_list_items WHERE list_id = ? AND book_id = ?',
      [id, bookId],
    );
    if (!item) {
      res.status(404).json({ error: 'Book is not part of this list' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id, vote FROM list_book_votes WHERE list_id = ? AND book_id = ? AND user_id = ?',
      [id, bookId, req.user!.userId],
    );

    let currentVote = vote;
    if (existing?.vote === vote) {
      await dbRun('DELETE FROM list_book_votes WHERE id = ?', [existing.id]);
      currentVote = 0;
    } else if (existing) {
      await dbRun('UPDATE list_book_votes SET vote = ? WHERE id = ?', [vote, existing.id]);
    } else {
      await dbRun(
        'INSERT INTO list_book_votes (id, list_id, book_id, user_id, vote) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, bookId, req.user!.userId, vote],
      );
    }

    const scoreRow = await dbGet<any>(`
      SELECT
        COALESCE(SUM(vote), 0) AS vote_score,
        COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0) AS upvotes,
        COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0) AS downvotes
      FROM list_book_votes
      WHERE list_id = ? AND book_id = ?
    `, [id, bookId]);

    const listVoteRow = await dbGet<any>(
      'SELECT COALESCE(SUM(vote), 0) AS total_votes FROM list_book_votes WHERE list_id = ?',
      [id],
    );

    await dbRun('UPDATE reading_lists SET vote_count = ? WHERE id = ?', [listVoteRow?.total_votes || 0, id]);

    res.json({
      success: true,
      currentVote,
      voteScore: Number(scoreRow?.vote_score || 0),
      upvotes: Number(scoreRow?.upvotes || 0),
      downvotes: Number(scoreRow?.downvotes || 0),
      listVoteCount: Number(listVoteRow?.total_votes || 0),
      message: currentVote === 0 ? 'Vote removed' : 'Vote recorded',
    });
  } catch (err: any) {
    logger.error({ err }, 'Vote on community list error');
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

export default router;
