import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Star, Sparkles, ArrowRight, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePublicStats } from '@/hooks/useBooks';
import { useSettings } from '@/components/SettingsProvider';
import { SearchDropdown } from '@/components/SearchDropdown';
import { useTranslation } from '@/lib/i18n';
import { motion } from 'framer-motion';
import { scrollToElement } from '@/lib/utils';

export function Hero() {
  const navigate = useNavigate();
  const { stats: publicStats } = usePublicStats();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const siteTagline = getSetting('site_tagline', 'Discover Your Next Great Read');
  const siteDescription = getSetting('site_description', 'Discover your next great read. Explore 50,000+ books across every genre, with personalized suggestions tailored just for you.');
  const heroBadge = getSetting('hero_badge_text', 'Smart Book Discovery');
  const popularSearchesSetting = getSetting('popular_searches', 'Atomic Habits,Self Help,Business,Fiction,Technology');

  const formatNumber = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+` : `${n}+`;

  const allStats = [
    publicStats && publicStats.totalBooks >= 100 ? { icon: BookOpen, label: t('hero.booksIndexed'), value: formatNumber(publicStats.totalBooks), color: 'text-blue-500 bg-blue-500/10' } : null,
    publicStats && publicStats.totalReviews >= 10 ? { icon: TrendingUp, label: t('hero.totalReviews'), value: formatNumber(publicStats.totalReviews), color: 'text-emerald-500 bg-emerald-500/10' } : null,
    publicStats && publicStats.totalReviews >= 10 ? { icon: Star, label: t('hero.avgRating'), value: `${publicStats.avgRating}/5`, color: 'text-amber-500 bg-amber-500/10' } : null,
    publicStats && publicStats.totalAuthors >= 10 ? { icon: Users, label: 'Authors', value: formatNumber(publicStats.totalAuthors), color: 'text-violet-500 bg-violet-500/10' } : null,
  ];
  const stats = allStats.filter(Boolean) as { icon: typeof BookOpen; label: string; value: string; color: string }[];

  const popularSearches = popularSearchesSetting.split(',').map(s => s.trim()).filter(Boolean);

  const lastSpaceIdx = siteTagline.lastIndexOf(' ');
  const taglinePart1 = lastSpaceIdx > 0 ? siteTagline.substring(0, lastSpaceIdx) : '';
  const taglinePart2 = lastSpaceIdx > 0 ? siteTagline.substring(lastSpaceIdx + 1) : siteTagline;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] } },
  };

  return (
    <section id="hero" className="relative min-h-[60vh] sm:min-h-[65vh] flex flex-col justify-center overflow-hidden" role="banner">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.10),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--primary)/0.05),transparent_50%)]" />
      <div className="absolute top-20 right-[15%] h-72 w-72 rounded-full bg-primary/[0.04] blur-3xl animate-pulse [animation-duration:4s] motion-reduce:animate-none" />
      <div className="absolute bottom-20 left-[10%] h-56 w-56 rounded-full bg-primary/[0.03] blur-3xl animate-pulse [animation-duration:6s] [animation-delay:2s] motion-reduce:animate-none" />
      <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:48px_48px]" />

      <motion.div
        className="relative container mx-auto px-4 py-12 sm:py-16 md:py-20"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-7">
          <motion.div className="flex justify-center" variants={itemVariants}>
            <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium gap-1.5 shadow-sm border border-border/50 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse motion-reduce:animate-none" />
              {heroBadge}
              <Award className="ml-1 h-3 w-3 text-amber-500" />
            </Badge>
          </motion.div>

          <motion.div className="space-y-4" variants={itemVariants}>
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08]">
              {taglinePart1 && <>{taglinePart1}{' '}</>}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary to-primary/70 relative">
                {taglinePart2}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 8" preserveAspectRatio="none"><path d="M0 7 Q50 0 100 5 Q150 0 200 7" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {siteDescription}
            </p>
          </motion.div>

          <motion.div className="max-w-2xl mx-auto" role="search" aria-label="Search books" variants={itemVariants}>
            <SearchDropdown size="lg" />
            <nav className="mt-3 flex flex-wrap justify-center gap-x-3 gap-y-1.5" aria-label="Popular searches">
              <span className="text-xs text-muted-foreground font-medium">{t('hero.popular')}</span>
              {popularSearches.map((term) => (
                <a
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(term)}`); }}
                  className="rounded-sm text-xs text-primary/80 underline-offset-4 transition-colors hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {term}
                </a>
              ))}
            </nav>
          </motion.div>

          <motion.div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 pt-2" variants={itemVariants}>
            {stats.length > 0 && stats.map((stat, idx) => (
              <motion.div
                key={stat.label}
                className="flex items-center gap-2.5 group"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 + idx * 0.1, duration: 0.4 }}
              >
                <div className={`rounded-xl p-2.5 ${stat.color} transition-all duration-300 group-hover:scale-110 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:scale-100`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-xl sm:text-2xl font-bold tracking-tight leading-none">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 pt-1" variants={itemVariants}>
            <Button size="lg" className="h-11 w-full px-8 text-sm font-semibold shadow-lg shadow-primary/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-primary/40 motion-reduce:transition-none motion-reduce:hover:scale-100 sm:w-auto" asChild>
              <a href="#trending" onClick={(e) => { e.preventDefault(); scrollToElement('trending'); }}>
                {t('hero.exploreTrending')}
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-11 w-full px-8 text-sm font-semibold transition-all duration-300 hover:bg-primary/5 motion-reduce:transition-none sm:w-auto" asChild>
              <a href="#categories" onClick={(e) => { e.preventDefault(); scrollToElement('categories'); }}>{t('sections.categories')}</a>
            </Button>
            <Button size="lg" variant="ghost" className="h-11 w-full px-6 text-sm font-semibold text-muted-foreground transition-all duration-300 hover:text-primary motion-reduce:transition-none sm:w-auto" onClick={() => navigate('/for-you')}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              For You
            </Button>
          </motion.div>
        </div>
      </motion.div>
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
