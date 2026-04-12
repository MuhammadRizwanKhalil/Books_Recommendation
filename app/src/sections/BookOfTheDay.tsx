import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Calendar, Sparkles, ExternalLink, BookOpen, ArrowRight, Clock, Award } from 'lucide-react';
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
      <section className="py-10 sm:py-14 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl md:text-2xl font-bold font-serif">Book of the Day</h2>
          </div>
          <Card className="overflow-hidden">
            <div className="flex flex-col md:flex-row gap-0">
              <Skeleton className="aspect-[2/3] md:w-64" />
              <div className="p-6 space-y-4 flex-1">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          </Card>
        </div>
      </section>
    );
  }

  if (!book) return null;

  const stars = getStarRating(book.googleRating);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="py-10 sm:py-14 md:py-16 bg-gradient-to-br from-primary/[0.04] via-background to-primary/[0.04]">
      <div className="container mx-auto px-4">
        {/* Section header */}
        <motion.div
          className="flex items-center justify-between mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif">Book of the Day</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {today} &mdash; Curated daily by our editors
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden border-primary/10 shadow-xl hover:shadow-2xl transition-all duration-500 group">
            <div className="flex flex-col md:flex-row">
              {/* Book Cover - larger */}
              <Link to={`/book/${book.slug}`} className="relative md:w-64 shrink-0 aspect-[2/3] md:aspect-auto md:min-h-[340px] overflow-hidden">
                <img
                  src={book.coverImage}
                  alt={`${book.title} by ${book.author}`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-transparent" />
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg text-xs px-3 py-1">
                  <Sparkles className="h-3 w-3 mr-1" /> Today&apos;s Pick
                </Badge>
              </Link>

              {/* Details */}
              <div className="p-5 sm:p-7 md:p-8 flex flex-col justify-center flex-1 space-y-3.5">
                <div>
                  <Link to={`/book/${book.slug}`} className="hover:text-primary transition-colors">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif leading-tight">{book.title}</h3>
                  </Link>
                  {book.subtitle && (
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-1 italic">{book.subtitle}</p>
                  )}
                  <p className="text-sm font-medium mt-1.5">{t('common.by') || 'by'} <span className="text-primary">{book.author}</span></p>
                </div>

                {/* Rating - full stars */}
                <div className="flex items-center gap-2" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < Math.round(book.googleRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-bold">{formatRating(book.googleRating)}</span>
                  <span className="text-xs text-muted-foreground">({book.ratingsCount.toLocaleString()} ratings)</span>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  {truncateText(book.description, 300)}
                </p>

                {/* Categories + page count */}
                <div className="flex flex-wrap items-center gap-2">
                  {book.categories.slice(0, 5).map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-xs px-2 py-0.5">{cat}</Badge>
                  ))}
                  {(book.pageCount ?? 0) > 0 && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5">
                      <BookOpen className="h-3 w-3 mr-1" />{book.pageCount} pages
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="default" className="h-10 px-6 shadow-md shadow-primary/20" asChild>
                    <Link to={`/book/${book.slug}`}>
                      View Details <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>

                  {(book.price ?? 0) > 0 && (
                    <span className="text-lg font-bold text-primary">
                      {formatPrice(book.price, book.currency)}
                    </span>
                  )}

                  {book.amazonUrl && (
                    <Button variant="outline" className="h-10 px-5" asChild>
                      <a href={book.amazonUrl} target="_blank" rel="nofollow sponsored noopener noreferrer">
                        Buy on Amazon <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}

function t(key: string): string { return key; }
