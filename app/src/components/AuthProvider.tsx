import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { ApiError, authApi, setToken } from '@/api/client';

type SocialProvider = 'google' | 'apple';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  joinedAt: string;
  bio?: string;
  reviewCount?: number;
  followerCount?: number;
  followingCount?: number;
  twoFactorEnabled?: boolean;
  hasPassword?: boolean;
  onboardingCompleted?: boolean;
}

interface ReadingHistoryEntry {
  bookId: string;
  bookTitle: string;
  bookAuthor: string;
  bookCover: string;
  bookSlug?: string;
  viewedAt: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'signin' | 'signup') => void;
  closeAuthModal: () => void;
  authModalMode: 'signin' | 'signup';
  setAuthModalMode: (mode: 'signin' | 'signup') => void;
  signIn: (email: string, password: string) => Promise<boolean | { requires2FA: true; tempToken: string }>;
  verify2FA: (tempToken: string, code: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signInWithSocial: (provider: SocialProvider, token: string) => Promise<boolean>;
  signOut: () => void;
  readingHistory: ReadingHistoryEntry[];
  addToReadingHistory: (entry: Omit<ReadingHistoryEntry, 'viewedAt'>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'thebooktimes-user';
const HISTORY_STORAGE_KEY = 'thebooktimes-reading-history';

function loadUser(): UserProfile | null {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function loadHistory(): ReadingHistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(loadUser);
  const [isLoading, setIsLoading] = useState(() => !!localStorage.getItem('thebooktimes-token'));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryEntry[]>(loadHistory);

  // Validate stored token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('thebooktimes-token');
    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    authApi.getMe()
      .then((res) => {
        setUser((prev) => ({
          id: String(res.id),
          email: res.email,
          name: res.name,
          avatar: res.avatarUrl || prev?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(res.name)}`,
          role: (res.role || 'user') as 'user' | 'admin',
          joinedAt: prev?.joinedAt || new Date().toISOString(),
          reviewCount: res.reviewCount || 0,
          followerCount: res.followerCount || 0,
          followingCount: res.followingCount || 0,
          bio: prev?.bio || '',
          hasPassword: res.hasPassword,
          onboardingCompleted: prev?.onboardingCompleted,
        }));
      })
      .catch((err: unknown) => {
        // If backend rejects the token, force logout so protected routes
        // (especially admin) cannot be entered using stale local storage data.
        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          setUser(null);
          return;
        }

        // Keep existing user data on transient/network errors.
        setUser((prev) => prev ?? loadUser());
      })
      .finally(() => setIsLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  }, [user]);

  useEffect(() => {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(readingHistory));
  }, [readingHistory]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('thebooktimes:unauthorized', onUnauthorized);
    return () => window.removeEventListener('thebooktimes:unauthorized', onUnauthorized);
  }, []);

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean | { requires2FA: true; tempToken: string }> => {
    try {
      const res = await authApi.login(email, password);

      // Handle 2FA challenge
      if (res.requires2FA && res.tempToken) {
        return { requires2FA: true, tempToken: res.tempToken };
      }

      setToken(res.token);
      const profile: UserProfile = {
        id: String(res.user.id),
        name: res.user.name,
        email: res.user.email,
        avatar: res.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(res.user.name)}`,
        role: res.user.role || 'user',
        joinedAt: new Date().toISOString(),
        bio: '',
      };
      setUser(profile);
      setIsAuthModalOpen(false);
      toast.success(`Welcome back, ${profile.name}!`);
      return true;
    } catch (err: any) {
      toast.error(err?.body?.error || 'Sign in failed');
      return false;
    }
  }, []);

  const verify2FA = useCallback(async (tempToken: string, code: string): Promise<boolean> => {
    try {
      const res = await authApi.verify2FA(tempToken, code);
      setToken(res.token);
      const profile: UserProfile = {
        id: String(res.user.id),
        name: res.user.name,
        email: res.user.email,
        avatar: res.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(res.user.name)}`,
        role: res.user.role || 'user',
        joinedAt: new Date().toISOString(),
        bio: '',
      };
      setUser(profile);
      setIsAuthModalOpen(false);
      toast.success(`Welcome back, ${profile.name}!`);
      return true;
    } catch (err: any) {
      toast.error(err?.body?.error || 'Invalid verification code');
      return false;
    }
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.register(name, email, password);
      setToken(res.token);
      const profile: UserProfile = {
        id: String(res.user.id),
        name: res.user.name,
        email: res.user.email,
        avatar: res.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
        role: res.user.role || 'user',
        joinedAt: new Date().toISOString(),
        bio: '',
        // Flag new users so the onboarding modal triggers
        onboardingCompleted: false,
      };
      setUser(profile);
      setIsAuthModalOpen(false);
      toast.success(`Welcome to The Book Times, ${name}!`, {
        description: 'Your account has been created. Let\'s personalise your reading list!',
      });
      return true;
    } catch (err: any) {
      toast.error(err?.body?.error || 'Sign up failed');
      return false;
    }
  }, []);

  const signInWithSocial = useCallback(async (provider: SocialProvider, token: string): Promise<boolean> => {
    try {
      const res = provider === 'google'
        ? await authApi.socialGoogle(token)
        : await authApi.socialApple(token);

      setToken(res.token);
      const profile: UserProfile = {
        id: String(res.user.id),
        name: res.user.name,
        email: res.user.email,
        avatar: res.user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(res.user.name)}`,
        role: res.user.role || 'user',
        joinedAt: new Date().toISOString(),
        bio: '',
        hasPassword: res.user.hasPassword ?? false,
      };
      setUser(profile);
      setIsAuthModalOpen(false);
      toast.success(`Signed in with ${provider === 'google' ? 'Google' : 'Apple'}!`);
      return true;
    } catch (err: any) {
      toast.error(err?.body?.error || `Sign in with ${provider} failed`);
      return false;
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    toast.info('You have been signed out.');
  }, []);

  const addToReadingHistory = useCallback(
    (entry: Omit<ReadingHistoryEntry, 'viewedAt'>) => {
      setReadingHistory((prev) => {
        const filtered = prev.filter((e) => e.bookId !== entry.bookId);
        return [{ ...entry, viewedAt: new Date().toISOString() }, ...filtered].slice(0, 50);
      });
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !isLoading && !!user,
        isAdmin: !isLoading && user?.role === 'admin',
        isLoading,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
        authModalMode,
        setAuthModalMode,
        signIn,
        verify2FA,
        signUp,
        signInWithSocial,
        signOut,
        readingHistory,
        addToReadingHistory,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
