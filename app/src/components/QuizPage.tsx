import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { quizzesApi, type QuizDetail, type QuizSubmitResult } from '../api/client';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { ArrowLeft, ChevronRight, Trophy, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

// ── Take Quiz ────────────────────────────────────────────────────────────────

export function QuizPage() {
  const { id } = useParams<{ id: string }>();

  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<{
    score: number;
    totalQuestions: number;
    percentage: number;
    results: QuizSubmitResult[];
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    quizzesApi.get(id)
      .then(setQuiz)
      .catch(() => setError('Quiz not found or unavailable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSelect = useCallback((questionId: string, answerId: string) => {
    setSelections(prev => ({ ...prev, [questionId]: answerId }));
  }, []);

  const handleNext = () => {
    if (quiz && currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(i => i + 1);
    }
  };

  const handleSubmit = async () => {
    if (!quiz) return;
    const answers = quiz.questions.map(q => ({
      questionId: q.id,
      answerId: selections[q.id] || '',
    }));
    setSubmitting(true);
    try {
      const res = await quizzesApi.submit(quiz.id, answers);
      setResults({
        score: Number(res?.score || 0),
        totalQuestions: Number(res?.totalQuestions || 0),
        percentage: Number(res?.percentage || 0),
        results: Array.isArray(res?.results) ? res.results : [],
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8" data-testid="quiz-loading">
        <Skeleton className="h-8 w-2/3 mb-2" />
        <Skeleton className="h-4 w-1/3 mb-6" />
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }

  if (error || !quiz) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 text-center" data-testid="quiz-error">
        <p className="text-destructive">{error || 'Quiz not found.'}</p>
        <Link to="/quizzes" className="text-primary hover:underline mt-4 inline-block">
          Browse quizzes
        </Link>
      </main>
    );
  }

  if (results) {
    return (
      <QuizResultsView
        quiz={quiz}
        score={results.score}
        totalQuestions={results.totalQuestions}
        percentage={results.percentage}
        results={results.results}
        onRetake={() => {
          setSelections({});
          setCurrentIndex(0);
          setResults(null);
        }}
      />
    );
  }

  const question = quiz.questions[currentIndex];
  const totalAnswered = Object.keys(selections).length;
  const isLast = currentIndex === quiz.questions.length - 1;
  const allAnswered = totalAnswered === quiz.questions.length;
  const progressValue = ((currentIndex) / quiz.questions.length) * 100;

  return (
    <main
      className="max-w-2xl mx-auto px-4 py-8"
      data-testid="quiz-page"
      aria-label={`Quiz: ${quiz.title}`}
    >
      <div className="mb-4">
        <Link to="/quizzes" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground gap-1">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All Quizzes
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-1">{quiz.title}</h1>
      {quiz.description && (
        <p className="text-muted-foreground mb-4">{quiz.description}</p>
      )}

      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span>Question {currentIndex + 1} of {quiz.questions.length}</span>
        <span>{totalAnswered} answered</span>
      </div>
      <Progress value={progressValue} className="mb-6" aria-label="Quiz progress" />

      <section
        className="bg-card border rounded-xl p-6"
        data-testid="quiz-question"
        aria-live="polite"
      >
        <p className="font-semibold text-lg mb-4">{question.questionText}</p>
        <ul className="space-y-2" role="list">
          {question.answers.map(answer => {
            const selected = selections[question.id] === answer.id;
            return (
              <li key={answer.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(question.id, answer.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-lg border transition-colors',
                    selected
                      ? 'border-primary bg-primary/10 font-medium'
                      : 'border-border hover:bg-muted',
                  )}
                  data-testid="quiz-answer-option"
                >
                  {answer.answerText}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex items-center justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          Back
        </Button>
        {isLast ? (
          <Button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            data-testid="quiz-submit-btn"
          >
            {submitting ? 'Submitting…' : 'Submit Quiz'}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={!selections[question.id]}
            data-testid="quiz-next-btn"
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </main>
  );
}

// ── Quiz Results View ─────────────────────────────────────────────────────────

interface QuizResultsViewProps {
  quiz: QuizDetail;
  score: number;
  totalQuestions: number;
  percentage: number;
  results: QuizSubmitResult[];
  onRetake: () => void;
}

function QuizResultsView({ quiz, score, totalQuestions, percentage, results, onRetake }: QuizResultsViewProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const safeResults = Array.isArray(results) ? results : [];

  const loadLeaderboard = async () => {
    setLbLoading(true);
    try {
      const res = await quizzesApi.leaderboard(quiz.id);
      setLeaderboard(res.leaderboard);
      setShowLeaderboard(true);
    } finally {
      setLbLoading(false);
    }
  };

  const grade =
    percentage >= 80 ? 'Great job! 🎉' :
    percentage >= 60 ? 'Well done! 👍' :
    percentage >= 40 ? 'Not bad! 📚' :
    'Keep reading! 💪';

  return (
    <main
      className="max-w-2xl mx-auto px-4 py-8"
      data-testid="quiz-results-page"
      aria-label="Quiz Results"
    >
      <div className="text-center mb-8">
        <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-3" aria-hidden="true" />
        <h1 className="text-3xl font-bold mb-1">{grade}</h1>
        <p className="text-muted-foreground text-lg">
          You scored <strong>{score} / {totalQuestions}</strong> ({percentage}%)
        </p>
      </div>

      <Progress value={percentage} className="mb-8" aria-label={`Score: ${percentage}%`} />

      <h2 className="text-lg font-semibold mb-4">Answer Review</h2>
      <ul className="space-y-4" role="list" data-testid="quiz-results-list">
        {safeResults.map((r, i) => (
          <li key={r.questionId} className="border rounded-lg p-4">
            <div className="flex items-start gap-3">
              {r.isCorrect
                ? <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 shrink-0" aria-label="Correct" />
                : <XCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" aria-label="Incorrect" />
              }
              <div className="flex-1 min-w-0">
                <p className="font-medium">{i + 1}. {r.questionText}</p>
                <p className={cn('text-sm mt-1', r.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-destructive')}>
                  Your answer: {r.yourAnswerText}
                </p>
                {!r.isCorrect && r.correctAnswerText && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Correct answer: <span className="font-medium text-green-600 dark:text-green-400">{r.correctAnswerText}</span>
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <Button onClick={onRetake} variant="outline" data-testid="quiz-retake-btn">
          Retake Quiz
        </Button>
        <Button
          onClick={loadLeaderboard}
          disabled={lbLoading}
          variant="outline"
          data-testid="quiz-leaderboard-btn"
        >
          <Trophy className="h-4 w-4 mr-2" aria-hidden="true" />
          {lbLoading ? 'Loading…' : 'View Leaderboard'}
        </Button>
        <Link to="/quizzes">
          <Button variant="ghost">Browse More Quizzes</Button>
        </Link>
      </div>

      {showLeaderboard && (
        <section className="mt-8" data-testid="quiz-leaderboard">
          <h2 className="text-lg font-semibold mb-3">Top Scores</h2>
          {leaderboard.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scores yet.</p>
          ) : (
            <ol className="space-y-2" role="list">
              {leaderboard.map(entry => (
                <li key={entry.userId} className="flex items-center justify-between border rounded-lg px-4 py-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground w-6 text-right">{entry.rank}</span>
                    <span>{entry.userName}</span>
                  </div>
                  <span className="font-semibold">{entry.percentage}%</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </main>
  );
}
