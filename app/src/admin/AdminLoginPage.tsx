import { useState } from 'react';
import { Eye, EyeOff, ShieldCheck, Mail, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/components/AuthProvider';
import { useSettings } from '@/components/SettingsProvider';

interface AdminLoginPageProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminLoginPage({ onSuccess, onCancel }: AdminLoginPageProps) {
  const { signIn, signOut, isAdmin, isAuthenticated, user } = useAuth();
  const { getSetting } = useSettings();
  const siteName = getSetting('site_name', 'BookDiscovery');
  const logoUrl = getSetting('site_logo_url', '');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated as admin, redirect immediately
  if (isAuthenticated && isAdmin) {
    onSuccess();
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const success = await signIn(email, password);
      if (success) {
        // Check role after sign-in — the auth provider updates user state
        // We need a small delay for state to propagate
        setTimeout(() => {
          const storedUser = localStorage.getItem('bookdiscovery-user');
          if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user.role === 'admin') {
              onSuccess();
            } else {
              setError('Access denied. This account does not have admin privileges.');
            }
          }
        }, 100);
      }
    } catch {
      setError('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-2xl border-border/50">
        <CardHeader className="text-center space-y-4 pb-2">
          {/* Logo / Brand */}
          <div className="mx-auto flex items-center justify-center">
            <div className="p-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-10 w-10 rounded object-contain" />
              ) : (
                <ShieldCheck className="h-10 w-10 text-primary" />
              )}
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Admin Panel
            </CardTitle>
            <CardDescription className="mt-1.5">
              Sign in to access the {siteName} administration dashboard
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {/* Show message if user is logged in but not admin */}
          {isAuthenticated && !isAdmin && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                You're signed in as <strong>{user?.email}</strong> (regular user).
                Admin privileges are required.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => signOut()}
              >
                Sign out &amp; switch account
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Sign In to Admin
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to website
            </button>
          </div>

          {/* Security notice */}
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-muted/50">
            <ShieldCheck className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              This area is restricted to authorized administrators only.
              All login attempts are monitored and rate-limited.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
