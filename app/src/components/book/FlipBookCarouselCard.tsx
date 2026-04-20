import { Star } from 'lucide-react';
import { formatPrice, formatRating } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';
import type { Book } from '@/types';

type FlipBookCarouselCardProps = {
  book: Book;
  onBookClick: (book: Book) => void;
  rank?: number;
  widthClassName?: string;
  highlightTopRank?: boolean;
  badgeText?: string;
};

export function FlipBookCarouselCard({
  book,
  onBookClick,
  rank,
  widthClassName = 'w-[120px] sm:w-[140px]',
  highlightTopRank = false,
  badgeText,
}: FlipBookCarouselCardProps) {
  return (
    <div
      className={`shrink-0 ${widthClassName} cursor-pointer group/flip [perspective:900px]`}
      onClick={() => onBookClick(book)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onBookClick(book);
        }
      }}
      aria-label={`Open ${book.title}`}
    >
      <div className="relative w-full aspect-[2/3] transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)] group-focus-within/flip:[transform:rotateY(180deg)]">
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-md group-hover/flip:shadow-xl transition-shadow [backface-visibility:hidden]">
          <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" loading="lazy" onError={handleImgError} />

          {badgeText && (
            <div className="absolute top-1.5 right-1.5">
              <span className="bg-emerald-500 text-white text-[8px] px-1.5 py-0 rounded-full">{badgeText}</span>
            </div>
          )}

          {rank && (
            <div className="absolute top-1.5 left-1.5">
              <div
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-md ${
                  highlightTopRank && rank <= 3
                    ? rank === 1
                      ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white'
                      : rank === 2
                        ? 'bg-white/90 text-gray-700'
                        : 'bg-amber-600/90 text-white'
                    : 'bg-black/60 backdrop-blur-sm text-white'
                }`}
              >
                #{rank}
              </div>
            </div>
          )}
        </div>

        <div className="absolute inset-0 rounded-lg overflow-hidden bg-card border shadow-lg p-2.5 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="space-y-1.5 overflow-hidden">
            <h4 className="font-bold text-xs line-clamp-2 leading-tight">{book.title}</h4>
            <p className="text-[10px] text-primary font-medium line-clamp-1">{book.author}</p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-2.5 w-2.5 ${
                    star <= Math.round(book.googleRating || 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
              <span className="text-[10px] font-medium ml-0.5">{formatRating(book.googleRating)}</span>
            </div>
            <p className="text-[9px] text-muted-foreground line-clamp-4 leading-relaxed">{book.description}</p>
          </div>

          <div className="flex items-center justify-between pt-1.5 border-t mt-1">
            {book.price ? (
              <span className="text-[10px] font-bold text-primary">{formatPrice(book.price, book.currency)}</span>
            ) : (
              <span />
            )}
            <span className="text-[9px] text-primary font-semibold">View →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
