import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Compass,
  Flame,
  Layers3,
  Mail,
  Search,
  Sparkles,
  Star,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
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
import type { Book } from '@/types';

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

type LaneVariant = 'trending' | 'topRated' | 'newReleases';

function laneStyles(variant: LaneVariant) {
  if (variant === 'trending') {
    return {
      tag: 'Readers are loving these',
      badge: 'from-orange-500/20 to-rose-500/10',
      accent: 'text-orange-500',
    };
  }

  if (variant === 'topRated') {
    return {
      tag: 'Consistently high ratings',
      badge: 'from-amber-500/20 to-yellow-500/10',
      accent: 'text-amber-500',
    };
  }

  return {
    tag: 'Fresh this month',
    badge: 'from-emerald-500/20 to-cyan-500/10',
    accent: 'text-emerald-500',
  };
}

function CompactBookRow({
  book,
  index,
  onOpenBook,
}: {
  book: Book;
  index: number;
  onOpenBook: (book: Book) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenBook(book)}
      className="group flex w-full items-center gap-3 rounded-xl border border-transparent bg-muted/20 px-2 py-2 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Open ${book.title}`}
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md border bg-muted home-book-thumb">
        <img
          src={book.coverImage}
          alt={`${book.title} by ${book.author}`}
          loading="lazy"
          width={96}
          height={128}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={handleImgError}
        />
      </div>

      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold leading-tight">{book.title}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">{book.author}</p>

        <div className="mt-1 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {formatRating(book.googleRating)}
          </span>
          {book.categories[0] ? <span className="line-clamp-1 text-muted-foreground">{book.categories[0]}</span> : null}
        </div>
      </div>

      <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">#{index + 1}</span>
    </button>
  );
}

function DiscoveryLane({
  variant,
  title,
  href,
  books,
  loading,
  onOpenBook,
}: {
  variant: LaneVariant;
  title: string;
  href: string;
  books: Book[];
  loading: boolean;
  onOpenBook: (book: Book) => void;
}) {
  const styles = laneStyles(variant);
  const visible = books.slice(0, 4);

  return (
    <article className="home-3d-panel rounded-2xl p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className={`inline-flex items-center rounded-full bg-gradient-to-r px-2.5 py-1 text-[11px] font-medium ${styles.badge}`}>
            {styles.tag}
          </div>
          <h3 className="mt-2 font-brand-display text-xl font-semibold tracking-tight">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <Link to={href}>
            View
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-[76px] animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : visible.length > 0 ? (
        <div className="space-y-2">
          {visible.map((book, index) => (
            <CompactBookRow key={book.id} book={book} index={index} onOpenBook={onOpenBook} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No live data available yet.</p>
      )}

      <div className={`mt-4 text-xs ${styles.accent}`}>Updated from live catalog and community activity.</div>
    </article>
  );
}

export function HomeReimagined() {
  const { isAuthenticated } = useAuth();
  const { openBook } = useAppNav();

  const { books: trendingBooks, loading: trendingLoading } = useTrendingBooks(6);
  const { books: topRatedBooks, loading: topRatedLoading } = useTopRated(6);
  const { books: newReleaseBooks, loading: newReleaseLoading } = useNewReleases(6, 'this-month');
  const { categories, loading: categoriesLoading } = useCategories();
  const { posts: blogPosts, loading: blogLoading } = useBlogPosts(3);

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
    () => [...categories].sort((a, b) => b.bookCount - a.bookCount).slice(0, 12),
    [categories],
  );

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
          <div className="home-3d-panel home-subtle-grid rounded-2xl p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
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

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
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
                    className="group block rounded-xl border bg-card/80 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

      <section id="trending" className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-2 gap-1">
                <TrendingUp className="h-3 w-3" />
                Live Discovery
              </Badge>
              <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">What To Read Next</h2>
              <p className="mt-1 text-sm text-muted-foreground">Three focused lanes powered by real-time catalog activity.</p>
            </div>
          </header>

          <div className="grid gap-4 lg:grid-cols-3">
            <DiscoveryLane
              variant="trending"
              title="Trending"
              href="/trending"
              books={trendingBooks}
              loading={trendingLoading}
              onOpenBook={openBook}
            />
            <DiscoveryLane
              variant="topRated"
              title="Top Rated"
              href="/search?sort=rating"
              books={topRatedBooks}
              loading={topRatedLoading}
              onOpenBook={openBook}
            />
            <DiscoveryLane
              variant="newReleases"
              title="New Releases"
              href="/search?sort=newest"
              books={newReleaseBooks}
              loading={newReleaseLoading}
              onOpenBook={openBook}
            />
          </div>
        </div>
      </section>

      <section id="categories" className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <div className="home-3d-panel rounded-2xl p-4 sm:p-5">
            <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <Badge variant="outline" className="mb-2">
                  Genre Surface
                </Badge>
                <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">Browse By Category</h2>
                <p className="mt-1 text-sm text-muted-foreground">High-signal genres with the deepest collections.</p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/categories">
                  All genres
                  <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </header>

            {categoriesLoading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {Array.from({ length: 12 }).map((_, idx) => (
                  <div key={idx} className="h-20 animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            ) : topCategories.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                {topCategories.map((category, idx) => (
                  <motion.div
                    key={category.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.22, delay: idx * 0.02 }}
                  >
                    <Link
                      to={`/category/${category.slug}`}
                      className="group block rounded-xl border bg-card px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <p className="line-clamp-1 text-sm font-semibold">{category.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{category.bookCount.toLocaleString()} titles</p>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No category data available yet.</p>
            )}
          </div>
        </div>
      </section>

      <section className="py-7 sm:py-9">
        <div className="container mx-auto px-4">
          <div className="grid gap-4 lg:grid-cols-12">
            <article className="home-3d-panel rounded-2xl p-4 sm:p-5 lg:col-span-8">
              <header className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <Badge variant="secondary" className="mb-2 gap-1">
                    <CalendarDays className="h-3 w-3" />
                    Fresh Editorial
                  </Badge>
                  <h2 className="font-brand-display text-2xl sm:text-3xl font-semibold tracking-tight">Latest From The Blog</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Actionable reading ideas, interviews, and curated lists.</p>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/blog">
                    View all
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </header>

              {blogLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="h-24 animate-pulse rounded-xl bg-muted" />
                  ))}
                </div>
              ) : blogPosts.length > 0 ? (
                <div className="space-y-2.5">
                  {blogPosts.slice(0, 3).map((post) => (
                    <Link
                      key={post.id}
                      to={`/blog/${post.slug}`}
                      className="group block rounded-xl border bg-card/70 px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{formatDate(post.publishedAt || post.createdAt)}</span>
                      </div>
                      <h3 className="line-clamp-1 text-base font-semibold group-hover:text-primary">{post.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {truncateText(post.excerpt || post.content || '', 130)}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No published blog posts yet.</p>
              )}
            </article>

            <aside className="space-y-4 lg:col-span-4">
              <div className="home-3d-panel rounded-2xl p-4 sm:p-5">
                <header className="mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" />
                  <h3 className="font-brand-display text-xl font-semibold">Popular Searches</h3>
                </header>

                {popularTermsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-8 animate-pulse rounded-lg bg-muted" />
                    ))}
                  </div>
                ) : popularTerms.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {popularTerms.slice(0, 10).map((term) => (
                      <Link
                        key={term.query}
                        to={`/search?q=${encodeURIComponent(term.query)}`}
                        className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs font-medium transition-colors hover:border-primary/35 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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

              <div className="home-3d-panel rounded-2xl p-4 sm:p-5">
                <header className="mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <h3 className="font-brand-display text-xl font-semibold">Weekly Reading Digest</h3>
                </header>

                <p className="mb-3 text-sm text-muted-foreground">One concise weekly email with curated picks and no noise.</p>

                {!subscribed ? (
                  <form onSubmit={handleSubscribe} className="space-y-2.5">
                    <Input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="reader@example.com"
                      required
                      className="h-10"
                    />
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? 'Subscribing...' : 'Subscribe'}
                    </Button>
                  </form>
                ) : (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
                    Subscription active. Check your inbox for confirmation.
                  </div>
                )}

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <Sparkles className="h-3 w-3" />
                    Curated
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <CalendarDays className="h-3 w-3" />
                    Weekly
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1">
                    <Mail className="h-3 w-3" />
                    No spam
                  </span>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
