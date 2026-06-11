import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'
import { useAppStore } from '@/lib/store'

interface LanguageToggleProps {
  variant?: 'default' | 'ghost' | 'icon'  // default=rounded pill, ghost=minimal, icon=icon-only
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Language toggle button using Globe icon from lucide-react.
 * Extracted from index.tsx (desktop + mobile), admin.tsx (sidebar), admin-login.tsx.
 *
 * variant=default: Rounded pill with border (landing page header desktop)
 * variant=ghost: Minimal text+icon (admin-login footer)
 * variant=icon: Icon-only circle (landing page header mobile)
 */
export function LanguageToggle({ variant = 'default', size = 'md', className }: LanguageToggleProps) {
  const { language, setLanguage } = useAppStore()
  const isAr = language === 'ar'

  const toggleLanguage = () => {
    setLanguage(isAr ? 'en' : 'ar')
  }

  const label = isAr ? 'EN' : 'عربي'
  const ariaLabel = isAr ? 'Switch to English' : 'التبديل إلى العربية'
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5'

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleLanguage}
        className={cn(
          'flex sm:hidden items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm bg-white',
          className
        )}
        aria-label="Switch language"
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
          'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium hover:bg-muted transition-colors',
          className
        )}
        aria-label={ariaLabel}
      >
        <Globe className={iconSize} />
        {label}
      </button>
    )
  }

  // variant === 'default' — rounded pill (landing page header desktop style)
  return (
    <button
      onClick={toggleLanguage}
      className={cn(
        'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-200 hover:border-ae-green-500 hover:text-ae-green-600 transition-all shadow-sm bg-white',
        className
      )}
      aria-label={ariaLabel}
    >
      <Globe className={iconSize} />
      {label}
    </button>
  )
}
