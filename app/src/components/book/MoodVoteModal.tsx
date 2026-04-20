import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { moodApi, type MoodItem, type BookMoodEntry, type BookMoodsResponse } from '@/api/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface MoodVoteModalProps {
  bookId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentMoods: BookMoodEntry[];
  onVoteComplete: (updated: BookMoodsResponse) => void;
}

export function MoodVoteModal({
  bookId,
  open,
  onOpenChange,
  currentMoods,
  onVoteComplete,
}: MoodVoteModalProps) {
  const [allMoods, setAllMoods] = useState<MoodItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [loadingMoods, setLoadingMoods] = useState(false);

  // Load all moods when modal opens
  useEffect(() => {
    if (open && allMoods.length === 0) {
      setLoadingMoods(true);
      moodApi.getAll()
        .then(setAllMoods)
        .catch(() => toast.error('Failed to load moods'))
        .finally(() => setLoadingMoods(false));
    }
  }, [open, allMoods.length]);

  // Pre-select user's current votes when modal opens
  useEffect(() => {
    if (open) {
      const userVoted = currentMoods.filter(m => m.userVoted).map(m => m.id);
      setSelected(new Set(userVoted));
    }
  }, [open, currentMoods]);

  const toggleMood = useCallback((moodId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(moodId)) {
        next.delete(moodId);
      } else if (next.size < 5) {
        next.add(moodId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0) {
      toast.error('Select at least one mood');
      return;
    }
    setSubmitting(true);
    try {
      const result = await moodApi.vote(bookId, Array.from(selected));
      onVoteComplete(result);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit votes');
    } finally {
      setSubmitting(false);
    }
  }, [bookId, selected, onVoteComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" data-testid="mood-vote-modal">
        <DialogHeader>
          <DialogTitle>Vote on Moods</DialogTitle>
          <DialogDescription>
            What moods does this book evoke? Select up to 5.
          </DialogDescription>
        </DialogHeader>

        {loadingMoods ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-4" role="group" aria-label="Mood selection">
            {allMoods.map((mood) => {
              const isSelected = selected.has(mood.id);
              const isDisabled = !isSelected && selected.size >= 5;

              return (
                <button
                  key={mood.id}
                  onClick={() => toggleMood(mood.id)}
                  disabled={isDisabled}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-muted-foreground/40',
                    isDisabled && 'opacity-40 cursor-not-allowed'
                  )}
                  aria-label={`${mood.name}${isSelected ? ', selected' : ', not selected'}`}
                  data-testid={`mood-option-${mood.slug}`}
                >
                  <span aria-hidden="true">{mood.emoji}</span>
                  <span>{mood.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground" data-testid="mood-count">
            {selected.size} of 5 selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || selected.size === 0}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Saving...</>
              ) : (
                'Submit Votes'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
