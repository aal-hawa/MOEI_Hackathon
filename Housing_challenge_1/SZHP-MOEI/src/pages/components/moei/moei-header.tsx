import { useEffect, useState } from 'react'
import {
  Globe,
  Building2,
  Shield,
  Fingerprint,
  Home,
  LogOut,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { MOEI_GOLD, MOEI_GOLD_DARK, MOEI_GREEN } from '@/lib/constants'

export interface MoeiHeaderProps {
  title: { en: string; ar: string }
  onBack?: () => void
  showUaePass?: boolean
  uaePassUser?: { name: string } | null
  onUaePassClick?: () => void
  onLogout?: () => void
  actions?: React.ReactNode  // Extra actions in the right side of header bar
}

export function MoeiHeader({
  title,
  onBack,
  showUaePass = true,
  uaePassUser,
  onUaePassClick,
  onLogout,
  actions,
}: MoeiHeaderProps) {
  const { language, setLanguage } = useAppStore()
  const isAr = language === 'ar'
  const [plainWhiteBg, setPlainWhiteBg] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('moei-background-mode') === 'white'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('moei-white-bg', plainWhiteBg)
    window.localStorage.setItem('moei-background-mode', plainWhiteBg ? 'white' : 'executive')
  }, [plainWhiteBg])

  return (
    <header className="sticky top-0 z-50 border-b border-[#E9DFC2] bg-white/95 shadow-[0_18px_44px_rgba(66,48,17,0.08)] backdrop-blur-xl">
      {/* Top bar */}
      <div
        className="px-4 sm:px-6 py-2 text-[10px] sm:text-xs flex items-center justify-between border-b"
        style={{
          background: 'linear-gradient(90deg, #FBF8EF 0%, #FFFFFF 44%, #F7EFD7 100%)',
          borderColor: '#E9DFC2',
          color: MOEI_GREEN,
        }}
      >
        <div className="flex items-center gap-3 font-semibold">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3 h-3" />
            {t('moei.header.gov', language)}
          </span>
          <span className="hidden sm:inline h-3 w-px bg-[#D7C58F]" />
          <span className="hidden sm:inline text-[#8F6B22]">{t('moei.header.szhp', language)}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPlainWhiteBg((value) => !value)}
            className="flex items-center gap-1 px-3 py-1 rounded-full border border-[#D9C176] bg-white text-[#006B5A] hover:bg-[#FFFFFF] hover:shadow-sm transition-all text-[10px] sm:text-xs font-bold"
            title={isAr ? 'تبديل الخلفية البيضاء' : 'Toggle white background'}
          >
            {plainWhiteBg ? (isAr ? 'ذهبي' : 'Gold') : (isAr ? 'أبيض' : 'White')}
          </button>
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="flex items-center gap-1 px-3 py-1 rounded-full border border-[#D9C176] bg-white/70 text-[#006B5A] hover:bg-[#FBF4DE] transition-colors text-[10px] sm:text-xs font-bold"
          >
            <Globe className="w-3 h-3" />
            {isAr ? 'EN' : 'عربي'}
          </button>
        </div>
      </div>

      {/* Main header bar */}
      <div
        className="px-4 sm:px-6 py-4 flex items-center justify-between relative overflow-hidden"
        style={{ background: '#FFFFFF' }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ background: `linear-gradient(90deg, ${MOEI_GREEN}, ${MOEI_GOLD}, ${MOEI_GOLD_DARK})` }}
        />
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Back button */}
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-[#006B5A] hover:text-[#004D40] hover:bg-[#EFF6F1] rounded-lg px-2 font-bold"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline ms-1">{t('form.backToHome', language)}</span>
            </Button>
          )}
        </div>

        {/* Ministry Branding */}
        <div className="flex-1 text-center">
          <h1 className="font-extrabold text-sm sm:text-lg leading-tight" style={{ color: MOEI_GREEN }}>
            {t('moei.header.ministry', language)}
          </h1>
          <p className="text-[#8F6B22] text-[9px] sm:text-xs mt-0.5 font-semibold">
            {t('moei.header.service', language)}
          </p>
        </div>

        {/* Right side - UAE PASS status */}
        <div className="flex items-center gap-2">
          {actions}
          {showUaePass && (
            <>
              {uaePassUser ? (
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border border-[#C9A84C]/45 bg-[#FBF8EF] shadow-sm">
                  <Fingerprint className="w-4 h-4" style={{ color: MOEI_GREEN }} />
                  <span className="text-[#174236] text-xs font-bold hidden sm:inline">
                    {uaePassUser.name}
                  </span>
                  {onLogout && (
                    <button
                      onClick={onLogout}
                      className="flex items-center justify-center w-5 h-5 rounded-full bg-[#006B5A]/10 hover:bg-[#006B5A]/20 transition-colors ms-1"
                      title={isAr ? 'تسجيل الخروج' : 'Logout'}
                    >
                      <LogOut className="w-3 h-3" style={{ color: MOEI_GREEN }} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#8F6B22] text-xs font-semibold">
                  <Building2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('moei.header.szhp', language)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  )
}
