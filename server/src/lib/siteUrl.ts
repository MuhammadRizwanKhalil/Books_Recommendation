import { config } from '../config.js';

export function getPrimaryFrontendUrl(): string {
  const rawUrl = config.frontendUrl || 'https://thebooktimes.com';
  const primaryUrl = rawUrl.split(',').map((url) => url.trim()).filter(Boolean)[0] || rawUrl;
  return primaryUrl.replace(/\/+$/, '');
}

export function toAbsoluteSiteUrl(value: string | null | undefined, siteUrl = getPrimaryFrontendUrl()): string {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      const site = new URL(siteUrl);
      if (parsed.origin === site.origin && parsed.pathname.startsWith('/books/')) {
        parsed.pathname = parsed.pathname.replace(/^\/books\//, '/book/');
      }
      return parsed.href;
    } catch {
      return value;
    }
  }
  let normalizedPath = value.startsWith('/') ? value : `/${value}`;
  if (normalizedPath.startsWith('/books/')) {
    normalizedPath = normalizedPath.replace(/^\/books\//, '/book/');
  }
  return `${siteUrl}${normalizedPath}`;
}

export function slugifyPathSegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}