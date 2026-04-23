import { useEffect, useMemo, useRef, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Layers3,
  Mail,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/components/AuthProvider';
import { useAppNav } from '@/App';
import { analyticsApi, newsletterApi } from '@/api/client';
import { useBlogPosts, useCategories, useNewReleases, useTopRated, useTrendingBooks } from '@/hooks/useBooks';
import { handleImgError } from '@/lib/imageUtils';
import { formatDate, formatRating, truncateText } from '@/lib/utils';
import type { BlogPost, Book, Category } from '@/types';

type PopularTerm = { query: string; count: number };

type HomeAction = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  requiresAuth?: boolean;
};

const HOME_ACTIONS: HomeAction[] = [
  { label: 'For You', description: 'Personalized picks', href: '/for-you', icon: Sparkles, requiresAuth: true },
  { label: 'Trending', description: 'What is hot this week', href: '/trending', icon: Flame },
  { label: 'Mood Match', description: 'Pick by your current mood', href: '/discover/mood', icon: BrainCircuit },
  { label: 'Categories', description: 'Explore by genre', href: '/categories', icon: Layers3 },
  { label: 'Compare', description: 'Side by side decisions', href: '/compare', icon: Compass },
  { label: 'Search', description: 'Find any title quickly', href: '/search', icon: Search },
];

function InfiniteFlipBookCarousel({
  books,
  loading,
  onOpenBook,
  emptyMessage = 'Books are loading. Please check back in a moment.',
}: {
  books: Book[];
  loading: boolean;
  onOpenBook: (book: Book) => void;
  emptyMessage?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const animationRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const dragDistanceRef = useRef(0);

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

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="w-[138px] shrink-0 sm:w-[156px] md:w-[168px]">
            <div className="aspect-[2/3] animate-pulse rounded-2xl bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const startPointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element) return;

    isDraggingRef.current = true;
    pausedRef.current = true;
    dragDistanceRef.current = 0;
    dragStartXRef.current = event.clientX;
    dragStartScrollRef.current = element.scrollLeft;
    element.setPointerCapture(event.pointerId);
  };

  const movePointerDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = scrollRef.current;
    if (!element || !isDraggingRef.current) return;

    const deltaX = event.clientX - dragStartXRef.current;
    dragDistanceRef.current = Math.max(dragDistanceRef.current, Math.abs(deltaX));

    const nextScrollLeft = dragStartScrollRef.current - deltaX;
    element.scrollLeft = normalizeScrollLeft(element, nextScrollLeft);
  };

  const endPointerDrag = (pointerId: number) => {
    const element = scrollRef.current;
    if (!element || !isDraggingRef.current) return;

    isDraggingRef.current = false;
    pausedRef.current = false;

    if (element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
  };

  const handleCardClick = (event: React.MouseEvent<HTMLButtonElement>, book: Book) => {
    if (dragDistanceRef.current > 8) {
      event.preventDefault();
      dragDistanceRef.current = 0;
      return;
    }

    onOpenBook(book);
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent" />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide py-1 select-none touch-pan-y cursor-grab active:cursor-grabbing"
        onPointerDown={startPointerDrag}
        onPointerMove={movePointerDrag}
        onPointerUp={(event) => endPointerDrag(event.pointerId)}
        onPointerCancel={(event) => endPointerDrag(event.pointerId)}
        onPointerLeave={(event) => {
          if (isDraggingRef.current) endPointerDrag(event.pointerId);
        }}
        onMouseEnter={() => {
          pausedRef.current = true;
        }}
        onMouseLeave={() => {
          if (!isDraggingRef.current) pausedRef.current = false;
        }}
        onTouchStart={() => {
          pausedRef.current = true;
        }}
        onTouchEnd={() => {
          if (!isDraggingRef.current) pausedRef.current = false;
        }}
      >
        {displayBooks.map((book, index) => (
          <button
            key={`${book.id}-${index}`}
            type="button"
            className="group/flip w-[138px] shrink-0 text-left sm:w-[156px] md:w-[168px] [perspective:1000px]"
            onClick={(event) => handleCardClick(event, book)}
            aria-label={`Open ${book.title}`}
          >
            <div className="relative aspect-[2/3] w-full transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)]">
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

              <div className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-2xl border bg-card p-3 shadow-md [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div>
                  <p className="line-clamp-2 text-xs font-semibold leading-snug">{book.title}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{book.author}</p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {formatRating(book.googleRating)}
                  </p>
                  {book.categories[0] ? (
                    <p className="mt-2 line-clamp-1 text-[11px] text-muted-foreground">{book.categories[0]}</p>
                  ) : null}
                </div>

                <p className="text-[11px] font-semibold text-primary">Tap to open</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryStepCarousel({ categories }: { categories: Category[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    dragFree: false,
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setSelectedIndex(emblaApi.selectedScrollSnap());
    };

    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi]);

  return (
    <div>
      <div className="relative">
        <div ref={emblaRef} className="overflow-hidden">
          <div className="-ml-3 flex">
            {categories.map((category) => (
              <div key={category.id} className="shrink-0 basis-[88%] pl-3 sm:basis-[72%] md:basis-[56%] lg:basis-[40%] xl:basis-[32%]">
                <Link
                  to={`/category/${category.slug}`}
                  className="group block h-full overflow-hidden rounded-3xl border border-border/70 bg-background/70 transition-all duration-300 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                    {category.imageUrl ? (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                        onError={handleImgError}
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
                  </div>

                  <div className="space-y-2 p-4">
                    <p className="line-clamp-1 text-lg font-semibold leading-tight">{category.name}</p>
                    <p className="text-xs font-medium text-primary">{category.bookCount.toLocaleString()} books available</p>
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {category.description || `Explore top picks and trending reads in ${category.name}.`}
                    </p>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      Explore category
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute -left-2 top-1/2 z-20 hidden -translate-y-1/2 bg-background/90 lg:inline-flex"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label="Previous category"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="absolute -right-2 top-1/2 z-20 hidden -translate-y-1/2 bg-background/90 lg:inline-flex"
          onClick={() => emblaApi?.scrollNext()}
          aria-label="Next category"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1.5">
        {categories.map((category, index) => (
          <button
            key={category.id}
            type="button"
            onClick={() => emblaApi?.scrollTo(index)}
            className={`h-1.5 rounded-full transition-all ${selectedIndex === index ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/35'}`}
            aria-label={`Go to category slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function BlogImage({ post, eager }: { post: BlogPost; eager?: boolean }) {
  if (post.featuredImage) {
    return (
      <img
        src={post.featuredImage}
        alt={post.title}
        className="h-full w-full object-cover"
        loading={eager ? 'eager' : 'lazy'}
        onError={handleImgError}
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/8 to-secondary/20">
      <BookOpen className="h-8 w-8 text-primary/70" />
    </div>
  );
}

function BrandSignatureSection({
  books,
  onOpenBook,
}: {
  books: Book[];
  onOpenBook: (book: Book) => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const stackBooks = books.slice(0, 3);
  const stackPositionClasses = [
    'left-[2%] top-[18%] -rotate-[11deg]',
    'left-[31%] top-[5%] rotate-[-1deg]',
    'left-[58%] top-[18%] rotate-[10deg]',
  ];

  return (
    <section id="brand-signature" aria-labelledby="brand-signature-title" className="py-7 sm:py-9">
      <div className="container mx-auto px-4">
        <div className="home-brand-atmosphere relative overflow-hidden rounded-3xl border border-border/70 p-5 sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute -left-10 -top-10 h-44 w-44 rounded-full bg-primary/12 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 -right-8 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative grid gap-7 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <Sparkles className="h-3 w-3" />
                The Book Times Identity
              </Badge>
              <h2 id="brand-signature-title" className="font-brand-display text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                A Recommendation Engine With Editorial Soul
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                The Book Times combines curated book recommendations, real reader sentiment, and category intelligence so you discover better books faster. The home page is designed to feel premium and cinematic while staying mobile-friendly, fast, and easy to scan.
              </p>

              <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Trend-aware rankings powered by live catalog activity.
                </li>
                <li className="flex items-start gap-2">
                  <Layers3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Deep genre discovery paths for fiction and non-fiction readers.
                </li>
                <li className="flex items-start gap-2">
                  <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  Editorial quality blog picks with visual-first storytelling.
                </li>
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <Button asChild>
                  <Link to="/trending">Explore trending books</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/blog">Read latest reviews</Link>
                </Button>
              </div>
            </div>

            <div className="relative min-h-[280px] sm:min-h-[330px]">
              <div className="absolute inset-0 [perspective:1400px]">
                {stackBooks.length > 0 ? (
                  stackBooks.map((book, index) => (
                    <motion.div
                      key={book.id}
                      className={`absolute w-[36%] min-w-[108px] max-w-[170px] ${stackPositionClasses[index]}`}
                      initial={{ opacity: 0, y: 18 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.38, delay: index * 0.08 }}
                    >
                      <motion.button
                        type="button"
                        onClick={() => onOpenBook(book)}
                        className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label={`Open ${book.title}`}
                        animate={
                          prefersReducedMotion
                            ? undefined
                            : {
                                y: [0, -(7 + index * 2), 0],
                              }
                        }
                        transition={
                          prefersReducedMotion
                            ? undefined
                            : {
                                duration: 6.8 + index,
                                ease: 'easeInOut',
                                repeat: Infinity,
                                delay: index * 0.35,
                              }
                        }
                      >
                        <div className="overflow-hidden rounded-2xl border border-white/20 shadow-[0_22px_35px_-22px_rgba(0,0,0,0.75)]">
                          <img
                            src={book.coverImage}
                            alt={`${book.title} by ${book.author}`}
                            className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading={index === 1 ? 'eager' : 'lazy'}
                            onError={handleImgError}
                          />
                        </div>
                        <p className="mt-2 line-clamp-2 text-xs font-semibold text-foreground/90">{book.title}</p>
                      </motion.button>
                    </motion.div>
                  ))
                ) : (
                  <div className="grid h-full grid-cols-3 gap-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <div key={index} className="animate-pulse rounded-2xl bg-muted" />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeSeoDiscoveryStrip({ categories }: { categories: Category[] }) {
  const seoCategories = categories.slice(0, 6);

  return (
    <section aria-labelledby="home-seo-title" className="py-7 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="rounded-2xl border border-border/65 bg-background/70 p-4 sm:p-5">
          <h2 id="home-seo-title" className="font-brand-display text-xl font-semibold tracking-tight sm:text-2xl">
            Discover Better Book Recommendations By Mood, Genre, and Community Signals
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-muted-foreground">
            Explore trending books, trusted reader reviews, top categories, and editorial reading lists in one place. The Book Times helps you discover your next favorite title with high-quality recommendations optimized for modern readers.
          </p>

          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Popular discovery links">
            <Link to="/trending" className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium hover:border-primary/35 hover:text-primary">
              Trending books
            </Link>
            <Link to="/blog" className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium hover:border-primary/35 hover:text-primary">
              Book reviews blog
            </Link>
            <Link to="/categories" className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium hover:border-primary/35 hover:text-primary">
              All categories
            </Link>
            {seoCategories.map((category) => (
              <Link
                key={category.id}
                to={`/category/${category.slug}`}
                className="rounded-full border border-border/70 px-3 py-1 text-xs font-medium hover:border-primary/35 hover:text-primary"
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}

export function HomeReimagined() {
  const { isAuthenticated } = useAuth();
  const { openBook } = useAppNav();

  const { books: trendingBooks, loading: trendingLoading } = useTrendingBooks(12);
  const { books: topTwentyBooks, loading: topTwentyLoading } = useTopRated(20);
  const { books: newReleaseBooks, loading: newReleaseLoading } = useNewReleases(12, 'this-month');
  const { categories, loading: categoriesLoading } = useCategories();
  const { posts: blogPosts, loading: blogLoading } = useBlogPosts(5);

  const [popularTerms, setPopularTerms] = useState<PopularTerm[]>([]);
  const [popularTermsLoading, setPopularTermsLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    let active = true;

    analyticsApi
      .popularSearches(12, 30)
      .then((data) => {
        if (!active) return;
        const next = (data?.terms || []).map((item) => ({
          query: item.query,
          count: Number(item.count || 0),
        }));
        setPopularTerms(next);
      })
      .catch(() => {
        if (active) setPopularTerms([]);
      })
      .finally(() => {
        if (active) setPopularTermsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const actions = useMemo(
    () => HOME_ACTIONS.filter((action) => !action.requiresAuth || isAuthenticated),
    [isAuthenticated],
  );

  const topCategories = useMemo(
    () => [...categories].sort((a, b) => b.bookCount - a.bookCount).slice(0, 10),
    [categories],
  );
  const homeBlogPosts = useMemo(() => blogPosts.slice(0, 4), [blogPosts]);

  const handleSubscribe = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await newsletterApi.subscribe(email);
      setSubscribed(true);
      setEmail('');
      toast.success('Subscribed successfully. Weekly digest is now enabled.');
    } catch (error: unknown) {
      const message = (
        typeof error === 'object' &&
        error !== null &&
        'body' in error &&
        typeof (error as { body?: unknown }).body === 'object' &&
        (error as { body?: { error?: unknown } }).body !== null &&
        typeof (error as { body?: { error?: unknown } }).body?.error === 'string'
      )
        ? (error as { body?: { error?: string } }).body?.error
        : null;

      toast.error(message || 'Subscription failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="font-brand-ui">
      <section className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/5 p-4 sm:p-5">
            <div className="pointer-events-none absolute -left-14 -top-14 h-44 w-44 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 -bottom-14 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />

            <div className="relative mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2">
                  Reader Control Center
                </Badge>
                <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">Choose Your Reading Path</h2>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Compact shortcuts designed for speed across mobile and desktop.</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/search">
                  Open full search
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            <div className="relative grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
              {actions.map((action, idx) => (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.25, delay: idx * 0.04 }}
                >
                  <Link
                    to={action.href}
                    className="group block rounded-xl border border-border/70 bg-background/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
                      <action.icon className="h-4 w-4" />
                    </span>
                    <p className="text-sm font-semibold leading-tight">{action.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{action.description}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <BrandSignatureSection books={topTwentyBooks} onOpenBook={openBook} />

      <section id="top20" aria-labelledby="top20-title" className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <Trophy className="h-3 w-3" />
                Top 20 Carousel
              </Badge>
              <h2 id="top20-title" className="font-brand-display text-2xl font-semibold tracking-tight sm:text-3xl">Top 20 Books Right Now</h2>
              <p className="mt-1 text-sm text-muted-foreground">Infinite loop showcase inspired by your category page carousel.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/search?sort=rating-desc">
                Open ranking
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </header>

          <InfiniteFlipBookCarousel
            books={topTwentyBooks}
            loading={topTwentyLoading}
            onOpenBook={openBook}
            emptyMessage="Top books are loading. Please check back in a moment."
          />
        </div>
      </section>

      <section id="trending" className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <TrendingUp className="h-3 w-3" />
                Live Discovery
              </Badge>
              <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">What To Read Next</h2>
              <p className="mt-1 text-sm text-muted-foreground">Visual shelves with cover-first browsing.</p>
            </div>
          </header>

          <div className="space-y-8">
            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-brand-display text-xl font-semibold tracking-tight sm:text-2xl">Trending</h3>
                  <p className="mt-1 text-sm text-muted-foreground">What readers are opening most this week.</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/trending">
                    View all
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <InfiniteFlipBookCarousel
                books={trendingBooks}
                loading={trendingLoading}
                onOpenBook={openBook}
                emptyMessage="Trending books are loading."
              />
            </div>

            <div>
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h3 className="font-brand-display text-xl font-semibold tracking-tight sm:text-2xl">New Releases</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Fresh arrivals this month.</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/search?sort=newest">
                    View all
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>

              <InfiniteFlipBookCarousel
                books={newReleaseBooks}
                loading={newReleaseLoading}
                onOpenBook={openBook}
                emptyMessage="New releases are loading."
              />
            </div>
          </div>
        </div>
      </section>

      <section id="categories" className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="outline" className="mb-2">
                Genre Surface
              </Badge>
              <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">Browse Categories as a Carousel</h2>
              <p className="mt-1 text-sm text-muted-foreground">Moves one card at a time, exactly as requested.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/categories">
                All genres
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </header>

          {categoriesLoading ? (
            <div className="flex gap-3 overflow-hidden">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="h-56 w-[320px] animate-pulse rounded-3xl bg-muted" />
              ))}
            </div>
          ) : topCategories.length > 0 ? (
            <CategoryStepCarousel categories={topCategories} />
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No category data available yet.</p>
          )}
        </div>
      </section>

      <section className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <CalendarDays className="h-3 w-3" />
                Fresh Editorial
              </Badge>
              <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">Latest From The Blog</h2>
              <p className="mt-1 text-sm text-muted-foreground">Now with visual story previews and richer post imagery.</p>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/blog">
                View all
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </header>

          {blogLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={idx} className="overflow-hidden rounded-2xl border border-border/70">
                  <div className="aspect-[16/10] animate-pulse bg-muted" />
                  <div className="space-y-2 p-3.5">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : homeBlogPosts.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {homeBlogPosts.map((post, index) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.slug}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border/70 bg-background/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    <BlogImage post={post} eager={index === 0} />
                  </div>

                  <div className="flex flex-1 flex-col p-3.5">
                    <p className="text-xs text-muted-foreground">{formatDate(post.publishedAt || post.createdAt)}</p>
                    <h3 className="mt-1 line-clamp-2 text-base font-semibold leading-snug group-hover:text-primary">
                      {post.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {truncateText(post.excerpt || post.content || '', 120)}
                    </p>
                    <span className="mt-auto pt-3 text-xs font-semibold text-primary">Read article</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No published blog posts yet.</p>
          )}
        </div>
      </section>

      <HomeSeoDiscoveryStrip categories={topCategories} />

      <section className="border-t border-border/65 py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <div className="space-y-5">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4 sm:p-5">
              <header className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  <h3 className="font-brand-display text-xl font-semibold">Popular Searches</h3>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/search">
                    Open search page
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </header>

              {popularTermsLoading ? (
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <div key={idx} className="h-8 w-28 animate-pulse rounded-full bg-muted" />
                  ))}
                </div>
              ) : popularTerms.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {popularTerms.slice(0, 16).map((term) => (
                    <Link
                      key={term.query}
                      to={`/search?q=${encodeURIComponent(term.query)}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      {term.query}
                      {term.count > 1 ? <span className="text-muted-foreground">x{term.count}</span> : null}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent search trends available yet.</p>
              )}
            </div>

            <div className="home-newsletter-shell rounded-2xl border border-border/70 p-5 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <header className="mb-3 flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" />
                    <h3 className="font-brand-display text-2xl font-semibold tracking-tight">Weekly Reading Digest</h3>
                  </header>

                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Get one clean weekly email with trending books, standout new releases, and editor picks tailored for discovery.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <Sparkles className="h-3 w-3" />
                      Curated
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <CalendarDays className="h-3 w-3" />
                      Weekly
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                      <Mail className="h-3 w-3" />
                      No spam
                    </span>
                  </div>
                </div>

                <div>
                  {!subscribed ? (
                    <form onSubmit={handleSubscribe} className="space-y-2.5">
                      <Input
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="reader@example.com"
                        required
                        className="h-11 bg-background"
                      />
                      <Button type="submit" className="h-11 w-full" disabled={submitting}>
                        {submitting ? 'Subscribing...' : 'Subscribe to the weekly digest'}
                      </Button>
                    </form>
                  ) : (
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                      Subscription active. Check your inbox for confirmation.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
