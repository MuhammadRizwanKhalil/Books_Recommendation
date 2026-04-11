import { useState, useMemo } from 'react';
import {
  Star,
  Heart,
  ChevronLeft,
  ChevronDown,
  Trophy,
  BookOpen,
  ExternalLink,
  ShoppingCart,
  Crown,
  Medal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Book, Category } from '@/types';
import { useBooksByCategory } from '@/hooks/useBooks';
import { formatPrice, formatRating, getStarRating, formatNumber, truncateText } from '@/lib/utils';
import { useWishlist } from '@/components/WishlistProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { useSEO } from '@/hooks/useSEO';

interface CategoryPageProps {
  category: Category;
  onBack: () => void;
  onBookClick: (book: Book) => void;
}

export function CategoryPage({ category, onBack, onBookClick }: CategoryPageProps) {
  const { books, loading } = useBooksByCategory(category.slug);
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

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

  const topBook = sortedBooks[0];
  const remainingBooks = sortedBooks.slice(1);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return null;
  };

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
        {/* Category Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="relative h-48 md:h-64 rounded-2xl overflow-hidden mb-6">
            <img
              src={category.imageUrl}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 text-white">
              <h1 className="text-3xl md:text-4xl font-bold">{category.name}</h1>
              {category.description && (
                <p className="text-white/80 mt-2 max-w-2xl">{category.description}</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ===== TOP BOOK (FEATURED HERO) ===== */}
        {topBook && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <h2 className="text-xl font-bold">#1 Top Rated in {category.name}</h2>
            </div>
            <Card
              className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl"
              onClick={() => onBookClick(topBook)}
            >
              <div className="grid md:grid-cols-[280px_1fr] gap-0">
                <div className="relative aspect-[2/3] md:aspect-auto overflow-hidden">
                  <img
                    src={topBook.coverImage}
                    alt={topBook.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-yellow-500 text-black font-bold gap-1">
                      <Crown className="h-3 w-3" /> #1 Top Rated
                    </Badge>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/90 hover:bg-white"
                    onClick={(e) => { e.stopPropagation(); toggleWishlist(topBook); }}
                  >
                    <Heart className={`h-4 w-4 ${isInWishlist(topBook.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>
                <CardContent className="p-6 md:p-8 flex flex-col justify-center">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-2xl md:text-3xl font-bold group-hover:text-primary transition-colors">
                        {topBook.title}
                      </h3>
                      {topBook.subtitle && (
                        <p className="text-muted-foreground mt-1">{topBook.subtitle}</p>
                      )}
                    </div>
                    <p className="text-lg font-medium">by {topBook.author}</p>
                    <StarRatingDisplay book={topBook} size="lg" />
                    <p className="text-muted-foreground leading-relaxed line-clamp-4">
                      {topBook.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {topBook.categories.map((cat) => (
                        <Badge key={cat} variant="secondary">{cat}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      {topBook.price && (
                        <span className="text-2xl font-bold text-primary">
                          {formatPrice(topBook.price, topBook.currency)}
                        </span>
                      )}
                      {topBook.amazonUrl && (
                        <Button size="sm" asChild onClick={(e) => e.stopPropagation()}>
                          <a href={topBook.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                            <ShoppingCart className="h-4 w-4 mr-1" />
                            Buy on Amazon
                            <ExternalLink className="h-3 w-3 ml-1" />
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

        {/* ===== RANKED BOOK LIST ===== */}
        {remainingBooks.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              All Books â€” Ranked by Rating
            </h2>
            <div className="space-y-3">
              {remainingBooks.map((book, index) => {
                const rank = index + 2; // because #1 is the hero
                const isExpanded = expandedBookId === book.id;
                const stars = getStarRating(book.googleRating);
                const liked = isInWishlist(book.id);

                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * index }}
                  >
                    <Card
                      className="overflow-hidden transition-all duration-300 hover:shadow-md group"
                      onMouseEnter={() => setExpandedBookId(book.id)}
                      onMouseLeave={() => setExpandedBookId(null)}
                    >
                      <div
                        className="flex items-center gap-4 p-4 cursor-pointer"
                        onClick={() => onBookClick(book)}
                      >
                        {/* Rank */}
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
                          {getRankIcon(rank) || (
                            <span className="text-sm font-bold text-muted-foreground">#{rank}</span>
                          )}
                        </div>

                        {/* Cover Thumbnail */}
                        <img
                          src={book.coverImage}
                          alt={book.title}
                          className="w-14 h-20 object-cover rounded-md shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105"
                        />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                            {book.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3.5 w-3.5 ${
                                    i < stars.full
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : i === stars.full && stars.half
                                      ? 'fill-yellow-400/50 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm font-medium">{formatRating(book.googleRating)}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatNumber(book.ratingsCount)})
                            </span>
                          </div>
                        </div>

                        {/* Price + Wishlist */}
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                          {book.price && (
                            <span className="font-bold text-primary">
                              {formatPrice(book.price, book.currency)}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => { e.stopPropagation(); toggleWishlist(book); }}
                          >
                            <Heart className={`h-4 w-4 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                          </Button>
                          <ChevronDown
                            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* Expanded Details (on hover) */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <Separator />
                            <div className="grid md:grid-cols-[180px_1fr] gap-6 p-4 bg-muted/30">
                              {/* Larger cover */}
                              <img
                                src={book.coverImage}
                                alt={book.title}
                                className="w-full max-w-[180px] aspect-[2/3] object-cover rounded-lg shadow-md cursor-pointer"
                                onClick={() => onBookClick(book)}
                              />
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-lg font-bold">{book.title}</h4>
                                  {book.subtitle && (
                                    <p className="text-sm text-muted-foreground">{book.subtitle}</p>
                                  )}
                                  <p className="text-sm mt-1">by <span className="font-medium">{book.author}</span></p>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                  {truncateText(book.description, 300)}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {book.categories.map((cat) => (
                                    <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                                  ))}
                                </div>
                                <div className="flex items-center gap-4 pt-1">
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="font-medium">{formatRating(book.googleRating)}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({formatNumber(book.ratingsCount)} ratings)
                                    </span>
                                  </div>
                                  {book.pageCount && (
                                    <>
                                      <Separator orientation="vertical" className="h-4" />
                                      <span className="text-sm text-muted-foreground">{book.pageCount} pages</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                  <Button size="sm" onClick={() => onBookClick(book)}>
                                    View Full Details
                                  </Button>
                                  {book.amazonUrl && (
                                    <Button size="sm" variant="outline" asChild onClick={(e) => e.stopPropagation()}>
                                      <a href={book.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                                        <ShoppingCart className="h-3 w-3 mr-1" />
                                        Amazon
                                      </a>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {sortedBooks.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg text-muted-foreground">No books found in this category yet.</p>
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
        {stars.half && <Star className={`${iconSize} fill-yellow-400/50 text-yellow-400`} />}
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
