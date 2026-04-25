import { useState } from 'react';
import { Grid3X3, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCategories } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSEO } from '@/hooks/useSEO';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';

const FALLBACK_GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
  'from-indigo-600 to-blue-700',
  'from-pink-600 to-rose-700',
];

export function CategoriesPage() {
  const { categories, loading } = useCategories();
  const { openCategory } = useAppNav();
  const { t } = useTranslation();
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  useSEO({
    title: 'All Book Categories | The Book Times',
    description: 'Browse books by category. Fiction, Non-Fiction, Science, Technology, Self-Help, Business, and more.',
    ogTitle: 'All Book Categories | The Book Times',
    ogDescription: 'Browse books by category — from Fiction to Technology.',
    ogUrl: `${window.location.origin}/categories`,
    canonical: `${window.location.origin}/categories`,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/40 border-b">
        <div className="container mx-auto px-4 py-8 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h1 className="text-3xl md:text-4xl font-bold font-serif flex items-center gap-3 mb-2">
              <Grid3X3 className="h-8 w-8 text-primary" />
              All Categories
            </h1>
            <p className="text-sm text-muted-foreground">
              From fiction to technology, find exactly what you're looking for.
              Browse our complete collection organized by genre.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Grid */}
        <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {Array.from({ length: 15 }).map((_, i) => (
              <Card key={i} className="h-28 py-0 gap-0 overflow-hidden">
                <CardContent className="p-3">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.02 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full focus-within:ring-2 focus-within:ring-primary border-0 py-0 gap-0"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCategory(category)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(category); } }}
                >
                  <div className="relative h-28 overflow-hidden">
                    {!imgErrors[category.id] && category.imageUrl && category.imageUrl.startsWith('http') ? (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        onError={() => setImgErrors(prev => ({ ...prev, [category.id]: true }))}
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]} flex items-center justify-center`}>
                        <BookOpen className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold mb-0.5 line-clamp-1">{category.name}</h3>
                          <p className="text-[11px] text-white/70 line-clamp-1">{category.description}</p>
                        </div>
                        <Badge variant="secondary" className="bg-white/20 text-white shrink-0 text-[10px] ml-2">
                          <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                          {category.bookCount.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
