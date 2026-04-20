import { Link } from 'react-router-dom';
import { TrendingUp, Search, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useSettings } from '@/components/SettingsProvider';

const DEFAULT_SEARCHES = [
  'Fiction', 'Self-Help', 'Technology', 'Business', 'Psychology',
  'Philosophy', 'Science', 'History', 'Biography', 'Memoir',
  'Marketing', 'Leadership', 'Productivity', 'Economics', 'Investing',
  'Health', 'Spirituality', 'Education', 'Design', 'AI',
];

export function PopularSearches() {
  const { getSetting } = useSettings();
  const popularSearchesSetting = getSetting('popular_searches', '');
  const POPULAR_SEARCHES = popularSearchesSetting
    ? popularSearchesSetting.split(',').map((s: string) => s.trim()).filter(Boolean)
    : DEFAULT_SEARCHES;

  return (
    <section className="py-10 sm:py-14 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="container mx-auto px-4">
        <motion.div
          className="space-y-2 mb-8"
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center gap-2">
            <Badge variant="default" className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 text-xs px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              Discover
            </Badge>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Popular Searches
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">Explore books by popular topics and trending categories</p>
        </motion.div>

        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          {POPULAR_SEARCHES.map((term, idx) => {
            const isTop = idx < 5;
            return (
              <motion.div
                key={term}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.02 }}
              >
                <Link to={`/search?q=${encodeURIComponent(term)}`}>
                  <Badge
                    variant={isTop ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all duration-300 ${
                      isTop
                        ? 'px-5 py-2.5 text-sm hover:opacity-90 shadow-md shadow-primary/10 hover:shadow-lg'
                        : 'px-4 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:border-primary'
                    }`}
                  >
                    <Search className="h-3 w-3 mr-1.5" />
                    {term}
                  </Badge>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
