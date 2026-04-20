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

function initGoogleAnalytics() {
  if (!isAnalyticsEnabled()) return;

  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-TDW096P47M';
  if (!measurementId) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  const win = window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
  win.dataLayer = win.dataLayer || [];
  win.gtag = (...args: unknown[]) => {
    win.dataLayer!.push(args);
  };

  win.gtag('js', new Date());
  win.gtag('config', measurementId);
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
initGoogleAnalytics()

