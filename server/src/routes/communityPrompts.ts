import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

function mapPrompt(row: any) {
  return {
    id: row.id,
    bookId: row.book_id,
    promptText: row.prompt_text,
    responseCount: Number(row.response_count || 0),
    isFeatured: !!row.is_featured,
    createdAt: row.created_at,
    userHasResponded: !!row.user_has_responded,
    createdBy: row.created_by
      ? {
          id: row.created_by,
          name: row.creator_name || 'Reader',
          avatarUrl: row.creator_avatar || null,
        }
      : null,
  };
}

function mapPromptResponse(row: any) {
  return {
    id: row.id,
    promptId: row.prompt_id,
    content: row.content,
    likeCount: Number(row.like_count || 0),
    createdAt: row.created_at,
    user: {
      id: row.user_id,
      name: row.user_name,
      avatarUrl: row.user_avatar || null,
    },
  };
}

async function resolveBook(bookIdOrSlug: string) {
  return dbGet<any>('SELECT id, slug, title FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookIdOrSlug, bookIdOrSlug]);
}

router.get('/books/:bookId/prompts', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.bookId as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const prompts = await dbAll<any>(
      `SELECT bp.*, u.name AS creator_name, u.avatar_url AS creator_avatar,
              ${req.user?.userId ? '(SELECT COUNT(*) FROM prompt_responses pr2 WHERE pr2.prompt_id = bp.id AND pr2.user_id = ?)' : '0'} AS user_has_responded
       FROM book_prompts bp
       LEFT JOIN users u ON u.id = bp.created_by
       WHERE bp.book_id = ?
       ORDER BY bp.is_featured DESC, bp.response_count DESC, bp.created_at DESC`,
      req.user?.userId ? [req.user.userId, book.id] : [book.id],
    );

    const topResponses: Record<string, any[]> = {};
    for (const prompt of prompts) {
      const preview = await dbAll<any>(
        `SELECT pr.*, u.name AS user_name, u.avatar_url AS user_avatar
         FROM prompt_responses pr
         JOIN users u ON u.id = pr.user_id
         WHERE pr.prompt_id = ?
         ORDER BY pr.like_count DESC, pr.created_at ASC
         LIMIT 2`,
        [prompt.id],
      );
      topResponses[prompt.id] = preview.map(mapPromptResponse);
    }

    res.json({
      prompts: prompts.map((prompt) => ({
        ...mapPrompt(prompt),
        topResponses: topResponses[prompt.id] || [],
      })),
      total: prompts.length,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get community prompts error');
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

router.get('/prompts/:id/responses', optionalAuth, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const offset = (page - 1) * limit;

    const prompt = await dbGet<any>(
      `SELECT bp.*, u.name AS creator_name, u.avatar_url AS creator_avatar,
              ${req.user?.userId ? '(SELECT COUNT(*) FROM prompt_responses pr2 WHERE pr2.prompt_id = bp.id AND pr2.user_id = ?)' : '0'} AS user_has_responded
       FROM book_prompts bp
       LEFT JOIN users u ON u.id = bp.created_by
       WHERE bp.id = ?
       LIMIT 1`,
      req.user?.userId ? [req.user.userId, req.params.id] : [req.params.id],
    );

    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const responses = await dbAll<any>(
      `SELECT pr.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM prompt_responses pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.prompt_id = ?
       ORDER BY pr.like_count DESC, pr.created_at ASC
       LIMIT ? OFFSET ?`,
      [req.params.id, limit, offset],
    );

    res.json({
      prompt: mapPrompt(prompt),
      responses: responses.map(mapPromptResponse),
      page,
      limit,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get prompt responses error');
    res.status(500).json({ error: 'Failed to fetch prompt responses' });
  }
});

router.post('/books/:bookId/prompts', authenticate, rateLimit('book-prompt-create', 20, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.bookId as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const promptText = typeof req.body?.promptText === 'string' ? req.body.promptText.replace(/\s+/g, ' ').trim() : '';
    if (!promptText) {
      res.status(400).json({ error: 'Prompt text is required' });
      return;
    }
    if (promptText.length > 500) {
      res.status(400).json({ error: 'Prompt text must be 500 characters or fewer' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO book_prompts (id, book_id, prompt_text, created_by)
       VALUES (?, ?, ?, ?)`,
      [id, book.id, promptText, req.user!.userId],
    );

    const created = await dbGet<any>(
      `SELECT bp.*, u.name AS creator_name, u.avatar_url AS creator_avatar, 0 AS user_has_responded
       FROM book_prompts bp
       LEFT JOIN users u ON u.id = bp.created_by
       WHERE bp.id = ?`,
      [id],
    );

    res.status(201).json({ ...mapPrompt(created), topResponses: [] });
  } catch (err: any) {
    logger.error({ err }, 'Create community prompt error');
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

router.post('/prompts/:id/responses', authenticate, rateLimit('prompt-response-create', 30, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const prompt = await dbGet<any>('SELECT * FROM book_prompts WHERE id = ? LIMIT 1', [req.params.id]);
    if (!prompt) {
      res.status(404).json({ error: 'Prompt not found' });
      return;
    }

    const content = typeof req.body?.content === 'string' ? req.body.content.replace(/\s+/g, ' ').trim() : '';
    if (!content) {
      res.status(400).json({ error: 'Response content is required' });
      return;
    }
    if (content.length > 3000) {
      res.status(400).json({ error: 'Response must be 3000 characters or fewer' });
      return;
    }

    const existing = await dbGet<any>(
      'SELECT id FROM prompt_responses WHERE prompt_id = ? AND user_id = ? LIMIT 1',
      [req.params.id, req.user!.userId],
    );
    if (existing) {
      res.status(409).json({ error: 'You have already responded to this prompt' });
      return;
    }

    const id = uuidv4();
    await dbRun(
      `INSERT INTO prompt_responses (id, prompt_id, user_id, content)
       VALUES (?, ?, ?, ?)`,
      [id, req.params.id, req.user!.userId, content],
    );

    await dbRun(
      'UPDATE book_prompts SET response_count = response_count + 1 WHERE id = ?',
      [req.params.id],
    );

    const created = await dbGet<any>(
      `SELECT pr.*, u.name AS user_name, u.avatar_url AS user_avatar
       FROM prompt_responses pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.id = ?`,
      [id],
    );

    res.status(201).json(mapPromptResponse(created));
  } catch (err: any) {
    logger.error({ err }, 'Create prompt response error');
    res.status(500).json({ error: 'Failed to submit response' });
  }
});

router.post('/prompt-responses/:id/like', authenticate, rateLimit('prompt-response-like', 120, 60 * 60 * 1000), async (req: Request, res: Response) => {
  try {
    const existing = await dbGet<any>('SELECT id, like_count FROM prompt_responses WHERE id = ? LIMIT 1', [req.params.id]);
    if (!existing) {
      res.status(404).json({ error: 'Prompt response not found' });
      return;
    }

    await dbRun('UPDATE prompt_responses SET like_count = like_count + 1 WHERE id = ?', [req.params.id]);
    const updated = await dbGet<any>('SELECT like_count FROM prompt_responses WHERE id = ?', [req.params.id]);

    res.json({ success: true, likeCount: Number(updated?.like_count || 0), message: 'Marked as helpful' });
  } catch (err: any) {
    logger.error({ err }, 'Like prompt response error');
    res.status(500).json({ error: 'Failed to like response' });
  }
});

export default router;
