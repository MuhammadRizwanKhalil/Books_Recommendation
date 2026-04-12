import { useState } from 'react';
import { TrendingUp, ChevronRight, ChevronDown, Flame, Star, ExternalLink, Eye, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  const { books, loading } = useTrendingBooks(showAll ? 24 : 12);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const trendingBadge = getSetting('trending_badge', 'Hot Right Now');
  const trendingDescription = getSetting('trending_description', 'Discover what readers are loving right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface the hottest books.');

  return (
    <section id="trending" className="py-10 sm:py-14 md:py-16 bg-gradient-to-b from-muted/60 via-muted/30 to-background">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 text-xs px-3 py-1">
                <Flame className="w-3 h-3 mr-1" />
                {trendingBadge}
              </Badge>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Updated hourly
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <TrendingUp className="h-7 w-7 text-primary" />
              {t('trending.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{trendingDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="transition-all duration-300">
              {showAll ? t('common.showLess') : 'Show More'}
              {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
            <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
              <Link to="/trending">
                View All Trending <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Featured #1 — enhanced spotlight card */}
        {!loading && books.length > 0 && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <Card
              className="overflow-hidden border-primary/10 shadow-lg hover:shadow-xl transition-all duration-500 cursor-pointer group"
              onClick={() => openBook(books[0])}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}
            >
              <div className="flex flex-col sm:flex-row">
                {/* Cover */}
                <div className="relative sm:w-56 shrink-0 aspect-[2/3] sm:aspect-auto sm:min-h-[300px] overflow-hidden">
                  <img src={books[0].coverImage} alt={books[0].title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-transparent" />
                  <Badge className="absolute top-3 left-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0 text-sm px-3 py-1 shadow-lg">
                    🔥 {t('trending.numberOne')}
                  </Badge>
                </div>
                {/* Content */}
                <CardContent className="flex-1 p-5 sm:p-7 flex flex-col justify-center space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {books[0].categories.slice(0, 4).map((cat) => (
                      <Badge key={cat} variant="secondary" className="text-[11px] px-2 py-0.5">{cat}</Badge>
                    ))}
                  </div>
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif group-hover:text-primary transition-colors leading-tight">{books[0].title}</h3>
                  <p className="text-sm font-medium text-muted-foreground">{t('common.by')} <span className="text-foreground">{books[0].author}</span></p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{books[0].description}</p>
                  <div className="flex items-center gap-4 pt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-4 w-4 ${i < Math.round(books[0].googleRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 dark:text-gray-700'}`} />
                        ))}
                      </div>
                      <span className="font-bold text-sm">{formatRating(books[0].googleRating)}</span>
                      <span className="text-xs text-muted-foreground">({books[0].ratingsCount.toLocaleString()} ratings)</span>
                    </div>
                    {(books[0].pageCount ?? 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" />
                        {books[0].pageCount} pages
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <Button size="sm" className="h-9 px-5 shadow-sm" onClick={(e) => { e.stopPropagation(); openBook(books[0]); }}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" /> View Details
                    </Button>
                    {books[0].amazonUrl && (
                      <Button size="sm" variant="outline" className="h-9 px-4" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <a href={books[0].amazonUrl} target="_blank" rel="noopener noreferrer nofollow sponsored">
                          Buy on Amazon <ExternalLink className="ml-1.5 h-3 w-3" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </div>
            </Card>
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

        {/* View All CTA */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button variant="outline" size="lg" asChild className="px-8 h-11">
            <Link to="/trending">
              View All Trending Books <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
