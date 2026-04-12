import { useState } from 'react';
import { Calendar, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookGrid } from '@/components/book/BookGrid';
import { useNewReleases } from '@/hooks/useBooks';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';

export function NewReleases() {
  const [showAll, setShowAll] = useState(false);
  const [activePeriod, setActivePeriod] = useState('this-month');
  const { books, loading } = useNewReleases(showAll ? 24 : 8, activePeriod);
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const badge = getSetting('new_releases_badge', 'Fresh Arrivals');
  const description = getSetting('new_releases_description', 'Stay ahead of the curve with the latest additions to our library, imported daily from Google Books.');

  const PERIODS = [
    { label: t('newReleases.thisWeek'), value: 'this-week' },
    { label: t('newReleases.lastWeek'), value: 'last-week' },
    { label: t('newReleases.thisMonth'), value: 'this-month' },
    { label: t('newReleases.lastMonth'), value: 'last-month' },
  ];

  return (
    <section id="new-releases" className="py-8 sm:py-10 md:py-14">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="space-y-1">
            <Badge variant="default" className="bg-primary text-xs">
              <Sparkles className="w-3 h-3 mr-1" />
              {badge}
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold font-serif flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              {t('sections.newReleases')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">{description}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('common.showLess') : t('newReleases.viewAll')}
            {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
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
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => setActivePeriod(period.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  activePeriod === period.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
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

        {/* Auto-import info - compact */}
        <motion.div
          className="mt-6 p-4 bg-muted/50 rounded-lg border border-dashed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{t('newReleases.autoImport')}</span>
              <span className="text-xs text-muted-foreground ml-2">{t('newReleases.autoImportDesc')}</span>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600 text-[10px] shrink-0">
              {t('newReleases.liveUpdates')}
            </Badge>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
