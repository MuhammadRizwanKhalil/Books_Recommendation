import { useState } from 'react';
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

const FALLBACK_GRADIENTS = [
  'from-violet-600 to-purple-700',
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
];

export function Categories() {
  const { categories, loading: categoriesLoading } = useCategories();
  const { openCategory } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const categoriesDescription = getSetting('categories_description', 'From fiction to technology, find exactly what you are looking for.');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});

  const displayCategories = categories.slice(0, 6);

  return (
    <section id="categories" className="py-8 sm:py-10 md:py-12">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5"
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

        {/* Category Row — single horizontal scroll */}
        <motion.div
          className="relative"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none lg:hidden" />
          <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none lg:hidden" />
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 lg:grid lg:grid-cols-6 lg:overflow-visible">
          {categoriesLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-32 sm:h-36">
                <CardContent className="p-3">
                  <div className="animate-pulse space-y-2">
                    <div className="h-5 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-full bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            displayCategories.map((category, index) => (
              <motion.div
                key={category.id}
                className="shrink-0 w-[140px] sm:w-[160px] lg:w-auto"
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
                  <div className="relative h-32 sm:h-36 overflow-hidden">
                    {!imgErrors[category.id] && category.imageUrl && category.imageUrl.startsWith('http') ? (
                      <img
                        src={category.imageUrl}
                        alt={category.name}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        loading="lazy"
                        onError={() => setImgErrors(prev => ({ ...prev, [category.id]: true }))}
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]} flex items-center justify-center`}>
                        <BookOpen className="h-8 w-8 text-white/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-all duration-300 group-hover:from-black/90" />
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3">
                      <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-1 mb-0.5">{category.name}</h3>
                      <Badge variant="secondary" className="bg-white/20 text-white text-[9px] px-1.5 py-0 shrink-0 backdrop-blur-sm">
                        <BookOpen className="w-2 h-2 mr-0.5" />
                        {category.bookCount.toLocaleString()} books
                      </Badge>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))
          )}
          </div>
        </motion.div>

        {/* View All CTA */}
        <motion.div
          className="mt-5 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button variant="outline" size="sm" asChild className="px-6">
            <Link to="/categories">
              View All Categories <ChevronRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
