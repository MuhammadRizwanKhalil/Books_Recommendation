import { useState, useMemo } from 'react';
import {
  Star,
  Heart,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Trophy,
  BookOpen,
  ExternalLink,
  ShoppingCart,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Book, Category } from '@/types';
import { useBooksByCategory, useTopRated } from '@/hooks/useBooks';
import { formatPrice, formatRating, getStarRating, formatNumber } from '@/lib/utils';
import { useWishlist } from '@/components/WishlistProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';
import { BookCarousel } from '@/components/BookCarousel';

interface CategoryPageProps {
  category: Category;
  onBack: () => void;
  onBookClick: (book: Book) => void;
}

export function CategoryPage({ category, onBack, onBookClick }: CategoryPageProps) {
  const { books, loading } = useBooksByCategory(category.slug);
  const { books: globalTopBooks, loading: globalTopLoading } = useTopRated(20);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 12;

  useSEO({
    title: category.metaTitle || `${category.name} Books | The Book Times`,
    description: category.metaDescription || `Discover the best ${category.name} books. Browse ${category.bookCount}+ titles with ratings and reviews.`,
    ogTitle: `${category.name} Books`,
    ogDescription: `Explore top ${category.name} books on The Book Times`,
    ogUrl: `${window.location.origin}/category/${category.slug}`,
    canonical: `${window.location.origin}/category/${category.slug}`,
  });

  // Sort by rating DESC, then by computedScore DESC
  const sortedBooks = useMemo(() => {
    return [...books].sort((a, b) => {
      const ratingDiff = (b.googleRating || 0) - (a.googleRating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return b.computedScore - a.computedScore;
    });
  }, [books]);

  // Featured book rotates weekly using a deterministic hash
  const featuredBook = useMemo(() => {
    if (sortedBooks.length === 0) return null;
    const now = new Date();
    const weekNumber = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
    );
    const index = weekNumber % sortedBooks.length;
    return sortedBooks[index];
  }, [sortedBooks]);

  const top20Books = sortedBooks.slice(0, 20);

  // Paginated list excludes featured book
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

      <div className="container mx-auto px-4 py-6">
        {/* Category Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative h-40 md:h-52 rounded-2xl overflow-hidden mb-6">
            {category.imageUrl && (
              <img
                src={category.imageUrl}
                alt={category.name}
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 text-white">
              <h1 className="text-2xl md:text-3xl font-bold">{category.name}</h1>
              {category.description && (
                <p className="text-white/80 mt-1.5 max-w-2xl text-sm md:text-base line-clamp-2">
                  {category.description}
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ===== FEATURED BOOK OF THE WEEK ===== */}
        {featuredBook && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h2 className="text-lg font-bold">Featured This Week</h2>
            </div>
            <Card
              className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl"
              onClick={() => onBookClick(featuredBook)}
            >
              <div className="grid md:grid-cols-[200px_1fr] gap-0">
                <div className="relative aspect-[2/3] md:aspect-auto md:min-h-[280px] overflow-hidden">
                  <img
                    src={featuredBook.coverImage}
                    alt={featuredBook.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="eager"
                  />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-yellow-500 text-black font-bold gap-1 text-xs">
                      <Sparkles className="h-3 w-3" /> Featured
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWishlist(featuredBook);
                    }}
                  >
                    <Heart
                      className={`h-4 w-4 ${isInWishlist(featuredBook.id) ? 'fill-red-500 text-red-500' : ''}`}
                    />
                  </Button>
                </div>
                <CardContent className="p-5 flex flex-col justify-center">
                  <div className="space-y-2.5">
                    <div>
                      <h3 className="text-xl font-bold group-hover:text-primary transition-colors line-clamp-2">
                        {featuredBook.title}
                      </h3>
                      {featuredBook.subtitle && (
                        <p className="text-muted-foreground text-sm mt-0.5 line-clamp-1">
                          {featuredBook.subtitle}
                        </p>
                      )}
                    </div>
                    <p className="text-sm font-medium">
                      by{' '}
                      {featuredBook.authorData?.slug ? (
                        <Link
                          to={`/author/${featuredBook.authorData.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-primary hover:underline"
                        >
                          {featuredBook.author}
                        </Link>
                      ) : (
                        featuredBook.author
                      )}
                    </p>
                    <StarRatingDisplay book={featuredBook} size="md" />
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {featuredBook.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {featuredBook.categories.slice(0, 4).map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      {featuredBook.price && (
                        <span className="text-xl font-bold text-primary">
                          {formatPrice(featuredBook.price, featuredBook.currency)}
                        </span>
                      )}
                      {featuredBook.amazonUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={featuredBook.amazonUrl}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                          >
                            <ShoppingCart className="h-3 w-3 mr-1" />
                            Buy on Amazon
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        )}

        {/* ===== TOP 20 IN CATEGORY CAROUSEL ===== */}
        {top20Books.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <BookCarousel
              books={top20Books}
              title={`Top ${Math.min(20, top20Books.length)} in ${category.name}`}
              icon={<Trophy className="h-5 w-5 text-yellow-500" />}
            />
          </motion.div>
        )}

        {/* ===== PAGINATED BOOK GRID ===== */}
        {allBooks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                All {category.name} Books
              </h2>
              {totalPages > 1 && (
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {paginatedBooks.map((book) => {
                const isExpanded = expandedBookId === book.id;
                const stars = getStarRating(book.googleRating);
                const liked = isInWishlist(book.id);

                return (
                  <div key={book.id} className="relative">
                    <Card
                      className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                      onClick={() => onBookClick(book)}
                      onMouseEnter={() => setExpandedBookId(book.id)}
                      onMouseLeave={() => setExpandedBookId(null)}
                    >
                      <div className="relative aspect-[2/3] overflow-hidden">
                        <img
                          src={book.coverImage}
                          alt={book.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="absolute right-2 top-2 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 shadow-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist(book);
                          }}
                        >
                          <Heart
                            className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
                          />
                        </Button>
                      </div>
                      <CardContent className="p-3">
                        <h3 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">
                          {book.title}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {book.author}
                        </p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-medium">
                              {formatRating(book.googleRating)}
                            </span>
                          </div>
                          {book.price && (
                            <span className="text-xs font-semibold text-primary">
                              {formatPrice(book.price, book.currency)}
                            </span>
                          )}
                        </div>
                      </CardContent>

                      {/* Expandable details overlay on hover */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 bg-background/95 backdrop-blur-sm p-4 flex flex-col justify-between z-10 overflow-auto"
                          >
                            <div className="space-y-2">
                              <h4 className="font-bold text-sm line-clamp-2">{book.title}</h4>
                              {book.subtitle && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {book.subtitle}
                                </p>
                              )}
                              <p className="text-xs">
                                by{' '}
                                {book.authorData?.slug ? (
                                  <Link
                                    to={`/author/${book.authorData.slug}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-primary hover:underline"
                                  >
                                    {book.author}
                                  </Link>
                                ) : (
                                  <span className="font-medium">{book.author}</span>
                                )}
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
                                <span className="text-xs font-medium ml-1">
                                  {formatRating(book.googleRating)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                                {book.description}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {book.categories.slice(0, 3).map((cat) => (
                                  <Badge
                                    key={cat}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0"
                                  >
                                    {cat}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                              <Button
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => onBookClick(book)}
                              >
                                View Details
                              </Button>
                              {book.amazonUrl && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <a
                                    href={book.amazonUrl}
                                    target="_blank"
                                    rel="nofollow sponsored noopener noreferrer"
                                  >
                                    Amazon
                                    <ExternalLink className="h-3 w-3 ml-1" />
                                  </a>
                                </Button>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
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
                          <span className="px-1.5 text-muted-foreground">...</span>
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
          </motion.div>
        )}

        {/* ===== GLOBAL TOP 20 CAROUSEL ===== */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-8"
        >
          <BookCarousel
            books={globalTopBooks}
            title="Top 20 Overall"
            subtitle="Highest rated books across all categories"
            loading={globalTopLoading}
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
          />
        </motion.div>

        {sortedBooks.length === 0 && (
          <div className="text-center py-16">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground">
              No books found in this category yet.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ======== Helper sub-component ======== */

function StarRatingDisplay({ book, size = 'md' }: { book: Book; size?: 'md' | 'lg' }) {
  const stars = getStarRating(book.googleRating);
  const iconSize = size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  const textSize = size === 'lg' ? 'text-xl font-bold' : 'text-sm font-medium';

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: stars.full }).map((_, i) => (
          <Star key={`f-${i}`} className={`${iconSize} fill-yellow-400 text-yellow-400`} />
        ))}
        {stars.half && (
          <Star className={`${iconSize} fill-yellow-400/50 text-yellow-400`} />
        )}
        {Array.from({ length: stars.empty }).map((_, i) => (
          <Star key={`e-${i}`} className={`${iconSize} text-gray-300`} />
        ))}
      </div>
      <span className={textSize}>{formatRating(book.googleRating)}</span>
      <span className="text-sm text-muted-foreground">
        ({formatNumber(book.ratingsCount)} ratings)
      </span>
    </div>
  );
}
