import { useState, useEffect } from 'react';
import { Target, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { readingChallengeApi, type ReadingChallengeResponse } from '@/api/client';
import { ChallengeSetupModal } from './ChallengeSetupModal';

export function ChallengeWidget() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ReadingChallengeResponse | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    readingChallengeApi.get()
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setChecked(true));
  }, [isAuthenticated]);

  if (!isAuthenticated || !checked) return null;

  const handleCreate = async (goalBooks: number) => {
    setLoading(true);
    try {
      const created = await readingChallengeApi.create({ goalBooks });
      setChallenge(created);
      setShowSetup(false);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  // No challenge yet — show CTA
  if (!challenge) {
    return (
      <>
        <div
          className="container mx-auto px-4 py-6"
          data-testid="challenge-widget-cta"
        >
          <div className="max-w-md mx-auto rounded-xl border bg-card p-5 text-center space-y-3">
            <Target className="h-8 w-8 text-primary mx-auto" />
            <h3 className="font-semibold">Set a Reading Goal for {new Date().getFullYear()}</h3>
            <p className="text-sm text-muted-foreground">
              Challenge yourself to read more this year!
            </p>
            <Button onClick={() => setShowSetup(true)} data-testid="set-goal-cta">
              Set Reading Goal
            </Button>
          </div>
        </div>
        <ChallengeSetupModal
          open={showSetup}
          onClose={() => setShowSetup(false)}
          onSubmit={handleCreate}
          loading={loading}
        />
      </>
    );
  }

  const exceeded = challenge.booksCompleted >= challenge.goalBooks && challenge.goalBooks > 0;

  return (
    <div
      className="container mx-auto px-4 py-6"
      data-testid="challenge-widget"
    >
      <button
        onClick={() => navigate('/reading-challenge')}
        className="max-w-md mx-auto rounded-xl border bg-card p-5 space-y-3 w-full text-left hover:border-primary/50 transition-colors block"
        aria-label={`Reading challenge: ${challenge.booksCompleted} of ${challenge.goalBooks} books, ${challenge.percentComplete} percent complete`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            {exceeded ? (
              <Trophy className="h-5 w-5 text-amber-500" />
            ) : (
              <Target className="h-5 w-5 text-primary" />
            )}
            {new Date().getFullYear()} Reading Challenge
          </h3>
          <span className="text-sm text-muted-foreground">
            {challenge.percentComplete}%
          </span>
        </div>

        {/* Progress bar */}
        {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
        <div
          className="w-full bg-muted rounded-full h-3 overflow-hidden"
          role="progressbar"
          aria-valuenow={challenge.booksCompleted}
          aria-valuemin={0}
          aria-valuemax={challenge.goalBooks}
          aria-label={`${challenge.booksCompleted} of ${challenge.goalBooks} books read`}
        >
          {/* eslint-disable-next-line react/forbid-component-props */}
          <div
            className={`h-full rounded-full transition-all duration-500 ${exceeded ? 'bg-amber-500' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, challenge.percentComplete)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span>
            <span className="font-medium" data-testid="challenge-books-count">
              {challenge.booksCompleted}
            </span>
            {' '}of{' '}
            <span className="font-medium">{challenge.goalBooks}</span>
            {' '}books
          </span>
          <span className={`flex items-center gap-1 ${challenge.onTrack ? 'text-green-600' : 'text-orange-500'}`}>
            {challenge.onTrack ? (
              <><TrendingUp className="h-3.5 w-3.5" /> On track</>
            ) : (
              <><TrendingDown className="h-3.5 w-3.5" /> Behind</>
            )}
          </span>
        </div>
      </button>
    </div>
  );
}
