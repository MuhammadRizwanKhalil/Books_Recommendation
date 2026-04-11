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

  const stats = [
    { icon: BookOpen, label: t('hero.booksIndexed'), value: publicStats ? formatNumber(publicStats.totalBooks) : '...', color: 'text-blue-500 bg-blue-500/10' },
    { icon: TrendingUp, label: t('hero.totalReviews'), value: publicStats ? formatNumber(publicStats.totalReviews) : '...', color: 'text-emerald-500 bg-emerald-500/10' },
    { icon: Star, label: t('hero.avgRating'), value: publicStats ? `${publicStats.avgRating}/5` : '...', color: 'text-amber-500 bg-amber-500/10' },
  ];

  const popularSearches = popularSearchesSetting.split(',').map(s => s.trim()).filter(Boolean);

  // Split tagline for styled last word
  const lastSpaceIdx = siteTagline.lastIndexOf(' ');
  const taglinePart1 = lastSpaceIdx > 0 ? siteTagline.substring(0, lastSpaceIdx) : '';
  const taglinePart2 = lastSpaceIdx > 0 ? siteTagline.substring(lastSpaceIdx + 1) : siteTagline;

  return (
    <section id="hero" className="relative min-h-[80vh] sm:min-h-[92vh] flex flex-col justify-center overflow-hidden" role="banner">
      {/* Layered Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,hsl(var(--accent)/0.12),transparent_60%)]" />
      
      {/* Floating decorative books */}
      <div className="absolute top-16 right-[10%] w-20 h-28 rounded-lg bg-primary/[0.07] rotate-12 animate-float hidden lg:block" />
      <div className="absolute top-32 right-[20%] w-16 h-24 rounded-lg bg-accent/30 -rotate-6 animate-float hidden lg:block" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-24 left-[8%] w-14 h-20 rounded-lg bg-primary/[0.06] rotate-6 animate-float hidden lg:block" style={{ animationDelay: '4s' }} />
      
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(hsl(var(--foreground))_1px,transparent_1px),linear-gradient(to_right,hsl(var(--foreground))_1px,transparent_1px)] bg-[size:60px_60px]" />
      
      <div className="relative container mx-auto px-4 py-12 sm:py-16 md:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-6 sm:space-y-8 md:space-y-10">
          {/* Badge */}
          <div className="flex justify-center">
            <Badge variant="secondary" className="px-5 py-2.5 text-sm font-medium gap-2 shadow-sm border border-border/50">
              <Sparkles className="w-4 h-4 text-primary" />
              {heroBadge}
            </Badge>
          </div>

          {/* Headline with serif font */}
          <div className="space-y-6">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1]">
              {taglinePart1 && <>{taglinePart1}{' '}</>}
              <span className="text-primary relative">
                {taglinePart2}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-primary/30" viewBox="0 0 200 8" preserveAspectRatio="none"><path d="M0 7 Q50 0 100 5 Q150 0 200 7" stroke="currentColor" strokeWidth="2.5" fill="none" /></svg>
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {siteDescription}
            </p>
          </div>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto" role="search" aria-label="Search books">
            <SearchDropdown size="lg" />
            
            {/* Popular Searches */}
            <nav className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Popular searches">
              <span className="text-sm text-muted-foreground font-medium">{t('hero.popular')}</span>
              {popularSearches.map((term) => (
                <a
                  key={term}
                  href={`/search?q=${encodeURIComponent(term)}`}
                  onClick={(e) => { e.preventDefault(); navigate(`/search?q=${encodeURIComponent(term)}`); }}
                  className="text-sm text-primary/80 hover:text-primary hover:underline underline-offset-4 transition-colors"
                >
                  {term}
                </a>
              ))}
            </nav>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 md:gap-10 pt-6">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 group">
                <div className={`p-3 rounded-xl ${stat.color} transition-transform group-hover:scale-110`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <p className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 pt-2">
            <Button size="lg" className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all w-full sm:w-auto" asChild>
              <a href="#trending" onClick={(e) => { e.preventDefault(); scrollToElement('trending'); }}>
                {t('hero.exploreTrending')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base font-semibold w-full sm:w-auto" asChild>
              <a href="#categories" onClick={(e) => { e.preventDefault(); scrollToElement('categories'); }}>{t('sections.categories')}</a>
            </Button>
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
