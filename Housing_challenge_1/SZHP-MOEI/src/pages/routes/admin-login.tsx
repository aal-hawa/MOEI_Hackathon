
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/auth-store'
import { useAppStore } from '@/lib/store'
import { t } from '@/lib/i18n'
import { motion } from 'framer-motion'
import { Shield, Lock, Eye, EyeOff, ShieldCheck, LogIn, AlertCircle, Sparkles, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { apiFetch } from '@/lib/utils'
import { LanguageToggle, OnlineBadge } from '@/components/shared'

export default function AdminLoginPage() {
  const { loginWithAdminCredentials } = useAuthStore()
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // Seed default admin user on first load so demo credentials work
  // Retry up to 3 times with delay (handles cold-start 404 when Turbopack hasn't compiled routes yet)
  useEffect(() => {
    let attempts = 0
    const maxAttempts = 3
    const trySeed = () => {
      apiFetch('/api/auth/seed-admin', { method: 'POST' })
        .then(res => {
          if (res.ok) return
          if (res.status === 404 && attempts < maxAttempts) {
            attempts++
            setTimeout(trySeed, 2000 * attempts) // Increasing delay: 2s, 4s, 6s
          }
        })
        .catch(() => {
          if (attempts < maxAttempts) {
            attempts++
            setTimeout(trySeed, 2000 * attempts)
          }
        })
    }
    trySeed()
  }, [])

  const handleLogin = async () => {
    setError('')
    if (!email || !password) {
      setError(isAr ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter your email and password')
      return
    }
    setIsLoading(true)
    try {
      // Retry logic for cold-start 404 (Turbopack may not have compiled the route yet)
      let res: Response | null = null
      let lastError = ''
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          res = await apiFetch('/api/auth/admin-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          if (res.status !== 404) break // Got a real response (success or auth error)
          // 404 means route not compiled yet — wait and retry
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        } catch (fetchErr) {
          lastError = fetchErr instanceof Error ? fetchErr.message : 'Network error'
          await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
      if (!res) {
        setError(t('login.admin.invalidCredentials', language))
        setIsLoading(false)
        return
      }
      const data = await res.json()
      if (data.accessToken && data.user) {
        loginWithAdminCredentials({ user: data.user, accessToken: data.accessToken })
        navigate('/admin')
      } else {
        if (data.error?.includes('locked')) {
          setError(t('login.admin.accountLocked', language))
        } else if (data.error?.includes('inactive')) {
          setError(t('login.admin.accountInactive', language))
        } else {
          setError(t('login.admin.invalidCredentials', language))
        }
      }
    } catch {
      setError(t('login.admin.invalidCredentials', language))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  // Security features for the left panel
  const securityFeatures = [
    {
      icon: Shield,
      titleEn: 'Role-Based Access Control',
      titleAr: 'التحكم في الوصول حسب الدور',
      descEn: 'Permissions tailored to each staff role',
      descAr: 'صلاحيات مصممة لكل دور وظيفي',
    },
    {
      icon: Lock,
      titleEn: 'Encrypted Sessions',
      titleAr: 'جلسات مشفرة',
      descEn: 'End-to-end encryption for all data',
      descAr: 'تشفير شامل لجميع البيانات',
    },
    {
      icon: AlertCircle,
      titleEn: 'Full Audit Trail',
      titleAr: 'سجل تدقيق كامل',
      descEn: 'Every action is logged and traceable',
      descAr: 'كل إجراء مسجل وقابل للتتبع',
    },
    {
      icon: ShieldCheck,
      titleEn: 'UAE Government Security Standards',
      titleAr: 'معايير أمن حكومة الإمارات',
      descEn: 'Compliant with national security policies',
      descAr: 'متوافق مع سياسات الأمن الوطني',
    },
  ]

  return (
    <div className="min-h-screen flex overflow-x-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      {/* ═══════════════════════════════════════════════════════════════════
          Left Panel — Dark branded panel (desktop only)
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-ae-green-700 via-ae-green-600 to-ae-green-800">
        {/* Decorative circles */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12 w-full">
          {/* Logo & Branding */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-10"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center shadow-lg shadow-ae-gold-500/20">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {isAr ? 'برنامج الشيخ زايد للإسكان' : 'SZHP'}
                </h1>
                <p className="text-ae-gold-300 text-sm">
                  {isAr ? 'بوابة الإدارة' : 'Admin Portal'}
                </p>
              </div>
            </div>

            <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
              {isAr ? 'الدخول الآمن' : 'Secure Staff'}{' '}
              <span className="text-ae-gold-400">
                {isAr ? 'للموظفين' : 'Access'}
              </span>
            </h2>
            <p className="text-ae-black-300 max-w-md text-sm leading-relaxed">
              {isAr
                ? 'بوابة آمنة مخصصة لموظفي برنامج الشيخ زايد للإسكان لإدارة الحالات والطلبات'
                : 'Dedicated secure portal for SZHP staff to manage cases, requests, and system operations'}
            </p>
          </motion.div>

          {/* Security Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-5"
          >
            <h3 className="text-xs font-semibold text-ae-gold-400 uppercase tracking-wider">
              {isAr ? 'ميزات الأمان' : 'Security Features'}
            </h3>
            {securityFeatures.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="w-9 h-9 rounded-lg bg-ae-gold-500/10 border border-ae-gold-500/20 flex items-center justify-center shrink-0">
                  <feature.icon className="w-4 h-4 text-ae-gold-400" />
                </div>
                <div>
                  <h4 className="text-white text-sm font-medium">
                    {isAr ? feature.titleAr : feature.titleEn}
                  </h4>
                  <p className="text-ae-black-400 text-xs mt-0.5">
                    {isAr ? feature.descAr : feature.descEn}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-10"
          >
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-ae-gold-500/10 border border-ae-gold-500/20">
              <ShieldCheck className="w-4 h-4 text-ae-gold-400" />
              <span className="text-xs font-medium text-ae-gold-300">
                {isAr ? 'للموظفين المصرح لهم فقط' : 'Authorized Personnel Only'}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Government Badge */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-3 text-ae-black-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-ae-gold-500" />
            <span>
              {isAr
                ? 'خدمة رقمية معتمدة من حكومة الإمارات العربية المتحدة'
                : 'UAE Government Approved Digital Service'}
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          Right Panel — Login Form
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-background">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile Logo (visible only on mobile) */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-ae-black-700">
                {isAr ? 'برنامج الشيخ زايد للإسكان' : 'SZHP'}
              </div>
              <div className="text-xs text-ae-black-400">
                {isAr ? 'بوابة الإدارة' : 'Admin Portal'}
              </div>
            </div>
          </div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-ae-green-50 border border-ae-green-200 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-ae-green-600" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-ae-black-700">
                {isAr ? 'تسجيل دخول الموظفين' : 'Staff Sign In'}
              </h2>
            </div>
            <p className="text-sm text-ae-black-400 mt-1 ms-12">
              {isAr
                ? 'أدخل بياناتك للوصول إلى بوابة الإدارة'
                : 'Enter your credentials to access the admin portal'}
            </p>
          </motion.div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Login Form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-4"
          >
            {/* Email Field */}
            <div>
              <Label htmlFor="email" className="text-sm text-ae-black-600 mb-1.5 block font-medium">
                {t('login.admin.email', language)}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
                placeholder="admin@szhp.gov.ae"
                className="h-11 text-sm"
                onKeyDown={handleKeyDown}
                autoComplete="email"
              />
            </div>

            {/* Password Field */}
            <div>
              <Label htmlFor="password" className="text-sm text-ae-black-600 mb-1.5 block font-medium">
                {t('login.admin.password', language)}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="h-11 text-sm pe-10"
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-ae-black-400 hover:text-ae-black-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="data-[state=checked]:bg-ae-green-600 data-[state=checked]:border-ae-green-600"
              />
              <Label htmlFor="remember" className="text-xs text-ae-black-500 cursor-pointer">
                {isAr ? 'تذكرني' : 'Remember me'}
              </Label>
            </div>

            {/* Sign In Button */}
            <Button
              onClick={handleLogin}
              disabled={isLoading}
              className="w-full h-11 bg-ae-green-600 hover:bg-ae-green-700 text-white rounded-xl font-semibold transition-all duration-200 shadow-md shadow-ae-green-600/20"
            >
              {isLoading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <LogIn className="w-4 h-4 me-2" />
                  {t('login.admin.signIn', language)}
                </>
              )}
            </Button>
          </motion.div>

          {/* Demo Credentials Hint */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-amber-800">
                    {isAr ? 'بيانات تجريبية:' : 'Demo Credentials:'}
                  </p>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">
                        {isAr ? 'البريد:' : 'Email:'}
                      </span>
                      <code className="text-xs text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                        admin@szhp.gov.ae
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-medium text-amber-600 uppercase tracking-wider">
                        {isAr ? 'كلمة المرور:' : 'Password:'}
                      </span>
                      <code className="text-xs text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded font-mono">
                        Admin@2024
                      </code>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    {isAr
                      ? 'هذه بيانات تجريبية افتراضية. غيّرها في بيئة الإنتاج.'
                      : 'These are default demo credentials. Change them in production.'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Back to main portal link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mt-5 text-center"
          >
            <button
              onClick={() => navigate('/')}
              className="text-xs text-ae-black-400 hover:text-ae-black-600 transition-colors underline underline-offset-2"
            >
              {isAr ? 'العودة إلى البوابة الرئيسية' : 'Back to main portal'}
            </button>
          </motion.div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ae-black-400">
              <span>
                {isAr ? '© 2025 حكومة الإمارات العربية المتحدة' : '© 2025 UAE Government'}
              </span>
              <div className="flex items-center gap-3">
                <LanguageToggle variant="ghost" />
                <OnlineBadge size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
