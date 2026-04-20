import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

const GIVEAWAY_FORMATS = new Set(['ebook', 'paperback', 'hardcover', 'audiobook']);
const SORT_VALUES = new Set(['ending_soon', 'newest', 'popular']);

function normalizeText(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseCountries(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const valid = value
    .map((item) => String(item || '').trim().toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item));
  if (valid.length === 0) return null;
  return Array.from(new Set(valid)).join(',');
}

function parseCountryRestriction(value: unknown): string[] {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter((item) => /^[A-Z]{2}$/.test(item));
}

function toGiveawayStatus(startDate: string, endDate: string): 'draft' | 'active' | 'ended' {
  const now = Date.now();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'draft';
  if (now > end) return 'ended';
  if (now >= start) return 'active';
  return 'draft';
}

function mapGiveaway(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    createdBy: row.created_by,
    title: row.title,
    description: row.description || null,
    format: row.format,
    copiesAvailable: Number(row.copies_available || 0),
    entryCount: Number(row.entry_count || 0),
    countryRestriction: parseCountryRestriction(row.country_restriction),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    autoAddToTbr: !!row.auto_add_to_tbr,
    createdAt: row.created_at,
    book: row.book_id
      ? {
          id: row.book_id,
          title: row.book_title,
          slug: row.book_slug,
          author: row.book_author,
          coverImage: row.book_cover_image || null,
        }
      : null,
  };
}

async function updateGiveawayStatusFromDates(giveawayId: string) {
  await dbRun(
    `UPDATE giveaways
     SET status = CASE
       WHEN status = 'winners_selected' THEN status
       WHEN NOW() > end_date THEN 'ended'
       WHEN NOW() >= start_date THEN 'active'
       ELSE 'draft'
     END
     WHERE id = ?`,
    [giveawayId],
  );
}

router.get('/giveaways', optionalAuth, async (req: Request, res: Response) => {
  try {
    const sort = normalizeText(req.query.sort, 30).toLowerCase();
    const selectedSort = SORT_VALUES.has(sort) ? sort : 'ending_soon';

    const orderBy = selectedSort === 'newest'
      ? 'g.created_at DESC'
      : selectedSort === 'popular'
        ? 'g.entry_count DESC, g.end_date ASC'
        : 'g.end_date ASC, g.created_at DESC';

    const rows = await dbAll<any>(
      `SELECT g.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM giveaways g
       JOIN books b ON b.id = g.book_id
       WHERE g.status = 'active' AND NOW() BETWEEN g.start_date AND g.end_date
       ORDER BY ${orderBy}
       LIMIT 100`,
      [],
    );

    res.json({ giveaways: rows.map(mapGiveaway) });
  } catch (err: any) {
    logger.error({ err }, 'List giveaways error');
    res.status(500).json({ error: 'Failed to fetch giveaways' });
  }
});

router.get('/giveaways/my-entries', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll<any>(
      `SELECT ge.id AS entry_id, ge.is_winner, ge.entered_at,
              g.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM giveaway_entries ge
       JOIN giveaways g ON g.id = ge.giveaway_id
       JOIN books b ON b.id = g.book_id
       WHERE ge.user_id = ?
       ORDER BY ge.entered_at DESC`,
      [req.user!.userId],
    );

    res.json({
      entries: rows.map((row) => ({
        id: row.entry_id,
        isWinner: !!row.is_winner,
        enteredAt: row.entered_at,
        giveaway: mapGiveaway(row),
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get my giveaway entries error');
    res.status(500).json({ error: 'Failed to fetch giveaway entries' });
  }
});

router.get('/giveaways/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const giveawayId = normalizeText(req.params.id, 36);
    await updateGiveawayStatusFromDates(giveawayId);

    const giveaway = await dbGet<any>(
      `SELECT g.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM giveaways g
       JOIN books b ON b.id = g.book_id
       WHERE g.id = ?
       LIMIT 1`,
      [giveawayId],
    );

    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway not found' });
      return;
    }

    let entry: any = null;
    if (req.user?.userId) {
      entry = await dbGet<any>(
        'SELECT id, is_winner, entered_at FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ? LIMIT 1',
        [giveawayId, req.user.userId],
      );
    }

    res.json({
      giveaway: mapGiveaway(giveaway),
      entry: entry
        ? {
            id: entry.id,
            isWinner: !!entry.is_winner,
            enteredAt: entry.entered_at,
          }
        : null,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get giveaway detail error');
    res.status(500).json({ error: 'Failed to fetch giveaway' });
  }
});

router.post('/giveaways/:id/enter', authenticate, rateLimit('giveaway-enter', 50, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const giveawayId = normalizeText(req.params.id, 36);
    await updateGiveawayStatusFromDates(giveawayId);

    const giveaway = await dbGet<any>('SELECT * FROM giveaways WHERE id = ? LIMIT 1', [giveawayId]);
    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway not found' });
      return;
    }

    if (giveaway.status !== 'active' || new Date(giveaway.end_date).getTime() < Date.now()) {
      res.status(400).json({ error: 'Giveaway ended' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ? LIMIT 1',
      [giveawayId, req.user!.userId],
    );
    if (existing) {
      res.status(409).json({ error: 'You already entered this giveaway' });
      return;
    }

    await dbRun(
      'INSERT INTO giveaway_entries (id, giveaway_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), giveawayId, req.user!.userId],
    );

    await dbRun('UPDATE giveaways SET entry_count = entry_count + 1 WHERE id = ?', [giveawayId]);

    if (giveaway.auto_add_to_tbr) {
      const existingProgress = await dbGet<any>(
        'SELECT id FROM reading_progress WHERE user_id = ? AND book_id = ? LIMIT 1',
        [req.user!.userId, giveaway.book_id],
      );

      if (!existingProgress) {
        await dbRun(
          `INSERT INTO reading_progress (id, user_id, book_id, status, current_page, total_pages, started_at, finished_at)
           VALUES (?, ?, ?, 'want-to-read', 0, 0, NULL, NULL)`,
          [uuidv4(), req.user!.userId, giveaway.book_id],
        );
      }
    }

    res.json({ success: true, message: 'Giveaway entry submitted' });
  } catch (err: any) {
    logger.error({ err }, 'Enter giveaway error');
    res.status(500).json({ error: 'Failed to enter giveaway' });
  }
});

router.post('/giveaways', authenticate, rateLimit('giveaway-create', 20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const title = normalizeText(req.body?.title, 300);
    const description = normalizeText(req.body?.description, 5000);
    const bookId = normalizeText(req.body?.bookId, 36);
    const format = normalizeText(req.body?.format, 30).toLowerCase();
    const copiesAvailable = Number.parseInt(String(req.body?.copiesAvailable || 0), 10);
    const startDate = normalizeText(req.body?.startDate, 40);
    const endDate = normalizeText(req.body?.endDate, 40);
    const autoAddToTbr = req.body?.autoAddToTbr !== false;
    const countryRestriction = parseCountries(req.body?.countryRestriction);

    if (!bookId || !title || !startDate || !endDate) {
      res.status(400).json({ error: 'bookId, title, startDate, and endDate are required' });
      return;
    }
    if (!GIVEAWAY_FORMATS.has(format)) {
      res.status(400).json({ error: 'format must be ebook, paperback, hardcover, or audiobook' });
      return;
    }
    if (!Number.isFinite(copiesAvailable) || copiesAvailable < 1 || copiesAvailable > 10000) {
      res.status(400).json({ error: 'copiesAvailable must be between 1 and 10000' });
      return;
    }

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime >= endTime) {
      res.status(400).json({ error: 'startDate must be before endDate' });
      return;
    }

    const book = await dbGet<any>('SELECT id, author_id FROM books WHERE id = ? LIMIT 1', [bookId]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    if (req.user!.role !== 'admin') {
      const managedAuthor = await dbGet<any>(
        'SELECT id FROM authors WHERE id = ? AND claimed_by = ? LIMIT 1',
        [book.author_id, req.user!.userId],
      );
      if (!managedAuthor) {
        res.status(403).json({ error: 'Only admins or claimed authors of this book can create giveaways' });
        return;
      }
    }

    const id = uuidv4();
    const status = toGiveawayStatus(startDate, endDate);

    await dbRun(
      `INSERT INTO giveaways
       (id, book_id, created_by, title, description, format, copies_available, entry_count, country_restriction, start_date, end_date, status, auto_add_to_tbr)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        id,
        bookId,
        req.user!.userId,
        title,
        description || null,
        format,
        copiesAvailable,
        countryRestriction,
        startDate,
        endDate,
        status,
        autoAddToTbr ? 1 : 0,
      ],
    );

    const created = await dbGet<any>(
      `SELECT g.*, b.title AS book_title, b.slug AS book_slug, b.author AS book_author, b.cover_image AS book_cover_image
       FROM giveaways g
       JOIN books b ON b.id = g.book_id
       WHERE g.id = ?
       LIMIT 1`,
      [id],
    );

    res.status(201).json({ giveaway: mapGiveaway(created) });
  } catch (err: any) {
    logger.error({ err }, 'Create giveaway error');
    res.status(500).json({ error: 'Failed to create giveaway' });
  }
});

router.post('/giveaways/:id/select-winners', authenticate, async (req: Request, res: Response) => {
  try {
    const giveawayId = normalizeText(req.params.id, 36);
    await updateGiveawayStatusFromDates(giveawayId);

    const giveaway = await dbGet<any>('SELECT * FROM giveaways WHERE id = ? LIMIT 1', [giveawayId]);
    if (!giveaway) {
      res.status(404).json({ error: 'Giveaway not found' });
      return;
    }

    const isCreator = giveaway.created_by === req.user!.userId;
    if (!isCreator && req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Only giveaway creator or admin can select winners' });
      return;
    }

    if (giveaway.status === 'winners_selected') {
      res.status(409).json({ error: 'Winners already selected' });
      return;
    }

    if (new Date(giveaway.end_date).getTime() > Date.now()) {
      res.status(400).json({ error: 'Cannot select winners before giveaway ends' });
      return;
    }

    const entries = await dbAll<any>(
      'SELECT id, user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY RAND() LIMIT ?',
      [giveawayId, Number(giveaway.copies_available || 0)],
    );

    if (entries.length === 0) {
      res.status(400).json({ error: 'No giveaway entries found' });
      return;
    }

    await dbRun('UPDATE giveaway_entries SET is_winner = FALSE WHERE giveaway_id = ?', [giveawayId]);

    for (const entry of entries) {
      await dbRun('UPDATE giveaway_entries SET is_winner = TRUE WHERE id = ?', [entry.id]);
    }

    await dbRun("UPDATE giveaways SET status = 'winners_selected' WHERE id = ?", [giveawayId]);

    res.json({
      success: true,
      winnerCount: entries.length,
      winners: entries.map((entry) => ({ id: entry.id, userId: entry.user_id })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Select giveaway winners error');
    res.status(500).json({ error: 'Failed to select winners' });
  }
});

export default router;
