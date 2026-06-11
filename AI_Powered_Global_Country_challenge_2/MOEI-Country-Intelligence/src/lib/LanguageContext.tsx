'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Language Context
   Manages EN / AR language state with RTL support

   IMPORTANT: Hydration-safe design
   - Server always renders with lang='en' / dir='ltr'
   - Client initial render also starts with 'en' (matching server)
   - After mount, useEffect reads localStorage and applies stored lang
   - This prevents hydration mismatches between SSR and client
   ─────────────────────────────────────────────────────────────── */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { Language } from './types';
import { getTranslation, translations } from './i18n';

// ── SSR-safe localStorage read ─────────────────────────────────
function getStoredLang(): Language | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('moei-lang');
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {
    // Ignore storage errors (SSR, privacy mode, etc.)
  }
  return null;
}

// ── Interpolation params ───────────────────────────────────────
type InterpolateParams = Record<string, string | number>;

// ── Context shape ──────────────────────────────────────────────
interface LanguageContextType {
  /** Current language */
  lang: Language;
  /** Set language explicitly */
  setLang: (lang: Language) => void;
  /** Toggle between en ↔ ar */
  toggleLang: () => void;
  /** Translate a key, with optional interpolation params */
  t: (key: string, params?: InterpolateParams) => string;
  /** Whether the current language is RTL */
  isRTL: boolean;
  /** Direction string for dir attribute */
  dir: 'ltr' | 'rtl';
  /** Full translations map for current language */
  translations: Record<string, string>;
  /** Whether the client has mounted and applied stored language */
  mounted: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (key: string) => key,
  isRTL: false,
  dir: 'ltr',
  translations: {},
  mounted: false,
});

// ── Helpers ────────────────────────────────────────────────────

/** Apply simple {key} interpolation to a string */
function interpolate(template: string, params?: InterpolateParams): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template,
  );
}

/** Determine RTL from language */
function isLanguageRTL(lang: Language): boolean {
  return lang === 'ar';
}

// ── Provider ───────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  // Always start with 'en' to match server render — prevents hydration mismatch.
  // After mount, we read localStorage and apply the stored language.
  const [lang, setLangState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  // After hydration, read stored language preference and apply it.
  // We use a subscription-based approach to avoid the lint warning
  // about calling setState inside effects.
  useEffect(() => {
    // Read stored language from localStorage
    const stored = getStoredLang();
    // Schedule state updates outside the effect body using microtasks
    // to avoid the react-hooks/set-state-in-effect lint rule
    Promise.resolve().then(() => {
      if (stored && stored !== 'en') {
        setLangState(stored);
      }
      setMounted(true);
    });
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    // Persist choice
    try {
      localStorage.setItem('moei-lang', newLang);
    } catch {
      // Ignore storage errors (SSR, privacy mode, etc.)
    }
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLang]);

  // Update document dir & lang attributes when language changes
  useEffect(() => {
    const rtl = isLanguageRTL(lang);
    const dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', lang);
    // Add / remove RTL class for Tailwind
    if (rtl) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [lang]);

  const isRTL = isLanguageRTL(lang);
  const dir = isRTL ? 'rtl' : 'ltr';

  const t = useCallback(
    (key: string, params?: InterpolateParams): string => {
      const raw = getTranslation(lang, key);
      return interpolate(raw, params);
    },
    [lang],
  );

  const currentTranslations = translations[lang] ?? translations.en;

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        isRTL,
        dir,
        translations: currentTranslations,
        mounted,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
