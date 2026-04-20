import { useState } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCategories } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
  'from-fuchsia-600 to-pink-700',
  'from-lime-600 to-green-700',
];

export function Categories() {
  const { categories, loading } = useCategories();
  const { openCategory } = useAppNav();
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const display = categories.slice(0, 8);

  if (loading) {
    return (
      <section className="py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

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
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Browse by Genre</h2>
            <p className="text-muted-foreground mt-1">Find your next read in your favorite category</p>
          </div>
          <Button variant="ghost" size="sm" asChild className="hidden sm:flex">
            <Link to="/categories">View All <ChevronRight className="ml-1 h-4 w-4" /></Link>
          </Button>
        </motion.div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {display.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
            >
              <button
                onClick={() => openCategory(category)}
                className="relative w-full h-40 sm:h-48 rounded-2xl overflow-hidden group cursor-pointer border shadow-sm hover:shadow-xl transition-all duration-500"
              >
                {!imgErrors[category.id] && category.imageUrl?.startsWith('http') ? (
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                    onError={() => setImgErrors(prev => ({ ...prev, [category.id]: true }))}
                  />
                ) : (
                  <div className={`absolute inset-0 bg-gradient-to-br ${GRADIENTS[index % GRADIENTS.length]}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent group-hover:from-black/90 transition-all duration-300" />
                <div className="absolute inset-0 flex flex-col justify-end p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">{category.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <BookOpen className="h-3 w-3 text-white/70" />
                    <span className="text-white/70 text-xs">{category.bookCount.toLocaleString()} books</span>
                  </div>
                </div>
                {/* Hover arrow */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <ChevronRight className="h-4 w-4 text-white" />
                </div>
              </button>
            </motion.div>
          ))}
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
