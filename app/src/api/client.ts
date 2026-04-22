// â”€â”€ API Client â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Central API client for all backend calls. Handles auth tokens, errors, and
// provides typed wrappers for every endpoint.

import { isAnalyticsEnabled } from '@/lib/analytics';
import type { AdminGoogleAnalyticsResponse } from '@/types';

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
  followerCount?: number;
  followingCount?: number;
  createdAt?: string;
  hasPassword?: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: AuthUser;
  requires2FA?: boolean;
  tempToken?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  verify2FA: (tempToken: string, code: string) =>
    apiFetch<AuthResponse>('/auth/verify-2fa', {
      method: 'POST',
      body: JSON.stringify({ tempToken, code }),
    }),

  register: (name: string, email: string, password: string) =>
    apiFetch<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }),

  socialGoogle: (idToken: string) =>
    apiFetch<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    }),

  socialApple: (identityToken: string, authorizationCode = 'mock-authorization-code') =>
    apiFetch<AuthResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({ identityToken, authorizationCode }),
    }),

  getMe: () => apiFetch<AuthUser>('/auth/me'),

  updateProfile: (data: { name?: string; currentPassword?: string; newPassword?: string }) =>
    apiFetch<AuthUser>('/auth/me', { method: 'PUT', body: JSON.stringify(data) }),

  get2FAStatus: () => apiFetch<{ enabled: boolean }>('/auth/2fa/status'),

  setup2FA: () => apiFetch<{ secret: string; qrCode: string; otpauthUrl: string }>('/auth/2fa/setup', { method: 'POST' }),

  enable2FA: (code: string) => apiFetch<{ enabled: boolean; backupCodes: string[]; message: string }>('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  }),

  disable2FA: (password: string) => apiFetch<{ disabled: boolean; message: string }>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password }),
  }),

  getLinkedAccounts: () =>
    apiFetch<{ google: boolean; apple: boolean; hasPassword: boolean }>('/users/me/linked-accounts'),

  linkAccount: (provider: 'google' | 'apple', token: string) =>
    apiFetch<{ success: boolean; google: boolean; apple: boolean; hasPassword: boolean }>('/users/me/link-account', {
      method: 'POST',
      body: JSON.stringify(provider === 'google'
        ? { provider, idToken: token }
        : { provider, identityToken: token, authorizationCode: 'mock-authorization-code' }),
    }),

  unlinkAccount: (provider: 'google' | 'apple') =>
    apiFetch<{ success: boolean; google: boolean; apple: boolean; hasPassword: boolean }>(`/users/me/linked-accounts/${provider}`, {
      method: 'DELETE',
    }),
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
  authorsData?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    bio?: string;
    bookCount?: number;
    followerCount?: number;
    isFollowed?: boolean;
  }[];
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
  userRating?: number | null;
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

export interface FriendActivityItemResponse {
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  status?: string | null;
  rating?: number | null;
  reviewId?: string | null;
}

export interface FriendsActivityResponse {
  friends: FriendActivityItemResponse[];
  friendsAvgRating: number;
  totalFriends: number;
}

export interface DiscussionUserResponse {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface DiscussionSummaryResponse {
  id: string;
  bookId: string;
  title: string;
  content: string;
  isPinned: boolean;
  isLocked: boolean;
  replyCount: number;
  lastActivityAt: string;
  createdAt: string;
  user: DiscussionUserResponse;
}

export interface DiscussionReplyResponse {
  id: string;
  discussionId: string;
  content: string;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
  user: DiscussionUserResponse;
}

export interface DiscussionDetailResponse extends DiscussionSummaryResponse {
  book: {
    id: string;
    title: string;
    slug: string;
  } | null;
  replies: DiscussionReplyResponse[];
}

export interface BookDiscussionsResponse {
  discussions: DiscussionSummaryResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface PromptResponseItemResponse {
  id: string;
  promptId: string;
  content: string;
  likeCount: number;
  createdAt: string;
  user: DiscussionUserResponse;
}

export interface BookPromptResponse {
  id: string;
  bookId: string;
  promptText: string;
  responseCount: number;
  isFeatured: boolean;
  createdAt: string;
  userHasResponded: boolean;
  createdBy: DiscussionUserResponse | null;
  topResponses: PromptResponseItemResponse[];
}

export interface BookPromptsResponse {
  prompts: BookPromptResponse[];
  total: number;
}

export interface PromptResponsesResponse {
  prompt: BookPromptResponse;
  responses: PromptResponseItemResponse[];
  page: number;
  limit: number;
}

export interface BookClubMemberResponse {
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  role: 'owner' | 'moderator' | 'member';
  joinedAt: string;
}

export interface BookClubPickResponse {
  id: string;
  clubId: string;
  bookId: string;
  monthLabel: string;
  startDate: string;
  endDate: string;
  discussionId?: string | null;
  discussion?: {
    id: string;
    title: string;
  } | null;
  book: {
    id: string;
    title: string;
    slug: string;
    coverImage?: string | null;
  };
  createdAt: string;
}

export interface BookClubResponse {
  id: string;
  name: string;
  description?: string | null;
  coverImage?: string | null;
  ownerId: string;
  owner: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  isPublic: boolean;
  memberCount: number;
  isMember: boolean;
  membershipRole?: 'owner' | 'moderator' | 'member' | null;
  createdAt: string;
}

export interface BookClubDetailResponse extends BookClubResponse {
  currentPick: BookClubPickResponse | null;
  members: BookClubMemberResponse[];
}

export type GiveawayFormat = 'ebook' | 'paperback' | 'hardcover' | 'audiobook';
export type GiveawayStatus = 'draft' | 'active' | 'ended' | 'winners_selected';

export interface GiveawayResponse {
  id: string;
  bookId: string;
  createdBy: string;
  title: string;
  description?: string | null;
  format: GiveawayFormat;
  copiesAvailable: number;
  entryCount: number;
  countryRestriction: string[];
  startDate: string;
  endDate: string;
  status: GiveawayStatus;
  autoAddToTbr: boolean;
  createdAt: string;
  book: {
    id: string;
    title: string;
    slug: string;
    author: string;
    coverImage?: string | null;
  } | null;
}

export interface GiveawayDetailResponse {
  giveaway: GiveawayResponse;
  entry: {
    id: string;
    isWinner: boolean;
    enteredAt: string;
  } | null;
}

export interface GiveawayEntryResponse {
  id: string;
  isWinner: boolean;
  enteredAt: string;
  giveaway: GiveawayResponse;
}

export type OwnedBookFormat = 'hardcover' | 'paperback' | 'ebook' | 'audiobook';

export interface OwnedBookResponse {
  id: string;
  userId: string;
  bookId: string;
  format: OwnedBookFormat;
  conditionNote?: string | null;
  purchaseDate?: string | null;
  isLendable: boolean;
  createdAt: string;
  updatedAt: string;
  title?: string;
  author?: string;
  slug?: string;
  coverImage?: string | null;
}

export interface BookOwnershipResponse {
  owns: boolean;
  formats: OwnedBookFormat[];
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

  getFriendsActivity: (bookId: string) =>
    apiFetch<FriendsActivityResponse>(`/books/${bookId}/friends-activity`),

  getBlogMentions: (bookId: string) =>
    apiFetch<BlogMentionsResponse>(`/books/${bookId}/blog-mentions`),

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

export interface BookCharacterResponse {
  id: string;
  bookId: string;
  name: string;
  description?: string;
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor';
  displayOrder?: number;
  submittedBy?: string | null;
  isApproved: boolean;
  createdAt: string;
}

export interface BookCharactersListResponse {
  characters: BookCharacterResponse[];
  totalCharacters: number;
}

export const discussionsApi = {
  listByBook: (bookId: string, query: { page?: number; limit?: number; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    const qs = params.toString();
    return apiFetch<BookDiscussionsResponse>(`/books/${bookId}/discussions${qs ? `?${qs}` : ''}`);
  },

  create: (bookId: string, data: { title: string; content: string }) =>
    apiFetch<DiscussionSummaryResponse>(`/books/${bookId}/discussions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getThread: (id: string) =>
    apiFetch<DiscussionDetailResponse>(`/discussions/${id}`),

  reply: (id: string, data: { content: string }) =>
    apiFetch<DiscussionReplyResponse>(`/discussions/${id}/replies`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adminUpdate: (id: string, data: { isPinned?: boolean; isLocked?: boolean }) =>
    apiFetch<DiscussionSummaryResponse>(`/admin/discussions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

export const promptsApi = {
  listByBook: (bookId: string) =>
    apiFetch<BookPromptsResponse>(`/books/${bookId}/prompts`),

  getResponses: (promptId: string, query: { page?: number; limit?: number } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return apiFetch<PromptResponsesResponse>(`/prompts/${promptId}/responses${qs ? `?${qs}` : ''}`);
  },

  create: (bookId: string, data: { promptText: string }) =>
    apiFetch<BookPromptResponse>(`/books/${bookId}/prompts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  respond: (promptId: string, data: { content: string }) =>
    apiFetch<PromptResponseItemResponse>(`/prompts/${promptId}/responses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  likeResponse: (responseId: string) =>
    apiFetch<{ success: boolean; likeCount: number; message: string }>(`/prompt-responses/${responseId}/like`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export const bookClubsApi = {
  discover: (query: { page?: number; limit?: number; search?: string; sort?: 'popular' | 'newest' } = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set('page', String(query.page));
    if (query.limit) params.set('limit', String(query.limit));
    if (query.search) params.set('search', query.search);
    if (query.sort) params.set('sort', query.sort);
    const qs = params.toString();
    return apiFetch<{
      clubs: BookClubResponse[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/book-clubs${qs ? `?${qs}` : ''}`);
  },

  create: (data: { name: string; description?: string; coverImage?: string; isPublic?: boolean }) =>
    apiFetch<BookClubResponse>('/book-clubs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  get: (id: string) =>
    apiFetch<BookClubDetailResponse>(`/book-clubs/${id}`),

  join: (id: string) =>
    apiFetch<{ joined: boolean; memberCount: number; message: string }>(`/book-clubs/${id}/join`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  leave: (id: string) =>
    apiFetch<{ left: boolean; memberCount: number; message: string }>(`/book-clubs/${id}/leave`, {
      method: 'DELETE',
    }),

  setPick: (id: string, data: { bookId: string; monthLabel: string; startDate: string; endDate: string }) =>
    apiFetch<BookClubPickResponse>(`/book-clubs/${id}/picks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  picks: (id: string) =>
    apiFetch<{ picks: BookClubPickResponse[] }>(`/book-clubs/${id}/picks`),
};

export const giveawaysApi = {
  list: (query: { sort?: 'ending_soon' | 'newest' | 'popular' } = {}) => {
    const params = new URLSearchParams();
    if (query.sort) params.set('sort', query.sort);
    const qs = params.toString();
    return apiFetch<{ giveaways: GiveawayResponse[] }>(`/giveaways${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) =>
    apiFetch<GiveawayDetailResponse>(`/giveaways/${id}`),

  enter: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/giveaways/${id}/enter`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  myEntries: () =>
    apiFetch<{ entries: GiveawayEntryResponse[] }>('/giveaways/my-entries'),

  create: (data: {
    bookId: string;
    title: string;
    description?: string;
    format: GiveawayFormat;
    copiesAvailable: number;
    countryRestriction?: string[];
    startDate: string;
    endDate: string;
    autoAddToTbr?: boolean;
  }) =>
    apiFetch<{ giveaway: GiveawayResponse }>('/giveaways', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  selectWinners: (id: string) =>
    apiFetch<{ success: boolean; winnerCount: number; winners: Array<{ id: string; userId: string }> }>(`/giveaways/${id}/select-winners`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

export const ownedBooksApi = {
  list: () =>
    apiFetch<{ items: OwnedBookResponse[] }>('/owned-books'),

  add: (data: {
    bookId: string;
    format: OwnedBookFormat;
    conditionNote?: string;
    purchaseDate?: string;
    isLendable?: boolean;
  }) =>
    apiFetch<OwnedBookResponse>('/owned-books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: {
    format?: OwnedBookFormat;
    conditionNote?: string;
    purchaseDate?: string;
    isLendable?: boolean;
  }) =>
    apiFetch<OwnedBookResponse>(`/owned-books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/owned-books/${id}`, {
      method: 'DELETE',
    }),

  getOwnership: (bookId: string) =>
    apiFetch<BookOwnershipResponse>(`/books/${bookId}/ownership`),
};

// ── Editions ─────────────────────────────────────────────────────────────────

export type EditionFormat = 'hardcover' | 'paperback' | 'ebook' | 'audiobook' | 'large_print' | 'mass_market';

export interface EditionResponse {
  id: string;
  title: string;
  slug: string;
  format: EditionFormat | null;
  language: string;
  publisher: string | null;
  year: number | null;
  coverImage: string | null;
  isbn: string | null;
  pageCount: number | null;
}

export interface EditionsBrowserResponse {
  workTitle: string | null;
  canonicalEditionId: string;
  editions: EditionResponse[];
  totalEditions: number;
}

export type BookImageType = 'cover_front' | 'cover_back' | 'spine' | 'sample_page' | 'author_signed';

export interface BookImageResponse {
  id: string;
  url: string;
  type: BookImageType;
  altText?: string | null;
  displayOrder: number;
}

export const editionsApi = {
  list: (bookId: string) =>
    apiFetch<EditionsBrowserResponse>(`/books/${bookId}/editions`),

  adminCreateWork: (data: { title: string; canonicalBookId: string }) =>
    apiFetch<{ id: string; title: string; canonical_book_id: string; created_at: string }>('/admin/works', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  adminAssignWork: (bookId: string, data: {
    workId: string | null;
    editionFormat?: EditionFormat | null;
    editionLanguage?: string | null;
    editionPublisher?: string | null;
    editionYear?: number | null;
  }) =>
    apiFetch<{ success: boolean }>(`/admin/books/${bookId}/work`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  adminListWorks: () =>
    apiFetch<{ works: Array<{ id: string; title: string; canonical_book_id: string; canonical_title: string; created_at: string }> }>('/admin/works'),
};

export const coverImagesApi = {
  list: (bookId: string) =>
    apiFetch<{ images: BookImageResponse[] }>(`/books/${bookId}/images`),

  adminUpload: async (
    bookId: string,
    data: {
      imageType?: BookImageType;
      altText?: string;
      displayOrder?: number;
      imageUrl?: string;
      file?: File;
    },
  ): Promise<{ image: BookImageResponse }> => {
    if (data.file) {
      const formData = new FormData();
      formData.append('image', data.file);
      if (data.imageType) formData.append('imageType', data.imageType);
      if (data.altText) formData.append('altText', data.altText);
      if (data.displayOrder !== undefined) formData.append('displayOrder', String(data.displayOrder));

      const headers: Record<string, string> = {};
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const res = await fetch(`${API_BASE}/admin/books/${bookId}/images`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new ApiError(body.error || 'Upload failed', res.status, body);
      }

      return res.json();
    }

    return apiFetch<{ image: BookImageResponse }>(`/admin/books/${bookId}/images`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  adminDelete: (bookId: string, imageId: string) =>
    apiFetch<{ success: boolean }>(`/admin/books/${bookId}/images/${imageId}`, {
      method: 'DELETE',
    }),
};

export interface UserTagResponse {
  id: string;
  name: string;
  color?: string | null;
  bookCount: number;
  createdAt: string;
}

export interface TaggedBookResponse {
  id: string;
  slug: string;
  title: string;
  author: string;
  coverImage?: string | null;
  googleRating?: number | null;
  ratingsCount: number;
  computedScore: number;
  taggedAt: string;
}

export const tagsApi = {
  list: () =>
    apiFetch<{ tags: UserTagResponse[] }>('/tags'),

  create: (data: { name: string; color?: string | null }) =>
    apiFetch<{ tag: UserTagResponse }>('/tags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; color?: string | null }) =>
    apiFetch<{ tag: UserTagResponse }>(`/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean; message?: string }>(`/tags/${id}`, {
      method: 'DELETE',
    }),

  listForBook: (bookId: string) =>
    apiFetch<{ tags: UserTagResponse[] }>(`/books/${bookId}/tags`),

  addToBook: (bookId: string, tagIds: string[]) =>
    apiFetch<{ success: boolean; tags: UserTagResponse[] }>(`/books/${bookId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tagIds }),
    }),

  removeFromBook: (bookId: string, tagId: string) =>
    apiFetch<{ success: boolean; tags: UserTagResponse[] }>(`/books/${bookId}/tags/${tagId}`, {
      method: 'DELETE',
    }),

  booksByTag: (tagId: string) =>
    apiFetch<{ tag: UserTagResponse; books: TaggedBookResponse[] }>(`/tags/${tagId}/books`),
};

export interface PendingCharacterResponse {
  id: string;
  bookId: string;
  bookTitle: string;
  name: string;
  description?: string;
  role: string;
  userName: string;
  userEmail?: string;
  createdAt: string;
}

export const charactersApi = {
  list: (bookId: string) =>
    apiFetch<BookCharactersListResponse>(`/books/${bookId}/characters`),

  submit: (bookId: string, data: { name: string; description?: string; role?: string }) =>
    apiFetch<{ message: string; character: BookCharacterResponse }>(`/books/${bookId}/characters`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPending: () =>
    apiFetch<PendingCharacterResponse[]>('/admin/characters/pending'),

  approve: (id: string) =>
    apiFetch<{ message: string; character: BookCharacterResponse }>(`/admin/characters/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({}),
    }),
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
  socialLinks?: Record<string, string>;
  isVerified?: boolean;
  claimedBy?: string | null;
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
  posts?: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
  }[];
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

export interface AuthorClaimResponse {
  id: string;
  userId: string;
  authorId: string;
  verificationMethod: 'email' | 'social_media' | 'publisher' | 'manual';
  verificationProof?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  authorName?: string | null;
  claimantName?: string | null;
}

export interface AuthorPortalReviewResponse {
  id: string;
  bookId: string;
  bookTitle: string;
  bookSlug: string;
  userName: string;
  rating: number;
  title: string;
  content: string;
  createdAt: string;
  authorResponse?: {
    content: string;
    respondedAt: string;
  } | null;
}

export interface AuthorPortalDashboardResponse {
  author: {
    id: string;
    name: string;
    slug: string;
    bio: string;
    imageUrl?: string | null;
    website?: string | null;
    socialLinks: Record<string, string>;
  };
  stats: {
    totalBooks: number;
    totalReviews: number;
    avgRating: number;
    totalViews: number;
    followerCount: number;
  };
  posts: {
    id: string;
    title: string;
    content: string;
    isPublished: boolean;
    createdAt: string;
  }[];
  recentReviews: AuthorPortalReviewResponse[];
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

  submitClaim: (data: { authorId: string; verificationMethod: 'email' | 'social_media' | 'publisher' | 'manual'; proof?: string }) =>
    apiFetch<AuthorClaimResponse>('/author-claims', { method: 'POST', body: JSON.stringify(data) }),

  getMyClaims: (authorId?: string) => {
    const params = new URLSearchParams();
    if (authorId) params.set('authorId', authorId);
    const qs = params.toString();
    return apiFetch<{ claims: AuthorClaimResponse[] }>(`/author-claims/mine${qs ? `?${qs}` : ''}`);
  },

  getPortalDashboard: (authorId?: string) => {
    const params = new URLSearchParams();
    if (authorId) params.set('authorId', authorId);
    const qs = params.toString();
    return apiFetch<AuthorPortalDashboardResponse>(`/author-portal/dashboard${qs ? `?${qs}` : ''}`);
  },

  updatePortalProfile: (data: { authorId?: string; bio?: string; imageUrl?: string; website?: string; socialLinks?: Record<string, string> }) =>
    apiFetch<{ id: string; bio: string; imageUrl?: string | null; website?: string | null; socialLinks: Record<string, string>; updatedAt: string }>(
      '/author-portal/profile',
      { method: 'PUT', body: JSON.stringify(data) },
    ),

  createPortalPost: (data: { authorId?: string; title: string; content: string; isPublished?: boolean }) =>
    apiFetch<{ id: string; authorId: string; title: string; content: string; isPublished: boolean; createdAt: string }>(
      '/author-portal/posts',
      { method: 'POST', body: JSON.stringify(data) },
    ),

  respondToReview: (reviewId: string, response: string) =>
    apiFetch<{ reviewId: string; response: { content: string; respondedAt: string }; message: string }>(
      `/author-portal/reviews/${reviewId}/response`,
      { method: 'POST', body: JSON.stringify({ response }) },
    ),

  adminListClaims: (status?: 'pending' | 'approved' | 'rejected') => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return apiFetch<{ claims: AuthorClaimResponse[] }>(`/admin/author-claims${qs ? `?${qs}` : ''}`);
  },

  adminUpdateClaim: (id: string, status: 'approved' | 'rejected') =>
    apiFetch<AuthorClaimResponse>(`/admin/author-claims/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
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

export interface BlogMention {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  publishedAt?: string | null;
}

export interface BlogMentionsResponse {
  mentions: BlogMention[];
  totalMentions: number;
}

export interface AdminBlogMention {
  id: string;
  bookId: string;
  bookTitle: string;
  coverImage?: string | null;
  isAutoDetected: boolean;
  createdAt: string;
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

export const blogMentionsApi = {
  getForBook: (bookId: string) =>
    apiFetch<BlogMentionsResponse>(`/books/${bookId}/blog-mentions`),

  getForPost: (postId: string) =>
    apiFetch<{ mentions: AdminBlogMention[] }>(`/admin/blog/${postId}/book-mentions`),

  linkBooks: (postId: string, bookIds: string[]) =>
    apiFetch<{ success: boolean; added: number }>(`/admin/blog/${postId}/book-mentions`, {
      method: 'POST',
      body: JSON.stringify({ bookIds }),
    }),

  unlinkBook: (postId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/admin/blog/${postId}/book-mentions/${bookId}`, {
      method: 'DELETE',
    }),
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
  hasSpoiler?: boolean;
  spoilerText?: string | null;
  authorResponse?: {
    content: string;
    respondedAt: string;
  } | null;
  createdAt: string;
}

export interface ReviewsForBook {
  reviews: ReviewResponse[];
  stats: {
    averageRating: number;
    totalReviews: number;
    distribution: { rating: number; count: number }[];
  };
  pagination: { page: number; limit: number; total: number; totalFiltered: number; totalPages: number };
}

export interface ReviewFilterParams {
  page?: number;
  includeSpoilers?: boolean;
  q?: string;
  rating?: number;
  minRating?: number;
  maxRating?: number;
  sort?: string;
  hasSpoiler?: boolean;
}

export const reviewsApi = {
  forBook: (bookId: string, filters: ReviewFilterParams = {}) => {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', String(filters.page));
    if (filters.includeSpoilers !== false) params.set('includeSpoilers', 'true');
    if (filters.q) params.set('q', filters.q);
    if (filters.rating !== undefined) params.set('rating', String(filters.rating));
    if (filters.minRating !== undefined) params.set('minRating', String(filters.minRating));
    if (filters.maxRating !== undefined) params.set('maxRating', String(filters.maxRating));
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.hasSpoiler !== undefined) params.set('hasSpoiler', String(filters.hasSpoiler));
    return apiFetch<ReviewsForBook>(`/reviews/book/${bookId}?${params}`);
  },

  create: (data: { bookId: string; rating: number; title?: string; content: string; hasSpoiler?: boolean; spoilerText?: string }) =>
    apiFetch<ReviewResponse>('/reviews', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: { rating: number; title?: string; content: string; hasSpoiler?: boolean; spoilerText?: string | null }) =>
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

  // Public popular searches (top searched terms — falls back to settings/defaults if empty)
  popularSearches: (limit = 20, days = 30) =>
    apiFetch<{ terms: { query: string; count: number }[]; period?: string }>(
      `/analytics/popular-searches?limit=${limit}&days=${days}`,
    ),

  // Public tracking (production only)
  trackEvent: (eventType: string, entityType?: string, entityId?: string, metadata?: any) => {
    if (!isAnalyticsEnabled()) return Promise.resolve({ success: true } as any);
    return apiFetch<{ success: boolean }>('/analytics/event', {
      method: 'POST',
      body: JSON.stringify({ eventType, entityType, entityId, sessionId: getSessionId(), metadata }),
    }).catch(() => {}); // Fire-and-forget
  },

  trackPageView: (pagePath: string, pageTitle?: string) => {
    if (!isAnalyticsEnabled()) return Promise.resolve({ success: true } as any);
    return apiFetch<{ success: boolean }>('/analytics/pageview', {
      method: 'POST',
      body: JSON.stringify({ pagePath, pageTitle, sessionId: getSessionId(), referrer: document.referrer }),
    }).catch(() => {});
  },

  trackAffiliateClick: (bookId: string, source?: string) => {
    if (!isAnalyticsEnabled()) return Promise.resolve({ success: true } as any);
    return apiFetch<{ success: boolean }>('/analytics/affiliate-click', {
      method: 'POST',
      body: JSON.stringify({ bookId, source, sessionId: getSessionId() }),
    }).catch(() => {});
  },

  // Admin analytics
  overview: () => apiFetch<any>('/analytics/overview'),
  pageViews: (days = 30) => apiFetch<any[]>(`/analytics/page-views?days=${days}`),
  topBooks: (days = 30) => apiFetch<any[]>(`/analytics/top-books?days=${days}`),
  topPages: (days = 30) => apiFetch<any[]>(`/analytics/top-pages?days=${days}`),
  eventsSummary: (days = 30) => apiFetch<any[]>(`/analytics/events-summary?days=${days}`),
  affiliateReport: (days = 30) => apiFetch<any>(`/analytics/affiliate-report?days=${days}`),
  googleAnalytics: (days = 30) => apiFetch<AdminGoogleAnalyticsResponse>(`/analytics/google?days=${days}`),
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
  isCommunity?: boolean;
  isFeatured?: boolean;
  voteCount?: number;
  viewCount?: number;
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

export interface ReadingListForBookResponse {
  id: string;
  name: string;
  slug: string;
  containsBook: boolean;
  itemCount: number;
}

export interface CommunityListResponse extends ReadingListResponse {
  isCommunity: boolean;
  isFeatured: boolean;
  voteCount: number;
  viewCount: number;
  categories: string[];
}

export interface CommunityListItemResponse extends ReadingListItemResponse {
  voteScore: number;
  upvotes: number;
  downvotes: number;
  userVote: number;
}

export interface CommunityListDetailResponse extends CommunityListResponse {
  items: CommunityListItemResponse[];
}

export const readingListsApi = {
  /** Get current user's reading lists */
  list: () => apiFetch<{ lists: ReadingListResponse[] }>('/reading-lists'),

  /** Create a new reading list */
  create: (data: { name: string; description?: string; isPublic?: boolean; isCommunity?: boolean; coverImage?: string }) =>
    apiFetch<ReadingListResponse>('/reading-lists', { method: 'POST', body: JSON.stringify(data) }),

  /** Get a specific reading list with items */
  get: (id: string) => apiFetch<ReadingListDetailResponse>(`/reading-lists/${id}`),

  /** Update a reading list */
  update: (id: string, data: Partial<{ name: string; description: string; isPublic: boolean; isCommunity: boolean; coverImage: string }>) =>
    apiFetch<ReadingListResponse>(`/reading-lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  /** Delete a reading list */
  delete: (id: string) => apiFetch<{ success: boolean }>(`/reading-lists/${id}`, { method: 'DELETE' }),

  /** Get all user lists with containsBook flags for a given book */
  forBook: (bookId: string) =>
    apiFetch<ReadingListForBookResponse[]>(`/reading-lists/for-book/${bookId}`),

  /** Add a book to a list */
  addBook: (listId: string, bookId: string, notes?: string) =>
    apiFetch<{ success: boolean; itemId: string; alreadyInList?: boolean }>(`/reading-lists/${listId}/books/${bookId}`, {
      method: 'POST', body: JSON.stringify({ notes }),
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

export const communityListsApi = {
  discover: (query: { page?: number; limit?: number; sort?: 'popular' | 'newest' | 'featured'; category?: string; search?: string } = {}) => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    });
    return apiFetch<{
      lists: CommunityListResponse[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>(`/lists/discover?${params.toString()}`);
  },

  get: (id: string) => apiFetch<CommunityListDetailResponse>(`/lists/${id}`),

  vote: (listId: string, bookId: string, vote: 1 | -1) =>
    apiFetch<{
      success: boolean;
      currentVote: number;
      voteScore: number;
      upvotes: number;
      downvotes: number;
      listVoteCount: number;
      message: string;
    }>(`/lists/${listId}/books/${bookId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ vote }),
    }),
};

// â”€â”€ Reading Progress API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export interface ReadingProgressResponse {
  id: string;
  userId: string;
  bookId: string;
  status: 'want-to-read' | 'reading' | 'finished' | 'dnf';
  currentPage: number;
  totalPages: number;
  percentage?: number | null;
  startedAt?: string;
  finishedAt?: string;
  personalRating?: number;
  notes?: string;
  dnfPercentage?: number | null;
  dnfReason?: string | null;
  // Joined book fields (from list endpoint)
  title?: string;
  author?: string;
  slug?: string;
  coverImage?: string;
  pageCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingProgressHistoryResponse {
  id: string;
  readingProgressId: string;
  currentPage?: number | null;
  percentage?: number | null;
  note?: string | null;
  loggedAt: string;
}

export interface ReadingProgressStats {
  total: number;
  wantToRead: number;
  reading: number;
  finished: number;
  dnf: number;
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
    status?: 'want-to-read' | 'reading' | 'finished' | 'dnf';
    currentPage?: number;
    totalPages?: number;
    startedAt?: string;
    finishedAt?: string;
    personalRating?: number;
    notes?: string;
    dnfPercentage?: number;
    dnfReason?: string;
  }) =>
    apiFetch<{ progress: ReadingProgressResponse }>(`/reading-progress/${bookId}`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  /** Update granular progress and create a history entry */
  updateTracker: (bookId: string, data: {
    currentPage?: number;
    percentage?: number;
    note?: string;
  }) =>
    apiFetch<{ progress: ReadingProgressResponse }>(`/reading-progress/${bookId}/update`, {
      method: 'PUT', body: JSON.stringify(data),
    }),

  /** Get progress update history for a book */
  history: (bookId: string) =>
    apiFetch<{ history: ReadingProgressHistoryResponse[] }>(`/reading-progress/${bookId}/history`),

  /** Remove progress tracking for a book */
  remove: (bookId: string) =>
    apiFetch<{ success: boolean }>(`/reading-progress/${bookId}`, { method: 'DELETE' }),
};

export interface TBRQueueItemResponse {
  id: string;
  userId: string;
  bookId: string;
  position: number;
  addedAt: string;
  title: string;
  author: string;
  slug: string;
  coverImage: string;
  pageCount?: number;
  status?: string | null;
}

export const tbrQueueApi = {
  list: () => apiFetch<{ items: TBRQueueItemResponse[]; maxItems: number }>('/tbr-queue'),

  add: (bookId: string) =>
    apiFetch<{ success: boolean; item: TBRQueueItemResponse; message: string }>('/tbr-queue', {
      method: 'POST',
      body: JSON.stringify({ bookId }),
    }),

  reorder: (bookIds: string[]) =>
    apiFetch<{ success: boolean; items: TBRQueueItemResponse[]; message: string }>('/tbr-queue/reorder', {
      method: 'PUT',
      body: JSON.stringify({ bookIds }),
    }),

  remove: (bookId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/tbr-queue/${bookId}`, {
      method: 'DELETE',
    }),
};

export interface SocialUserSummaryResponse {
  id: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  reviewCount?: number;
  followerCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

export interface SocialUserProfileResponse extends SocialUserSummaryResponse {
  booksRead?: number;
}

export interface ActivityFeedItemResponse {
  id: string;
  type: 'review' | 'rating' | 'shelved' | 'started' | 'finished' | 'dnf' | 'progress' | 'list_created' | 'challenge_set';
  user: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  };
  book: {
    id: string;
    title: string;
    slug: string;
    coverImage?: string | null;
  } | null;
  metadata: Record<string, any>;
  createdAt: string;
}

export const socialUsersApi = {
  getProfile: (userId: string) => apiFetch<SocialUserProfileResponse>(`/users/${userId}`),

  follow: (userId: string) =>
    apiFetch<{ following: boolean; followerCount: number }>(`/users/${userId}/follow`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  unfollow: (userId: string) =>
    apiFetch<{ following: boolean; followerCount: number }>(`/users/${userId}/follow`, {
      method: 'DELETE',
    }),

  getFollowers: (userId: string, page = 1, limit = 20) =>
    apiFetch<{ users: SocialUserSummaryResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/users/${userId}/followers?page=${page}&limit=${limit}`),

  getFollowing: (userId: string, page = 1, limit = 20) =>
    apiFetch<{ users: SocialUserSummaryResponse[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/users/${userId}/following?page=${page}&limit=${limit}`),
};

export const activityFeedApi = {
  list: (page = 1, limit = 20, types?: string[]) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (types && types.length > 0) params.set('type', types.join(','));
    return apiFetch<{ activities: ActivityFeedItemResponse[]; hasMore: boolean; page: number }>(`/feed?${params.toString()}`);
  },
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

  createAwardYear: (data: {
    year: number;
    nominationStart: string;
    nominationEnd: string;
    votingStart: string;
    votingEnd: string;
    isActive?: boolean;
  }) =>
    apiFetch<{ award: ChoiceAwardResponse }>('/admin/awards', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAwardCategory: (awardId: string, data: { name: string; displayOrder?: number }) =>
    apiFetch<{ category: { id: string; awardId: string; name: string; displayOrder: number } }>(`/admin/awards/${awardId}/categories`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createAwardNominee: (categoryId: string, data: { bookId: string; isOfficial?: boolean }) =>
    apiFetch<{ nominee: AwardNomineeResponse }>(`/admin/awards/categories/${categoryId}/nominees`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  publishAwardResults: (awardId: string) =>
    apiFetch<{ success: boolean; message: string }>(`/admin/awards/${awardId}/publish-results`, {
      method: 'PUT',
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

  getCoverUpgradeStatus: () =>
    apiFetch<{ running: boolean }>('/import/upgrade-covers/status'),

  upgradeCovers: (limit = 500, forceAll = false) =>
    apiFetch<{ message: string; started: boolean; booksToProcess: number } | { error: string }>('/import/upgrade-covers', {
      method: 'POST',
      body: JSON.stringify({ limit, forceAll }),
    }),

  getAuthorImageUpgradeStatus: () =>
    apiFetch<{ running: boolean }>('/import/upgrade-author-images/status'),

  upgradeAuthorImages: (limit = 200) =>
    apiFetch<{ message: string; started: boolean; authorsToProcess: number } | { error: string }>('/import/upgrade-author-images', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    }),

  getAmazonFixStatus: () =>
    apiFetch<{ running: boolean }>('/import/fix-amazon-urls/status'),

  fixAmazonUrls: (mode: 'invalid-isbn' | 'all-dp' | 'missing' = 'invalid-isbn') =>
    apiFetch<{ message: string; started: boolean; booksToProcess: number; description: string } | { error: string }>('/import/fix-amazon-urls', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  getRecategorizeStatus: () =>
    apiFetch<{ running: boolean }>('/import/recategorize/status'),

  recategorizeBooks: () =>
    apiFetch<{ started: boolean; totalBooks: number; uncategorizedBooks: number; description: string } | { error: string }>('/import/recategorize', {
      method: 'POST',
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

// ── Series API ──────────────────────────────────────────────────────────────────

export const seriesApi = {
  list: (params?: { page?: number; limit?: number; search?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return apiFetch<{ series: Array<{ id: string; name: string; slug: string; description: string | null; coverImage: string | null; totalBooks: number; isComplete: boolean; createdAt: string; updatedAt: string }>; pagination: { page: number; limit: number; total: number; pages: number } }>(`/series${qs ? `?${qs}` : ''}`);
  },

  getBySlug: (slug: string) =>
    apiFetch<{ series: { id: string; name: string; slug: string; description: string | null; coverImage: string | null; totalBooks: number; isComplete: boolean; createdAt: string; updatedAt: string; books: Array<{ id: string; title: string; slug: string; author: string; coverImage: string; pageCount: number | null; googleRating: number | null; computedScore: number; publishedDate: string | null; description: string | null; position: number; isMainEntry: boolean; authorData: { id: string; name: string; slug: string; imageUrl: string | null } | null }> } }>(`/series/${encodeURIComponent(slug)}`),

  create: (data: { name: string; description?: string; coverImage?: string; isComplete?: boolean }) =>
    apiFetch<{ id: string; slug: string; message: string }>('/series', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: { name?: string; description?: string; coverImage?: string; isComplete?: boolean }) =>
    apiFetch<{ message: string }>(`/series/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ message: string }>(`/series/${id}`, { method: 'DELETE' }),

  addBook: (seriesId: string, data: { bookId: string; position?: number; isMainEntry?: boolean }) =>
    apiFetch<{ id: string; message: string }>(`/series/${seriesId}/books`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBook: (seriesId: string, bookId: string, data: { position?: number; isMainEntry?: boolean }) =>
    apiFetch<{ message: string }>(`/series/${seriesId}/books/${bookId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  removeBook: (seriesId: string, bookId: string) =>
    apiFetch<{ message: string }>(`/series/${seriesId}/books/${bookId}`, { method: 'DELETE' }),
};

// ── Mood Tags API ───────────────────────────────────────────────────────────────

export interface MoodItem {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  color: string;
}

export interface BookMoodEntry extends MoodItem {
  votes: number;
  percentage: number;
  userVoted: boolean;
}

export interface BookMoodsResponse {
  totalVotes: number;
  totalVoters: number;
  moods: BookMoodEntry[];
}

export interface MoodDiscoverResponse {
  mood: MoodItem;
  books: Array<{
    id: string;
    title: string;
    slug: string;
    author: string;
    coverImage: string;
    googleRating: number | null;
    computedScore: number;
    pageCount: number | null;
    publishedDate: string | null;
    description: string | null;
    moodVotes: number;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface AIAnalysisMood {
  moods: string[];
  confidence: number;
}

export interface AIAnalysisPace {
  pace: 'slow' | 'medium' | 'fast' | string;
  confidence: number;
}

export interface AIAnalysisListWithConfidence {
  warnings?: string[];
  themes?: string[];
  confidence: number;
}

export interface AIBookAnalysisResponse {
  bookId: string;
  mood: AIAnalysisMood | null;
  pace: AIAnalysisPace | null;
  contentWarnings: AIAnalysisListWithConfidence | null;
  themes: AIAnalysisListWithConfidence | null;
  difficulty: { level: 'easy' | 'moderate' | 'challenging' | string; confidence: number } | null;
  modelVersion: string | null;
  analyzedAt: string | null;
}

export interface AIMoodDiscoverResponse {
  filters: {
    mood: string | null;
    pace: string | null;
  };
  books: Array<{
    id: string;
    title: string;
    slug: string;
    author: string;
    coverImage: string;
    googleRating: number | null;
    computedScore: number;
    pageCount: number | null;
    publishedDate: string | null;
    aiMood: AIAnalysisMood;
    aiPace: AIAnalysisPace;
    aiDetected: boolean;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const moodApi = {
  getAll: () =>
    apiFetch<MoodItem[]>('/moods'),

  getForBook: (bookId: string) =>
    apiFetch<BookMoodsResponse>(`/moods/books/${encodeURIComponent(bookId)}`),

  vote: (bookId: string, moodIds: string[]) =>
    apiFetch<BookMoodsResponse & { message: string }>(`/moods/books/${encodeURIComponent(bookId)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ moodIds }),
    }),

  removeVote: (bookId: string, moodId: string) =>
    apiFetch<{ message: string }>(`/moods/books/${encodeURIComponent(bookId)}/vote/${encodeURIComponent(moodId)}`, {
      method: 'DELETE',
    }),

  discoverByMood: (slug: string, page?: number) =>
    apiFetch<MoodDiscoverResponse>(`/moods/discover/${encodeURIComponent(slug)}?page=${page || 1}`),
};

export const aiMoodApi = {
  getBookAnalysis: (bookId: string) =>
    apiFetch<AIBookAnalysisResponse>(`/books/${encodeURIComponent(bookId)}/ai-analysis`),

  discoverByMood: (params: { mood?: string; pace?: 'slow' | 'medium' | 'fast'; page?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params.mood) query.set('mood', params.mood);
    if (params.pace) query.set('pace', params.pace);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const qs = query.toString();
    return apiFetch<AIMoodDiscoverResponse>(`/discover/mood${qs ? `?${qs}` : ''}`);
  },

  adminAnalyzeBook: (bookId: string) =>
    apiFetch<{ message: string; bookId: string } & AIBookAnalysisResponse>(`/admin/ai/analyze-book/${encodeURIComponent(bookId)}`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  adminBatchAnalyze: (payload?: { limit?: number; onlyUnanalyzed?: boolean }) =>
    apiFetch<{
      message: string;
      requested: number;
      processed: number;
      successful: number;
      failed: number;
      details: Array<{ bookId: string; title: string; success: boolean; error?: string }>;
    }>('/admin/ai/batch-analyze', {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
};

// ── Pace Indicator API ──────────────────────────────────────────────────────────

export interface PaceSegment {
  votes: number;
  percentage: number;
}

export interface PaceResponse {
  totalVotes: number;
  slow: PaceSegment;
  medium: PaceSegment;
  fast: PaceSegment;
  userVote: 'slow' | 'medium' | 'fast' | null;
}

export type PaceValue = 'slow' | 'medium' | 'fast';

export const paceApi = {
  getForBook: (bookId: string) =>
    apiFetch<PaceResponse>(`/pace/books/${encodeURIComponent(bookId)}`),

  vote: (bookId: string, pace: PaceValue) =>
    apiFetch<PaceResponse & { message: string }>(`/pace/books/${encodeURIComponent(bookId)}/vote`, {
      method: 'POST',
      body: JSON.stringify({ pace }),
    }),

  removeVote: (bookId: string) =>
    apiFetch<{ message: string }>(`/pace/books/${encodeURIComponent(bookId)}/vote`, {
      method: 'DELETE',
    }),
};

// ── Story Arc Visualization API ───────────────────────────────────────────────

export interface StoryArcPoint {
  position: number;
  intensity: number;
  label?: string | null;
}

export interface StoryArcResponse {
  arc: StoryArcPoint[];
  source: 'ai' | 'community_avg' | 'admin' | string;
  voterCount: number;
}

export const storyArcApi = {
  getForBook: (bookId: string) =>
    apiFetch<StoryArcResponse>(`/books/${encodeURIComponent(bookId)}/story-arc`),

  vote: (bookId: string, payload: { positionPercent: number; intensity: number; label?: string }) =>
    apiFetch<StoryArcResponse & { message: string }>(`/books/${encodeURIComponent(bookId)}/story-arc/vote`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  generateForBook: (bookId: string) =>
    apiFetch<StoryArcResponse & { message: string }>(`/admin/books/${encodeURIComponent(bookId)}/story-arc/generate`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
};

// ── Reading Counts API ──────────────────────────────────────────────────────────

export interface ReadingCountsResponse {
  currentlyReading: number;
  wantToRead: number;
  haveRead: number;
  dnf: number;
  total: number;
}

export const readingCountsApi = {
  getForBook: (bookId: string) =>
    apiFetch<ReadingCountsResponse>(`/reading-counts/books/${encodeURIComponent(bookId)}`),
};

// ── Inline Rating API ────────────────────────────────────────────────────────

export interface RateBookResponse {
  reviewId: string;
  rating: number;
  isNew: boolean;
}

export const ratingApi = {
  rate: (slug: string, rating: number) =>
    apiFetch<RateBookResponse>(`/books/${encodeURIComponent(slug)}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    }),
};

// ── Reading Challenge API ────────────────────────────────────────────────────

export interface ReadingChallengeResponse {
  id: string;
  year: number;
  goalBooks: number;
  booksCompleted: number;
  percentComplete: number;
  onTrack: boolean;
  booksAhead: number;
  projectedTotal: number;
  startedAt: string;
  updatedAt: string;
  recentBooks: {
    id: string;
    title: string;
    slug: string;
    coverImage: string | null;
    finishedAt: string;
  }[];
}

export interface PublicReadingChallengeResponse extends ReadingChallengeResponse {
  userName: string;
}

export const readingChallengeApi = {
  /** Get current user's challenge for a year */
  get: (year?: number) => {
    const params = year ? `?year=${year}` : '';
    return apiFetch<ReadingChallengeResponse | null>(`/reading-challenge${params}`);
  },

  /** Create a new reading challenge */
  create: (data: { year?: number; goalBooks: number }) =>
    apiFetch<ReadingChallengeResponse>('/reading-challenge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Update reading challenge goal */
  update: (id: string, data: { goalBooks: number }) =>
    apiFetch<ReadingChallengeResponse>(`/reading-challenge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Get public challenge for a user */
  getPublic: (userId: string, year?: number) => {
    const params = year ? `?year=${year}` : '';
    return apiFetch<PublicReadingChallengeResponse>(`/reading-challenge/${userId}/public${params}`);
  },
};

// ── Reading Stats API ───────────────────────────────────────────────────────

export interface BookRef {
  title: string;
  slug?: string;
  pageCount?: number;
  days?: number;
}

export interface ReadingStatsResponse {
  period: string;
  booksRead: number;
  pagesRead: number;
  averageRating: number;
  averagePageCount: number;
  shortestBook: BookRef | null;
  longestBook: BookRef | null;
  booksPerMonth: { month: string; count: number }[];
  pagesPerMonth: { month: string; pages: number }[];
  genreDistribution: { genre: string; count: number; percentage: number }[];
  ratingDistribution: { rating: number; count: number }[];
  streak: {
    currentDays: number;
    longestDays: number;
    lastReadingDate: string | null;
  };
  topAuthors: { name: string; booksRead: number }[];
  readingPace: {
    averageDaysPerBook: number;
    fastestBook: BookRef | null;
    slowestBook: BookRef | null;
  };
}

export interface PublicReadingStatsResponse {
  userName: string;
  period: string;
  booksRead: number;
  pagesRead: number;
  genreDistribution: { genre: string; count: number; percentage: number }[];
  streak: {
    currentDays: number;
    longestDays: number;
  };
}

export const readingStatsApi = {
  /** Get current user's reading statistics */
  getMyStats: (year?: number) => {
    const params = year ? `?year=${year}` : '';
    return apiFetch<ReadingStatsResponse>(`/users/me/stats${params}`);
  },

  /** Get public stats for a user */
  getPublicStats: (userId: string, year?: number) => {
    const params = year ? `?year=${year}` : '';
    return apiFetch<PublicReadingStatsResponse>(`/users/${userId}/stats/public${params}`);
  },
};

// ── Year In Books API ──────────────────────────────────────────────────────

export interface YearInBooksResponse {
  year: number;
  totalBooks: number;
  totalPages: number;
  averageRating: number;
  genreBreakdown: { genre: string; count: number }[];
  shortestBook: { title: string; pages: number; slug?: string } | null;
  longestBook: { title: string; pages: number; slug?: string } | null;
  monthlyBreakdown: { month: string; booksRead: number }[];
  topRatedBooks: { title: string; slug: string; rating: number; coverImage?: string | null }[];
  readingStreak: { longest: number; current: number };
  shareImageUrl: string;
}

export const yearInBooksApi = {
  get: (userId: string, year: number) =>
    apiFetch<YearInBooksResponse>(`/users/${userId}/year-in-books/${year}`),

  getShareImageUrl: (userId: string, year: number) =>
    `${API_BASE}/users/${userId}/year-in-books/${year}/share-image`,
};

export interface AwardBookSummary {
  id: string;
  title: string;
  author: string;
  slug: string;
  coverImage?: string | null;
  averageRating?: number;
}

export interface AwardNomineeResponse {
  id: string;
  categoryId: string;
  bookId: string;
  isOfficial: boolean;
  voteCount: number;
  isWinner: boolean;
  book: AwardBookSummary;
}

export interface AwardCategoryResponse {
  id: string;
  name: string;
  displayOrder: number;
  myVoteNomineeId: string | null;
  nominees: AwardNomineeResponse[];
}

export interface ChoiceAwardResponse {
  id: string;
  year: number;
  isActive: boolean;
  nominationStart: string;
  nominationEnd: string;
  votingStart: string;
  votingEnd: string;
  resultsPublished: boolean;
  isVotingOpen: boolean;
}

export interface ChoiceAwardsPayload {
  award: ChoiceAwardResponse;
  categories: AwardCategoryResponse[];
}

export const choiceAwardsApi = {
  getByYear: (year: number) =>
    apiFetch<ChoiceAwardsPayload>(`/awards/${year}`),

  vote: (year: number, categoryId: string, nomineeId: string) =>
    apiFetch<{ success: boolean; nomineeId: string; voteCount: number; message: string }>(`/awards/${year}/categories/${categoryId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ nomineeId }),
    }),
};

export type JournalEntryType = 'note' | 'quote' | 'highlight' | 'reaction';

export interface JournalEntryBookSummary {
  id: string;
  title: string;
  slug: string;
  author: string;
  coverImage?: string | null;
}

export interface JournalEntryResponse {
  id: string;
  userId: string;
  bookId: string;
  entryType: JournalEntryType;
  content: string;
  pageNumber: number | null;
  chapter: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  book?: JournalEntryBookSummary;
}

export interface JournalQuoteResponse {
  id: string;
  bookId: string;
  entryType: JournalEntryType;
  content: string;
  pageNumber: number | null;
  chapter: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}

export const journalApi = {
  list: (bookId?: string) => {
    const qs = bookId ? `?bookId=${encodeURIComponent(bookId)}` : '';
    return apiFetch<{ entries: JournalEntryResponse[] }>(`/journal${qs}`);
  },

  create: (data: {
    bookId: string;
    content: string;
    entryType?: JournalEntryType;
    pageNumber?: number | null;
    chapter?: string | null;
    isPrivate?: boolean;
  }) =>
    apiFetch<{ entry: JournalEntryResponse }>('/journal', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: {
    content?: string;
    entryType?: JournalEntryType;
    pageNumber?: number | null;
    chapter?: string | null;
    isPrivate?: boolean;
  }) =>
    apiFetch<{ entry: JournalEntryResponse }>(`/journal/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    apiFetch<{ success: boolean; message: string }>(`/journal/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  publicQuotes: (bookId: string, limit = 30) =>
    apiFetch<{ quotes: JournalQuoteResponse[] }>(`/books/${encodeURIComponent(bookId)}/quotes?limit=${limit}`),
};

// ── Goodreads Import API ────────────────────────────────────────────────────

export interface ImportJobPreview {
  title: string;
  author: string;
  rating: string;
  shelf: string;
  dateRead: string;
}

export interface ImportJobResponse {
  jobId: string;
  status: string;
  totalRows: number;
  preview: ImportJobPreview[];
}

export interface ImportJobItem {
  rowNumber: number;
  title: string;
  author: string;
  status: 'matched' | 'created' | 'skipped' | 'failed';
  matchedBookId: string | null;
  errorReason: string | null;
}

export interface ImportJobDetail {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  source: string;
  totalRows: number;
  processedRows: number;
  matchedBooks: number;
  newBooks: number;
  skippedRows: number;
  errorMessage: string | null;
  fileName: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  items: ImportJobItem[];
}

export interface ImportHistoryJob {
  id: string;
  status: string;
  totalRows: number;
  processedRows: number;
  matchedBooks: number;
  skippedRows: number;
  fileName: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export const goodreadsImportApi = {
  /** Upload a Goodreads CSV file for import */
  upload: async (file: File): Promise<ImportJobResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API_BASE}/import/user/goodreads`, {
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

  /** Get import job progress / detail */
  getJob: (jobId: string) =>
    apiFetch<ImportJobDetail>(`/import/user/goodreads/${jobId}`),

  /** Get past import jobs */
  getHistory: () =>
    apiFetch<{ jobs: ImportHistoryJob[] }>('/import/user/goodreads'),
};

// ── Content Warnings API ────────────────────────────────────────────────────

export interface ContentWarningTaxonomy {
  id: string;
  name: string;
  slug: string;
  category: 'violence' | 'sexual' | 'mental_health' | 'discrimination' | 'death' | 'other';
  description: string | null;
  displayOrder: number;
}

export interface BookContentWarning {
  id: string;
  name: string;
  slug: string;
  category: string;
  severity: 'mild' | 'moderate' | 'severe';
  reportCount: number;
  agreeCount: number;
  disagreeCount: number;
  confidence: number;
  submissions: string[];
}

export interface BookContentWarningsResponse {
  totalWarnings: number;
  warnings: BookContentWarning[];
  userVotes: Record<string, 'agree' | 'disagree'>;
}

export interface PendingContentWarning {
  id: string;
  bookId: string;
  bookTitle: string;
  warningName: string;
  warningSlug: string;
  category: string;
  severity: string;
  details: string | null;
  userName: string;
  userEmail: string;
  createdAt: string;
}

export const contentWarningsApi = {
  /** Get all predefined content warning types */
  getTaxonomy: () =>
    apiFetch<ContentWarningTaxonomy[]>('/content-warnings'),

  /** Get content warnings for a specific book */
  getForBook: (bookId: string) =>
    apiFetch<BookContentWarningsResponse>(`/content-warnings/books/${bookId}`),

  /** Submit a content warning for a book */
  submit: (bookId: string, data: { warningId: string; severity: string; details?: string }) =>
    apiFetch<{ id: string; message: string }>(`/content-warnings/books/${bookId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Vote agree/disagree on a content warning */
  vote: (warningId: string, vote: 'agree' | 'disagree') =>
    apiFetch<{ message: string; agreeCount: number; disagreeCount: number }>(
      `/content-warnings/${warningId}/vote`,
      { method: 'POST', body: JSON.stringify({ vote }) }
    ),

  /** Get pending (unapproved) warnings for admin */
  getPending: () =>
    apiFetch<PendingContentWarning[]>('/content-warnings/admin/pending'),

  /** Approve a content warning */
  approve: (id: string) =>
    apiFetch<{ message: string }>(`/content-warnings/admin/${id}/approve`, { method: 'PUT' }),

  /** Reject a content warning */
  reject: (id: string) =>
    apiFetch<{ message: string }>(`/content-warnings/admin/${id}/reject`, { method: 'PUT' }),
};

// ── Review Comments API ─────────────────────────────────────────────────────

export interface ReviewCommentUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface ReviewComment {
  id: string;
  content: string;
  user: ReviewCommentUser;
  parentCommentId: string | null;
  isEdited: boolean;
  createdAt: string;
  updatedAt?: string;
  replies: ReviewComment[];
}

export interface ReviewCommentsResponse {
  comments: ReviewComment[];
  totalComments: number;
}

export const reviewCommentsApi = {
  /** Get comments for a review */
  getForReview: (reviewId: string, page = 1) =>
    apiFetch<ReviewCommentsResponse>(`/review-comments/${reviewId}?page=${page}`),

  /** Post a comment on a review */
  create: (reviewId: string, data: { content: string; parentCommentId?: string }) =>
    apiFetch<ReviewComment>(`/review-comments/${reviewId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Edit own comment */
  update: (commentId: string, data: { content: string }) =>
    apiFetch<ReviewComment>(`/review-comments/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** Delete comment (own or admin) */
  delete: (commentId: string) =>
    apiFetch<{ success: boolean }>(`/review-comments/comments/${commentId}`, { method: 'DELETE' }),
};

// ── Quizzes & Trivia API ─────────────────────────────────────────────────────

export interface QuizAnswer {
  id: string;
  answerText: string;
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  questionOrder: number;
  answers: QuizAnswer[];
}

export interface QuizSummary {
  id: string;
  title: string;
  description: string | null;
  bookId: string | null;
  createdBy: string;
  questionCount: number;
  attemptCount: number;
  avgScore: number | null;
  isPublished: boolean;
  createdAt: string;
  creatorName: string | null;
  bookTitle?: string | null;
  bookSlug?: string | null;
  bookCover?: string | null;
}

export interface QuizDetail extends QuizSummary {
  questions: QuizQuestion[];
}

export interface QuizSubmitResult {
  questionId: string;
  questionText: string;
  yourAnswerId: string;
  yourAnswerText: string;
  correctAnswerId: string | null;
  correctAnswerText: string | null;
  isCorrect: boolean;
}

export interface QuizSubmitResponse {
  score: number;
  totalQuestions: number;
  percentage: number;
  results: QuizSubmitResult[];
}

export interface QuizLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  completedAt: string;
}

export const quizzesApi = {
  forBook: (bookId: string) =>
    apiFetch<{ quizzes: QuizSummary[]; total: number }>(`/books/${encodeURIComponent(bookId)}/quizzes`),

  discover: (page = 1, limit = 20, sort?: 'popular' | 'recent') => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (sort) qs.set('sort', sort);
    return apiFetch<{ quizzes: QuizSummary[]; pagination: any }>(`/quizzes/discover?${qs}`);
  },

  get: (id: string) =>
    apiFetch<QuizDetail>(`/quizzes/${encodeURIComponent(id)}`),

  submit: (id: string, answers: { questionId: string; answerId: string }[]) =>
    apiFetch<QuizSubmitResponse>(`/quizzes/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),

  create: (data: {
    title: string;
    description?: string;
    bookId?: string | null;
    questions: Array<{
      questionText: string;
      answers: Array<{ answerText: string; isCorrect: boolean }>;
    }>;
  }) =>
    apiFetch<QuizSummary>('/quizzes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  leaderboard: (id: string, limit = 20) =>
    apiFetch<{ quizId: string; quizTitle: string; leaderboard: QuizLeaderboardEntry[] }>(
      `/quizzes/${encodeURIComponent(id)}/leaderboard?limit=${limit}`,
    ),
};
