import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { quizzesApi } from '../api/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { PlusCircle, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface AnswerDraft {
  answerText: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  questionText: string;
  answers: AnswerDraft[];
}

function emptyQuestion(): QuestionDraft {
  return {
    questionText: '',
    answers: [
      { answerText: '', isCorrect: true },
      { answerText: '', isCorrect: false },
      { answerText: '', isCorrect: false },
      { answerText: '', isCorrect: false },
    ],
  };
}

export function QuizCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultBookId = searchParams.get('bookId') || '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bookId] = useState(defaultBookId);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion(), emptyQuestion()]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addQuestion = () => {
    if (questions.length >= 50) return;
    setQuestions(prev => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (qi: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== qi));
  };

  const updateQuestion = (qi: number, text: string) => {
    setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, questionText: text } : q));
  };

  const updateAnswer = (qi: number, ai: number, text: string) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qi
        ? { ...q, answers: q.answers.map((a, j) => j === ai ? { ...a, answerText: text } : a) }
        : q,
    ));
  };

  const setCorrect = (qi: number, ai: number) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qi
        ? { ...q, answers: q.answers.map((a, j) => ({ ...a, isCorrect: j === ai })) }
        : q,
    ));
  };

  const addAnswer = (qi: number) => {
    setQuestions(prev => prev.map((q, i) =>
      i === qi && q.answers.length < 6
        ? { ...q, answers: [...q.answers, { answerText: '', isCorrect: false }] }
        : q,
    ));
  };

  const removeAnswer = (qi: number, ai: number) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qi) return q;
      const updated = q.answers.filter((_, j) => j !== ai);
      // ensure one correct remains
      if (!updated.some(a => a.isCorrect) && updated.length > 0) {
        updated[0] = { ...updated[0], isCorrect: true };
      }
      return { ...q, answers: updated };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) { setError('Title is required.'); return; }
    if (questions.length < 2) { setError('At least 2 questions required.'); return; }

    for (const q of questions) {
      if (!q.questionText.trim()) { setError('All questions must have text.'); return; }
      if (q.answers.length < 2) { setError('Each question needs at least 2 answers.'); return; }
      if (!q.answers.every(a => a.answerText.trim())) { setError('All answer options must have text.'); return; }
      if (q.answers.filter(a => a.isCorrect).length !== 1) { setError('Each question needs exactly one correct answer.'); return; }
    }

    setSubmitting(true);
    try {
      const quiz = await quizzesApi.create({
        title: title.trim(),
        description: description.trim() || undefined,
        bookId: bookId || null,
        questions: questions.map(q => ({
          questionText: q.questionText.trim(),
          answers: q.answers.map(a => ({ answerText: a.answerText.trim(), isCorrect: a.isCorrect })),
        })),
      });
      navigate(`/quizzes/${quiz.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create quiz');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="max-w-3xl mx-auto px-4 py-8" data-testid="quiz-create-page">
      <div className="mb-6">
        <Link to="/quizzes" className="text-sm text-muted-foreground hover:text-foreground">
          ← All Quizzes
        </Link>
        <h1 className="text-2xl font-bold mt-2">Create a Quiz</h1>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="space-y-4 mb-8">
          <div>
            <label htmlFor="quiz-title" className="block text-sm font-medium mb-1">
              Title <span aria-hidden="true">*</span>
            </label>
            <Input
              id="quiz-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. How Well Do You Know Harry Potter?"
              maxLength={300}
              required
              data-testid="quiz-title-input"
            />
          </div>
          <div>
            <label htmlFor="quiz-description" className="block text-sm font-medium mb-1">
              Description (optional)
            </label>
            <Textarea
              id="quiz-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this quiz about?"
              rows={2}
              maxLength={1000}
              data-testid="quiz-description-input"
            />
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">
          Questions <span className="text-muted-foreground font-normal text-sm">({questions.length})</span>
        </h2>

        <ol className="space-y-6" role="list">
          {questions.map((q, qi) => (
            <li
              key={qi}
              className="border rounded-xl p-5 bg-card"
              data-testid="quiz-question-editor"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-medium">Q{qi + 1}</span>
                {questions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(qi)}
                    className="text-destructive hover:text-destructive/80 text-sm flex items-center gap-1"
                    aria-label={`Remove question ${qi + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                )}
              </div>
              <Textarea
                value={q.questionText}
                onChange={e => updateQuestion(qi, e.target.value)}
                placeholder="Question text…"
                rows={2}
                maxLength={1000}
                required
                data-testid="question-text-input"
                aria-label={`Question ${qi + 1} text`}
              />

              <ul className="mt-3 space-y-2" role="list">
                {q.answers.map((a, ai) => (
                  <li key={ai} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCorrect(qi, ai)}
                      className={cn(
                        'shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center',
                        a.isCorrect
                          ? 'border-green-500 bg-green-500 text-white'
                          : 'border-border hover:border-green-400',
                      )}
                      aria-label={`Mark answer ${ai + 1} as correct`}
                    >
                      {a.isCorrect && <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                    </button>
                    <Input
                      value={a.answerText}
                      onChange={e => updateAnswer(qi, ai, e.target.value)}
                      placeholder={`Answer ${ai + 1}`}
                      maxLength={500}
                      required
                      data-testid="answer-text-input"
                      aria-label={`Answer ${ai + 1} for question ${qi + 1}`}
                    />
                    {q.answers.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeAnswer(qi, ai)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Remove answer ${ai + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              {q.answers.length < 6 && (
                <button
                  type="button"
                  onClick={() => addAnswer(qi)}
                  className="mt-2 text-sm text-primary hover:underline"
                  data-testid="add-answer-btn"
                >
                  + Add answer option
                </button>
              )}
            </li>
          ))}
        </ol>

        {questions.length < 50 && (
          <Button
            type="button"
            variant="outline"
            onClick={addQuestion}
            className="mt-4 w-full"
            data-testid="add-question-btn"
          >
            <PlusCircle className="h-4 w-4 mr-2" aria-hidden="true" />
            Add Question
          </Button>
        )}

        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert" data-testid="quiz-create-error">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="mt-6 w-full"
          disabled={submitting}
          data-testid="quiz-create-submit-btn"
        >
          {submitting ? 'Creating…' : 'Create Quiz'}
        </Button>
      </form>
    </main>
  );
}
