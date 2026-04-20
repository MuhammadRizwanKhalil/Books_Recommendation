import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Sparkles, ExternalLink, BookOpen, ArrowRight, Calendar, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRating, truncateText, formatPrice } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';
import type { Book } from '@/types';
import { motion } from 'framer-motion';
import { mapBook } from '@/lib/mappers';
import { StarDisplay } from '@/components/ui/star-display';

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
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="flex gap-6 rounded-2xl border p-6">
            <Skeleton className="w-48 aspect-[2/3] rounded-xl shrink-0" />
            <div className="space-y-4 flex-1">
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!book) return null;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-center gap-3 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20">
            <Award className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Book of the Day</h2>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {today}
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <div className="overflow-hidden rounded-2xl border shadow-lg hover:shadow-2xl transition-all duration-500 group">
            <div className="flex flex-col md:flex-row">
              <Link to={`/book/${book.slug}`} className="relative md:w-64 shrink-0 aspect-[2/3] md:aspect-auto md:min-h-[340px] overflow-hidden md:m-4 md:rounded-xl">
                <img
                  src={book.coverImage}
                  alt={`${book.title} by ${book.author}`}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105 md:rounded-xl"
                  loading="lazy"
                  onError={handleImgError}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:hidden" />
                <Badge className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg text-xs px-3 py-1">
                  <Sparkles className="h-3 w-3 mr-1" /> Today&apos;s Pick
                </Badge>
              </Link>

              <div className="p-5 sm:p-7 md:p-8 flex flex-col justify-center flex-1 space-y-3.5">
                <div>
                  <Link to={`/book/${book.slug}`} className="hover:text-primary transition-colors">
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">{book.title}</h3>
                  </Link>
                  {book.subtitle && (
                    <p className="text-muted-foreground text-sm mt-1 line-clamp-1 italic">{book.subtitle}</p>
                  )}
                  <p className="text-sm font-medium mt-1.5">by <span className="text-primary">{book.author}</span></p>
                </div>

                <div className="flex items-center gap-2" role="img" aria-label={`Rating: ${formatRating(book.googleRating)} out of 5 stars`}>
                  <StarDisplay rating={book.googleRating || 0} size="xs" />
                  <span className="text-sm font-bold">{formatRating(book.googleRating)}</span>
                  <span className="text-xs text-muted-foreground">({book.ratingsCount.toLocaleString()} ratings)</span>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                  {truncateText(book.description, 300)}
                </p>

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

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button size="default" className="h-10 px-6" asChild>
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
          </div>
        </motion.div>
      </div>
    </section>
  );
}
