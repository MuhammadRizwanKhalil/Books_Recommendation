const PRODUCTION_HOSTS = new Set(['thebooktimes.com', 'www.thebooktimes.com']);

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

export function isRealProductionHost(hostname: string): boolean {
  return PRODUCTION_HOSTS.has(hostname.toLowerCase());
}

export function isAnalyticsEnabled(): boolean {
  if (!import.meta.env.PROD) return false;

  // Prevent analytics emission during browser automation runs (Playwright/CI/local e2e).
  if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
  if (hasAnalyticsOptOut()) return false;

  if (typeof window === 'undefined') return false;
  return isRealProductionHost(window.location.hostname);
}
