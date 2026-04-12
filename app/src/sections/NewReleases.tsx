import { useState } from 'react';
import { Calendar, ChevronRight, ChevronDown, Sparkles, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookGrid } from '@/components/book/BookGrid';
import { useNewReleases } from '@/hooks/useBooks';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function NewReleases() {
  const [showAll, setShowAll] = useState(false);
  const [activePeriod, setActivePeriod] = useState('this-month');
  const { books, loading } = useNewReleases(showAll ? 24 : 8, activePeriod);
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const badge = getSetting('new_releases_badge', 'Fresh Arrivals');
  const description = getSetting('new_releases_description', 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.');

  const PERIODS = [
    { label: t('newReleases.thisWeek'), value: 'this-week', icon: Zap },
    { label: t('newReleases.lastWeek'), value: 'last-week', icon: Clock },
    { label: t('newReleases.thisMonth'), value: 'this-month', icon: Calendar },
    { label: t('newReleases.lastMonth'), value: 'last-month', icon: Calendar },
  ];

  return (
    <section id="new-releases" className="py-10 sm:py-14 md:py-16">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6"
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
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="transition-all duration-300">
              {showAll ? t('common.showLess') : 'Show More'}
              {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
            <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
              <Link to="/search?sort=newest">
                View All New <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Period Tabs */}
        <motion.div
          className="mb-6"
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

        {/* Book Grid */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <BookGrid books={books} loading={loading} columns={4} />
        </motion.div>

        {/* Auto-import info */}
        <motion.div
          className="mt-8 p-5 bg-gradient-to-r from-emerald-500/5 via-muted/30 to-teal-500/5 rounded-xl border border-emerald-500/10"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
            <div className="p-2.5 rounded-full bg-emerald-500/10">
              <Sparkles className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <span className="text-sm font-semibold">{t('newReleases.autoImport')}</span>
              <span className="text-xs text-muted-foreground ml-2">{t('newReleases.autoImportDesc')}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="text-green-600 border-green-500/30 text-xs">
                {t('newReleases.liveUpdates')}
              </Badge>
              <Button variant="outline" size="sm" asChild className="text-xs">
                <Link to="/search?sort=newest">
                  Browse All <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
