import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { MoeiHeader } from './moei-header'
import { MoeiFooter } from './moei-footer'

export interface MoeiPageLayoutProps {
  title: { en: string; ar: string }
  onBack?: () => void
  showUaePass?: boolean
  uaePassUser?: { name: string } | null
  onUaePassClick?: () => void
  onLogout?: () => void
  headerActions?: React.ReactNode  // Extra actions in the header right side
  children: React.ReactNode
  className?: string
  footerVersion?: string
  contentClassName?: string  // Override content area styling (e.g. max-w-5xl)
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
}: MoeiPageLayoutProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  return (
    <div className="moei-executive-shell min-h-screen flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      <MoeiHeader
        title={title}
        onBack={onBack}
        showUaePass={showUaePass}
        uaePassUser={uaePassUser}
        onUaePassClick={onUaePassClick}
        onLogout={onLogout}
        actions={headerActions}
      />

      <main className={cn('flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8', contentClassName, className)}>
        {children}
      </main>

      <MoeiFooter version={footerVersion} />
    </div>
  )
}
