import { useRef, useEffect } from 'react';
import { TrendingUp, Star } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopRated } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { formatRating, formatPrice } from '@/lib/utils';
import type { Book } from '@/types';

export function Top20Carousel() {
  const { books, loading } = useTopRated(20);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || books.length === 0) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isPausedRef.current && lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += 0.4 * (delta / 16);
        const halfWidth = el.scrollWidth / 2;
        if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }
      lastTime = time;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [books.length]);

  if (loading) {
    return (
      <section className="py-6 sm:py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Top 20 Books</h2>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <Skeleton className="aspect-[2/3] rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (books.length === 0) return null;

  return (
    <section className="py-6 sm:py-8 md:py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-bold">Top 20 Books</h2>
            <p className="text-xs text-muted-foreground">Highest rated across all categories</p>
          </div>
        </div>
      </div>

      {/* Full-width auto-scrolling carousel */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
        onTouchStart={() => { isPausedRef.current = true; }}
        onTouchEnd={() => { isPausedRef.current = false; }}
        style={{ scrollBehavior: 'auto' }}
      >
        {displayBooks.map((book, idx) => (
          <FlipCard key={`${book.id}-${idx}`} book={book} onBookClick={openBook} />
        ))}
      </div>
    </section>
  );
}

function FlipCard({ book, onBookClick }: { book: Book; onBookClick: (b: Book) => void }) {
  return (
    <div
      className="shrink-0 w-[120px] sm:w-[140px] cursor-pointer group/flip"
      style={{ perspective: '800px' }}
      onClick={() => onBookClick(book)}
    >
      <div className="relative w-full aspect-[2/3] transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)]">
        {/* Front */}
        <div className="absolute inset-0 rounded-lg overflow-hidden shadow-md [backface-visibility:hidden]">
          <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" loading="lazy" />
        </div>
        {/* Back */}
        <div className="absolute inset-0 rounded-lg overflow-hidden bg-card border shadow-md p-2.5 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="space-y-1 overflow-hidden">
            <h4 className="font-bold text-[11px] line-clamp-2 leading-tight">{book.title}</h4>
            <p className="text-[10px] text-muted-foreground">{book.author}</p>
            <div className="flex items-center gap-0.5">
              <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-medium">{formatRating(book.googleRating)}</span>
            </div>
            <p className="text-[9px] text-muted-foreground line-clamp-3 leading-relaxed">{book.description}</p>
          </div>
          <div className="flex items-center justify-between pt-1 border-t mt-1">
            {book.price ? (
              <span className="text-[10px] font-bold text-primary">{formatPrice(book.price, book.currency)}</span>
            ) : <span />}
            <span className="text-[9px] text-primary font-medium">View →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
