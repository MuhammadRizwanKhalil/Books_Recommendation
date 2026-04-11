import { useState } from 'react';
import { Star, ChevronRight, ChevronDown, Trophy, Medal, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTopRated } from '@/hooks/useBooks';
import { formatRating } from '@/lib/utils';
import { useAppNav } from '@/App';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';

export function TopRated() {
  const [showAll, setShowAll] = useState(false);
  const { books, loading } = useTopRated(showAll ? 24 : 10);
  const { openBook } = useAppNav();
  const { t } = useTranslation();

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 1: return <Medal className="h-5 w-5 text-gray-400" />;
      case 2: return <Award className="h-5 w-5 text-amber-600" />;
      default: return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getRankStyle = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-500/10 border-yellow-500/30';
      case 1: return 'bg-gray-400/10 border-gray-400/30';
      case 2: return 'bg-amber-600/10 border-amber-600/30';
      default: return 'bg-card';
    }
  };

  return (
    <section id="top-rated" className="py-12 sm:py-16 md:py-24 bg-muted/40">
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
                <Star className="w-3 h-3 mr-1 fill-current" />
                {t('topRated.badge')}
              </Badge>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold font-serif flex items-center gap-3">
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
              {t('topRated.title')}
            </h2>
            <p className="text-muted-foreground max-w-xl">
              {t('topRated.subtitle')}
            </p>
          </div>
          <Button variant="outline" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('common.showLess') : t('topRated.viewAll')}
            {showAll ? <ChevronDown className="ml-2 h-4 w-4" /> : <ChevronRight className="ml-2 h-4 w-4" />}
          </Button>
        </motion.div>

        {/* Top 3 Podium */}
        {!loading && books.length >= 3 && (
          <motion.div 
            className="mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 items-end">
              {/* 2nd Place */}
              <div className="order-2 sm:order-1">
                <Card className={`overflow-hidden border-2 ${getRankStyle(1)} cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary`} onClick={() => openBook(books[1])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[1]); } }}>
                  <div className="relative aspect-[2/3] sm:aspect-[3/4] overflow-hidden">
                    <img
                      src={books[1].coverImage}
                      alt={books[1].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center gap-2 bg-white/90 px-3 py-1 rounded-full">
                        {getRankIcon(1)}
                        <span className="font-bold">2nd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold line-clamp-1">{books[1].title}</h3>
                    <p className="text-sm text-muted-foreground">{books[1].author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold">{formatRating(books[1].googleRating)}</span>
                      <span className="text-sm text-muted-foreground">
                        ({books[1].ratingsCount.toLocaleString()})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 1st Place */}
              <div className="order-1 sm:order-2 sm:-mt-8">
                <Card className={`overflow-hidden border-2 ${getRankStyle(0)} shadow-xl cursor-pointer hover:shadow-2xl transition-shadow focus:outline-none focus:ring-2 focus:ring-primary`} onClick={() => openBook(books[0])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}>
                  <div className="relative aspect-[2/3] sm:aspect-[3/4] overflow-hidden">
                    <img
                      src={books[0].coverImage}
                      alt={books[0].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center gap-2 bg-yellow-500 text-white px-3 py-1 rounded-full">
                        {getRankIcon(0)}
                        <span className="font-bold">#1</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg line-clamp-1">{books[0].title}</h3>
                    <p className="text-sm text-muted-foreground">{books[0].author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold text-lg">{formatRating(books[0].googleRating)}</span>
                      <span className="text-sm text-muted-foreground">
                        ({books[0].ratingsCount.toLocaleString()} {t('topRated.ratings')})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3rd Place */}
              <div className="order-3">
                <Card className={`overflow-hidden border-2 ${getRankStyle(2)} cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary`} onClick={() => openBook(books[2])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[2]); } }}>
                  <div className="relative aspect-[2/3] sm:aspect-[3/4] overflow-hidden">
                    <img
                      src={books[2].coverImage}
                      alt={books[2].title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-4 left-4">
                      <div className="flex items-center gap-2 bg-white/90 px-3 py-1 rounded-full">
                        {getRankIcon(2)}
                        <span className="font-bold">3rd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold line-clamp-1">{books[2].title}</h3>
                    <p className="text-sm text-muted-foreground">{books[2].author}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="font-bold">{formatRating(books[2].googleRating)}</span>
                      <span className="text-sm text-muted-foreground">
                        ({books[2].ratingsCount.toLocaleString()})
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* More Top Rated List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h3 className="text-xl font-semibold mb-6">{t('topRated.moreTopRated')}</h3>
          <div className="space-y-3">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />
              ))
            ) : (
              books.slice(3, 8).map((book, index) => (
                <motion.div
                  key={book.id}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                >
                  <Card className="group cursor-pointer hover:shadow-md transition-shadow focus:outline-none focus:ring-2 focus:ring-primary" onClick={() => openBook(book)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(book); } }}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted font-bold text-muted-foreground">
                          #{index + 4}
                        </div>
                        <div className="w-12 h-16 flex-shrink-0 overflow-hidden rounded">
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold line-clamp-1 group-hover:text-primary transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-sm text-muted-foreground">{book.author}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            <span className="font-bold">{formatRating(book.googleRating)}</span>
                          </div>
                          <span className="text-sm text-muted-foreground hidden md:inline">
                            {book.ratingsCount.toLocaleString()} {t('topRated.ratings')}
                          </span>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
