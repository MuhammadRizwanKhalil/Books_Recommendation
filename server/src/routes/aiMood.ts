import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit, requireAdmin } from '../middleware.js';
import { logger } from '../lib/logger.js';
import { analyzeBookAIMood, submitBatchMoodAnalysis, getBatchMoodStatus, processBatchMoodResults, type PaceValue, type BatchMoodInput } from '../services/aiMoodAnalysis.js';

const router = Router();

const ALLOWED_MOODS = new Set([
  'adventurous',
  'dark',
  'emotional',
  'funny',
  'hopeful',
  'informative',
  'inspiring',
  'lighthearted',
  'mysterious',
  'romantic',
  'sad',
  'tense',
]);

const ALLOWED_PACE = new Set(['slow', 'medium', 'fast']);

type AnalysisType = 'mood' | 'pace' | 'content_warnings' | 'themes' | 'difficulty';

function parseResultJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value !== 'string') return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function resolveBook(bookIdOrSlug: string) {
  return dbGet<any>('SELECT id, slug, title, author, description FROM books WHERE id = ? OR slug = ? LIMIT 1', [bookIdOrSlug, bookIdOrSlug]);
}

async function getBookCategories(bookId: string): Promise<string[]> {
  const rows = await dbAll<any>(
    `SELECT c.name
     FROM book_categories bc
     JOIN categories c ON c.id = bc.category_id
     WHERE bc.book_id = ?`,
    [bookId],
  );

  return rows.map((row) => String(row.name));
}

async function persistAnalysis(bookId: string, modelVersion: string, analysis: {
  mood: { moods: string[]; confidence: number };
  pace: { pace: PaceValue; confidence: number };
  content_warnings: { warnings: string[]; confidence: number };
  themes: { themes: string[]; confidence: number };
  difficulty: { level: 'easy' | 'moderate' | 'challenging'; confidence: number };
}) {
  const entries: Array<{ type: AnalysisType; result: any }> = [
    { type: 'mood', result: analysis.mood },
    { type: 'pace', result: analysis.pace },
    { type: 'content_warnings', result: analysis.content_warnings },
    { type: 'themes', result: analysis.themes },
    { type: 'difficulty', result: analysis.difficulty },
  ];

  for (const entry of entries) {
    await dbRun(
      `INSERT INTO ai_book_analysis (id, book_id, analysis_type, result, model_version)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         result = VALUES(result),
         model_version = VALUES(model_version),
         analyzed_at = CURRENT_TIMESTAMP`,
      [uuidv4(), bookId, entry.type, JSON.stringify(entry.result), modelVersion],
    );
  }
}

async function fetchAnalysisByBook(bookId: string) {
  const rows = await dbAll<any>(
    `SELECT analysis_type, result, model_version, analyzed_at
     FROM ai_book_analysis
     WHERE book_id = ?
     ORDER BY analyzed_at DESC`,
    [bookId],
  );

  const byType = new Map<string, any>();
  for (const row of rows) {
    if (!byType.has(row.analysis_type)) {
      byType.set(row.analysis_type, {
        result: parseResultJson(row.result, {}),
        modelVersion: row.model_version || 'gpt-4o-mini',
        analyzedAt: row.analyzed_at,
      });
    }
  }

  return {
    mood: byType.get('mood')?.result ?? null,
    pace: byType.get('pace')?.result ?? null,
    contentWarnings: byType.get('content_warnings')?.result ?? null,
    themes: byType.get('themes')?.result ?? null,
    difficulty: byType.get('difficulty')?.result ?? null,
    modelVersion: byType.get('mood')?.modelVersion || byType.get('pace')?.modelVersion || null,
    analyzedAt: byType.get('mood')?.analyzedAt || byType.get('pace')?.analyzedAt || null,
  };
}

// GET /api/books/:id/ai-analysis
router.get('/books/:id/ai-analysis', optionalAuth, async (req: Request, res: Response) => {
  try {
    const book = await resolveBook(req.params.id as string);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const analysis = await fetchAnalysisByBook(book.id);
    res.json({
      bookId: book.id,
      ...analysis,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get AI analysis error');
    res.status(500).json({ error: 'Failed to fetch AI analysis' });
  }
});

// GET /api/discover/mood?mood=uplifting&pace=fast
router.get('/discover/mood', async (req: Request, res: Response) => {
  try {
    const mood = typeof req.query.mood === 'string' ? req.query.mood.trim().toLowerCase() : '';
    const pace = typeof req.query.pace === 'string' ? req.query.pace.trim().toLowerCase() : '';
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '20'), 10) || 20));

    if (mood && !ALLOWED_MOODS.has(mood)) {
      res.status(400).json({ error: 'Invalid mood parameter' });
      return;
    }

    if (pace && !ALLOWED_PACE.has(pace)) {
      res.status(400).json({ error: 'Invalid pace parameter' });
      return;
    }

    const rows = await dbAll<any>(
      `SELECT
        b.id,
        b.title,
        b.slug,
        b.author,
        b.cover_image,
        b.google_rating,
        b.computed_score,
        b.page_count,
        b.published_date,
        MAX(CASE WHEN a.analysis_type = 'mood' THEN a.result END) AS mood_result,
        MAX(CASE WHEN a.analysis_type = 'pace' THEN a.result END) AS pace_result,
        MAX(CASE WHEN a.analysis_type = 'mood' THEN a.analyzed_at END) AS analyzed_at
      FROM books b
      JOIN ai_book_analysis a ON a.book_id = b.id
      WHERE b.status = 'PUBLISHED'
      GROUP BY b.id
      ORDER BY analyzed_at DESC, b.computed_score DESC
      LIMIT 600`,
      [],
    );

    const filtered = rows.filter((row) => {
      const moodResult = parseResultJson<{ moods?: string[]; confidence?: number }>(row.mood_result, {});
      const paceResult = parseResultJson<{ pace?: string; confidence?: number }>(row.pace_result, {});

      const moods = Array.isArray(moodResult.moods)
        ? moodResult.moods.map((m) => String(m).toLowerCase())
        : [];
      const paceValue = typeof paceResult.pace === 'string' ? paceResult.pace.toLowerCase() : '';

      if (mood && !moods.includes(mood)) return false;
      if (pace && paceValue !== pace) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    const books = filtered.slice(offset, offset + limit).map((row) => {
      const moodResult = parseResultJson<{ moods?: string[]; confidence?: number }>(row.mood_result, {});
      const paceResult = parseResultJson<{ pace?: string; confidence?: number }>(row.pace_result, {});

      return {
        id: row.id,
        title: row.title,
        slug: row.slug,
        author: row.author,
        coverImage: row.cover_image,
        googleRating: row.google_rating !== null ? Number(row.google_rating) : null,
        computedScore: Number(row.computed_score || 0),
        pageCount: row.page_count !== null ? Number(row.page_count) : null,
        publishedDate: row.published_date || null,
        aiMood: {
          moods: Array.isArray(moodResult.moods) ? moodResult.moods : [],
          confidence: Number(moodResult.confidence || 0),
        },
        aiPace: {
          pace: typeof paceResult.pace === 'string' ? paceResult.pace : 'medium',
          confidence: Number(paceResult.confidence || 0),
        },
        aiDetected: true,
      };
    });

    res.json({
      filters: {
        mood: mood || null,
        pace: pace || null,
      },
      books,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Discover by AI mood error');
    res.status(500).json({ error: 'Failed to discover books by mood' });
  }
});

// POST /api/admin/ai/analyze-book/:id
router.post(
  '/admin/ai/analyze-book/:id',
  authenticate,
  requireAdmin,
  rateLimit('ai-analyze-book', 40, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const book = await resolveBook(req.params.id as string);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      const categories = await getBookCategories(book.id);
      const analysis = await analyzeBookAIMood({
        title: book.title,
        author: book.author,
        description: book.description,
        categories,
      });

      await persistAnalysis(book.id, 'gpt-4o-mini', analysis);
      const saved = await fetchAnalysisByBook(book.id);

      res.json({
        message: 'Book AI analysis saved',
        bookId: book.id,
        ...saved,
      });
    } catch (err: any) {
      logger.error({ err }, 'Analyze single book AI error');
      res.status(500).json({ error: 'Failed to analyze book' });
    }
  },
);

// POST /api/admin/ai/batch-analyze
router.post(
  '/admin/ai/batch-analyze',
  authenticate,
  requireAdmin,
  rateLimit('ai-batch-analyze', 10, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(50, Math.max(1, Number(req.body?.limit || 10)));
      const onlyUnanalyzed = req.body?.onlyUnanalyzed !== false;

      const rows = await dbAll<any>(
        `SELECT b.id, b.title, b.author, b.description
         FROM books b
         WHERE b.status = 'PUBLISHED'
           AND (
             ? = FALSE
             OR NOT EXISTS (
               SELECT 1 FROM ai_book_analysis a
               WHERE a.book_id = b.id AND a.analysis_type = 'mood'
             )
           )
         ORDER BY b.created_at DESC
         LIMIT ?`,
        [onlyUnanalyzed, limit],
      );

      const processed: Array<{ bookId: string; title: string; success: boolean; error?: string }> = [];

      for (const book of rows) {
        try {
          const categories = await getBookCategories(book.id);
          const analysis = await analyzeBookAIMood({
            title: book.title,
            author: book.author,
            description: book.description,
            categories,
          });

          await persistAnalysis(book.id, 'gpt-4o-mini', analysis);
          processed.push({ bookId: book.id, title: book.title, success: true });
        } catch (err: any) {
          processed.push({
            bookId: book.id,
            title: book.title,
            success: false,
            error: err?.message || 'Unknown error',
          });
        }
      }

      const successful = processed.filter((p) => p.success).length;
      const failed = processed.length - successful;

      res.json({
        message: 'Batch AI analysis complete',
        requested: limit,
        processed: processed.length,
        successful,
        failed,
        details: processed,
      });
    } catch (err: any) {
      logger.error({ err }, 'Batch AI analyze error');
      res.status(500).json({ error: 'Failed to batch analyze books' });
    }
  },
);

// POST /api/admin/ai/batch-analyze-submit — Batch API mode (50% cheaper)
// Submits mood analysis to OpenAI Batch API. Returns batchId for polling.
router.post(
  '/admin/ai/batch-analyze-submit',
  authenticate,
  requireAdmin,
  rateLimit('ai-batch-submit', 5, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const limit = Math.min(200, Math.max(1, Number(req.body?.limit || 50)));
      const onlyUnanalyzed = req.body?.onlyUnanalyzed !== false;

      const rows = await dbAll<any>(
        `SELECT b.id, b.title, b.author, b.description
         FROM books b
         WHERE b.status = 'PUBLISHED'
           AND b.description IS NOT NULL AND LENGTH(b.description) > 50
           AND (
             ? = FALSE
             OR NOT EXISTS (
               SELECT 1 FROM ai_book_analysis a
               WHERE a.book_id = b.id AND a.analysis_type = 'mood'
             )
           )
         ORDER BY b.computed_score DESC
         LIMIT ?`,
        [onlyUnanalyzed, limit],
      );

      if (rows.length === 0) {
        return res.json({ message: 'No books to analyze' });
      }

      // Gather categories for all books
      const batchInputs: BatchMoodInput[] = [];
      for (const book of rows) {
        const categories = await getBookCategories(book.id);
        batchInputs.push({
          bookId: book.id,
          title: book.title,
          author: book.author,
          description: book.description,
          categories,
        });
      }

      const result = await submitBatchMoodAnalysis(batchInputs);

      res.json({
        ...result,
        message: `Batch submitted: ${result.submitted} books queued for mood analysis (50% cost savings). Use GET /api/admin/ai/batch-mood/:batchId to check status.`,
      });
    } catch (err: any) {
      logger.error({ err }, 'Batch mood submit error');
      res.status(500).json({ error: err.message });
    }
  },
);

// GET /api/admin/ai/batch-mood/:batchId — Check batch mood status
router.get(
  '/admin/ai/batch-mood/:batchId',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const status = await getBatchMoodStatus(req.params.batchId as string);
      res.json(status);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

// POST /api/admin/ai/batch-mood/:batchId/process — Process completed batch mood results
router.post(
  '/admin/ai/batch-mood/:batchId/process',
  authenticate,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const analysisMap = await processBatchMoodResults(req.params.batchId as string);

      let stored = 0;
      let failed = 0;

      for (const [bookId, analysis] of analysisMap) {
        try {
          await persistAnalysis(bookId, 'gpt-4o-mini-batch', analysis);
          stored++;
        } catch (err: any) {
          failed++;
          logger.warn(`Failed to persist batch mood for ${bookId}: ${err.message}`);
        }
      }

      res.json({
        message: `Processed batch mood results: ${stored} stored, ${failed} failed`,
        processed: analysisMap.size,
        stored,
        failed,
      });
    } catch (err: any) {
      logger.error({ err }, 'Process batch mood error');
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
