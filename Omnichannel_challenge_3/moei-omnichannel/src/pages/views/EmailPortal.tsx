'use client'

import { useEffect, useState, Suspense } from 'react'
import { ArrowLeft, Mail, MessageSquare, Phone, Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/components/shared/lib/auth-store'
import { UAEPassLoginDialog } from '@/components/shared/ui/uaepass-login-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const AUTH_STORAGE_KEY = 'moei-chat-auth'

// Dynamic import to avoid SSR issues
const EmailPage = dynamic(
  () => import('@/pages/email/EmailPage').then((mod) => mod.EmailPage),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-rose-600 animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Loading Email...</p>
        </div>
      </div>
    ),
  }
)

export default function EmailPortalView() {
  const { setPageView } = useAppStore()
  const { isAuthenticated: zustandAuth, userProfile } = useAuthStore()
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  
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
      <div className="fixed inset-0 bg-background flex flex-col">
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-background">
          <button
            onClick={() => setPageView('customer')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Portal
          </button>
          <span className="text-foreground font-medium text-sm">Email</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Login Required</h3>
            <p className="text-sm text-muted-foreground mb-4">Login with UAE PASS to access Email</p>
            <Button onClick={() => setLoginDialogOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white">
              Login with UAE PASS
            </Button>
          </div>
        </div>
        <UAEPassLoginDialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-background">
        <button
          onClick={() => setPageView('customer')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs font-medium bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-full"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Portal
        </button>
        <div className="flex-1" />
        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-700 text-[10px] hover:bg-rose-100">
          {userProfile?.fullnameEN || 'User'}
        </Badge>
        <button
          onClick={() => setPageView('whatsapp')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-full"
          title="Switch to WhatsApp"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPageView('voice-call')}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs bg-muted/50 hover:bg-muted px-2.5 py-1.5 rounded-full"
          title="Switch to Call"
        >
          <Phone className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <EmailPage />
      </div>
    </div>
  )
}
