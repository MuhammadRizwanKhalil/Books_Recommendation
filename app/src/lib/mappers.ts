import type { Book, Category, BlogPost } from '@/types';
import { getSafeCoverImage } from './imageUtils';

/**
 * Map an API book row (camelCase or snake_case) → frontend Book type.
 * This is the single source of truth for API → UI mapping.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBook(b: any): Book {
  const cover = getSafeCoverImage(b.coverImage || b.cover_image || '');
  return {
    id: String(b.id),
    googleBooksId: b.googleBooksId || b.google_books_id || '',
    title: b.title,
    subtitle: b.subtitle || '',
    author: b.author,
    description: b.description || '',
    coverImage: cover,
    publisher: b.publisher || '',
    publishedDate: b.publishedDate || b.published_date || '',
    pageCount: b.pageCount || b.page_count || 0,
    language: b.language || 'en',
    categories: b.categories?.map((c) => (typeof c === 'string' ? c : c.slug || c)) || [],
    googleRating: b.googleRating ?? b.google_rating ?? 0,
    ratingsCount: b.ratingsCount ?? b.ratings_count ?? 0,
    computedScore: b.computedScore ?? b.computed_score ?? 0,
    price: b.price ?? 0,
    currency: b.currency || 'USD',
    amazonUrl: b.amazonUrl || b.amazon_url || '',
    isbn10: b.isbn10 || '',
    isbn13: b.isbn13 || '',
    slug: b.slug || '',
    metaTitle: b.metaTitle || b.meta_title || '',
    metaDescription: b.metaDescription || b.meta_description || '',
    authorId: b.authorId || b.author_id || undefined,
    authorData: b.authorData || b.author_data || null,
    ogImage: b.ogImage || b.og_image || '',
    canonicalUrl: b.canonicalUrl || b.canonical_url || '',
    focusKeyword: b.focusKeyword || b.focus_keyword || '',
    seoRobots: b.seoRobots || b.seo_robots || '',
    goodreadsUrl: b.goodreadsUrl || b.goodreads_url || '',
    customLinkLabel: b.customLinkLabel || b.custom_link_label || '',
    customLinkUrl: b.customLinkUrl || b.custom_link_url || '',
    adminNotes: b.adminNotes || b.admin_notes || '',
    status: b.status || 'PUBLISHED',
    isActive: b.isActive ?? b.is_active ?? true,
    indexedAt: b.indexedAt || b.indexed_at || '',
    createdAt: b.createdAt || b.created_at || '',
    updatedAt: b.updatedAt || b.updated_at || '',
  };
}

/**
 * Map an API category row → frontend Category type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapCategory(c: any): Category {
  return {
    id: String(c.id),
    name: c.name,
    slug: c.slug,
    description: c.description || '',
    imageUrl: c.imageUrl || c.image_url || '',
    metaTitle: c.metaTitle || c.meta_title || '',
    metaDescription: c.metaDescription || c.meta_description || '',
    bookCount: c.bookCount ?? c.book_count ?? 0,
  };
}

/**
 * Map an API blog post row → frontend BlogPost type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapBlogPost(p: any): BlogPost {
  return {
    id: String(p.id),
    title: p.title,
    slug: p.slug,
    content: p.content || '',
    excerpt: p.excerpt || '',
    metaTitle: p.metaTitle || p.meta_title || '',
    metaDescription: p.metaDescription || p.meta_description || '',
    featuredImage: p.featuredImage || p.featured_image || '',
    ogImage: p.ogImage || p.og_image || '',
    canonicalUrl: p.canonicalUrl || p.canonical_url || '',
    focusKeyword: p.focusKeyword || p.focus_keyword || '',
    seoRobots: p.seoRobots || p.seo_robots || '',
    tags: p.tags || '',
    category: p.category || '',
    customLinkLabel: p.customLinkLabel || p.custom_link_label || '',
    customLinkUrl: p.customLinkUrl || p.custom_link_url || '',
    adminNotes: p.adminNotes || p.admin_notes || '',
    allowComments: p.allowComments ?? p.allow_comments ?? true,
    isFeatured: p.isFeatured ?? p.is_featured ?? false,
    featuredBookIds: p.featuredBookIds || p.featured_book_ids || [],
    status: p.status || 'DRAFT',
    publishedAt: p.publishedAt || p.published_at || '',
    generatedBy: p.generatedBy || p.generated_by || undefined,
    createdAt: p.createdAt || p.created_at || '',
    updatedAt: p.updatedAt || p.updated_at || '',
  };
}
