import { useState, useCallback, useRef } from 'react';
import { Star } from 'lucide-react';
import { ratingApi } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InlineRatingWidgetProps {
  bookSlug: string;
  userRating?: number | null;
  onRate?: (rating: number) => void;
}

function getRatingFromMouseEvent(e: React.MouseEvent<HTMLButtonElement>, starIndex: number): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const isLeftHalf = x < rect.width / 2;
  return isLeftHalf ? starIndex - 0.5 : starIndex;
}

function formatRatingLabel(rating: number): string {
  if (rating % 1 === 0) return `${rating}`;
  return `${rating}`;
}

export function InlineRatingWidget({ bookSlug, userRating, onRate }: InlineRatingWidgetProps) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [currentRating, setCurrentRating] = useState<number | null>(userRating ?? null);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleRate = useCallback(async (rating: number) => {
    if (!isAuthenticated) {
      openAuthModal('signin');
      return;
    }
    if (submitting) return;

    const previousRating = currentRating;
    setCurrentRating(rating);
    setSubmitting(true);

    try {
      await ratingApi.rate(bookSlug, rating);
      toast.success('Rated!', { duration: 1500 });
      onRate?.(rating);
    } catch {
      setCurrentRating(previousRating);
      toast.error('Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  }, [bookSlug, isAuthenticated, openAuthModal, submitting, currentRating, onRate]);

  const displayRating = hoverRating || currentRating || 0;

  if (!isAuthenticated) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-muted-foreground"
        data-testid="inline-rating-widget"
      >
        <button
          onClick={() => openAuthModal('signin')}
          className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
          data-testid="sign-in-to-rate"
        >
          <Star className="h-4 w-4" />
          <span>Sign in to rate</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2"
      data-testid="inline-rating-widget"
    >
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label="Rate this book"
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          const isChecked = currentRating != null && currentRating >= star - 0.5 && currentRating <= star;
          return (
            <button
              key={star}
              role="radio"
              aria-checked={isChecked}
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              data-testid={`rating-star-${star}`}
              className={cn(
                'relative p-0.5 rounded transition-transform cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                submitting && 'pointer-events-none opacity-70',
              )}
              disabled={submitting}
              onClick={(e) => {
                const r = getRatingFromMouseEvent(e, star);
                handleRate(r);
              }}
              onMouseMove={(e) => {
                const r = getRatingFromMouseEvent(e, star);
                setHoverRating(r);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  const next = Math.min(5, (hoverRating || currentRating || 0) + 0.5);
                  setHoverRating(next);
                  const nextStar = Math.ceil(next);
                  const nextBtn = e.currentTarget.parentElement?.querySelector(`[data-testid="rating-star-${nextStar}"]`) as HTMLElement;
                  nextBtn?.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const prev = Math.max(0.5, (hoverRating || currentRating || 1) - 0.5);
                  setHoverRating(prev);
                  const prevStar = Math.ceil(prev);
                  const prevBtn = e.currentTarget.parentElement?.querySelector(`[data-testid="rating-star-${prevStar}"]`) as HTMLElement;
                  prevBtn?.focus();
                } else if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (hoverRating > 0) handleRate(hoverRating);
                }
              }}
            >
              <Star className="h-5 w-5 sm:h-6 sm:w-6 text-gray-300" />
              {star <= displayRating && (
                <Star className="absolute inset-0 m-[2px] h-5 w-5 fill-yellow-400 text-yellow-400 sm:h-6 sm:w-6" />
              )}
              {star > displayRating && star - 0.5 <= displayRating && displayRating > 0 && (
                <div className="absolute inset-0 m-[2px] w-1/2 overflow-hidden">
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 sm:h-6 sm:w-6" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {currentRating ? (
        <span className="text-sm font-medium" data-testid="your-rating-label">
          Your rating: {formatRatingLabel(currentRating)}★
        </span>
      ) : (
        <span className="text-sm text-muted-foreground" data-testid="rate-prompt-label">
          Rate this book
        </span>
      )}
    </div>
  );
}
