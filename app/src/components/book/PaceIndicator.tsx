import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Gauge } from 'lucide-react';
import { paceApi, type PaceResponse, type PaceValue } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface PaceIndicatorProps {
  bookId: string;
}

const PACE_CONFIG: Record<PaceValue, { label: string; emoji: string; color: string; bgClass: string; activeClass: string }> = {
  slow: { label: 'Slow', emoji: '🐢', color: '#3B82F6', bgClass: 'bg-blue-500', activeClass: 'ring-blue-500' },
  medium: { label: 'Medium', emoji: '🚶', color: '#EAB308', bgClass: 'bg-yellow-500', activeClass: 'ring-yellow-500' },
  fast: { label: 'Fast', emoji: '🚀', color: '#EF4444', bgClass: 'bg-red-500', activeClass: 'ring-red-500' },
};

export function PaceIndicator({ bookId }: PaceIndicatorProps) {
  const { user } = useAuth();
  const [data, setData] = useState<PaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const fetchPace = useCallback(async () => {
    try {
      const result = await paceApi.getForBook(bookId);
      setData(result);
    } catch {
      // Silent — pace section is optional
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchPace();
  }, [fetchPace]);

  const handleVote = useCallback(async (pace: PaceValue) => {
    if (!user) return;
    if (voting) return;

    // Optimistic update
    const prev = data;
    if (data) {
      const updated = { ...data };
      // If re-clicking same vote, remove it
      if (data.userVote === pace) {
        setVoting(true);
        try {
          await paceApi.removeVote(bookId);
          await fetchPace();
        } catch {
          setData(prev);
          toast.error('Failed to remove vote');
        } finally {
          setVoting(false);
        }
        return;
      }
      setData({ ...updated, userVote: pace });
    }

    setVoting(true);
    try {
      const result = await paceApi.vote(bookId, pace);
      setData(result);
    } catch {
      setData(prev);
      toast.error('Failed to submit pace vote');
    } finally {
      setVoting(false);
    }
  }, [user, voting, data, bookId, fetchPace]);

  if (loading) return null;

  const totalVotes = data?.totalVotes || 0;
  const slow = data?.slow || { votes: 0, percentage: 0 };
  const medium = data?.medium || { votes: 0, percentage: 0 };
  const fast = data?.fast || { votes: 0, percentage: 0 };
  const userVote = data?.userVote || null;

  return (
    <div
      className="rounded-2xl border bg-gradient-to-br from-sky-50/60 via-background to-violet-50/40 dark:from-sky-950/20 dark:via-background dark:to-violet-950/20 p-4 sm:p-5 space-y-4"
      data-testid="pace-indicator-section"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
            <Gauge className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Reading Pace</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalVotes > 0
                ? `${totalVotes} reader${totalVotes !== 1 ? 's' : ''} weighed in`
                : 'How fast does it read?'}
            </p>
          </div>
        </div>
      </div>

      {totalVotes === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground text-center" data-testid="pace-empty">
          {user
            ? 'No pace data yet — tap a pace below to be the first to vote.'
            : 'No pace data yet. Sign in to vote.'}
        </div>
      ) : (
        <div
          className="flex rounded-full overflow-hidden h-9 bg-muted shadow-inner"
          role="group"
          aria-label={`Pace: ${slow.percentage}% slow, ${medium.percentage}% medium, ${fast.percentage}% fast`}
          data-testid="pace-bar"
        >
          {(['slow', 'medium', 'fast'] as PaceValue[]).map((pace) => {
            const segment = pace === 'slow' ? slow : pace === 'medium' ? medium : fast;
            const config = PACE_CONFIG[pace];
            if (segment.percentage === 0) return null;

            return (
              <motion.button
                key={pace}
                initial={false}
                animate={{ flex: segment.percentage }}
                transition={{ duration: 0.4 }}
                onClick={() => user && handleVote(pace)}
                disabled={!user || voting}
                className={cn(
                  'relative flex items-center justify-center gap-1.5 text-white text-xs font-semibold transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  config.bgClass,
                  user ? 'cursor-pointer hover:brightness-110' : 'cursor-default',
                  userVote === pace && `ring-2 ring-offset-2 ring-offset-background ${config.activeClass}`,
                )}
                style={{ flex: segment.percentage }}
                aria-label={`${config.label}: ${segment.percentage}% (${segment.votes} votes)${userVote === pace ? ', your vote' : ''}`}
                data-testid={`pace-segment-${pace}`}
                title={`${config.label}: ${segment.percentage}% (${segment.votes} votes)`}
              >
                {segment.percentage >= 12 && (
                  <span className="truncate px-1.5 inline-flex items-center gap-1">
                    <span aria-hidden>{config.emoji}</span>
                    <span className="tabular-nums">{segment.percentage}%</span>
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Legend / vote chips */}
      <div className="grid grid-cols-3 gap-2" data-testid="pace-legend">
        {(['slow', 'medium', 'fast'] as PaceValue[]).map((pace) => {
          const config = PACE_CONFIG[pace];
          const segment = pace === 'slow' ? slow : pace === 'medium' ? medium : fast;
          const isActive = userVote === pace;
          return (
            <button
              key={pace}
              onClick={() => user && handleVote(pace)}
              disabled={!user || voting}
              className={cn(
                'group flex flex-col items-center gap-1 rounded-xl border bg-background px-2 py-2.5 transition-all',
                user && 'hover:border-foreground/30 hover:shadow-sm cursor-pointer',
                !user && 'cursor-default opacity-90',
                isActive && 'border-foreground/40 ring-2 ring-offset-1 shadow-sm',
                isActive && config.activeClass,
              )}
              aria-label={`Vote ${config.label}${isActive ? ' (your vote)' : ''}`}
              data-testid={`pace-label-${pace}`}
            >
              <span className="text-lg leading-none" aria-hidden>{config.emoji}</span>
              <span className="text-xs font-semibold">{config.label}</span>
              {totalVotes > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">{segment.percentage}%</span>
              )}
              {isActive && (
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Your vote</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
