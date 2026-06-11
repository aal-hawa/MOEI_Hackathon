
import { useState } from 'react'
import { useAuthStore } from '@/lib/auth-store'
import { MOCK_USERS, generateRandomMockUser, type MockUserProfile } from '@/lib/uaepass-mock'
import { t } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Fingerprint, Globe, Zap, Lock, Eye, ChevronRight,
  User, Building2, Crown, Dice5, LogIn, Sparkles, ArrowRight,
  Check, Users, Bot, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/lib/store'
import { apiFetch } from '@/lib/utils'
import { getRoleConfig } from '@/lib/role-config'
import { OnlineBadge } from '@/components/shared'

type MockProfileId = keyof typeof MOCK_USERS

export function LoginPage() {
  const { authMode, setAuthMode, loginWithMockUser, loginWithRandomMock, loginWithAdminCredentials } = useAuthStore()
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminError, setAdminError] = useState('')
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false)

  const handleMockLogin = (profileId: string) => {
    setIsLoggingIn(true)
    const profile = MOCK_USERS[profileId as MockProfileId]
    if (profile) {
      setTimeout(async () => {
        await loginWithMockUser(profile)
        setIsLoggingIn(false)
      }, 800)
    }
  }

  const handleRandomLogin = () => {
    setIsLoggingIn(true)
    const randomProfile = generateRandomMockUser()
    setTimeout(async () => {
      await loginWithRandomMock(randomProfile)
      setIsLoggingIn(false)
    }, 800)
  }

  const handleUAEPassLogin = () => {
    setIsLoggingIn(true)
    // In production, this would redirect to UAE PASS
    // For now, show a simulated flow
    setTimeout(async () => {
      // Use first citizen as fallback for production mode demo
      const profile = MOCK_USERS['ahmed-citizen']
      await loginWithMockUser(profile)
      setIsLoggingIn(false)
    }, 1200)
  }

  const handleAdminLogin = async () => {
    setAdminError('')
    if (!adminEmail || !adminPassword) {
      setAdminError(t('login.admin.invalidCredentials', language))
      return
    }
    setIsAdminLoggingIn(true)
    try {
      const res = await apiFetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      })
      const data = await res.json()
      if (data.accessToken && data.user) {
        loginWithAdminCredentials({
          user: data.user,
          accessToken: data.accessToken,
        })
      } else {
        // Handle specific errors
        if (data.error?.includes('locked')) {
          setAdminError(t('login.admin.accountLocked', language))
        } else if (data.error?.includes('inactive')) {
          setAdminError(t('login.admin.accountInactive', language))
        } else {
          setAdminError(t('login.admin.invalidCredentials', language))
        }
      }
    } catch {
      setAdminError(t('login.admin.invalidCredentials', language))
    } finally {
      setIsAdminLoggingIn(false)
    }
  }

  // ── Role helpers (delegated to role-config) ────────────
  const ROLE_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    citizen: User,
    employee: Building2,
    admin: Crown,
    User,
  }

  const getRoleIcon = (role: string) => {
    const config = getRoleConfig(role)
    const IconComponent = ROLE_ICON_MAP[role] ?? ROLE_ICON_MAP[config.icon] ?? User
    return <IconComponent className="w-4 h-4" />
  }

  const getRoleBadgeClasses = (role: string) => {
    const config = getRoleConfig(role)
    return `${config.bgColor} ${config.color} ${config.borderColor}`
  }

  const getRoleLabel = (role: string) => {
    const config = getRoleConfig(role)
    return isAr ? config.label.ar : config.label.en
  }

  const getProfileBadge = (profile: MockUserProfile) => {
    const isEmirati = profile.nationalityEN === 'Emirati' || profile.isEmirati === true
    if (profile.role === 'citizen' && !isEmirati) {
      return {
        label: isAr ? 'وافد - غير مصرح' : 'Resident - Not authorized',
        className: 'bg-red-50 text-red-700 border-red-200',
      }
    }
    return {
      label: getRoleLabel(profile.role),
      className: getRoleBadgeClasses(profile.role),
    }
  }

  return (
    <div className="min-h-screen flex" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Left Panel - Hero/Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-ae-green-700 via-ae-green-600 to-ae-green-800">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/10 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 py-12">
          {/* Logo & Branding */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center shadow-lg shadow-ae-gold-500/20">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {isAr ? 'برنامج الشيخ زايد للإسكان' : 'SZHP'}
                </h1>
                <p className="text-ae-gold-300 text-sm">
                  {isAr ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'}
                </p>
              </div>
            </div>

            <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
              {isAr ? 'بوابة إعادة جدولة' : 'Housing Arrears'}{' '}
              <span className="text-ae-gold-400">
                {isAr ? 'ديون الإسكان' : 'Rescheduling'}
              </span>
            </h2>
            <p className="text-lg text-ae-black-300 max-w-md">
              {isAr
                ? 'نظام مدعوم بالذكاء الاصطناعي لإعادة جدولة المتأخرات الإسكانية بسرعة ودقة'
                : 'AI-powered system for instant housing arrears rescheduling assessment'}
            </p>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            <h3 className="text-sm font-semibold text-ae-gold-400 uppercase tracking-wider">
              {t('login.features.title', language)}
            </h3>
            {[
              { icon: Zap, key: 'instant' },
              { icon: Lock, key: 'secure' },
              { icon: Eye, key: 'transparent' },
              { icon: Globe, key: 'arabic' },
            ].map((feature, i) => (
              <motion.div
                key={feature.key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 border border-ae-gold-500/20 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-ae-gold-400" />
                </div>
                <div>
                  <h4 className="text-white font-medium">
                    {t(`login.features.${feature.key}`, language)}
                  </h4>
                  <p className="text-ae-black-400 text-sm mt-0.5">
                    {t(`login.features.${feature.key}.desc`, language)}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="mt-12 flex gap-8"
          >
            {[
              { value: '5→0', label: isAr ? 'أيام إلى لحظات' : 'Days to Seconds' },
              { value: '60%', label: isAr ? 'حد عبء الدين' : 'DBR Limit' },
              { value: '24/7', label: isAr ? 'متاح دائماً' : 'Always Available' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-ae-gold-400">{stat.value}</div>
                <div className="text-xs text-ae-black-400">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* UAE Government Badge */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="flex items-center gap-3 text-ae-black-400 text-xs">
            <ShieldCheck className="w-4 h-4 text-ae-gold-500" />
            <span>{isAr ? 'معتمد من حكومة الإمارات العربية المتحدة' : 'UAE Government Approved Digital Service'}</span>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Options */}
      <div className="flex-1 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-20 bg-background">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ae-gold-400 to-ae-gold-600 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-ae-black-700">SZHP</div>
              <div className="text-xs text-ae-black-400">
                {isAr ? 'برنامج الشيخ زايد للإسكان' : 'AI Rescheduling Agent'}
              </div>
            </div>
          </div>

          {/* Auth Mode Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-ae-black-700">
                  {isAr ? 'تسجيل الدخول' : 'Sign In'}
                </h2>
                <p className="text-sm text-ae-black-400 mt-1">
                  {isAr ? 'اختر طريقة المصادقة' : 'Choose your authentication method'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-ae-black-400">
                  {isAr ? 'محاكاة' : 'Mock'}
                </Label>
                <Switch
                  checked={authMode === 'production'}
                  onCheckedChange={(checked) => setAuthMode(checked ? 'production' : 'mock')}
                />
                <Label className="text-xs text-ae-black-400">
                  {isAr ? 'إنتاج' : 'Prod'}
                </Label>
              </div>
            </div>

            {/* UAE PASS Login Button */}
            <Button
              onClick={handleUAEPassLogin}
              disabled={isLoggingIn}
              className="w-full h-14 bg-[#3F8E50] hover:bg-[#317A40] text-white rounded-xl text-base font-semibold shadow-lg shadow-ae-green-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-ae-green-500/30"
            >
              {isLoggingIn ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                />
              ) : (
                <>
                  <Fingerprint className="w-6 h-6 me-3" />
                  {t('login.uaepass', language)}
                </>
              )}
            </Button>

            <div className="flex items-center gap-3 my-4">
              <Separator className="flex-1" />
              <span className="text-xs text-ae-black-300 uppercase">
                {isAr ? 'أو' : 'or'}
              </span>
              <Separator className="flex-1" />
            </div>
          </motion.div>

          {/* Mock Authentication Section */}
          <AnimatePresence>
            {authMode === 'mock' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-4 h-4 text-ae-gold-500" />
                    <h3 className="text-sm font-semibold text-ae-black-700">
                      {t('login.mock.title', language)}
                    </h3>
                  </div>
                  <p className="text-xs text-ae-black-400 mb-4">
                    {t('login.mock.desc', language)}
                  </p>
                </div>

                {/* Random User Button */}
                <Button
                  onClick={handleRandomLogin}
                  disabled={isLoggingIn}
                  variant="outline"
                  className="w-full h-12 mb-4 border-dashed border-ae-gold-500/40 hover:bg-ae-gold-50 hover:border-ae-gold-500 text-ae-gold-600"
                >
                  <Dice5 className="w-4 h-4 me-2" />
                  {t('login.mock.random', language)}
                </Button>

                {/* Mock User Profiles Grid */}
                <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                  {Object.entries(MOCK_USERS).map(([key, profile]) => (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedProfile === key
                            ? 'ring-2 ring-ae-gold-500 shadow-md bg-ae-gold-50/50'
                            : 'hover:border-ae-gold-500/30'
                        }`}
                        onClick={() => setSelectedProfile(key)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${getRoleConfig(profile.role).bgColor} ${getRoleConfig(profile.role).color}`}>
                                {getRoleIcon(profile.role)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-medium text-sm text-ae-black-700 truncate">
                                  {isAr && profile.fullnameAR ? profile.fullnameAR : profile.fullnameEN}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${getProfileBadge(profile).className}`}>
                                    {getProfileBadge(profile).label}
                                  </Badge>
                                  <span className="text-[10px] text-ae-black-400 truncate">
                                    {profile.idn}
                                  </span>
                                </div>
                                {profile.department && (
                                  <span className="text-[10px] text-ae-black-300">
                                    {profile.department === 'housing_finance' ? (isAr ? 'تمويل الإسكان' : 'Housing Finance') :
                                     profile.department === 'risk_assessment' ? (isAr ? 'تقييم المخاطر' : 'Risk Assessment') :
                                     profile.department === 'compliance' ? (isAr ? 'الامتثال' : 'Compliance') :
                                     isAr ? 'الإدارة' : 'Management'}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 ms-2">
                              {selectedProfile === key ? (
                                <div className="w-6 h-6 rounded-full bg-ae-gold-500 flex items-center justify-center">
                                  <Check className="w-3.5 h-3.5 text-white" />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-ae-black-200" />
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Login Button */}
                <AnimatePresence>
                  {selectedProfile && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4"
                    >
                      <Button
                        onClick={() => handleMockLogin(selectedProfile)}
                        disabled={isLoggingIn}
                        className="w-full h-12 bg-ae-gold-500 hover:bg-ae-gold-600 text-white rounded-xl font-semibold shadow-lg shadow-ae-gold-500/20"
                      >
                        {isLoggingIn ? (
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                          />
                        ) : (
                          <>
                            <LogIn className="w-4 h-4 me-2" />
                            {t('login.mock.login', language)}
                            <ArrowRight className="w-4 h-4 ms-2 rtl:rotate-180" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Info about mock mode */}
                <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      {isAr
                        ? 'وضع المحاكاة: يتم محاكاة استجابة هوية الإمارات بالضبط كما في الإنتاج. بيانات المستخدم وهمية لأغراض الاختبار فقط.'
                        : 'Mock mode: UAE PASS response is simulated exactly as in production. User data is fictional for testing purposes only.'}
                    </p>
                  </div>
                </div>

                {/* Staff Login Section */}
                <div className="mt-6">
                  <div className="flex items-center gap-3 my-4">
                    <Separator className="flex-1" />
                    <span className="text-xs text-ae-black-300 uppercase">
                      {isAr ? 'أو' : 'or'}
                    </span>
                    <Separator className="flex-1" />
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-ae-green-50 border border-ae-green-200 flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-ae-green-600" />
                      </div>
                      <h3 className="text-sm font-semibold text-ae-black-700">
                        {t('login.admin.title', language)}
                      </h3>
                    </div>
                    <p className="text-xs text-ae-black-400 mb-3">
                      {t('login.admin.desc', language)}
                    </p>
                  </div>

                  {adminError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200"
                    >
                      <p className="text-xs text-red-600">{adminError}</p>
                    </motion.div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs text-ae-black-500 mb-1 block">
                        {t('login.admin.email', language)}
                      </Label>
                      <Input
                        type="email"
                        value={adminEmail}
                        onChange={(e) => { setAdminEmail(e.target.value); setAdminError('') }}
                        placeholder="admin@szhp.gov.ae"
                        className="h-10 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin() }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-ae-black-500 mb-1 block">
                        {t('login.admin.password', language)}
                      </Label>
                      <Input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => { setAdminPassword(e.target.value); setAdminError('') }}
                        placeholder="••••••••"
                        className="h-10 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAdminLogin() }}
                      />
                    </div>
                    <Button
                      onClick={handleAdminLogin}
                      disabled={isAdminLoggingIn}
                      className="w-full h-11 bg-ae-green-600 hover:bg-ae-green-700 text-white rounded-xl font-semibold shadow-md shadow-ae-green-600/20"
                    >
                      {isAdminLoggingIn ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                      ) : (
                        <>
                          <Lock className="w-4 h-4 me-2" />
                          {t('login.admin.signIn', language)}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Production Mode Info */}
          <AnimatePresence>
            {authMode === 'production' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-4 rounded-xl bg-ae-green-50 border border-ae-green-200">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-ae-green-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-medium text-ae-green-800">
                        {isAr ? 'وضع الإنتاج' : 'Production Mode'}
                      </h4>
                      <p className="text-xs text-ae-green-700 mt-1">
                        {isAr
                          ? 'سيتم توجيهك إلى بوابة هوية الإمارات الرسمية للمصادقة الآمنة باستخدام بياناتك الحقيقية.'
                          : 'You will be redirected to the official UAE PASS gateway for secure authentication with your real credentials.'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { icon: Fingerprint, text: isAr ? 'مصادقة بيومترية' : 'Biometric Authentication' },
                    { icon: Shield, text: isAr ? 'تشفير من طرف إلى طرف' : 'End-to-end Encryption' },
                    { icon: Users, text: isAr ? 'التحقق من الهوية الوطنية' : 'National Identity Verification' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-3 text-sm text-ae-black-600">
                      <item.icon className="w-4 h-4 text-ae-green-500" />
                      {item.text}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t">
            <div className="flex items-center justify-between text-xs text-ae-black-400">
              <span>{isAr ? '© 2025 حكومة الإمارات العربية المتحدة' : '© 2025 UAE Government'}</span>
              <div className="flex items-center gap-1">
                <OnlineBadge size="sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
