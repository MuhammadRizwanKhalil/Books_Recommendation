import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Search, Sparkles, Flame } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useSettings } from '@/components/SettingsProvider';
import { analyticsApi } from '@/api/client';

// Curated fallback — book-specific topics, genres, and themes readers actually search for
const DEFAULT_SEARCHES = [
  // Genres
  'Literary Fiction', 'Science Fiction', 'Historical Fiction', 'Fantasy', 'Mystery & Thriller',
  'Romance', 'Horror', 'Graphic Novel', 'Short Stories', 'Poetry',
  // Non-fiction
  'Self-Help', 'Biographies', 'True Crime', 'Psychology', 'Philosophy',
  'Business & Finance', 'Leadership', 'Productivity', 'Investing', 'Economics',
  // Topics
  'Artificial Intelligence', 'Climate & Environment', 'Mental Health', 'Mindfulness',
  'Parenting', 'History', 'Science', 'Spirituality', 'Travel', 'Cooking',
  // Popular titles / authors
  'Atomic Habits', 'Sapiens', 'The Power of Now', 'Rich Dad Poor Dad',
  'Harry Potter', 'The Alchemist', 'Think and Grow Rich', 'Deep Work',
];

type Term = { query: string; count?: number; isLive?: boolean };

export function PopularSearches() {
  const { getSetting } = useSettings();
  const [terms, setTerms] = useState<Term[]>([]);

  useEffect(() => {
    let cancelled = false;

    function applyFallback() {
      const setting = getSetting('popular_searches', '');
      const list = setting
        ? setting.split(',').map((s: string) => s.trim()).filter(Boolean)
        : DEFAULT_SEARCHES;
      setTerms(list.map((q) => ({ query: q })));
    }

    analyticsApi
      .popularSearches(20, 30)
      .then((data) => {
        if (cancelled) return;
        if (data?.terms?.length) {
          setTerms(data.terms.map((t) => ({ query: t.query, count: t.count, isLive: true })));
          return;
        }
        applyFallback();
      })
      .catch(() => {
        if (!cancelled) applyFallback();
      });

    return () => {
      cancelled = true;
    };
  }, [getSetting]);

  if (terms.length === 0) return null;

  const isLive = terms.some((t) => t.isLive);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-background via-muted/20 to-background">
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
              {isLive ? 'Live' : 'Discover'}
            </Badge>
          </div>
          <h2 className="font-serif text-3xl md:text-4xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Popular Searches
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {isLive
              ? 'What readers are searching for right now'
              : 'Explore books by popular topics and trending categories'}
          </p>
        </motion.div>

        <div className="flex flex-wrap gap-2.5 sm:gap-3">
          {terms.map((term, idx) => {
            const isTop = idx < 5;
            return (
              <motion.div
                key={`${term.query}-${idx}`}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: Math.min(idx * 0.02, 0.4) }}
              >
                <Link to={`/search?q=${encodeURIComponent(term.query)}`}>
                  <Badge
                    variant={isTop ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all duration-300 ${
                      isTop
                        ? 'px-5 py-2.5 text-sm hover:opacity-90 shadow-md shadow-primary/10 hover:shadow-lg'
                        : 'px-4 py-2.5 text-sm hover:bg-primary hover:text-primary-foreground hover:shadow-md hover:border-primary'
                    }`}
                  >
                    {isTop ? (
                      <Flame className="h-3 w-3 mr-1.5" />
                    ) : (
                      <Search className="h-3 w-3 mr-1.5" />
                    )}
                    {term.query}
                    {term.count && term.count > 1 ? (
                      <span className={`ml-1.5 text-[10px] opacity-70 ${isTop ? '' : 'text-muted-foreground'}`}>
                        ×{term.count}
                      </span>
                    ) : null}
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
