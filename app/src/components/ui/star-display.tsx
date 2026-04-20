import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarDisplayProps {
  rating: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5 sm:h-6 sm:w-6',
  lg: 'h-7 w-7',
};

/**
 * Renders a row of 5 stars with full, half, and empty states.
 * Supports decimal ratings (e.g. 3.5 → ★★★½☆).
 */
export function StarDisplay({ rating, size = 'md', className }: StarDisplayProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.25 && rating % 1 < 0.75;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  const sizeClass = sizeClasses[size];

  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: fullStars }).map((_, i) => (
        <Star key={`f-${i}`} className={cn(sizeClass, 'fill-yellow-400 text-yellow-400')} />
      ))}
      {hasHalfStar && (
        <div className={cn('relative', sizeClass)} key="half">
          <Star className={cn(sizeClass, 'text-gray-300 absolute inset-0')} />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className={cn(sizeClass, 'fill-yellow-400 text-yellow-400')} />
          </div>
        </div>
      )}
      {Array.from({ length: Math.max(0, emptyStars) }).map((_, i) => (
        <Star key={`e-${i}`} className={cn(sizeClass, 'text-gray-300')} />
      ))}
    </div>
  );
}
