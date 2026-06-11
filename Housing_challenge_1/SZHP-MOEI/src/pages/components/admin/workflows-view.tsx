'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { motion } from 'framer-motion'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from '@/hooks/use-toast'
import { FieldRulesTab } from '@/components/admin/field-rules-tab'
import {
  ShieldAlert, DollarSign, UserCheck, CheckCircle2, XCircle, Users,
  Briefcase, Clock, FileText, Database, AlertTriangle, Save, RotateCcw,
  PieChart, Globe, BarChart3, Search, SlidersHorizontal, X, Eye, Info,
  Calculator
} from 'lucide-react'

// Category descriptions for SZHP housing arrears rescheduling context
const categoryDescriptions: Record<string, { en: string; ar: string }> = {
  dbr_limits: {
    en: 'Debt Burden Ratio limits for SZHP rescheduling eligibility. The 20% deduction rule requires DBR not exceed the maximum limit. Cases above max DBR are auto-rejected.',
    ar: 'حدود نسبة عبء الدين لأهلية إعادة الجدولة. قاعدة الخصم 20% تتطلب ألا تتجاوز النسبة الحد الأقصى. الحالات التي تتجاوز الحد تُرفض تلقائياً.'
  },
  risk_thresholds: {
    en: 'Risk score boundaries for automated assessment. Cases are classified as Low/Medium/High/Critical based on these thresholds. Also includes delay day classification rules.',
    ar: 'حدود درجة المخاطر للتقييم الآلي. تُصنف الحالات كمنخفضة/متوسطة/عالية/حرجة بناءً على هذه العتبات. يشمل أيضاً قواعد تصنيف أيام التأخير.'
  },
  loan_limits: {
    en: 'Maximum and minimum limits for housing loans, grants, and maintenance amounts as per SZHP/MOEI regulations. Exceeding these may require special approval.',
    ar: 'الحدود القصوى والدنيا للقروض الإسكانية والمنح ومبالغ الصيانة وفقاً للوائح برنامج الشيخ زايد/وزارة الاقتصاد. تجاوزها قد يتطلب موافقة خاصة.'
  },
  eligibility: {
    en: 'Core eligibility requirements for SZHP housing rescheduling: citizenship, family book, minimum income, and income-per-member threshold (AED 2,500).',
    ar: 'متطلبات الأهلية الأساسية لإعادة جدولة إسكان برنامج الشيخ زايد: الجنسية، دفتر العائلة، الحد الأدنى للدخل، وعتبة الدخل لكل فرد (2500 درهم).'
  },
  auto_approve: {
    en: 'Rules for automatic approval of low-risk SZHP rescheduling cases. Must meet DBR, risk score, and delay day thresholds. Government employees may get preference.',
    ar: 'قواعد الموافقة التلقائية لحالات إعادة الجدولة منخفضة المخاطر. يجب استيفاء عتبات نسبة عبء الدين ودرجة المخاطر وأيام التأخير. قد يحظى الموظفون الحكوميون بالأولوية.'
  },
  auto_reject: {
    en: 'Rules for automatic rejection of ineligible SZHP cases. High DBR, high risk score, excessive delay days, or non-citizenship trigger auto-rejection.',
    ar: 'قواعد الرفض التلقائي للحالات غير المؤهلة. نسبة عبء الدين المرتفعة أو درجة المخاطر العالية أو التأخير المفرط أو غير المواطنة تؤدي للرفض التلقائي.'
  },
  human_review: {
    en: 'Thresholds that trigger mandatory human review for SZHP rescheduling. Cases exceeding DBR, risk, or delay thresholds require manual assessment before decision.',
    ar: 'عتبات تؤدي إلى مراجعة بشرية إلزامية لإعادة الجدولة. الحالات التي تتجاوز عتبات نسبة عبء الدين أو المخاطر أو التأخير تتطلب تقييماً يدوياً قبل القرار.'
  },
  employer_weights: {
    en: 'Risk multipliers by employer type for SZHP assessment. Government (0.8×) = lower risk, Semi-government (1.0×) = neutral, Private (1.3×) = higher risk.',
    ar: 'معاملات المخاطر حسب نوع جهة العمل. حكومي (0.8×) = مخاطر أقل، شبه حكومي (1.0×) = محايد، خاص (1.3×) = مخاطر أعلى.'
  },
  grace_period: {
    en: 'Grace period settings before rescheduled payments begin. Medical and divorce cases get longer grace periods per SZHP humanitarian policy.',
    ar: 'إعدادات فترة السماح قبل بدء الأقساط المعاد جدولتها. تحصل الحالات الطبية والطلاق على فترات سماح أطول وفقاً لسياسة برنامج الشيخ زايد الإنسانية.'
  },
  documents: {
    en: 'Document requirements and upload settings for SZHP rescheduling applications. Salary certificates and AI analysis are key verification tools.',
    ar: 'متطلبات المستندات وإعدادات الرفع لطلبات إعادة الجدولة. شهادات الرواتب وتحليل الذكاء الاصطناعي هي أدوات التحقق الرئيسية.'
  },
  landing_metrics: {
    en: 'Display metrics shown on the public landing page. These are informational and do not affect processing logic.',
    ar: 'مقاييس العرض المعروضة في الصفحة الرئيسية العامة. هذه معلوماتية ولا تؤثر على منطق المعالجة.'
  },
  branding: {
    en: 'System branding and version information displayed across the SZHP/MOEI platform.',
    ar: 'علامة النظام التجاري ومعلومات الإصدار المعروضة عبر منصة برنامج الشيخ زايد/وزارة الاقتصاد.'
  },
  ai_models: {
    en: 'Default AI model selections for text analysis (LLM) and document analysis (VLM) used in SZHP rescheduling assessments.',
    ar: 'اختيارات نموذج الذكاء الاصطناعي الافتراضية لتحليل النصوص وتحليل المستندات المستخدمة في تقييمات إعادة الجدولة.'
  },
}

// Critical boolean configs that should warn when being disabled
const criticalBooleanConfigs = new Set([
  'auto_approve_enabled', 'auto_reject_enabled', 'eligibility_check_enabled',
  'citizenship_required', 'salary_certificate_required',
])

// Validation warnings for out-of-range values
function getValidationWarning(config: any, value: string, isAr: boolean): string | null {
  if (config.valueType === 'number') {
    const num = parseFloat(value)
    if (isNaN(num)) return isAr ? 'قيمة غير صالحة' : 'Invalid number'
    if (config.min !== null && config.min !== undefined && num < config.min) {
      return isAr ? `أقل من الحد الأدنى (${config.min})` : `Below minimum (${config.min})`
    }
    if (config.max !== null && config.max !== undefined && num > config.max) {
      return isAr ? `أعلى من الحد الأقصى (${config.max})` : `Above maximum (${config.max})`
    }
  }
  return null
}

// Preview impact calculator for DBR-related configs
function getPreviewImpact(configKey: string, newValue: string, isAr: boolean): string | null {
  const exampleIncome = 15000
  const exampleDeduction = 6000

  if (configKey === 'max_dbr_limit' || configKey === 'dbr_healthy_limit' || configKey === 'dbr_caution_limit' ||
      configKey === 'auto_approve_max_dbr' || configKey === 'auto_reject_min_dbr' || configKey === 'human_review_dbr_threshold') {
    const limitPct = parseFloat(newValue) * 100
    const currentDBR = ((exampleDeduction / exampleIncome) * 100).toFixed(1)
    if (isNaN(limitPct)) return null

    const isEligible = (exampleDeduction / exampleIncome) <= parseFloat(newValue)

    if (configKey === 'max_dbr_limit') {
      return isAr
        ? `مثال: مواطن دخلهم 15,000 درهم وخصوماتهم 6,000 درهم → نسبة عبء الدين = ${currentDBR}%. بالحد الجديد ${limitPct.toFixed(0)}%، سيكونون: ${isEligible ? 'مؤهلين ✓' : 'غير مؤهلين ✗'}`
        : `Example: A citizen with AED 15,000 income and AED 6,000 deductions → DBR = ${currentDBR}%. With the new limit of ${limitPct.toFixed(0)}%, they would be: ${isEligible ? 'ELIGIBLE ✓' : 'NOT ELIGIBLE ✗'}`
    }
    if (configKey === 'dbr_healthy_limit') {
      const isHealthy = (exampleDeduction / exampleIncome) <= parseFloat(newValue)
      return isAr
        ? `مثال: نسبة عبء الدين ${currentDBR}% → ${isHealthy ? 'صحية (خضراء) ✓' : 'تحذيرية (صفراء/حمراء) ⚠'} بالعتبة الجديدة ${limitPct.toFixed(0)}%`
        : `Example: DBR ${currentDBR}% → ${isHealthy ? 'Healthy (green) ✓' : 'Caution/High risk (yellow/red) ⚠'} with new threshold ${limitPct.toFixed(0)}%`
    }
    if (configKey === 'auto_approve_max_dbr') {
      const canAutoApprove = (exampleDeduction / exampleIncome) <= parseFloat(newValue)
      return isAr
        ? `مثال: نسبة عبء الدين ${currentDBR}% → ${canAutoApprove ? 'يمكن الموافقة تلقائياً ✓' : 'تحتاج مراجعة بشرية ⚠'} بالحد الجديد ${limitPct.toFixed(0)}%`
        : `Example: DBR ${currentDBR}% → ${canAutoApprove ? 'Can be auto-approved ✓' : 'Requires human review ⚠'} with new limit ${limitPct.toFixed(0)}%`
    }
    if (configKey === 'auto_reject_min_dbr') {
      const willBeRejected = (exampleDeduction / exampleIncome) >= parseFloat(newValue)
      return isAr
        ? `مثال: نسبة عبء الدين ${currentDBR}% → ${willBeRejected ? 'سيُرفض تلقائياً ✗' : 'لن يُرفض تلقائياً ✓'} بالعتبة الجديدة ${limitPct.toFixed(0)}%`
        : `Example: DBR ${currentDBR}% → ${willBeRejected ? 'Will be auto-rejected ✗' : 'Will NOT be auto-rejected ✓'} with new threshold ${limitPct.toFixed(0)}%`
    }
    if (configKey === 'human_review_dbr_threshold') {
      const needsReview = (exampleDeduction / exampleIncome) > parseFloat(newValue)
      return isAr
        ? `مثال: نسبة عبء الدين ${currentDBR}% → ${needsReview ? 'تحتاج مراجعة بشرية ⚠' : 'لا تحتاج مراجعة بشرية ✓'} بالعتبة الجديدة ${limitPct.toFixed(0)}%`
        : `Example: DBR ${currentDBR}% → ${needsReview ? 'Needs human review ⚠' : 'No human review needed ✓'} with new threshold ${limitPct.toFixed(0)}%`
    }
  }

  if (configKey === 'risk_threshold_low' || configKey === 'risk_threshold_medium' || configKey === 'risk_threshold_high' ||
      configKey === 'auto_approve_max_risk_score' || configKey === 'auto_reject_min_risk_score' || configKey === 'human_review_risk_threshold') {
    const newThreshold = parseFloat(newValue)
    if (isNaN(newThreshold)) return null
    const exampleRisk = 35

    if (configKey === 'auto_approve_max_risk_score') {
      const canAutoApprove = exampleRisk <= newThreshold
      return isAr
        ? `مثال: درجة مخاطر 35 → ${canAutoApprove ? 'موافقة تلقائية محتملة ✓' : 'تحتاج مراجعة ⚠'} بالحد الجديد ${newThreshold}`
        : `Example: Risk score 35 → ${canAutoApprove ? 'Possible auto-approval ✓' : 'Requires review ⚠'} with new limit ${newThreshold}`
    }
    if (configKey === 'auto_reject_min_risk_score') {
      const willBeRejected = exampleRisk >= newThreshold
      return isAr
        ? `مثال: درجة مخاطر 35 → ${willBeRejected ? 'سيُرفض تلقائياً ✗' : 'لن يُرفض تلقائياً ✓'} بالعتبة الجديدة ${newThreshold}`
        : `Example: Risk score 35 → ${willBeRejected ? 'Will be auto-rejected ✗' : 'Will NOT be auto-rejected ✓'} with new threshold ${newThreshold}`
    }
    if (configKey === 'human_review_risk_threshold') {
      const needsReview = exampleRisk > newThreshold
      return isAr
        ? `مثال: درجة مخاطر 35 → ${needsReview ? 'تحتاج مراجعة بشرية ⚠' : 'لا تحتاج مراجعة ✓'} بالعتبة الجديدة ${newThreshold}`
        : `Example: Risk score 35 → ${needsReview ? 'Needs human review ⚠' : 'No review needed ✓'} with new threshold ${newThreshold}`
    }
  }

  if (configKey === 'income_per_member_threshold') {
    const newThreshold = parseFloat(newValue)
    if (isNaN(newThreshold)) return null
    const exampleIncome = 15000
    const exampleFamilySize = 5
    const incomePerMember = exampleIncome / exampleFamilySize
    const isBelow = incomePerMember < newThreshold
    return isAr
      ? `مثال: دخل 15,000 درهم / أسرة 5 أفراد = ${incomePerMember.toLocaleString()} درهم/فرد → ${isBelow ? 'أقل من العتبة (قد يحصل على خصم إضافي) ✓' : 'أعلى من العتبة ⚠'} بالعتبة الجديدة ${newThreshold.toLocaleString()} درهم`
      : `Example: AED 15,000 income / 5 family members = AED ${incomePerMember.toLocaleString()}/member → ${isBelow ? 'Below threshold (may qualify for extra deduction) ✓' : 'Above threshold ⚠'} with new threshold AED ${newThreshold.toLocaleString()}`
  }

  if (configKey === 'min_monthly_income') {
    const newMin = parseFloat(newValue)
    if (isNaN(newMin)) return null
    return isAr
      ? `مثال: مواطن دخلهم 4,000 درهم → ${4000 >= newMin ? 'مؤهل (فوق الحد الأدنى) ✓' : 'غير مؤهل (أقل من الحد الأدنى) ✗'} بالحد الجديد ${newMin.toLocaleString()} درهم`
      : `Example: A citizen earning AED 4,000 → ${4000 >= newMin ? 'Eligible (above minimum) ✓' : 'NOT eligible (below minimum) ✗'} with new minimum AED ${newMin.toLocaleString()}`
  }

  return null
}

export function WorkflowsView() {
  const { language } = useAppStore()
  const isAr = language === 'ar'

  const [wfSeedOpen, setWfSeedOpen] = useState(false)
  const [configs, setConfigs] = useState<any[]>([])
  const [grouped, setGrouped] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterValueType, setFilterValueType] = useState('all')

  // Track original values to detect changes
  const [originalValues, setOriginalValues] = useState<Record<string, string>>({})
  // Track current edited values
  const [editedValues, setEditedValues] = useState<Record<string, string>>({})

  // Field rules state
  const [formFields, setFormFields] = useState<any[]>([])
  const [editingFieldRule, setEditingFieldRule] = useState<any>(null)

  // Preview Impact state
  const [previewConfig, setPreviewConfig] = useState<string | null>(null)

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/system-config')
      if (res.ok) {
        const data = await res.json() as any
        // API returns grouped object { category: [configs...] }
        // Convert to flat array + grouped map
        const allConfigs: any[] = []
        const groupedMap: Record<string, any[]> = {}
        if (Array.isArray(data)) {
          // If API returns flat array
          for (const c of data) {
            allConfigs.push(c)
            const cat = c.category || 'general'
            if (!groupedMap[cat]) groupedMap[cat] = []
            groupedMap[cat].push(c)
          }
        } else if (typeof data === 'object') {
          // If API returns grouped object { category: [...] }
          for (const [cat, items] of Object.entries(data)) {
            if (Array.isArray(items)) {
              for (const c of items) {
                allConfigs.push(c)
              }
              groupedMap[cat] = items
            }
          }
        }
        setConfigs(allConfigs)
        setGrouped(groupedMap)
        const origMap: Record<string, string> = {}
        const editMap: Record<string, string> = {}
        for (const c of allConfigs) {
          origMap[c.configKey] = c.configValue
          editMap[c.configKey] = c.configValue
        }
        setOriginalValues(origMap)
        setEditedValues(editMap)
      }
    } catch (err) {
      console.error('Failed to fetch configs:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFormFields = useCallback(async () => {
    try {
      const res = await authFetch('/api/form-fields')
      if (res.ok) {
        const data = await res.json() as any
        setFormFields(data)
      }
    } catch (err) {
      console.error('Failed to fetch form fields:', err)
    }
  }, [])

  useEffect(() => {
    fetchConfigs()
    fetchFormFields()
  }, [fetchConfigs, fetchFormFields])

  // Collect unique value types for filter
  const uniqueValueTypes = useMemo(() => {
    const types = new Set<string>()
    configs.forEach((c: any) => { if (c.valueType) types.add(c.valueType) })
    return Array.from(types).sort()
  }, [configs])

  // Filtered configs for display
  const filteredGrouped = useMemo(() => {
    const result: Record<string, any[]> = {}
    for (const [cat, catConfigs] of Object.entries(grouped)) {
      const filtered = catConfigs.filter((c: any) => {
        // Search filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          const matchesName = (c.labelEN || '').toLowerCase().includes(q) ||
            (c.labelAR || '').toLowerCase().includes(q) ||
            (c.configKey || '').toLowerCase().includes(q) ||
            (c.descriptionEN || '').toLowerCase().includes(q) ||
            (c.descriptionAR || '').toLowerCase().includes(q)
          if (!matchesName) return false
        }
        // Category filter
        if (filterCategory !== 'all' && c.category !== filterCategory) return false
        // Value type filter
        if (filterValueType !== 'all' && c.valueType !== filterValueType) return false
        return true
      })
      if (filtered.length > 0) result[cat] = filtered
    }
    return result
  }, [grouped, searchQuery, filterCategory, filterValueType])

  // Active filter count
  const activeFilterCount = [
    searchQuery.trim() !== '',
    filterCategory !== 'all',
    filterValueType !== 'all',
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilterCategory('all')
    setFilterValueType('all')
  }

  // Calculate modified count
  const modifiedKeys = Object.keys(editedValues).filter(
    (key) => editedValues[key] !== originalValues[key]
  )
  const modifiedCount = modifiedKeys.length

  const handleValueChange = (configKey: string, newValue: string, config?: any) => {
    setEditedValues((prev) => ({ ...prev, [configKey]: newValue }))

    // Validation warning for number fields
    if (config && config.valueType === 'number') {
      const warning = getValidationWarning(config, newValue, isAr)
      if (warning) {
        toast({ title: isAr ? 'تحذير: قيمة خارج النطاق' : 'Warning: Out of range', description: warning, variant: 'destructive' })
      }
    }

    // Warning for disabling critical boolean configs
    if (config && config.valueType === 'boolean' && newValue === 'false' && criticalBooleanConfigs.has(configKey)) {
      toast({
        title: isAr ? '⚠ تحذير: إعداد حرج' : '⚠ Warning: Critical Setting',
        description: isAr
          ? `أنت على وشك تعطيل "${config.labelAR}". قد يؤثر هذا على معالجة طلبات إعادة الجدولة.`
          : `You are about to disable "${config.labelEN}". This may affect rescheduling request processing.`,
        variant: 'destructive',
      })
    }
  }

  const handleReset = (configKey: string, defaultValue: string) => {
    setEditedValues((prev) => ({ ...prev, [configKey]: defaultValue }))
  }

  const handleSaveAll = async () => {
    if (modifiedCount === 0) return
    setSaving(true)
    try {
      const updates = modifiedKeys.map((key) => ({
        configKey: key,
        configValue: editedValues[key],
      }))
      const res = await authFetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const data = await res.json() as any
        if (data.success === false) {
          toast({ title: t('admin.workflows.saveFailed', language), variant: 'destructive' })
        } else {
          toast({ title: t('admin.workflows.saved', language) })
        }
        fetchConfigs()
      } else {
        toast({ title: t('admin.workflows.saveFailed', language), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('admin.workflows.saveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      toast({ title: t('admin.workflows.seeding', language) })
      const res = await authFetch('/api/system-config/seed', { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as any
        toast({ title: t('admin.workflows.seedComplete', language), description: data.message })
        fetchConfigs()
      } else {
        toast({ title: t('admin.workflows.seedFailed', language), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('admin.workflows.seedFailed', language), variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }

  // Category metadata: icon, colors
  const categoryMeta: Record<string, { icon: React.ElementType; headerBg: string; headerText: string; iconBg: string; border: string; itemBg: string }> = {
    dbr_limits: { icon: PieChart, headerBg: 'bg-teal-50', headerText: 'text-teal-700', iconBg: 'bg-teal-500/10', border: 'border-teal-200', itemBg: 'bg-teal-50/50' },
    risk_thresholds: { icon: ShieldAlert, headerBg: 'bg-amber-50', headerText: 'text-amber-700', iconBg: 'bg-amber-500/10', border: 'border-amber-200', itemBg: 'bg-amber-50/50' },
    loan_limits: { icon: DollarSign, headerBg: 'bg-green-50', headerText: 'text-green-700', iconBg: 'bg-green-500/10', border: 'border-green-200', itemBg: 'bg-green-50/50' },
    eligibility: { icon: UserCheck, headerBg: 'bg-purple-50', headerText: 'text-purple-700', iconBg: 'bg-purple-500/10', border: 'border-purple-200', itemBg: 'bg-purple-50/50' },
    auto_approve: { icon: CheckCircle2, headerBg: 'bg-green-50', headerText: 'text-green-700', iconBg: 'bg-green-500/10', border: 'border-green-200', itemBg: 'bg-green-50/50' },
    auto_reject: { icon: XCircle, headerBg: 'bg-red-50', headerText: 'text-red-700', iconBg: 'bg-red-500/10', border: 'border-red-200', itemBg: 'bg-red-50/50' },
    human_review: { icon: Users, headerBg: 'bg-amber-50', headerText: 'text-amber-700', iconBg: 'bg-amber-500/10', border: 'border-amber-200', itemBg: 'bg-amber-50/50' },
    employer_weights: { icon: Briefcase, headerBg: 'bg-blue-50', headerText: 'text-blue-700', iconBg: 'bg-blue-500/10', border: 'border-blue-200', itemBg: 'bg-blue-50/50' },
    grace_period: { icon: Clock, headerBg: 'bg-teal-50', headerText: 'text-teal-700', iconBg: 'bg-teal-500/10', border: 'border-teal-200', itemBg: 'bg-teal-50/50' },
    documents: { icon: FileText, headerBg: 'bg-gray-50', headerText: 'text-gray-700', iconBg: 'bg-gray-500/10', border: 'border-gray-200', itemBg: 'bg-gray-50/50' },
    landing_metrics: { icon: BarChart3, headerBg: 'bg-indigo-50', headerText: 'text-indigo-700', iconBg: 'bg-indigo-500/10', border: 'border-indigo-200', itemBg: 'bg-indigo-50/50' },
    branding: { icon: Globe, headerBg: 'bg-rose-50', headerText: 'text-rose-700', iconBg: 'bg-rose-500/10', border: 'border-rose-200', itemBg: 'bg-rose-50/50' },
    ai_models: { icon: Database, headerBg: 'bg-violet-50', headerText: 'text-violet-700', iconBg: 'bg-violet-500/10', border: 'border-violet-200', itemBg: 'bg-violet-50/50' },
  }

  // Category order for display
  const categoryOrder = ['dbr_limits', 'risk_thresholds', 'loan_limits', 'eligibility', 'auto_approve', 'auto_reject', 'human_review', 'employer_weights', 'grace_period', 'documents', 'ai_models', 'landing_metrics', 'branding']

  // Format display value for number type (convert decimal percentages)
  const formatDisplayValue = (value: string, valueType: string, unit?: string | null): string => {
    if (valueType === 'number' && unit === '%') {
      const num = parseFloat(value)
      if (!isNaN(num) && num <= 1) {
        return Math.round(num * 100).toString()
      }
    }
    return value
  }

  // Parse input value back to stored format for percentage
  const parseInputValue = (inputVal: string, valueType: string, unit?: string | null, configKey?: string): string => {
    if (valueType === 'number' && unit === '%') {
      const num = parseFloat(inputVal)
      if (!isNaN(num)) {
        return (num / 100).toString()
      }
    }
    return inputVal
  }

  // Get the display value for an input
  const getDisplayValue = (config: any): string => {
    const currentVal = editedValues[config.configKey] ?? config.configValue
    return formatDisplayValue(currentVal, config.valueType, config.unit)
  }

  // Count modified per category
  const getCategoryModifiedCount = (category: string) => {
    const catConfigs = grouped[category] || []
    return catConfigs.filter((c: any) => editedValues[c.configKey] !== originalValues[c.configKey]).length
  }

  if (loading) {
    return (
      <motion.div key="workflows" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ae-black-700">{t('admin.workflows.title', language)}</h2>
            <p className="text-sm text-ae-black-400">{t('admin.workflows.desc', language)}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-ae-black-100 rounded w-3/4 mb-3" />
                <div className="h-3 bg-ae-black-100 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>
    )
  }

  const totalCategories = Object.keys(grouped).length
  const totalFilteredConfigs = Object.values(filteredGrouped).flat().length

  return (
    <motion.div key="workflows" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">{t('admin.workflows.title', language)}</h2>
          <p className="text-sm text-ae-black-400">{t('admin.workflows.desc', language)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {modifiedCount > 0 && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
              {modifiedCount} {t('admin.workflows.unsavedChanges', language)}
            </Badge>
          )}
          <AlertDialog open={wfSeedOpen} onOpenChange={setWfSeedOpen}>
            <AlertDialogTrigger asChild>
              <Button
                disabled={seeding}
                variant="outline"
                className="border-ae-gold-500 text-ae-gold-600 hover:bg-ae-gold-50"
              >
                <Database className="w-4 h-4 me-1" />
                {seeding ? t('admin.workflows.seeding', language) : t('admin.workflows.seedDefaults', language)}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-ae-gold-500" />
                  {t('admin.confirm.seedTitle', language)}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin.confirm.seedDesc', language)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('admin.confirm.cancel', language)}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                  onClick={handleSeed}
                >
                  {t('admin.confirm.seedProceed', language)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            onClick={handleSaveAll}
            disabled={saving || modifiedCount === 0}
            className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white disabled:opacity-50"
          >
            <Save className="w-4 h-4 me-1" />
            {saving ? t('admin.workflows.saving', language) : t('admin.workflows.saveAll', language)}
          </Button>
        </div>
      </div>

      {/* Tabbed Layout: System Rules + Field Rules */}
      <Tabs defaultValue="systemRules" className="w-full">
        <TabsList className="w-full max-w-md grid grid-cols-2">
          <TabsTrigger value="systemRules" className="gap-1.5">
            <Database className="w-4 h-4" />
            {t('admin.workflows.systemRules', language)}
          </TabsTrigger>
          <TabsTrigger value="fieldRules" className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {t('admin.workflows.fieldRules', language)}
          </TabsTrigger>
        </TabsList>

        {/* System Rules Tab — existing content */}
        <TabsContent value="systemRules" className="space-y-6 mt-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-ae-gold-200 bg-ae-gold-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-ae-gold-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-ae-gold-700">{configs.length}</div>
                  <div className="text-xs text-ae-gold-600">{t('admin.workflows.totalRules', language)}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-teal-200 bg-teal-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/10 flex items-center justify-center">
                  <PieChart className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-teal-700">{totalCategories}</div>
                  <div className="text-xs text-teal-600">{t('admin.workflows.categories', language)}</div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-amber-700">{modifiedCount}</div>
                  <div className="text-xs text-amber-600">{t('admin.workflows.modified', language)}</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ae-black-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث بالاسم أو المفتاح...' : 'Search by name or key...'}
                  className="ps-9 pe-9"
                />
                {searchQuery && (
                  <button type="button" className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery('')}>
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={isAr ? 'جميع الفئات' : 'All Categories'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? 'جميع الفئات' : 'All Categories'}</SelectItem>
                  {categoryOrder.map(cat => {
                    if (!grouped[cat] || grouped[cat].length === 0) return null
                    return (
                      <SelectItem key={cat} value={cat}>
                        {t(`admin.workflows.cat.${cat}`, language)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Select value={filterValueType} onValueChange={setFilterValueType}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder={isAr ? 'جميع الأنواع' : 'All Types'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{isAr ? 'جميع الأنواع' : 'All Types'}</SelectItem>
                  {uniqueValueTypes.map(type => (
                    <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active Filters */}
            {activeFilterCount > 0 && (
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {isAr ? `${totalFilteredConfigs} من ${configs.length} قاعدة` : `${totalFilteredConfigs} of ${configs.length} rules`}
                </span>
                {filterCategory !== 'all' && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    {t(`admin.workflows.cat.${filterCategory}`, language)}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterCategory('all')} />
                  </Badge>
                )}
                {filterValueType !== 'all' && (
                  <Badge variant="secondary" className="text-xs gap-1 capitalize">
                    {filterValueType}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterValueType('all')} />
                  </Badge>
                )}
                {searchQuery && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    &quot;{searchQuery}&quot;
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearchQuery('')} />
                  </Badge>
                )}
                <Button variant="ghost" size="sm" className="text-xs h-6 px-2 text-muted-foreground" onClick={clearAllFilters}>
                  {isAr ? 'مسح الكل' : 'Clear all'}
                </Button>
              </div>
            )}
          </div>

          {/* Empty state for configs */}
          {configs.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-ae-black-400">
                <Database className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium mb-1">{t('admin.workflows.noConfigs', language)}</p>
                <p className="text-sm mb-4">{t('admin.workflows.noConfigsDesc', language)}</p>
                <AlertDialog open={wfSeedOpen} onOpenChange={setWfSeedOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={seeding}
                      className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                    >
                      <Database className="w-4 h-4 me-2" />
                      {seeding ? t('admin.workflows.seeding', language) : t('admin.workflows.seedDefaults', language)}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-ae-gold-500" />
                        {t('admin.confirm.seedTitle', language)}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('admin.confirm.seedDesc', language)}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('admin.confirm.cancel', language)}</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                        onClick={handleSeed}
                      >
                        {t('admin.confirm.seedProceed', language)}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ) : (
            /* Category Cards */
            <div className="space-y-6">
              {totalFilteredConfigs === 0 && configs.length > 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-ae-black-400">
                    <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium mb-1">{isAr ? 'لا توجد نتائج' : 'No results found'}</p>
                    <p className="text-sm mb-4">{isAr ? 'حاول تعديل معايير البحث أو التصفية' : 'Try adjusting your search or filter criteria'}</p>
                    <Button variant="outline" onClick={clearAllFilters} className="border-ae-gold-500 text-ae-gold-600 hover:bg-ae-gold-50">
                      {isAr ? 'مسح التصفية' : 'Clear Filters'}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
              categoryOrder.map((category) => {
                const catConfigs = filteredGrouped[category]
                if (!catConfigs || catConfigs.length === 0) return null
                const meta = categoryMeta[category] || categoryMeta.dbr_limits
                const Icon = meta.icon
                const catModified = getCategoryModifiedCount(category)
                const catDesc = categoryDescriptions[category]

                return (
                  <Card key={category} className={`border ${meta.border} overflow-hidden`}>
                    {/* Category Header */}
                    <div className={`${meta.headerBg} px-4 py-3 border-b ${meta.border}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg ${meta.iconBg} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${meta.headerText}`} />
                          </div>
                          <CardTitle className={`text-sm font-semibold truncate ${meta.headerText}`}>
                            {t(`admin.workflows.cat.${category}`, language)}
                          </CardTitle>
                          <Badge variant="outline" className={`text-[10px] ${meta.headerText} border-current/30`}>
                            {catConfigs.length}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {catModified > 0 && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-100">
                              {catModified} {t('admin.workflows.modified', language)}
                            </Badge>
                          )}
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className={`h-6 w-6 p-0 ${meta.headerText} hover:bg-white/50`}>
                                  <Info className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-sm text-xs">
                                {isAr ? catDesc?.ar : catDesc?.en}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                      {/* Category description */}
                      {catDesc && (
                        <p className={`text-xs mt-1.5 leading-relaxed ${meta.headerText} opacity-80`}>
                          {isAr ? catDesc.ar : catDesc.en}
                        </p>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {catConfigs.map((config: any) => {
                          const isModified = editedValues[config.configKey] !== originalValues[config.configKey]
                          const displayVal = getDisplayValue(config)
                          const validationWarning = getValidationWarning(config, editedValues[config.configKey] ?? config.configValue, isAr)
                          const hasPreviewImpact = getPreviewImpact(config.configKey, editedValues[config.configKey] ?? config.configValue, isAr) !== null
                          const isCriticalBool = config.valueType === 'boolean' && criticalBooleanConfigs.has(config.configKey)

                          return (
                            <div
                              key={config.configKey}
                              className={`p-3 rounded-lg border transition-all ${
                                isModified
                                  ? 'border-ae-gold-300 bg-ae-gold-50/50 ring-1 ring-ae-gold-200'
                                  : validationWarning
                                  ? 'border-red-200 bg-red-50/30'
                                  : `${meta.itemBg} border-ae-black-100`
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium text-ae-black-700">
                                      {isAr ? config.labelAR : config.labelEN}
                                    </span>
                                    {isModified && (
                                      <Badge className="text-[9px] px-1 py-0 h-4 bg-ae-gold-500 text-white hover:bg-ae-gold-500">
                                        •
                                      </Badge>
                                    )}
                                    {isCriticalBool && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex"><AlertTriangle className="w-3 h-3 text-amber-500" /></span>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs">
                                            {isAr ? 'إعداد حرج - التعطيل قد يؤثر على المعالجة' : 'Critical setting — disabling may affect processing'}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                    {hasPreviewImpact && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              type="button"
                                              className="inline-flex text-ae-gold-500 hover:text-ae-gold-600"
                                              onClick={() => setPreviewConfig(previewConfig === config.configKey ? null : config.configKey)}
                                            >
                                              <Eye className="w-3.5 h-3.5" />
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs">
                                            {isAr ? 'معاينة التأثير' : 'Preview Impact'}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                  <p className="text-xs text-ae-black-400 leading-snug break-words">
                                    {isAr ? config.descriptionAR : config.descriptionEN}
                                  </p>
                                </div>
                                {isModified && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-xs text-ae-black-400 hover:text-ae-gold-600 shrink-0"
                                    onClick={() => handleReset(config.configKey, config.defaultValue)}
                                    title={t('admin.workflows.resetToDefault', language)}
                                  >
                                    <RotateCcw className="w-3 h-3 me-0.5" />
                                    {t('admin.workflows.reset', language)}
                                  </Button>
                                )}
                              </div>

                              {/* Validation warning */}
                              {validationWarning && (
                                <p className="text-xs text-red-500 mb-1 flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {validationWarning}
                                </p>
                              )}

                              {/* Value Editor */}
                              <div className="flex items-center gap-2">
                                {config.valueType === 'boolean' ? (
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={editedValues[config.configKey] === 'true'}
                                      onCheckedChange={(checked) =>
                                        handleValueChange(config.configKey, checked ? 'true' : 'false', config)
                                      }
                                    />
                                    <span className={`text-xs ${isCriticalBool && editedValues[config.configKey] !== 'true' ? 'text-red-500 font-medium' : 'text-ae-black-500'}`}>
                                      {editedValues[config.configKey] === 'true'
                                        ? (isAr ? 'مفعّل' : 'Enabled')
                                        : (isAr ? 'معطّل' : 'Disabled')}
                                    </span>
                                  </div>
                                ) : config.valueType === 'number' ? (
                                  <div className="flex items-center gap-1.5 flex-1">
                                    <Input
                                      type="number"
                                      value={displayVal}
                                      onChange={(e) => {
                                        const newVal = parseInputValue(e.target.value, config.valueType, config.unit, config.configKey)
                                        handleValueChange(config.configKey, newVal, config)
                                      }}
                                      min={config.unit === '%' && config.min !== null ? config.min * 100 : config.min ?? undefined}
                                      max={config.unit === '%' && config.max !== null ? config.max * 100 : config.max ?? undefined}
                                      step={config.unit === '%' ? 1 : undefined}
                                      className={`text-sm h-8 w-24 sm:w-28 ${validationWarning ? 'border-red-300 focus-visible:ring-red-300' : ''}`}
                                    />
                                    {config.unit && (
                                      <span className="text-xs text-ae-black-400 font-medium whitespace-nowrap">
                                        {config.unit}
                                      </span>
                                    )}
                                    {(config.min !== null || config.max !== null) && (
                                      <span className="text-xs text-ae-black-300 whitespace-nowrap">
                                        [{config.unit === '%' && config.min !== null ? Math.round(config.min * 100) : config.min ?? '—'}–{config.unit === '%' && config.max !== null ? Math.round(config.max * 100) : config.max ?? '—'}]
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Input
                                    value={editedValues[config.configKey] ?? config.configValue}
                                    onChange={(e) => handleValueChange(config.configKey, e.target.value, config)}
                                    className="text-sm h-8"
                                  />
                                )}
                              </div>

                              {/* Preview Impact Section */}
                              {previewConfig === config.configKey && hasPreviewImpact && (
                                <div className="mt-2 p-2 rounded-md bg-ae-gold-50 border border-ae-gold-200">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Calculator className="w-3 h-3 text-ae-gold-600" />
                                    <span className="text-[10px] font-semibold text-ae-gold-700 uppercase tracking-wider">
                                      {isAr ? 'تأثير التعديل المقترح' : 'Preview Impact'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-ae-gold-800 leading-relaxed">
                                    {getPreviewImpact(config.configKey, editedValues[config.configKey] ?? config.configValue, isAr)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })
              )}
            </div>
          )}
        </TabsContent>

        {/* Field Rules Tab */}
        <TabsContent value="fieldRules" className="mt-6">
          <FieldRulesTab formFields={formFields} editingField={editingFieldRule} setEditingField={setEditingFieldRule} onRefresh={fetchFormFields} />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
