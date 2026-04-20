import { useState, useEffect, useRef } from 'react';
import { Star, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { booksApi } from '@/api/client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

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
  const isPausedRef = useRef(false);

  useEffect(() => {
    booksApi.authors(12)
      .then(setAuthors)
      .catch(() => setAuthors([]))
      .finally(() => setLoading(false));
  }, []);

  const displayAuthors = authors.length > 0 ? [...authors, ...authors] : [];

  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: authors.length > 0,
    speed: 0.3,
  });

  return (
    <section id="authors" className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Featured Authors</h2>
            <p className="text-muted-foreground mt-1">Explore books from acclaimed and trending writers</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/search?q=authors">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>
      </div>

      <div className="container mx-auto px-4">
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide flex-nowrap"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
          >
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-[150px] flex flex-col items-center gap-2 p-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-2.5 w-14" />
                </div>
              ))
            ) : authors.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">No authors found yet.</p>
            ) : (
              displayAuthors.map((author, index) => (
                <div key={`${author.name}-${index}`} className="shrink-0">
                  <Link to={`/author/${author.slug}`} className="group block">
                    <div className="w-[150px] text-center p-4 rounded-2xl border bg-card hover:shadow-lg hover:border-primary/20 hover:-translate-y-1 transition-all duration-300">
                      <div className="relative mx-auto w-16 h-16 mb-3">
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
                      <h3 className="font-semibold text-xs line-clamp-1 group-hover:text-primary transition-colors">
                        {author.name}
                      </h3>
                      <div className="flex items-center justify-center gap-0.5 mt-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{author.avgRating.toFixed(1)}</span>
                      </div>
                      <div className="flex flex-wrap justify-center gap-0.5 mt-2">
                        {author.specialties.slice(0, 2).map((s) => (
                          <span key={s} className="text-[9px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground leading-none">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
