import { useState } from 'react';
import {
  LayoutDashboard, BookOpen, FolderTree, FileText, Star,
  Users, BarChart3, Mail, ChevronLeft, Menu, LogOut,
  Megaphone, Sparkles, Settings, Download, X, PenTool,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSettings } from '@/components/SettingsProvider';

export type AdminPage = 'dashboard' | 'books' | 'authors' | 'categories' | 'blog' | 'reviews' | 'users' | 'analytics' | 'newsletter' | 'campaigns' | 'email-marketing' | 'import' | 'settings';

interface AdminLayoutProps {
  activePage: AdminPage;
  onNavigate: (page: AdminPage) => void;
  onExit: () => void;
  children: React.ReactNode;
}

const navItems: { id: AdminPage; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'books', label: 'Books', icon: BookOpen },
  { id: 'authors', label: 'Authors', icon: PenTool },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'blog', label: 'Blog Posts', icon: FileText },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'newsletter', label: 'Newsletter', icon: Mail },
  { id: 'campaigns', label: 'Campaigns', icon: Megaphone },
  { id: 'email-marketing', label: 'AI Email', icon: Sparkles },
  { id: 'import', label: 'Book Import', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function AdminLayout({ activePage, onNavigate, onExit, children }: AdminLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { getSetting } = useSettings();
  const siteName = getSetting('site_name', 'BookDiscovery');
  const logoUrl = getSetting('site_logo_url', '');

  const handleNavigate = (page: AdminPage) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b shrink-0">
        {(isMobile || !collapsed) && (
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} className="h-6 w-6 rounded object-contain shrink-0" />
            ) : (
              <BookOpen className="h-6 w-6 text-primary shrink-0" />
            )}
            <span className="font-bold text-lg truncate">{siteName} Admin</span>
          </div>
        )}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-auto shrink-0"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-8 w-8 shrink-0', collapsed ? 'mx-auto' : 'ml-auto')}
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="space-y-1 px-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activePage === item.id ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-10',
                !isMobile && collapsed && 'justify-center px-0'
              )}
              onClick={() => isMobile ? handleNavigate(item.id) : onNavigate(item.id)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {(isMobile || !collapsed) && <span>{item.label}</span>}
            </Button>
          ))}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <Separator />
      <div className="py-2 px-2 shrink-0">
        <Button
          variant="ghost"
          className={cn(
            'w-full justify-start gap-3 h-10 text-muted-foreground hover:text-destructive',
            !isMobile && collapsed && 'justify-center px-0'
          )}
          onClick={onExit}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(isMobile || !collapsed) && <span>Back to Site</span>}
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-card border-r transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent(true)}
      </aside>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-card transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {sidebarContent(false)}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex items-center h-14 px-4 border-b bg-card/95 backdrop-blur-sm md:hidden">
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-semibold text-sm truncate">
            {navItems.find(n => n.id === activePage)?.label || 'Admin'}
          </span>
        </div>
        <ScrollArea className="h-[calc(100vh-3.5rem)] md:h-full">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
