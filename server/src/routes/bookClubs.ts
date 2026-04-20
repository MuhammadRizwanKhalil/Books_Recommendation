import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

type MemberRole = 'owner' | 'moderator' | 'member';

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function mapClub(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    coverImage: row.cover_image || null,
    ownerId: row.owner_id,
    owner: {
      id: row.owner_id,
      name: row.owner_name,
      avatarUrl: row.owner_avatar || null,
    },
    isPublic: !!row.is_public,
    memberCount: Number(row.member_count || 0),
    isMember: !!row.viewer_role,
    membershipRole: row.viewer_role || null,
    createdAt: row.created_at,
  };
}

function mapPick(row: any) {
  return {
    id: row.id,
    clubId: row.club_id,
    bookId: row.book_id,
    monthLabel: row.month_label,
    startDate: row.start_date,
    endDate: row.end_date,
    discussionId: row.discussion_id || null,
    discussion: row.discussion_id
      ? {
          id: row.discussion_id,
          title: row.discussion_title,
        }
      : null,
    book: {
      id: row.book_id,
      title: row.book_title,
      slug: row.book_slug,
      coverImage: row.book_cover_image || null,
    },
    createdAt: row.created_at,
  };
}

async function getViewerRole(clubId: string, userId: string) {
  const membership = await dbGet<any>(
    'SELECT role FROM book_club_members WHERE club_id = ? AND user_id = ? LIMIT 1',
    [clubId, userId],
  );
  return (membership?.role || null) as MemberRole | null;
}

router.get('/book-clubs', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = (page - 1) * limit;
    const search = normalizeText(req.query.search).toLowerCase();
    const viewerId = req.user?.userId || '';

    const orderBy = String(req.query.sort || 'popular').toLowerCase() === 'newest'
      ? 'bc.created_at DESC'
      : 'bc.member_count DESC, bc.created_at DESC';

    const where = ['bc.is_public = TRUE'];
    const params: any[] = [viewerId];
    if (search) {
      where.push('(LOWER(bc.name) LIKE ? OR LOWER(COALESCE(bc.description, "")) LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [clubs, countRow] = await Promise.all([
      dbAll<any>(
        `SELECT bc.*, u.name AS owner_name, u.avatar_url AS owner_avatar, v.role AS viewer_role
         FROM book_clubs bc
         JOIN users u ON u.id = bc.owner_id
         LEFT JOIN book_club_members v ON v.club_id = bc.id AND v.user_id = ?
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      ),
      dbGet<any>(`SELECT COUNT(*) AS total FROM book_clubs bc ${whereSql}`, params.slice(1)),
    ]);

    res.json({
      clubs: clubs.map(mapClub),
      pagination: {
        page,
        limit,
        total: Number(countRow?.total || 0),
        totalPages: Math.ceil(Number(countRow?.total || 0) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'List book clubs error');
    res.status(500).json({ error: 'Failed to fetch book clubs' });
  }
});

router.post('/book-clubs', authenticate, rateLimit('book-club-create', 10, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const name = normalizeText(req.body?.name);
    const description = normalizeText(req.body?.description);
    const coverImage = normalizeText(req.body?.coverImage);
    const isPublic = req.body?.isPublic !== false;

    if (!name) {
      res.status(400).json({ error: 'Club name is required' });
      return;
    }
    if (name.length > 255) {
      res.status(400).json({ error: 'Club name must be 255 characters or fewer' });
      return;
    }
    if (description.length > 4000) {
      res.status(400).json({ error: 'Description must be 4000 characters or fewer' });
      return;
    }
    if (coverImage.length > 500) {
      res.status(400).json({ error: 'Cover image URL must be 500 characters or fewer' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO book_clubs (id, name, description, cover_image, owner_id, is_public, member_count)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, name, description || null, coverImage || null, req.user!.userId, isPublic ? 1 : 0],
    );

    await dbRun(
      `INSERT INTO book_club_members (id, club_id, user_id, role)
       VALUES (?, ?, ?, 'owner')`,
      [uuidv4(), id, req.user!.userId],
    );

    const created = await dbGet<any>(
      `SELECT bc.*, u.name AS owner_name, u.avatar_url AS owner_avatar, 'owner' AS viewer_role
       FROM book_clubs bc
       JOIN users u ON u.id = bc.owner_id
       WHERE bc.id = ?`,
      [id],
    );

    res.status(201).json(mapClub(created));
  } catch (err: any) {
    logger.error({ err }, 'Create book club error');
    res.status(500).json({ error: 'Failed to create book club' });
  }
});

router.get('/book-clubs/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const viewerId = req.user?.userId || '';

    const club = await dbGet<any>(
      `SELECT bc.*, u.name AS owner_name, u.avatar_url AS owner_avatar, v.role AS viewer_role
       FROM book_clubs bc
       JOIN users u ON u.id = bc.owner_id
       LEFT JOIN book_club_members v ON v.club_id = bc.id AND v.user_id = ?
       WHERE bc.id = ?
       LIMIT 1`,
      [viewerId, req.params.id],
    );

    if (!club) {
      res.status(404).json({ error: 'Book club not found' });
      return;
    }

    if (!club.is_public && !club.viewer_role && club.owner_id !== viewerId) {
      res.status(404).json({ error: 'Book club not found' });
      return;
    }

    const [members, picks] = await Promise.all([
      dbAll<any>(
        `SELECT bcm.user_id, bcm.role, bcm.joined_at, u.name, u.avatar_url
         FROM book_club_members bcm
         JOIN users u ON u.id = bcm.user_id
         WHERE bcm.club_id = ?
         ORDER BY FIELD(bcm.role, 'owner', 'moderator', 'member'), bcm.joined_at ASC
         LIMIT 100`,
        [req.params.id],
      ),
      dbAll<any>(
        `SELECT p.*, b.title AS book_title, b.slug AS book_slug, b.cover_image AS book_cover_image,
                d.title AS discussion_title
         FROM book_club_picks p
         JOIN books b ON b.id = p.book_id
         LEFT JOIN discussions d ON d.id = p.discussion_id
         WHERE p.club_id = ?
         ORDER BY (CURDATE() BETWEEN p.start_date AND p.end_date) DESC, p.start_date DESC, p.created_at DESC`,
        [req.params.id],
      ),
    ]);

    res.json({
      ...mapClub(club),
      currentPick: picks.length > 0 ? mapPick(picks[0]) : null,
      members: members.map((member) => ({
        user: {
          id: member.user_id,
          name: member.name,
          avatarUrl: member.avatar_url || null,
        },
        role: member.role,
        joinedAt: member.joined_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get book club detail error');
    res.status(500).json({ error: 'Failed to fetch book club' });
  }
});

router.post('/book-clubs/:id/join', authenticate, rateLimit('book-club-join', 30, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const club = await dbGet<any>('SELECT * FROM book_clubs WHERE id = ? LIMIT 1', [req.params.id]);
    if (!club) {
      res.status(404).json({ error: 'Book club not found' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id FROM book_club_members WHERE club_id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user!.userId],
    );
    if (existing) {
      res.status(409).json({ error: 'You are already a member of this club' });
      return;
    }

    await dbRun(
      `INSERT INTO book_club_members (id, club_id, user_id, role)
       VALUES (?, ?, ?, 'member')`,
      [uuidv4(), req.params.id, req.user!.userId],
    );

    await dbRun(
      'UPDATE book_clubs SET member_count = member_count + 1 WHERE id = ?',
      [req.params.id],
    );

    const updated = await dbGet<any>('SELECT member_count FROM book_clubs WHERE id = ? LIMIT 1', [req.params.id]);

    res.json({
      joined: true,
      memberCount: Number(updated?.member_count || 0),
      message: 'Joined book club',
    });
  } catch (err: any) {
    logger.error({ err }, 'Join book club error');
    res.status(500).json({ error: 'Failed to join book club' });
  }
});

router.delete('/book-clubs/:id/leave', authenticate, async (req: Request, res: Response) => {
  try {
    const membership = await dbGet<any>(
      'SELECT id, role FROM book_club_members WHERE club_id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user!.userId],
    );

    if (!membership) {
      res.status(404).json({ error: 'You are not a member of this club' });
      return;
    }

    if (membership.role === 'owner') {
      res.status(400).json({ error: 'Club owners cannot leave their own club' });
      return;
    }

    await dbRun('DELETE FROM book_club_members WHERE id = ?', [membership.id]);
    await dbRun('UPDATE book_clubs SET member_count = GREATEST(1, member_count - 1) WHERE id = ?', [req.params.id]);

    const updated = await dbGet<any>('SELECT member_count FROM book_clubs WHERE id = ? LIMIT 1', [req.params.id]);

    res.json({
      left: true,
      memberCount: Number(updated?.member_count || 0),
      message: 'Left book club',
    });
  } catch (err: any) {
    logger.error({ err }, 'Leave book club error');
    res.status(500).json({ error: 'Failed to leave book club' });
  }
});

router.post('/book-clubs/:id/picks', authenticate, rateLimit('book-club-set-pick', 20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const club = await dbGet<any>('SELECT * FROM book_clubs WHERE id = ? LIMIT 1', [req.params.id]);
    if (!club) {
      res.status(404).json({ error: 'Book club not found' });
      return;
    }

    const role = await getViewerRole(req.params.id, req.user!.userId);
    if (!role || (role !== 'owner' && role !== 'moderator')) {
      res.status(403).json({ error: 'Only club owners or moderators can set picks' });
      return;
    }

    const bookId = normalizeText(req.body?.bookId);
    const monthLabel = normalizeText(req.body?.monthLabel);
    const startDate = normalizeText(req.body?.startDate);
    const endDate = normalizeText(req.body?.endDate);

    if (!bookId || !monthLabel || !startDate || !endDate) {
      res.status(400).json({ error: 'bookId, monthLabel, startDate, and endDate are required' });
      return;
    }
    if (monthLabel.length > 50) {
      res.status(400).json({ error: 'monthLabel must be 50 characters or fewer' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      res.status(400).json({ error: 'Invalid startDate or endDate' });
      return;
    }
    if (start > end) {
      res.status(400).json({ error: 'startDate must be before or equal to endDate' });
      return;
    }

    const book = await dbGet<any>('SELECT id, title, slug, cover_image FROM books WHERE id = ? LIMIT 1', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const discussionTitle = `${club.name} — ${monthLabel} buddy read`;
    const discussionContent = `Monthly buddy read for ${monthLabel}. Share your thoughts as you read.`;
    const discussionId = uuidv4();

    await dbRun(
      `INSERT INTO discussions (id, book_id, user_id, title, content, last_activity_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [discussionId, book.id, req.user!.userId, discussionTitle, discussionContent],
    );

    const existingPick = await dbGet<any>(
      'SELECT id FROM book_club_picks WHERE club_id = ? AND month_label = ? LIMIT 1',
      [req.params.id, monthLabel],
    );

    const pickId = existingPick?.id || uuidv4();
    if (existingPick) {
      await dbRun(
        `UPDATE book_club_picks
         SET book_id = ?, start_date = ?, end_date = ?, discussion_id = ?
         WHERE id = ?`,
        [book.id, startDate, endDate, discussionId, existingPick.id],
      );
    } else {
      await dbRun(
        `INSERT INTO book_club_picks (id, club_id, book_id, month_label, start_date, end_date, discussion_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [pickId, req.params.id, book.id, monthLabel, startDate, endDate, discussionId],
      );
    }

    const created = await dbGet<any>(
      `SELECT p.*, b.title AS book_title, b.slug AS book_slug, b.cover_image AS book_cover_image,
              d.title AS discussion_title
       FROM book_club_picks p
       JOIN books b ON b.id = p.book_id
       LEFT JOIN discussions d ON d.id = p.discussion_id
       WHERE p.id = ?
       LIMIT 1`,
      [pickId],
    );

    res.json(mapPick(created));
  } catch (err: any) {
    logger.error({ err }, 'Set book club pick error');
    res.status(500).json({ error: 'Failed to set monthly pick' });
  }
});

router.get('/book-clubs/:id/picks', optionalAuth, async (req: Request, res: Response) => {
  try {
    const viewerId = req.user?.userId || '';
    const club = await dbGet<any>('SELECT id, is_public FROM book_clubs WHERE id = ? LIMIT 1', [req.params.id]);

    if (!club) {
      res.status(404).json({ error: 'Book club not found' });
      return;
    }

    if (!club.is_public) {
      const role = viewerId ? await getViewerRole(req.params.id, viewerId) : null;
      if (!role) {
        res.status(404).json({ error: 'Book club not found' });
        return;
      }
    }

    const picks = await dbAll<any>(
      `SELECT p.*, b.title AS book_title, b.slug AS book_slug, b.cover_image AS book_cover_image,
              d.title AS discussion_title
       FROM book_club_picks p
       JOIN books b ON b.id = p.book_id
       LEFT JOIN discussions d ON d.id = p.discussion_id
       WHERE p.club_id = ?
       ORDER BY p.start_date DESC, p.created_at DESC`,
      [req.params.id],
    );

    res.json({ picks: picks.map(mapPick) });
  } catch (err: any) {
    logger.error({ err }, 'Get club picks error');
    res.status(500).json({ error: 'Failed to fetch club picks' });
  }
});

export default router;
