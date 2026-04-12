import { useRef } from 'react';
import { TrendingUp, ChevronRight, ChevronLeft, Flame, Star, ExternalLink, Eye, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatRating } from '@/lib/utils';

export function Trending() {
  const { books, loading } = useTrendingBooks(14);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const trendingBadge = getSetting('trending_badge', 'Hot Right Now');
  const trendingDescription = getSetting('trending_description', 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.');

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };

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

        {/* Featured #1 — compact spotlight card */}
        {!loading && books.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              className="overflow-hidden border-primary/10 shadow-lg hover:shadow-xl transition-all duration-500 cursor-pointer group"
              onClick={() => openBook(books[0])}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}
            >
              <div className="flex flex-col sm:flex-row">
                {/* Cover */}
                <div className="relative sm:w-28 shrink-0 aspect-[2/3] sm:aspect-auto sm:min-h-[150px] overflow-hidden">
                  <img src={books[0].coverImage} alt={books[0].title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-xs px-2.5 py-0.5 shadow-lg">
                    🔥 {t('trending.numberOne')}
                  </Badge>
                </div>
                {/* Content */}
                <CardContent className="flex-1 p-3 sm:p-4 flex flex-col justify-center space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {books[0].categories.slice(0, 3).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px] px-2 py-0.5">{cat}</Badge>
                    ))}
                  </div>
                  <h3 className="text-base sm:text-lg font-bold font-serif group-hover:text-primary transition-colors leading-tight line-clamp-2">{books[0].title}</h3>
                  <p className="text-xs font-medium text-muted-foreground">{t('common.by')} <span className="text-foreground">{books[0].author}</span></p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-1 hidden sm:block">{books[0].description}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="flex items-center gap-1">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < Math.round(books[0].googleRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`} />
                        ))}
                      </div>
                      <span className="font-bold text-xs">{formatRating(books[0].googleRating)}</span>
                      <span className="text-[10px] text-muted-foreground">({books[0].ratingsCount.toLocaleString()})</span>
                    </div>
                    {(books[0].pageCount ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BookOpen className="h-3 w-3" />
                        {books[0].pageCount}p
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" className="h-7 px-3 text-xs shadow-sm" onClick={(e) => { e.stopPropagation(); openBook(books[0]); }}>
                      <Eye className="mr-1 h-3 w-3" /> View Details
                    </Button>
                    {books[0].amazonUrl && (
                      <Button size="sm" variant="outline" className="h-7 px-3 text-xs" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <a href={books[0].amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                          Amazon <ExternalLink className="ml-1 h-2.5 w-2.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        )}

        {/* More Trending — single row horizontal scroll with hover overlay */}
        {!loading && books.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">More Trending</h3>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll('left')}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll('right')}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
              <div
                ref={scrollRef}
                className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mb-2 px-1"
                style={{ scrollSnapType: 'x mandatory' }}
              >
                {books.slice(1).map((book, index) => (
                  <div
                    key={book.id}
                    className="shrink-0 w-[120px] sm:w-[140px] cursor-pointer group/card"
                    style={{ scrollSnapAlign: 'start' }}
                    onClick={() => openBook(book)}
                  >
                    <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                        loading="lazy"
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
                      <div className="absolute top-1.5 left-1.5">
                        <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          #{index + 2}
                        </div>
                      </div>
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

        {/* View All CTA */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button variant="outline" size="sm" asChild className="px-6">
            <Link to="/trending">
              View All Trending Books <ChevronRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
