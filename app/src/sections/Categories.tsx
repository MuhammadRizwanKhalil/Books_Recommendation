import { Grid3X3, ChevronRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCategories } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function Categories() {
  const { categories, loading: categoriesLoading } = useCategories();
  const { openCategory } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const categoriesDescription = getSetting('categories_description', 'From fiction to technology, find exactly what you are looking for.');

  return (
    <section id="categories" className="py-8 sm:py-10 md:py-14">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-bold font-serif flex items-center gap-2">
              <Grid3X3 className="h-6 w-6 text-primary" />
              {t('categories.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">
              {t('categories.subtitle')}{' '}{categoriesDescription}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/categories">
              View All <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Category Grid - Compact */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {categoriesLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="h-36">
                <CardContent className="p-4">
                  <div className="animate-pulse space-y-3">
                    <div className="h-6 w-6 bg-muted rounded" />
                    <div className="h-5 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 h-full focus-within:ring-2 focus-within:ring-primary"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCategory(category)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(category); } }}
                >
                  <div className="relative h-36 sm:h-40 overflow-hidden">
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1">{category.name}</h3>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-white/70 line-clamp-1 flex-1 mr-2">{category.description}</span>
                        <Badge variant="secondary" className="bg-white/20 text-white text-[10px] px-1.5 py-0 shrink-0">
                          <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                          {category.bookCount.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>
      </div>
    </section>
  );
}
