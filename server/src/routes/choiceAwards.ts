import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { logger } from '../lib/logger.js';
import { authenticate, optionalAuth, rateLimit, requireAdmin } from '../middleware.js';

const router = Router();

function parseYear(value: string): number | null {
  const year = Number.parseInt(value, 10);
  if (!Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  return year;
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function recalculateCategoryVoteCounts(categoryId: string): Promise<void> {
  await dbRun(
    `UPDATE award_nominees n
     LEFT JOIN (
       SELECT nominee_id, COUNT(*) AS c
       FROM award_votes
       GROUP BY nominee_id
     ) v ON v.nominee_id = n.id
     SET n.vote_count = COALESCE(v.c, 0)
     WHERE n.category_id = ?`,
    [categoryId],
  );
}

router.get('/awards/:year', optionalAuth, async (req: Request, res: Response) => {
  try {
    const year = parseYear(String(req.params.year || ''));
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const award = await dbGet<any>('SELECT * FROM choice_awards WHERE year = ? LIMIT 1', [year]);
    if (!award) {
      res.status(404).json({ error: 'Awards year not found' });
      return;
    }

    const categories = await dbAll<any>(
      `SELECT * FROM award_categories WHERE award_id = ? ORDER BY display_order ASC, name ASC`,
      [award.id],
    );

    const categoryIds = categories.map((c) => c.id);
    const nominees = categoryIds.length > 0
      ? await dbAll<any>(
        `SELECT n.id, n.category_id, n.book_id, n.is_official, n.vote_count, n.is_winner,
                b.title, b.author, b.slug, b.cover_image,
                COALESCE(r.avg_rating, 0) AS average_rating
         FROM award_nominees n
         JOIN books b ON b.id = n.book_id
         LEFT JOIN (
           SELECT book_id, ROUND(AVG(rating), 2) AS avg_rating
           FROM reviews
           GROUP BY book_id
         ) r ON r.book_id = b.id
         WHERE n.category_id IN (${categoryIds.map(() => '?').join(',')})
         ORDER BY n.vote_count DESC, n.id ASC`,
        categoryIds,
      )
      : [];

    let myVotes: Record<string, string> = {};
    if (req.user?.userId && categoryIds.length > 0) {
      const rows = await dbAll<any>(
        `SELECT n.category_id, v.nominee_id
         FROM award_votes v
         JOIN award_nominees n ON n.id = v.nominee_id
         WHERE v.user_id = ?
           AND n.category_id IN (${categoryIds.map(() => '?').join(',')})`,
        [req.user.userId, ...categoryIds],
      );
      myVotes = rows.reduce((acc: Record<string, string>, row: any) => {
        acc[row.category_id] = row.nominee_id;
        return acc;
      }, {});
    }

    const now = todayDateString();
    const isVotingOpen = award.is_active && now >= String(award.voting_start) && now <= String(award.voting_end);

    res.json({
      award: {
        id: award.id,
        year: Number(award.year),
        isActive: !!award.is_active,
        nominationStart: award.nomination_start,
        nominationEnd: award.nomination_end,
        votingStart: award.voting_start,
        votingEnd: award.voting_end,
        resultsPublished: !!award.results_published,
        isVotingOpen,
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        displayOrder: Number(category.display_order || 0),
        myVoteNomineeId: myVotes[category.id] || null,
        nominees: nominees
          .filter((nominee) => nominee.category_id === category.id)
          .map((nominee) => ({
            id: nominee.id,
            bookId: nominee.book_id,
            isOfficial: !!nominee.is_official,
            voteCount: Number(nominee.vote_count || 0),
            isWinner: !!nominee.is_winner,
            book: {
              id: nominee.book_id,
              title: nominee.title,
              author: nominee.author,
              slug: nominee.slug,
              coverImage: nominee.cover_image,
              averageRating: Number(nominee.average_rating || 0),
            },
          })),
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get annual choice awards error');
    res.status(500).json({ error: 'Failed to fetch annual choice awards' });
  }
});

router.post('/awards/:year/categories/:catId/vote', authenticate, rateLimit('choice-awards-vote', 30, 15 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const year = parseYear(String(req.params.year || ''));
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const categoryId = String(req.params.catId || '').trim();
    const nomineeId = String(req.body?.nomineeId || '').trim();
    if (!nomineeId) {
      res.status(400).json({ error: 'nomineeId is required' });
      return;
    }

    const award = await dbGet<any>('SELECT * FROM choice_awards WHERE year = ? LIMIT 1', [year]);
    if (!award) {
      res.status(404).json({ error: 'Awards year not found' });
      return;
    }

    const now = todayDateString();
    const votingOpen = award.is_active && now >= String(award.voting_start) && now <= String(award.voting_end);
    if (!votingOpen) {
      res.status(400).json({ error: 'Voting period is closed' });
      return;
    }

    const category = await dbGet<any>(
      'SELECT id FROM award_categories WHERE id = ? AND award_id = ? LIMIT 1',
      [categoryId, award.id],
    );
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const nominee = await dbGet<any>(
      'SELECT id, category_id FROM award_nominees WHERE id = ? AND category_id = ? LIMIT 1',
      [nomineeId, categoryId],
    );
    if (!nominee) {
      res.status(404).json({ error: 'Nominee not found in category' });
      return;
    }

    const existingInCategory = await dbGet<any>(
      `SELECT v.id
       FROM award_votes v
       JOIN award_nominees n ON n.id = v.nominee_id
       WHERE v.user_id = ? AND n.category_id = ?
       LIMIT 1`,
      [req.user!.userId, categoryId],
    );

    if (existingInCategory) {
      res.status(409).json({ error: 'You have already voted in this category' });
      return;
    }

    await dbRun(
      'INSERT INTO award_votes (id, nominee_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), nomineeId, req.user!.userId],
    );

    await recalculateCategoryVoteCounts(categoryId);

    const updatedNominee = await dbGet<any>(
      'SELECT vote_count FROM award_nominees WHERE id = ? LIMIT 1',
      [nomineeId],
    );

    res.json({
      success: true,
      nomineeId,
      voteCount: Number(updatedNominee?.vote_count || 0),
      message: 'Vote recorded',
    });
  } catch (err: any) {
    logger.error({ err }, 'Vote in annual choice awards error');
    res.status(500).json({ error: 'Failed to submit vote' });
  }
});

router.post('/admin/awards', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const year = parseYear(String(req.body?.year || ''));
    if (year === null) {
      res.status(400).json({ error: 'Invalid year' });
      return;
    }

    const nominationStart = String(req.body?.nominationStart || '').trim();
    const nominationEnd = String(req.body?.nominationEnd || '').trim();
    const votingStart = String(req.body?.votingStart || '').trim();
    const votingEnd = String(req.body?.votingEnd || '').trim();

    if (!nominationStart || !nominationEnd || !votingStart || !votingEnd) {
      res.status(400).json({ error: 'All schedule fields are required' });
      return;
    }

    const existing = await dbGet<any>('SELECT id FROM choice_awards WHERE year = ? LIMIT 1', [year]);
    if (existing) {
      res.status(409).json({ error: 'Award year already exists' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO choice_awards
       (id, year, is_active, nomination_start, nomination_end, voting_start, voting_end, results_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, year, req.body?.isActive ? 1 : 0, nominationStart, nominationEnd, votingStart, votingEnd],
    );

    const created = await dbGet<any>('SELECT * FROM choice_awards WHERE id = ? LIMIT 1', [id]);
    res.status(201).json({
      award: {
        id: created.id,
        year: Number(created.year),
        isActive: !!created.is_active,
        nominationStart: created.nomination_start,
        nominationEnd: created.nomination_end,
        votingStart: created.voting_start,
        votingEnd: created.voting_end,
        resultsPublished: !!created.results_published,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Create award year error');
    res.status(500).json({ error: 'Failed to create award year' });
  }
});

router.post('/admin/awards/:id/categories', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const awardId = String(req.params.id || '').trim();
    const name = String(req.body?.name || '').trim();
    const displayOrder = Number.parseInt(String(req.body?.displayOrder ?? '0'), 10);

    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (name.length > 255) {
      res.status(400).json({ error: 'name must be 255 characters or fewer' });
      return;
    }

    const award = await dbGet<any>('SELECT id FROM choice_awards WHERE id = ? LIMIT 1', [awardId]);
    if (!award) {
      res.status(404).json({ error: 'Award year not found' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      'INSERT INTO award_categories (id, award_id, name, display_order) VALUES (?, ?, ?, ?)',
      [id, awardId, name, Number.isFinite(displayOrder) ? displayOrder : 0],
    );

    const created = await dbGet<any>('SELECT * FROM award_categories WHERE id = ? LIMIT 1', [id]);
    res.status(201).json({
      category: {
        id: created.id,
        awardId: created.award_id,
        name: created.name,
        displayOrder: Number(created.display_order || 0),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Create award category error');
    res.status(500).json({ error: 'Failed to create award category' });
  }
});

router.post('/admin/awards/categories/:catId/nominees', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const categoryId = String(req.params.catId || '').trim();
    const bookId = String(req.body?.bookId || '').trim();

    if (!bookId) {
      res.status(400).json({ error: 'bookId is required' });
      return;
    }

    const category = await dbGet<any>('SELECT id FROM award_categories WHERE id = ? LIMIT 1', [categoryId]);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? LIMIT 1', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id FROM award_nominees WHERE category_id = ? AND book_id = ? LIMIT 1',
      [categoryId, bookId],
    );
    if (existing) {
      res.status(409).json({ error: 'Book is already nominated in this category' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      'INSERT INTO award_nominees (id, category_id, book_id, is_official, vote_count, is_winner) VALUES (?, ?, ?, ?, 0, 0)',
      [id, categoryId, bookId, req.body?.isOfficial ? 1 : 0],
    );

    const nominee = await dbGet<any>(
      `SELECT n.id, n.category_id, n.book_id, n.is_official, n.vote_count, n.is_winner,
              b.title, b.author, b.slug, b.cover_image
       FROM award_nominees n
       JOIN books b ON b.id = n.book_id
       WHERE n.id = ? LIMIT 1`,
      [id],
    );

    res.status(201).json({
      nominee: {
        id: nominee.id,
        categoryId: nominee.category_id,
        bookId: nominee.book_id,
        isOfficial: !!nominee.is_official,
        voteCount: Number(nominee.vote_count || 0),
        isWinner: !!nominee.is_winner,
        book: {
          id: nominee.book_id,
          title: nominee.title,
          author: nominee.author,
          slug: nominee.slug,
          coverImage: nominee.cover_image,
        },
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Create award nominee error');
    res.status(500).json({ error: 'Failed to create nominee' });
  }
});

router.put('/admin/awards/:id/publish-results', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const awardId = String(req.params.id || '').trim();

    const award = await dbGet<any>('SELECT id FROM choice_awards WHERE id = ? LIMIT 1', [awardId]);
    if (!award) {
      res.status(404).json({ error: 'Award not found' });
      return;
    }

    const categories = await dbAll<any>('SELECT id FROM award_categories WHERE award_id = ?', [awardId]);

    for (const category of categories) {
      await recalculateCategoryVoteCounts(category.id);
      await dbRun('UPDATE award_nominees SET is_winner = 0 WHERE category_id = ?', [category.id]);
      const winner = await dbGet<any>(
        'SELECT id FROM award_nominees WHERE category_id = ? ORDER BY vote_count DESC, id ASC LIMIT 1',
        [category.id],
      );
      if (winner) {
        await dbRun('UPDATE award_nominees SET is_winner = 1 WHERE id = ?', [winner.id]);
      }
    }

    await dbRun('UPDATE choice_awards SET results_published = 1, is_active = 0 WHERE id = ?', [awardId]);

    res.json({ success: true, message: 'Results published successfully' });
  } catch (err: any) {
    logger.error({ err }, 'Publish award results error');
    res.status(500).json({ error: 'Failed to publish results' });
  }
});

export default router;
