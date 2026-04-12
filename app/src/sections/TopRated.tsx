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
      case 0: return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 1: return <Medal className="h-4 w-4 text-gray-400" />;
      case 2: return <Award className="h-4 w-4 text-amber-600" />;
      default: return <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>;
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
    <section id="top-rated" className="py-8 sm:py-10 md:py-14 bg-muted/40">
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
              <Star className="w-3 h-3 mr-1 fill-current" />
              {t('topRated.badge')}
            </Badge>
            <h2 className="text-2xl md:text-3xl font-bold font-serif flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-500 fill-yellow-500" />
              {t('topRated.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-lg">{t('topRated.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('common.showLess') : t('topRated.viewAll')}
            {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </motion.div>

        {/* Top 3 Podium - compact */}
        {!loading && books.length >= 3 && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-3 items-end">
              {/* 2nd Place */}
              <div className="order-1">
                <Card className={`overflow-hidden border ${getRankStyle(1)} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => openBook(books[1])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[1]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[1].coverImage} alt={books[1].title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-white/90 px-2 py-0.5 rounded-full text-xs">
                        {getRankIcon(1)}
                        <span className="font-bold">2nd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2.5">
                    <h3 className="font-bold text-xs line-clamp-1">{books[1].title}</h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{books[1].author}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold">{formatRating(books[1].googleRating)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 1st Place */}
              <div className="order-2 -mt-4 sm:-mt-6">
                <Card className={`overflow-hidden border-2 ${getRankStyle(0)} shadow-lg cursor-pointer hover:shadow-xl transition-shadow`} onClick={() => openBook(books[0])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[0].coverImage} alt={books[0].title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-yellow-500 text-white px-2 py-0.5 rounded-full text-xs">
                        {getRankIcon(0)}
                        <span className="font-bold">#1</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2.5">
                    <h3 className="font-bold text-sm line-clamp-1">{books[0].title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{books[0].author}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm font-bold">{formatRating(books[0].googleRating)}</span>
                      <span className="text-[10px] text-muted-foreground">({books[0].ratingsCount.toLocaleString()})</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3rd Place */}
              <div className="order-3">
                <Card className={`overflow-hidden border ${getRankStyle(2)} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => openBook(books[2])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[2]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[2].coverImage} alt={books[2].title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-white/90 px-2 py-0.5 rounded-full text-xs">
                        {getRankIcon(2)}
                        <span className="font-bold">3rd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2.5">
                    <h3 className="font-bold text-xs line-clamp-1">{books[2].title}</h3>
                    <p className="text-[10px] text-muted-foreground line-clamp-1">{books[2].author}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold">{formatRating(books[2].googleRating)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* Ranked list #4-#8 - compact */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
              ))
            ) : (
              books.slice(3, 8).map((book, index) => (
                <Card
                  key={book.id}
                  className="group cursor-pointer hover:shadow-sm transition-shadow"
                  onClick={() => openBook(book)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(book); } }}
                >
                  <CardContent className="p-2.5 sm:p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-xs font-bold text-muted-foreground shrink-0">
                        #{index + 4}
                      </div>
                      <div className="w-8 h-12 shrink-0 overflow-hidden rounded">
                        <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{book.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1">{book.author}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-bold">{formatRating(book.googleRating)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform hidden sm:block" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
