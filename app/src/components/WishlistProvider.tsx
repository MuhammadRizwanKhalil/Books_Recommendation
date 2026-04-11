import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Book } from '@/types';
import { toast } from 'sonner';
import { wishlistApi } from '@/api/client';
import { useAuth } from './AuthProvider';

interface WishlistContextType {
  wishlist: Book[];
  wishlistIds: Set<string>;
  addToWishlist: (book: Book) => void;
  removeFromWishlist: (bookId: string) => void;
  toggleWishlist: (book: Book) => void;
  isInWishlist: (bookId: string) => boolean;
  clearWishlist: () => void;
  wishlistCount: number;
  isWishlistOpen: boolean;
  openWishlistDrawer: () => void;
  closeWishlistDrawer: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const STORAGE_KEY = 'thebooktimes-wishlist';

function loadLocalWishlist(): Book[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveLocalWishlist(books: Book[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    console.error('Failed to save wishlist');
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [wishlist, setWishlist] = useState<Book[]>(loadLocalWishlist);
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(
    () => new Set(loadLocalWishlist().map((b) => b.id))
  );
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const openWishlistDrawer = useCallback(() => setIsWishlistOpen(true), []);
  const closeWishlistDrawer = useCallback(() => setIsWishlistOpen(false), []);
  const syncedRef = useRef(false);

  // Sync wishlist from backend when authenticated
  useEffect(() => {
    if (isAuthenticated && !syncedRef.current) {
      syncedRef.current = true;
      wishlistApi.list().then((res) => {
        const books: Book[] = res.items.map((item) => ({
          id: item.id,
          googleBooksId: '',
          title: item.title,
          author: item.author,
          slug: item.slug,
          coverImage: item.coverImage,
          googleRating: item.googleRating,
          ratingsCount: item.ratingsCount,
          computedScore: item.googleRating || 0,
          publishedDate: item.publishedDate,
          amazonUrl: item.amazonUrl,
          description: '',
          categories: [],
          pageCount: 0,
          language: 'en',
          currency: 'USD',
          status: 'PUBLISHED' as const,
          isActive: true,
          indexedAt: '',
          createdAt: '',
          updatedAt: '',
        }));
        setWishlist(books);
      }).catch(() => {
        // Fallback to localStorage on error
      });
    }
    if (!isAuthenticated) {
      syncedRef.current = false;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    saveLocalWishlist(wishlist);
    setWishlistIds(new Set(wishlist.map((b) => b.id)));
  }, [wishlist]);

  const addToWishlist = useCallback((book: Book) => {
    setWishlist((prev) => {
      if (prev.some((b) => b.id === book.id)) return prev;
      toast.success(`"${book.title}" added to your wishlist!`, {
        description: `By ${book.author}`,
        action: {
          label: 'Undo',
          onClick: () => removeFromWishlist(book.id),
        },
      });
      return [...prev, book];
    });
    if (isAuthenticated) {
      wishlistApi.add(book.id).catch(() => {});
    }
  }, [isAuthenticated]);

  const removeFromWishlist = useCallback((bookId: string) => {
    setWishlist((prev) => {
      const book = prev.find((b) => b.id === bookId);
      if (book) {
        toast.info(`"${book.title}" removed from wishlist`);
      }
      return prev.filter((b) => b.id !== bookId);
    });
    if (isAuthenticated) {
      wishlistApi.remove(bookId).catch(() => {});
    }
  }, [isAuthenticated]);

  const toggleWishlist = useCallback((book: Book) => {
    setWishlist((prev) => {
      const exists = prev.some((b) => b.id === book.id);
      if (exists) {
        toast.info(`"${book.title}" removed from wishlist`);
        if (isAuthenticated) wishlistApi.remove(book.id).catch(() => {});
        return prev.filter((b) => b.id !== book.id);
      } else {
        toast.success(`"${book.title}" added to your wishlist!`, {
          description: `By ${book.author}`,
        });
        if (isAuthenticated) wishlistApi.add(book.id).catch(() => {});
        return [...prev, book];
      }
    });
  }, [isAuthenticated]);

  const isInWishlist = useCallback(
    (bookId: string) => wishlistIds.has(bookId),
    [wishlistIds]
  );

  const clearWishlist = useCallback(() => {
    setWishlist([]);
    toast.info('Wishlist cleared');
    if (isAuthenticated) {
      wishlistApi.clear().catch(() => {});
    }
  }, [isAuthenticated]);

  return (
    <WishlistContext.Provider
      value={{
        wishlist,
        wishlistIds,
        addToWishlist,
        removeFromWishlist,
        toggleWishlist,
        isInWishlist,
        clearWishlist,
        wishlistCount: wishlist.length,
        isWishlistOpen,
        openWishlistDrawer,
        closeWishlistDrawer,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
