import { useState, useRef } from 'react';
import { ChevronRight, Clock, Zap, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewReleases } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FlipBookCarouselCard } from '@/components/book/FlipBookCarouselCard';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

const PERIODS = [
  { label: 'This Week', value: 'this-week', icon: Zap },
  { label: 'Last Week', value: 'last-week', icon: Clock },
  { label: 'This Month', value: 'this-month', icon: Calendar },
  { label: 'Last Month', value: 'last-month', icon: Calendar },
];

export function NewReleases() {
  const [activePeriod, setActivePeriod] = useState('this-week');
  const { books, loading } = useNewReleases(16, activePeriod);
  const { openBook } = useAppNav();

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];
  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: books.length > 0,
    speed: 0.35,
  });

  return (
    <section id="new-releases" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Live Updates
              </Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">New Releases</h2>
            <p className="text-muted-foreground mt-1">Fresh arrivals added daily from Google Books</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/search?sort=newest">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        {/* Period Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide mb-6">
          {PERIODS.map((period) => (
            <button
              key={period.value}
              onClick={() => setActivePeriod(period.value)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                activePeriod === period.value
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              <period.icon className="h-3 w-3" />
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4">
        {loading ? (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px]">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        ) : books.length > 0 ? (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
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
                  badgeText="NEW"
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No books found for this period.</p>
        )}
      </div>
    </section>
  );
}
