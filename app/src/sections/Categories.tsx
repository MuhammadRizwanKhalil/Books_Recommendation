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
    <section id="categories" className="py-12 sm:py-16 md:py-24">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div 
          className="text-center max-w-2xl mx-auto mb-12"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold font-serif flex items-center justify-center gap-3 mb-4">
            <Grid3X3 className="h-8 w-8 text-primary" />
            {t('categories.title')}
          </h2>
          <p className="text-muted-foreground">
            {t('categories.subtitle')}{' '}
            {categoriesDescription}
          </p>
          <Button variant="ghost" className="mt-3" asChild>
            <Link to="/categories">
              View All Categories <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>

        {/* Category Grid */}
        <motion.div 
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {categoriesLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="h-48">
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 w-8 bg-muted rounded" />
                    <div className="h-6 w-3/4 bg-muted rounded" />
                    <div className="h-4 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            categories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
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
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-white/20 text-white">
                            <BookOpen className="w-3 h-3 mr-1" />
                            {category.bookCount.toLocaleString()}
                          </Badge>
                          <ChevronRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                        </div>
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
