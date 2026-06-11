// No external shadcn/ui dependencies
// Peer dependencies:
//   - useAppStore from this package's lib/store
//   - MoeiHeader, MoeiFooter from this package's components/layouts

import { cn } from '@/lib/utils'
import { useAppStore } from '@/pages/store/app-store'
import { MoeiHeader } from './moei-header'
import { MoeiFooter } from './moei-footer'
import { MoeiCompactFooter } from './moei-compact-footer'

import { NavItem } from './moei-header'

export interface MoeiPageLayoutProps {
  title: { en: string; ar: string }
  onBack?: () => void
  showUaePass?: boolean
  uaePassUser?: { name: string } | null
  onUaePassClick?: () => void
  onLogout?: () => void        // Logout callback passed to header
  headerActions?: React.ReactNode  // Extra actions in the header right side
  children: React.ReactNode
  className?: string
  footerVersion?: string
  contentClassName?: string  // Override content area styling (e.g. max-w-5xl)
  navItems?: NavItem[]       // Navigation links
  activeRoute?: string       // Current active route id
  viewportConstrained?: boolean  // Lock to viewport height (for split-panel layouts like admin)
}

export function MoeiPageLayout({
  title,
  onBack,
  showUaePass = true,
  uaePassUser,
  onUaePassClick,
  onLogout,
  headerActions,
  children,
  className,
  footerVersion,
  contentClassName,
  navItems,
  activeRoute,
  viewportConstrained = false,
}: MoeiPageLayoutProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  return (
    <div className={cn(
      'flex flex-col bg-ae-black-50/30',
      viewportConstrained ? 'h-dvh overflow-hidden' : 'min-h-screen'
    )} dir={isAr ? 'rtl' : 'ltr'}>
      <MoeiHeader
        title={title}
        onBack={onBack}
        showUaePass={showUaePass}
        uaePassUser={uaePassUser}
        onUaePassClick={onUaePassClick}
        onLogout={onLogout}
        actions={headerActions}
        navItems={navItems}
        activeRoute={activeRoute}
      />

      <main className={cn('flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8', contentClassName, className)}>
        {children}
      </main>

      {viewportConstrained ? (
        <MoeiCompactFooter version={footerVersion} />
      ) : (
        <MoeiFooter version={footerVersion} />
      )}
    </div>
  )
}
