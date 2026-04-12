import { useState } from 'react';
import { TrendingUp, ChevronRight, ChevronDown, Flame, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookGrid } from '@/components/book/BookGrid';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatRating } from '@/lib/utils';

export function Trending() {
  const [showAll, setShowAll] = useState(false);
  const { books, loading } = useTrendingBooks(showAll ? 24 : 8);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const trendingBadge = getSetting('trending_badge', 'Hot Right Now');
  const trendingDescription = getSetting('trending_description', 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.');

  return (
    <section id="trending" className="py-8 sm:py-10 md:py-14 bg-muted/40">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-1.5">
            <Badge variant="default" className="bg-primary text-xs">
              <Flame className="w-3 h-3 mr-1" />
              {trendingBadge}
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              {t('trending.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">{trendingDescription}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
              {showAll ? t('common.showLess') : t('trending.viewAll')}
              {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/trending">
                View All <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Featured #1 - Compact horizontal card */}
        {!loading && books.length > 0 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div
              className="flex flex-col sm:flex-row gap-4 sm:gap-5 bg-card rounded-xl p-4 sm:p-5 shadow-md border cursor-pointer hover:shadow-lg transition-shadow group"
              role="button"
              tabIndex={0}
              onClick={() => openBook(books[0])}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}
            >
              <div className="relative w-full sm:w-32 shrink-0 aspect-[3/4] sm:aspect-auto sm:h-44 overflow-hidden rounded-lg bg-muted">
                <img src={books[0].coverImage} alt={books[0].title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5">
                  {t('trending.numberOne')}
                </Badge>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {books[0].categories.slice(0, 3).map((cat) => (
                    <Badge key={cat} variant="secondary" className="text-[10px] px-1.5 py-0">{cat}</Badge>
                  ))}
                </div>
                <h3 className="text-lg sm:text-xl font-bold line-clamp-1 group-hover:text-primary transition-colors">{books[0].title}</h3>
                <p className="text-sm text-muted-foreground">{books[0].author}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{books[0].description}</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{formatRating(books[0].googleRating)}</span>
                    <span className="text-xs text-muted-foreground">({books[0].ratingsCount.toLocaleString()})</span>
                  </div>
                  <Button size="sm" className="h-7 text-xs ml-auto" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                    <a href={books[0].amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                      {t('trending.buyOnAmazon')}
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Book Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <BookGrid books={books.slice(1)} loading={loading} columns={4} />
        </motion.div>
      </div>
    </section>
  );
}
