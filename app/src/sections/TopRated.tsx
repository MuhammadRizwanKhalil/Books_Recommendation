import { useRef } from 'react';
import { Star, ChevronRight, Trophy, Medal, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTopRated } from '@/hooks/useBooks';
import { formatRating } from '@/lib/utils';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { handleImgError } from '@/lib/imageUtils';
import { FlipBookCarouselCard } from '@/components/book/FlipBookCarouselCard';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

const RANK_STYLES = [
  { bg: 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white', icon: Trophy, ring: 'ring-yellow-400/40' },
  { bg: 'bg-white/90 text-gray-700 dark:bg-gray-800 dark:text-gray-200', icon: Medal, ring: 'ring-gray-300/40' },
  { bg: 'bg-gradient-to-r from-amber-600 to-orange-600 text-white', icon: Award, ring: 'ring-amber-400/40' },
];

export function TopRated() {
  const { books, loading } = useTopRated(20);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  const carouselBooks = books.length > 3 ? books.slice(3) : [];
  const displayBooks = carouselBooks.length > 0 ? [...carouselBooks, ...carouselBooks] : [];

  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: carouselBooks.length > 0,
    speed: 0.4,
  });

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px]"><div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" /></div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="top-rated" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Top Rated</h2>
            <p className="text-muted-foreground mt-1">Highest rated by our community of readers</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/search?sort=rating">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        {/* Top 3 Podium */}
        {books.length >= 3 && (
          <motion.div
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
          >
            <div className="grid grid-cols-3 gap-3 sm:gap-5 max-w-2xl mx-auto items-end">
              {[1, 0, 2].map((bookIdx, posIdx) => {
                const book = books[bookIdx];
                const style = RANK_STYLES[bookIdx];
                const Icon = style.icon;
                const isCenter = posIdx === 1;
                return (
                  <div key={book.id} className={isCenter ? '' : 'mt-6 sm:mt-8'}>
                    <button
                      className={`relative w-full group cursor-pointer`}
                      onClick={() => openBook(book)}
                    >
                      <div className={`relative aspect-[2/3] rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 ring-2 ${style.ring}`}>
                        <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" onError={handleImgError} />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                          <h4 className="text-white text-sm font-bold line-clamp-2 leading-tight">{book.title}</h4>
                          <p className="text-white/70 text-xs mt-0.5">{book.author}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-white text-xs font-bold">{formatRating(book.googleRating)}</span>
                          </div>
                        </div>
                        <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold shadow-md ${style.bg}`}>
                          <Icon className="h-3 w-3" />
                          <span>#{bookIdx + 1}</span>
                        </div>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Auto-scroll carousel for #4–20 */}
      {displayBooks.length > 0 && (
        <div className="container mx-auto px-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">#4 – #{carouselBooks.length + 3} &middot; Hover to flip</p>
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
                  rank={idx < carouselBooks.length ? idx + 4 : undefined}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-center mt-6 sm:hidden">
        <Button variant="outline" size="sm" asChild>
          <Link to="/search?sort=rating">View All Top Rated <ChevronRight className="ml-1 h-4 w-4" /></Link>
        </Button>
      </div>
    </section>
  );
}
