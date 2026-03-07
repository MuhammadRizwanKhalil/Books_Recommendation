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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary section="App">
      <BrowserRouter>
        <I18nProvider>
          <ThemeProvider defaultTheme="system" storageKey="bookdiscovery-ui-theme">
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

