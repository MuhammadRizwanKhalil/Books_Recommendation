import { useNavigate } from 'react-router-dom';
import { BookOpen, TrendingUp, Star, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePublicStats } from '@/hooks/useBooks';
import { scrollToElement } from '@/lib/utils';
import { useSettings } from '@/components/SettingsProvider';
import { SearchDropdown } from '@/components/SearchDropdown';
import { useTranslation } from '@/lib/i18n';

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

  // Only show stats that have reached credible thresholds
  const allStats = [
    publicStats && publicStats.totalBooks >= 100 ? { icon: BookOpen, label: t('hero.booksIndexed'), value: formatNumber(publicStats.totalBooks), color: 'text-blue-500 bg-blue-500/10' } : null,
    publicStats && publicStats.totalReviews >= 10 ? { icon: TrendingUp, label: t('hero.totalReviews'), value: formatNumber(publicStats.totalReviews), color: 'text-emerald-500 bg-emerald-500/10' } : null,
    publicStats && publicStats.totalReviews >= 10 ? { icon: Star, label: t('hero.avgRating'), value: `${publicStats.avgRating}/5`, color: 'text-amber-500 bg-amber-500/10' } : null,
  ];
  const stats = allStats.filter(Boolean) as { icon: typeof BookOpen; label: string; value: string; color: string }[];

  const popularSearches = popularSearchesSetting.split(',').map(s => s.trim()).filter(Boolean);

  // Split tagline for styled last word
  const lastSpaceIdx = siteTagline.lastIndexOf(' ');
  const taglinePart1 = lastSpaceIdx > 0 ? siteTagline.substring(0, lastSpaceIdx) : '';
  const taglinePart2 = lastSpaceIdx > 0 ? siteTagline.substring(lastSpaceIdx + 1) : siteTagline;

  return (
    <section id="hero" className="relative min-h-[55vh] sm:min-h-[60vh] flex flex-col justify-center overflow-hidden" role="banner">
      {/* Layered Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:60px_60px]" />
      
      <div className="relative container mx-auto px-4 py-10 sm:py-14 md:py-18">
        <div className="max-w-4xl mx-auto text-center space-y-5 sm:space-y-6">
          {/* Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-4 py-1.5 text-xs font-medium gap-1.5 shadow-sm border border-border/50">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {heroBadge}
            </Badge>
          </div>

          {/* Headline */}
          <div className="space-y-3">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              {taglinePart1 && <>{taglinePart1}{' '}</>}
              <span className="text-primary relative">
                {taglinePart2}
                <svg className="absolute -bottom-1.5 left-0 w-full h-2.5 text-primary/30" viewBox="0 0 200 8" preserveAspectRatio="none"><path d="M0 7 Q50 0 100 5 Q150 0 200 7" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>
              </span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {siteDescription}
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto" role="search" aria-label="Search books">
            <SearchDropdown size="lg" />
            <nav className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Popular searches">
              <span className="text-xs text-muted-foreground font-medium">{t('hero.popular')}</span>
              {popularSearches.map((term) => (
                <a
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(term)}`); }}
                  className="text-xs text-primary/80 hover:text-primary hover:underline underline-offset-4 transition-colors"
                >
                  {term}
                </a>
              ))}
            </nav>
          </div>

          {/* Stats + CTA row combined */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 pt-2">
            {stats.length > 0 && stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 group">
                <div className={`p-2 rounded-lg ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="text-xl sm:text-2xl font-bold tracking-tight leading-none">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-row flex-wrap justify-center gap-3 pt-1">
            <Button size="default" className="h-10 px-6 text-sm font-semibold shadow-md shadow-primary/20 hover:shadow-primary/30 transition-all" asChild>
              <a href="#trending" onClick={(e) => { e.preventDefault(); scrollToElement('trending'); }}>
                {t('hero.exploreTrending')}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
            <Button size="default" variant="outline" className="h-10 px-6 text-sm font-semibold" asChild>
              <a href="#categories" onClick={(e) => { e.preventDefault(); scrollToElement('categories'); }}>{t('sections.categories')}</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
