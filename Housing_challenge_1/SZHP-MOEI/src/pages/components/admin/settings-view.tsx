'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { useSystemConfig } from '@/hooks/use-system-config'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import {
  Globe, Bot, FileText, Shield, Database, Settings2, Scale,
  TrendingUp, Landmark, Cpu, Building2, Clock, Upload, Wrench,
  Save, Loader2, MessageSquare
} from 'lucide-react'

// ── Settings Config Helpers ──────────────────────────────────────────

function SettingsConfigSwitch({ configKey, fallback, label, description }: {
  configKey: string; fallback: string; label: string; description: string
}) {
  const { getString, reload } = useSystemConfig()
  const { language } = useAppStore()
  const [saving, setSaving] = useState(false)
  const currentValue = getString(configKey, fallback) === 'true'

  const handleToggle = async (checked: boolean) => {
    setSaving(true)
    try {
      const res = await authFetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ configKey, configValue: String(checked) }] }),
      })
      if (res.ok) {
        reload()
        toast({ title: t('admin.settings.saved', language) })
      }
    } catch {
      toast({ title: t('admin.settings.saveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <Switch checked={currentValue} onCheckedChange={handleToggle} disabled={saving} />
      </div>
    </div>
  )
}

function SettingsConfigSelect({ configKey, fallback, options, label, description }: {
  configKey: string; fallback: string; options: Array<{ value: string; label: string }>; label: string; description: string
}) {
  const { getString, reload } = useSystemConfig()
  const { language } = useAppStore()
  const [saving, setSaving] = useState(false)
  const currentValue = getString(configKey, fallback)

  const handleChange = async (value: string) => {
    setSaving(true)
    try {
      const res = await authFetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ configKey, configValue: value }] }),
      })
      if (res.ok) {
        reload()
        toast({ title: t('admin.settings.saved', language) })
      }
    } catch {
      toast({ title: t('admin.settings.saveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <Select value={currentValue} onValueChange={handleChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

interface NumberConfigProps {
  configKey: string
  fallback: number
  label: string
  description: string
  unit?: string
  min?: number
  max?: number
  step?: number
  /** If true, the stored value is a decimal (e.g. 0.6) but displayed as percentage (60) */
  isPercentage?: boolean
  /** Number of decimal places to show */
  decimals?: number
}

function SettingsConfigNumber({
  configKey, fallback, label, description, unit, min, max, step, isPercentage, decimals
}: NumberConfigProps) {
  const { getNumber, reload } = useSystemConfig()
  const { language } = useAppStore()
  const [saving, setSaving] = useState(false)
  const rawValue = getNumber(configKey, fallback)
  const displayValue = isPercentage ? Math.round(rawValue * 100) : rawValue
  const [editValue, setEditValue] = useState<string>(String(decimals !== undefined ? displayValue.toFixed(decimals) : displayValue))
  const [dirty, setDirty] = useState(false)

  // Sync with external changes
  useEffect(() => {
    if (!dirty) {
      setEditValue(String(decimals !== undefined ? displayValue.toFixed(decimals) : displayValue))
    }
  }, [displayValue, dirty, decimals])

  const save = useCallback(async (val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) {
      setEditValue(String(decimals !== undefined ? displayValue.toFixed(decimals) : displayValue))
      setDirty(false)
      return
    }
    const clampedMin = min !== undefined ? Math.max(min, num) : num
    const clamped = max !== undefined ? Math.min(max, clampedMin) : clampedMin
    // Convert back to storage format
    const storedValue = isPercentage ? clamped / 100 : clamped
    setSaving(true)
    try {
      const res = await authFetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ configKey, configValue: String(storedValue) }] }),
      })
      if (res.ok) {
        reload()
        toast({ title: t('admin.settings.saved', language) })
      }
    } catch {
      toast({ title: t('admin.settings.saveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
      setDirty(false)
    }
  }, [configKey, displayValue, isPercentage, min, max, decimals, reload, language])

  const handleBlur = () => {
    if (dirty) save(editValue)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && dirty) save(editValue)
    if (e.key === 'Escape') {
      setEditValue(String(decimals !== undefined ? displayValue.toFixed(decimals) : displayValue))
      setDirty(false)
    }
  }

  const effectiveMin = isPercentage && min !== undefined ? Math.round(min * 100) : min
  const effectiveMax = isPercentage && max !== undefined ? Math.round(max * 100) : max

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
        <div className="relative">
          <Input
            type="number"
            value={editValue}
            onChange={(e) => { setEditValue(e.target.value); setDirty(true) }}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            min={effectiveMin}
            max={effectiveMax}
            step={step ?? (decimals ? 0.01 : 1)}
            className={`w-[140px] text-right ${unit ? 'pr-10' : 'pr-3'} ${dirty ? 'border-amber-400 ring-1 ring-amber-200' : ''}`}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground font-medium pointer-events-none whitespace-nowrap">
              {unit}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section Divider ──────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2 pb-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>
    </div>
  )
}

// ── Seed Button Helper ──────────────────────────────────────────
function SeedButton({ endpoint, label, labelAr, icon: Icon }: {
  endpoint: string; label: string; labelAr: string; icon: React.ElementType
}) {
  const { language } = useAppStore()
  const [loading, setLoading] = useState(false)

  return (
    <Button
      variant="outline"
      className="border-amber-500 text-amber-600 hover:bg-amber-50"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const res = await authFetch(endpoint, { method: 'POST' })
          if (res.ok) {
            toast({ title: language === 'ar' ? labelAr : label + ' ✓' })
          } else {
            const err = await res.json() as any
            toast({ title: err.error || (language === 'ar' ? 'فشل' : 'Failed'), variant: 'destructive' })
          }
        } catch {
          toast({ title: t('admin.settings.saveFailed', language), variant: 'destructive' })
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <Icon className="w-4 h-4 me-1" />}
      {language === 'ar' ? labelAr : label}
    </Button>
  )
}

// ── Main Settings View ──────────────────────────────────────────────

export function SettingsView() {
  const { language, setLanguage } = useAppStore()
  const { configs } = useSystemConfig()
  const [dbStats, setDbStats] = useState<{ totalRecords: number } | null>(null)

  useEffect(() => {
    authFetch('/api/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.totalRequests) {
          setDbStats({ totalRecords: data.totalRequests as number })
        }
      })
      .catch(() => {})
  }, [])

  const isAr = language === 'ar'

  return (
    <div className="space-y-4">
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="general" className="text-xs gap-1">
            <Globe className="w-3.5 h-3.5" />
            {isAr ? 'عام' : 'General'}
          </TabsTrigger>
          <TabsTrigger value="eligibility" className="text-xs gap-1">
            <Shield className="w-3.5 h-3.5" />
            {isAr ? 'الأهلية' : 'Eligibility'}
          </TabsTrigger>
          <TabsTrigger value="dbr-risk" className="text-xs gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            {isAr ? 'نسبة الدين والمخاطر' : 'DBR & Risk'}
          </TabsTrigger>
          <TabsTrigger value="loan" className="text-xs gap-1">
            <Landmark className="w-3.5 h-3.5" />
            {isAr ? 'القروض' : 'Loan'}
          </TabsTrigger>
          <TabsTrigger value="automation" className="text-xs gap-1">
            <Cpu className="w-3.5 h-3.5" />
            {isAr ? 'الأتمتة' : 'Automation'}
          </TabsTrigger>
          <TabsTrigger value="employer-grace" className="text-xs gap-1">
            <Building2 className="w-3.5 h-3.5" />
            {isAr ? 'جهة العمل والسماح' : 'Employer & Grace'}
          </TabsTrigger>
          <TabsTrigger value="documents" className="text-xs gap-1">
            <Upload className="w-3.5 h-3.5" />
            {isAr ? 'المستندات' : 'Documents'}
          </TabsTrigger>
          <TabsTrigger value="features" className="text-xs gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            {isAr ? 'الميزات' : 'Features'}
          </TabsTrigger>
          <TabsTrigger value="system" className="text-xs gap-1">
            <Wrench className="w-3.5 h-3.5" />
            {isAr ? 'النظام' : 'System'}
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: General ─────────────────────────────────────── */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <Globe className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'الإعدادات العامة' : 'General Settings'}
              </CardTitle>
              <CardDescription>{isAr ? 'اللغة والإصدار ومقاييس الصفحة الرئيسية' : 'Language, version, and landing page metrics'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {/* Language */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 py-3">
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium">{isAr ? 'اللغة العربية' : 'Arabic Language'}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{isAr ? 'تفعيل دعم اللغة العربية واتجاه RTL' : 'Enable Arabic language support and RTL layout'}</p>
                </div>
                <Switch checked={language === 'ar'} onCheckedChange={(checked) => setLanguage(checked ? 'ar' : 'en')} />
              </div>

              <Separator />

              {/* System Version */}
              <SettingsConfigSelect
                configKey="system_version"
                fallback="9.0.0"
                label={isAr ? 'إصدار النظام' : 'System Version'}
                description={isAr ? 'رقم إصدار النظام المعروض للمستخدمين' : 'System version number displayed to users'}
                options={[
                  { value: '9.0.0', label: 'v9.0.0' },
                  { value: '8.5.0', label: 'v8.5.0' },
                  { value: '8.0.0', label: 'v8.0.0' },
                  { value: '7.0.0', label: 'v7.0.0' },
                ]}
              />

              <Separator />

              {/* Landing Metrics */}
              <SectionLabel>{isAr ? 'مقاييس الصفحة الرئيسية' : 'Landing Page Metrics'}</SectionLabel>

              <SettingsConfigNumber
                configKey="landing_automation_rate"
                fallback={94}
                label={isAr ? 'معدل الأتمتة' : 'Automation Rate'}
                description={isAr ? 'نسبة العمليات المؤتمتة المعروضة في الصفحة الرئيسية' : 'Percentage of automated processes shown on landing page'}
                unit="%"
                min={0}
                max={100}
              />

              <SettingsConfigNumber
                configKey="landing_assessment_time"
                fallback={2.5}
                label={isAr ? 'وقت التقييم' : 'Assessment Time'}
                description={isAr ? 'متوسط وقت التقييم بالدقائق' : 'Average assessment time in minutes'}
                unit="min"
                min={0.1}
                max={60}
                step={0.1}
                decimals={1}
              />

              <SettingsConfigNumber
                configKey="landing_compliance_rate"
                fallback={99.2}
                label={isAr ? 'معدل الامتثال' : 'Compliance Rate'}
                description={isAr ? 'نسبة الامتثال التنظيمي' : 'Regulatory compliance rate percentage'}
                unit="%"
                min={0}
                max={100}
                step={0.1}
                decimals={1}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 2: Eligibility & Compliance ───────────────────── */}
        <TabsContent value="eligibility">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <Shield className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'الأهلية والامتثال' : 'Eligibility & Compliance'}
              </CardTitle>
              <CardDescription>{isAr ? 'شروط أهلية مقدم الطلب' : 'Applicant eligibility requirements'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingsConfigSwitch
                configKey="citizenship_required"
                fallback="true"
                label={isAr ? 'مطلوب مواطنة' : 'Citizenship Required'}
                description={isAr ? 'يتطلب أن يكون مقدم الطلب مواطناً إماراتياً' : 'Require applicants to be UAE citizens'}
              />

              <Separator />

              <SettingsConfigSwitch
                configKey="family_book_required"
                fallback="true"
                label={isAr ? 'مطلوب دفتر العائلة' : 'Family Book Required'}
                description={isAr ? 'يتطلب تقديم دفتر العائلة مع الطلب' : 'Require a family book to be submitted with the application'}
              />

              <Separator />

              <SettingsConfigSwitch
                configKey="eligibility_check_enabled"
                fallback="true"
                label={isAr ? 'التحقق من الأهلية (إماراتي + قرض)' : 'Eligibility Check (Emirati + Loan)'}
                description={isAr ? 'يتطلب أن يكون المواطن إماراتياً ولديه قرض نشط لتقديم الطلبات' : 'Require citizens to be Emirati with an active SZHP loan to submit requests'}
              />

              <Separator />

              <SettingsConfigNumber
                configKey="min_monthly_income"
                fallback={3000}
                label={isAr ? 'الحد الأدنى للدخل الشهري' : 'Minimum Monthly Income'}
                description={isAr ? 'الحد الأدنى للدخل الشهري بالدرهم' : 'Minimum monthly income required in AED'}
                unit="AED"
                min={0}
                max={50000}
                step={100}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 3: DBR & Risk ─────────────────────────────────── */}
        <TabsContent value="dbr-risk">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <TrendingUp className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'نسبة عبء الدين والمخاطر' : 'DBR & Risk Thresholds'}
              </CardTitle>
              <CardDescription>{isAr ? 'حدود نسبة عبء الدين وعتبات المخاطر وتأخير الأيام' : 'Debt Burden Ratio limits, risk thresholds, and delay day settings'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SectionLabel>{isAr ? 'حدود نسبة عبء الدين' : 'DBR Limits'}</SectionLabel>

              <SettingsConfigNumber
                configKey="max_dbr_limit"
                fallback={0.2}
                label={isAr ? 'الحد الأقصى لنسبة عبء الدين' : 'Max DBR Limit'}
                description={isAr ? 'الحد الأقصى المسموح لنسبة عبء الدين' : 'Maximum allowed Debt Burden Ratio'}
                unit="%"
                min={0.1}
                max={1.0}
                step={0.05}
                isPercentage
              />

              <SettingsConfigNumber
                configKey="dbr_healthy_limit"
                fallback={0.3}
                label={isAr ? 'حد عبء الدين الصحي' : 'Healthy DBR Limit'}
                description={isAr ? 'الحد الذي تحته تعتبر نسبة عبء الدين صحية' : 'DBR ratio below this is considered healthy'}
                unit="%"
                min={0.1}
                max={1.0}
                step={0.05}
                isPercentage
              />

              <SettingsConfigNumber
                configKey="dbr_caution_limit"
                fallback={0.5}
                label={isAr ? 'حد عبء الدين التحذيري' : 'Caution DBR Limit'}
                description={isAr ? 'الحد الذي فوقه يتطلب تحذيراً' : 'DBR ratio above this triggers a caution flag'}
                unit="%"
                min={0.1}
                max={1.0}
                step={0.05}
                isPercentage
              />

              <Separator />

              <SectionLabel>{isAr ? 'عتبات المخاطر' : 'Risk Thresholds'}</SectionLabel>

              <SettingsConfigNumber
                configKey="risk_threshold_low"
                fallback={30}
                label={isAr ? 'عتبة المخاطر المنخفضة' : 'Low Risk Threshold'}
                description={isAr ? 'درجة المخاطر أقل من هذا الحد تعتبر منخفضة' : 'Risk score below this is considered low risk'}
                unit="pts"
                min={0}
                max={100}
              />

              <SettingsConfigNumber
                configKey="risk_threshold_medium"
                fallback={50}
                label={isAr ? 'عتبة المخاطر المتوسطة' : 'Medium Risk Threshold'}
                description={isAr ? 'درجة المخاطر بين المنخفضة والمتوسطة تعتبر متوسطة' : 'Risk score between low and medium thresholds'}
                unit="pts"
                min={0}
                max={100}
              />

              <SettingsConfigNumber
                configKey="risk_threshold_high"
                fallback={70}
                label={isAr ? 'عتبة المخاطر العالية' : 'High Risk Threshold'}
                description={isAr ? 'درجة المخاطر فوق هذا الحد تعتبر عالية' : 'Risk score above this is considered high risk'}
                unit="pts"
                min={0}
                max={100}
              />

              <Separator />

              <SectionLabel>{isAr ? 'أيام التأخير' : 'Delay Risk Days'}</SectionLabel>

              <SettingsConfigNumber
                configKey="delay_low_risk_days"
                fallback={30}
                label={isAr ? 'أيام التأخير المنخفض' : 'Low Risk Delay Days'}
                description={isAr ? 'عدد أيام التأخير للتصنيف المنخفض' : 'Number of delay days for low risk classification'}
                unit={isAr ? 'يوم' : 'days'}
                min={0}
                max={365}
              />

              <SettingsConfigNumber
                configKey="delay_high_risk_days"
                fallback={90}
                label={isAr ? 'أيام التأخير العالي' : 'High Risk Delay Days'}
                description={isAr ? 'عدد أيام التأخير للتصنيف العالي' : 'Number of delay days for high risk classification'}
                unit={isAr ? 'يوم' : 'days'}
                min={0}
                max={730}
              />

              <SettingsConfigNumber
                configKey="delay_severe_days"
                fallback={180}
                label={isAr ? 'أيام التأخير الشديد' : 'Severe Delay Days'}
                description={isAr ? 'عدد أيام التأخير للتصنيف الشديد' : 'Number of delay days for severe classification'}
                unit={isAr ? 'يوم' : 'days'}
                min={0}
                max={1095}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 4: Loan & Amounts ─────────────────────────────── */}
        <TabsContent value="loan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <Landmark className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'القروض والمبالغ' : 'Loan & Amount Limits'}
              </CardTitle>
              <CardDescription>{isAr ? 'مدة القرض وحدود المبالغ' : 'Loan duration and amount limits'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SectionLabel>{isAr ? 'مدة القرض' : 'Loan Duration'}</SectionLabel>

              <SettingsConfigNumber
                configKey="max_loan_duration_months"
                fallback={360}
                label={isAr ? 'الحد الأقصى لمدة القرض' : 'Max Loan Duration'}
                description={isAr ? 'الحد الأقصى لمدة القرض بالأشهر' : 'Maximum loan duration in months'}
                unit={isAr ? 'شهر' : 'mo'}
                min={1}
                max={600}
              />

              <SettingsConfigNumber
                configKey="min_loan_duration_months"
                fallback={12}
                label={isAr ? 'الحد الأدنى لمدة القرض' : 'Min Loan Duration'}
                description={isAr ? 'الحد الأدنى لمدة القرض بالأشهر' : 'Minimum loan duration in months'}
                unit={isAr ? 'شهر' : 'mo'}
                min={1}
                max={120}
              />

              <Separator />

              <SectionLabel>{isAr ? 'حدود المبالغ' : 'Amount Limits'}</SectionLabel>

              <SettingsConfigNumber
                configKey="max_grant_amount"
                fallback={800000}
                label={isAr ? 'الحد الأقصى لمبلغ المنحة' : 'Max Grant Amount'}
                description={isAr ? 'الحد الأقصى لمبلغ المنحة بالدرهم' : 'Maximum grant amount in AED'}
                unit="AED"
                min={0}
                max={2000000}
                step={10000}
              />

              <SettingsConfigNumber
                configKey="max_housing_loan_amount"
                fallback={1000000}
                label={isAr ? 'الحد الأقصى لمبلغ القرض الإسكافي' : 'Max Housing Loan Amount'}
                description={isAr ? 'الحد الأقصى لمبلغ القرض الإسكافي بالدرهم' : 'Maximum housing loan amount in AED'}
                unit="AED"
                min={0}
                max={5000000}
                step={10000}
              />

              <SettingsConfigNumber
                configKey="max_maintenance_amount"
                fallback={300000}
                label={isAr ? 'الحد الأقصى لمبلغ الصيانة' : 'Max Maintenance Amount'}
                description={isAr ? 'الحد الأقصى لمبلغ الصيانة بالدرهم' : 'Maximum maintenance amount in AED'}
                unit="AED"
                min={0}
                max={2000000}
                step={5000}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 5: Automation ─────────────────────────────────── */}
        <TabsContent value="automation">
          <div className="space-y-4">
            {/* Auto Approve */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Cpu className="w-5 h-5 text-green-600" />
                  {isAr ? 'الموافقة التلقائية' : 'Auto Approve'}
                </CardTitle>
                <CardDescription>{isAr ? 'الموافقة التلقائية على الطلبات ذات المخاطر المنخفضة' : 'Automatically approve low-risk requests'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingsConfigSwitch
                  configKey="auto_approve_enabled"
                  fallback="false"
                  label={isAr ? 'تفعيل الموافقة التلقائية' : 'Auto Approve Enabled'}
                  description={isAr ? 'الموافقة تلقائياً على الطلبات المؤهلة' : 'Automatically approve eligible requests'}
                />

                <Separator />

                <SettingsConfigNumber
                  configKey="auto_approve_max_risk_score"
                  fallback={30}
                  label={isAr ? 'الحد الأقصى لدرجة المخاطر' : 'Max Risk Score'}
                  description={isAr ? 'الحد الأقصى لدرجة المخاطر للموافقة التلقائية' : 'Maximum risk score for auto-approval'}
                  unit="pts"
                  min={0}
                  max={100}
                />

                <SettingsConfigNumber
                  configKey="auto_approve_max_dbr"
                  fallback={0.4}
                  label={isAr ? 'الحد الأقصى لنسبة عبء الدين' : 'Max DBR'}
                  description={isAr ? 'الحد الأقصى لنسبة عبء الدين للموافقة التلقائية' : 'Maximum DBR for auto-approval'}
                  unit="%"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  isPercentage
                />

                <SettingsConfigNumber
                  configKey="auto_approve_max_delay_days"
                  fallback={30}
                  label={isAr ? 'الحد الأقصى لأيام التأخير' : 'Max Delay Days'}
                  description={isAr ? 'الحد الأقصى لأيام التأخير للموافقة التلقائية' : 'Maximum delay days for auto-approval'}
                  unit={isAr ? 'يوم' : 'days'}
                  min={0}
                  max={365}
                />

                <Separator />

                <SettingsConfigSwitch
                  configKey="auto_approve_gov_only"
                  fallback="false"
                  label={isAr ? 'موظفو الحكومة فقط' : 'Government Employees Only'}
                  description={isAr ? 'الموافقة التلقائية لموظفي الحكومة فقط' : 'Only auto-approve government employees'}
                />
              </CardContent>
            </Card>

            {/* Auto Reject */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Cpu className="w-5 h-5 text-red-600" />
                  {isAr ? 'الرفض التلقائي' : 'Auto Reject'}
                </CardTitle>
                <CardDescription>{isAr ? 'الرفض التلقائي للطلبات عالية المخاطر' : 'Automatically reject high-risk requests'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingsConfigSwitch
                  configKey="auto_reject_enabled"
                  fallback="false"
                  label={isAr ? 'تفعيل الرفض التلقائي' : 'Auto Reject Enabled'}
                  description={isAr ? 'رفض الطلبات تلقائياً بناءً على المعايير' : 'Automatically reject requests based on criteria'}
                />

                <Separator />

                <SettingsConfigNumber
                  configKey="auto_reject_min_dbr"
                  fallback={0.7}
                  label={isAr ? 'الحد الأدنى لنسبة عبء الدين' : 'Min DBR for Rejection'}
                  description={isAr ? 'الحد الأدنى لنسبة عبء الدين للرفض التلقائي' : 'Minimum DBR ratio for auto-rejection'}
                  unit="%"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  isPercentage
                />

                <SettingsConfigNumber
                  configKey="auto_reject_min_risk_score"
                  fallback={80}
                  label={isAr ? 'الحد الأدنى لدرجة المخاطر' : 'Min Risk Score for Rejection'}
                  description={isAr ? 'الحد الأدنى لدرجة المخاطر للرفض التلقائي' : 'Minimum risk score for auto-rejection'}
                  unit="pts"
                  min={0}
                  max={100}
                />

                <SettingsConfigNumber
                  configKey="auto_reject_min_delay_days"
                  fallback={180}
                  label={isAr ? 'الحد الأدنى لأيام التأخير' : 'Min Delay Days for Rejection'}
                  description={isAr ? 'الحد الأدنى لأيام التأخير للرفض التلقائي' : 'Minimum delay days for auto-rejection'}
                  unit={isAr ? 'يوم' : 'days'}
                  min={0}
                  max={1095}
                />

                <Separator />

                <SettingsConfigSwitch
                  configKey="auto_reject_non_citizen"
                  fallback="false"
                  label={isAr ? 'رفض غير المواطنين' : 'Reject Non-Citizens'}
                  description={isAr ? 'رفض الطلبات من غير المواطنين تلقائياً' : 'Automatically reject requests from non-citizens'}
                />
              </CardContent>
            </Card>

            {/* Human Review */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Cpu className="w-5 h-5 text-amber-600" />
                  {isAr ? 'المراجعة البشرية' : 'Human Review'}
                </CardTitle>
                <CardDescription>{isAr ? 'عتبات المراجعة البشرية' : 'Thresholds that trigger human review'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingsConfigNumber
                  configKey="human_review_risk_threshold"
                  fallback={60}
                  label={isAr ? 'عتبة المخاطر للمراجعة' : 'Risk Threshold for Review'}
                  description={isAr ? 'درجة المخاطر فوق هذا الحد تتطلب مراجعة بشرية' : 'Risk score above this requires human review'}
                  unit="pts"
                  min={0}
                  max={100}
                />

                <SettingsConfigNumber
                  configKey="human_review_dbr_threshold"
                  fallback={0.5}
                  label={isAr ? 'عتبة نسبة عبء الدين للمراجعة' : 'DBR Threshold for Review'}
                  description={isAr ? 'نسبة عبء الدين فوق هذا الحد تتطلب مراجعة بشرية' : 'DBR above this requires human review'}
                  unit="%"
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  isPercentage
                />

                <SettingsConfigNumber
                  configKey="human_review_delay_days"
                  fallback={90}
                  label={isAr ? 'أيام التأخير للمراجعة' : 'Delay Days for Review'}
                  description={isAr ? 'أيام التأخير فوق هذا الحد تتطلب مراجعة بشرية' : 'Delay days above this requires human review'}
                  unit={isAr ? 'يوم' : 'days'}
                  min={0}
                  max={730}
                />

                <SettingsConfigNumber
                  configKey="human_review_estimated_days"
                  fallback={5}
                  label={isAr ? 'أيام المراجعة المقدرة' : 'Estimated Review Days'}
                  description={isAr ? 'العدد المقدر من أيام المراجعة البشرية' : 'Estimated number of business days for human review'}
                  unit={isAr ? 'يوم' : 'days'}
                  min={1}
                  max={30}
                />
              </CardContent>
            </Card>

            {/* AI Analysis Mode */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Bot className="w-5 h-5 text-ae-gold-500" />
                  {isAr ? 'تحليل الذكاء الاصطناعي' : 'AI Analysis'}
                </CardTitle>
                <CardDescription>{isAr ? 'إعدادات تحليل شهادة الراتب بالذكاء الاصطناعي' : 'AI salary certificate analysis settings'}</CardDescription>
              </CardHeader>
              <CardContent>
                <SettingsConfigSelect
                  configKey="ai_analysis_mode"
                  fallback="optional"
                  label={isAr ? 'وضع تحليل الذكاء الاصطناعي' : 'AI Analysis Mode'}
                  description={isAr ? 'ما إذا كان تحليل شهادة الراتب بالذكاء الاصطناعي اختياريًا أو مطلوبًا' : 'Whether AI analysis of salary certificates is optional or required'}
                  options={[
                    { value: 'optional', label: isAr ? 'اختياري (يمكن التخطي)' : 'Optional (Customer can skip)' },
                    { value: 'required', label: isAr ? 'مطلوب (يجب التحليل)' : 'Required (Must analyze)' },
                    { value: 'disabled', label: isAr ? 'معطل' : 'Disabled' },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 6: Employer & Grace Period ────────────────────── */}
        <TabsContent value="employer-grace">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Building2 className="w-5 h-5 text-ae-gold-500" />
                  {isAr ? 'أوزان جهة العمل' : 'Employer Weights'}
                </CardTitle>
                <CardDescription>{isAr ? 'أوزان تصنيف جهة العمل المستخدمة في حساب المخاطر' : 'Employer classification weights used in risk calculation'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingsConfigNumber
                  configKey="employer_weight_government"
                  fallback={1.0}
                  label={isAr ? 'وزن جهة الحكومة' : 'Government Employer Weight'}
                  description={isAr ? 'وزن تصنيف الموظف الحكومي (1.0 = أفضل)' : 'Government employee classification weight (1.0 = best)'}
                  min={0}
                  max={2}
                  step={0.1}
                  decimals={1}
                />

                <SettingsConfigNumber
                  configKey="employer_weight_semi_government"
                  fallback={0.8}
                  label={isAr ? 'وزن جهة شبه حكومية' : 'Semi-Government Employer Weight'}
                  description={isAr ? 'وزن تصنيف الموظف شبه الحكومي' : 'Semi-government employee classification weight'}
                  min={0}
                  max={2}
                  step={0.1}
                  decimals={1}
                />

                <SettingsConfigNumber
                  configKey="employer_weight_private"
                  fallback={0.5}
                  label={isAr ? 'وزن جهة القطاع الخاص' : 'Private Sector Employer Weight'}
                  description={isAr ? 'وزن تصنيف موظف القطاع الخاص' : 'Private sector employee classification weight'}
                  min={0}
                  max={2}
                  step={0.1}
                  decimals={1}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Clock className="w-5 h-5 text-ae-gold-500" />
                  {isAr ? 'فترة السماح' : 'Grace Period'}
                </CardTitle>
                <CardDescription>{isAr ? 'فترات السماح لأنواع مختلفة من الحالات' : 'Grace periods for different case types'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                <SettingsConfigNumber
                  configKey="max_grace_period_months"
                  fallback={6}
                  label={isAr ? 'الحد الأقصى لفترة السماح' : 'Max Grace Period'}
                  description={isAr ? 'الحد الأقصى لفترة السماح بالأشهر' : 'Maximum grace period in months'}
                  unit={isAr ? 'شهر' : 'mo'}
                  min={0}
                  max={24}
                />

                <SettingsConfigNumber
                  configKey="grace_period_for_medical"
                  fallback={12}
                  label={isAr ? 'فترة السماح الطبية' : 'Medical Grace Period'}
                  description={isAr ? 'فترة السماح للحالات الطبية بالأشهر' : 'Grace period for medical cases in months'}
                  unit={isAr ? 'شهر' : 'mo'}
                  min={0}
                  max={36}
                />

                <SettingsConfigNumber
                  configKey="grace_period_for_divorce"
                  fallback={9}
                  label={isAr ? 'فترة السماح للطلاق' : 'Divorce Grace Period'}
                  description={isAr ? 'فترة السماح لحالات الطلاق بالأشهر' : 'Grace period for divorce cases in months'}
                  unit={isAr ? 'شهر' : 'mo'}
                  min={0}
                  max={36}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Tab 7: Documents & Upload ─────────────────────────── */}
        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <Upload className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'المستندات والرفع' : 'Documents & Upload'}
              </CardTitle>
              <CardDescription>{isAr ? 'متطلبات المستندات وإعدادات الرفع' : 'Document requirements and upload settings'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingsConfigSwitch
                configKey="salary_certificate_required"
                fallback="true"
                label={isAr ? 'شهادة الراتب مطلوبة' : 'Salary Certificate Required'}
                description={isAr ? 'يتطلب من العملاء رفع شهادة راتب مع طلب إعادة الجدولة' : 'Require customers to upload a salary certificate with their rescheduling request'}
              />

              <Separator />

              <SettingsConfigNumber
                configKey="max_file_upload_size_mb"
                fallback={10}
                label={isAr ? 'الحد الأقصى لحجم الملف' : 'Max File Upload Size'}
                description={isAr ? 'الحد الأقصى لحجم الملف المرفوع بالميجابايت' : 'Maximum file upload size in megabytes'}
                unit="MB"
                min={1}
                max={100}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 8: Features ─────────────────────────────────────── */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-ae-black-700">
                <MessageSquare className="w-5 h-5 text-ae-gold-500" />
                {isAr ? 'الميزات والروبوتات' : 'Features & Chatbots'}
              </CardTitle>
              <CardDescription>{isAr ? 'التحكم في ظهور روبوت المحادثة والمساعد الذكي' : 'Control visibility of the customer chatbot and admin AI assistant'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              <SettingsConfigSwitch
                configKey="customer_chatbot_enabled"
                fallback="true"
                label={isAr ? 'تفعيل روبوت المحادثة للعملاء' : 'Enable Customer Chatbot'}
                description={isAr ? 'عرض أداة روبوت المحادثة على بوابة العملاء' : 'Show the AI chatbot widget on the customer portal'}
              />

              <Separator />

              <SettingsConfigSwitch
                configKey="admin_chatbot_enabled"
                fallback="true"
                label={isAr ? 'تفعيل المساعد الذكي للإدارة' : 'Enable Admin AI Assistant'}
                description={isAr ? 'عرض لوحة المساعد الذكي في لوحة الإدارة' : 'Show the AI assistant panel in the admin dashboard'}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Tab 9: System Actions ─────────────────────────────── */}
        <TabsContent value="system">
          <div className="space-y-4">
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Database className="w-5 h-5 text-amber-500" />
                  {isAr ? 'إجراءات قاعدة البيانات' : 'Database Seed Actions'}
                </CardTitle>
                <CardDescription>{isAr ? 'إعادة تعيين أو إنشاء بيانات افتراضية' : 'Reset or create default data records'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {isAr ? 'هذه الأزرار تنشئ بيانات افتراضية فقط إذا لم تكن موجودة بالفعل. لن تؤدي إلى الكتابة فوق البيانات الموجودة.' : 'These buttons create default data only if it does not already exist. They will not overwrite existing data.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <SeedButton
                    endpoint="/api/auth/seed-admin"
                    label="Seed Default Admin"
                    labelAr="إنشاء المسؤول الافتراضي"
                    icon={Shield}
                  />
                  <SeedButton
                    endpoint="/api/system-config/seed"
                    label="Seed Default Config"
                    labelAr="إنشاء الإعدادات الافتراضية"
                    icon={Settings2}
                  />
                  <SeedButton
                    endpoint="/api/form-fields/seed"
                    label="Seed Default Form Fields"
                    labelAr="إنشاء حقول النموذج الافتراضية"
                    icon={FileText}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-ae-black-700">
                  <Scale className="w-5 h-5 text-ae-gold-500" />
                  {isAr ? 'معلومات النظام' : 'System Information'}
                </CardTitle>
                <CardDescription>{isAr ? 'معلومات النظام للقراءة فقط' : 'Read-only system information'}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'إصدار النظام' : 'System Version'}</p>
                    <p className="font-medium text-ae-black-700">{configs.system_version?.configValue || '9.0.0'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'محرك القواعد' : 'Rules Engine'}</p>
                    <p className="font-medium text-ae-black-700">{isAr ? 'قرار مجلس الوزراء 61/2021' : 'Cabinet Resolution 61/2021'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'الإطار التنظيمي' : 'Regulatory Framework'}</p>
                    <p className="font-medium text-ae-black-700">{isAr ? 'برنامج الشيخ زايد / وزارة الطاقة' : 'SZHP / MoEI'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'إجمالي السجلات' : 'Total Records'}</p>
                    <p className="font-medium text-ae-black-700">
                      {dbStats ? dbStats.totalRecords.toLocaleString() : (isAr ? 'جاري التحميل...' : 'Loading...')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'إعدادات النظام المحملة' : 'Loaded Config Keys'}</p>
                    <p className="font-medium text-ae-black-700">{Object.keys(configs).length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isAr ? 'إصدار النموذج' : 'Schema Version'}</p>
                    <p className="font-medium text-ae-black-700">v2.1</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
