const DEFAULT_PRODUCTION_DOMAINS = ['thebooktimes.com'];

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, '');
}

function parseAllowedDomains(): string[] {
  const raw = String(import.meta.env.VITE_ANALYTICS_ALLOWED_HOSTS || '').trim();
  if (!raw) return DEFAULT_PRODUCTION_DOMAINS;

  const parsed = raw
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean);

  return parsed.length > 0 ? parsed : DEFAULT_PRODUCTION_DOMAINS;
}

const ALLOWED_PRODUCTION_DOMAINS = parseAllowedDomains();

function hasAnalyticsOptOut(): boolean {
  if (typeof window === 'undefined') return false;

  const nav = navigator as Navigator & { doNotTrack?: string | null; msDoNotTrack?: string | null };
  const w = window as Window & { doNotTrack?: string | null };
  const dnt = nav.doNotTrack || w.doNotTrack || nav.msDoNotTrack;
  if (dnt === '1' || dnt === 'yes') return true;

  try {
    const localValue = window.localStorage.getItem('disable_analytics');
    if (localValue === '1' || localValue === 'true') return true;
  } catch {
    // Ignore storage access failures in locked-down browser contexts.
  }

  return document.cookie.includes('disable_analytics=1');
}

function isForceEnabled(): boolean {
  return String(import.meta.env.VITE_ENABLE_ANALYTICS || '').toLowerCase() === 'true';
}

export function isRealProductionHost(hostname: string): boolean {
  const host = normalizeHost(hostname);
  return ALLOWED_PRODUCTION_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isAnalyticsEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  // Allow local verification with a production build by setting VITE_ENABLE_ANALYTICS=true.
  if (!import.meta.env.PROD && !isForceEnabled()) return false;

  // Prevent analytics emission during browser automation runs (Playwright/CI/local e2e).
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  if (hasAnalyticsOptOut()) return false;

  if (isForceEnabled()) return true;

  return isRealProductionHost(window.location.hostname);
}
