// â”€â”€ API Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Central API client for all backend calls. Handles auth tokens, errors, and
// provides typed wrappers for every endpoint.

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// â”€â”€ Token management â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

let authToken: string | null = localStorage.getItem('thebooktimes-token');

export function setToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('thebooktimes-token', token);
  else localStorage.removeItem('thebooktimes-token');
}

export function getToken() {
  return authToken;
}

// â”€â”€ Fetch wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(body.error || 'Request failed', res.status, body);
  }

  return res.json();
}

export class ApiError extends Error {
  status: number;
  body: any;

  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// â”€â”€ Auth API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: 'user' | 'admin';
  reviewCount?: number;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (name: string, email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  getMe: () => apiFetch<AuthUser>('/auth/me'),

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    apiFetch<AuthUser>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),
};

// â”€â”€ Books API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface BookResponse {
  id: string;
  googleBooksId: string;
  isbn10?: string;
  isbn13?: string;
  slug: string;
  title: string;
  subtitle?: string;
  author: string;
  authorId?: string;
  authorData?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
  } | null;
  description?: string;
  coverImage: string;
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  language: string;
  categories: string[];
  googleRating?: number;
  ratingsCount: number;
  computedScore: number;
  price?: number;
  currency: string;
  amazonUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
  canonicalUrl?: string;
  focusKeyword?: string;
  seoRobots?: string;
  goodreadsUrl?: string;
  customLinkLabel?: string;
  customLinkUrl?: string;
  adminNotes?: string;
  status: string;
  isActive: boolean;
  indexedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedBooks {
  books: BookResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface BooksQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  category?: string;
  search?: string;
  status?: string;
  minRating?: number;
  maxRating?: number;
  yearFrom?: number;
  yearTo?: number;
}

export const booksApi = {
  list: (query: BooksQuery = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
    });
    return apiFetch<PaginatedBooks>(`/books?${params}`);
  },

  trending: (limit?: number) => apiFetch<BookResponse[]>(`/books/trending${limit ? `?limit=${limit}` : ''}`),

  newReleases: (period?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (period) params.set('period', period);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiFetch<BookResponse[]>(`/books/new-releases${qs ? `?${qs}` : ''}`);
  },

  topRated: (limit?: number) => apiFetch<BookResponse[]>(`/books/top-rated${limit ? `?limit=${limit}` : ''}`),

  searchSuggestions: (q: string) => apiFetch<{
    suggestions: { id: string; title: string; author: string; slug: string; coverImage: string; googleRating: number }[];
    categories: { id: string; name: string; slug: string; bookCount: number }[];
    authors: { id: string; name: string; slug: string; imageUrl?: string; bookCount: number }[];
  }>(`/books/search-suggestions?q=${encodeURIComponent(q)}`),

  authors: (limit?: number) => apiFetch<{
    id: string; name: string; slug: string; bookCount: number; avgRating: number; topCover: string; imageUrl?: string; specialties: string[];
  }[]>(`/books/authors${limit ? `?limit=${limit}` : ''}`),

  getBySlug: (slug: string) => apiFetch<BookResponse>(`/books/${slug}`),

  recommendations: (bookId: string, limit = 6) =>
    apiFetch<{ books: BookResponse[]; strategy: string }>(`/books/recommendations/${bookId}?limit=${limit}`),

  create: (data: Partial<BookResponse> & { categories?: string[] }) =>
    apiFetch<BookResponse>('/books', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<BookResponse> & { categories?: string[] }) =>
    apiFetch<BookResponse>(`/books/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/books/${id}`, { method: 'DELETE' }),

  uploadCover: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('cover', file);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/books/upload-cover`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || 'Upload failed', res.status, body);
    }
    return res.json();
  },
};

// â”€â”€ Categories API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CategoryResponse {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  bookCount: number;
}

export const categoriesApi = {
  list: () => apiFetch<CategoryResponse[]>('/categories'),

  getBySlug: (slug: string) => apiFetch<CategoryResponse>(`/categories/${slug}`),

  getBooks: (slug: string, sort?: string, order?: string) => {
    const params = new URLSearchParams();
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    return apiFetch<{ books: BookResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/categories/${slug}/books?${params}`);
  },

  create: (data: Partial<CategoryResponse>) =>
    apiFetch<CategoryResponse>('/categories', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<CategoryResponse>) =>
    apiFetch<CategoryResponse>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
};

// â”€â”€ Authors API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface AuthorResponse {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  instagramUrl?: string;
  goodreadsUrl?: string;
  amazonUrl?: string;
  wikipediaUrl?: string;
  facebookUrl?: string;
  youtubeUrl?: string;
  tiktokUrl?: string;
  bornDate?: string;
  diedDate?: string;
  nationality?: string;
  genres?: string[];
  awards?: string[];
  totalWorks?: number;
  metaTitle?: string;
  metaDescription?: string;
  bookCount?: number;
  avgRating?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthorDetailResponse extends AuthorResponse {
  specialties: string[];
  books: {
    id: string;
    slug: string;
    title: string;
    subtitle?: string;
    author: string;
    coverImage: string;
    googleRating?: number;
    ratingsCount: number;
    computedScore: number;
    publishedDate?: string;
    categories: string[];
    price?: number;
    currency: string;
    amazonUrl?: string;
  }[];
}

export const authorsApi = {
  list: (search?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiFetch<AuthorResponse[]>(`/authors${qs ? `?${qs}` : ''}`);
  },

  getBySlug: (slug: string) => apiFetch<AuthorDetailResponse>(`/authors/${slug}`),

  create: (data: Partial<AuthorResponse> & { name: string }) =>
    apiFetch<AuthorResponse>('/authors', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<AuthorResponse>) =>
    apiFetch<AuthorResponse>(`/authors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/authors/${id}`, { method: 'DELETE' }),

  findOrCreate: (name: string) =>
    apiFetch<AuthorResponse>('/authors/find-or-create', { method: 'POST', body: JSON.stringify({ name }) }),

  /** Follow an author */
  follow: (id: string) =>
    apiFetch<{ following: boolean; followerCount: number }>(`/authors/${id}/follow`, { method: 'POST' }),

  /** Unfollow an author */
  unfollow: (id: string) =>
    apiFetch<{ following: boolean; followerCount: number }>(`/authors/${id}/follow`, { method: 'DELETE' }),

  /** Check if following an author */
  checkFollow: (id: string) =>
    apiFetch<{ following: boolean; followerCount: number }>(`/authors/${id}/follow`),

  /** Get list of followed authors */
  following: () =>
    apiFetch<{ authors: AuthorResponse[] }>('/authors/following/list'),
};

// â”€â”€ Blog API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface BlogPostResponse {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  featuredImage?: string;
  ogImage?: string;
  canonicalUrl?: string;
  focusKeyword?: string;
  seoRobots?: string;
  tags?: string;
  category?: string;
  customLinkLabel?: string;
  customLinkUrl?: string;
  adminNotes?: string;
  allowComments?: boolean;
  isFeatured?: boolean;
  featuredBookIds: string[];
  status: string;
  publishedAt?: string;
  generatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedBlog {
  posts: BlogPostResponse[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const blogApi = {
  list: (page = 1, limit = 10) =>
    apiFetch<PaginatedBlog>(`/blog?page=${page}&limit=${limit}`),

  getBySlug: (slug: string) =>
    apiFetch<BlogPostResponse>(`/blog/${slug}`),

  create: (data: Partial<BlogPostResponse>) =>
    apiFetch<BlogPostResponse>('/blog', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<BlogPostResponse>) =>
    apiFetch<BlogPostResponse>(`/blog/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/blog/${id}`, { method: 'DELETE' }),

  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('image', file);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/blog/upload-image`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new ApiError(body.error || 'Upload failed', res.status, body);
    }
    return res.json();
  },
};

// â”€â”€ Reviews API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReviewResponse {
  id: string;
  bookId: string;
  bookTitle?: string;
  userId?: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title?: string;
  content: string;
  helpfulCount: number;
  isApproved?: boolean;
  createdAt: string;
}

export interface ReviewsForBook {
  reviews: ReviewResponse[];
  stats: {
    averageRating: number;
    totalReviews: number;
    distribution: { rating: number; count: number }[];
  };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const reviewsApi = {
  forBook: (bookId: string, page = 1) =>
    apiFetch<ReviewsForBook>(`/reviews/book/${bookId}?page=${page}`),

  create: (data: { bookId: string; rating: number; title?: string; content: string }) =>
    apiFetch<ReviewResponse>('/reviews', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { rating: number; title?: string; content: string }) =>
    apiFetch<ReviewResponse>(`/reviews/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteOwn: (id: string) =>
    apiFetch<{ success: boolean }>(`/reviews/${id}/own`, { method: 'DELETE' }),

  markHelpful: (reviewId: string) =>
    apiFetch<{ success: boolean }>(`/reviews/${reviewId}/helpful`, { method: 'POST' }),

  // Admin
  listAll: (page = 1, approved?: boolean) => {
    const params = new URLSearchParams({ page: String(page) });
    if (approved !== undefined) params.set('approved', String(approved));
    return apiFetch<{ reviews: ReviewResponse[]; pagination: any }>(`/reviews/all?${params}`);
  },

  approve: (id: string, isApproved: boolean) =>
    apiFetch<{ success: boolean }>(`/reviews/${id}/approve`, {
      method: 'PUT', body: JSON.stringify({ isApproved }),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/reviews/${id}`, { method: 'DELETE' }),
};

// â”€â”€ Analytics API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const analyticsApi = {
  // Public stats (cached, no auth required)
  publicStats: () => apiFetch<{
    totalBooks: number;
    totalCategories: number;
    totalReviews: number;
    totalSubscribers: number;
    totalAuthors: number;
    avgRating: number;
  }>('/analytics/public-stats'),

  // Public tracking
  trackEvent: (eventType: string, entityType?: string, entityId?: string, metadata?: any) =>
    apiFetch<{ success: boolean }>('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ eventType, entityType, entityId, sessionId: getSessionId(), metadata }),
    }).catch(() => {}), // Fire-and-forget

  trackPageView: (pagePath: string, pageTitle?: string) =>
    apiFetch<{ success: boolean }>('/analytics/pageview', {
      method: 'POST',
      body: JSON.stringify({ pagePath, pageTitle, sessionId: getSessionId(), referrer: document.referrer }),
    }).catch(() => {}),

  trackAffiliateClick: (bookId: string, source?: string) =>
    apiFetch<{ success: boolean }>('/analytics/affiliate-click', {
      method: 'POST',
      body: JSON.stringify({ bookId, source, sessionId: getSessionId() }),
    }).catch(() => {}),

  // Admin analytics
  overview: () => apiFetch<any>('/analytics/overview'),
  pageViews: (days = 30) => apiFetch<any[]>(`/analytics/page-views?days=${days}`),
  topBooks: (days = 30) => apiFetch<any[]>(`/analytics/top-books?days=${days}`),
  topPages: (days = 30) => apiFetch<any[]>(`/analytics/top-pages?days=${days}`),
  eventsSummary: (days = 30) => apiFetch<any[]>(`/analytics/events-summary?days=${days}`),
  affiliateReport: (days = 30) => apiFetch<any>(`/analytics/affiliate-report?days=${days}`),
  googleAnalytics: () => apiFetch<any>('/analytics/google'),
};

// â”€â”€ Wishlist API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WishlistItem {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverImage: string;
  googleRating: number;
  ratingsCount: number;
  publishedDate: string;
  amazonUrl: string;
  addedAt: string;
}

export const wishlistApi = {
  list: () => apiFetch<{ items: WishlistItem[] }>('/wishlist'),
  add: (bookId: string) => apiFetch<{ success: boolean }>(`/wishlist/${bookId}`, { method: 'POST' }),
  remove: (bookId: string) => apiFetch<{ success: boolean }>(`/wishlist/${bookId}`, { method: 'DELETE' }),
  clear: () => apiFetch<{ success: boolean }>('/wishlist', { method: 'DELETE' }),
  check: (bookId: string) => apiFetch<{ inWishlist: boolean }>(`/wishlist/check/${bookId}`),
};

// â”€â”€ Reading Lists API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReadingListResponse {
  id: string;
  userId: string;
  userName?: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  isPublic: boolean;
  bookCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingListItemResponse {
  id: string;
  bookId: string;
  title: string;
  author: string;
  slug: string;
  coverImage?: string;
  googleRating?: number;
  ratingsCount: number;
  computedScore: number;
  publishedDate?: string;
  categories: string[];
  price?: number;
  currency: string;
  amazonUrl?: string;
  notes?: string;
  sortOrder: number;
  addedAt: string;
}

export interface ReadingListDetailResponse extends ReadingListResponse {
  items: ReadingListItemResponse[];
}

export const readingListsApi = {
  /** Get current user's reading lists */
  list: () => apiFetch<{ lists: ReadingListResponse[] }>('/reading-lists'),

  /** Create a new reading list */
  create: (data: { name: string; description?: string; isPublic?: boolean; coverImage?: string }) =>
    apiFetch<ReadingListResponse>('/reading-lists', { method: 'POST', body: JSON.stringify(data) }),

  /** Get a specific reading list with items */
  get: (id: string) => apiFetch<ReadingListDetailResponse>(`/reading-lists/${id}`),

  /** Update a reading list */
  update: (id: string, data: Partial<{ name: string; description: string; isPublic: boolean; coverImage: string }>) =>
    apiFetch<ReadingListResponse>(`/reading-lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Delete a reading list */
  delete: (id: string) => apiFetch<{ success: boolean }>(`/reading-lists/${id}`, { method: 'DELETE' }),

  /** Add a book to a list */
  addBook: (listId: string, bookId: string, notes?: string) =>
    apiFetch<{ success: boolean; itemId: string }>(`/reading-lists/${listId}/books`, {
      method: 'POST', body: JSON.stringify({ bookId, notes }),
    }),

  /** Remove a book from a list */
  removeBook: (listId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/reading-lists/${listId}/books/${bookId}`, { method: 'DELETE' }),

  /** Reorder books in a list */
  reorder: (listId: string, order: { bookId: string; sortOrder: number }[]) =>
    apiFetch<{ success: boolean }>(`/reading-lists/${listId}/books/reorder`, {
      method: 'PUT', body: JSON.stringify({ order }),
    }),

  /** Check which of the user's lists contain a specific book */
  bookInLists: (bookId: string) =>
    apiFetch<{ lists: { id: string; name: string; slug: string }[] }>(`/reading-lists/book/${bookId}`),

  /** Browse public reading lists */
  browsePublic: (page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiFetch<{
      lists: ReadingListResponse[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/reading-lists/public${qs ? `?${qs}` : ''}`);
  },

  /** View a specific public reading list */
  getPublic: (userId: string, slug: string) =>
    apiFetch<ReadingListDetailResponse>(`/reading-lists/public/${userId}/${slug}`),
};

// â”€â”€ Reading Progress API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReadingProgressResponse {
  id: string;
  userId: string;
  bookId: string;
  status: 'want-to-read' | 'reading' | 'finished';
  currentPage: number;
  totalPages: number;
  startedAt?: string;
  finishedAt?: string;
  personalRating?: number;
  notes?: string;
  // Joined book fields (from list endpoint)
  title?: string;
  author?: string;
  slug?: string;
  coverImage?: string;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgressStats {
  total: number;
  wantToRead: number;
  reading: number;
  finished: number;
  totalPagesRead: number;
}

export const readingProgressApi = {
  /** Get all reading progress for current user */
  list: (status?: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (page) params.set('page', String(page));
    if (limit) params.set('limit', String(limit));
    const qs = params.toString();
    return apiFetch<{
      items: ReadingProgressResponse[];
      stats: ReadingProgressStats;
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/reading-progress${qs ? `?${qs}` : ''}`);
  },

  /** Get progress for a specific book */
  get: (bookId: string) =>
    apiFetch<{ progress: ReadingProgressResponse | null }>(`/reading-progress/${bookId}`),

  /** Set/update progress for a book */
  update: (bookId: string, data: {
    status?: 'want-to-read' | 'reading' | 'finished';
    currentPage?: number;
    totalPages?: number;
    startedAt?: string;
    finishedAt?: string;
    personalRating?: number;
    notes?: string;
  }) =>
    apiFetch<{ progress: ReadingProgressResponse }>(`/reading-progress/${bookId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  /** Remove progress tracking for a book */
  remove: (bookId: string) =>
    apiFetch<{ success: boolean }>(`/reading-progress/${bookId}`, { method: 'DELETE' }),
};

// â”€â”€ Testimonials API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TestimonialResponse {
  id: string;
  name: string;
  role: string;
  avatarUrl: string | null;
  content: string;
  rating: number;
  sortOrder: number;
  createdAt: string;
  isActive?: boolean;
}

export const testimonialsApi = {
  list: () => apiFetch<{ testimonials: TestimonialResponse[] }>('/testimonials'),
  listAll: () => apiFetch<{ testimonials: TestimonialResponse[] }>('/testimonials/all'),
  create: (data: Partial<TestimonialResponse>) =>
    apiFetch<{ id: string }>('/testimonials', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TestimonialResponse>) =>
    apiFetch<{ message: string }>(`/testimonials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    apiFetch<{ message: string }>(`/testimonials/${id}`, { method: 'DELETE' }),
};

// â”€â”€ Newsletter API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const newsletterApi = {
  subscribe: (email: string, name?: string) =>
    apiFetch<{ message: string }>('/newsletter/subscribe', {
      method: 'POST', body: JSON.stringify({ email, name }),
    }),

  unsubscribe: (email: string) =>
    apiFetch<{ message: string }>('/newsletter/unsubscribe', {
      method: 'POST', body: JSON.stringify({ email }),
    }),
};

// â”€â”€ Admin API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const adminApi = {
  dashboard: () => apiFetch<any>('/admin/dashboard'),

  users: (page = 1, search?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set('search', search);
    return apiFetch<{ users: any[]; pagination: any }>(`/admin/users?${params}`);
  },

  updateUserRole: (userId: string, role: 'user' | 'admin') =>
    apiFetch<{ success: boolean }>(`/admin/users/${userId}/role`, {
      method: 'PUT', body: JSON.stringify({ role }),
    }),

  updateUserStatus: (userId: string, isActive: boolean) =>
    apiFetch<{ success: boolean }>(`/admin/users/${userId}/status`, {
      method: 'PUT', body: JSON.stringify({ isActive }),
    }),

  newsletter: (page = 1) =>
    apiFetch<{ subscribers: any[]; pagination: any }>(`/admin/newsletter?page=${page}`),

  recalculateScores: () =>
    apiFetch<{ success: boolean; updated: number; duration: string; message: string }>('/admin/recalculate-scores', {
      method: 'POST',
    }),
};

// â”€â”€ Settings API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const settingsApi = {
  getPublic: () => apiFetch<{ settings: Record<string, any[]> }>('/settings'),

  getAdmin: () => apiFetch<{ settings: Record<string, any[]>; categories: string[] }>('/settings/admin'),

  updateBulk: (settings: Record<string, string>) =>
    apiFetch<{ message: string; updated: number }>('/settings', {
      method: 'PUT', body: JSON.stringify({ settings }),
    }),

  updateSingle: (key: string, value: string) =>
    apiFetch<{ message: string }>(`/settings/${key}`, {
      method: 'PUT', body: JSON.stringify({ value }),
    }),

  seed: () => apiFetch<{ message: string; count: number }>('/settings/seed', { method: 'POST' }),

  testSmtp: () => apiFetch<{ success: boolean; error?: string }>('/settings/test-smtp', { method: 'POST' }),

  verifyAdminSlug: (slug: string) =>
    apiFetch<{ valid: boolean }>(`/settings/verify-admin-access/${encodeURIComponent(slug)}`),
};

// â”€â”€ Campaigns API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface CampaignResponse {
  id: string;
  name: string;
  subject: string;
  preview_text?: string;
  html_content: string;
  plain_content?: string;
  status: string;
  campaign_type: string;
  target_audience: string;
  segment_filter?: string;
  scheduled_at?: string;
  sent_at?: string;
  total_recipients: number;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  created_by?: string;
  creator_name?: string;
  created_at: string;
  updated_at: string;
}

export const campaignsApi = {
  list: (page = 1, status?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    return apiFetch<{ campaigns: CampaignResponse[]; pagination: any }>(`/campaigns?${params}`);
  },

  get: (id: string) =>
    apiFetch<{ campaign: CampaignResponse; recipientStats: any[] }>(`/campaigns/${id}`),

  create: (data: Partial<CampaignResponse>) =>
    apiFetch<CampaignResponse>('/campaigns', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<CampaignResponse>) =>
    apiFetch<CampaignResponse>(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/campaigns/${id}`, { method: 'DELETE' }),

  send: (id: string) =>
    apiFetch<{ message: string; totalRecipients: number }>(`/campaigns/${id}/send`, { method: 'POST' }),

  sendTest: (id: string, email?: string) =>
    apiFetch<{ success: boolean; email: string }>(`/campaigns/${id}/test`, {
      method: 'POST', body: JSON.stringify({ email }),
    }),

  recipients: (id: string, page = 1) =>
    apiFetch<{ recipients: any[]; pagination: any }>(`/campaigns/${id}/recipients?page=${page}`),

  templates: () => apiFetch<{ templates: any[] }>('/campaigns/templates/list'),

  createTemplate: (data: any) =>
    apiFetch<any>('/campaigns/templates', { method: 'POST', body: JSON.stringify(data) }),

  deleteTemplate: (id: string) =>
    apiFetch<{ success: boolean }>(`/campaigns/templates/${id}`, { method: 'DELETE' }),

  aiGenerate: (prompt: string, campaign_type?: string, tone?: string) =>
    apiFetch<{ subject: string; html_content: string; plain_content: string; log_id: string }>('/campaigns/ai-generate', {
      method: 'POST', body: JSON.stringify({ prompt, campaign_type, tone }),
    }),
};

// â”€â”€ Import Job API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const importApi = {
  getStatus: () =>
    apiFetch<{ running: boolean }>('/import/status'),

  getHistory: (limit = 20) =>
    apiFetch<{ jobs: Array<{
      id: string;
      type: string;
      status: string;
      totalFetched: number;
      newInserted: number;
      updated: number;
      skipped: number;
      errors: string[];
      startedAt: string;
      completedAt: string | null;
    }> }>(`/import/history?limit=${limit}`),

  run: (type?: 'initial' | 'daily') =>
    apiFetch<{ message: string; running: boolean }>('/import/run', {
      method: 'POST',
      body: JSON.stringify(type ? { type } : {}),
    }),
};

// â”€â”€ Session ID helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function getSessionId(): string {
  let sid = sessionStorage.getItem('thebooktimes-session');
  if (!sid) {
    sid = `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem('thebooktimes-session', sid);
  }
  return sid;
}

// â”€â”€ Email Digest API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface DigestPreferences {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  preferredDay: number;
  preferredHour: number;
  includeNewReleases: boolean;
  includeTrending: boolean;
  includeFollowedAuthors: boolean;
  includeReadingProgress: boolean;
  includeRecommendations: boolean;
  lastSentAt: string | null;
}

export const emailDigestApi = {
  getPreferences: () =>
    apiFetch<{ preferences: DigestPreferences }>('/email-digest/preferences'),

  updatePreferences: (data: Partial<DigestPreferences>) =>
    apiFetch<{ message: string }>('/email-digest/preferences', {
      method: 'PUT', body: JSON.stringify(data),
    }),

  sendTest: () =>
    apiFetch<{ success: boolean; message: string }>('/email-digest/send-test', { method: 'POST' }),

  history: () =>
    apiFetch<{ history: Array<{ id: string; sentAt: string; bookCount: number; sections: string[]; status: string; errorMessage?: string }> }>('/email-digest/history'),
};

// â”€â”€ Subscriptions API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface TierInfo {
  id: string;
  name: string;
  price: number;
  interval: string;
  features: Record<string, string>;
  descriptions: Record<string, string>;
}

export interface SubscriptionInfo {
  tier: string;
  expiresAt: string | null;
  subscription: {
    id: string;
    plan: string;
    status: string;
    amountCents: number;
    currency: string;
    intervalUnit: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelledAt: string | null;
  } | null;
}

export const subscriptionsApi = {
  tiers: () => apiFetch<{ tiers: TierInfo[] }>('/subscriptions/tiers'),

  current: () => apiFetch<SubscriptionInfo>('/subscriptions/current'),

  subscribe: (plan: 'plus' | 'premium', intervalUnit?: 'month' | 'year') =>
    apiFetch<{ message: string; subscriptionId: string; tier: string; expiresAt: string }>('/subscriptions/subscribe', {
      method: 'POST', body: JSON.stringify({ plan, intervalUnit }),
    }),

  cancel: () =>
    apiFetch<{ message: string; tier: string }>('/subscriptions/cancel', { method: 'POST' }),

  features: () =>
    apiFetch<{ tier: string; features: Record<string, string> }>('/subscriptions/features'),

  checkFeature: (feature: string) =>
    apiFetch<{ feature: string; tier: string; value: string; allowed: boolean }>(`/subscriptions/check/${feature}`),
};

// â”€â”€ Experiments / A/B Testing API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ExperimentAssignment {
  experimentId: string;
  experimentName: string;
  variant: string;
  config: Record<string, any>;
}

export const experimentsApi = {
  active: () =>
    apiFetch<{ experiments: ExperimentAssignment[] }>('/experiments/active', {
      headers: { 'X-Session-ID': getSessionId() },
    }),

  trackEvent: (experimentId: string, eventType: string, eventValue?: number, metadata?: Record<string, any>) =>
    apiFetch<{ tracked: boolean }>('/experiments/event', {
      method: 'POST',
      headers: { 'X-Session-ID': getSessionId() },
      body: JSON.stringify({ experimentId, eventType, eventValue, metadata }),
    }),
};

// â”€â”€ Webhooks API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface WebhookResponse {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventType: string;
  responseStatus: number | null;
  status: string;
  durationMs: number;
  attempt: number;
  createdAt: string;
}

export const webhooksApi = {
  list: () => apiFetch<{ webhooks: WebhookResponse[] }>('/webhooks'),

  create: (data: { name: string; url: string; events: string[] }) =>
    apiFetch<{ id: string; secret: string; message: string }>('/webhooks', {
      method: 'POST', body: JSON.stringify(data),
    }),

  get: (id: string) =>
    apiFetch<{ webhook: WebhookResponse; recentDeliveries: WebhookDelivery[] }>(`/webhooks/${id}`),

  update: (id: string, data: Partial<{ name: string; url: string; events: string[]; isActive: boolean }>) =>
    apiFetch<{ message: string }>(`/webhooks/${id}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/webhooks/${id}`, { method: 'DELETE' }),

  test: (id: string) =>
    apiFetch<{ success: boolean; status: number; durationMs: number }>(`/webhooks/${id}/test`, { method: 'POST' }),

  deliveries: (id: string, page = 1) =>
    apiFetch<{ deliveries: WebhookDelivery[] }>(`/webhooks/${id}/deliveries?page=${page}`),
};

// â”€â”€ Personalized Recommendations API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const personalizedApi = {
  forYou: (limit = 12) =>
    apiFetch<{ books: BookResponse[]; strategies: string[]; confidence: number }>(`/books/for-you?limit=${limit}`),
};

