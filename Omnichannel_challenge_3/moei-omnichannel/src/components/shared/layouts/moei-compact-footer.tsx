// Compact footer for viewport-constrained layouts (admin/agent dashboard)
// Matches the MOEI footer design in compact form

import { Shield } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t } from '@/pages/i18n'

export interface MoeiCompactFooterProps {
  version?: string
  className?: string
}

export function MoeiCompactFooter({ version = 'v3.0', className }: MoeiCompactFooterProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  return (
    <footer className={cn('shrink-0 mt-auto bg-white border-t border-[#E1E3E5]', className)}>
      {/* Gold accent line at top */}
      <div className="h-[2px] bg-gradient-to-r from-[#C4A35A] via-[#92722A] to-[#C4A35A]" />

      {/* Slim bar */}
      <div className="px-4 py-1.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 text-[10px] text-[#5C5C5C]">
          <Shield className="w-3 h-3 text-[#92722A] shrink-0" />
          <span className="hidden sm:inline">{t('uaeGovernmentSeal', language)}</span>
          <span className="sm:hidden">MOEI</span>
          <span className="text-[#E1E3E5]">|</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#5C5C5C]">
          <span className="hidden sm:inline">{t('footerRights', language)}</span>
          <span className="text-[#92722A] font-medium">{version}</span>
        </div>
      </div>
    </footer>
  )
}
