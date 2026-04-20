import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Trophy, TrendingUp, TrendingDown, Pencil, Share2, BookOpen, Sparkles, PartyPopper } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { readingChallengeApi, type ReadingChallengeResponse } from '@/api/client';
import { ChallengeSetupModal } from './ChallengeSetupModal';
import { useSEO } from '@/hooks/useSEO';

export function ReadingChallengePage() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState<ReadingChallengeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEdit, setIsEdit] = useState(false);

  useSEO({
    title: 'Reading Challenge - The Book Times',
    description: `Track your ${new Date().getFullYear()} reading goal. Set a target and see your progress!`,
    ogTitle: 'Reading Challenge - The Book Times',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    readingChallengeApi.get()
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleCreate = async (goalBooks: number) => {
    setSaving(true);
    try {
      const created = await readingChallengeApi.create({ goalBooks });
      setChallenge(created);
      setShowSetup(false);
      toast.success('Reading challenge created!');
    } catch (err: any) {
      toast.error(err?.body?.error || 'Failed to create challenge');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (goalBooks: number) => {
    if (!challenge) return;
    setSaving(true);
    try {
      const updated = await readingChallengeApi.update(challenge.id, { goalBooks });
      setChallenge(updated);
      setShowSetup(false);
      setIsEdit(false);
      toast.success('Reading goal updated!');
    } catch (err: any) {
      toast.error(err?.body?.error || 'Failed to update challenge');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = async () => {
    if (!challenge) return;
    const text = challenge.booksCompleted >= challenge.goalBooks
      ? `I completed my ${challenge.year} reading challenge! ${challenge.booksCompleted} books read on The Book Times!`
      : `I've read ${challenge.booksCompleted} of ${challenge.goalBooks} books in my ${challenge.year} reading challenge on The Book Times!`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My Reading Challenge', text, url: window.location.href });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard!');
    }
  };

  // Unauthenticated
  if (!isAuthenticated) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 text-center space-y-4" data-testid="challenge-auth-required">
          <Target className="h-12 w-12 text-primary mx-auto" />
          <h1 className="text-3xl font-bold">Reading Challenge</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Sign in to set your annual reading goal and track your progress.
          </p>
          <Button onClick={() => openAuthModal('signin')} data-testid="challenge-signin-btn">
            Sign In to Get Started
          </Button>
        </div>
      </main>
    );
  }

  // Loading
  if (loading) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </main>
    );
  }

  // No challenge — show setup
  if (!challenge) {
    return (
      <main className="pt-16">
        <div className="container mx-auto px-4 py-16 text-center space-y-6" data-testid="challenge-empty-state">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Target className="h-16 w-16 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold">{new Date().getFullYear()} Reading Challenge</h1>
            <p className="text-muted-foreground max-w-md mx-auto mt-3">
              Challenge yourself to read more this year! Set a goal and we'll track your progress.
            </p>
          </motion.div>
          <Button size="lg" onClick={() => setShowSetup(true)} data-testid="set-goal-btn">
            <Target className="h-4 w-4 mr-2" />
            Set Reading Goal
          </Button>
          <ChallengeSetupModal
            open={showSetup}
            onClose={() => setShowSetup(false)}
            onSubmit={handleCreate}
            loading={saving}
          />
        </div>
      </main>
    );
  }

  // Has challenge — show full page
  const exceeded = challenge.booksCompleted >= challenge.goalBooks && challenge.goalBooks > 0;
  const progressPercent = Math.min(100, challenge.percentComplete);

  // Motivational message
  let motivationMessage = '';
  let MotivationIcon = TrendingUp;
  if (exceeded) {
    motivationMessage = `Congratulations! You've exceeded your goal by ${challenge.booksCompleted - challenge.goalBooks} books!`;
    MotivationIcon = PartyPopper;
  } else if (challenge.booksCompleted === 0) {
    motivationMessage = 'Start your journey — pick up your first book!';
    MotivationIcon = BookOpen;
  } else if (challenge.onTrack) {
    if (challenge.booksAhead > 0) {
      motivationMessage = `You're ${challenge.booksAhead} book${challenge.booksAhead > 1 ? 's' : ''} ahead of schedule!`;
      MotivationIcon = Sparkles;
    } else {
      motivationMessage = "You're right on track — keep it up!";
      MotivationIcon = TrendingUp;
    }
  } else {
    motivationMessage = `You're ${Math.abs(challenge.booksAhead)} book${Math.abs(challenge.booksAhead) > 1 ? 's' : ''} behind schedule. You can catch up!`;
    MotivationIcon = TrendingDown;
  }

  return (
    <main className="pt-16">
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8" data-testid="reading-challenge-page">
        {/* Header */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {exceeded ? (
              <Trophy className="h-12 w-12 text-amber-500 mx-auto" />
            ) : (
              <Target className="h-12 w-12 text-primary mx-auto" />
            )}
          </motion.div>
          <h1 className="text-3xl font-bold">{challenge.year} Reading Challenge</h1>
        </div>

        {/* Progress section */}
        <div className="rounded-xl border bg-card p-6 space-y-5" data-testid="challenge-progress-card">
          {/* Big number */}
          <div className="text-center">
            <p className="text-5xl font-bold" data-testid="challenge-progress-label">
              {challenge.booksCompleted}
              <span className="text-2xl text-muted-foreground font-normal"> of {challenge.goalBooks}</span>
            </p>
            <p className="text-muted-foreground mt-1" aria-label={`${challenge.booksCompleted} of ${challenge.goalBooks} books, ${challenge.percentComplete} percent complete`}>
              ({challenge.percentComplete}%)
            </p>
          </div>

          {/* Progress bar */}
          {/* eslint-disable-next-line jsx-a11y/aria-proptypes */}
          <div
            className="w-full bg-muted rounded-full h-4 overflow-hidden"
            role="progressbar"
            aria-valuenow={challenge.booksCompleted}
            aria-valuemin={0}
            aria-valuemax={challenge.goalBooks}
            aria-label={`Reading challenge: ${challenge.booksCompleted} of ${challenge.goalBooks} books, ${challenge.percentComplete} percent complete`}
            data-testid="challenge-progress-bar"
          >
            <motion.div
              className={`h-full rounded-full ${exceeded ? 'bg-amber-500' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {/* Motivation message */}
          <div
            className={`flex items-center justify-center gap-2 text-sm font-medium ${
              exceeded ? 'text-amber-600' : challenge.onTrack ? 'text-green-600' : 'text-orange-500'
            }`}
            data-testid="challenge-motivation"
          >
            <MotivationIcon className="h-4 w-4" />
            {motivationMessage}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            <div className="text-center">
              <div className="text-2xl font-bold">{challenge.projectedTotal}</div>
              <div className="text-xs text-muted-foreground">Projected Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{challenge.booksAhead >= 0 ? '+' : ''}{challenge.booksAhead}</div>
              <div className="text-xs text-muted-foreground">vs Schedule</div>
            </div>
            <div className="text-center col-span-2 sm:col-span-1">
              <div className="text-2xl font-bold">{challenge.goalBooks - challenge.booksCompleted > 0 ? challenge.goalBooks - challenge.booksCompleted : 0}</div>
              <div className="text-xs text-muted-foreground">Books Remaining</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setIsEdit(true); setShowSetup(true); }}
              data-testid="edit-goal-btn"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit Goal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              data-testid="share-challenge-btn"
            >
              <Share2 className="h-3.5 w-3.5 mr-1.5" />
              Share
            </Button>
          </div>
        </div>

        {/* Recently completed books */}
        {challenge.recentBooks.length > 0 && (
          <div className="space-y-4" data-testid="challenge-recent-books">
            <h2 className="text-xl font-semibold">Books Completed This Year</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {challenge.recentBooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => navigate(`/book/${book.slug}`)}
                  className="rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors text-left"
                  data-testid="challenge-book-card"
                >
                  {book.coverImage ? (
                    <img
                      src={book.coverImage}
                      alt={book.title}
                      className="w-full aspect-[2/3] object-cover rounded-md mb-2"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-muted rounded-md mb-2 flex items-center justify-center">
                      <BookOpen className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <p className="text-sm font-medium line-clamp-2">{book.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(book.finishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty books state */}
        {challenge.booksCompleted === 0 && (
          <div className="text-center py-8 rounded-xl border bg-card" data-testid="challenge-no-books">
            <BookOpen className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No books finished yet this year.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Mark a book as "Finished" to start tracking your progress!
            </p>
          </div>
        )}

        {/* Setup / Edit modal */}
        <ChallengeSetupModal
          open={showSetup}
          onClose={() => { setShowSetup(false); setIsEdit(false); }}
          onSubmit={isEdit ? handleUpdate : handleCreate}
          loading={saving}
          defaultGoal={isEdit && challenge ? challenge.goalBooks : undefined}
          isEdit={isEdit}
        />
      </div>
    </main>
  );
}
