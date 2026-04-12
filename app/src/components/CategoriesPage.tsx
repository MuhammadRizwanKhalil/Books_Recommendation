import { Grid3X3, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useCategories } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSEO } from '@/hooks/useSEO';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';

export function CategoriesPage() {
  const { categories, loading } = useCategories();
  const { openCategory } = useAppNav();
  const { t } = useTranslation();

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
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <h1 className="text-4xl md:text-5xl font-bold font-serif flex items-center gap-3 mb-4">
              <Grid3X3 className="h-10 w-10 text-primary" />
              All Categories
            </h1>
            <p className="text-lg text-muted-foreground">
              From fiction to technology, find exactly what you're looking for.
              Browse our complete collection organized by genre.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Grid */}
      <div className="container mx-auto px-4 py-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="h-52">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 w-8 bg-muted rounded" />
                    <div className="h-6 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.03 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 h-full focus-within:ring-2 focus-within:ring-primary"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCategory(category)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(category); } }}
                >
                  <div className="relative h-52 overflow-hidden">
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{category.name}</h3>
                          <p className="text-sm text-white/80 line-clamp-1">{category.description}</p>
                        </div>
                        <Badge variant="secondary" className="bg-white/20 text-white shrink-0">
                          <BookOpen className="w-3 h-3 mr-1" />
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
