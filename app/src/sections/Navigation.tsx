import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, Heart, User, LogOut, ChevronDown, TrendingUp, LayoutGrid, Sparkles, Star, Brain, Rss, Users, Gift, List } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const browseMenuLinks = [
  { label: 'Trending', href: '/trending', icon: TrendingUp, description: 'See what everyone is reading' },
  { label: 'Categories', href: '/categories', icon: LayoutGrid, description: 'Browse by genre & topic' },
  { label: 'New Releases', href: '/search?sort=newest', icon: Sparkles, description: 'Fresh off the press' },
  { label: 'Top Rated', href: '/search?sort=rating-desc', icon: Star, description: 'Highest rated books' },
  { label: 'Mood Discovery', href: '/discover/mood', icon: Brain, description: 'Find books by mood & pace' },
];

const communityMenuLinks = [
  { label: 'Activity Feed', href: '/feed', icon: Rss, description: 'See what friends are reading' },
  { label: 'Book Clubs', href: '/book-clubs', icon: Users, description: 'Join reading groups' },
  { label: 'Giveaways', href: '/giveaways', icon: Gift, description: 'Enter active giveaways' },
  { label: 'Community Lists', href: '/lists/discover', icon: List, description: 'Discover curated lists' },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPastHero, setIsPastHero] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { wishlistCount, openWishlistDrawer } = useWishlist();
  const { isAuthenticated, openAuthModal, user, signOut } = useAuth();
  const { getSetting } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');

  const siteName = getSetting('site_name', 'The Book Times');
  const logoUrl = getSetting('site_logo_url', '');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      setIsPastHero(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          <nav className="hidden lg:flex items-center gap-0.5" aria-label="Main navigation">
            {/* Browse dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'h-9 px-3.5 gap-1.5 text-sm font-medium',
                    ['/trending', '/categories', '/discover/mood'].some(p => location.pathname.startsWith(p))
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
                  )}
                >
                  Browse
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-2">
                {browseMenuLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <DropdownMenuItem key={link.href} asChild className="p-0">
                      <Link
                        to={link.href}
                        className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{link.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Community dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    'h-9 px-3.5 gap-1.5 text-sm font-medium',
                    ['/feed', '/book-clubs', '/giveaways', '/lists'].some(p => location.pathname.startsWith(p))
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
                  )}
                >
                  Community
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72 p-2">
                {communityMenuLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <DropdownMenuItem key={link.href} asChild className="p-0">
                      <Link
                        to={link.href}
                        className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{link.label}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{link.description}</p>
                        </div>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Blog — standalone */}
            <Link
              to="/blog"
              className={cn(
                'inline-flex items-center justify-center px-3.5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                location.pathname.startsWith('/blog')
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/80'
              )}
            >
              Blog
            </Link>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Toggle */}
            <div className={cn(
              'hidden md:flex items-center transition-all duration-300',
              (isSearchOpen || isPastHero) ? 'w-64 lg:w-80' : 'w-auto'
            )}>
              {(isSearchOpen || isPastHero) ? (
                <SearchDropdown
                  autoFocus={isSearchOpen}
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
                    {isMac ? '⌘' : 'Ctrl+'}K
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
              <SheetContent side="right" className="w-[min(80vw,20rem)] p-0 flex flex-col">
                {/* Mobile brand header (sticky inside drawer) */}
                <div className="flex items-center gap-2.5 px-5 pt-6 pb-4 border-b shrink-0">
                  <div className="p-2 rounded-xl bg-primary">
                    <LogoMark size={20} className="text-primary-foreground" />
                  </div>
                  <span className="text-lg font-serif font-bold tracking-tight">{siteName}</span>
                </div>
                <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
                <div className="flex flex-col gap-6">
                  {/* Mobile Search */}
                  <SearchDropdown
                    onClose={() => setIsMobileOpen(false)}
                  />

                  {/* Mobile Nav Links */}
                  <nav className="flex flex-col gap-4" aria-label="Mobile navigation">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">Browse</p>
                      {browseMenuLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {link.label}
                          </Link>
                        );
                      })}
                      <Link
                        to="/blog"
                        onClick={() => setIsMobileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                      >
                        <Sparkles className="h-4 w-4 text-muted-foreground" />
                        Blog
                      </Link>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground px-1">Community</p>
                      {communityMenuLinks.map((link) => {
                        const Icon = link.icon;
                        return (
                          <Link
                            key={link.href}
                            to={link.href}
                            onClick={() => setIsMobileOpen(false)}
                            className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors"
                          >
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            {link.label}
                          </Link>
                        );
                      })}
                    </div>
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
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-muted/50">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user?.avatar} alt={user?.name} />
                            <AvatarFallback className="text-xs">
                              {user?.name?.split(' ').map((n: string) => n[0]).join('') || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{user?.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                          </div>
                        </div>
                        {/* User feature links — previously hidden, now discoverable */}
                        <div className="space-y-1">
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-sm"
                            size="sm"
                            onClick={() => { setIsMobileOpen(false); navigate('/for-you'); }}
                          >
                            🎯 For You
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-sm"
                            size="sm"
                            onClick={() => { setIsMobileOpen(false); navigate('/lists'); }}
                          >
                            📚 My Reading Lists
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-sm"
                            size="sm"
                            onClick={() => { setIsMobileOpen(false); navigate('/up-next'); }}
                          >
                            ⏭️ Up Next Queue
                          </Button>
                          <Button
                            variant="ghost"
                            className="w-full justify-start gap-2 text-sm"
                            size="sm"
                            onClick={() => { setIsMobileOpen(false); navigate('/compare'); }}
                          >
                            ⚖️ Compare Books
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          className="w-full justify-start text-destructive hover:text-destructive gap-2"
                          size="sm"
                          onClick={() => { setIsMobileOpen(false); signOut(); }}
                        >
                          <LogOut className="h-4 w-4" />
                          {t('nav.signOut')}
                        </Button>
                      </div>
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
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
