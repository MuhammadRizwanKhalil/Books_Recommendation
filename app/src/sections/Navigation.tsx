import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, Heart, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { UserProfile } from '@/components/UserProfile';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { SearchDropdown } from '@/components/SearchDropdown';
import { useWishlist } from '@/components/WishlistProvider';
import { useAuth } from '@/components/AuthProvider';
import { useSettings } from '@/components/SettingsProvider';
import { useTranslation } from '@/lib/i18n';
import { LogoMark } from '@/components/ui/Logo';
import { cn } from '@/lib/utils';

const sectionLinks = [
  { labelKey: 'sections.trending', href: '/#trending' },
  { labelKey: 'sections.categories', href: '/#categories' },
  { labelKey: 'sections.newReleases', href: '/#new-releases' },
  { labelKey: 'sections.topRated', href: '/#top-rated' },
  { labelKey: 'sections.featuredAuthors', href: '/#authors' },
];

const pageLinks = [
  { labelKey: 'nav.blog', href: '/blog' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { wishlistCount, openWishlistDrawer } = useWishlist();
  const { isAuthenticated, openAuthModal } = useAuth();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const siteName = getSetting('site_name', 'The Book Times');
  const logoUrl = getSetting('site_logo_url', '');

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to hash section after navigation to home page
  useEffect(() => {
    if (location.pathname === '/' && location.hash) {
      // Delay to allow home page sections to render
      const timer = setTimeout(() => {
        const el = document.querySelector(location.hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.hash]);

  // Global keyboard shortcut: Ctrl/Cmd+K to open search
  useEffect(() => {
    const handleKeyboard = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, []);

  const scrollToSection = useCallback((href: string) => {
    const hash = href.replace('/', '');
    if (location.pathname !== '/') {
      // Navigate to home with hash — the useEffect above will handle scrolling
      navigate('/' + hash);
      return;
    }
    const element = document.querySelector(hash);
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  }, [location.pathname, navigate]);

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        isScrolled
          ? 'bg-background/85 backdrop-blur-xl shadow-sm border-b h-14 sm:h-16'
          : 'bg-transparent h-16 sm:h-20'
      )}
    >
      <div className="container mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-full min-h-[3.5rem] sm:min-h-[4rem]">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group" aria-label={`${siteName} - Home`}>
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-contain" />
            ) : (
              <div className="p-1.5 sm:p-2 rounded-xl bg-primary shadow-sm transition-all group-hover:shadow-md group-hover:scale-105">
                <LogoMark size={20} className="text-primary-foreground" />
              </div>
            )}
            <span className="text-base sm:text-lg font-serif font-bold tracking-tight">{siteName}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {sectionLinks.map((link) => (
              <a
                key={link.labelKey}
                href={link.href}
                onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                className="inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-all duration-200"
              >
                {t(link.labelKey)}
              </a>
            ))}
            {pageLinks.map((link) => (
              <Link
                key={link.labelKey}
                to={link.href}
                className={cn(
                  'inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                  location.pathname.startsWith(link.href)
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
                )}
              >
                {t(link.labelKey)}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Toggle */}
            <div className={cn(
              'hidden md:flex items-center transition-all duration-300',
              isSearchOpen ? 'w-80' : 'w-auto'
            )}>
              {isSearchOpen ? (
                <SearchDropdown
                  autoFocus
                  className="w-full"
                  onClose={() => setIsSearchOpen(false)}
                />
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSearchOpen(true)}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  <span className="text-muted-foreground text-xs hidden xl:block">Search...</span>
                  <kbd className="hidden xl:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl+'}K
                  </kbd>
                </Button>
              )}
            </div>

            <LanguageSwitcher />
            <ThemeToggle />

            {/* Wishlist */}
            <Button variant="ghost" size="icon" className="relative" onClick={() => {
              if (!isAuthenticated) { openAuthModal('signin'); return; }
              openWishlistDrawer();
            }}>
              <Heart className="h-5 w-5" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wishlistCount > 99 ? '99+' : wishlistCount}
                </span>
              )}
            </Button>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="hidden md:flex"><UserProfile /></div>
            ) : (
              <Button variant="ghost" size="sm" className="hidden md:flex" onClick={() => openAuthModal('signin')}>
                <User className="h-4 w-4 mr-2" />
                {t('nav.signIn')}
              </Button>
            )}

            {/* Mobile Menu */}
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[min(80vw,20rem)]">
                {/* Mobile brand header */}
                <div className="flex items-center gap-2.5 pb-4 mb-2 border-b">
                  <div className="p-2 rounded-xl bg-primary">
                    <LogoMark size={20} className="text-primary-foreground" />
                  </div>
                  <span className="text-lg font-serif font-bold tracking-tight">{siteName}</span>
                </div>
                <div className="flex flex-col gap-6 mt-4">
                  {/* Mobile Search */}
                  <SearchDropdown
                    onClose={() => setIsMobileOpen(false)}
                  />

                  {/* Mobile Nav Links */}
                  <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
                    {sectionLinks.map((link) => (
                      <a
                        key={link.labelKey}
                        href={link.href}
                        onClick={(e) => { e.preventDefault(); setIsMobileOpen(false); setTimeout(() => scrollToSection(link.href), 300); }}
                        className="flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                      >
                        {t(link.labelKey)}
                      </a>
                    ))}
                    {pageLinks.map((link) => (
                      <Link
                        key={link.labelKey}
                        to={link.href}
                        onClick={() => setIsMobileOpen(false)}
                        className="flex items-center px-4 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                      >
                        {t(link.labelKey)}
                      </Link>
                    ))}
                  </nav>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center justify-between px-1 pb-2">
                      <span className="text-sm text-muted-foreground">{t('nav.language')}</span>
                      <LanguageSwitcher />
                    </div>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() => {
                        setIsMobileOpen(false);
                        if (!isAuthenticated) { openAuthModal('signin'); return; }
                        openWishlistDrawer();
                      }}
                    >
                      <Heart className="h-4 w-4" />
                      {t('nav.wishlist')}
                      {wishlistCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">{wishlistCount}</Badge>
                      )}
                    </Button>
                    {isAuthenticated ? (
                      <UserProfile />
                    ) : (
                      <>
                        <Button variant="outline" className="w-full" onClick={() => openAuthModal('signin')}>
                          <User className="h-4 w-4 mr-2" /> {t('nav.signIn')}
                        </Button>
                        <Button variant="default" className="w-full" onClick={() => openAuthModal('signup')}>
                          {t('nav.createAccount')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
