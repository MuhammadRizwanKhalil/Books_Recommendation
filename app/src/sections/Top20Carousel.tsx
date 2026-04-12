import { useRef, useEffect } from 'react';
import { TrendingUp, Star, Crown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTopRated } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { formatRating, formatPrice } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { handleImgError } from '@/lib/imageUtils';
import type { Book } from '@/types';

export function Top20Carousel() {
  const { books, loading } = useTopRated(20);
  const { openBook } = useAppNav();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || books.length === 0) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isPausedRef.current && lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += 0.4 * (delta / 16);
        const halfWidth = el.scrollWidth / 2;
        if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }
      lastTime = time;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [books.length]);

  if (loading) {
    return (
      <section className="py-8 sm:py-10 md:py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold">Top 20 Books</h2>
          </div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[130px] sm:w-[150px]">
                <Skeleton className="aspect-[2/3] rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (books.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 md:py-14 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 text-xs px-3 py-1">
                <Crown className="w-3 h-3 mr-1" />
                Editor's Choice
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              Top 20 Books
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">Highest rated across all categories — hover to reveal details</p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/search?sort=rating">
              View All Rated <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      </div>

      {/* Contained auto-scrolling carousel */}
      <div className="container mx-auto px-4">
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
            style={{ scrollBehavior: 'auto' }}
          >
        {displayBooks.map((book, idx) => (
          <FlipCard key={`${book.id}-${idx}`} book={book} onBookClick={openBook} rank={idx < books.length ? idx + 1 : undefined} />
        ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FlipCard({ book, onBookClick, rank }: { book: Book; onBookClick: (b: Book) => void; rank?: number }) {
  return (
    <div
      className="shrink-0 w-[130px] sm:w-[150px] cursor-pointer group/flip"
      style={{ perspective: '800px' }}
      onClick={() => onBookClick(book)}
    >
      <div className="relative w-full aspect-[2/3] transition-transform duration-500 [transform-style:preserve-3d] group-hover/flip:[transform:rotateY(180deg)]">
        {/* Front */}
        <div className="absolute inset-0 rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow [backface-visibility:hidden]">
          <img src={book.coverImage} alt={book.title} className="h-full w-full object-cover" loading="lazy" onError={handleImgError} />
          {rank && rank <= 3 && (
            <div className="absolute top-2 left-2">
              <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md ${
                rank === 1 ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                rank === 2 ? 'bg-white/90 text-gray-700' :
                'bg-amber-600/90 text-white'
              }`}>
                #{rank}
              </div>
            </div>
          )}
        </div>
        {/* Back */}
        <div className="absolute inset-0 rounded-xl overflow-hidden bg-card border shadow-lg p-3 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="space-y-1.5 overflow-hidden">
            <h4 className="font-bold text-xs line-clamp-2 leading-tight">{book.title}</h4>
            <p className="text-[10px] text-primary font-medium">{book.author}</p>
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`h-2.5 w-2.5 ${s <= Math.round(book.googleRating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
              ))}
              <span className="text-[10px] font-medium ml-0.5">{formatRating(book.googleRating)}</span>
            </div>
            <p className="text-[9px] text-muted-foreground line-clamp-4 leading-relaxed">{book.description}</p>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t mt-1">
            {book.price ? (
              <span className="text-[10px] font-bold text-primary">{formatPrice(book.price, book.currency)}</span>
            ) : <span />}
            <span className="text-[9px] text-primary font-semibold">View →</span>
          </div>
        </div>
      </div>
    </div>
  );
}
