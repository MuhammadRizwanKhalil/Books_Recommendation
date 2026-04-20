import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import { motion } from 'framer-motion';

export function RecentlyViewed() {
  const { readingHistory } = useAuth();

  // Only show if user has viewed at least 2 books
  if (readingHistory.length < 2) return null;

  // Show last 8 unique books (most recent first)
  const recentBooks = readingHistory.slice(0, 8);

  return (
    <section className="py-14">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold font-serif">Recently Viewed</h2>
              <p className="text-sm text-muted-foreground">Continue where you left off</p>
            </div>
          </div>
        </div>

        <div className="relative">
          {/* Scroll fade edges */}
          <div className="absolute left-0 top-0 bottom-4 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-4 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          
          <div className="flex gap-4 overflow-x-auto pb-4 px-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'hsl(var(--muted-foreground) / 0.2) transparent' }}>
            {recentBooks.map((entry, idx) => (
              <motion.div
                key={`${entry.bookId}-${idx}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex-shrink-0 w-[150px] snap-start"
              >
                <Link to={`/book/${entry.bookSlug || entry.bookId}`} className="group block">
                  <Card className="overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-transparent hover:border-primary/20">
                    <div className="relative aspect-[2/3] overflow-hidden">
                      {entry.bookCover ? (
                        <img
                          src={entry.bookCover}
                          alt={`${entry.bookTitle} by ${entry.bookAuthor}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                          width={150}
                          height={225}
                        />
                      ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center">
                          <span className="text-4xl">📚</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-3">
                      <h3 className="text-sm font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                        {entry.bookTitle}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{entry.bookAuthor}</p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
