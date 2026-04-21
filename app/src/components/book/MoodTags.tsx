import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { moodApi, type BookMoodEntry, type BookMoodsResponse } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { MoodVoteModal } from './MoodVoteModal';

interface MoodTagsProps {
  bookId: string;
  compact?: boolean;
}

export function MoodTags({ bookId, compact = false }: MoodTagsProps) {
  const { user } = useAuth();
  const [data, setData] = useState<BookMoodsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [voteModalOpen, setVoteModalOpen] = useState(false);

  const fetchMoods = useCallback(async () => {
    try {
      const result = await moodApi.getForBook(bookId);
      setData(result);
    } catch {
      // Silent fail — moods section is optional
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    fetchMoods();
  }, [fetchMoods]);

  const handleVoteComplete = useCallback((updated: BookMoodsResponse) => {
    setData(updated);
    setVoteModalOpen(false);
    toast.success('Mood votes updated!');
  }, []);

  if (loading) return null;

  const moods = data?.moods || [];
  const totalVotes = data?.totalVotes || 0;
  const displayedMoods = expanded ? moods : moods.slice(0, 5);
  const hasMore = moods.length > 5;

  // Compact inline variant — no card, no header, just a tight pill row
  if (compact) {
    if (moods.length === 0) return null;
    const topMoods = moods.slice(0, 4);
    return (
      <div className="flex items-center gap-1.5 flex-wrap" data-testid="mood-tags-compact">
        <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Smile className="h-3 w-3" />
          Moods
        </span>
        {topMoods.map((mood) => (
          <span
            key={mood.id}
            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
            data-testid={`mood-pill-compact-${mood.slug}`}
          >
            <span aria-hidden>{mood.emoji}</span>
            <span className="font-medium">{mood.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">{mood.percentage}%</span>
          </span>
        ))}
        {moods.length > topMoods.length && (
          <span className="text-[11px] text-muted-foreground">+{moods.length - topMoods.length}</span>
        )}
        {totalVotes > 0 && (
          <span className="text-[11px] text-muted-foreground">· {totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border bg-gradient-to-br from-rose-50/60 via-background to-amber-50/40 dark:from-rose-950/20 dark:via-background dark:to-amber-950/20 p-4 sm:p-5 space-y-4"
      data-testid="mood-tags-section"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <Smile className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-semibold leading-tight">Reader Moods</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalVotes > 0
                ? `${totalVotes} vote${totalVotes !== 1 ? 's' : ''} from readers`
                : 'How does this book feel?'}
            </p>
          </div>
        </div>
        {user ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVoteModalOpen(true)}
            className="h-8 shrink-0"
            data-testid="mood-vote-button"
          >
            Vote
          </Button>
        ) : null}
      </div>

      {moods.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="mood-empty">
          {user
            ? 'Be the first to add moods — tap Vote above.'
            : 'No moods yet. Sign in to be the first to tag this book.'}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" aria-label="Book moods">
            <AnimatePresence mode="popLayout">
              {displayedMoods.map((mood) => (
                <MoodPill key={mood.id} mood={mood} />
              ))}
            </AnimatePresence>
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              data-testid="mood-show-all"
            >
              {expanded ? (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Show all {moods.length} moods <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}
        </>
      )}

      <MoodVoteModal
        bookId={bookId}
        open={voteModalOpen}
        onOpenChange={setVoteModalOpen}
        currentMoods={moods}
        onVoteComplete={handleVoteComplete}
      />
    </div>
  );
}

function MoodPill({ mood }: { mood: BookMoodEntry }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative overflow-hidden rounded-full border bg-background/80 backdrop-blur px-3 py-1.5 text-sm flex items-center gap-1.5 select-none min-w-fit shadow-sm"
      aria-label={`${mood.name} ${mood.percentage}%${mood.userVoted ? ', you voted' : ''}`}
      data-testid={`mood-pill-${mood.slug}`}
    >
      {/* Percentage background bar */}
      <div
        className="absolute inset-y-0 left-0 opacity-25 rounded-full transition-all duration-500"
        style={{
          width: `${mood.percentage}%`,
          background: `linear-gradient(90deg, ${mood.color}, ${mood.color}aa)`,
        }}
      />
      <span className="relative z-10 text-base leading-none" aria-hidden="true">{mood.emoji}</span>
      <span className="relative z-10 font-medium">{mood.name}</span>
      <span className="relative z-10 text-[11px] font-semibold text-muted-foreground tabular-nums">{mood.percentage}%</span>
      {mood.userVoted && (
        <span
          className="relative z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground"
          data-testid="mood-user-voted"
        >
          ✓ You
        </span>
      )}
    </motion.div>
  );
}
