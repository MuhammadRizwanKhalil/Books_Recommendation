/**
 * GenreOnboardingModal
 *
 * Shown once after a user registers. They pick 3-8 genres they love.
 * This seeds the collaborative filtering model immediately so "For You" 
 * recommendations are personalized from day one — without waiting for 
 * browsing history to accumulate.
 *
 * Usage:
 *   <GenreOnboardingModal open={!onboardingCompleted} onComplete={() => setDone(true)} />
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Check, ArrowRight, BookOpen } from 'lucide-react';
import { apiClient } from '@/api/client';

// Genre list with emojis — matches our expanded category map
const GENRES = [
  { slug: 'fiction',           label: 'Fiction',             emoji: '📚' },
  { slug: 'fantasy',           label: 'Fantasy',             emoji: '🔮' },
  { slug: 'science-fiction',   label: 'Sci-Fi',              emoji: '🚀' },
  { slug: 'mystery-thriller',  label: 'Mystery & Thriller',  emoji: '🔍' },
  { slug: 'romance',           label: 'Romance',             emoji: '❤️' },
  { slug: 'horror',            label: 'Horror',              emoji: '👻' },
  { slug: 'historical-fiction',label: 'Historical Fiction',  emoji: '⚔️' },
  { slug: 'young-adult',       label: 'Young Adult',         emoji: '🎒' },
  { slug: 'adventure',         label: 'Adventure',           emoji: '🌍' },
  { slug: 'biography',         label: 'Biography',           emoji: '🧑' },
  { slug: 'true-crime',        label: 'True Crime',          emoji: '🚔' },
  { slug: 'self-help',         label: 'Self-Help',           emoji: '💪' },
  { slug: 'business',          label: 'Business',            emoji: '💼' },
  { slug: 'technology',        label: 'Technology',          emoji: '💻' },
  { slug: 'science',           label: 'Science',             emoji: '🔬' },
  { slug: 'history',           label: 'History',             emoji: '🏛️' },
  { slug: 'psychology',        label: 'Psychology',          emoji: '🧠' },
  { slug: 'philosophy',        label: 'Philosophy',          emoji: '💭' },
  { slug: 'health-wellness',   label: 'Health & Wellness',   emoji: '🌿' },
  { slug: 'cooking',           label: 'Cooking',             emoji: '🍳' },
];

interface Props {
  open: boolean;
  onComplete: () => void;
}

export function GenreOnboardingModal({ open, onComplete }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<'pick' | 'done'>('pick');

  // Reset when modal opens
  useEffect(() => {
    if (open) {
      setSelected([]);
      setStep('pick');
    }
  }, [open]);

  const toggleGenre = (slug: string) => {
    setSelected(prev => {
      if (prev.includes(slug)) {
        return prev.filter(s => s !== slug);
      }
      if (prev.length >= 8) return prev; // max 8
      return [...prev, slug];
    });
  };

  const handleSave = async () => {
    if (selected.length < 3) return;
    setSaving(true);
    try {
      // Save genre preferences
      await apiClient.post('/genre-preferences', { categoryIds: selected, source: 'onboarding' });
      // Mark onboarding complete
      await apiClient.post('/genre-preferences/complete');
      setStep('done');
      setTimeout(() => onComplete(), 1500);
    } catch (err) {
      console.error('Failed to save genre preferences', err);
      // Non-blocking — complete onboarding anyway
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    try {
      await apiClient.post('/genre-preferences/complete');
    } catch {}
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleSkip(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {step === 'pick' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <DialogTitle className="text-xl">What do you love to read?</DialogTitle>
              </div>
              <DialogDescription>
                Pick at least 3 genres and we'll personalise your recommendations from day one.
                You can always change this later in your settings.
              </DialogDescription>
            </DialogHeader>

            {/* Genre Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 my-4">
              {GENRES.map(genre => {
                const isSelected = selected.includes(genre.slug);
                return (
                  <button
                    key={genre.slug}
                    onClick={() => toggleGenre(genre.slug)}
                    className={`
                      relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all
                      text-sm font-medium cursor-pointer select-none
                      ${isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                    `}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    <span className="text-2xl">{genre.emoji}</span>
                    <span className="text-center leading-tight">{genre.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Selection count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {selected.length === 0
                  ? 'Select at least 3 genres'
                  : selected.length < 3
                    ? `${3 - selected.length} more to go...`
                    : `${selected.length} selected ${selected.length >= 8 ? '(max)' : '— keep going!'}`}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip for now
                </Button>
                <Button
                  size="sm"
                  disabled={selected.length < 3 || saving}
                  onClick={handleSave}
                  className="gap-2"
                >
                  {saving ? 'Saving...' : 'Get My Picks'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Success state */
          <div className="flex flex-col items-center text-center py-8 gap-4">
            <div className="p-4 rounded-full bg-emerald-500/10">
              <BookOpen className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold">You're all set!</h3>
            <p className="text-muted-foreground max-w-xs">
              Your personalised reading list is ready. Head to{' '}
              <span className="text-primary font-medium">For You</span> to see your picks.
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {selected.slice(0, 5).map(slug => {
                const g = GENRES.find(g => g.slug === slug);
                return g ? (
                  <Badge key={slug} variant="secondary" className="gap-1">
                    {g.emoji} {g.label}
                  </Badge>
                ) : null;
              })}
              {selected.length > 5 && (
                <Badge variant="secondary">+{selected.length - 5} more</Badge>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
