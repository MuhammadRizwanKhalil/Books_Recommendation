/**
 * Responsive Image Utilities
 * 
 * Generates optimized image URLs via the server image proxy.
 * Supports multiple widths for srcSet, WebP/AVIF format negotiation,
 * and fallback to original URLs.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Standard widths for responsive srcSet
const SRCSET_WIDTHS = [200, 300, 400, 600, 800];

/**
 * Build a proxied image URL with optional resize parameters.
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  options?: { width?: number; height?: number; quality?: number }
): string {
  if (!originalUrl || originalUrl.startsWith('data:')) return originalUrl;

  const params = new URLSearchParams({ url: originalUrl });
  if (options?.width) params.set('w', String(options.width));
  if (options?.height) params.set('h', String(options.height));
  if (options?.quality) params.set('q', String(options.quality));

  return `${API_BASE}/image?${params.toString()}`;
}

/**
 * Generate a srcSet string for responsive images.
 * Each entry is a proxied URL at a specific width.
 */
export function getImageSrcSet(
  originalUrl: string,
  widths: number[] = SRCSET_WIDTHS,
  quality = 80
): string {
  if (!originalUrl || originalUrl.startsWith('data:')) return '';

  return widths
    .map(w => {
      const url = getOptimizedImageUrl(originalUrl, { width: w, quality });
      return `${url} ${w}w`;
    })
    .join(', ');
}

/**
 * Global default book cover for all missing/unavailable book images.
 * Served from static public assets for consistency across the app.
 */
export const FALLBACK_COVER = '/images/default-book-cover.svg';

/** Resolve a potentially empty/invalid image URL to a safe cover source. */
export function getSafeCoverImage(src?: string | null): string {
  if (!src) return FALLBACK_COVER;

  const normalized = String(src).trim();
  if (!normalized) return FALLBACK_COVER;

  const lowered = normalized.toLowerCase();
  if (lowered === 'null' || lowered === 'undefined' || lowered === 'n/a') {
    return FALLBACK_COVER;
  }

  return normalized;
}

/** Handler for img onError — swaps src to branded fallback */
export function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.src !== FALLBACK_COVER) {
    img.src = FALLBACK_COVER;
    img.srcset = '';
  }
}

/**
 * Generate proper sizes attribute for responsive images.
 */
export function getImageSizes(variant: 'compact' | 'standard' | 'featured' | 'detail' = 'standard'): string {
  switch (variant) {
    case 'compact':
      return '(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px';
    case 'featured':
      return '(max-width: 768px) 100vw, 50vw';
    case 'detail':
      return '(max-width: 640px) 90vw, (max-width: 1024px) 40vw, 400px';
    default: // standard
      return '(max-width: 640px) 45vw, (max-width: 1024px) 25vw, 250px';
  }
}
