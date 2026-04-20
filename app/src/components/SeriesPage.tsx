import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Heart, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { formatRating, formatNumber } from '@/lib/utils';
import { StarDisplay } from '@/components/ui/star-display';
import { handleImgError } from '@/lib/imageUtils';
import { useWishlist } from '@/components/WishlistProvider';
import { useSEO } from '@/hooks/useSEO';

interface SeriesBook {
  id: string;
  title: string;
  slug: string;
  author: string;
  coverImage: string;
  pageCount: number | null;
  googleRating: number | null;
  computedScore: number;
  publishedDate: string | null;
  description: string | null;
  position: number;
  isMainEntry: boolean;
  authorData: { id: string; name: string; slug: string; imageUrl: string | null } | null;
}

interface SeriesDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  totalBooks: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
  books: SeriesBook[];
}

interface SeriesPageProps {
  series: SeriesDetail;
  onBack: () => void;
}

export function SeriesPage({ series, onBack }: SeriesPageProps) {
  const { isInWishlist } = useWishlist();
  const navigate = useNavigate();

  useSEO({
    title: `${series.name} Series | The Book Times`,
    description:
      series.description ||
      `Explore all ${series.totalBooks} books in the ${series.name} series. Read them in order.`,
    ogTitle: `${series.name} Book Series`,
    ogDescription: `${series.totalBooks} books in the ${series.name} series`,
    ogUrl: `${window.location.origin}/series/${series.slug}`,
    canonical: `${window.location.origin}/series/${series.slug}`,
  });

  const sortedBooks = [...series.books].sort((a, b) => a.position - b.position);

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
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <span className="text-sm text-muted-foreground truncate flex-1">{series.name} Series</span>
        </div>
      </div>

      {/* Breadcrumbs */}
      <nav className="container mx-auto px-4 pt-4 pb-0" aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li><Link to="/" className="hover:text-primary transition-colors">Home</Link></li>
          <li className="select-none">/</li>
          <li className="text-foreground font-medium truncate max-w-[200px]">{series.name} Series</li>
        </ol>
      </nav>

      <div className="container mx-auto px-4 py-8">
        {/* Series Header */}
        <div className="mb-10">
          <div className="flex items-start gap-6">
            {series.coverImage && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="hidden sm:block shrink-0 w-32 aspect-[2/3] rounded-lg overflow-hidden shadow-lg"
              >
                <img
                  src={series.coverImage}
                  alt={`${series.name} series`}
                  className="h-full w-full object-cover"
                  onError={handleImgError}
                />
              </motion.div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen className="h-6 w-6 text-primary shrink-0" />
                <h1 className="text-3xl lg:text-4xl font-bold truncate">{series.name}</h1>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="secondary" className="text-sm">
                  {series.totalBooks} {series.totalBooks === 1 ? 'Book' : 'Books'}
                </Badge>
                {series.isComplete && (
                  <Badge variant="outline" className="gap-1 text-sm text-green-600 border-green-300 dark:text-green-400 dark:border-green-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Complete Series
                  </Badge>
                )}
              </div>
              {series.description && (
                <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
                  {series.description}
                </p>
              )}
            </div>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Reading Order */}
        <div>
          <h2 className="text-xl font-semibold mb-6">Reading Order</h2>
          {sortedBooks.length === 0 ? (
            <p className="text-muted-foreground">No books have been added to this series yet.</p>
          ) : (
            <div className="space-y-4">
              {sortedBooks.map((book, index) => {
                const inWishlist = isInWishlist(book.id);

                return (
                  <motion.div
                    key={book.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/book/${book.slug}`}
                      className="group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      {/* Position number */}
                      <div className="shrink-0 w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                        {Number.isInteger(book.position) ? book.position : book.position.toFixed(1)}
                      </div>

                      {/* Cover */}
                      <div className="shrink-0 w-16 sm:w-20 aspect-[2/3] rounded-md overflow-hidden shadow-sm">
                        <img
                          src={book.coverImage}
                          alt={book.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={handleImgError}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                              {book.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                              by{' '}
                              {book.authorData ? (
                                <span className="text-primary">{book.authorData.name}</span>
                              ) : (
                                <span>{book.author}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {inWishlist && (
                              <Heart className="h-4 w-4 fill-red-500 text-red-500" />
                            )}
                            {book.isMainEntry && (
                              <Badge variant="secondary" className="text-xs shrink-0">Main</Badge>
                            )}
                          </div>
                        </div>

                        {/* Rating */}
                        {book.googleRating != null && book.googleRating > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <StarDisplay rating={book.googleRating ?? 0} size="sm" />
                            <span className="text-sm font-medium">{formatRating(book.googleRating)}</span>
                          </div>
                        )}

                        {/* Description preview */}
                        {book.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2 hidden sm:block">
                            {book.description}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {book.publishedDate && (
                            <span>{new Date(book.publishedDate).getFullYear()}</span>
                          )}
                          {book.pageCount && book.pageCount > 0 && (
                            <span>{book.pageCount} pages</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
