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
    <div className="space-y-2" data-testid="pace-indicator-section">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Gauge className="h-4 w-4" />
          Pacing
          {totalVotes > 0 && (
            <span className="text-xs font-normal normal-case">
              ({totalVotes} vote{totalVotes !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
      </div>

      {totalVotes === 0 ? (
        <p className="text-sm text-muted-foreground italic" data-testid="pace-empty">
          {user
            ? 'No pace data yet — be the first to vote!'
            : 'No pace data yet. Sign in to vote!'}
        </p>
      ) : (
        <div
          className="flex rounded-full overflow-hidden h-6 bg-muted"
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
                  'relative flex items-center justify-center text-white text-xs font-medium transition-all cursor-pointer',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  config.bgClass,
                  !user && 'cursor-default',
                  userVote === pace && `ring-2 ring-offset-1 ${config.activeClass}`,
                )}
                style={{ flex: segment.percentage }}
                aria-label={`${config.label}: ${segment.percentage}% (${segment.votes} votes)${userVote === pace ? ', your vote' : ''}`}
                data-testid={`pace-segment-${pace}`}
                title={`${config.label}: ${segment.percentage}% (${segment.votes} votes)`}
              >
                <span className="truncate px-1">
                  {segment.percentage >= 15 && (
                    <>{config.emoji} {segment.percentage}%</>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Legend + vote buttons for empty/low-vote scenarios or direct voting */}
      <div className="flex justify-between text-xs text-muted-foreground" data-testid="pace-legend">
        {(['slow', 'medium', 'fast'] as PaceValue[]).map((pace) => {
          const config = PACE_CONFIG[pace];
          const segment = pace === 'slow' ? slow : pace === 'medium' ? medium : fast;
          return (
            <button
              key={pace}
              onClick={() => user && handleVote(pace)}
              disabled={!user || voting}
              className={cn(
                'flex items-center gap-1 py-1 px-2 rounded-md transition-colors',
                user && 'hover:bg-muted cursor-pointer',
                !user && 'cursor-default',
                userVote === pace && 'font-semibold text-foreground bg-muted',
              )}
              aria-label={`Vote ${config.label}${userVote === pace ? ' (your vote)' : ''}`}
              data-testid={`pace-label-${pace}`}
            >
              <span
                className={cn('w-2 h-2 rounded-full', config.bgClass)}
                aria-hidden="true"
              />
              {config.emoji} {config.label}
              {totalVotes > 0 && <span className="ml-0.5">{segment.percentage}%</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
