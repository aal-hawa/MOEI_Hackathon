'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { ArrowLeft, MessageSquare, Mail, Phone, Loader2, LogOut } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/components/shared/lib/auth-store'
import { UAEPassLoginDialog } from '@/components/shared/ui/uaepass-login-dialog'
import { type MockUserProfile } from '@/components/shared/lib/uaepass-mock'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const AUTH_STORAGE_KEY = 'moei-chat-auth'

// Dynamic import to avoid SSR issues and catch errors
const ChatPage = dynamic(
  () => import('@/pages/whatsapp/ChatPage').then((mod) => mod.ChatPage),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-[#111b21]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#25D366] animate-spin mx-auto mb-3" />
          <p className="text-[#8696a0] text-sm">Loading WhatsApp...</p>
        </div>
      </div>
    ),
  }
)

export default function WhatsAppView() {
  const { setPageView } = useAppStore()
  const { isAuthenticated: zustandAuth, userProfile } = useAuthStore()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)

  // Check auth from BOTH Zustand store AND localStorage (same logic as customer-portal)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
  // Handle login from the UAE PASS dialog — sync both auth systems
  const handleLogin = useCallback((profile: MockUserProfile) => {
    // 1. Update localStorage (moei-chat-auth)
    const auth = {
      name: profile.fullnameEN,
      email: profile.email || `${profile.idn}@example.com`,
      customerId: profile.idn,
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
    
    // 2. Sync to the Zustand auth store (used by other components)
    try {
      useAuthStore.getState().loginWithMockUser(profile)
    } catch (e) {
      console.warn('Failed to sync auth to Zustand store:', e)
    }
    
    // 3. Dispatch storage event so other tabs/components pick it up
    window.dispatchEvent(new Event('storage'))
  }, [])
  
  useEffect(() => {
    const checkAuth = () => {
      try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY)
        if (raw) {
          const auth = JSON.parse(raw)
          if (auth && auth.name) {
            setIsAuthenticated(true)
            return
          }
        }
      } catch { /* ignore */ }
      
      if (zustandAuth && userProfile) {
        setIsAuthenticated(true)
        return
      }
      
      setIsAuthenticated(false)
    }
    checkAuth()
    window.addEventListener('storage', checkAuth)
    const interval = setInterval(checkAuth, 2000)
    return () => {
      window.removeEventListener('storage', checkAuth)
      clearInterval(interval)
    }
  }, [zustandAuth, userProfile])

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-[#111b21] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#202c33]">
          <button
            onClick={() => setPageView('customer')}
            className="flex items-center gap-2 text-[#aebac1] hover:text-white transition-colors text-sm font-medium bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Portal
          </button>
          <span className="text-[#e9edef] font-medium text-sm">WhatsApp</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-[#25D366]/20 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-[#25D366]" />
            </div>
            <h3 className="text-lg font-semibold text-[#e9edef] mb-2">Login Required</h3>
            <p className="text-sm text-[#8696a0] mb-4">Login with UAE PASS to access WhatsApp messaging</p>
            <Button onClick={() => setLoginDialogOpen(true)} className="bg-[#25D366] hover:bg-[#1ebe57] text-white">
              Login with UAE PASS
            </Button>
          </div>
        </div>
        <UAEPassLoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} onLogin={handleLogin} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#111b21] flex flex-col">
      {/* Top bar with navigation */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-[#202c33] border-b border-[#2a3942]">
        <button
          onClick={() => setPageView('customer')}
          className="flex items-center gap-1.5 text-[#aebac1] hover:text-white transition-colors text-xs font-medium bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1.5 rounded-full"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Portal
        </button>
        <div className="flex-1" />
        <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 text-[10px] hover:bg-[#25D366]/20">
          {userProfile?.fullnameEN || 'User'}
        </Badge>
        <button
          onClick={() => useAuthStore.getState().logout()}
          className="flex items-center gap-1.5 text-[#E04E48] hover:text-white transition-colors text-xs bg-white/[0.06] hover:bg-[#E04E48]/30 px-2.5 py-1.5 rounded-full"
          title="Log out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPageView('email')}
          className="flex items-center gap-1.5 text-[#aebac1] hover:text-white transition-colors text-xs bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1.5 rounded-full"
          title="Switch to Email"
        >
          <Mail className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPageView('voice-call')}
          className="flex items-center gap-1.5 text-[#aebac1] hover:text-white transition-colors text-xs bg-white/[0.06] hover:bg-white/[0.12] px-2.5 py-1.5 rounded-full"
          title="Switch to Call"
        >
          <Phone className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* WhatsApp ChatPage fills remaining space */}
      <div className="flex-1 overflow-hidden">
        <ChatPage />
      </div>
    </div>
  )
}
