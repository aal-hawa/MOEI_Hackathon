import { useCallback } from 'react'
import { translations, TranslationKey } from './translations'
import { useAppStore } from '@/store/app-store'
import type { Language } from '@/store/app-store'

// RTL languages in our system
const RTL_LANGS: Language[] = ['ar', 'ur']

// ─── Get translations for a language with proper fallback ──────────────────
// For 'en' and 'ar', use the full translations.
// For other languages (fr, pt, es, ur, hi, zh), fall back to English
// (matching MOEI website approach using Google Translate for other languages).

function getTranslationMap(lang: Language): Record<string, string> {
  const langMap = (translations as Record<string, Record<string, string>>)[lang]
  if (langMap && Object.keys(langMap).length > 0) {
    return langMap
  }
  // Fallback to English for languages without full translations
  return translations.en as Record<string, string>
}

// ─── Client-side hook (uses static fallback) ────────────────────────────────

export function useTranslation() {
  const language = useAppStore((s) => s.language)
  // Memoize t function so it only changes when language changes
  // This prevents infinite re-render loops in useEffect dependencies
  const t = useCallback((key: TranslationKey | string): string => {
    const langMap = getTranslationMap(language)
    return langMap[key as string] || translations.en[key as TranslationKey] || key
  }, [language])
  return { t, language, isRTL: RTL_LANGS.includes(language) }
}

// ─── Server-side translation (loads from DB with fallback) ──────────────────

let translationCache: Map<string, Record<string, string>> | null = null
let cacheExpiry = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function loadTranslationsFromDB(): Promise<Map<string, Record<string, string>>> {
  const now = Date.now()
  if (translationCache && now < cacheExpiry) {
    return translationCache
  }

  try {
    const { db } = await import('@/lib/db')
    const rows = await db.translation.findMany()
    const map = new Map<string, Record<string, string>>()
    for (const row of rows) {
      const entry: Record<string, string> = { en: row.en, ar: row.ar }
      map.set(row.key, entry)
    }
    translationCache = map
    cacheExpiry = now + CACHE_TTL
    return map
  } catch {
    // DB not available, use static fallback
    return new Map()
  }
}

export async function getTranslation(key: string, lang: Language = 'en'): Promise<string> {
  const dbTranslations = await loadTranslationsFromDB()
  const dbEntry = dbTranslations.get(key)
  if (dbEntry) {
    return dbEntry[lang] || dbEntry.en || key
  }
  // Fallback to static translations
  const langMap = getTranslationMap(lang)
  return langMap[key] || translations.en[key as TranslationKey] || key
}

// ─── Synchronous fallback ───────────────────────────────────────────────────

export function t(key: TranslationKey, lang: Language = 'en'): string {
  const langMap = getTranslationMap(lang)
  return langMap[key as string] || translations.en[key] || key
}

// ─── API route for frontend to fetch translations ───────────────────────────

export async function getAllTranslationsForAPI(lang: Language = 'en'): Promise<Record<string, string>> {
  const dbTranslations = await loadTranslationsFromDB()
  const result: Record<string, string> = {}

  // Start with static translations as base
  const staticMap = getTranslationMap(lang)
  for (const [key, value] of Object.entries(staticMap)) {
    result[key] = value
  }

  // Override with DB translations (they take priority)
  for (const [key, value] of dbTranslations) {
    result[key] = value[lang] || value.en
  }

  return result
}
