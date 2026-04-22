import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Star, BookOpen, TrendingUp, Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchDropdown } from '@/components/SearchDropdown';
import { usePublicStats } from '@/hooks/useBooks';
import { useSettings } from '@/components/SettingsProvider';
import { scrollToElement } from '@/lib/utils';

/**
 * HeroV2 — modern, minimal, premium hero.
 * - Centered split-feel layout, generous whitespace
 * - Single primary CTA + one secondary CTA
 * - Compact inline trust strip (stats) instead of giant tiles
 * - No popular-search clutter (lives in PopularSearches section)
 */
export function HeroV2() {
  const navigate = useNavigate();
  const { stats } = usePublicStats();
  const { getSetting } = useSettings();

  const tagline = getSetting('site_tagline', 'Discover Your Next Great Read');
  const description = getSetting(
    'site_description',
    'Personalized book recommendations across every genre. Curated by readers, powered by AI.'
  );
  const badgeText = getSetting('hero_badge_text', 'Smart Book Discovery');

  // Highlight the last word in the tagline
  const lastSpace = tagline.lastIndexOf(' ');
  const taglineHead = lastSpace > 0 ? tagline.slice(0, lastSpace) : '';
  const taglineTail = lastSpace > 0 ? tagline.slice(lastSpace + 1) : tagline;

  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+` : `${n}+`);

  const trustItems = [
    stats && stats.totalBooks >= 100 && {
      icon: BookOpen,
      label: 'Books',
      value: fmt(stats.totalBooks),
    },
    stats && stats.totalReviews >= 10 && {
      icon: Star,
      label: 'Avg Rating',
      value: `${stats.avgRating}/5`,
    },
    stats && stats.totalReviews >= 10 && {
      icon: TrendingUp,
      label: 'Reviews',
      value: fmt(stats.totalReviews),
    },
  ].filter(Boolean) as Array<{ icon: typeof BookOpen; label: string; value: string }>;

  const container = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } },
  };

  return (
    <section
      id="hero"
      role="banner"
      aria-labelledby="hero-headline"
      className="relative isolate overflow-hidden"
    >
      {/* Background — soft, single-source-of-truth gradient */}
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[920px] h-[920px] rounded-full bg-[radial-gradient(closest-side,hsl(var(--primary)/0.10),transparent_70%)] blur-2xl" />
      </div>

      <motion.div
        className="container mx-auto px-4 pt-16 pb-12 sm:pt-20 sm:pb-16 md:pt-24 md:pb-20"
        variants={container}
        initial="hidden"
        animate="visible"
      >
        <div className="mx-auto max-w-3xl text-center">
          <motion.div variants={item} className="flex justify-center">
            <Badge
              variant="secondary"
              className="gap-1.5 px-3 py-1 text-[11px] font-medium border border-border/60 bg-card/60 backdrop-blur-sm"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {badgeText}
            </Badge>
          </motion.div>

          <motion.h1
            id="hero-headline"
            variants={item}
            className="mt-6 font-serif text-4xl sm:text-5xl md:text-6xl lg:text-[64px] font-semibold tracking-tight leading-[1.05] text-foreground"
          >
            {taglineHead && <span>{taglineHead} </span>}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                {taglineTail}
              </span>
              {/* Decorative open-book illustration anchored under the highlighted word */}
              <svg
                aria-hidden="true"
                viewBox="0 0 220 28"
                className="absolute left-1/2 -translate-x-1/2 -bottom-3 sm:-bottom-4 w-[110%] h-5 sm:h-6 text-primary/70"
                preserveAspectRatio="none"
              >
                <path
                  d="M4 16 C 40 4, 80 4, 110 14 C 140 24, 180 24, 216 12"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.7"
                />
                <path
                  d="M10 22 C 50 14, 90 14, 110 18 C 130 22, 170 22, 210 18"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                  opacity="0.4"
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p
            variants={item}
            className="mx-auto mt-5 max-w-xl text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            {description}
          </motion.p>

          <motion.div
            variants={item}
            role="search"
            aria-label="Search books"
            className="mx-auto mt-8 max-w-xl"
          >
            <SearchDropdown size="lg" />
          </motion.div>

          <motion.div
            variants={item}
            className="mt-7 flex flex-wrap items-center justify-center gap-3"
          >
            <Button
              size="lg"
              className="h-11 px-6 text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all"
              asChild
            >
              <a
                href="#trending"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToElement('trending');
                }}
              >
                Explore Books
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 text-sm font-semibold border-primary/30 hover:border-primary/60 hover:bg-primary/5 group"
              onClick={() => navigate('/for-you')}
            >
              <Heart className="mr-1.5 h-4 w-4 text-rose-500 group-hover:scale-110 transition-transform" />
              For You
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                <Sparkles className="h-2.5 w-2.5" /> AI
              </span>
            </Button>
          </motion.div>

          {trustItems.length > 0 && (
            <motion.div
              variants={item}
              className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm"
              aria-label="Platform stats"
            >
              {trustItems.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-muted-foreground">
                  <s.icon className="h-4 w-4 text-primary/80" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{s.value}</span>
                  <span className="text-xs uppercase tracking-wider">{s.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
