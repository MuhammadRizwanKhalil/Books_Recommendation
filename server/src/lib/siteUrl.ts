import { config } from '../config.js';

export function getPrimaryFrontendUrl(): string {
  const rawUrl = config.frontendUrl || 'https://thebooktimes.com';
  const primaryUrl = rawUrl.split(',').map((url) => url.trim()).filter(Boolean)[0] || rawUrl;
  return primaryUrl.replace(/\/+$/, '');
}

export function toAbsoluteSiteUrl(value: string | null | undefined, siteUrl = getPrimaryFrontendUrl()): string {
  if (!value) return siteUrl;
  if (/^https?:\/\//i.test(value)) return value;
  const normalizedPath = value.startsWith('/') ? value : `/${value}`;
  return `${siteUrl}${normalizedPath}`;
}

export function slugifyPathSegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}