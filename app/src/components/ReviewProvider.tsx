import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { reviewsApi, type ReviewResponse, type ReviewFilterParams } from '@/api/client';
import { toast } from 'sonner';

export interface Review {
  id: string;
  bookId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  hasSpoiler: boolean;
  spoilerText: string | null;
  authorResponse?: {
    content: string;
    respondedAt: string;
  } | null;
  createdAt: string;
}

interface ReviewStats {
  avg: number;
  count: number;
}

interface ReviewPagination {
  total: number;
  totalFiltered: number;
  page: number;
  totalPages: number;
}

interface ReviewContextType {
  getReviewsForBook: (bookId: string) => Review[];
  getAverageRating: (bookId: string) => { avg: number; count: number };
  getPagination: (bookId: string) => ReviewPagination | null;
  addReview: (review: Omit<Review, 'id' | 'helpful' | 'createdAt'>) => void;
  editReview: (reviewId: string, bookId: string, data: { rating: number; title: string; content: string; hasSpoiler?: boolean; spoilerText?: string | null }) => Promise<void>;
  deleteReview: (reviewId: string, bookId: string) => Promise<void>;
  markHelpful: (reviewId: string) => void;
  hasUserReviewed: (bookId: string, userId: string) => boolean;
  fetchReviewsForBook: (bookId: string, filters?: ReviewFilterParams) => Promise<void>;
  reviewsLoading: boolean;
}

const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

function mapApiReview(r: ReviewResponse, bookId?: string): Review {
  return {
    id: r.id,
    bookId: r.bookId || bookId || '',
    userId: r.userId || '',
    userName: r.userName,
    userAvatar: r.userAvatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(r.userName)}`,
    rating: r.rating,
    title: r.title || '',
    content: r.content,
    helpful: r.helpfulCount || 0,
    hasSpoiler: !!r.hasSpoiler,
    spoilerText: r.spoilerText || null,
    authorResponse: r.authorResponse || null,
    createdAt: r.createdAt,
  };
}

export function ReviewProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, { reviews: Review[]; stats: ReviewStats; pagination?: ReviewPagination }>>({});
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());

  const fetchReviewsForBook = useCallback(async (bookId: string, filters?: ReviewFilterParams) => {
    // Skip cache for filtered requests
    if (!filters && fetchedRef.current.has(bookId)) return;
    setReviewsLoading(true);
    try {
      const res = await reviewsApi.forBook(bookId, filters);
      const reviews = res.reviews.map((r) => mapApiReview(r, bookId));
      const stats: ReviewStats = {
        avg: res.stats?.averageRating || 0,
        count: res.stats?.totalReviews || reviews.length,
      };
      const pagination: ReviewPagination = {
        total: res.pagination.total,
        totalFiltered: res.pagination.totalFiltered,
        page: res.pagination.page,
        totalPages: res.pagination.totalPages,
      };
      setCache((prev) => ({ ...prev, [bookId]: { reviews, stats, pagination } }));
      if (!filters) fetchedRef.current.add(bookId);
    } catch {
      // API unavailable — leave cache empty for this book
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const getReviewsForBook = useCallback(
    (bookId: string) => {
      return (cache[bookId]?.reviews || []).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    [cache]
  );

  const getAverageRating = useCallback(
    (bookId: string) => {
      const entry = cache[bookId];
      if (!entry) return { avg: 0, count: 0 };
      return { avg: entry.stats.avg, count: entry.stats.count };
    },
    [cache]
  );

  const getPagination = useCallback(
    (bookId: string): ReviewPagination | null => {
      return cache[bookId]?.pagination || null;
    },
    [cache]
  );

  const addReview = useCallback(
    async (review: Omit<Review, 'id' | 'helpful' | 'createdAt'>) => {
      try {
        await reviewsApi.create({
          bookId: review.bookId,
          rating: review.rating,
          title: review.title,
          content: review.content,
          hasSpoiler: review.hasSpoiler,
          spoilerText: review.spoilerText || undefined,
        });
        toast.success('Review submitted!', {
          description: 'Thank you for sharing your thoughts.',
        });
        // Re-fetch reviews for this book
        fetchedRef.current.delete(review.bookId);
        await fetchReviewsForBook(review.bookId);
      } catch (err: any) {
        const msg = err?.message || 'Failed to submit review';
        toast.error(msg);
      }
    },
    [fetchReviewsForBook]
  );

  const editReview = useCallback(
    async (reviewId: string, bookId: string, data: { rating: number; title: string; content: string; hasSpoiler?: boolean; spoilerText?: string | null }) => {
      try {
        await reviewsApi.update(reviewId, data);
        toast.success('Review updated!', { description: 'Your changes have been saved. The review may need re-approval.' });
        fetchedRef.current.delete(bookId);
        await fetchReviewsForBook(bookId);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update review');
      }
    },
    [fetchReviewsForBook]
  );

  const deleteReview = useCallback(
    async (reviewId: string, bookId: string) => {
      try {
        await reviewsApi.deleteOwn(reviewId);
        toast.success('Review deleted');
        fetchedRef.current.delete(bookId);
        await fetchReviewsForBook(bookId);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to delete review');
      }
    },
    [fetchReviewsForBook]
  );

  const markHelpful = useCallback((reviewId: string) => {
    reviewsApi.markHelpful(reviewId).catch(() => {});
    // Optimistic update
    setCache((prev) => {
      const updated = { ...prev };
      for (const bookId of Object.keys(updated)) {
        updated[bookId] = {
          ...updated[bookId],
          reviews: updated[bookId].reviews.map((r) =>
            r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r
          ),
        };
      }
      return updated;
    });
  }, []);

  const hasUserReviewed = useCallback(
    (bookId: string, userId: string) => {
      return (cache[bookId]?.reviews || []).some((r) => r.userId === userId);
    },
    [cache]
  );

  return (
    <ReviewContext.Provider
      value={{
        getReviewsForBook,
        getAverageRating,
        getPagination,
        addReview,
        editReview,
        deleteReview,
        markHelpful,
        hasUserReviewed,
        fetchReviewsForBook,
        reviewsLoading,
      }}
    >
      {children}
    </ReviewContext.Provider>
  );
}

export function useReviews() {
  const context = useContext(ReviewContext);
  if (!context) {
    throw new Error('useReviews must be used within a ReviewProvider');
  }
  return context;
}
