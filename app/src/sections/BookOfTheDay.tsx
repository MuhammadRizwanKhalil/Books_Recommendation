import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Calendar, Sparkles, ExternalLink, BookOpen, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
      <section className="py-10 sm:py-16 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-2xl md:text-3xl font-bold">Book of the Day</h2>
          </div>
          <Card className="overflow-hidden">
            <div className="grid md:grid-cols-[280px_1fr] gap-0">
              <Skeleton className="aspect-[2/3] md:aspect-auto md:min-h-[400px]" />
              <CardContent className="p-8 space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (!book) return null;

  const stars = getStarRating(book.googleRating);

  return (
    <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-br from-primary/[0.03] via-background to-primary/[0.03]">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold font-serif">Book of the Day</h2>
            <p className="text-sm text-muted-foreground">
              <Calendar className="inline h-3.5 w-3.5 mr-1" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <div className="grid md:grid-cols-[300px_1fr] gap-0">
              {/* Book Cover */}
              <Link to={`/book/${book.slug}`} className="relative aspect-[2/3] md:aspect-auto md:min-h-[400px] overflow-hidden group">
                <img
                  src={book.coverImage}
                  alt={`${book.title} by ${book.author}`}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary text-primary-foreground shadow-lg">
                    <Sparkles className="h-3 w-3 mr-1" /> Pick of the Day
                  </Badge>
                </div>
              </Link>

              {/* Book Details */}
              <CardContent className="p-6 md:p-8 flex flex-col justify-center">
                <div className="space-y-4">
                  <div>
                    <Link to={`/book/${book.slug}`} className="hover:text-primary transition-colors">
                      <h3 className="text-2xl md:text-3xl font-bold font-serif line-clamp-2">{book.title}</h3>
                    </Link>
                    {book.subtitle && (
                      <p className="text-muted-foreground mt-1 line-clamp-1">{book.subtitle}</p>
                    )}
                    <p className="text-lg font-medium mt-2">{book.author}</p>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-2" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
                    <div className="flex items-center gap-0.5" aria-hidden="true">
                      {Array.from({ length: stars.full }).map((_, i) => (
                        <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      ))}
                      {stars.half && <Star className="h-5 w-5 fill-yellow-400/50 text-yellow-400" />}
                      {Array.from({ length: stars.empty }).map((_, i) => (
                        <Star key={i} className="h-5 w-5 text-gray-300" />
                      ))}
                    </div>
                    <span className="font-medium">{formatRating(book.googleRating)}</span>
                    <span className="text-muted-foreground text-sm">({book.ratingsCount.toLocaleString()} ratings)</span>
                  </div>

                  {/* Description */}
                  <p className="text-muted-foreground leading-relaxed line-clamp-4">
                    {truncateText(book.description, 300)}
                  </p>

                  {/* Categories */}
                  <div className="flex flex-wrap gap-2">
                    {book.categories.slice(0, 4).map((cat) => (
                      <Badge key={cat} variant="secondary">{cat}</Badge>
                    ))}
                  </div>

                  {/* Book meta */}
                  {(book.pageCount ?? 0) > 0 && (
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" /> {book.pageCount} pages
                      </span>
                      {book.publisher && (
                        <span>{book.publisher}</span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <Button asChild>
                      <Link to={`/book/${book.slug}`}>
                        View Details <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>

                    {(book.price ?? 0) > 0 && (
                      <span className="text-xl font-bold text-primary">
                        {formatPrice(book.price, book.currency)}
                      </span>
                    )}

                    {book.amazonUrl && (
                      <Button variant="outline" asChild>
                        <a href={book.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                          Buy on Amazon <ExternalLink className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
