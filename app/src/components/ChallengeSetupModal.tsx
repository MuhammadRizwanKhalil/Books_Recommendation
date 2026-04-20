import { useState } from 'react';
import { Target, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ChallengeSetupModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (goalBooks: number) => void;
  loading?: boolean;
  defaultGoal?: number;
  isEdit?: boolean;
}

const SUGGESTED_GOALS = [
  { value: 12, label: '12 books', description: '1 per month' },
  { value: 24, label: '24 books', description: '2 per month' },
  { value: 52, label: '52 books', description: '1 per week' },
];

export function ChallengeSetupModal({ open, onClose, onSubmit, loading, defaultGoal, isEdit }: ChallengeSetupModalProps) {
  const [goal, setGoal] = useState<number>(defaultGoal || 12);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal >= 1 && goal <= 999) {
      onSubmit(goal);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      data-testid="challenge-setup-overlay"
    >
      <div
        className="bg-card border rounded-xl p-6 w-96 max-w-[90vw] shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
        data-testid="challenge-setup-modal"
        role="dialog"
        aria-labelledby="challenge-setup-title"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 id="challenge-setup-title" className="text-lg font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            {isEdit ? 'Edit Reading Goal' : 'Set Reading Goal'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          How many books do you want to read in {new Date().getFullYear()}?
        </p>

        {/* Suggested goals */}
        <div className="grid grid-cols-3 gap-2">
          {SUGGESTED_GOALS.map((sg) => (
            <button
              key={sg.value}
              type="button"
              onClick={() => setGoal(sg.value)}
              className={cn(
                'rounded-lg border p-3 text-center transition-colors hover:bg-accent',
                goal === sg.value && 'border-primary bg-primary/5 ring-1 ring-primary'
              )}
              data-testid={`goal-suggestion-${sg.value}`}
            >
              <div className="font-semibold text-lg">{sg.value}</div>
              <div className="text-xs text-muted-foreground">{sg.description}</div>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="goal-input" className="text-sm font-medium">
              Custom goal
            </label>
            <input
              id="goal-input"
              type="number"
              min={1}
              max={999}
              value={goal}
              onChange={(e) => {
                const v = parseInt(e.target.value);
                if (!isNaN(v)) setGoal(Math.min(999, Math.max(1, v)));
              }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="goal-input"
              aria-label="Number of books to read"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || goal < 1 || goal > 999} data-testid="challenge-submit-btn">
              {loading ? 'Saving...' : isEdit ? 'Update Goal' : 'Start Challenge'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
