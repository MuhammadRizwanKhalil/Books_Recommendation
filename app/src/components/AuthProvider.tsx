import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { authApi, setToken } from '@/api/client';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'user' | 'admin';
  joinedAt: string;
  bio?: string;
  reviewCount?: number;
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
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (name: string, email: string, password: string) => Promise<boolean>;
  signOut: () => void;
  readingHistory: ReadingHistoryEntry[];
  addToReadingHistory: (entry: Omit<ReadingHistoryEntry, 'viewedAt'>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'bookdiscovery-user';
const HISTORY_STORAGE_KEY = 'bookdiscovery-reading-history';

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
  const [isLoading, setIsLoading] = useState(() => !!loadUser());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup'>('signin');
  const [readingHistory, setReadingHistory] = useState<ReadingHistoryEntry[]>(loadHistory);

  // Validate stored token on app load
  useEffect(() => {
    const storedToken = localStorage.getItem('bookdiscovery-token');
    if (storedToken && user) {
      setIsLoading(true);
      authApi.getMe().then((res) => {
        // Token valid — refresh user data
        setUser(prev => ({ id: res.id, email: res.email, name: res.name, avatar: res.avatarUrl || '', role: res.role as 'user' | 'admin', joinedAt: prev?.joinedAt || new Date().toISOString(), reviewCount: res.reviewCount || 0 }));
      }).catch(() => {
        // Token expired or invalid — sign out
        setUser(null);
        setToken(null);
      }).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
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

  const openAuthModal = useCallback((mode: 'signin' | 'signup' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(email, password);
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
      };
      setUser(profile);
      setIsAuthModalOpen(false);
      toast.success(`Welcome to BookDiscovery, ${name}!`, {
        description: 'Your account has been created.',
      });
      return true;
    } catch (err: any) {
      toast.error(err?.body?.error || 'Sign up failed');
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
        signUp,
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
