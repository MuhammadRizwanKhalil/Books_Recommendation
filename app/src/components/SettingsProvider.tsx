import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { settingsApi } from '@/api/client';

// Flat map: key → value
export type SiteSettings = Record<string, string>;

interface SettingsContextType {
  settings: SiteSettings;
  getSetting: (key: string, fallback?: string) => string;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await settingsApi.getPublic();
      // Flatten grouped settings into flat key→value map
      const flat: SiteSettings = {};
      for (const items of Object.values(res.settings)) {
        for (const item of items as any[]) {
          flat[item.key] = item.value;
        }
      }
      setSettings(flat);
    } catch (err) {
      console.warn('Failed to load site settings, using defaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getSetting = (key: string, fallback = '') => settings[key] || fallback;

  // Inject brand colors as CSS custom properties
  useEffect(() => {
    const primary = settings.brand_primary_color;
    if (primary) {
      const hsl = hexToHSL(primary);
      if (hsl) {
        document.documentElement.style.setProperty('--primary', hsl);
      }
    }
  }, [settings.brand_primary_color]);

  // Update document title
  useEffect(() => {
    const name = settings.site_name;
    const tagline = settings.site_tagline;
    if (name) {
      document.title = tagline ? `${name} - ${tagline}` : name;
    }
  }, [settings.site_name, settings.site_tagline]);

  // Update meta description
  useEffect(() => {
    const desc = settings.site_description;
    if (desc) {
      const el = document.querySelector('meta[name="description"]');
      if (el) el.setAttribute('content', desc);
    }
  }, [settings.site_description]);

  // Update favicon
  useEffect(() => {
    const favicon = settings.site_favicon_url;
    if (favicon) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (link) {
        link.href = favicon;
        link.type = 'image/x-icon';
      }
    }
  }, [settings.site_favicon_url]);

  return (
    <SettingsContext.Provider value={{ settings, getSetting, loading, refresh: load }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}

// ── Hex to HSL converter (for CSS custom property injection) ────────────────

function hexToHSL(hex: string): string | null {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  if (hex.length !== 6) return null;

  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}
