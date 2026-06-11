// No external shadcn/ui dependencies
// Peer dependencies:
//   - useAppStore from this package's lib/store

import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'
import { useAppStore } from '@/pages/store/app-store'

interface LanguageToggleProps {
  variant?: 'default' | 'ghost' | 'icon'  // default=rounded pill, ghost=minimal, icon=icon-only
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Language toggle button using Globe icon from lucide-react.
 * UAE DLS-aligned: Uses primary green for active states.
 * Provides EN/AR switching with RTL support.
 */
export function LanguageToggle({ variant = 'default', size = 'md', className }: LanguageToggleProps) {
  const { language, setLanguage } = useAppStore()
  const isAr = language === 'ar'

  const toggleLanguage = () => {
    setLanguage(isAr ? 'en' : 'ar')
  }

  const label = isAr ? 'English' : 'عربي'
  const ariaLabel = isAr ? 'Switch to English' : 'التبديل إلى العربية'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          'flex sm:hidden items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border border-primary/20 hover:bg-primary hover:text-white transition-colors text-primary',
          className
        )}
        aria-label={ariaLabel}
      >
        <Globe className={iconSize} />
      </button>
    )
  }

  if (variant === 'ghost') {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-ae-black-400 hover:text-primary hover:bg-primary/5 transition-colors',
          className
        )}
        aria-label={ariaLabel}
      >
        <Globe className={iconSize} />
        {label}
      </button>
    )
  }

  // variant === 'default' — rounded pill (UAE DLS style)
  return (
    <button
      onClick={toggleLanguage}
      className={cn(
        'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-primary/20 text-primary hover:bg-primary hover:text-white transition-all',
        className
      )}
      aria-label={ariaLabel}
    >
      <Globe className={iconSize} />
      {label}
    </button>
  )
}
