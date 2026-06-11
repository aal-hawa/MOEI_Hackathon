import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Fingerprint, Mail, Lock, Loader2, User } from 'lucide-react'
import { useTranslation } from '@/i18n'

interface LoginModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginModal({ open, onOpenChange }: LoginModalProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const [loginMethod, setLoginMethod] = useState<'uaepass' | 'email' | null>(null)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleUAEPassLogin = () => {
    setLoginMethod('uaepass')
    setIsLoading(true)
    
    // Simulate UAE PASS OAuth flow
    setTimeout(() => {
      completeLogin({
        name: 'Ahmed Al Mansoori',
        email: 'ahmed@example.com',
        customerId: 'CUST-' + Math.floor(10000 + Math.random() * 90000)
      })
    }, 1500)
  }

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    
    setLoginMethod('email')
    setIsLoading(true)
    
    // Simulate standard login
    setTimeout(() => {
      completeLogin({
        name: email.split('@')[0],
        email: email,
        customerId: 'CUST-' + Math.floor(10000 + Math.random() * 90000)
      })
    }, 1000)
  }

  const completeLogin = (user: { name: string; email: string; customerId: string }) => {
    try {
      localStorage.setItem('moei-chat-auth', JSON.stringify(user))
      window.dispatchEvent(new Event('storage')) // Trigger standard storage event for cross-component sync
      onOpenChange(false)
      // Reset state after animation completes
      setTimeout(() => {
        setIsLoading(false)
        setLoginMethod(null)
      }, 300)
    } catch (e) {
      console.error('Failed to save auth state', e)
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !isLoading && onOpenChange(val)}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden border-0 shadow-2xl rounded-2xl bg-gradient-to-b from-background to-brand-50/20">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-400 to-brand-600" />
        
        <DialogHeader className="pt-4 pb-2">
          <div className="mx-auto w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center mb-4 border border-brand-200">
            <User className="w-6 h-6 text-brand-600" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">Welcome Back</DialogTitle>
          <DialogDescription className="text-center">
            Sign in to access your dashboard and active cases.
          </DialogDescription>
        </DialogHeader>

        <div className="px-2 pb-6 space-y-6">
          <Button 
            variant="outline" 
            className="w-full h-12 relative overflow-hidden group border-brand-200 hover:border-brand-500 hover:bg-brand-50 transition-all duration-300"
            onClick={handleUAEPassLogin}
            disabled={isLoading}
          >
            {isLoading && loginMethod === 'uaepass' ? (
              <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            ) : (
              <>
                <Fingerprint className="w-5 h-5 text-brand-600 mr-2 group-hover:scale-110 transition-transform" />
                <span className="font-semibold text-foreground">Sign in with UAE PASS</span>
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:translate-x-full duration-1000 ease-in-out" />
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="m.almansoori@example.com" 
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-brand-600 hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 bg-brand-600 hover:bg-brand-700 text-white"
              disabled={isLoading}
            >
              {isLoading && loginMethod === 'email' ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : null}
              {isLoading && loginMethod === 'email' ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
