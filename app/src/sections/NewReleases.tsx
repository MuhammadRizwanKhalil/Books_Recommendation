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
    <section id="new-releases" className="py-12 sm:py-16 md:py-24">
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
                <Sparkles className="w-3 h-3 mr-1" />
                {badge}
              </Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-serif flex items-center gap-3">
              <Calendar className="h-8 w-8 text-primary" />
              {t('sections.newReleases')}
            </h2>
            <p className="text-muted-foreground max-w-xl">
              {description}
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('common.showLess') : t('newReleases.viewAll')}
            {showAll ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </motion.div>

        {/* Release Timeline */}
        <motion.div 
            className="mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="flex items-center gap-4 mb-6 overflow-x-auto pb-4">
              {PERIODS.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setActivePeriod(period.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
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
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <BookGrid books={books} loading={loading} columns={4} />
        </motion.div>

        {/* Auto-import Info */}
        <motion.div 
          className="mt-12 p-6 bg-muted/50 rounded-xl border border-dashed"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">{t('newReleases.autoImport')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('newReleases.autoImportDesc')}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">
              {t('newReleases.liveUpdates')}
            </Badge>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
