import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Sparkles, Calendar, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRating } from '@/lib/utils';
import { handleImgError } from '@/lib/imageUtils';
import type { Book } from '@/types';
import { motion } from 'framer-motion';
import { mapBook } from '@/lib/mappers';
import { booksApi } from '@/api/client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function BookOfTheDay() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_URL}/books/book-of-the-day`).then(r => r.json()).catch(() => null),
      booksApi.topRated(12).catch(() => []),
    ])
      .then(([botd, top]) => {
        if (cancelled) return;
        const result: Book[] = [];
        const seen = new Set<string>();
        const pushBook = (raw: any) => {
          if (!raw) return;
          const b = mapBook(raw);
          if (!b?.id || seen.has(b.id)) return;
          seen.add(b.id);
          result.push(b);
        };
        pushBook(botd);
        for (const r of (top as any[])) {
          if (result.length >= 6) break;
          pushBook(r);
        }
        setBooks(result.slice(0, 6));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <Skeleton className="h-9 w-56 mb-6" />
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (books.length === 0) return null;

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background via-amber-500/[0.04] to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20 border border-amber-500/20">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
                Books of the Day
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Calendar className="h-3 w-3" />
                {today}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {books.map((book, idx) => (
            <motion.div
              key={book.id}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
            >
              <Link
                to={`/book/${book.slug}`}
                className="group block rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 hover:border-primary/30 transition-all duration-300"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-muted">
                  <img
                    src={book.coverImage}
                    alt={`${book.title} by ${book.author}`}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    onError={handleImgError}
                  />

                  {/* Top badges */}
                  {idx === 0 && (
                    <Badge className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow text-[9px] px-1.5 py-0 z-10">
                      <Sparkles className="h-2 w-2 mr-0.5" />
                      Today
                    </Badge>
                  )}

                  {/* Hover detail overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/50 opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity duration-300 z-10 flex flex-col justify-between p-2">
                    {/* Categories */}
                    <div className="flex flex-wrap gap-0.5 pt-1">
                      {book.categories.slice(0, 1).map(c => (
                        <span key={c} className="text-[8px] sm:text-[9px] bg-white/20 text-white px-1.5 py-0 rounded-full">{c}</span>
                      ))}
                    </div>

                    {/* Detail */}
                    <div className="space-y-1">
                      <h4 className="font-serif font-bold text-white text-[10px] sm:text-xs leading-snug line-clamp-3">
                        {book.title}
                      </h4>
                      <p className="text-white/75 text-[9px] sm:text-[10px] line-clamp-1">{book.author}</p>
                      {book.googleRating ? (
                        <div className="flex items-center gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          <span className="text-white text-[9px] sm:text-[10px] font-semibold">{formatRating(book.googleRating)}</span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-center bg-primary text-primary-foreground text-[9px] font-bold py-1 rounded-md mt-1">
                        View Book
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-1.5 space-y-0.5">
                  <h3 className="font-serif font-semibold text-[10px] sm:text-xs leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                    {book.title}
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground line-clamp-1">{book.author}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
