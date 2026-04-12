import { Grid3X3, ChevronRight, BookOpen, Sparkles } from 'lucide-react';
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
    <section id="categories" className="py-10 sm:py-14 md:py-16">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-violet-500 to-purple-600 text-white border-0 text-xs px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                Browse Genres
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <Grid3X3 className="h-7 w-7 text-primary" />
              {t('categories.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              {t('categories.subtitle')}{' '}{categoriesDescription}
            </p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/categories">
              View All Categories <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Category Grid */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {categoriesLoading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <Card key={i} className="h-44 sm:h-48">
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
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <Card
                  className="group cursor-pointer overflow-hidden transition-all duration-400 hover:shadow-xl hover:-translate-y-1 h-full focus-within:ring-2 focus-within:ring-primary border-0"
                  role="button"
                  tabIndex={0}
                  onClick={() => openCategory(category)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCategory(category); } }}
                >
                  <div className="relative h-44 sm:h-48 overflow-hidden">
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 group-hover:from-black/90" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 sm:p-4">
                      <h3 className="text-sm sm:text-base font-bold text-white line-clamp-1 mb-1">{category.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-white/70 line-clamp-1 flex-1 mr-2">{category.description}</span>
                        <Badge variant="secondary" className="bg-white/20 text-white text-[10px] px-2 py-0.5 shrink-0 backdrop-blur-sm">
                          <BookOpen className="w-2.5 h-2.5 mr-0.5" />
                          {category.bookCount.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                    {/* Hover arrow indicator */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                      <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                        <ChevronRight className="h-3.5 w-3.5 text-white" />
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
        </motion.div>

        {/* View All CTA */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button variant="outline" size="lg" asChild className="px-8 h-11">
            <Link to="/categories">
              Explore All Categories <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
