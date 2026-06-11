'use client'

import { useEffect } from 'react'
import { Phone } from 'lucide-react'
import CustomerPortal from '@/components/portal/customer-portal'
import AIChatWidget from '@/components/chat/ai-chat-widget'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'

export default function CustomerPortalPage() {
  const { language, customerContext, setCustomerContext, setPageView } = useAppStore()
  const { t, isRTL } = useTranslation()
  useRealtime()

  // Restore customer context from chat widget auth (localStorage)
  useEffect(() => {
    if (customerContext) return
    try {
      const raw = localStorage.getItem('moei-chat-auth')
      if (!raw) return
      const auth = JSON.parse(raw)
      if (auth && auth.customerId && auth.name) {
        setCustomerContext({
          id: auth.customerId,
          name: auth.name,
          email: auth.email,
          preferredLang: language,
          preferredChannel: 'web',
          sentiment: 0.5,
          activeCases: 0,
        })
      }
    } catch {
      // localStorage may be unavailable or data corrupt
    }
  }, [customerContext, setCustomerContext, language])

  return (
    <div className={`min-h-screen flex flex-col bg-background ${isRTL ? 'font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Main Content - CustomerPortal has MoeiPageLayout with its own header */}
      <main className="flex-1">
        <CustomerPortal />
      </main>

      {/* Floating Call Button */}
      <button
        onClick={() => setPageView('voice-call')}
        className={`fixed bottom-24 ${isRTL ? 'left-6' : 'right-6'} z-40 flex items-center gap-2 px-4 py-3 bg-[#34C759] hover:bg-[#2db84e] text-white rounded-full shadow-lg shadow-[#34C759]/30 transition-all hover:scale-105 active:scale-95`}
      >
        <Phone className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Call Us</span>
      </button>

      {/* AI Chat Widget */}
      <AIChatWidget />
    </div>
  )
}
