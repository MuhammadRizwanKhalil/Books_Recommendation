import { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronRight, Sparkles, Clock, Zap, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewReleases } from '@/hooks/useBooks';
import { useAppNav } from '@/App';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatRating } from '@/lib/utils';

export function NewReleases() {
  const [activePeriod, setActivePeriod] = useState('this-month');
  const { books, loading } = useNewReleases(16, activePeriod);
  const { openBook } = useAppNav();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const badge = getSetting('new_releases_badge', 'Fresh Arrivals');
  const description = getSetting('new_releases_description', 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.');

  const scrollRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const animRef = useRef<number>(0);

  const displayBooks = books.length > 0 ? [...books, ...books] : [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || books.length === 0) return;

    let lastTime = 0;
    const animate = (time: number) => {
      if (!isPausedRef.current && lastTime) {
        const delta = time - lastTime;
        el.scrollLeft += 0.35 * (delta / 16);
        const halfWidth = el.scrollWidth / 2;
        if (halfWidth > 0 && el.scrollLeft >= halfWidth) {
          el.scrollLeft -= halfWidth;
        }
      }
      lastTime = time;
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [books.length]);

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

      {/* Auto-scrolling carousel with hover detail overlay */}
      {loading ? (
        <div className="container mx-auto px-4">
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[120px] sm:w-[140px]">
                <div className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : books.length > 0 ? (
        <div
          ref={scrollRef}
          className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4"
          onMouseEnter={() => { isPausedRef.current = true; }}
          onMouseLeave={() => { isPausedRef.current = false; }}
          onTouchStart={() => { isPausedRef.current = true; }}
          onTouchEnd={() => { isPausedRef.current = false; }}
          style={{ scrollBehavior: 'auto' }}
        >
          {displayBooks.map((book, idx) => (
            <div
              key={`${book.id}-${idx}`}
              className="shrink-0 w-[120px] sm:w-[140px] cursor-pointer group/card"
              onClick={() => openBook(book)}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                <img
                  src={book.coverImage}
                  alt={book.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                  loading="lazy"
                />
                {/* Hover overlay with details */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2.5">
                  <h4 className="text-white text-xs font-bold line-clamp-2 leading-tight mb-1">{book.title}</h4>
                  <p className="text-white/70 text-[10px] line-clamp-1 mb-1">{book.author}</p>
                  <div className="flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
                    <span className="text-white text-[10px] font-bold">{formatRating(book.googleRating)}</span>
                    <span className="text-white/50 text-[9px]">({book.ratingsCount?.toLocaleString()})</span>
                  </div>
                </div>
                {/* New badge */}
                <div className="absolute top-1.5 right-1.5">
                  <Badge className="bg-emerald-500 text-white text-[8px] px-1.5 py-0 border-0">NEW</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="container mx-auto px-4">
          <p className="text-sm text-muted-foreground text-center py-8">No books found for this period.</p>
        </div>
      )}

      {/* View All CTA */}
      <div className="container mx-auto px-4">
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Button variant="outline" size="sm" asChild className="px-6">
            <Link to="/search?sort=newest">
              Browse All New Releases <ChevronRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
