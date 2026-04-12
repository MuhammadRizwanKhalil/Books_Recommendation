import { useState } from 'react';
import { Star, ChevronRight, ChevronDown, Trophy, Medal, Award, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useTopRated } from '@/hooks/useBooks';
import { formatRating } from '@/lib/utils';
import { useAppNav } from '@/App';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

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
      case 0: return 'bg-yellow-500/10 border-yellow-500/30 shadow-lg shadow-yellow-500/10';
      case 1: return 'bg-gray-400/10 border-gray-400/30';
      case 2: return 'bg-amber-600/10 border-amber-600/30';
      default: return 'bg-card';
    }
  };

  return (
    <section id="top-rated" className="py-10 sm:py-14 md:py-16 bg-gradient-to-b from-muted/50 via-muted/30 to-background">
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
              <Badge variant="default" className="bg-gradient-to-r from-yellow-500 to-amber-600 text-white border-0 text-xs px-3 py-1">
                <Star className="w-3 h-3 mr-1 fill-current" />
                {t('topRated.badge')}
              </Badge>
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-500/30 bg-yellow-500/5">
                <Trophy className="w-3 h-3 mr-1" />
                Community Favorites
              </Badge>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold font-serif flex items-center gap-2">
              <Star className="h-7 w-7 text-yellow-500 fill-yellow-500" />
              {t('topRated.title')}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">{t('topRated.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} className="transition-all duration-300">
              {showAll ? t('common.showLess') : t('topRated.viewAll')}
              {showAll ? <ChevronDown className="ml-1 h-3.5 w-3.5" /> : <ChevronRight className="ml-1 h-3.5 w-3.5" />}
            </Button>
            <Button variant="default" size="sm" asChild className="shadow-md shadow-primary/20">
              <Link to="/search?sort=rating">
                View All Top Rated <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Top 3 Podium */}
        {!loading && books.length >= 3 && (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end">
              {/* 2nd Place */}
              <div className="order-1">
                <Card className={`overflow-hidden border ${getRankStyle(1)} cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-500`} onClick={() => openBook(books[1])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[1]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[1].coverImage} alt={books[1].title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs shadow-sm">
                        {getRankIcon(1)}
                        <span className="font-bold">2nd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-bold text-xs sm:text-sm line-clamp-1">{books[1].title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{books[1].author}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold">{formatRating(books[1].googleRating)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 1st Place */}
              <div className="order-2 -mt-4 sm:-mt-8">
                <Card className={`overflow-hidden border-2 ${getRankStyle(0)} cursor-pointer hover:shadow-2xl hover:-translate-y-1 transition-all duration-500`} onClick={() => openBook(books[0])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[0]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[0].coverImage} alt={books[0].title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-white px-2.5 py-1 rounded-full text-xs shadow-md">
                        {getRankIcon(0)}
                        <span className="font-bold">#1</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <div className="bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-medium">
                        {books[0].ratingsCount?.toLocaleString()} reviews
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-bold text-sm sm:text-base line-clamp-2">{books[0].title}</h3>
                    <p className="text-xs text-primary font-medium line-clamp-1 mt-0.5">{books[0].author}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        ))}
                      </div>
                      <span className="text-sm font-bold">{formatRating(books[0].googleRating)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 3rd Place */}
              <div className="order-3">
                <Card className={`overflow-hidden border ${getRankStyle(2)} cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-500`} onClick={() => openBook(books[2])} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(books[2]); } }}>
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <img src={books[2].coverImage} alt={books[2].title} className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-2 left-2">
                      <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full text-xs shadow-sm">
                        {getRankIcon(2)}
                        <span className="font-bold">3rd</span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h3 className="font-bold text-xs sm:text-sm line-clamp-1">{books[2].title}</h3>
                    <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mt-0.5">{books[2].author}</p>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold">{formatRating(books[2].googleRating)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </motion.div>
        )}

        {/* Ranked list #4-#10 */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
              ))
            ) : (
              books.slice(3, showAll ? undefined : 8).map((book, index) => (
                <Card
                  key={book.id}
                  className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-300"
                  onClick={() => openBook(book)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBook(book); } }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted text-sm font-bold text-muted-foreground shrink-0 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        #{index + 4}
                      </div>
                      <div className="w-10 h-14 shrink-0 overflow-hidden rounded shadow-sm">
                        <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm line-clamp-1 group-hover:text-primary transition-colors">{book.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{book.author}</p>
                        {book.categories?.[0] && (
                          <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground mt-1 inline-block">{book.categories[0]}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-bold">{formatRating(book.googleRating)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all hidden sm:block" />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Button variant="outline" size="lg" asChild className="shadow-sm h-11 px-8">
            <Link to="/search?sort=rating">
              <BookOpen className="mr-2 h-4 w-4" />
              Explore All Top Rated Books
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
