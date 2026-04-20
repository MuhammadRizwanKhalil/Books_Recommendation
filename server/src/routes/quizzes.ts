import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbAll, dbGet, dbRun } from '../database.js';
import { authenticate, optionalAuth, rateLimit } from '../middleware.js';
import { logger } from '../lib/logger.js';

const router = Router();

function normalizeText(value: unknown, max = 300): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function mapQuiz(row: any) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    bookId: row.book_id || null,
    createdBy: row.created_by,
    questionCount: Number(row.question_count || 0),
    attemptCount: Number(row.attempt_count || 0),
    avgScore: row.avg_score !== null ? Number(row.avg_score) : null,
    isPublished: !!row.is_published,
    createdAt: row.created_at,
    creatorName: row.creator_name || null,
  };
}

// ── GET /api/books/:id/quizzes ───────────────────────────────────────────────
router.get('/books/:id/quizzes', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const book = await dbGet<any>('SELECT id FROM books WHERE id = ? OR slug = ? LIMIT 1', [id, id]);
    if (!book) {
      res.status(404).json({ error: 'Book not found' });
      return;
    }

    const quizzes = await dbAll<any>(
      `SELECT q.*, u.name AS creator_name
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       WHERE q.book_id = ? AND q.is_published = TRUE
       ORDER BY q.attempt_count DESC, q.created_at DESC`,
      [book.id],
    );

    res.json({ quizzes: quizzes.map(mapQuiz), total: quizzes.length });
  } catch (err: any) {
    logger.error({ err }, 'Get book quizzes error');
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// ── GET /api/quizzes/discover ────────────────────────────────────────────────
router.get('/quizzes/discover', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;
    const sort = req.query.sort === 'recent' ? 'q.created_at DESC' : 'q.attempt_count DESC, q.created_at DESC';

    const countRow = await dbGet<any>('SELECT COUNT(*) AS total FROM quizzes WHERE is_published = TRUE', []);
    const total = countRow?.total || 0;

    const quizzes = await dbAll<any>(
      `SELECT q.*, u.name AS creator_name,
              b.title AS book_title, b.slug AS book_slug, b.cover_image AS book_cover
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       LEFT JOIN books b ON b.id = q.book_id
       WHERE q.is_published = TRUE
       ORDER BY ${sort}
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    res.json({
      quizzes: quizzes.map(q => ({
        ...mapQuiz(q),
        bookTitle: q.book_title || null,
        bookSlug: q.book_slug || null,
        bookCover: q.book_cover || null,
      })),
      pagination: {
        page,
        limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  } catch (err: any) {
    logger.error({ err }, 'Discover quizzes error');
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// ── GET /api/quizzes/:id ────────────────────────────────────────────────────
// Returns quiz with questions — answers without correct flag exposed
router.get('/quizzes/:id', optionalAuth, async (req: Request, res: Response) => {
  try {
    const quiz = await dbGet<any>(
      `SELECT q.*, u.name AS creator_name,
              b.title AS book_title, b.slug AS book_slug
       FROM quizzes q
       JOIN users u ON u.id = q.created_by
       LEFT JOIN books b ON b.id = q.book_id
       WHERE q.id = ?`,
      [req.params.id],
    );

    if (!quiz || (!quiz.is_published && (!req.user || req.user.userId !== quiz.created_by && req.user.role !== 'admin'))) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }

    const questions = await dbAll<any>(
      'SELECT id, question_text, question_order FROM quiz_questions WHERE quiz_id = ? ORDER BY question_order ASC',
      [quiz.id],
    );

    const questionsWithAnswers = await Promise.all(
      questions.map(async (q: any) => {
        const answers = await dbAll<any>(
          'SELECT id, answer_text FROM quiz_answers WHERE question_id = ? ORDER BY RAND()',
          [q.id],
        );
        return {
          id: q.id,
          questionText: q.question_text,
          questionOrder: q.question_order,
          answers: answers.map((a: any) => ({ id: a.id, answerText: a.answer_text })),
        };
      }),
    );

    res.json({
      ...mapQuiz(quiz),
      bookTitle: quiz.book_title || null,
      bookSlug: quiz.book_slug || null,
      questions: questionsWithAnswers,
    });
  } catch (err: any) {
    logger.error({ err }, 'Get quiz error');
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// ── POST /api/quizzes/:id/submit ─────────────────────────────────────────────
router.post(
  '/quizzes/:id/submit',
  authenticate,
  rateLimit('quiz-submit', 30, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const quiz = await dbGet<any>('SELECT * FROM quizzes WHERE id = ? AND is_published = TRUE', [req.params.id]);
      if (!quiz) {
        res.status(404).json({ error: 'Quiz not found' });
        return;
      }

      const { answers } = req.body;
      if (!Array.isArray(answers) || answers.length === 0) {
        res.status(400).json({ error: 'answers must be a non-empty array of { questionId, answerId }' });
        return;
      }

      // Get all questions for this quiz
      const questions = await dbAll<any>(
        'SELECT id FROM quiz_questions WHERE quiz_id = ?',
        [quiz.id],
      );

      if (answers.length !== questions.length) {
        res.status(400).json({ error: `Expected ${questions.length} answers, got ${answers.length}` });
        return;
      }

      // Validate question IDs belong to this quiz
      const questionIds = new Set(questions.map((q: any) => q.id));
      for (const answer of answers) {
        if (!answer.questionId || !answer.answerId) {
          res.status(400).json({ error: 'Each answer must have questionId and answerId' });
          return;
        }
        if (!questionIds.has(answer.questionId)) {
          res.status(400).json({ error: `questionId ${answer.questionId} does not belong to this quiz` });
          return;
        }
      }

      // Score each answer
      let score = 0;
      const results: any[] = [];

      for (const answer of answers) {
        const correctAnswer = await dbGet<any>(
          'SELECT id, answer_text FROM quiz_answers WHERE question_id = ? AND is_correct = TRUE LIMIT 1',
          [answer.questionId],
        );
        const submittedAnswer = await dbGet<any>(
          'SELECT id, answer_text, is_correct FROM quiz_answers WHERE id = ? AND question_id = ?',
          [answer.answerId, answer.questionId],
        );
        const question = await dbGet<any>(
          'SELECT question_text FROM quiz_questions WHERE id = ?',
          [answer.questionId],
        );

        const isCorrect = !!submittedAnswer?.is_correct;
        if (isCorrect) score++;

        results.push({
          questionId: answer.questionId,
          questionText: question?.question_text || '',
          yourAnswerId: answer.answerId,
          yourAnswerText: submittedAnswer?.answer_text || '',
          correctAnswerId: correctAnswer?.id || null,
          correctAnswerText: correctAnswer?.answer_text || null,
          isCorrect,
        });
      }

      const totalQuestions = questions.length;
      const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

      const attemptId = uuidv4();
      await dbRun(
        'INSERT INTO quiz_attempts (id, quiz_id, user_id, score, total_questions) VALUES (?, ?, ?, ?, ?)',
        [attemptId, quiz.id, req.user!.userId, score, totalQuestions],
      );
      await dbRun(
        `UPDATE quizzes SET attempt_count = attempt_count + 1, avg_score = (SELECT AVG(score / total_questions * 100) FROM quiz_attempts WHERE quiz_id = ?) WHERE id = ?`,
        [quiz.id, quiz.id],
      );

      res.json({ score, totalQuestions, percentage, results });
    } catch (err: any) {
      logger.error({ err }, 'Submit quiz error');
      res.status(500).json({ error: 'Failed to submit quiz' });
    }
  },
);

// ── POST /api/quizzes — Create a quiz ────────────────────────────────────────
router.post(
  '/quizzes',
  authenticate,
  rateLimit('quiz-create', 10, 60 * 60 * 1000),
  async (req: Request, res: Response) => {
    try {
      const title = normalizeText(req.body.title, 300);
      const description = normalizeText(req.body.description || '', 1000);
      const bookId = normalizeText(req.body.bookId || '', 36) || null;
      const questions: any[] = Array.isArray(req.body.questions) ? req.body.questions : [];

      if (!title) {
        res.status(400).json({ error: 'title is required' });
        return;
      }

      if (questions.length < 2) {
        res.status(400).json({ error: 'Quiz must have at least 2 questions' });
        return;
      }

      if (questions.length > 50) {
        res.status(400).json({ error: 'Quiz can have at most 50 questions' });
        return;
      }

      // Validate each question
      for (const q of questions) {
        if (!q.questionText || typeof q.questionText !== 'string' || !q.questionText.trim()) {
          res.status(400).json({ error: 'Each question must have a non-empty questionText' });
          return;
        }
        const answers = Array.isArray(q.answers) ? q.answers : [];
        if (answers.length < 2 || answers.length > 6) {
          res.status(400).json({ error: 'Each question must have 2–6 answer options' });
          return;
        }
        const correctCount = answers.filter((a: any) => !!a.isCorrect).length;
        if (correctCount !== 1) {
          res.status(400).json({ error: 'Each question must have exactly one correct answer' });
          return;
        }
      }

      if (bookId) {
        const book = await dbGet<any>('SELECT id FROM books WHERE id = ?', [bookId]);
        if (!book) {
          res.status(404).json({ error: 'Book not found' });
          return;
        }
      }

      const quizId = uuidv4();
      const isAdmin = req.user!.role === 'admin';

      await dbRun(
        `INSERT INTO quizzes (id, title, description, book_id, created_by, question_count, is_published)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [quizId, title, description || null, bookId, req.user!.userId, questions.length, isAdmin ? 1 : 0],
      );

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const questionId = uuidv4();
        await dbRun(
          'INSERT INTO quiz_questions (id, quiz_id, question_text, question_order) VALUES (?, ?, ?, ?)',
          [questionId, quizId, q.questionText.trim().slice(0, 1000), i + 1],
        );
        for (const answer of q.answers) {
          await dbRun(
            'INSERT INTO quiz_answers (id, question_id, answer_text, is_correct) VALUES (?, ?, ?, ?)',
            [uuidv4(), questionId, String(answer.answerText || '').trim().slice(0, 500), answer.isCorrect ? 1 : 0],
          );
        }
      }

      const created = await dbGet<any>('SELECT * FROM quizzes WHERE id = ?', [quizId]);
      res.status(201).json(mapQuiz(created));
    } catch (err: any) {
      logger.error({ err }, 'Create quiz error');
      res.status(500).json({ error: 'Failed to create quiz' });
    }
  },
);

// ── GET /api/quizzes/:id/leaderboard ─────────────────────────────────────────
router.get('/quizzes/:id/leaderboard', async (req: Request, res: Response) => {
  try {
    const quiz = await dbGet<any>('SELECT id, title FROM quizzes WHERE id = ? AND is_published = TRUE', [req.params.id]);
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    const entries = await dbAll<any>(
      `SELECT qa.id, qa.user_id, qa.score, qa.total_questions, qa.completed_at,
              u.name AS user_name, u.avatar_url,
              ROUND(CAST(qa.score AS FLOAT) / qa.total_questions * 100, 0) AS percentage
       FROM quiz_attempts qa
       JOIN users u ON u.id = qa.user_id
       WHERE qa.quiz_id = ?
       ORDER BY percentage DESC, qa.completed_at ASC
       LIMIT ?`,
      [quiz.id, limit],
    );

    res.json({
      quizId: quiz.id,
      quizTitle: quiz.title,
      leaderboard: entries.map((e: any, idx: number) => ({
        rank: idx + 1,
        userId: e.user_id,
        userName: e.user_name,
        avatarUrl: e.avatar_url || null,
        score: Number(e.score),
        totalQuestions: Number(e.total_questions),
        percentage: Number(e.percentage),
        completedAt: e.completed_at,
      })),
    });
  } catch (err: any) {
    logger.error({ err }, 'Get quiz leaderboard error');
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ── Admin: Publish/Unpublish quiz ─────────────────────────────────────────────
router.put('/admin/quizzes/:id/publish', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user!.role !== 'admin') {
      res.status(403).json({ error: 'Admin only' });
      return;
    }
    const quiz = await dbGet<any>('SELECT id FROM quizzes WHERE id = ?', [req.params.id]);
    if (!quiz) {
      res.status(404).json({ error: 'Quiz not found' });
      return;
    }
    const publish = req.body.publish !== false;
    await dbRun('UPDATE quizzes SET is_published = ? WHERE id = ?', [publish ? 1 : 0, quiz.id]);
    res.json({ success: true, isPublished: publish });
  } catch (err: any) {
    logger.error({ err }, 'Publish quiz error');
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

export default router;
