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
  indexedAt: string;
  createdAt: string;
  updatedAt: string;
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
