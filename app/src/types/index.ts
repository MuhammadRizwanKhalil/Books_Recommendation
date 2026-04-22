// Book Types
export interface Book {
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
  /** All authors linked to this book (multi-author support) */
  authorsData?: Array<{
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    bio?: string;
    bookCount?: number;
    followerCount?: number;
    isFollowed?: boolean;
  }>;
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
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isActive: boolean;
  /** Series this book belongs to */
  series?: BookSeriesEntry[];
  userRating?: number | null;
  indexedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Series Types
export interface BookSeries {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  coverImage?: string | null;
  totalBooks: number;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BookSeriesEntry {
  id: string;
  name: string;
  slug: string;
  position: number;
  totalBooks: number;
}

export interface BookSeriesDetail extends BookSeries {
  books: SeriesBookEntry[];
}

export interface SeriesBookEntry {
  id: string;
  title: string;
  slug: string;
  author: string;
  coverImage: string;
  pageCount?: number;
  googleRating?: number;
  computedScore: number;
  publishedDate?: string;
  description?: string;
  position: number;
  isMainEntry: boolean;
  authorData?: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string | null;
  } | null;
}

export interface Author {
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

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  metaTitle?: string;
  metaDescription?: string;
  bookCount: number;
}

export interface BlogPost {
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
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED';
  publishedAt?: string;
  generatedBy?: 'ai' | 'cron' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface SearchFilters {
  category?: string;
  minRating?: number;
  maxRating?: number;
  yearFrom?: number;
  yearTo?: number;
  priceMin?: number;
  priceMax?: number;
}

// Admin analytics types
export interface AdminAnalyticsDailyPoint {
  date: string;
  sessions: number;
  users: number;
  pageViews: number;
  bounceRate: number;
  avgSessionDuration: number;
  engagementRate: number;
}

export interface AdminAnalyticsSummary {
  totalSessions: number;
  totalUsers: number;
  totalPageViews: number;
  avgBounceRate: number;
  avgSessionDuration: number;
  pagesPerSession: number;
  engagementRate: number;
}

export interface AdminGoogleAnalyticsResponse {
  reporting: {
    dateRange: { start: string; end: string };
    dailyData: AdminAnalyticsDailyPoint[];
    summary: AdminAnalyticsSummary;
  };
  demographics: {
    countries: Array<{ country: string; users: number; percentage: number }>;
    devices: Array<{ device: string; sessions: number; percentage: number }>;
    browsers: Array<{ browser: string; sessions: number; percentage: number }>;
  };
  trafficSources: Array<{ source: string; sessions: number; percentage: number }>;
  topPages: Array<{ page: string; title: string; pageViews: number; avgTime: number }>;
  realtime: {
    activeUsers: number;
    topActivePages: Array<{ page: string; users: number }>;
  };
  isConfigured: boolean;
  dataSource: 'ga4' | 'unavailable';
  propertyId: string | null;
  measurementId: string;
  note?: string;
  queriedAt: string;
}
