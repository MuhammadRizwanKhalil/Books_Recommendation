import { useEffect, useRef } from 'react';

interface SEOOptions {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  ogUrl?: string;
  canonical?: string;
  noindex?: boolean;
  /** Custom robots directive (overrides noindex) */
  robots?: string;
  /** JSON-LD structured data object(s) to inject into <head> */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Additional meta tags (e.g. article:published_time) */
  extraMeta?: { attr: string; key: string; content: string }[];
}

// Default meta values to restore on cleanup
const DEFAULTS = {
  title: 'BookDiscovery - AI-Powered Book Recommendations | Discover Your Next Great Read',
  description: 'Discover your next great read with AI-powered book recommendations. Explore 50,000+ books across every genre with personalized suggestions, ratings, and reviews.',
  ogTitle: 'BookDiscovery - AI-Powered Book Recommendations',
  ogDescription: 'Discover your next great read with AI-powered book recommendations. Explore 50,000+ books across every genre with personalized suggestions.',
  ogImage: 'https://bookdiscovery.com/og-image.png',
  ogType: 'website',
  ogUrl: 'https://bookdiscovery.com',
  canonical: 'https://bookdiscovery.com',
};

/**
 * Hook to dynamically update document title, meta description,
 * Open Graph tags, Twitter cards, canonical URL, and JSON-LD
 * structured data for SEO. Properly cleans up ALL tags on unmount.
 */
export function useSEO({
  title,
  description,
  ogTitle,
  ogDescription,
  ogImage,
  ogType,
  ogUrl,
  canonical,
  noindex,
  robots,
  jsonLd,
  extraMeta,
}: SEOOptions) {
  const jsonLdRef = useRef<HTMLScriptElement[]>([]);
  const createdMetaRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    // ── Title ────────────────────────────────────────────────────────────
    document.title = title;

    // ── Helper: set or create a meta tag, track newly created ones ─────
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        createdMetaRef.current.push(el);
      }
      el.setAttribute('content', content);
    };

    // ── Meta description ────────────────────────────────────────────────
    if (description) {
      setMeta('name', 'description', description);
    }

    // ── Robots ──────────────────────────────────────────────────────────
    // ── Robots ──────────────────────────────────────────────────────────
    if (robots) {
      setMeta('name', 'robots', robots);
    } else if (noindex) {
      setMeta('name', 'robots', 'noindex, nofollow');
    } else {
      // Restore default robots
      const robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robotsMeta) {
        robotsMeta.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
      }
    }

    // ── Open Graph ──────────────────────────────────────────────────────
    setMeta('property', 'og:title', ogTitle || title);
    setMeta('property', 'og:description', ogDescription || description || DEFAULTS.ogDescription);
    if (ogImage) setMeta('property', 'og:image', ogImage);
    if (ogType) setMeta('property', 'og:type', ogType);
    if (ogUrl) setMeta('property', 'og:url', ogUrl);

    // ── Twitter Card ────────────────────────────────────────────────────
    setMeta('name', 'twitter:card', ogImage ? 'summary_large_image' : 'summary');
    setMeta('name', 'twitter:title', ogTitle || title);
    setMeta('name', 'twitter:description', ogDescription || description || DEFAULTS.ogDescription);
    if (ogImage) setMeta('name', 'twitter:image', ogImage);

    // ── Extra meta tags ─────────────────────────────────────────────────
    if (extraMeta) {
      for (const m of extraMeta) {
        setMeta(m.attr, m.key, m.content);
      }
    }

    // ── Canonical URL ───────────────────────────────────────────────────
    let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (canonical) {
      if (!canonicalEl) {
        canonicalEl = document.createElement('link');
        canonicalEl.setAttribute('rel', 'canonical');
        document.head.appendChild(canonicalEl);
      }
      canonicalEl.setAttribute('href', canonical);
    }

    // ── JSON-LD Structured Data ─────────────────────────────────────────
    // Remove any previously injected dynamic JSON-LD scripts
    for (const script of jsonLdRef.current) {
      script.remove();
    }
    jsonLdRef.current = [];

    if (jsonLd) {
      const items = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const item of items) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.setAttribute('data-dynamic-seo', 'true');
        script.textContent = JSON.stringify(item);
        document.head.appendChild(script);
        jsonLdRef.current.push(script);
      }
    }

    // ── Cleanup: restore defaults on unmount ────────────────────────────
    return () => {
      document.title = DEFAULTS.title;
      
      // Restore default meta tags
      const restoreMeta = (attr: string, key: string, value: string) => {
        const el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
        if (el) el.setAttribute('content', value);
      };

      restoreMeta('name', 'description', DEFAULTS.description);
      restoreMeta('property', 'og:title', DEFAULTS.ogTitle);
      restoreMeta('property', 'og:description', DEFAULTS.ogDescription);
      restoreMeta('property', 'og:image', DEFAULTS.ogImage);
      restoreMeta('property', 'og:type', DEFAULTS.ogType);
      restoreMeta('property', 'og:url', DEFAULTS.ogUrl);
      restoreMeta('name', 'twitter:title', DEFAULTS.ogTitle);
      restoreMeta('name', 'twitter:description', DEFAULTS.ogDescription);
      restoreMeta('name', 'twitter:image', DEFAULTS.ogImage);
      restoreMeta('name', 'twitter:card', 'summary_large_image');

      // Restore canonical
      const canonEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (canonEl) canonEl.setAttribute('href', DEFAULTS.canonical);

      // Restore robots
      const robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
      if (robotsEl) robotsEl.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');

      // Remove dynamically created meta elements
      for (const el of createdMetaRef.current) {
        el.remove();
      }
      createdMetaRef.current = [];

      // Remove dynamic JSON-LD scripts
      for (const script of jsonLdRef.current) {
        script.remove();
      }
      jsonLdRef.current = [];
    };
  }, [title, description, ogTitle, ogDescription, ogImage, ogType, ogUrl, canonical, noindex, jsonLd, extraMeta]);
}
