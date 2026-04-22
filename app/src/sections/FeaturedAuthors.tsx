import { useState, useEffect, useRef } from 'react';
import { Star, ChevronRight, BookOpen, Sparkles, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { booksApi } from '@/api/client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';
import { handleImgError } from '@/lib/imageUtils';

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
  'from-blue-500 via-indigo-500 to-violet-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-violet-500 via-purple-500 to-fuchsia-600',
  'from-amber-500 via-orange-500 to-red-500',
  'from-rose-500 via-pink-500 to-fuchsia-500',
  'from-cyan-500 via-sky-500 to-blue-600',
  'from-indigo-500 via-blue-500 to-cyan-500',
  'from-pink-500 via-rose-500 to-orange-500',
  'from-teal-500 via-emerald-500 to-green-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-pink-500 to-rose-500',
  'from-lime-500 via-green-500 to-emerald-500',
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
    <section id="authors" className="py-12 md:py-16 bg-gradient-to-b from-background via-primary/[0.03] to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Voices We Love
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Featured Authors</h2>
            <p className="text-muted-foreground mt-1 text-sm">Explore books from acclaimed and trending writers</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/search?q=authors">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-4 sm:gap-5 overflow-x-auto scrollbar-hide flex-nowrap pb-2"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
          >
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[200px] flex flex-col items-center gap-2 p-5 rounded-2xl border bg-card">
                <Skeleton className="w-20 h-20 rounded-full" />
                <Skeleton className="h-3.5 w-24 mt-2" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-2.5 w-20 mt-1" />
              </div>
            ))
          ) : authors.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 px-4">No authors found yet.</p>
          ) : (
            displayAuthors.map((author, index) => {
              const realIdx = index % authors.length;
              const gradient = COLORS[realIdx % COLORS.length];
              return (
                <Link
                  key={`${author.name}-${index}`}
                  to={`/author/${author.slug}`}
                  className="group shrink-0 w-[190px] sm:w-[210px]"
                >
                  <div className="relative rounded-2xl overflow-hidden border bg-card hover:shadow-2xl hover:-translate-y-2 hover:border-primary/40 transition-all duration-500">

                    {/* Full-bleed gradient banner with texture */}
                    <div className={`h-24 sm:h-28 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_40%,rgba(255,255,255,0.3),transparent_60%)]" />
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(0,0,0,0.2),transparent_50%)]" />
                      {/* Book count badge top-right */}
                      <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/30 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full">
                        <BookOpen className="h-2.5 w-2.5" />
                        {author.bookCount}
                      </div>
                      {/* Arrow link hint */}
                      <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-white/20 backdrop-blur-sm rounded-full p-1">
                          <ArrowUpRight className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Avatar — overlapping banner */}
                    <div className="-mt-10 px-4 flex flex-col items-center">
                      <div className="relative mb-3">
                        {author.imageUrl || author.topCover ? (
                          <img
                            src={author.imageUrl || author.topCover}
                            alt={author.name}
                            className="w-[72px] h-[72px] rounded-full object-cover ring-[3px] ring-card group-hover:ring-primary/50 transition-all shadow-xl"
                            loading="lazy"
                            onError={handleImgError}
                          />
                        ) : (
                          <div className={`w-[72px] h-[72px] rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white text-xl font-bold ring-[3px] ring-card group-hover:ring-primary/50 transition-all shadow-xl`}>
                            {getInitials(author.name)}
                          </div>
                        )}
                        {/* Rating dot badge */}
                        <div className="absolute -bottom-1 -right-1 flex items-center gap-0.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow ring-2 ring-card">
                          <Star className="h-2 w-2 fill-white" />
                          {author.avgRating.toFixed(1)}
                        </div>
                      </div>

                      {/* Name */}
                      <h3 className="font-serif font-bold text-sm leading-tight text-center line-clamp-2 group-hover:text-primary transition-colors min-h-[2.4em] px-1">
                        {author.name}
                      </h3>

                      {/* Specialty tags */}
                      <div className="flex flex-wrap justify-center gap-1 mt-2 mb-1 min-h-[20px]">
                        {author.specialties.slice(0, 2).map((s) => (
                          <span
                            key={s}
                            className="text-[9px] bg-primary/10 text-primary px-2 py-0.5 rounded-full leading-none font-medium"
                          >
                            {s}
                          </span>
                        ))}
                        {author.specialties.length === 0 && (
                          <span className="text-[9px] text-muted-foreground">Author</span>
                        )}
                      </div>
                    </div>

                    {/* Footer strip */}
                    <div className="mt-2 px-4 pb-4 flex items-center justify-between border-t pt-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BookOpen className="h-2.5 w-2.5" />
                        <span>{author.bookCount} {author.bookCount === 1 ? 'book' : 'books'}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        View <ArrowUpRight className="h-2.5 w-2.5" />
                      </span>
                    </div>

                  </div>
                </Link>
              );
            })
          )}
          </div>
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link to="/search?q=authors">View All Authors <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
