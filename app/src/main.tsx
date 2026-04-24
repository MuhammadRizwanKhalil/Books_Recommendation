import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/components/ThemeProvider'
import { WishlistProvider } from '@/components/WishlistProvider'
import { AuthProvider } from '@/components/AuthProvider'
import { ReviewProvider } from '@/components/ReviewProvider'
import { SettingsProvider } from '@/components/SettingsProvider'
import { I18nProvider } from '@/lib/i18n'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import './index.css'
import App from './App.tsx'
import { initWebVitals } from './lib/webVitals'
import { isAnalyticsEnabled } from './lib/analytics'

// Existing production GA property used by The Book Times.
const LEGACY_GA_MEASUREMENT_ID = 'G-TDW096P47M';

function normalizeMeasurementId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const id = value.trim().toUpperCase();
  if (!/^G-[A-Z0-9]{6,}$/.test(id)) return null;
  return id;
}

type PublicSetting = { key?: string; value?: string };

async function resolveGoogleAnalyticsId(): Promise<string | null> {
  const fromEnv = normalizeMeasurementId(import.meta.env.VITE_GA_MEASUREMENT_ID);
  if (fromEnv) return fromEnv;

  const apiBase = String(import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
  const settingsUrl = `${apiBase}/settings`;

  try {
    const res = await fetch(settingsUrl, { method: 'GET', credentials: 'omit', cache: 'no-store' });
    if (!res.ok) return null;

    const payload = await res.json() as { settings?: Record<string, PublicSetting[]> };
    const groups = payload.settings || {};

    for (const list of Object.values(groups)) {
      const gaSetting = (list || []).find((item) => item?.key === 'google_analytics_id');
      const fromSetting = normalizeMeasurementId(gaSetting?.value);
      if (fromSetting) return fromSetting;
    }
  } catch {
    // Keep analytics disabled when runtime settings cannot be fetched.
  }

  return normalizeMeasurementId(LEGACY_GA_MEASUREMENT_ID);
}

async function initGoogleAnalytics() {
  if (!isAnalyticsEnabled()) return;

  const measurementId = await resolveGoogleAnalyticsId();
  if (!measurementId) return;

  const existing = document.querySelector('script[data-ga-loader="1"]') as HTMLScriptElement | null;
  if (!existing) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    script.setAttribute('data-ga-loader', '1');
    document.head.appendChild(script);
  }

  const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  win.dataLayer = win.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  win.gtag = function gtag() {
    // gtag.js requires the Arguments object (not a plain array) to process commands correctly.
    // eslint-disable-next-line prefer-rest-params
    (win.dataLayer as unknown[]).push(arguments);
  };

  win.gtag('js', new Date());
  win.gtag('config', measurementId, { send_page_view: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary section="App">
      <BrowserRouter>
        <I18nProvider>
          <ThemeProvider defaultTheme="light" storageKey="thebooktimes-ui-theme">
            <SettingsProvider>
              <AuthProvider>
                <WishlistProvider>
                  <ReviewProvider>
                    <App />
                  </ReviewProvider>
                </WishlistProvider>
              </AuthProvider>
            </SettingsProvider>
          </ThemeProvider>
        </I18nProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)

// Initialize Core Web Vitals monitoring (non-blocking)
initWebVitals()

// Enable GA only in production builds (never in local/dev).
void initGoogleAnalytics()

