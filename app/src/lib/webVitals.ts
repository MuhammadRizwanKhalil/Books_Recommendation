/**
 * Core Web Vitals Monitoring
 * 
 * Tracks all Web Vitals metrics:
 * - CLS  (Cumulative Layout Shift)
 * - FCP  (First Contentful Paint)
 * - FID  (First Input Delay) — deprecated, replaced by INP
 * - INP  (Interaction to Next Paint)
 * - LCP  (Largest Contentful Paint)
 * - TTFB (Time to First Byte)
 * 
 * Reports to console in development, can be sent to analytics in production.
 */

import type { Metric } from 'web-vitals';

const VITALS_ENDPOINT = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/analytics/web-vitals`
  : null;

function sendToAnalytics(metric: Metric) {
  const data = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,    // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
    url: window.location.pathname,
    timestamp: Date.now(),
  };

  // In development, log to console
  if (import.meta.env.DEV) {
    const color = metric.rating === 'good' ? '#0cce6b' 
      : metric.rating === 'needs-improvement' ? '#ffa400' 
      : '#ff4e42';
    console.log(
      `%c[Web Vital] ${metric.name}: ${Math.round(metric.value)}ms (${metric.rating})`,
      `color: ${color}; font-weight: bold;`
    );
    return;
  }

  // In production, send via beacon (non-blocking)
  if (VITALS_ENDPOINT && navigator.sendBeacon) {
    navigator.sendBeacon(
      VITALS_ENDPOINT,
      new Blob([JSON.stringify(data)], { type: 'application/json' })
    );
  }
}

/**
 * Initialize Web Vitals monitoring.
 * Call once in main.tsx after app renders.
 */
export function initWebVitals() {
  // Dynamic import to avoid adding to the critical path
  import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onINP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
  });
}
