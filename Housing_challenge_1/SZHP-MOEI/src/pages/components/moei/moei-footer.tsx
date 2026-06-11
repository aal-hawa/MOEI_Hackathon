import { Shield } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { MOEI_GOLD, MOEI_GOLD_DARK, MOEI_GREEN } from '@/lib/constants'

export interface MoeiFooterProps {
  version?: string
  className?: string
}

export function MoeiFooter({ version = 'v3.0', className }: MoeiFooterProps) {
  const { language } = useAppStore()

  return (
    <footer className={cn('border-t border-[#E9DFC2] bg-white mt-auto shadow-[0_-12px_36px_rgba(66,48,17,0.04)]', className)}>
      <div
        className="px-4 sm:px-6 py-2.5 flex items-center justify-center gap-2 border-b border-[#E9DFC2]"
        style={{ background: `linear-gradient(90deg, #FFFFFF, #FBF4DE, #FFFFFF)` }}
      >
        <p className="text-[10px] sm:text-xs text-center font-bold" style={{ color: MOEI_GREEN }}>
          © {new Date().getFullYear()} {t('moei.header.ministry', language)} — {t('moei.footer.rights', language)}
        </p>
      </div>
      <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-[#806223]">
        <div className="flex items-center gap-4">
          <span className="hover:text-[#006B5A] cursor-pointer">{t('moei.footer.terms', language)}</span>
          <span className="hover:text-[#006B5A] cursor-pointer">{t('moei.footer.privacy', language)}</span>
          <span className="hover:text-[#006B5A] cursor-pointer">{t('moei.footer.contact', language)}</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" style={{ color: MOEI_GOLD_DARK }} />
          <span>{t('moei.header.gov', language)}</span>
          <span className="opacity-40">|</span>
          <span style={{ color: MOEI_GOLD }}>{version}</span>
        </div>
      </div>
    </footer>
  )
}
