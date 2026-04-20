import { useRef } from 'react';
import { TrendingUp, Crown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

  const displayBooks = books.length > 0 ? [...books, ...books] : [];
  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: books.length > 0,
    speed: 0.4,
  });

  if (loading) {
    return (
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Top 20 Books</h2>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px] sm:w-[150px]">
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
    <section className="py-8 sm:py-10 md:py-14 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 text-xs px-3 py-1">
                <Crown className="w-3 h-3 mr-1" />
                Editor's Choice
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              Top 20 Books
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">Highest rated across all categories — hover to reveal details</p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/search?sort=rating">
              View All Rated <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Contained auto-scrolling carousel */}
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
            rank={idx < books.length ? idx + 1 : undefined}
            widthClassName="w-[130px] sm:w-[150px]"
            highlightTopRank
          />
        ))}
          </div>
        </div>
      </div>
    </section>
  );
}
