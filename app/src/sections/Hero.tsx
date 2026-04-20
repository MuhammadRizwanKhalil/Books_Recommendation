import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Star, Users, ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePublicStats, useTrendingBooks } from '@/hooks/useBooks';
import { useSettings } from '@/components/SettingsProvider';
import { SearchDropdown } from '@/components/SearchDropdown';
import { useAppNav } from '@/App';
import { motion, AnimatePresence } from 'framer-motion';
import type { Book } from '@/types';

export function Hero() {
  const navigate = useNavigate();
  const { openBook } = useAppNav();
  const { stats: publicStats } = usePublicStats();
  const { books: heroBooks } = useTrendingBooks(8);
  const { getSetting } = useSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const siteTagline = getSetting('site_tagline', 'Discover Your Next Great Read');
  const siteDescription = getSetting('site_description', 'Explore thousands of books across every genre. Personalized recommendations, reviews, and community — all in one place.');

  const fmtNum = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+` : `${n}+`;

  const stats = [
    publicStats && publicStats.totalBooks >= 100 ? { icon: BookOpen, label: 'Books', value: fmtNum(publicStats.totalBooks), color: 'text-blue-500' } : null,
    publicStats && publicStats.totalReviews >= 10 ? { icon: Star, label: 'Reviews', value: fmtNum(publicStats.totalReviews), color: 'text-amber-500' } : null,
    publicStats && publicStats.totalAuthors >= 10 ? { icon: Users, label: 'Authors', value: fmtNum(publicStats.totalAuthors), color: 'text-violet-500' } : null,
    publicStats && publicStats.avgRating > 0 ? { icon: TrendingUp, label: 'Avg Rating', value: `${publicStats.avgRating}/5`, color: 'text-emerald-500' } : null,
  ].filter(Boolean) as { icon: typeof BookOpen; label: string; value: string; color: string }[];

  // Auto-rotate carousel every 5s
  const startAutoRotate = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!isPaused) {
        setIsFlipped(false);
        setActiveIndex(prev => (prev + 1) % Math.max(heroBooks.length, 1));
      }
    }, 5000);
  }, [isPaused, heroBooks.length]);

  useEffect(() => {
    if (heroBooks.length > 1) startAutoRotate();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [startAutoRotate, heroBooks.length]);

  const goTo = useCallback((idx: number) => {
    setIsFlipped(false);
    setActiveIndex(idx);
    startAutoRotate();
  }, [startAutoRotate]);

  const goPrev = () => goTo((activeIndex - 1 + heroBooks.length) % heroBooks.length);
  const goNext = () => goTo((activeIndex + 1) % heroBooks.length);

  const activeBook = heroBooks[activeIndex] || null;

  const words = siteTagline.split(' ');
  const lastWord = words.pop() || '';
  const firstPart = words.join(' ');

  return (
    <section className="relative min-h-[85vh] md:min-h-[80vh] flex items-center overflow-hidden" role="banner">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5 dark:to-primary/10" />
      <div className="absolute top-0 right-0 w-1/2 h-full opacity-[0.03] dark:opacity-[0.05]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="space-y-6 lg:space-y-8"
          >
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium tracking-wide bg-primary/10 text-primary border-primary/20">
                <Sparkles className="h-3 w-3 mr-1.5" />
                AI-Powered Book Discovery
              </Badge>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {firstPart}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-violet-500">
                {lastWord}
              </span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-lg leading-relaxed">
              {siteDescription}
            </p>

            <div className="max-w-md">
              <SearchDropdown />
            </div>

            {stats.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="flex flex-wrap gap-6 pt-2"
              >
                {stats.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <s.icon className={`h-4 w-4 ${s.color}`} />
                    <span className="text-sm font-semibold">{s.value}</span>
                    <span className="text-xs text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>

          {/* Right: 3D Flip Book Carousel */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative flex flex-col items-center"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {activeBook && (
              <div className="relative w-full max-w-sm mx-auto" style={{ perspective: '1200px' }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeBook.id}-${isFlipped}`}
                    initial={{ rotateY: isFlipped ? -90 : 0, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    exit={{ rotateY: isFlipped ? 0 : 90, opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                    style={{ transformStyle: 'preserve-3d' }}
                    className="cursor-pointer"
                    onClick={() => setIsFlipped(!isFlipped)}
                  >
                    {!isFlipped ? (
                      <div className="relative group">
                        <div className="relative overflow-hidden rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-white/10">
                          <img
                            src={activeBook.coverImage}
                            alt={`${activeBook.title} by ${activeBook.author}`}
                            className="w-full aspect-[2/3] object-cover"
                            loading="eager"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                          <div className="absolute bottom-4 left-4 right-4 text-white">
                            <p className="font-bold text-lg line-clamp-1">{activeBook.title}</p>
                            <p className="text-sm text-white/80">{activeBook.author}</p>
                          </div>
                          {activeBook.googleRating && (
                            <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-xs font-semibold">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {activeBook.googleRating}
                            </div>
                          )}
                        </div>
                        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm text-white/80 px-2 py-1 rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to flip
                        </div>
                      </div>
                    ) : (
                      <div className="bg-card border rounded-2xl p-6 shadow-2xl shadow-primary/10 min-h-[400px] flex flex-col">
                        <div className="flex items-start gap-4 mb-4">
                          <img src={activeBook.coverImage} alt="" className="w-16 h-24 object-cover rounded-lg flex-shrink-0" />
                          <div className="min-w-0">
                            <h3 className="font-bold text-lg leading-snug line-clamp-2">{activeBook.title}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">by {activeBook.author}</p>
                            {activeBook.googleRating && (
                              <div className="flex items-center gap-1 mt-2">
                                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                <span className="text-sm font-semibold">{activeBook.googleRating}</span>
                                <span className="text-xs text-muted-foreground">({activeBook.ratingsCount.toLocaleString()} ratings)</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5 flex-1">
                          {activeBook.description?.replace(/<[^>]*>/g, '') || 'No description available.'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4">
                          {activeBook.categories.slice(0, 3).map(cat => (
                            <Badge key={cat} variant="secondary" className="text-[10px]">{cat}</Badge>
                          ))}
                          {activeBook.pageCount && (
                            <Badge variant="outline" className="text-[10px]">{activeBook.pageCount} pages</Badge>
                          )}
                        </div>
                        <Button className="w-full mt-4 gap-2" onClick={(e) => { e.stopPropagation(); openBook(activeBook); }}>
                          View Details <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {heroBooks.length > 1 && (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); goPrev(); }}
                      className="absolute left-[-20px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center hover:bg-background transition-colors z-20"
                      aria-label="Previous book"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); goNext(); }}
                      className="absolute right-[-20px] top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border shadow-lg flex items-center justify-center hover:bg-background transition-colors z-20"
                      aria-label="Next book"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Thumbnail strip */}
            {heroBooks.length > 1 && (
              <div className="flex gap-2 mt-6 overflow-x-auto pb-2 max-w-full scrollbar-hide">
                {heroBooks.map((book, idx) => (
                  <button
                    key={book.id}
                    onClick={() => goTo(idx)}
                    className={`relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                      idx === activeIndex ? 'border-primary shadow-lg shadow-primary/20 scale-110' : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                    aria-label={`Go to ${book.title}`}
                  >
                    <img src={book.coverImage} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}

            {/* Progress indicator */}
            {heroBooks.length > 1 && (
              <div className="flex gap-1.5 mt-3">
                {heroBooks.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-1 rounded-full transition-all duration-500 ${
                      idx === activeIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted-foreground/20'
                    }`}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
