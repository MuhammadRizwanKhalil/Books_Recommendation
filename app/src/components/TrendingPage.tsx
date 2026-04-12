import { useState } from 'react';
import { TrendingUp, Flame, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookGrid } from '@/components/book/BookGrid';
import { useTrendingBooks } from '@/hooks/useBooks';
import { useSEO } from '@/hooks/useSEO';
import { useTranslation } from '@/lib/i18n';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export function TrendingPage() {
  const [limit, setLimit] = useState(24);
  const { books, loading } = useTrendingBooks(limit);
  const { t } = useTranslation();

  useSEO({
    title: 'Trending Books | The Book Times',
    description: 'Discover the hottest books right now. Our algorithm analyzes ratings, reviews, and reading patterns to surface what readers love.',
    ogTitle: 'Trending Books | The Book Times',
    ogDescription: 'Discover the hottest books trending right now.',
    ogUrl: `${window.location.origin}/trending`,
    canonical: `${window.location.origin}/trending`,
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-muted/40 border-b">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl"
          >
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="default" className="bg-primary">
                <Flame className="w-3 h-3 mr-1" />
                Hot Right Now
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold font-serif flex items-center gap-3 mb-4">
              <TrendingUp className="h-10 w-10 text-primary" />
              Trending Books
            </h1>
            <p className="text-lg text-muted-foreground">
              Our algorithm analyzes ratings, reviews, and reading patterns to surface
              the books readers are loving right now.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-10">
        <div className="flex items-center justify-between mb-8">
          <p className="text-muted-foreground">
            {!loading && `Showing ${books.length} trending books`}
          </p>
          {books.length >= limit && (
            <Button variant="outline" onClick={() => setLimit((l) => l + 24)}>
              Load More
            </Button>
          )}
        </div>

        <BookGrid books={books} loading={loading} columns={4} />

        {!loading && books.length >= limit && (
          <div className="flex justify-center mt-10">
            <Button variant="outline" size="lg" onClick={() => setLimit((l) => l + 24)}>
              Load More Books
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
