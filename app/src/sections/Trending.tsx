import { useRef } from 'react';
import { ChevronRight, Flame, Star, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatRating } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';
import { FlipBookCarouselCard } from '@/components/book/FlipBookCarouselCard';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

export function Trending() {
  const { books, loading } = useTrendingBooks(24);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  // Top 3 = spotlight cards. Carousel = next 20.
  const top3 = books.slice(0, 3);
  const carouselSource = books.slice(3, 23);
  const looped = carouselSource.length > 0 ? [...carouselSource, ...carouselSource] : [];

  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: carouselSource.length > 0,
    speed: 0.35,
  });

  const RANK_STYLES = [
    { badge: 'from-yellow-400 to-amber-500', ring: 'ring-amber-400/40', glow: 'hover:shadow-amber-400/20', label: '#1 Trending' },
    { badge: 'from-slate-300 to-slate-500', ring: 'ring-slate-400/30', glow: 'hover:shadow-slate-300/20', label: '#2' },
    { badge: 'from-orange-400 to-orange-600', ring: 'ring-orange-400/30', glow: 'hover:shadow-orange-400/20', label: '#3' },
  ];

  if (loading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map(i => <div key={i} className="aspect-[2/3] bg-muted rounded-2xl animate-pulse" />)}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px] aspect-[2/3] bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (top3.length === 0) return null;

  return (
    <section id="trending" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs mb-3">
              <Flame className="w-3 h-3 mr-1" /> Hot Right Now
            </Badge>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Trending Books</h2>
            <p className="text-muted-foreground mt-1 text-sm">What everyone is reading this week</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/trending">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        {/* Top 3 — compact horizontal leaderboard cards */}
        <div className="flex flex-col gap-3 mb-10">
          {top3.map((book, idx) => {
            const s = RANK_STYLES[idx];
            return (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.08, type: 'spring', stiffness: 90, damping: 18 }}
                className={`group relative flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-2xl border bg-card cursor-pointer hover:shadow-xl hover:-translate-y-0.5 ${s.glow} hover:border-primary/25 transition-all duration-300 overflow-hidden`}
                onClick={() => openBook(book)}
              >
                {/* Watermark rank number */}
                <span className="absolute right-2 sm:right-4 bottom-0 text-[72px] sm:text-[88px] font-black leading-none text-foreground/[0.04] select-none pointer-events-none">
                  {idx + 1}
                </span>

                {/* Rank circle */}
                <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${s.badge} flex items-center justify-center shadow-md z-10`}>
                  <span className="text-white font-black text-sm sm:text-base leading-none">{idx + 1}</span>
                </div>

                {/* Cover thumbnail */}
                <div className={`shrink-0 w-12 h-[72px] sm:w-14 sm:h-20 rounded-xl overflow-hidden shadow-md ring-1 ${s.ring} z-10`}>
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    onError={handleImgError}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 z-10">
                  <p className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 bg-gradient-to-r ${s.badge} bg-clip-text text-transparent`}>
                    {s.label}
                  </p>
                  <h4 className="font-serif font-bold text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">by {book.author}</p>

                  <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                    {book.googleRating ? (
                      <div className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        <span className="text-[11px] font-semibold">{formatRating(book.googleRating)}</span>
                        {book.ratingsCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">({book.ratingsCount.toLocaleString()})</span>
                        )}
                      </div>
                    ) : null}
                    {book.categories.slice(0, 2).map(c => (
                      <Badge key={c} variant="secondary" className="text-[9px] px-1.5 py-0 leading-4 h-4">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="shrink-0 h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-300 z-10" />
              </motion.div>
            );
          })}
        </div>

        {/* More Trending label */}
        {looped.length > 0 && (
          <div className="flex items-center gap-3 mb-4">
            <h3 className="font-serif text-lg sm:text-xl font-semibold tracking-tight">More Trending</h3>
            <div className="flex-1 h-px bg-border" />
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Carousel � constrained to container */}
      {looped.length > 0 && (
        <div className="container mx-auto px-4">
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div
              ref={scrollRef}
              className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2"
              onMouseEnter={() => { isPausedRef.current = true; }}
              onMouseLeave={() => { isPausedRef.current = false; }}
              onTouchStart={() => { isPausedRef.current = true; }}
              onTouchEnd={() => { isPausedRef.current = false; }}
            >
              {looped.map((book, index) => (
                <FlipBookCarouselCard
                  key={`${book.id}-${index}`}
                  book={book}
                  onBookClick={openBook}
                  rank={(index % carouselSource.length) + 4}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}