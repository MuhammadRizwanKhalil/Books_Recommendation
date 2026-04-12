import { useState, useEffect, useRef } from 'react';
import { Star, Users, ChevronLeft, ChevronRight, Sparkles, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { booksApi } from '@/api/client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

type AuthorData = {
  id: string;
  name: string;
  slug: string;
  bookCount: number;
  avgRating: number;
  topCover: string;
  imageUrl?: string;
  specialties: string[];
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const COLORS = [
  'bg-gradient-to-br from-blue-500 to-blue-600', 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  'bg-gradient-to-br from-violet-500 to-violet-600', 'bg-gradient-to-br from-amber-500 to-amber-600',
  'bg-gradient-to-br from-rose-500 to-rose-600', 'bg-gradient-to-br from-cyan-500 to-cyan-600',
  'bg-gradient-to-br from-indigo-500 to-indigo-600', 'bg-gradient-to-br from-pink-500 to-pink-600',
  'bg-gradient-to-br from-teal-500 to-teal-600', 'bg-gradient-to-br from-orange-500 to-orange-600',
  'bg-gradient-to-br from-fuchsia-500 to-fuchsia-600', 'bg-gradient-to-br from-lime-500 to-lime-600',
];

export function FeaturedAuthors() {
  const [authors, setAuthors] = useState<AuthorData[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    booksApi.authors(12)
      .then(setAuthors)
      .catch(() => setAuthors([]))
      .finally(() => setLoading(false));
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  return (
    <section id="authors" className="py-10 sm:py-14 md:py-16">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0 text-xs px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                Featured Writers
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <Users className="h-7 w-7 text-primary" />
              Featured Authors
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Explore books from today&rsquo;s most influential authors and acclaimed writers.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll('left')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => scroll('right')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
              <Link to="/search?q=authors">
                View All Authors <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Horizontal scrolling author cards */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide pb-2 -mb-2 px-1"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[150px] sm:w-[160px] flex flex-col items-center gap-2 p-4">
                  <Skeleton className="w-18 h-18 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              ))
            ) : authors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">No authors found yet.</p>
            ) : (
              authors.map((author, index) => (
                <motion.div
                  key={author.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  className="shrink-0"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <Link to={`/author/${author.slug}`} className="group block">
                    <div className="w-[150px] sm:w-[160px] text-center p-4 rounded-xl border bg-card hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
                      <div className="relative mx-auto w-16 h-16 sm:w-18 sm:h-18 mb-3">
                        {author.imageUrl || author.topCover ? (
                          <img
                            src={author.imageUrl || author.topCover}
                            alt={author.name}
                            className="w-full h-full rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all shadow-md"
                            loading="lazy"
                          />
                        ) : (
                          <div className={`w-full h-full rounded-full ${COLORS[index % COLORS.length]} flex items-center justify-center text-white text-sm font-bold ring-2 ring-border group-hover:ring-primary/50 transition-all shadow-md`}>
                            {getInitials(author.name)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm ring-2 ring-background">
                          {author.bookCount}
                        </div>
                      </div>
                      <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 group-hover:text-primary transition-colors">
                        {author.name}
                      </h3>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-[11px] font-medium">{author.avgRating.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-0.5 mt-2">
                        {author.specialties.slice(0, 2).map((s) => (
                          <span key={s} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground leading-none">
                            {s}
                          </span>
                        ))}
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                        <BookOpen className="h-2.5 w-2.5" />
                        <span>{author.bookCount} books</span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
