import { useRef } from 'react';
import { TrendingUp, ChevronRight, Flame, Star, ArrowRight } from 'lucide-react';
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
  const { books, loading } = useTrendingBooks(14);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  const [hero, ...rest] = books;
  const sideBooks = rest.slice(0, 3);
  const carouselBooks = rest.slice(3);
  const displayCarousel = carouselBooks.length > 0 ? [...carouselBooks, ...carouselBooks] : [];

  useAutoScrollLoop({ containerRef: scrollRef, pauseRef: isPausedRef, enabled: carouselBooks.length > 0, speed: 0.3 });

  if (loading) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="aspect-[3/4] bg-muted rounded-2xl animate-pulse" />
            <div className="space-y-4">
              {[1, 2, 3].map(i => <div key={i} className="h-28 bg-muted rounded-xl animate-pulse" />)}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!hero) return null;

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
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Trending Books</h2>
            <p className="text-muted-foreground mt-1">What everyone is reading this week</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/trending">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        {/* Magazine Layout: Hero left + 3 side cards right */}
        <div className="grid md:grid-cols-5 gap-6 mb-10">
          {/* Hero Card */}
          <motion.div
            className="md:col-span-3 group cursor-pointer relative overflow-hidden rounded-2xl bg-card border shadow-lg hover:shadow-xl transition-all duration-500"
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            onClick={() => openBook(hero)}
          >
            <div className="flex flex-col sm:flex-row h-full">
              <div className="relative sm:w-2/5 aspect-[2/3] sm:aspect-auto overflow-hidden">
                <img
                  src={hero.coverImage}
                  alt={`${hero.title} by ${hero.author}`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="eager"
                  onError={handleImgError}
                />
                <Badge className="absolute top-3 left-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 shadow-lg">
                  #1 Trending
                </Badge>
              </div>
              <div className="p-6 flex flex-col justify-center flex-1 gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {hero.categories.slice(0, 3).map(c => (
                    <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                  ))}
                </div>
                <h3 className="text-xl sm:text-2xl font-bold leading-tight group-hover:text-primary transition-colors">{hero.title}</h3>
                <p className="text-sm text-muted-foreground">by <span className="text-foreground font-medium">{hero.author}</span></p>
                {hero.googleRating && (
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="font-semibold">{formatRating(hero.googleRating)}</span>
                    <span className="text-xs text-muted-foreground">({hero.ratingsCount.toLocaleString()})</span>
                  </div>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                  {hero.description?.replace(/<[^>]*>/g, '').slice(0, 200)}
                </p>
                <Button size="sm" className="w-fit mt-1 gap-2">
                  View Details <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Side Cards */}
          <div className="md:col-span-2 flex flex-col gap-4">
            {sideBooks.map((book, idx) => (
              <motion.div
                key={book.id}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="group flex gap-4 p-3 rounded-xl border bg-card hover:shadow-lg hover:border-primary/20 cursor-pointer transition-all duration-300"
                onClick={() => openBook(book)}
              >
                <div className="relative w-16 flex-shrink-0">
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="w-full aspect-[2/3] object-cover rounded-lg"
                    loading="lazy"
                    onError={handleImgError}
                  />
                  <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow">
                    {idx + 2}
                  </div>
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                  <h4 className="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">{book.title}</h4>
                  <p className="text-xs text-muted-foreground">{book.author}</p>
                  {book.googleRating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="text-xs font-medium">{formatRating(book.googleRating)}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            <Button variant="outline" size="sm" className="mt-auto" asChild>
              <Link to="/trending">See All Trending <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>

        {/* Auto-scroll carousel for remaining trending */}
        {displayCarousel.length > 0 && (
          <div className="relative">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
            <div
              ref={scrollRef}
              className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1"
              onMouseEnter={() => { isPausedRef.current = true; }}
              onMouseLeave={() => { isPausedRef.current = false; }}
              onTouchStart={() => { isPausedRef.current = true; }}
              onTouchEnd={() => { isPausedRef.current = false; }}
            >
              {displayCarousel.map((book, index) => (
                <FlipBookCarouselCard
                  key={`${book.id}-${index}`}
                  book={book}
                  onBookClick={openBook}
                  rank={index < carouselBooks.length ? index + 5 : undefined}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
