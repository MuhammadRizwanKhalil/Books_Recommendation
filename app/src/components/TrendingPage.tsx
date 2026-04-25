import { useEffect, useRef, useState, useMemo } from 'react';
import { Flame, Star, Heart, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTrendingBooks, useTopRated } from '@/hooks/useBooks';
import { useSEO } from '@/hooks/useSEO';
import { formatRating } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';
import { wishlistApi } from '@/api/client';
import { useAuth } from '@/components/AuthProvider';
import type { Book } from '@/types';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

export function TrendingPage() {
  const { books, loading } = useTrendingBooks(21);
  const { books: topRatedBooks, loading: topRatedLoading } = useTopRated(20);
  const { isAuthenticated, openAuthModal } = useAuth();
  const [inWishlist, setInWishlist] = useState<Set<string>>(new Set());
  const [wishlistLoading, setWishlistLoading] = useState<Set<string>>(new Set());

  useSEO({
    title: 'Trending Books | The Book Times',
    description: 'Discover the hottest trending books right now based on real reader engagement, ratings, reviews, and community activity.',
    ogTitle: 'Trending Books | The Book Times',
    ogDescription: 'Discover books trending right now with real reader data and engagement metrics.',
    ogUrl: `${window.location.origin}/trending`,
    canonical: `${window.location.origin}/trending`,
  });

  const topBook = books.length > 0 ? books[0] : null;
  const displayBooks = books.slice(1, 21);

  useEffect(() => {
    if (!isAuthenticated) {
      setInWishlist(new Set());
      return;
    }

    let isMounted = true;

    const loadWishlist = async () => {
      try {
        const res = await wishlistApi.list();
        if (!isMounted) return;
        setInWishlist(new Set(res.items.map((item) => item.bookId)));
      } catch {
        // Keep page usable for guest users or when wishlist endpoint is unavailable.
      }
    };

    loadWishlist();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const toggleWishlist = async (bookId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      openAuthModal('signin');
      toast.info('Please sign in to add books to your wishlist.');
      return;
    }

    setWishlistLoading((prev) => new Set(prev).add(bookId));

    try {
      if (inWishlist.has(bookId)) {
        await wishlistApi.remove(bookId);
        setInWishlist((prev) => {
          const next = new Set(prev);
          next.delete(bookId);
          return next;
        });
        toast.success('Removed from wishlist');
      } else {
        await wishlistApi.add(bookId);
        setInWishlist((prev) => new Set(prev).add(bookId));
        toast.success('Added to wishlist');
      }
    } catch {
      toast.error('Failed to update wishlist');
    } finally {
      setWishlistLoading((prev) => {
        const next = new Set(prev);
        next.delete(bookId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* ==================== HERO SECTION ==================== */}
      {topBook && !loading && (
        <section className="relative overflow-hidden bg-gradient-to-b from-muted/40 to-background border-b">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -right-24 h-[55vw] w-[55vw] max-h-[28rem] max-w-[28rem] rounded-full bg-orange-500/10 blur-2xl sm:-top-40 sm:-right-40 sm:h-96 sm:w-96 sm:blur-3xl" />
            <div className="absolute top-24 -left-24 h-[48vw] w-[48vw] max-h-[22rem] max-w-[22rem] rounded-full bg-red-500/10 blur-2xl sm:top-32 sm:-left-40 sm:h-80 sm:w-80 sm:blur-3xl" />
          </div>

          <div className="relative container mx-auto px-4 py-12 sm:py-16 lg:py-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
              {/* Left Content */}
              <motion.div
                initial={{ opacity: 0, x: -40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col justify-start space-y-6"
              >
                <div>
                  <Badge className="mb-4 bg-gradient-to-r from-orange-500 to-red-500 text-white border-0">
                    <Flame className="w-3.5 h-3.5 mr-2" />
                    Live Trending Rankings
                  </Badge>
                  <h1 className="text-4xl md:text-5xl font-bold font-serif leading-tight mb-3">
                    Trending Books
                  </h1>
                  <p className="text-base md:text-lg text-muted-foreground font-medium leading-relaxed max-w-xl">
                    Discover what readers are actively opening, reviewing, wishlisting, and sharing right now. Updated with real engagement signals to keep results fresh and SEO-strong.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
                  Top pick at the moment: <span className="font-semibold text-foreground">{topBook.title}</span> by <span className="font-medium text-foreground">{topBook.author}</span>. Explore the complete top 20 below and jump straight into details.
                </p>

                {/* Real Stats */}
                <div className="grid grid-cols-3 gap-4 py-6 px-4 bg-muted/40 rounded-xl">
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold mb-1">Rating</p>
                    <div className="flex items-center gap-1">
                      <p className="text-2xl font-bold text-primary">{formatRating(topBook.googleRating)}</p>
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold mb-1">Reviews</p>
                    <p className="text-2xl font-bold text-primary">{(topBook.ratingsCount || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold mb-1">Category</p>
                    <p className="text-sm font-bold text-primary line-clamp-1">{topBook.categories?.[0] || 'General'}</p>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <Button asChild size="lg" className="flex-1 w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white border-0 shadow-lg">
                    <Link to={`/book/${topBook.slug || topBook.id}`}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      View Top Trending Book
                    </Link>
                  </Button>
                  <Button
                    size="lg"
                    variant={inWishlist.has(topBook.id) ? 'default' : 'outline'}
                    className={inWishlist.has(topBook.id) ? 'flex-1 bg-red-500 hover:bg-red-600 text-white' : 'flex-1 hover:border-primary hover:text-primary'}
                    onClick={(e) => toggleWishlist(topBook.id, e)}
                    disabled={wishlistLoading.has(topBook.id)}
                  >
                    <Heart className={`w-4 h-4 mr-2 ${inWishlist.has(topBook.id) ? 'fill-white' : ''}`} />
                    {wishlistLoading.has(topBook.id) ? 'Loading...' : inWishlist.has(topBook.id) ? 'In Wishlist' : 'Add to Wishlist'}
                  </Button>
                </div>
              </motion.div>

              {/* Right Image With Small Details */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
                className="relative flex flex-col items-center"
              >
                <div className="relative aspect-[2/3] w-full max-w-[240px] sm:max-w-[280px] mx-auto group">
                  <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-primary/5 rounded-2xl blur-xl sm:blur-2xl group-hover:blur-2xl sm:group-hover:blur-3xl transition-all duration-500" />
                  <div className="relative aspect-[2/3] overflow-hidden rounded-2xl shadow-2xl">
                    <img
                      src={topBook.coverImage || '/images/default-book-cover.svg'}
                      alt={topBook.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      onError={handleImgError}
                    />
                  </div>
                  <div className="absolute -top-4 -right-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full w-16 h-16 flex items-center justify-center font-bold text-xl shadow-lg">
                    #1
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* ==================== TRENDING BOOKS GRID ==================== */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold font-serif mb-2">Top 20 Trending Books</h2>
            <p className="text-muted-foreground text-sm">Books generating the most reader engagement and conversation</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <div className="aspect-[2/3] bg-muted animate-pulse rounded-xl" />
                  <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                  <div className="h-2 bg-muted animate-pulse rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : displayBooks.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">Loading trending books...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {displayBooks.map((book, idx) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '0px 0px -100px 0px' }}
                  transition={{ duration: 0.3, delay: idx * 0.02 }}
                >
                  <Card className="group relative h-full overflow-hidden rounded-xl border border-border/70 bg-card/90 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 py-0 gap-0">
                    <button
                      onClick={(e) => toggleWishlist(book.id, e)}
                      disabled={wishlistLoading.has(book.id)}
                      className="absolute left-2 top-2 z-20 rounded-full bg-background/85 p-1.5 shadow-sm backdrop-blur-sm transition hover:bg-background disabled:opacity-50"
                      title={inWishlist.has(book.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart className={`h-4 w-4 ${inWishlist.has(book.id) ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} />
                    </button>

                    <Link
                      to={`/book/${book.slug || book.id}`}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                        <img
                          src={book.coverImage || '/images/default-book-cover.svg'}
                          alt={`${book.title} by ${book.author}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          onError={handleImgError}
                        />

                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                        <div className="absolute top-2 right-2">
                          <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs font-bold">
                            #{idx + 2}
                          </Badge>
                        </div>

                        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                          {formatRating(book.googleRating)}
                        </div>
                      </div>

                      <CardContent className="space-y-1.5 p-3">
                        <p className="line-clamp-2 text-xs font-semibold leading-tight transition-colors group-hover:text-primary">
                          {book.title}
                        </p>
                        <p className="line-clamp-1 text-[11px] text-muted-foreground">
                          {book.author}
                        </p>
                        {book.categories?.[0] && (
                          <p className="line-clamp-1 text-[10px] font-medium text-primary/80">
                            {book.categories[0]}
                          </p>
                        )}
                      </CardContent>
                    </Link>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </section>

      {/* ==================== TOP 20 CAROUSEL ==================== */}
      {!topRatedLoading && topRatedBooks.length > 0 && (
        <section className="bg-muted/30 border-t border-b py-12 sm:py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="mb-8">
                <h2 className="text-2xl md:text-3xl font-bold font-serif mb-2">Top 20 Overall</h2>
                <p className="text-muted-foreground">Highest rated books on The Book Times</p>
              </div>

              <TopRatedCarousel books={topRatedBooks} />
            </motion.div>
          </div>
        </section>
      )}
    </div>
  );
}

function TopRatedCarousel({ books }: { books: Book[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const animationRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);

  const displayBooks = useMemo(() => (books.length > 0 ? [...books, ...books] : []), [books]);

  const normalizeScrollLeft = (element: HTMLDivElement, nextScrollLeft: number) => {
    const halfWidth = element.scrollWidth / 2;
    if (halfWidth <= 0) return nextScrollLeft;

    let normalized = nextScrollLeft;
    while (normalized < 0) normalized += halfWidth;
    while (normalized >= halfWidth) normalized -= halfWidth;

    return normalized;
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || books.length === 0) return;

    let lastTime = 0;

    const animate = (time: number) => {
      if (!pausedRef.current && !isDraggingRef.current && lastTime) {
        const delta = time - lastTime;
        const nextScrollLeft = element.scrollLeft + 0.55 * (delta / 16);
        element.scrollLeft = normalizeScrollLeft(element, nextScrollLeft);
      }

      lastTime = time;
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [books.length]);

  const startPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element) return;

    isDraggingRef.current = true;
    pausedRef.current = true;
    dragStartXRef.current = event.clientX;
    dragStartScrollRef.current = element.scrollLeft;
    element.setPointerCapture(event.pointerId);
  };

  const movePointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element || !isDraggingRef.current) return;

    const deltaX = event.clientX - dragStartXRef.current;
    const nextScrollLeft = dragStartScrollRef.current - deltaX;
    element.scrollLeft = normalizeScrollLeft(element, nextScrollLeft);
  };

  const endPointerDrag = () => {
    isDraggingRef.current = false;
    pausedRef.current = false;
  };

  if (books.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading top rated books...</p>;
  }

  return (
    <div
      ref={scrollRef}
      onPointerEnter={() => (pausedRef.current = true)}
      onPointerLeave={() => (pausedRef.current = false)}
      onPointerDown={startPointerDrag}
      onPointerMove={movePointerDrag}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      className="flex gap-3 overflow-hidden cursor-grab active:cursor-grabbing"
    >
      {displayBooks.map((book, idx) => (
        <Link
          key={`${book.id}-${idx}`}
          to={`/book/${book.slug || book.id}`}
          className="group/flip w-[138px] shrink-0 text-left sm:w-[156px] md:w-[168px] [perspective:1000px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open ${book.title}`}
        >
          <div className="relative aspect-[2/3] w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)] pointer-events-none">
            {/* Front: Cover */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl shadow-md [backface-visibility:hidden]">
              <img
                src={book.coverImage}
                alt={`${book.title} by ${book.author}`}
                className="h-full w-full object-cover"
                loading="lazy"
                onError={handleImgError}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white">
                <p className="line-clamp-2 text-xs font-semibold">{book.title}</p>
              </div>
            </div>

            {/* Back: Info */}
            <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-3 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div>
                <p className="line-clamp-2 text-xs font-semibold leading-snug">{book.title}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{book.author}</p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {formatRating(book.googleRating)}
                </p>
                {book.categories[0] && (
                  <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">{book.categories[0]}</p>
                )}
              </div>
              <p className="text-[11px] font-semibold text-primary">Tap to open</p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
