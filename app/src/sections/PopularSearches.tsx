import { Link } from 'react-router-dom';
import { TrendingUp, Search } from 'lucide-react';
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
    <section className="py-8 sm:py-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-bold font-serif">Popular Searches</h2>
            <p className="text-sm text-muted-foreground">Explore books by popular topics</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
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
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      isTop
                        ? 'px-5 py-3 text-sm hover:opacity-90'
                        : 'px-4 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground'
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
