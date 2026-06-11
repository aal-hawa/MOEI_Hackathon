// External dependencies (shadcn/ui):
//   - Button from '@/components/ui/button'
//   - Badge from '@/components/ui/badge'
//   - Label from '@/components/ui/label'
//   - Switch from '@/components/ui/switch'
//   - Separator from '@/components/ui/separator'
//   - Dialog, DialogContent, DialogDescription, DialogTitle, DialogFooter from '@/components/ui/dialog'
//   - ScrollArea from '@/components/ui/scroll-area'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User,
  UserCheck,
  Eye,
  Briefcase,
  Shield,
  Crown,
  Fingerprint,
  LogIn,
  Dice5,
  CheckCircle2,
  Loader2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/pages/i18n'
import { MOCK_USERS, generateRandomMockUser, type MockUserProfile } from '../lib/uaepass-mock'
import { getRoleConfig } from '../lib/role-config'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppStore } from '@/store/app-store'

// ─── MOEI Color Constants ────────────────────────────────────
const MOEI_GOLD = '#B68A35'
const MOEI_GOLD_DARK = '#9A7429'

// ─── Icon name → component mapping ───────────────────────────
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  UserCheck,
  Eye,
  Briefcase,
  Shield,
  Crown,
}

// ─── Types ────────────────────────────────────────────────────
type MockProfileId = keyof typeof MOCK_USERS

export interface UAEPassLoginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onLogin: (profile: MockUserProfile) => void
  title?: string
  description?: string
}

// ─── Component ────────────────────────────────────────────────
export function UAEPassLoginDialog({
  open,
  onOpenChange,
  onLogin,
  title,
  description,
}: UAEPassLoginDialogProps) {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [authMode, setAuthMode] = useState<'mock' | 'production'>('mock')

  const language = useAppStore((s) => s.language)
  const isAr = language === 'ar'
  const currentAgent = useAppStore((s) => s.currentAgent)

  // ── Handlers ──────────────────────────────────────────────
  const handleMockLogin = (profileId: string) => {
    setIsLoggingIn(true)
    const profile = MOCK_USERS[profileId as MockProfileId]
    if (profile) {
      setTimeout(() => {
        onLogin(profile)
        setIsLoggingIn(false)
        onOpenChange(false)

        // Log UAE PASS login action
        if (currentAgent) {
          fetch('/api/employer-sessions/action?XTransformPort=3002', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: currentAgent.id,
              agentEmail: currentAgent.email,
              action: 'uaepass_login',
              details: { profileId, profileName: profile.fullnameEN },
            }),
          }).catch(() => {})
        }
      }, 600)
    }
  }

  const handleRandomLogin = () => {
    setIsLoggingIn(true)
    const randomProfile = generateRandomMockUser()
    setTimeout(() => {
      onLogin(randomProfile)
      setIsLoggingIn(false)
      onOpenChange(false)
    }, 600)
  }

  const handleUAEPassLogin = () => {
    setIsLoggingIn(true)
    setTimeout(() => {
      const profile = MOCK_USERS['ahmed-citizen']
      onLogin(profile)
      setIsLoggingIn(false)
      onOpenChange(false)
    }, 1000)
  }

  // ── Role helpers (delegated to role-config) ───────────────
  const getRoleIcon = (role: string) => {
    const config = getRoleConfig(role)
    const IconComponent = ICON_MAP[config.icon] ?? User
    return <IconComponent className="w-4 h-4" />
  }

  const getRoleBadgeClasses = (role: string) => {
    const config = getRoleConfig(role)
    return cn(config.color, config.bgColor, config.borderColor)
  }

  const getRoleLabel = (role: string) => {
    const config = getRoleConfig(role)
    return isAr ? config.label.ar : config.label.en
  }

  const getAvatarClasses = (role: string) => {
    const config = getRoleConfig(role)
    return cn('w-9 h-9 rounded-full flex items-center justify-center shrink-0', config.bgColor, config.color)
  }

  // ── Department label ──────────────────────────────────────
  const getDepartmentLabel = (department: string | undefined) => {
    if (!department) return null
    const labels: Record<string, { en: string; ar: string }> = {
      housing_finance: { en: 'Housing Finance', ar: 'تمويل الإسكان' },
      risk_assessment: { en: 'Risk Assessment', ar: 'تقييم المخاطر' },
      compliance: { en: 'Compliance', ar: 'الامتثال' },
      management: { en: 'Management', ar: 'الإدارة' },
    }
    const label = labels[department]
    return label ? (isAr ? label.ar : label.en) : department
  }

  // ── Default title / description ───────────────────────────
  const dialogTitle = title ?? t('form.uaepass.signIn', language)
  const dialogDescription = description ?? t('form.uaepass.autoFill', language)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[calc(100%-1rem)] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* MOEI-styled header */}
        <div
          className="px-5 pt-5 pb-4 border-b shrink-0"
          style={{ background: `linear-gradient(135deg, ${MOEI_GOLD}, ${MOEI_GOLD_DARK})` }}
        >
          <DialogTitle className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Fingerprint className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-lg">{dialogTitle}</div>
              <div className="text-white/80 text-xs font-normal">{dialogDescription}</div>
            </div>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {dialogTitle} - {dialogDescription}
          </DialogDescription>
        </div>

        <div className="flex-1 min-h-0">
          <ScrollArea className="h-full px-5 py-4">
            <div className="space-y-4 pb-2">
              {/* UAE PASS Button */}
              <Button
                onClick={handleUAEPassLogin}
                disabled={isLoggingIn}
                className="w-full min-h-[48px] text-white rounded-xl font-semibold shadow-lg"
                style={{ backgroundColor: '#3F8E50' }}
              >
                {isLoggingIn ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 me-2" />
                    {t('form.uaepass.signIn', language)}
                  </>
                )}
              </Button>

              {/* Auth mode toggle */}
              <div className="flex items-center justify-center gap-2">
                <Label className="text-xs text-gray-500">{t('form.uaepass.mock', language)}</Label>
                <Switch
                  checked={authMode === 'production'}
                  onCheckedChange={(checked) => setAuthMode(checked ? 'production' : 'mock')}
                />
                <Label className="text-xs text-gray-500">{t('form.uaepass.production', language)}</Label>
              </div>

              {/* ── Mock Section ──────────────────────────────── */}
              <AnimatePresence>
                {authMode === 'mock' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-gray-400 uppercase">
                        {t('form.uaepass.orSelectProfile', language)}
                      </span>
                      <Separator className="flex-1" />
                    </div>

                    {/* Random user button */}
                    <Button
                      onClick={handleRandomLogin}
                      disabled={isLoggingIn}
                      variant="outline"
                      className="w-full min-h-[44px] mb-3 border-dashed rounded-lg hover:bg-amber-50 hover:border-amber-400 text-amber-700 text-sm"
                    >
                      <Dice5 className="w-4 h-4 me-2" />
                      {t('login.mock.random', language)}
                    </Button>

                    {/* Profile list */}
                    <div className="mb-3 relative">
                      <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar pe-1">
                        {Object.entries(MOCK_USERS).map(([key, profile]) => (
                          <div
                            key={key}
                            onClick={() => setSelectedProfile(key)}
                            className={cn(
                              'flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all',
                              selectedProfile === key
                                ? 'border-amber-400 bg-amber-50/50 shadow-sm'
                                : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                            )}
                          >
                            {/* Avatar */}
                            <div className={getAvatarClasses(profile.role)}>
                              {getRoleIcon(profile.role)}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-800 truncate">
                                {isAr && profile.fullnameAR ? profile.fullnameAR : profile.fullnameEN}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn('text-[10px] h-4 px-1.5', getRoleBadgeClasses(profile.role))}
                                >
                                  {getRoleLabel(profile.role)}
                                </Badge>
                                <span className="text-[10px] text-gray-400">{profile.idn}</span>
                              </div>
                              {profile.department && (
                                <span className="text-[10px] text-gray-300 mt-0.5 block">
                                  {getDepartmentLabel(profile.department)}
                                </span>
                              )}
                            </div>

                            {/* Radio indicator */}
                            <div className="shrink-0">
                              {selectedProfile === key ? (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ backgroundColor: MOEI_GOLD }}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-white" />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-gray-200" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mock mode info */}
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                      <div className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-700">
                          {t('form.uaepass.mockMode', language)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Production Mode ───────────────────────────── */}
              <AnimatePresence>
                {authMode === 'production' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                      <div className="flex items-start gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-green-800">
                            {t('form.uaepass.productionMode', language)}
                          </p>
                          <p className="text-[11px] text-green-700 mt-0.5">
                            {t('form.uaepass.productionDesc', language)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>

        {/* Sticky footer */}
        <DialogFooter className="px-5 py-4 border-t bg-gray-50/50 shrink-0">
          <AnimatePresence>
            {authMode === 'mock' && selectedProfile && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className="w-full"
              >
                <Button
                  onClick={() => handleMockLogin(selectedProfile)}
                  disabled={isLoggingIn}
                  className="w-full min-h-[44px] text-white font-semibold rounded-lg"
                  style={{ backgroundColor: MOEI_GOLD }}
                >
                  {isLoggingIn ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 me-2" />
                      {t('login.mock.login', language)}
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
