import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbAll, dbRun } from '../database.js';
import { authenticate, optionalAuth, requireAdmin, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ── GET /api/content-warnings — Full taxonomy list ──────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const warnings = await dbAll<any>(
      'SELECT id, name, slug, category, description, display_order FROM content_warning_taxonomy ORDER BY display_order ASC',
      []
    );
    res.json(warnings.map((w: any) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      category: w.category,
      description: w.description,
      displayOrder: w.display_order,
    })));
  } catch (err: any) {
    logger.error({ err }, 'List content warnings error');
    res.status(500).json({ error: 'Failed to fetch content warnings' });
  }
});

// ── GET /api/content-warnings/admin/pending — Unapproved warnings ───────────
router.get('/admin/pending', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const pending = await dbAll<any>(
      `SELECT bcw.id, bcw.book_id, bcw.severity, bcw.details, bcw.created_at,
              cwt.name AS warning_name, cwt.slug AS warning_slug, cwt.category,
              b.title AS book_title,
              u.name AS user_name, u.email AS user_email
       FROM book_content_warnings bcw
       JOIN content_warning_taxonomy cwt ON cwt.id = bcw.warning_id
       JOIN books b ON b.id = bcw.book_id
       JOIN users u ON u.id = bcw.user_id
       WHERE bcw.is_approved = FALSE
       ORDER BY bcw.created_at DESC`,
      []
    );
    res.json(pending.map((p: any) => ({
      id: p.id,
      bookId: p.book_id,
      bookTitle: p.book_title,
      warningName: p.warning_name,
      warningSlug: p.warning_slug,
      category: p.category,
      severity: p.severity,
      details: p.details,
      userName: p.user_name,
      userEmail: p.user_email,
      createdAt: p.created_at,
    })));
  } catch (err: any) {
    logger.error({ err }, 'Get pending content warnings error');
    res.status(500).json({ error: 'Failed to fetch pending content warnings' });
  }
});

// ── PUT /api/content-warnings/admin/:id/approve — Approve a warning ─────────
router.put('/admin/:id/approve', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet<any>(
      'SELECT id, is_approved FROM book_content_warnings WHERE id = ?',
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Content warning not found' });
      return;
    }
    await dbRun('UPDATE book_content_warnings SET is_approved = TRUE WHERE id = ?', [id]);
    res.json({ message: 'Content warning approved' });
  } catch (err: any) {
    logger.error({ err }, 'Approve content warning error');
    res.status(500).json({ error: 'Failed to approve content warning' });
  }
});

// ── PUT /api/content-warnings/admin/:id/reject — Reject (delete) a warning ──
router.put('/admin/:id/reject', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet<any>(
      'SELECT id FROM book_content_warnings WHERE id = ?',
      [id]
    );
    if (!existing) {
      res.status(404).json({ error: 'Content warning not found' });
      return;
    }
    await dbRun('DELETE FROM book_content_warnings WHERE id = ?', [id]);
    res.json({ message: 'Content warning rejected' });
  } catch (err: any) {
    logger.error({ err }, 'Reject content warning error');
    res.status(500).json({ error: 'Failed to reject content warning' });
  }
});

// ── GET /api/content-warnings/books/:bookId — Aggregated warnings for a book ─
router.get('/books/:bookId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { bookId } = req.params;
    const userId = req.user?.userId || null;

    // Only show approved warnings (or the user's own pending ones)
    const rows = await dbAll<any>(
      `SELECT bcw.id, bcw.warning_id, bcw.severity, bcw.details, bcw.is_approved,
              cwt.name, cwt.slug, cwt.category,
              (SELECT COUNT(*) FROM content_warning_votes v WHERE v.book_content_warning_id = bcw.id AND v.vote = 'agree') AS agree_count,
              (SELECT COUNT(*) FROM content_warning_votes v WHERE v.book_content_warning_id = bcw.id AND v.vote = 'disagree') AS disagree_count
       FROM book_content_warnings bcw
       JOIN content_warning_taxonomy cwt ON cwt.id = bcw.warning_id
       WHERE bcw.book_id = ?
         AND (bcw.is_approved = TRUE ${userId ? 'OR bcw.user_id = ?' : ''})
       ORDER BY agree_count DESC, bcw.created_at ASC`,
      userId ? [bookId, userId] : [bookId]
    );

    // Aggregate: group by warning_id, pick consensus severity, sum votes
    const warningMap = new Map<string, {
      id: string;
      name: string;
      slug: string;
      category: string;
      severity: string;
      reportCount: number;
      agreeCount: number;
      disagreeCount: number;
      details: string | null;
      submissions: string[]; // individual bcw IDs for voting
    }>();

    for (const row of rows) {
      const key = row.warning_id;
      if (warningMap.has(key)) {
        const existing = warningMap.get(key)!;
        existing.reportCount++;
        existing.agreeCount += Number(row.agree_count);
        existing.disagreeCount += Number(row.disagree_count);
        existing.submissions.push(row.id);
        // Severity escalation: take the highest
        const severityRank: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
        if (severityRank[row.severity] > severityRank[existing.severity]) {
          existing.severity = row.severity;
        }
      } else {
        warningMap.set(key, {
          id: row.id,
          name: row.name,
          slug: row.slug,
          category: row.category,
          severity: row.severity,
          reportCount: 1,
          agreeCount: Number(row.agree_count),
          disagreeCount: Number(row.disagree_count),
          details: row.details,
          submissions: [row.id],
        });
      }
    }

    const warnings = [...warningMap.values()]
      .sort((a, b) => b.reportCount - a.reportCount)
      .map(w => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        category: w.category,
        severity: w.severity,
        reportCount: w.reportCount,
        agreeCount: w.agreeCount,
        disagreeCount: w.disagreeCount,
        confidence: w.agreeCount + w.disagreeCount > 0
          ? Math.round((w.agreeCount / (w.agreeCount + w.disagreeCount)) * 100)
          : 0,
        submissions: w.submissions,
      }));

    // Get user's own votes if authenticated
    let userVotes: Record<string, string> = {};
    if (userId) {
      const votes = await dbAll<any>(
        `SELECT v.book_content_warning_id, v.vote
         FROM content_warning_votes v
         JOIN book_content_warnings bcw ON bcw.id = v.book_content_warning_id
         WHERE bcw.book_id = ? AND v.user_id = ?`,
        [bookId, userId]
      );
      for (const v of votes) {
        userVotes[v.book_content_warning_id] = v.vote;
      }
    }

    res.json({
      totalWarnings: warnings.length,
      warnings,
      userVotes,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get book content warnings error');
    res.status(500).json({ error: 'Failed to fetch book content warnings' });
  }
});

// ── POST /api/content-warnings/books/:bookId — Submit a warning ─────────────
router.post(
  '/books/:bookId',
  authenticate,
  rateLimit('content-warning-submit', 20, 60 * 60 * 1000), // 20 per hour
  async (req: Request, res: Response) => {
    try {
      const { bookId } = req.params;
      const userId = req.user!.userId;
      const { warningId, severity, details } = req.body;

      // Validate inputs
      if (!warningId || typeof warningId !== 'string') {
        res.status(400).json({ error: 'warningId is required' });
        return;
      }
      const validSeverities = ['mild', 'moderate', 'severe'];
      if (!severity || !validSeverities.includes(severity)) {
        res.status(400).json({ error: 'severity must be mild, moderate, or severe' });
        return;
      }

      // Validate book exists
      const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      // Validate warning exists
      const warning = await dbGet<any>('SELECT id FROM content_warning_taxonomy WHERE id = ?', [warningId]);
      if (!warning) {
        res.status(400).json({ error: 'Invalid warning ID' });
        return;
      }

      // Check for duplicate
      const duplicate = await dbGet<any>(
        'SELECT id FROM book_content_warnings WHERE book_id = ? AND warning_id = ? AND user_id = ?',
        [bookId, warningId, userId]
      );
      if (duplicate) {
        res.status(409).json({ error: 'You have already submitted this warning for this book' });
        return;
      }

      // Truncate details to 500 chars
      const safeDetails = details ? String(details).slice(0, 500) : null;

      const id = uuidv4();
      await dbRun(
        `INSERT INTO book_content_warnings (id, book_id, warning_id, user_id, severity, details, is_approved)
         VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
        [id, bookId, warningId, userId, severity, safeDetails]
      );

      res.status(201).json({
        id,
        message: 'Content warning submitted for moderation',
      });
    } catch (err: any) {
      logger.error({ err }, 'Submit content warning error');
      res.status(500).json({ error: 'Failed to submit content warning' });
    }
  }
);

// ── POST /api/content-warnings/:id/vote — Vote agree/disagree ───────────────
router.post(
  '/:id/vote',
  authenticate,
  rateLimit('content-warning-vote', 60, 60 * 60 * 1000), // 60 per hour
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.userId;
      const { vote } = req.body;

      if (!vote || !['agree', 'disagree'].includes(vote)) {
        res.status(400).json({ error: 'vote must be "agree" or "disagree"' });
        return;
      }

      // Verify the book_content_warning exists
      const bcw = await dbGet<any>('SELECT id FROM book_content_warnings WHERE id = ?', [id]);
      if (!bcw) {
        res.status(404).json({ error: 'Content warning not found' });
        return;
      }

      // Upsert vote (change existing or create new)
      const existingVote = await dbGet<any>(
        'SELECT id, vote FROM content_warning_votes WHERE book_content_warning_id = ? AND user_id = ?',
        [id, userId]
      );

      if (existingVote) {
        if (existingVote.vote === vote) {
          // Already voted same way — remove the vote (toggle off)
          await dbRun('DELETE FROM content_warning_votes WHERE id = ?', [existingVote.id]);
          res.json({ message: 'Vote removed' });
          return;
        }
        // Change vote
        await dbRun('UPDATE content_warning_votes SET vote = ? WHERE id = ?', [vote, existingVote.id]);
      } else {
        await dbRun(
          'INSERT INTO content_warning_votes (id, book_content_warning_id, user_id, vote) VALUES (?, ?, ?, ?)',
          [uuidv4(), id, userId, vote]
        );
      }

      // Return updated counts
      const counts = await dbGet<any>(
        `SELECT
           SUM(vote = 'agree') AS agree_count,
           SUM(vote = 'disagree') AS disagree_count
         FROM content_warning_votes
         WHERE book_content_warning_id = ?`,
        [id]
      );

      res.json({
        message: existingVote ? 'Vote updated' : 'Vote recorded',
        agreeCount: Number(counts?.agree_count || 0),
        disagreeCount: Number(counts?.disagree_count || 0),
      });
    } catch (err: any) {
      logger.error({ err }, 'Vote on content warning error');
      res.status(500).json({ error: 'Failed to submit vote' });
    }
  }
);

export default router;
