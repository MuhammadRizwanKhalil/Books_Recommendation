import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { quizzesApi, type QuizSummary } from '../../api/client';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { BookOpen, Play, Trophy, Users } from 'lucide-react';

interface BookQuizzesProps {
  bookId: string;
}

export function BookQuizzes({ bookId }: BookQuizzesProps) {
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    quizzesApi.forBook(bookId)
      .then(res => setQuizzes(res.quizzes))
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, [bookId]);

  if (loading) {
    return (
      <section data-testid="book-quizzes-section" aria-label="Quizzes" className="mt-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
          Quizzes
        </h2>
        <div className="space-y-3">
          {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </section>
    );
  }

  if (quizzes.length === 0) return null;

  return (
    <section data-testid="book-quizzes-section" aria-label={`Quizzes — ${quizzes.length}`} className="mt-8">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5" aria-hidden="true" />
        Quizzes
        <span className="text-sm font-normal text-muted-foreground ml-1">({quizzes.length})</span>
      </h2>
      <ul className="space-y-3" role="list">
        {quizzes.map(quiz => (
          <li
            key={quiz.id}
            className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card"
            data-testid="quiz-card"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{quiz.title}</p>
              {quiz.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{quiz.description}</p>
              )}
              <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <BookOpen className="h-3 w-3" aria-hidden="true" />
                  {quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  {quiz.attemptCount.toLocaleString()} attempt{quiz.attemptCount !== 1 ? 's' : ''}
                </span>
                {quiz.avgScore !== null && (
                  <span className="flex items-center gap-1">
                    <Trophy className="h-3 w-3" aria-hidden="true" />
                    Avg {Math.round(quiz.avgScore)}%
                  </span>
                )}
              </div>
            </div>
            <Link to={`/quizzes/${quiz.id}`} data-testid="take-quiz-link">
              <Button size="sm" className="shrink-0">
                <Play className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                Take Quiz
              </Button>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <Link
          to={`/quizzes/create?bookId=${encodeURIComponent(bookId)}`}
          className="text-sm text-primary hover:underline"
          data-testid="create-quiz-link"
        >
          + Create a quiz for this book
        </Link>
      </div>
    </section>
  );
}
