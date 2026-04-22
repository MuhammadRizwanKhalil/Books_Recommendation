import { useRef } from 'react';
import { ChevronRight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTopRated } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FlipBookCarouselCard } from '@/components/book/FlipBookCarouselCard';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

export function Top20Carousel() {
  const { books, loading } = useTopRated(20);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  // Pad or trim to exactly 20 for display purposes (loop must have exactly 20 unique)
  const exactBooks = books.slice(0, 20);
  const displayBooks = exactBooks.length > 0 ? [...exactBooks, ...exactBooks] : [];
  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: books.length > 0,
    speed: 0.4,
  });

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="h-8 w-48 bg-muted rounded animate-pulse" />
            <div className="h-4 w-72 bg-muted rounded animate-pulse mt-2" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px] sm:w-[150px]">
                <div className="aspect-[2/3] rounded-lg bg-muted animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (books.length === 0) return null;

  return (
    <section id="top-20" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
              <Trophy className="h-7 w-7 text-amber-500" />
              Top 20 Books
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">Highest rated across every genre</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/search?sort=rating">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>
      </div>

      <div className="container mx-auto px-4">
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
          >
            {displayBooks.map((book, idx) => (
              <FlipBookCarouselCard
                key={`${book.id}-${idx}`}
                book={book}
                onBookClick={openBook}
                rank={idx < exactBooks.length ? idx + 1 : undefined}
                widthClassName="w-[130px] sm:w-[150px]"
                highlightTopRank
              />
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 flex justify-center mt-6 sm:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/search?sort=rating">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}
