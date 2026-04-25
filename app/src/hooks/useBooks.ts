import { useState, useEffect, useCallback } from 'react';
import type { Book, Category, BlogPost, SearchFilters } from '@/types';
import { booksApi, categoriesApi, blogApi, analyticsApi } from '@/api/client';
import { mapBook, mapCategory } from '@/lib/mappers';

// Hook for getting trending books
export function useTrendingBooks(limit: number = 6) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    booksApi.trending(limit)
      .then((res) => { setBooks(res.map(mapBook)); setError(null); })
      .catch((err) => { setBooks([]); setError(err.message || 'Failed to load trending books'); })
      .finally(() => setLoading(false));
  }, [limit]);

  return { books, loading, error };
}

// Hook for getting new releases
export function useNewReleases(limit: number = 6, period: string = 'this-month') {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    booksApi.newReleases(period, limit)
      .then((res) => { setBooks(res.map(mapBook)); setError(null); })
      .catch((err) => { setBooks([]); setError(err.message || 'Failed to load new releases'); })
      .finally(() => setLoading(false));
  }, [limit, period]);

  return { books, loading, error };
}

// Hook for getting top rated books
export function useTopRated(limit: number = 6) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    booksApi.topRated(limit)
      .then((res) => { setBooks(res.map(mapBook)); setError(null); })
      .catch((err) => { setBooks([]); setError(err.message || 'Failed to load top rated books'); })
      .finally(() => setLoading(false));
  }, [limit]);

  return { books, loading, error };
}

// Hook for getting book recommendations
export function useRecommendations(bookId: string | undefined, limit: number = 6) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookId) {
      setBooks([]);
      setLoading(false);
      return;
    }
    booksApi.recommendations(bookId)
      .then((res) => { setBooks((res.books || res).map(mapBook).slice(0, limit)); setError(null); })
      .catch((err) => { setBooks([]); setError(err.message || 'Failed to load recommendations'); })
      .finally(() => setLoading(false));
  }, [bookId, limit]);

  return { books, loading, error };
}

// Hook for searching books
export function useBookSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback((searchQuery: string, searchFilters?: SearchFilters) => {
    setQuery(searchQuery);
    if (searchFilters) setFilters(searchFilters);
    
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    booksApi.list({ search: searchQuery, page: 1, limit: 20, category: searchFilters?.category })
      .then((res) => { setResults(res.books.map(mapBook)); setError(null); })
      .catch((err) => { setResults([]); setError(err.message || 'Search failed'); })
      .finally(() => setLoading(false));
  }, []);

  return { query, setQuery, filters, setFilters, results, loading, error, search };
}

// Hook for getting a single book
export function useBook(slug: string | undefined) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setBook(null);
      setLoading(false);
      return;
    }
    
    booksApi.getBySlug(slug)
      .then((res) => { setBook(mapBook(res)); setError(null); })
      .catch(() => { setBook(null); setError('Book not found'); })
      .finally(() => setLoading(false));
  }, [slug]);

  return { book, loading, error };
}

// Hook for getting books by category
export function useBooksByCategory(categorySlug: string | undefined) {
  const [books, setBooks] = useState<Book[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categorySlug) {
      setBooks([]);
      setCategory(null);
      setLoading(false);
      return;
    }

    Promise.all([
      categoriesApi.getBySlug(categorySlug),
      categoriesApi.getBooks(categorySlug),
    ])
      .then(([cat, bksRes]) => {
        setCategory(mapCategory(cat));
        const booksArr = Array.isArray(bksRes) ? bksRes : (bksRes?.books ?? []);
        setBooks(booksArr.map(mapBook));
        setError(null);
      })
      .catch((err) => {
        setCategory(null);
        setBooks([]);
        setError(err.message || 'Failed to load category');
      })
      .finally(() => setLoading(false));
  }, [categorySlug]);

  return { books, category, loading, error };
}

// Hook for getting all categories
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    categoriesApi.list()
      .then((res) => { setCategories(res.map(mapCategory)); setError(null); })
      .catch((err) => { setCategories([]); setError(err.message || 'Failed to load categories'); })
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading, error };
}

// Hook for getting blog posts
export function useBlogPosts(limit?: number) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    blogApi.list(1, limit || 50, 'PUBLISHED')
      .then((res) => {
        setPosts(res.posts.map((p: any) => ({
          id: String(p.id),
          title: p.title,
          slug: p.slug,
          content: p.content || '',
          excerpt: p.excerpt || '',
          metaTitle: p.metaTitle || p.meta_title || '',
          metaDescription: p.metaDescription || p.meta_description || '',
          featuredImage: p.featuredImage || p.featured_image || '',
          featuredBookIds: p.featuredBookIds || p.featured_book_ids || [],
          status: p.status || 'PUBLISHED',
          publishedAt: p.publishedAt || p.published_at || p.created_at || '',
          generatedBy: p.generatedBy || p.generated_by || 'manual',
          createdAt: p.createdAt || p.created_at || '',
          updatedAt: p.updatedAt || p.updated_at || '',
        })));
        setError(null);
      })
      .catch((err) => { setPosts([]); setError(err.message || 'Failed to load blog posts'); })
      .finally(() => setLoading(false));
  }, [limit]);

  return { posts, loading, error };
}

// Hook for debounced search
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}


// Hook for fetching public site statistics (real data from API)
export interface PublicStats {
  totalBooks: number;
  totalCategories: number;
  totalReviews: number;
  totalSubscribers: number;
  totalAuthors: number;
  avgRating: number;
}

export function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.publicStats()
      .then((data) => setStats(data))
      .catch(() => {
        setStats({ totalBooks: 0, totalCategories: 0, totalReviews: 0, totalSubscribers: 0, totalAuthors: 0, avgRating: 0 });
      })
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading };
}
