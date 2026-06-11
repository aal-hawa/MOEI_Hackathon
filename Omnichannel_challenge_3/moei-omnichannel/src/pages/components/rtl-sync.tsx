'use client'

import { useEffect } from 'react'
import { useAppStore, RTL_LANGUAGES } from '@/store/app-store'

/**
 * Syncs the <html> element's `dir` and `lang` attributes with the
 * current language stored in Zustand.  This ensures proper RTL rendering
 * for Arabic and Urdu across the entire document (scrollbar position, text-align,
 * etc.) rather than relying solely on component-level `dir` attributes.
 */
export default function RTLSync() {
  const language = useAppStore((s) => s.language)

  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('dir', RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr')
    html.setAttribute('lang', language)
  }, [language])

  return null
}
