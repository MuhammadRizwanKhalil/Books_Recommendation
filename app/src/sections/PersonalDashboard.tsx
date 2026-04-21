import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  BookMarked,
  CheckCircle2,
  Clock,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/components/AuthProvider';
import { useReadingShelf } from '@/components/ReadingStatus';
import { readingChallengeApi, type ReadingChallengeResponse } from '@/api/client';
import { ChallengeSetupModal } from '@/components/ChallengeSetupModal';

/**
 * PersonalDashboard — single dashboard-style block that consolidates:
 * - Recently viewed (compact horizontal strip)
 * - Reading shelf snapshot (Want / Reading / Finished)
 * - Annual reading challenge (set up, in progress, or completed)
 *
 * Renders nothing for signed-out users.
 */
export function PersonalDashboard() {
  const navigate = useNavigate();
  const { isAuthenticated, readingHistory } = useAuth();
  const { wantToRead, reading, finished, total } = useReadingShelf();

  const [challenge, setChallenge] = useState<ReadingChallengeResponse | null>(null);
  const [checked, setChecked] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setChecked(true);
      return;
    }
    readingChallengeApi
      .get()
      .then(setChallenge)
      .catch(() => setChallenge(null))
      .finally(() => setChecked(true));
  }, [isAuthenticated]);

  if (!isAuthenticated || !checked) return null;

  // Don't show if user has no engagement at all (keeps page clean for brand-new users)
  const hasShelfActivity = total > 0;
  const hasHistory = readingHistory.length >= 1;
  if (!hasShelfActivity && !hasHistory && !challenge) return null;

  const handleCreate = async (goalBooks: number) => {
    setCreating(true);
    try {
      const created = await readingChallengeApi.create({ goalBooks });
      setChallenge(created);
      setShowSetup(false);
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const recent = readingHistory.slice(0, 6);
  const exceeded = !!challenge && challenge.booksCompleted >= challenge.goalBooks && challenge.goalBooks > 0;

  const shelfStats = [
    { label: 'Want to Read', value: wantToRead.length, icon: BookMarked },
    { label: 'Reading', value: reading.length, icon: BookOpen },
    { label: 'Finished', value: finished.length, icon: CheckCircle2 },
  ];

  return (
    <section
      id="dashboard"
      aria-labelledby="dashboard-title"
      className="py-10 sm:py-14 bg-muted/30 border-y border-border/50"
    >
      <div className="container mx-auto px-4">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mb-6 sm:mb-8 flex items-end justify-between gap-4"
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-primary/80">Your Library</p>
            <h2 id="dashboard-title" className="mt-1 font-serif text-2xl sm:text-3xl font-semibold tracking-tight">
              Welcome back
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-primary"
            onClick={() => navigate('/my-stats')}
          >
            Full stats
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </motion.header>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Reading shelf snapshot */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold tracking-tight">My Shelf</h3>
              <Link
                to="/owned-books"
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                Open
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {shelfStats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl bg-background border border-border/40 p-3 text-center"
                >
                  <s.icon className="mx-auto h-4 w-4 text-primary/80 mb-1.5" aria-hidden="true" />
                  <p className="text-xl font-semibold leading-none tabular-nums">{s.value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.article>

          {/* Reading challenge */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
          >
            {challenge ? (
              <button
                type="button"
                onClick={() => navigate('/reading-challenge')}
                className="w-full text-left"
                aria-label={`Reading challenge: ${challenge.booksCompleted} of ${challenge.goalBooks} books`}
                data-testid="challenge-widget"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {exceeded ? (
                      <Trophy className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Target className="h-4 w-4 text-primary" />
                    )}
                    {new Date().getFullYear()} Challenge
                  </h3>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {challenge.percentComplete}%
                  </span>
                </div>
                <Progress value={Math.min(100, challenge.percentComplete)} className="h-2" />
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums" data-testid="challenge-books-count">
                      {challenge.booksCompleted}
                    </span>
                    {' / '}
                    <span className="tabular-nums">{challenge.goalBooks}</span> books
                  </span>
                  <span
                    className={`flex items-center gap-1 font-medium ${
                      challenge.onTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {challenge.onTrack ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5" /> On track
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-3.5 w-3.5" /> Behind
                      </>
                    )}
                  </span>
                </div>
              </button>
            ) : (
              <div data-testid="challenge-widget-cta" className="flex h-full flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{new Date().getFullYear()} Reading Goal</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Set a yearly goal and we'll help you stay on track.
                </p>
                <Button size="sm" className="mt-auto" onClick={() => setShowSetup(true)} data-testid="set-goal-cta">
                  Set Reading Goal
                </Button>
              </div>
            )}
          </motion.article>

          {/* Recently viewed */}
          <motion.article
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm lg:col-span-1"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary/80" /> Recently Viewed
              </h3>
              {recent.length > 0 && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {recent.length} books
                </span>
              )}
            </div>
            {recent.length === 0 ? (
              <div className="rounded-xl bg-background border border-dashed border-border/60 p-4 text-center">
                <p className="text-xs text-muted-foreground">
                  Books you open will appear here for quick access.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 h-auto p-0 text-xs"
                  onClick={() => navigate('/trending')}
                >
                  Browse trending
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-6 sm:grid-cols-6 gap-2">
                {recent.map((entry, idx) => (
                  <Link
                    key={`${entry.bookId}-${idx}`}
                    to={`/book/${entry.bookSlug || entry.bookId}`}
                    className="group block aspect-[2/3] overflow-hidden rounded-md border border-border/40 bg-muted"
                    title={entry.bookTitle}
                  >
                    {entry.bookCover ? (
                      <img
                        src={entry.bookCover}
                        alt={entry.bookTitle}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base">📖</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </motion.article>
        </div>
      </div>

      <ChallengeSetupModal
        open={showSetup}
        onClose={() => setShowSetup(false)}
        onSubmit={handleCreate}
        loading={creating}
      />
    </section>
  );
}
