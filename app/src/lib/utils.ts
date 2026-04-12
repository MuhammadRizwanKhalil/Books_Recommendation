import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import DOMPurify from "dompurify";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitize HTML to prevent XSS — use before dangerouslySetInnerHTML */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'hr', 'blockquote', 'code', 'pre', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'span', 'div', 'b', 'i', 'u', 'sup', 'sub'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'width', 'height', 'id'],
  });
}

// Format rating to display stars
export function formatRating(rating: number | undefined): string {
  if (!rating) return '0.0';
  return rating.toFixed(1);
}

// Get star rating array for display
export function getStarRating(rating: number | undefined): { full: number; half: boolean; empty: number } {
  if (!rating) return { full: 0, half: false, empty: 5 };
  
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  
  return { full: fullStars, half: hasHalfStar, empty: emptyStars };
}

// Format price
export function formatPrice(price: number | undefined, currency: string = 'USD'): string {
  if (price === undefined) return '';
  
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  });
  
  return formatter.format(price);
}

// Format date
export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

// Format number with commas
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num);
}

// Truncate text
export function truncateText(text: string | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// Generate SEO metadata for book
export function generateBookMetadata(book: { 
  title: string; 
  author: string; 
  description?: string;
  googleRating?: number;
}) {
  const title = `${book.title} by ${book.author} | Book Discovery`;
  const description = book.description 
    ? truncateText(book.description, 160)
    : `Discover ${book.title} by ${book.author}. Read reviews and find the best prices.`;
  
  return {
    title,
    description,
    keywords: [book.title, book.author, 'book', 'review', 'buy'],
  };
}

// Generate structured data for book (JSON-LD)
export function generateBookStructuredData(book: {
  title: string;
  author: string;
  isbn10?: string;
  isbn13?: string;
  coverImage: string;
  description?: string;
  googleRating?: number;
  ratingsCount?: number;
  price?: number;
  currency?: string;
  amazonUrl?: string;
  publishedDate?: string;
  publisher?: string;
}, reviews?: Array<{
  userName: string;
  rating: number;
  title?: string;
  content: string;
  createdAt: string;
}>) {
  const reviewSchema = reviews?.length
    ? reviews.slice(0, 10).map(r => ({
        '@type': 'Review' as const,
        author: { '@type': 'Person' as const, name: r.userName },
        reviewRating: {
          '@type': 'Rating' as const,
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        name: r.title || `Review of ${book.title}`,
        reviewBody: r.content,
        datePublished: r.createdAt,
      }))
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: {
      '@type': 'Person',
      name: book.author,
    },
    isbn: book.isbn13 || book.isbn10,
    image: book.coverImage,
    description: book.description,
    aggregateRating: book.googleRating ? {
      '@type': 'AggregateRating',
      ratingValue: book.googleRating,
      ratingCount: book.ratingsCount,
      bestRating: 5,
      worstRating: 1,
    } : undefined,
    review: reviewSchema,
    offers: book.amazonUrl ? {
      '@type': 'Offer',
      url: book.amazonUrl,
      availability: 'https://schema.org/InStock',
      price: book.price?.toString(),
      priceCurrency: book.currency,
    } : undefined,
    datePublished: book.publishedDate,
    publisher: book.publisher ? {
      '@type': 'Organization',
      name: book.publisher,
    } : undefined,
  };
}

// Calculate reading time
export function calculateReadingTime(wordCount: number): string {
  const wordsPerMinute = 200;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min read`;
}

// Generate slug from text
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Scroll to element smoothly
export function scrollToElement(elementId: string) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Parse tags that may be stored as JSON array string, comma-separated string, or array.
 * Always returns a clean string array.
 */
export function parseTags(tags: string | string[] | undefined | null): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(t => String(t).trim()).filter(Boolean);
  const str = String(tags).trim();
  if (str.startsWith('[')) {
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((t: any) => String(t).trim()).filter(Boolean);
    } catch { /* not valid JSON, fall through */ }
  }
  return str.split(',').map(t => t.trim()).filter(Boolean);
}

// Copy to clipboard
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy:', err);
    return false;
  }
}
