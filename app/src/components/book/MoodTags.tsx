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
}

export function MoodTags({ bookId }: MoodTagsProps) {
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

  return (
    <div className="space-y-3" data-testid="mood-tags-section">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Smile className="h-4 w-4" />
          Moods
          {totalVotes > 0 && (
            <span className="text-xs font-normal normal-case">
              ({totalVotes} vote{totalVotes !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        {user ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVoteModalOpen(true)}
            className="text-xs h-7"
            data-testid="mood-vote-button"
          >
            Vote on moods
          </Button>
        ) : null}
      </div>

      {moods.length === 0 ? (
        <p className="text-sm text-muted-foreground italic" data-testid="mood-empty">
          {user
            ? 'Be the first to add moods — click "Vote on moods" above!'
            : 'No moods yet. Sign in to be the first to tag this book!'}
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
              className="text-xs text-primary hover:underline flex items-center gap-1"
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
      className="relative overflow-hidden rounded-full border border-border px-3 py-1.5 text-sm flex items-center gap-1.5 select-none min-w-fit"
      aria-label={`${mood.name} ${mood.percentage}%${mood.userVoted ? ', you voted' : ''}`}
      data-testid={`mood-pill-${mood.slug}`}
    >
      {/* Percentage background bar */}
      <div
        className={`absolute inset-y-0 left-0 opacity-15 rounded-full transition-all duration-500`}
        style={{
          width: `${mood.percentage}%`,
          backgroundColor: mood.color,
        }}
      />
      <span className="relative z-10" aria-hidden="true">{mood.emoji}</span>
      <span className="relative z-10 font-medium">{mood.name}</span>
      <span className="relative z-10 text-xs text-muted-foreground">{mood.percentage}%</span>
      {mood.userVoted && (
        <span
          className="relative z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary"
          data-testid="mood-user-voted"
        >
          You voted
        </span>
      )}
    </motion.div>
  );
}
