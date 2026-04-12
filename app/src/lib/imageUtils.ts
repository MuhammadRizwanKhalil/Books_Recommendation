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
 * Professional branded fallback for missing/broken book cover images.
 * Uses TheBookTimes open-book logo with brand colors.
 */
export const FALLBACK_COVER = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#1a1a2e"/>
        <stop offset="100%" style="stop-color:#16213e"/>
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" style="stop-color:#c2631a"/>
        <stop offset="100%" style="stop-color:#d4841d"/>
      </linearGradient>
    </defs>
    <rect width="200" height="300" rx="12" fill="url(#bg)"/>
    <rect x="0" y="0" width="200" height="4" rx="12" fill="url(#accent)"/>
    <g transform="translate(100, 115)">
      <path d="M0 -50C-18 -55 -45 -53 -68 -48L-68 45C-45 40 -18 39 0 45Z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
      <path d="M0 -50C18 -55 45 -53 68 -48L68 45C45 40 18 39 0 45Z" fill="rgba(255,255,255,0.8)" stroke="rgba(255,255,255,0.6)" stroke-width="1.5"/>
      <line x1="-55" y1="-22" x2="-12" y2="-19" stroke="#c2631a" stroke-width="2" stroke-opacity="0.35" stroke-linecap="round"/>
      <line x1="-55" y1="-4" x2="-12" y2="-1" stroke="#c2631a" stroke-width="2" stroke-opacity="0.35" stroke-linecap="round"/>
      <line x1="-55" y1="14" x2="-25" y2="16" stroke="#c2631a" stroke-width="2" stroke-opacity="0.25" stroke-linecap="round"/>
      <line x1="12" y1="-19" x2="55" y2="-22" stroke="#c2631a" stroke-width="2" stroke-opacity="0.35" stroke-linecap="round"/>
      <line x1="12" y1="-1" x2="55" y2="-4" stroke="#c2631a" stroke-width="2" stroke-opacity="0.35" stroke-linecap="round"/>
      <line x1="25" y1="16" x2="55" y2="14" stroke="#c2631a" stroke-width="2" stroke-opacity="0.25" stroke-linecap="round"/>
    </g>
    <text x="100" y="205" font-family="Georgia,serif" font-size="14" font-weight="bold" fill="rgba(255,255,255,0.85)" text-anchor="middle" letter-spacing="1">TheBookTimes</text>
    <rect x="60" y="215" width="80" height="1" rx="0.5" fill="url(#accent)" opacity="0.5"/>
  </svg>`
);

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
