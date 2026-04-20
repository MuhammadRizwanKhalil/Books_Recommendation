import { useState, useRef } from 'react';
import { Calendar, ChevronRight, Sparkles, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewReleases } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { FlipBookCarouselCard } from '@/components/book/FlipBookCarouselCard';
import { useAutoScrollLoop } from '@/hooks/useAutoScrollLoop';

export function NewReleases() {
  const [activePeriod, setActivePeriod] = useState('this-week');
  const { books, loading } = useNewReleases(16, activePeriod);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const badge = getSetting('new_releases_badge', 'Fresh Arrivals');
  const description = getSetting('new_releases_description', 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.');

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];
  useAutoScrollLoop({
    containerRef: scrollRef,
    pauseRef: isPausedRef,
    enabled: books.length > 0,
    speed: 0.35,
  });

  const PERIODS = [
    { label: t('newReleases.thisWeek'), value: 'this-week', icon: Zap },
    { label: t('newReleases.lastWeek'), value: 'last-week', icon: Clock },
    { label: t('newReleases.thisMonth'), value: 'this-month', icon: Calendar },
    { label: t('newReleases.lastMonth'), value: 'last-month', icon: Calendar },
  ];

  return (
    <section id="new-releases" className="py-8 sm:py-10 md:py-12">
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
              <Badge variant="default" className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white border-0 text-xs px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                {badge}
              </Badge>
              <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                Live Updates
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <Calendar className="h-7 w-7 text-primary" />
              {t('sections.newReleases')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{description}</p>
          </div>
          <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
            <Link to="/search?sort=newest">
              View All New <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>

        {/* Period Tabs */}
        <motion.div
          className="mb-5"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => setActivePeriod(period.value)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-300 ${
                  activePeriod === period.value
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                <period.icon className="h-3 w-3" />
                {period.label}
              </button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Auto-scrolling carousel with hover detail overlay — contained */}
      <div className="container mx-auto px-4">
      {loading ? (
        <div>
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : books.length > 0 ? (
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          <div
            ref={scrollRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide"
            onMouseEnter={() => { isPausedRef.current = true; }}
            onMouseLeave={() => { isPausedRef.current = false; }}
            onTouchStart={() => { isPausedRef.current = true; }}
            onTouchEnd={() => { isPausedRef.current = false; }}
          >
          {displayBooks.map((book, idx) => (
            <FlipBookCarouselCard
              key={`${book.id}-${idx}`}
              book={book}
              onBookClick={openBook}
              badgeText="NEW"
            />
          ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground text-center py-8">No books found for this period.</p>
        </div>
      )}
      </div>
    </section>
  );
}
