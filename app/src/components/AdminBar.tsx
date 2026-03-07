import { LayoutDashboard, BookOpen, FileText, Star, Users, Settings, BarChart3, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/AuthProvider';
import { useAppNav } from '@/App';
import { useState } from 'react';
import type { AdminPage } from '@/admin/AdminLayout';

/**
 * A WordPress-style floating admin toolbar that appears at the bottom
 * of the screen when an admin is logged in on public pages.
 */
export function AdminBar() {
  const { isAdmin, user } = useAuth();
  const { navigate, currentView } = useAppNav();
  const [dismissed, setDismissed] = useState(false);

  // Only show on public pages when admin is logged in
  if (!isAdmin || currentView.type === 'admin' || dismissed) return null;

  const quickLinks: { label: string; page: AdminPage; icon: typeof LayoutDashboard }[] = [
    { label: 'Dashboard', page: 'dashboard', icon: LayoutDashboard },
    { label: 'Books', page: 'books', icon: BookOpen },
    { label: 'Blog', page: 'blog', icon: FileText },
    { label: 'Reviews', page: 'reviews', icon: Star },
    { label: 'Users', page: 'users', icon: Users },
    { label: 'Analytics', page: 'analytics', icon: BarChart3 },
    { label: 'Campaigns', page: 'campaigns', icon: Mail },
    { label: 'Settings', page: 'settings', icon: Settings },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-zinc-900 text-white border-t border-zinc-700 shadow-2xl">
      <div className="container mx-auto px-4 flex items-center justify-between h-11 gap-2 overflow-x-auto">
        {/* Left — Quick nav links */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-xs font-semibold text-zinc-400 mr-2 hidden sm:inline">
            Admin:
          </span>
          {quickLinks.map((link) => (
            <Button
              key={link.page}
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800"
              onClick={() => navigate({ type: 'admin', page: link.page })}
            >
              <link.icon className="h-3.5 w-3.5 mr-1" />
              <span className="hidden md:inline">{link.label}</span>
            </Button>
          ))}
        </div>

        {/* Right — User info + dismiss */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-zinc-400 hidden lg:inline">
            Logged in as <span className="text-zinc-200 font-medium">{user?.name}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={() => setDismissed(true)}
            title="Dismiss admin bar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
