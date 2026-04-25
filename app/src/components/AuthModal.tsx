import { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, UserIcon, Loader2, ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/ui/Logo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          prompt: (listener?: (notification: {
            isNotDisplayed?: () => boolean;
            isSkippedMoment?: () => boolean;
          }) => void) => void;
        };
      };
    };
  }
}

// API helper
const API_BASE = import.meta.env.VITE_API_URL || '/api';
async function apiFetch<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

type AuthView = 'signin' | 'signup' | 'forgot-email' | 'forgot-otp' | 'forgot-newpass' | 'forgot-success';

const GOOGLE_CLIENT_ID = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
let googleIdentityScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleIdentityScriptPromise) return googleIdentityScriptPromise;

  googleIdentityScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Sign-In SDK.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Sign-In SDK.'));
    document.head.appendChild(script);
  });

  return googleIdentityScriptPromise;
}

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, authModalMode, setAuthModalMode, signIn, signUp, signInWithSocial } =
    useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Forgot password state
  const [view, setView] = useState<AuthView>('signin');
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isSignUp = authModalMode === 'signup' && view === 'signup';

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setError('');
    setView('signin');
    setForgotEmail('');
    setOtp('');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Sync view with auth mode
  const currentView: AuthView = view.startsWith('forgot') ? view : authModalMode === 'signup' ? 'signup' : 'signin';

  // ── Normal Login/Register ──────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (isSignUp && !name) {
      setError('Name is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const result = isSignUp
        ? await signUp(name, email, password)
        : await signIn(email, password);
      if (result === true) {
        resetForm();
      } else if (result && typeof result === 'object' && 'requires2FA' in result) {
        setError('This account requires 2FA. Please use the admin login page.');
      } else {
        setError(isSignUp ? 'Registration failed. This email may already be in use.' : 'Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Step 1: Send OTP ──────────────────────────────
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!forgotEmail) {
      setError('Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', { email: forgotEmail });
      toast.success('Verification code sent! Check your email.');
      setView('forgot-otp');
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Step 2: Verify OTP ────────────────────────────
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{ resetToken: string }>('/auth/verify-reset-otp', {
        email: forgotEmail,
        otp,
      });
      setResetToken(result.resetToken);
      setView('forgot-newpass');
      toast.success('Code verified! Set your new password.');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password Step 3: Set New Password ─────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', { resetToken, newPassword });
      setView('forgot-success');
      toast.success('Password reset successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      if (!GOOGLE_CLIENT_ID) {
        setError('Google sign-in is not configured yet. Set VITE_GOOGLE_CLIENT_ID in the frontend environment.');
        return;
      }

      await loadGoogleIdentityScript();

      const googleId = window.google?.accounts?.id;
      if (!googleId) {
        setError('Google sign-in is temporarily unavailable. Please continue with email.');
        return;
      }

      const idToken = await new Promise<string>((resolve, reject) => {
        const timeoutId = window.setTimeout(() => {
          reject(new Error('Google sign-in timed out. Please try again.'));
        }, 15000);

        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
          callback: (response) => {
            window.clearTimeout(timeoutId);
            if (response?.credential) {
              resolve(response.credential);
            } else {
              reject(new Error('Google sign-in was cancelled.'));
            }
          },
        });

        // Opens Google account chooser / one-tap flow.
        googleId.prompt((notification) => {
          if (notification?.isNotDisplayed?.() || notification?.isSkippedMoment?.()) {
            window.clearTimeout(timeoutId);
            reject(new Error('Google sign-in prompt could not be displayed. Check allowed origins in Google Cloud Console.'));
          }
        });
      });

      const ok = await signInWithSocial('google', idToken);
      if (ok) resetForm();
      else setError('Failed to sign in with Google.');
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please continue with email.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setAuthModalMode(isSignUp ? 'signin' : 'signup');
    setView(isSignUp ? 'signin' : 'signup');
    setError('');
  };

  const goToForgotPassword = () => {
    setView('forgot-email');
    setForgotEmail(email || ''); // pre-fill from login form
    setError('');
  };

  const goBackToLogin = () => {
    setView('signin');
    setAuthModalMode('signin');
    setError('');
  };

  return (
    <Dialog
      open={isAuthModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeAuthModal();
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-[420px] max-h-[88vh] overflow-y-auto p-5">
        {/* ═══ FORGOT PASSWORD: Enter Email ═══ */}
        {currentView === 'forgot-email' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto p-3 rounded-xl bg-amber-500/10">
                <KeyRound className="h-8 w-8 text-amber-500" />
              </div>
              <DialogTitle className="text-2xl font-bold">Forgot Password?</DialogTitle>
              <DialogDescription>
                No worries! Enter your email and we'll send you a 6-digit verification code.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleForgotSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    className="pl-9"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>
            </form>
            <button
              onClick={goBackToLogin}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto mt-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </>
        )}

        {/* ═══ FORGOT PASSWORD: Enter OTP ═══ */}
        {currentView === 'forgot-otp' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto p-3 rounded-xl bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <DialogTitle className="text-2xl font-bold">Check Your Email</DialogTitle>
              <DialogDescription>
                We sent a 6-digit code to <strong className="text-foreground">{forgotEmail}</strong>. Enter it below.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleOtpVerify} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="otp-input">Verification Code</Label>
                <Input
                  id="otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-[0.5em] h-14"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoFocus
                  autoComplete="one-time-code"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Code expires in 10 minutes. Didn't receive it?{' '}
                <button
                  type="button"
                  onClick={() => { setView('forgot-email'); setError(''); }}
                  className="text-foreground font-semibold hover:underline"
                >
                  Resend
                </button>
              </p>
              {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
              <Button type="submit" className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" disabled={loading || otp.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>
            </form>
            <button
              onClick={goBackToLogin}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto mt-2 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Sign In
            </button>
          </>
        )}

        {/* ═══ FORGOT PASSWORD: New Password ═══ */}
        {currentView === 'forgot-newpass' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto p-3 rounded-xl bg-emerald-500/10">
                <Lock className="h-8 w-8 text-emerald-500" />
              </div>
              <DialogTitle className="text-2xl font-bold">Set New Password</DialogTitle>
              <DialogDescription>
                Choose a strong password. At least 8 characters.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9 pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-sm text-amber-600 dark:text-amber-400">Passwords don't match yet.</p>
              )}
              {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>}
              <Button
                type="submit"
                className="w-full bg-foreground text-background hover:bg-foreground/90"
                size="lg"
                disabled={loading || newPassword.length < 8 || newPassword !== confirmPassword}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </form>
          </>
        )}

        {/* ═══ FORGOT PASSWORD: Success ═══ */}
        {currentView === 'forgot-success' && (
          <>
            <DialogHeader className="text-center space-y-3">
              <div className="mx-auto p-3 rounded-xl bg-emerald-500/10">
                <ShieldCheck className="h-10 w-10 text-emerald-500" />
              </div>
              <DialogTitle className="text-2xl font-bold">Password Reset!</DialogTitle>
              <DialogDescription>
                Your password has been changed successfully. All existing sessions have been logged out for security.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <Button className="w-full bg-foreground text-background hover:bg-foreground/90" size="lg" onClick={goBackToLogin}>
                Sign In with New Password
              </Button>
            </div>
          </>
        )}

        {/* ═══ NORMAL: Sign In / Sign Up ═══ */}
        {(currentView === 'signin' || currentView === 'signup') && (
          <>
            <DialogHeader className="text-center space-y-2">
              <div className="mx-auto p-3 rounded-xl bg-primary/10">
                <LogoMark size={28} className="text-primary" />
              </div>
              <DialogTitle className="text-xl font-bold leading-tight">
                {isSignUp ? 'Create Account' : 'Welcome Back'}
              </DialogTitle>
              <DialogDescription className="text-sm">
                {isSignUp
                  ? 'Join The Book Times to save favorites and get personalized recommendations.'
                  : 'Sign in to access your wishlist, reviews, and reading history.'}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-3">
              <Button
                type="button"
                variant="outline"
                className="h-10 w-full justify-center gap-2.5 border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
                onClick={() => void handleGoogleSignIn()}
                disabled={loading}
                aria-label="Continue with Google"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4285F4] text-xs font-bold text-white">G</span>
                Continue with Google
              </Button>
            </div>

            <div className="relative my-3">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
                or continue with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Full Name</Label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="auth-name"
                      type="text"
                      placeholder="John Doe"
                      className="h-10 pl-9"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="auth-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-email"
                    type="email"
                    placeholder="you@example.com"
                    className="h-10 pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auth-password">Password</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={goToForgotPassword}
                      className="text-xs text-foreground font-semibold hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="h-10 pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
              )}

              <Button type="submit" className="h-10 w-full bg-foreground text-background hover:bg-foreground/90" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? 'Create Account' : 'Sign In'}
              </Button>
            </form>

            <Separator className="my-3" />

            <p className="text-center text-sm text-muted-foreground">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-foreground font-semibold hover:underline"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
