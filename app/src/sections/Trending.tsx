import { useRef, useEffect } from 'react';
import { TrendingUp, ChevronRight, ChevronLeft, Flame, Star, ExternalLink, Eye, BookOpen, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatRating, truncateText } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';

export function Trending() {
  const { books, loading } = useTrendingBooks(14);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);
  const trendingBadge = getSetting('trending_badge', 'Hot Right Now');
  const trendingDescription = getSetting('trending_description', 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.');

  const moreTrendingBooks = books.slice(1);
  const displayMoreTrending = moreTrendingBooks.length > 0 ? [...moreTrendingBooks, ...moreTrendingBooks] : [];

  // Auto-scroll for More Trending
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || moreTrendingBooks.length === 0) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isPausedRef.current && lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += 0.3 * (delta / 16);
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
  }, [moreTrendingBooks.length]);

  return (
    <section id="trending" className="py-8 sm:py-10 md:py-12 bg-gradient-to-b from-muted/60 via-muted/30 to-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs px-3 py-1">
                <Flame className="w-3 h-3 mr-1" />
                {trendingBadge}
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Updated hourly
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              {t('trending.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{trendingDescription}</p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/trending">
              View All Trending <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Featured #1 — Book of the Day style card */}
        {!loading && books.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card className="overflow-hidden border-primary/10 shadow-xl hover:shadow-2xl transition-all duration-500 group">
              <div className="flex flex-col md:flex-row">
                {/* Cover - with border radius and left spacing */}
                <Link to={`/book/${books[0].slug}`} className="relative md:w-56 shrink-0 aspect-[2/3] md:aspect-auto md:min-h-[300px] overflow-hidden md:m-4 md:rounded-xl">
                  <img
                    src={books[0].coverImage}
                    alt={books[0].title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 md:rounded-xl"
                    loading="lazy"
                    onError={handleImgError}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-transparent md:rounded-xl" />
                  <Badge className="absolute top-4 left-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-xs px-2.5 py-0.5 shadow-lg">
                    🔥 {t('trending.numberOne')}
                  </Badge>
                </Link>
                {/* Details */}
                <div className="p-5 sm:p-6 md:p-7 flex flex-col justify-center flex-1 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {books[0].categories.slice(0, 4).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px] px-2 py-0.5">{cat}</Badge>
                    ))}
                  </div>
                  <div>
                    <Link to={`/book/${books[0].slug}`} className="hover:text-primary transition-colors">
                      <h3 className="text-xl sm:text-2xl font-bold font-serif leading-tight">{books[0].title}</h3>
                    </Link>
                    <p className="text-sm font-medium mt-1.5">{t('common.by')} <span className="text-primary">{books[0].author}</span></p>
                  </div>
                  {/* Rating */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-4 w-4 ${i < Math.round(books[0].googleRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`} />
                      ))}
                    </div>
                    <span className="text-sm font-bold">{formatRating(books[0].googleRating)}</span>
                    <span className="text-xs text-muted-foreground">({books[0].ratingsCount.toLocaleString()} ratings)</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {truncateText(books[0].description, 250)}
                  </p>
                  {/* Page count + categories */}
                  <div className="flex flex-wrap items-center gap-2">
                    {(books[0].pageCount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        <BookOpen className="h-3 w-3 mr-1" />{books[0].pageCount} pages
                      </Badge>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <Button size="default" className="h-9 px-5 shadow-md shadow-primary/20" onClick={() => openBook(books[0])}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
                    </Button>
                    {books[0].amazonUrl && (
                      <Button variant="outline" className="h-9 px-4" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <a href={books[0].amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                          Amazon <ExternalLink className="ml-1.5 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* More Trending — auto-scrolling infinite loop */}
        {!loading && books.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">More Trending</h3>
            </div>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-muted/60 to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-muted/60 to-transparent z-10 pointer-events-none" />
              <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mb-2 px-1"
                onMouseEnter={() => { isPausedRef.current = true; }}
                onMouseLeave={() => { isPausedRef.current = false; }}
                onTouchStart={() => { isPausedRef.current = true; }}
                onTouchEnd={() => { isPausedRef.current = false; }}
                style={{ scrollBehavior: 'auto' }}
              >
                {displayMoreTrending.map((book, index) => (
                  <div
                    key={`${book.id}-${index}`}
                    className="shrink-0 w-[120px] sm:w-[140px] cursor-pointer group/card"
                    onClick={() => openBook(book)}
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        loading="lazy"
                        onError={handleImgError}
                      />
                      {/* Hover overlay with details */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                        <h4 className="text-white text-xs font-bold line-clamp-2 leading-tight mb-1">{book.title}</h4>
                        <p className="text-white/70 text-[10px] line-clamp-1 mb-1">{book.author}</p>
                        <div className="flex items-center gap-1">
                          <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                          <span className="text-white text-[10px] font-bold">{formatRating(book.googleRating)}</span>
                          <span className="text-white/50 text-[9px]">({book.ratingsCount?.toLocaleString()})</span>
                        </div>
                      </div>
                      {/* Rank badge */}
                      {index < moreTrendingBooks.length && (
                        <div className="absolute top-1.5 left-1.5">
                          <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                            #{index + 2}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  );
}
