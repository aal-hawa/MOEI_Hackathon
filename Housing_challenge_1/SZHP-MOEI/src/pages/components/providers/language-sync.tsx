import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'

export function LanguageSync() {
  const { language } = useAppStore()
  
  useEffect(() => {
    const html = document.documentElement
    html.lang = language
    html.dir = language === 'ar' ? 'rtl' : 'ltr'
  }, [language])
  
  return null
}
