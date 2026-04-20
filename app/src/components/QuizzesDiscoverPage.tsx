import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { quizzesApi, type QuizSummary } from '../api/client';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { BookOpen, Play, Trophy, Users, PlusCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';

export function QuizzesDiscoverPage() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'popular' | 'recent'>('popular');

  useEffect(() => {
    setLoading(true);
    quizzesApi.discover(1, 30, sort)
      .then(res => setQuizzes(res.quizzes))
      .catch(() => setQuizzes([]))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <main className="max-w-3xl mx-auto px-4 py-8" data-testid="quizzes-discover-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Book Quizzes</h1>
          <p className="text-muted-foreground mt-1">Test your book knowledge</p>
        </div>
        {user && (
          <Link to="/quizzes/create">
            <Button data-testid="create-quiz-btn">
              <PlusCircle className="h-4 w-4 mr-2" aria-hidden="true" />
              Create Quiz
            </Button>
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-6" role="group" aria-label="Sort quizzes">
        <Button
          variant={sort === 'popular' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setSort('popular')}
          data-testid="sort-popular"
        >
          Popular
        </Button>
        <Button
          variant={sort === 'recent' ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setSort('recent')}
          data-testid="sort-recent"
        >
          Recent
        </Button>
      </div>

      {loading ? (
        <ul className="space-y-4" aria-label="Loading quizzes">
          {[1, 2, 3, 4].map(i => (
            <li key={i}>
              <Skeleton className="h-24 w-full" />
            </li>
          ))}
        </ul>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="quizzes-empty">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p>No quizzes yet. Be the first to create one!</p>
        </div>
      ) : (
        <ul className="space-y-4" role="list" data-testid="quiz-list">
          {quizzes.map(quiz => (
            <li
              key={quiz.id}
              className="border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 bg-card"
              data-testid="quiz-discover-card"
            >
              {quiz.bookCover && (
                <img
                  src={quiz.bookCover}
                  alt=""
                  className="h-16 w-12 object-cover rounded shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <Link to={`/quizzes/${quiz.id}`} className="font-semibold hover:underline line-clamp-1">
                  {quiz.title}
                </Link>
                {quiz.bookTitle && (
                  <p className="text-sm text-muted-foreground">
                    For:{' '}
                    <Link to={`/book/${quiz.bookSlug}`} className="hover:underline">
                      {quiz.bookTitle}
                    </Link>
                  </p>
                )}
                {quiz.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{quiz.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <BookOpen className="h-3 w-3" aria-hidden="true" />
                    {quiz.questionCount} Qs
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" aria-hidden="true" />
                    {quiz.attemptCount.toLocaleString()} attempts
                  </span>
                  {quiz.avgScore !== null && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" aria-hidden="true" />
                      Avg {Math.round(quiz.avgScore)}%
                    </span>
                  )}
                  <span>by {quiz.creatorName}</span>
                </div>
              </div>
              <Link to={`/quizzes/${quiz.id}`} className="shrink-0" data-testid="quiz-play-link">
                <Button size="sm" variant="outline">
                  <Play className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  Take
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
