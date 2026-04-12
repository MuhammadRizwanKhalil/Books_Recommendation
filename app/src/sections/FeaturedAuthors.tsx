import { useState, useEffect, useRef } from 'react';
import { Star, Users, ChevronLeft, ChevronRight } from 'lucide-react';
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
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-pink-500',
  'bg-teal-500', 'bg-orange-500', 'bg-fuchsia-500', 'bg-lime-500',
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
    <section id="authors" className="py-8 sm:py-10 md:py-14">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex items-end justify-between gap-3 mb-5"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-1">
            <Badge variant="default" className="bg-indigo-500 text-xs">
              <Users className="w-3 h-3 mr-1" />
              Featured Writers
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold font-serif flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Featured Authors
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">
              Explore books from today&rsquo;s most influential authors and acclaimed writers.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll('left')}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={() => scroll('right')}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>

        {/* Horizontal scrolling author cards */}
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mb-2 px-1"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[140px] flex flex-col items-center gap-2 p-3">
                  <Skeleton className="w-16 h-16 rounded-full" />
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
                    <div className="w-[130px] sm:w-[140px] text-center p-3 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-300">
                      <div className="relative mx-auto w-14 h-14 mb-2.5">
                        {author.imageUrl || author.topCover ? (
                          <img
                            src={author.imageUrl || author.topCover}
                            alt={author.name}
                            className="w-full h-full rounded-full object-cover ring-2 ring-border group-hover:ring-primary/50 transition-all shadow-sm"
                          />
                        ) : (
                          <div className={`w-full h-full rounded-full ${COLORS[index % COLORS.length]} flex items-center justify-center text-white text-sm font-bold ring-2 ring-border group-hover:ring-primary/50 transition-all`}>
                            {getInitials(author.name)}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-primary-foreground text-[9px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                          {author.bookCount}
                        </div>
                      </div>
                      <h3 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
                        {author.name}
                      </h3>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                        <span className="text-[10px] font-medium">{author.avgRating.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                        {author.specialties.slice(0, 2).map((s) => (
                          <span key={s} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground leading-none">
                            {s}
                          </span>
                        ))}
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
