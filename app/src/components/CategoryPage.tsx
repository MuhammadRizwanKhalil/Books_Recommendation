import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Star,
  Heart,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  ExternalLink,
  ShoppingCart,
  Sparkles,
  Trophy,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Book, Category } from '@/types';
import { useBooksByCategory, useTopRated } from '@/hooks/useBooks';
import { formatPrice, formatRating, getStarRating, formatNumber } from '@/lib/utils';
import { useWishlist } from '@/components/WishlistProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import { useAuth } from '@/components/AuthProvider';

interface CategoryPageProps {
  category: Category;
  onBack: () => void;
  onBookClick: (book: Book) => void;
}

export function CategoryPage({ category, onBack, onBookClick }: CategoryPageProps) {
  const { books, loading } = useBooksByCategory(category.slug);
  const { books: globalTopBooks, loading: globalTopLoading } = useTopRated(20);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { readingHistory } = useAuth();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 16;

  useSEO({
    title: category.metaTitle || `${category.name} Books | The Book Times`,
    description:
      category.metaDescription ||
      `Discover the best ${category.name} books. Browse ${category.bookCount}+ titles with ratings and reviews.`,
    ogTitle: `${category.name} Books`,
    ogDescription: `Explore top ${category.name} books on The Book Times`,
    ogUrl: `${window.location.origin}/category/${category.slug}`,
    canonical: `${window.location.origin}/category/${category.slug}`,
  });

  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const ratingDiff = (b.googleRating || 0) - (a.googleRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return b.computedScore - a.computedScore;
    });
  }, [books]);

  const featuredBook = useMemo(() => {
    if (sortedBooks.length === 0) return null;
    const now = new Date();
    const weekNumber = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    return sortedBooks[weekNumber % sortedBooks.length];
  }, [sortedBooks]);

  const top20Books = sortedBooks.slice(0, 20);
  const recentBooks = readingHistory.slice(0, 8);

  const allBooks = useMemo(() => {
    return sortedBooks.filter((b) => b.id !== featuredBook?.id);
  }, [sortedBooks, featuredBook]);

  const totalPages = Math.ceil(allBooks.length / PAGE_SIZE);
  const paginatedBooks = allBooks.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b">
          <div className="container mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          </div>
        </div>
        <div className="container mx-auto px-4 py-20">
          <div className="flex items-center justify-center gap-3">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Loading books...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-background"
    >
      {/* Sticky back bar */}
      <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-lg border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Categories
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm font-medium">{category.name}</span>
          <Badge variant="secondary" className="ml-auto">
            <BookOpen className="h-3 w-3 mr-1" />
            {sortedBooks.length} books
          </Badge>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* ===== 1. HERO SECTION ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12">
            {/* Left: Category info */}
            <div className="flex-1">
              <Badge variant="outline" className="mb-3 text-xs">
                <BookOpen className="h-3 w-3 mr-1" />
                Category
              </Badge>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-serif tracking-tight">
                {category.name}
              </h1>
              {category.description && (
                <p className="text-muted-foreground mt-4 text-base md:text-lg leading-relaxed max-w-xl">
                  {category.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 mt-5">
                <Badge variant="secondary" className="gap-1.5 py-1 px-3">
                  <BookOpen className="h-3.5 w-3.5" />
                  {sortedBooks.length} Books
                </Badge>
                {top20Books[0] && (
                  <Badge variant="secondary" className="gap-1.5 py-1 px-3">
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    Top Rated: {formatRating(top20Books[0].googleRating)}
                  </Badge>
                )}
              </div>
            </div>

            {/* Right: Featured book floating */}
            {featuredBook && (
              <div
                className="relative shrink-0 cursor-pointer group"
                onClick={() => onBookClick(featuredBook)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="relative w-44 md:w-52"
                >
                  <img
                    src={featuredBook.coverImage}
                    alt={featuredBook.title}
                    className="w-full rounded-2xl shadow-2xl group-hover:shadow-[0_20px_60px_rgba(0,0,0,0.3)] transition-all duration-500 group-hover:-translate-y-1"
                    loading="eager"
                  />
                  <Badge className="absolute -top-3 -right-3 bg-yellow-500 text-black font-bold shadow-lg">
                    <Sparkles className="h-3 w-3 mr-0.5" /> Featured
                  </Badge>
                  {/* Small detail box */}
                  <div className="absolute -bottom-5 -left-4 right-4 bg-card/95 backdrop-blur-sm border rounded-xl p-3 shadow-xl">
                    <p className="font-bold text-sm line-clamp-1">{featuredBook.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{featuredBook.author}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-semibold">
                          {formatRating(featuredBook.googleRating)}
                        </span>
                      </div>
                      {featuredBook.price && (
                        <span className="text-xs font-bold text-primary">
                          {formatPrice(featuredBook.price, featuredBook.currency)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        </motion.section>

        {/* ===== 2. TOP 20 IN CATEGORY AUTO-SCROLL CAROUSEL ===== */}
        {top20Books.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <AutoFlipCarousel
              books={top20Books}
              title={`Top ${Math.min(20, top20Books.length)} in ${category.name}`}
              icon={<Trophy className="h-5 w-5 text-yellow-500" />}
              onBookClick={onBookClick}
            />
          </motion.section>
        )}

        {/* ===== 3. ALL BOOKS 4-COL GRID ===== */}
        {allBooks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                All {category.name} Books
              </h2>
              {totalPages > 1 && (
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {paginatedBooks.map((book) => (
                <HorizontalBookCard
                  key={book.id}
                  book={book}
                  isExpanded={expandedBookId === book.id}
                  onMouseEnter={() => setExpandedBookId(book.id)}
                  onMouseLeave={() => setExpandedBookId(null)}
                  onClick={() => onBookClick(book)}
                  liked={isInWishlist(book.id)}
                  onToggleWishlist={() => toggleWishlist(book)}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    if (totalPages <= 7) return true;
                    if (page === 1 || page === totalPages) return true;
                    if (Math.abs(page - currentPage) <= 1) return true;
                    return false;
                  })
                  .map((page, idx, arr) => {
                    const showEllipsis = idx > 0 && page - arr[idx - 1] > 1;
                    return (
                      <span key={page} className="flex items-center">
                        {showEllipsis && (
                          <span className="px-1.5 text-muted-foreground">&hellip;</span>
                        )}
                        <Button
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    );
                  })}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.section>
        )}

        {/* ===== 4. GLOBAL TOP 20 CAROUSEL ===== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-12"
        >
          <AutoFlipCarousel
            books={globalTopBooks}
            title="Top 20 Overall"
            subtitle="Highest rated books across all categories"
            loading={globalTopLoading}
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
            onBookClick={onBookClick}
          />
        </motion.section>

        {/* ===== 5. RECENTLY VIEWED ===== */}
        {recentBooks.length >= 2 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 rounded-xl bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Recently Viewed</h2>
                <p className="text-sm text-muted-foreground">Continue where you left off</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute left-0 top-0 bottom-4 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
              <div className="absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 px-1 snap-x snap-mandatory">
                {recentBooks.map((entry, idx) => (
                  <motion.div
                    key={`${entry.bookId}-${idx}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="shrink-0 w-[130px] snap-start"
                  >
                    <Link
                      to={`/book/${entry.bookSlug || entry.bookId}`}
                      className="group block"
                    >
                      <div className="rounded-xl overflow-hidden border shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                        <div className="aspect-[2/3] overflow-hidden">
                          {entry.bookCover ? (
                            <img
                              src={entry.bookCover}
                              alt={entry.bookTitle}
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-muted flex items-center justify-center">
                              <span className="text-3xl">??</span>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                            {entry.bookTitle}
                          </p>
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {entry.bookAuthor}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* Empty state */}
        {sortedBooks.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground">No books found in this category yet.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ================================================================
   Auto-scrolling Flip Carousel
   - Infinite loop via duplicated items
   - Pauses on hover
   - Cards flip on hover to reveal details
   ================================================================ */

function AutoFlipCarousel({
  books,
  title,
  subtitle,
  icon,
  loading = false,
  onBookClick,
}: {
  books: Book[];
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  loading?: boolean;
  onBookClick: (book: Book) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);

  // Duplicate for seamless infinite loop
  const displayBooks = books.length > 0 ? [...books, ...books] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || books.length === 0) return;

    let lastTime = 0;

    const animate = (time: number) => {
      if (!isPausedRef.current && lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += 0.5 * (delta / 16);
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
  }, [books.length]);

  if (loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          {icon}
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shrink-0 w-[140px] sm:w-[160px]">
              <div className="aspect-[2/3] rounded-xl bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (books.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
        style={{ scrollBehavior: 'auto' }}
      >
        {displayBooks.map((book, idx) => (
          <div
            key={`${book.id}-${idx}`}
            className="shrink-0 w-[140px] sm:w-[160px] cursor-pointer group/flip"
            style={{ perspective: '1000px' }}
            onClick={() => onBookClick(book)}
          >
            <div className="relative w-full aspect-[2/3] transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)]">
              {/* Front - Cover Image */}
              <div className="absolute inset-0 rounded-xl overflow-hidden shadow-md [backface-visibility:hidden]">
                <img
                  src={book.coverImage}
                  alt={book.title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              {/* Back - Details */}
              <div className="absolute inset-0 rounded-xl overflow-hidden bg-card border shadow-md p-3 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
                <div className="space-y-1.5 overflow-hidden">
                  <h4 className="font-bold text-xs line-clamp-2">{book.title}</h4>
                  <p className="text-[11px] text-muted-foreground">{book.author}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs font-medium">
                      {formatRating(book.googleRating)}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground line-clamp-4 leading-relaxed">
                    {book.description}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t mt-1.5">
                  {book.price ? (
                    <span className="text-xs font-bold text-primary">
                      {formatPrice(book.price, book.currency)}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className="text-[10px] text-primary font-medium">View ?</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   Horizontal Book Card with Expand Below
   - Small rectangular card: image left, title right
   - On hover: smooth expansion below showing full details
   ================================================================ */

function HorizontalBookCard({
  book,
  isExpanded,
  onMouseEnter,
  onMouseLeave,
  onClick,
  liked,
  onToggleWishlist,
}: {
  book: Book;
  isExpanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  liked: boolean;
  onToggleWishlist: () => void;
}) {
  const stars = getStarRating(book.googleRating);

  return (
    <div className="group" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {/* Main Card: horizontal rectangle */}
      <div
        className="flex items-center gap-3 p-2.5 rounded-xl border bg-card cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-300"
        onClick={onClick}
      >
        <div className="shrink-0 w-14 h-20 rounded-lg overflow-hidden shadow-sm">
          <img
            src={book.coverImage}
            alt={book.title}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author}</p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-xs font-medium">{formatRating(book.googleRating)}</span>
            </div>
            {book.price && (
              <span className="text-xs font-semibold text-primary">
                {formatPrice(book.price, book.currency)}
              </span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="shrink-0 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist();
          }}
        >
          <Heart
            className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`}
          />
        </Button>
      </div>

      {/* Expanded details below the card */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 p-3 rounded-xl border bg-card/80 backdrop-blur-sm space-y-2">
              {book.subtitle && (
                <p className="text-xs text-muted-foreground italic">{book.subtitle}</p>
              )}
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                {book.description}
              </p>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < stars.full
                        ? 'fill-yellow-400 text-yellow-400'
                        : i === stars.full && stars.half
                        ? 'fill-yellow-400/50 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
                <span className="text-xs ml-1">{formatRating(book.googleRating)}</span>
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({formatNumber(book.ratingsCount)})
                </span>
              </div>
              {book.categories.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {book.categories.slice(0, 3).map((cat) => (
                    <Badge key={cat} variant="outline" className="text-[10px] px-1.5 py-0">
                      {cat}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <Button size="sm" className="h-7 text-xs flex-1" onClick={onClick}>
                  View Details
                </Button>
                {book.amazonUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    asChild
                    onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  >
                    <a
                      href={book.amazonUrl}
                      target="_blank"
                      rel="nofollow sponsored noopener noreferrer"
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Amazon
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
