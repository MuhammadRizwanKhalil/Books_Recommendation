import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Calendar, Sparkles, ExternalLink, BookOpen, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRating, getStarRating, truncateText, formatPrice } from '@/lib/utils';
import type { Book } from '@/types';
import { motion } from 'framer-motion';
import { mapBook } from '@/lib/mappers';

export function BookOfTheDay() {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/books/book-of-the-day`)
      .then(r => r.json())
      .then(data => setBook(data ? mapBook(data) : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-8 sm:py-10 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-5">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold font-serif">Book of the Day</h2>
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-0">
              <Skeleton className="aspect-[2/3] sm:w-48 sm:aspect-auto sm:min-h-[260px]" />
              <div className="p-5 space-y-3 flex-1">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (!book) return null;

  const stars = getStarRating(book.googleRating);

  return (
    <section className="py-8 sm:py-10 md:py-12 bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.03]">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-serif">Book of the Day</h2>
            <p className="text-xs text-muted-foreground">
              <Calendar className="inline h-3 w-3 mr-0.5" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <Card className="overflow-hidden border-primary/10 shadow-md hover:shadow-lg transition-shadow duration-300">
            <div className="flex flex-col sm:flex-row gap-0">
              {/* Book Cover - compact */}
              <Link to={`/book/${book.slug}`} className="relative sm:w-48 shrink-0 aspect-[2/3] sm:aspect-auto sm:min-h-[280px] overflow-hidden group">
                <img
                  src={book.coverImage}
                  alt={`${book.title} by ${book.author}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground shadow-md text-xs">
                  <Sparkles className="h-3 w-3 mr-0.5" /> Pick of the Day
                </Badge>
              </Link>

              {/* Details - compact */}
              <div className="p-4 sm:p-5 flex flex-col justify-center flex-1">
                <div className="space-y-2.5">
                  <div>
                    <Link to={`/book/${book.slug}`} className="hover:text-primary transition-colors">
                      <h3 className="text-lg sm:text-xl font-bold font-serif line-clamp-2">{book.title}</h3>
                    </Link>
                    {book.subtitle && (
                      <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{book.subtitle}</p>
                    )}
                    <p className="text-sm font-medium mt-1">{book.author}</p>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
                    <div className="flex items-center gap-0.5" aria-hidden="true">
                      {Array.from({ length: stars.full }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      ))}
                      {stars.half && <Star className="h-3.5 w-3.5 fill-yellow-400/50 text-yellow-400" />}
                      {Array.from({ length: stars.empty }).map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 text-gray-300" />
                      ))}
                    </div>
                    <span className="text-sm font-medium">{formatRating(book.googleRating)}</span>
                    <span className="text-xs text-muted-foreground">({book.ratingsCount.toLocaleString()})</span>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {truncateText(book.description, 200)}
                  </p>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-1.5">
                    {book.categories.slice(0, 4).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">{cat}</Badge>
                    ))}
                    {(book.pageCount ?? 0) > 0 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        <BookOpen className="h-2.5 w-2.5 mr-0.5" />{book.pageCount} pages
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Button size="sm" className="h-8 text-xs" asChild>
                      <Link to={`/book/${book.slug}`}>
                        View Details <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>

                    {(book.price ?? 0) > 0 && (
                      <span className="text-base font-bold text-primary">
                        {formatPrice(book.price, book.currency)}
                      </span>
                    )}

                    {book.amazonUrl && (
                      <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
                        <a href={book.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                          Buy on Amazon <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
