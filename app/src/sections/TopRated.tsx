import { useRef, useEffect } from 'react';
import { Star, ChevronRight, Trophy, Medal, Award, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTopRated } from '@/hooks/useBooks';
import { formatRating } from '@/lib/utils';
import { useAppNav } from '@/App';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { handleImgError } from '@/lib/imageUtils';

export function TopRated() {
  const { books, loading } = useTopRated(20);
  const { openBook } = useAppNav();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);

  const carouselBooks = books.length > 3 ? books.slice(3) : [];
  const displayBooks = carouselBooks.length > 0 ? [...carouselBooks, ...carouselBooks] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || carouselBooks.length === 0) return;

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
  }, [carouselBooks.length]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-3.5 w-3.5 text-yellow-500" />;
      case 1: return <Medal className="h-3.5 w-3.5 text-gray-400" />;
      case 2: return <Award className="h-3.5 w-3.5 text-amber-600" />;
      default: return null;
    }
  };

  return (
    <section id="top-rated" className="py-8 sm:py-10 md:py-12 bg-gradient-to-b from-muted/50 via-muted/30 to-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-0 text-xs px-3 py-1">
                <Star className="w-3 h-3 mr-1 fill-current" />
                {t('topRated.badge')}
              </Badge>
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30 bg-yellow-500/5">
                <Trophy className="w-3 h-3 mr-1" />
                Community Favorites
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <Star className="h-7 w-7 text-yellow-500 fill-yellow-500" />
              {t('topRated.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{t('topRated.subtitle')}</p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/search?sort=rating">
              View All Top Rated <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Top 3 — smaller with hover overlay */}
        {!loading && books.length >= 3 && (
          <motion.div
            className="mt-6 mb-6"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="grid grid-cols-3 gap-3 sm:gap-4 max-w-2xl mx-auto">
              {[1, 0, 2].map((bookIdx, posIdx) => {
                const book = books[bookIdx];
                const isFirst = bookIdx === 0;
                return (
                  <div key={book.id} className={posIdx === 1 ? '-mt-2 sm:-mt-4' : 'mt-2 sm:mt-4'}>
                    <div
                      className="relative cursor-pointer group/top"
                      onClick={() => openBook(book)}
                    >
                      <div className={`relative aspect-[2/3] rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 ${isFirst ? 'ring-2 ring-yellow-500/30' : ''}`}>
                        <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover transition-transform duration-700 group-hover/top:scale-105" loading="lazy" onError={handleImgError} />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover/top:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5 sm:p-3">
                          <h4 className="text-white text-xs sm:text-sm font-bold line-clamp-2 leading-tight mb-1">{book.title}</h4>
                          <p className="text-white/70 text-[10px] sm:text-xs line-clamp-1 mb-1">{book.author}</p>
                          <div className="flex items-center gap-1">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star key={s} className={`h-2.5 w-2.5 ${s <= Math.round(book.googleRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-white/30'}`} />
                              ))}
                            </div>
                            <span className="text-white text-[10px] font-bold ml-0.5">{formatRating(book.googleRating)}</span>
                          </div>
                        </div>
                        {/* Rank badge */}
                        <div className="absolute top-2 left-2">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md ${
                            bookIdx === 0 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                            bookIdx === 1 ? 'bg-white/90 text-gray-700' :
                            'bg-amber-600/90 text-white'
                          }`}>
                            {getRankIcon(bookIdx)}
                            <span>#{bookIdx + 1}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Top 20 Auto-scrolling Carousel — contained */}
      {!loading && displayBooks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="container mx-auto px-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top 20 — hover to reveal</h3>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/50 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/50 to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
            style={{ scrollBehavior: 'auto' }}
          >
            {displayBooks.map((book, idx) => (
              <div
                key={`${book.id}-${idx}`}
                className="shrink-0 w-[120px] sm:w-[140px] cursor-pointer group/card"
                onClick={() => openBook(book)}
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                  <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105" loading="lazy" onError={handleImgError} />
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                    <h4 className="text-white text-xs font-bold line-clamp-2 leading-tight mb-1">{book.title}</h4>
                    <p className="text-white/70 text-[10px] line-clamp-1 mb-1">{book.author}</p>
                    <div className="flex items-center gap-1">
                      <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                      <span className="text-white text-[10px] font-bold">{formatRating(book.googleRating)}</span>
                    </div>
                  </div>
                  {/* Rank badge for top items */}
                  {idx < carouselBooks.length && (
                    <div className="absolute top-1.5 left-1.5">
                      <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        #{idx + 4}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="container mx-auto px-4">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

    </section>
  );
}
