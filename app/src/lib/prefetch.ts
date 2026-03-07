/**
 * Prefetch Utilities
 * 
 * Provides hover-triggered prefetching for book detail pages.
 * Uses a simple in-memory cache to avoid duplicate requests.
 */

const prefetchCache = new Set<string>();
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Prefetch book detail data when user hovers a card.
 * The browser/service-worker caches the response for instant navigation.
 */
export function prefetchBook(slug: string): void {
  if (!slug || prefetchCache.has(slug)) return;
  prefetchCache.add(slug);

  // Use low-priority fetch to avoid blocking main requests
  const url = `${API_BASE}/books/${slug}`;
  
  // Prefer using link rel="prefetch" for browser-native handling
  if (typeof document !== 'undefined') {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'fetch';
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
    
    // Clean up after 30s to avoid DOM bloat
    setTimeout(() => {
      try { document.head.removeChild(link); } catch {}
    }, 30000);
  }
}

/**
 * Prefetch a category page's data.
 */
export function prefetchCategory(slug: string): void {
  if (!slug || prefetchCache.has(`cat-${slug}`)) return;
  prefetchCache.add(`cat-${slug}`);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = `${API_BASE}/categories/${slug}`;
  link.as = 'fetch';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);

  setTimeout(() => {
    try { document.head.removeChild(link); } catch {}
  }, 30000);
}

/**
 * Prefetch a blog post's data.
 */
export function prefetchBlogPost(slug: string): void {
  if (!slug || prefetchCache.has(`blog-${slug}`)) return;
  prefetchCache.add(`blog-${slug}`);

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = `${API_BASE}/blog/${slug}`;
  link.as = 'fetch';
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);

  setTimeout(() => {
    try { document.head.removeChild(link); } catch {}
  }, 30000);
}
