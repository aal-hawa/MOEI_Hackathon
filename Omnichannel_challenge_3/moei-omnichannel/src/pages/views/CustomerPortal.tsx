'use client'

import CustomerPortal from '@/components/portal/customer-portal'
import AIChatWidget from '@/components/chat/ai-chat-widget'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'

export default function CustomerPortalPage() {
  const { language } = useAppStore()
  const { isRTL } = useTranslation()
  useRealtime()

  return (
    <div className={`min-h-screen flex flex-col bg-background ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Main Content - CustomerPortal has MoeiPageLayout with its own header */}
      <main className="flex-1">
        <CustomerPortal />
      </main>

      {/* AI Chat Widget */}
      <AIChatWidget />
    </div>
  )
}
