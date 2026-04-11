import { useState } from 'react';
import { TrendingUp, ChevronRight, ChevronDown, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookGrid } from '@/components/book/BookGrid';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';

export function Trending() {
  const [showAll, setShowAll] = useState(false);
  const { books, loading } = useTrendingBooks(showAll ? 24 : 8);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const trendingBadge = getSetting('trending_badge', 'Hot Right Now');
  const trendingDescription = getSetting('trending_description', 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.');

  return (
    <section id="trending" className="py-12 sm:py-16 md:py-24 bg-muted/40">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div 
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary">
                <Flame className="w-3 h-3 mr-1" />
                {trendingBadge}
              </Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-serif flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              {t('trending.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl">
              {trendingDescription}
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('common.showLess') : t('trending.viewAll')}
            {showAll ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </motion.div>

        {/* Featured Book */}
        {!loading && books.length > 0 && (
          <motion.div 
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="grid md:grid-cols-2 gap-8 items-center bg-card rounded-2xl p-6 md:p-8 shadow-lg border cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary" role="button" tabIndex={0} onClick={() => openBook(books[0])} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}>
              <div className="relative aspect-[2/3] md:aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                <img
                  src={books[0].coverImage}
                  alt={books[0].title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary text-primary-foreground text-sm px-3 py-1">
                    {t('trending.numberOne')}
                  </Badge>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {books[0].categories.slice(0, 3).map((cat) => (
                    <Badge key={cat} variant="secondary">{cat}</Badge>
                  ))}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">{books[0].title}</h3>
                <p className="text-lg text-muted-foreground">{books[0].author}</p>
                <p className="text-muted-foreground line-clamp-3">{books[0].description}</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-2xl font-bold">{books[0].googleRating}</span>
                    <span className="text-muted-foreground">/5</span>
                  </div>
                  <span className="text-muted-foreground">
                    {books[0].ratingsCount.toLocaleString()} {t('trending.ratings')}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button className="w-full sm:w-auto" asChild>
                    <a href={books[0].amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                      {t('trending.buyOnAmazon')}
                    </a>
                  </Button>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={(e) => { e.stopPropagation(); openBook(books[0]); }}>{t('trending.viewDetails')}</Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Book Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="text-xl font-semibold mb-6">{t('trending.moreTrending')}</h3>
          <BookGrid books={books.slice(1)} loading={loading} columns={4} />
        </motion.div>
      </div>
    </section>
  );
}
