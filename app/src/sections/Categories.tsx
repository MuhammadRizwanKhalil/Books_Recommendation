import { useRef, useState } from 'react';
import { ChevronRight, BookOpen, Library } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCategories } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

const GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
  'from-fuchsia-600 to-pink-700',
  'from-lime-600 to-green-700',
  'from-red-600 to-rose-700',
  'from-indigo-600 to-violet-700',
  'from-teal-600 to-emerald-700',
  'from-orange-600 to-amber-700',
];

export function Categories() {
  const { categories, loading } = useCategories();
  const { openCategory } = useAppNav();
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  const display = categories.slice(0, 16);
  const looped = display.length > 0 ? [...display, ...display] : [];

  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: display.length > 0,
    speed: 0.35,
  });

  if (loading) {
    return (
      <section className="py-12 md:py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[200px] h-44 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (display.length === 0) return null;

  return (
    <section id="categories" className="py-12 md:py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <motion.div
          className="flex items-end justify-between mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary mb-2">
              <Library className="h-3.5 w-3.5" />
              Browse Genres
            </div>
            <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight">Browse by Genre</h2>
            <p className="text-muted-foreground mt-1 text-sm">Find your next read in your favorite category</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/categories">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-r from-muted/30 to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-10 sm:w-16 bg-gradient-to-l from-muted/30 to-transparent z-10 pointer-events-none" />

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
          >
            {looped.map((category, index) => {
              const realIdx = index % display.length;
              const errorKey = `${category.id}-${index}`;
              return (
                <button
                  key={errorKey}
                  onClick={() => openCategory(category)}
                  className="shrink-0 w-[180px] sm:w-[210px] h-44 sm:h-48 rounded-2xl overflow-hidden group cursor-pointer border bg-card shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 relative"
                  aria-label={`Browse ${category.name}`}
                >
                  {!imgErrors[errorKey] && category.imageUrl?.startsWith('http') ? (
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                      onError={() => setImgErrors(prev => ({ ...prev, [errorKey]: true }))}
                    />
                  ) : (
                    <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[realIdx % GRADIENTS.length]}`}>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.15),transparent_60%)]" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-300" />
                  <div className="absolute inset-0 flex flex-col justify-end p-4 text-left">
                    <h3 className="text-white font-serif font-bold text-lg leading-tight">{category.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <BookOpen className="h-3 w-3 text-white/70" />
                      <span className="text-white/70 text-xs">{category.bookCount.toLocaleString()} books</span>
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                    <ChevronRight className="h-4 w-4 text-white" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center mt-6 sm:hidden">
          <Button variant="outline" size="sm" asChild>
            <Link to="/categories">View All Categories <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
