'use client'

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import {
  Zap,
  Home,
  Fuel,
  Truck,
  Leaf,
  Settings,
  Plus,
  Search,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Database,
  AlertTriangle,
  CheckCircle2,
  X,
  GripVertical,
  Copy,
  Eye,
  EyeOff,
  BarChart3,
  Globe,
  Phone,
  Mail,
  Clock,
  Tag,
  Shield,
  Link,
  Upload,
  FileJson,
  FileSpreadsheet,
  Download,
  ListPlus,
  Rows3,
} from 'lucide-react'

// Lazy-load the heavy sub-panels
const RuleAnalyticsPanel = lazy(() => import('./rule-analytics-panel'))
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { api, checkAuthStatus, setAdminToken, getAdminToken } from '@/lib/api-client'
import { logEmployerAction } from '@/lib/employer-action-logger'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceRuleField {
  id?: string
  fieldKey: string
  labelEn: string
  labelAr: string
  fieldType: string
  required: boolean
  forActions: string[]
  placeholderEn: string
  placeholderAr: string
  validationEn: string
  validationAr: string
  optionsEn: string[]
  optionsAr: string[]
  sortOrder: number
  isActive: boolean
}

interface ServiceRule {
  id: string
  serviceId?: string | null
  nameEn: string
  nameAr: string
  category: string
  descriptionEn: string
  descriptionAr: string
  feeAmount: string | null
  feeCurrency: string
  processingTimeEn: string | null
  processingTimeAr: string | null
  isActive: boolean
  sortOrder: number
  agentInstructionsEn: string
  agentInstructionsAr: string
  requiredActions: string[]
  eligibilityEn: string
  eligibilityAr: string
  fields: ServiceRuleField[]
  createdAt: string
  updatedAt: string
  // New enhanced fields
  priority: string
  tags: string[]
  requiredDocumentsEn: string
  requiredDocumentsAr: string
  serviceUrl: string
  contactPhone: string
  contactEmail: string
  autoResponseEn: string
  autoResponseAr: string
  escalationRules: string
  slaHours: number
  businessHoursEn: string
  businessHoursAr: string
  relatedServices: string
  version: number
}

interface ToastMessage {
  id: string
  type: 'success' | 'error'
  message: string
}

interface CustomCategoryInfo {
  key: string
  labelEn: string
  labelAr: string
  icon: string
  color: string
  border: string
  isCustom: boolean
}

// ─── Category Config ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { key: 'electricity_water', icon: Zap, labelEn: 'Electricity & Water', labelAr: 'الكهرباء والمياه', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-700' },
  { key: 'housing', icon: Home, labelEn: 'Housing', labelAr: 'الإسكان', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', border: 'border-sky-300 dark:border-sky-700' },
  { key: 'petroleum', icon: Fuel, labelEn: 'Petroleum', labelAr: 'البترول', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', border: 'border-red-300 dark:border-red-700' },
  { key: 'transport', icon: Truck, labelEn: 'Transport', labelAr: 'النقل', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-700' },
  { key: 'sustainability', icon: Leaf, labelEn: 'Sustainability', labelAr: 'الاستدامة', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400', border: 'border-teal-300 dark:border-teal-700' },
  { key: 'general', icon: Settings, labelEn: 'General', labelAr: 'عام', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-700' },
] as const

// Icon name to component mapping for custom categories
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Home, Fuel, Truck, Leaf, Settings, Globe, Phone, Mail, Clock, Tag, Shield, Link,
}

const FIELD_TYPES = [
  { value: 'text', labelEn: 'Text', labelAr: 'نص' },
  { value: 'number', labelEn: 'Number', labelAr: 'رقم' },
  { value: 'email', labelEn: 'Email', labelAr: 'بريد إلكتروني' },
  { value: 'phone', labelEn: 'Phone', labelAr: 'هاتف' },
  { value: 'select', labelEn: 'Select (Dropdown)', labelAr: 'قائمة منسدلة' },
  { value: 'date', labelEn: 'Date', labelAr: 'تاريخ' },
  { value: 'file', labelEn: 'File Upload', labelAr: 'رفع ملف' },
  { value: 'textarea', labelEn: 'Long Text', labelAr: 'نص طويل' },
  { value: 'id_number', labelEn: 'Emirates ID', labelAr: 'رقم الهوية' },
] as const

const ACTIONS = ['search', 'add', 'edit', 'delete'] as const

const PRIORITY_OPTIONS = [
  { value: 'low', labelEn: 'Low', labelAr: 'منخفض', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400' },
  { value: 'medium', labelEn: 'Medium', labelAr: 'متوسط', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  { value: 'high', labelEn: 'High', labelAr: 'مرتفع', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'urgent', labelEn: 'Urgent', labelAr: 'عاجل', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
] as const

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCategoryConfig(category: string, customCategories: CustomCategoryInfo[] = []) {
  const builtIn = CATEGORIES.find(c => c.key === category)
  if (builtIn) return builtIn
  const custom = customCategories.find(c => c.key === category)
  if (custom) return { key: custom.key, icon: ICON_MAP[custom.icon] || Settings, labelEn: custom.labelEn, labelAr: custom.labelAr, color: custom.color || 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400', border: custom.border || 'border-gray-300 dark:border-gray-700' }
  return CATEGORIES[CATEGORIES.length - 1]
}

function generateFieldKey(labelEn: string): string {
  return labelEn
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
    .slice(0, 40) || 'field'
}

function createEmptyField(sortOrder: number): ServiceRuleField {
  return {
    fieldKey: '',
    labelEn: '',
    labelAr: '',
    fieldType: 'text',
    required: true,
    forActions: [],
    placeholderEn: '',
    placeholderAr: '',
    validationEn: '',
    validationAr: '',
    optionsEn: [],
    optionsAr: [],
    sortOrder,
    isActive: true,
  }
}

function createEmptyRule(): Partial<ServiceRule> {
  return {
    nameEn: '',
    nameAr: '',
    category: 'electricity_water',
    descriptionEn: '',
    descriptionAr: '',
    feeAmount: '',
    feeCurrency: 'AED',
    processingTimeEn: '',
    processingTimeAr: '',
    isActive: true,
    sortOrder: 0,
    agentInstructionsEn: '',
    agentInstructionsAr: '',
    requiredActions: [],
    eligibilityEn: '',
    eligibilityAr: '',
    fields: [],
    priority: 'medium',
    tags: [],
    requiredDocumentsEn: '',
    requiredDocumentsAr: '',
    serviceUrl: '',
    contactPhone: '',
    contactEmail: '',
    autoResponseEn: '',
    autoResponseAr: '',
    escalationRules: '{}',
    slaHours: 72,
    businessHoursEn: '',
    businessHoursAr: '',
    relatedServices: '[]',
    version: 1,
  }
}

// ─── Toast System ────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border animate-slide-up ${
            toast.type === 'success'
              ? 'bg-uae-green-50 text-uae-green-700 border-uae-green-200 dark:bg-uae-green-900/30 dark:text-uae-green-400 dark:border-uae-green-800'
              : 'bg-uae-red-50 text-uae-red-700 border-uae-red-200 dark:bg-uae-red-900/30 dark:text-uae-red-400 dark:border-uae-red-800'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          <span className="text-sm flex-1">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="shrink-0 hover:opacity-70">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Field Editor Sub-Dialog ─────────────────────────────────────────────────

function FieldEditorDialog({
  open,
  onOpenChange,
  field,
  onSave,
  language,
  isRTL,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: ServiceRuleField
  onSave: (field: ServiceRuleField) => void
  language: string
  isRTL: boolean
}) {
  const [editField, setEditField] = useState<ServiceRuleField>(() => ({ ...field }))

  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setEditField({ ...field })
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const updateField = (key: keyof ServiceRuleField, value: unknown) => {
    setEditField(prev => ({ ...prev, [key]: value }))
  }

  const toggleAction = (action: string) => {
    setEditField(prev => ({
      ...prev,
      forActions: prev.forActions.includes(action)
        ? prev.forActions.filter(a => a !== action)
        : [...prev.forActions, action],
    }))
  }

  const handleSave = () => {
    const fieldToSave = { ...editField }
    if (!fieldToSave.fieldKey && fieldToSave.labelEn) {
      fieldToSave.fieldKey = generateFieldKey(fieldToSave.labelEn)
    }
    onSave(fieldToSave)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-ae-gold-500" />
            {language === 'ar' ? 'تحرير الحقل' : 'Edit Field'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {language === 'ar' ? 'تحرير تفاصيل حقل نموذج الخدمة' : 'Edit service form field details'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Field Key & Type Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'مفتاح الحقل' : 'Field Key'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Input
                value={editField.fieldKey}
                onChange={(e) => updateField('fieldKey', e.target.value)}
                placeholder={language === 'ar' ? 'مثال: emiratesId' : 'e.g. emiratesId'}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                {language === 'ar' ? 'يتم إنشاؤه تلقائياً من الاسم الإنجليزي' : 'Auto-generated from English label'}
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'نوع الحقل' : 'Field Type'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Select value={editField.fieldType} onValueChange={(v) => updateField('fieldType', v)}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>
                      {language === 'ar' ? ft.labelAr : ft.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'التسمية (إنجليزي)' : 'Label (English)'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Input
                value={editField.labelEn}
                onChange={(e) => {
                  updateField('labelEn', e.target.value)
                  if (!editField.fieldKey || editField.fieldKey === generateFieldKey(editField.labelEn.slice(0, -1))) {
                    updateField('fieldKey', generateFieldKey(e.target.value))
                  }
                }}
                placeholder="Emirates ID"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'التسمية (عربي)' : 'Label (Arabic)'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Input
                value={editField.labelAr}
                onChange={(e) => updateField('labelAr', e.target.value)}
                placeholder="رقم الهوية"
                className="text-sm"
                dir="rtl"
              />
            </div>
          </div>

          {/* Required & Actions */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                checked={editField.required}
                onCheckedChange={(v) => updateField('required', v)}
              />
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'مطلوب' : 'Required'}
              </Label>
            </div>
            <Separator orientation="vertical" className="h-5" />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">
                {language === 'ar' ? 'للإجراءات:' : 'For Actions:'}
              </Label>
              <div className="flex gap-3">
                {ACTIONS.map(action => (
                  <label key={action} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={editField.forActions.includes(action)}
                      onCheckedChange={() => toggleAction(action)}
                    />
                    <span className="text-xs capitalize">{action}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Placeholders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'نص مساعد (إنجليزي)' : 'Placeholder (English)'}
              </Label>
              <Input
                value={editField.placeholderEn}
                onChange={(e) => updateField('placeholderEn', e.target.value)}
                placeholder="Enter your Emirates ID"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'نص مساعد (عربي)' : 'Placeholder (Arabic)'}
              </Label>
              <Input
                value={editField.placeholderAr}
                onChange={(e) => updateField('placeholderAr', e.target.value)}
                placeholder="أدخل رقم الهوية"
                className="text-sm"
                dir="rtl"
              />
            </div>
          </div>

          {/* Validation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'قاعدة التحقق (إنجليزي)' : 'Validation Rule (English)'}
              </Label>
              <Input
                value={editField.validationEn}
                onChange={(e) => updateField('validationEn', e.target.value)}
                placeholder="Must be a valid 15-digit Emirates ID"
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                {language === 'ar' ? 'قاعدة التحقق (عربي)' : 'Validation Rule (Arabic)'}
              </Label>
              <Input
                value={editField.validationAr}
                onChange={(e) => updateField('validationAr', e.target.value)}
                placeholder="يجب أن يكون رقم هوية إماراتية صالح من 15 رقم"
                className="text-sm"
                dir="rtl"
              />
            </div>
          </div>

          {/* Options (only for select type) */}
          {editField.fieldType === 'select' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 rounded-lg border border-dashed border-ae-gold-500/40 bg-ae-gold-500/5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {language === 'ar' ? 'الخيارات (إنجليزي) - مفصولة بفواصل' : 'Options (English) - comma separated'}
                </Label>
                <Textarea
                  value={editField.optionsEn.join(', ')}
                  onChange={(e) => updateField('optionsEn', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="Residential, Commercial, Industrial"
                  className="text-sm min-h-[60px]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {language === 'ar' ? 'الخيارات (عربي) - مفصولة بفواصل' : 'Options (Arabic) - comma separated'}
                </Label>
                <Textarea
                  value={editField.optionsAr.join(', ')}
                  onChange={(e) => updateField('optionsAr', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  placeholder="سكني، تجاري، صناعي"
                  className="text-sm min-h-[60px]"
                  dir="rtl"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm">
            {language === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button onClick={handleSave} className="text-sm bg-ae-gold-600 hover:bg-ae-gold-700 text-white" disabled={!editField.fieldKey || !editField.labelEn || !editField.labelAr}>
            {language === 'ar' ? 'حفظ الحقل' : 'Save Field'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Add Category Dialog ─────────────────────────────────────────────────────

function AddCategoryDialog({
  open,
  onOpenChange,
  onSave,
  language,
  isRTL,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { key: string; labelEn: string; labelAr: string; icon: string; color: string; border: string }) => void
  language: string
  isRTL: boolean
}) {
  const [key, setKey] = useState('')
  const [labelEn, setLabelEn] = useState('')
  const [labelAr, setLabelAr] = useState('')
  const [icon, setIcon] = useState('Settings')
  const [color, setColor] = useState('bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400')
  const [border, setBorder] = useState('border-violet-300 dark:border-violet-700')

  const isAr = language === 'ar'

  // Sync state when dialog opens
  const [prevOpen, setPrevOpen] = useState(false)
  if (open && !prevOpen) {
    setKey('')
    setLabelEn('')
    setLabelAr('')
    setIcon('Settings')
    setColor('bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400')
    setBorder('border-violet-300 dark:border-violet-700')
  }
  if (open !== prevOpen) {
    setPrevOpen(open)
  }

  const handleSave = () => {
    if (!key || !labelEn || !labelAr) return
    onSave({ key, labelEn, labelAr, icon, color, border })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-ae-gold-500" />
            {isAr ? 'إضافة فئة جديدة' : 'Add New Category'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isAr ? 'إنشاء فئة خدمة مخصصة جديدة' : 'Create a new custom service category'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Key */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? 'مفتاح الفئة' : 'Category Key'}
              <span className="text-uae-red-500"> *</span>
            </Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="digital_services"
              className="text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              {isAr ? 'أحرف صغيرة وأرقام وشرطات سفلية فقط' : 'Lowercase letters, numbers, and underscores only'}
            </p>
          </div>

          {/* Labels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {isAr ? 'الاسم (إنجليزي)' : 'Label (English)'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Input
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                placeholder="Digital Services"
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                {isAr ? 'الاسم (عربي)' : 'Label (Arabic)'}
                <span className="text-uae-red-500"> *</span>
              </Label>
              <Input
                value={labelAr}
                onChange={(e) => setLabelAr(e.target.value)}
                placeholder="الخدمات الرقمية"
                className="text-sm"
                dir="rtl"
              />
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? 'اسم الأيقونة' : 'Icon Name'}
            </Label>
            <Select value={icon} onValueChange={setIcon}>
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(ICON_MAP).map(iconName => {
                  const IconComp = ICON_MAP[iconName]
                  return (
                    <SelectItem key={iconName} value={iconName}>
                      <span className="flex items-center gap-2">
                        <IconComp className="h-3.5 w-3.5" />
                        {iconName}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? 'فئة اللون' : 'Color Class'}
            </Label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
              className="text-sm font-mono text-[11px]"
            />
          </div>

          {/* Border */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              {isAr ? 'فئة الحدود' : 'Border Class'}
            </Label>
            <Input
              value={border}
              onChange={(e) => setBorder(e.target.value)}
              placeholder="border-violet-300 dark:border-violet-700"
              className="text-sm font-mono text-[11px]"
            />
          </div>

          {/* Preview */}
          <div className="p-3 rounded-lg border border-dashed border-ae-gold-500/40 bg-ae-gold-500/5">
            <Label className="text-xs font-medium text-muted-foreground mb-2 block">
              {isAr ? 'معاينة' : 'Preview'}
            </Label>
            <div className="flex items-center gap-2">
              {(() => {
                const PreviewIcon = ICON_MAP[icon] || Settings
                return (
                  <Badge className={`${color} gap-1 text-[10px] px-1.5 py-0 h-5 font-medium`}>
                    <PreviewIcon className="h-3 w-3" />
                    {isAr ? labelAr || '...' : labelEn || '...'}
                  </Badge>
                )
              })()}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="text-sm">
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            className="text-sm bg-ae-gold-600 hover:bg-ae-gold-700 text-white"
            disabled={!key || !labelEn || !labelAr}
          >
            {isAr ? 'إنشاء الفئة' : 'Create Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ServiceRulesPanel() {
  const { language } = useAppStore()
  const { t, isRTL } = useTranslation()
  const isAr = language === 'ar'

  // Main tab state
  const [mainTab, setMainTab] = useState<'rules' | 'analytics'>('rules')

  // Auth state
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authTokenInput, setAuthTokenInput] = useState('')
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [authVerified, setAuthVerified] = useState(false)

  // State
  const [rules, setRules] = useState<ServiceRule[]>([])
  const [loading, setLoading] = useState(true)

  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus().then(status => {
      setAuthEnabled(status.authEnabled)
      if (!status.authEnabled) {
        setAuthVerified(true) // Dev mode, no auth needed
      } else if (getAdminToken()) {
        setAuthVerified(true) // Already have token
      } else {
        setShowAuthDialog(true) // Need to enter token
      }
    })
  }, [])

  // Custom categories
  const [customCategories, setCustomCategories] = useState<CustomCategoryInfo[]>([])
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)

  // Dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Partial<ServiceRule> | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dialogTab, setDialogTab] = useState('basic')

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ServiceRule | null>(null)

  // Field editor
  const [fieldEditorOpen, setFieldEditorOpen] = useState(false)
  const [editingFieldIndex, setEditingFieldIndex] = useState<number>(-1)

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false)
  const [importMode, setImportMode] = useState<'paste' | 'file' | 'quickAdd'>('paste')
  const [importText, setImportText] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreview, setImportPreview] = useState<Partial<ServiceRule>[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [importWarnings, setImportWarnings] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  // Quick Add state
  const [quickAddCategory, setQuickAddCategory] = useState<string>('electricity_water')
  const [quickAddRules, setQuickAddRules] = useState<Array<{ nameEn: string; nameAr: string; descriptionEn: string; descriptionAr: string }>>([
    { nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '' },
  ])



  // Merged categories: built-in + custom
  const allCategories = useMemo(() => {
    return [
      ...CATEGORIES.map(c => ({
        key: c.key,
        icon: c.icon,
        labelEn: c.labelEn,
        labelAr: c.labelAr,
        color: c.color,
        border: c.border,
        isCustom: false,
      })),
      ...customCategories.map(c => ({
        key: c.key,
        icon: ICON_MAP[c.icon] || Settings,
        labelEn: c.labelEn,
        labelAr: c.labelAr,
        color: c.color || 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400',
        border: c.border || 'border-gray-300 dark:border-gray-700',
        isCustom: true,
      })),
    ]
  }, [customCategories])

  // Toast helpers
  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = `toast-${Date.now()}`
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Auth submit handler
  const handleAuthSubmit = useCallback(() => {
    if (authTokenInput.trim()) {
      setAdminToken(authTokenInput.trim())
      setAuthVerified(true)
      setShowAuthDialog(false)
      addToast('success', isAr ? 'تم التحقق بنجاح' : 'Authentication successful')
    }
  }, [authTokenInput, addToast, isAr])

  // Fetch custom categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/service-categories')
      if (res.ok) {
        const data = await res.json()
        const custom = data.filter((c: { isCustom: boolean }) => c.isCustom).map((c: { key: string; labelEn: string; labelAr: string; icon: string; color: string; border: string; isCustom: boolean }) => ({
          key: c.key,
          labelEn: c.labelEn,
          labelAr: c.labelAr,
          icon: c.icon,
          color: c.color,
          border: c.border,
          isCustom: true,
        } as CustomCategoryInfo))
        setCustomCategories(custom)
      }
    } catch {
      // Silent fail for categories
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // Fetch rules
  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter && categoryFilter !== 'all') {
        params.set('category', categoryFilter)
      }
      const res = await api.get(`/service-rules?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setRules(data)
      } else {
        addToast('error', isAr ? 'فشل في تحميل القواعد' : 'Failed to load service rules')
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال بالخادم' : 'Error connecting to server')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, addToast, isAr])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  // Filtered rules by search
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules
    const q = searchQuery.toLowerCase()
    return rules.filter(
      r => r.nameEn.toLowerCase().includes(q) || r.nameAr.includes(q)
    )
  }, [rules, searchQuery])

  // Category counts - includes custom categories
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: rules.length }
    allCategories.forEach(c => {
      counts[c.key] = rules.filter(r => r.category === c.key).length
    })
    return counts
  }, [rules, allCategories])

  // ─── Actions ─────────────────────────────────────────────────────────────



  const handleToggleActive = async (rule: ServiceRule) => {
    try {
      const res = await api.put(`/service-rules/${rule.id}`, { isActive: !rule.isActive })
      if (res.ok) {
        addToast('success', isAr
          ? (rule.isActive ? 'تم تعطيل القاعدة' : 'تم تفعيل القاعدة')
          : (rule.isActive ? 'Rule deactivated' : 'Rule activated'))
        fetchRules()
      } else {
        addToast('error', isAr ? 'فشل في تحديث الحالة' : 'Failed to update status')
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    }
  }

  const handleOpenCreate = () => {
    setIsCreating(true)
    setEditingRule(createEmptyRule())
    setDialogTab('basic')
    setEditDialogOpen(true)
  }

  const handleOpenEdit = (rule: ServiceRule) => {
    setIsCreating(false)
    setEditingRule({
      ...rule,
      fields: rule.fields.map(f => ({ ...f })),
      // Ensure new fields have defaults if undefined
      priority: rule.priority || 'medium',
      tags: rule.tags || [],
      requiredDocumentsEn: rule.requiredDocumentsEn || '',
      requiredDocumentsAr: rule.requiredDocumentsAr || '',
      serviceUrl: rule.serviceUrl || '',
      contactPhone: rule.contactPhone || '',
      contactEmail: rule.contactEmail || '',
      autoResponseEn: rule.autoResponseEn || '',
      autoResponseAr: rule.autoResponseAr || '',
      escalationRules: rule.escalationRules || '{}',
      slaHours: rule.slaHours || 72,
      businessHoursEn: rule.businessHoursEn || '',
      businessHoursAr: rule.businessHoursAr || '',
      relatedServices: rule.relatedServices || '[]',
      version: rule.version || 1,
    })
    setDialogTab('basic')
    setEditDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await api.delete(`/service-rules/${deleteTarget.id}`)
      if (res.ok) {
        addToast('success', isAr ? 'تم حذف القاعدة بنجاح' : 'Rule deleted successfully')
        logEmployerAction({
          action: 'delete_rule',
          details: { ruleId: deleteTarget.id, ruleName: deleteTarget.nameEn, category: deleteTarget.category },
          targetId: deleteTarget.id,
        })
        fetchRules()
      } else {
        addToast('error', isAr ? 'فشل في حذف القاعدة' : 'Failed to delete rule')
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleSaveRule = async () => {
    if (!editingRule) return
    if (!editingRule.nameEn || !editingRule.nameAr || !editingRule.category) {
      addToast('error', isAr ? 'يرجى ملء الحقول المطلوبة' : 'Please fill required fields')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...editingRule,
        fields: editingRule.fields?.map((f, i) => ({
          ...f,
          sortOrder: i,
          optionsEn: f.optionsEn || [],
          optionsAr: f.optionsAr || [],
          forActions: f.forActions || [],
        })),
      }

      const res = isCreating
        ? await api.post('/service-rules', payload)
        : await api.put(`/service-rules/${(editingRule as ServiceRule).id}`, payload)

      if (res.ok) {
        addToast('success', isCreating
          ? (isAr ? 'تم إنشاء القاعدة بنجاح' : 'Rule created successfully')
          : (isAr ? 'تم تحديث القاعدة بنجاح' : 'Rule updated successfully'))
        logEmployerAction({
          action: isCreating ? 'create_rule' : 'edit_rule',
          details: { ruleId: isCreating ? undefined : (editingRule as ServiceRule).id, ruleName: editingRule.nameEn, category: editingRule.category },
          targetId: isCreating ? undefined : (editingRule as ServiceRule).id,
        })
        setEditDialogOpen(false)
        fetchRules()
      } else {
        const err = await res.json()
        addToast('error', err.error || (isAr ? 'فشل في الحفظ' : 'Failed to save'))
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    } finally {
      setSaving(false)
    }
  }

  // ─── Import Logic ────────────────────────────────────────────────────────

  const IMPORT_TEMPLATE = `[
  {
    "nameEn": "Electricity Connection",
    "nameAr": "ربط الكهرباء",
    "descriptionEn": "New electricity connection request",
    "descriptionAr": "طلب ربط كهرباء جديد",
    "category": "electricity_water",
    "priority": "high",
    "isActive": true,
    "slaMinutes": 480,
    "tags": ["electricity", "connection"],
    "fields": [
      { "key": "location", "type": "text", "labelEn": "Location", "labelAr": "الموقع", "required": true },
      { "key": "propertyType", "type": "select", "labelEn": "Property Type", "labelAr": "نوع العقار", "required": true }
    ]
  }
]`

  // Sample data for pre-filling import
  const SAMPLE_DATA = `[
  {
    "nameEn": "Electricity Bill Payment",
    "nameAr": "دفع فاتورة الكهرباء",
    "category": "electricity_water",
    "descriptionEn": "Pay electricity bills online or at service centers",
    "descriptionAr": "دفع فواتير الكهرباء عبر الإنترنت أو في مراكز الخدمة",
    "feeAmount": "Free",
    "feeCurrency": "AED",
    "processingTimeEn": "Instant",
    "processingTimeAr": "فوري",
    "isActive": true,
    "priority": "high",
    "slaMinutes": 60,
    "tags": ["electricity", "payment", "online"],
    "fields": [
      { "key": "accountNumber", "type": "text", "labelEn": "Account Number", "labelAr": "رقم الحساب", "required": true }
    ]
  },
  {
    "nameEn": "Water Connection Upgrade",
    "nameAr": "ترقية توصيل المياه",
    "category": "electricity_water",
    "descriptionEn": "Upgrade existing water connection capacity for residential or commercial properties",
    "descriptionAr": "ترقية سعة توصيل المياه الحالي للعقارات السكنية أو التجارية",
    "feeAmount": "750",
    "feeCurrency": "AED",
    "processingTimeEn": "5-7 working days",
    "processingTimeAr": "5-7 أيام عمل",
    "isActive": true,
    "priority": "medium",
    "slaMinutes": 1440,
    "tags": ["water", "upgrade", "residential"]
  },
  {
    "nameEn": "Housing Maintenance Request",
    "nameAr": "طلب صيانة إسكان",
    "category": "housing",
    "descriptionEn": "Submit a maintenance request for government housing",
    "descriptionAr": "تقديم طلب صيانة للإسكان الحكومي",
    "feeAmount": "Free",
    "feeCurrency": "AED",
    "processingTimeEn": "2-3 working days",
    "processingTimeAr": "2-3 أيام عمل",
    "isActive": true,
    "priority": "urgent",
    "slaMinutes": 240,
    "tags": ["housing", "maintenance", "government"],
    "fields": [
      { "key": "propertyId", "type": "text", "labelEn": "Property ID", "labelAr": "رقم العقار", "required": true },
      { "key": "issueDescription", "type": "textarea", "labelEn": "Issue Description", "labelAr": "وصف المشكلة", "required": true }
    ]
  }
]`

  // CSV template with headers and one sample row
  const CSV_TEMPLATE = `nameEn,nameAr,category,descriptionEn,descriptionAr,feeAmount,feeCurrency,processingTimeEn,processingTimeAr,isActive,priority,slaMinutes,tags
"Electricity Bill Payment","دفع فاتورة الكهرباء",electricity_water,"Pay electricity bills online or at service centers","دفع فواتير الكهرباء عبر الإنترنت أو في مراكز الخدمة",Free,AED,Instant,فوري,true,high,60,"electricity;payment;online"
"Water Connection Upgrade","ترقية توصيل المياه",electricity_water,"Upgrade existing water connection capacity","ترقية سعة توصيل المياه الحالي",750,AED,"5-7 working days","5-7 أيام عمل",true,medium,1440,"water;upgrade"
"Housing Maintenance Request","طلب صيانة إسكان",housing,"Submit a maintenance request for government housing","تقديم طلب صيانة للإسكان الحكومي",Free,AED,"2-3 working days","2-3 أيام عمل",true,urgent,240,"housing;maintenance"`

  // Download a file helper
  const downloadFile = useCallback((content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [])

  // Robust CSV parser handling RFC 4180 edge cases: quoted fields, commas in values, escaped quotes
  const parseCSVLine = useCallback((line: string): string[] => {
    const values: string[] = []
    let current = ''
    let inQuotes = false
    let i = 0

    while (i < line.length) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"') {
          // Check for escaped quote ""
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"'
            i += 2
            continue
          }
          // End of quoted field
          inQuotes = false
        } else {
          current += char
        }
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      i++
    }
    values.push(current.trim())
    return values
  }, [])

  const parseImportData = useCallback((text: string): { rules: Partial<ServiceRule>[]; errors: string[]; warnings: string[] } => {
    const errors: string[] = []
    const warnings: string[] = []
    let rules: Partial<ServiceRule>[] = []

    const trimmed = text.trim()
    if (!trimmed) {
      errors.push(isAr ? 'لا توجد بيانات للتحليل' : 'No data to parse')
      return { rules: [], errors, warnings }
    }

    // Try JSON parse
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.rules && Array.isArray(parsed.rules)) {
        rules = parsed.rules
      } else if (Array.isArray(parsed)) {
        rules = parsed
      } else {
        errors.push(isAr ? 'البيانات يجب أن تكون مصفوفة من القواعد أو كائن يحتوي على حقل "rules"' : 'Data must be an array of rules or an object with a "rules" field')
        return { rules: [], errors, warnings }
      }
      // Normalize JSON rules: convert simplified fields format and slaMinutes
      rules = rules.map((rule: Record<string, unknown>, idx: number) => {
        const normalized = { ...rule } as Record<string, unknown>
        // Convert slaMinutes → slaHours
        if (normalized.slaMinutes !== undefined && normalized.slaMinutes !== null && normalized.slaHours === undefined) {
          normalized.slaHours = Math.round(Number(normalized.slaMinutes) / 60)
          delete normalized.slaMinutes
        }
        // Convert simplified fields format { key, type, labelEn, labelAr, required }
        // to full format { fieldKey, fieldType, labelEn, labelAr, required }
        if (Array.isArray(normalized.fields)) {
          normalized.fields = (normalized.fields as Record<string, unknown>[]).map((field: Record<string, unknown>, fIdx: number) => {
            if (field.key && !field.fieldKey) {
              return {
                fieldKey: field.key,
                fieldType: field.type || 'text',
                labelEn: field.labelEn || '',
                labelAr: field.labelAr || '',
                required: field.required !== undefined ? field.required : true,
                forActions: field.forActions || [],
                placeholderEn: field.placeholderEn || '',
                placeholderAr: field.placeholderAr || '',
                validationEn: field.validationEn || '',
                validationAr: field.validationAr || '',
                optionsEn: field.optionsEn || [],
                optionsAr: field.optionsAr || [],
                sortOrder: fIdx,
                isActive: true,
              }
            }
            return field
          })
        }
        return normalized as Partial<ServiceRule>
      })
    } catch {
      // Try CSV parse with improved parser
      try {
        // Split lines properly handling multi-line quoted fields
        const lines: string[] = []
        let currentLine = ''
        let inQuotes = false

        for (let i = 0; i < trimmed.length; i++) {
          const char = trimmed[i]
          if (char === '"') {
            if (inQuotes && i + 1 < trimmed.length && trimmed[i + 1] === '"') {
              currentLine += '""'
              i++
            } else {
              inQuotes = !inQuotes
              currentLine += char
            }
          } else if (char === '\n' && !inQuotes) {
            lines.push(currentLine)
            currentLine = ''
          } else if (char === '\r' && !inQuotes) {
            // skip carriage return
          } else {
            currentLine += char
          }
        }
        if (currentLine.trim()) lines.push(currentLine)

        const filteredLines = lines.filter(l => l.trim())
        if (filteredLines.length < 2) {
          errors.push(isAr ? 'ملف CSV يجب أن يحتوي على صف العناوين وصف واحد على الأقل من البيانات' : 'CSV must have a header row and at least one data row')
          return { rules: [], errors, warnings }
        }

        const headers = parseCSVLine(filteredLines[0]).map(h => h.replace(/^"|"$/g, ''))
        const requiredHeaders = ['nameEn', 'nameAr', 'category']
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))
        if (missingHeaders.length > 0) {
          errors.push(isAr ? `أعمدة مفقودة: ${missingHeaders.join(', ')}` : `Missing required columns: ${missingHeaders.join(', ')}`)
          return { rules: [], errors, warnings }
        }

        // Detect duplicate headers
        const seen = new Set<string>()
        headers.forEach(h => {
          if (seen.has(h)) warnings.push(isAr ? `عمود مكرر: "${h}"` : `Duplicate column: "${h}"`)
          seen.add(h)
        })

        for (let i = 1; i < filteredLines.length; i++) {
          if (!filteredLines[i].trim()) continue
          const values = parseCSVLine(filteredLines[i])

          const rule: Record<string, unknown> = {}
          headers.forEach((header, idx) => {
            const val = values[idx] !== undefined ? values[idx] : ''
            // Handle JSON-like fields
            if (['tags', 'requiredActions'].includes(header)) {
              if (val.startsWith('[')) {
                try { rule[header] = JSON.parse(val) } catch { rule[header] = val.split(';').map(s => s.trim()).filter(Boolean) }
              } else {
                rule[header] = val.split(';').map(s => s.trim()).filter(Boolean)
              }
            } else if (['isActive'].includes(header)) {
              rule[header] = val.toLowerCase() === 'true' || val === '1'
            } else if (['slaHours', 'slaMinutes', 'sortOrder', 'version'].includes(header)) {
              rule[header] = val ? Number(val) : undefined
            } else {
              rule[header] = val
            }
          })

          // Skip completely empty rows
          if (!rule.nameEn && !rule.nameAr) {
            warnings.push(isAr ? `الصف ${i + 1}: صف فارغ، تم التخطي` : `Line ${i + 1}: Empty row skipped`)
            continue
          }

          // Convert slaMinutes to slaHours if slaMinutes is provided
          if (rule.slaMinutes !== undefined && rule.slaMinutes !== null && !rule.slaHours) {
            rule.slaHours = Math.round(Number(rule.slaMinutes) / 60)
            delete rule.slaMinutes
          }

          rules.push(rule as Partial<ServiceRule>)
        }
      } catch {
        errors.push(isAr ? 'فشل في تحليل البيانات. تأكد من تنسيق JSON أو CSV الصحيح.' : 'Failed to parse data. Ensure valid JSON or CSV format.')
        return { rules: [], errors, warnings }
      }
    }

    // Validate each rule with detailed error messages
    const validCategories = [...CATEGORIES.map(c => c.key), ...customCategories.map(c => c.key)]
    const validPriorities = ['low', 'medium', 'high', 'urgent']

    rules.forEach((rule, idx) => {
      const rowNum = idx + 1
      if (!rule.nameEn) errors.push(isAr ? `القاعدة ${rowNum}: اسم إنجليزي مفقود (nameEn مطلوب)` : `Rule ${rowNum}: Missing English name (nameEn is required)`)
      if (!rule.nameAr) errors.push(isAr ? `القاعدة ${rowNum}: اسم عربي مفقود (nameAr مطلوب)` : `Rule ${rowNum}: Missing Arabic name (nameAr is required)`)
      if (!rule.category) {
        errors.push(isAr ? `القاعدة ${rowNum}: فئة مفقودة (category مطلوب)` : `Rule ${rowNum}: Missing category (category is required)`)
      } else if (!validCategories.includes(rule.category)) {
        errors.push(isAr ? `القاعدة ${rowNum}: فئة غير صالحة "${rule.category}" — القيم المسموحة: ${validCategories.join(', ')}` : `Rule ${rowNum}: Invalid category "${rule.category}" — valid values: ${validCategories.join(', ')}`)
      }
      if (rule.priority && !validPriorities.includes(rule.priority)) {
        errors.push(isAr ? `القاعدة ${rowNum}: أولوية غير صالحة "${rule.priority}" — القيم المسموحة: ${validPriorities.join(', ')}` : `Rule ${rowNum}: Invalid priority "${rule.priority}" — valid values: ${validPriorities.join(', ')}`)
      }
      if (rule.feeAmount && rule.feeAmount !== 'Free' && isNaN(Number(rule.feeAmount.replace(/,/g, '')))) {
        warnings.push(isAr ? `القاعدة ${rowNum}: مبلغ الرسوم "${rule.feeAmount}" ليس رقماً صالحاً` : `Rule ${rowNum}: Fee amount "${rule.feeAmount}" is not a valid number`)
      }
      if (rule.nameEn && rule.nameEn.length > 200) {
        warnings.push(isAr ? `القاعدة ${rowNum}: الاسم الإنجليزي طويل جداً (${rule.nameEn.length} حرف)` : `Rule ${rowNum}: English name is very long (${rule.nameEn.length} chars)`)
      }
      if (rule.nameAr && rule.nameAr.length > 200) {
        warnings.push(isAr ? `القاعدة ${rowNum}: الاسم العربي طويل جداً (${rule.nameAr.length} حرف)` : `Rule ${rowNum}: Arabic name is very long (${rule.nameAr.length} chars)`)
      }
    })

    return { rules, errors, warnings }
  }, [isAr, customCategories, parseCSVLine])

  const handleImportPreview = useCallback(() => {
    const text = importMode === 'paste' ? importText : ''
    if (importMode === 'file' && importFile) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const content = e.target?.result as string
        const { rules, errors, warnings } = parseImportData(content)
        setImportPreview(rules)
        setImportErrors(errors)
        setImportWarnings(warnings)
      }
      reader.readAsText(importFile)
    } else if (text) {
      const { rules, errors, warnings } = parseImportData(text)
      setImportPreview(rules)
      setImportErrors(errors)
      setImportWarnings(warnings)
    }
  }, [importMode, importText, importFile, parseImportData])

  const handleImportConfirm = useCallback(async () => {
    if (importPreview.length === 0) return
    setImporting(true)
    let succeeded = 0
    let failed = 0
    const validRules = importErrors.length === 0 ? importPreview : importPreview.filter((_, idx) => {
      // Only import rules that don't have errors mentioning their index
      return !importErrors.some(err => {
        const match = err.match(/Rule (\d+)/)
        return match && parseInt(match[1]) === idx + 1
      })
    })

    for (const rule of validRules) {
      try {
        const payload = {
          ...rule,
          feeCurrency: rule.feeCurrency || 'AED',
          isActive: rule.isActive !== undefined ? rule.isActive : true,
          priority: rule.priority || 'medium',
          tags: rule.tags || [],
          requiredActions: rule.requiredActions || [],
          fields: rule.fields || [],
        }
        const res = await api.post('/service-rules', payload)
        if (res.ok) { succeeded++ } else { failed++ }
      } catch {
        failed++
      }
    }

    if (succeeded > 0) {
      addToast('success', isAr ? `تم استيراد ${succeeded} قاعدة بنجاح` : `Successfully imported ${succeeded} rules`)
      fetchRules()
    }
    if (failed > 0) {
      addToast('error', isAr ? `فشل استيراد ${failed} قاعدة` : `Failed to import ${failed} rules`)
    }
    setImporting(false)
    setImportOpen(false)
    setImportText('')
    setImportFile(null)
    setImportPreview([])
    setImportErrors([])
  }, [importPreview, importErrors, addToast, isAr, fetchRules])

  const handleOpenImport = () => {
    setImportText('')
    setImportFile(null)
    setImportPreview([])
    setImportErrors([])
    setImportWarnings([])
    setImportMode('paste')
    setQuickAddCategory('electricity_water')
    setQuickAddRules([{ nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '' }])
    setImportOpen(true)
  }

  // Quick Add: convert simplified form to rules and import them
  const handleQuickAddPreview = useCallback(() => {
    const validRules = quickAddRules.filter(r => r.nameEn.trim() && r.nameAr.trim())
    if (validRules.length === 0) {
      setImportErrors([isAr ? 'أضف قاعدة واحدة على الأقل مع الاسم الإنجليزي والعربي' : 'Add at least one rule with English and Arabic names'])
      setImportWarnings([])
      setImportPreview([])
      return
    }
    const rules: Partial<ServiceRule>[] = validRules.map(r => ({
      nameEn: r.nameEn.trim(),
      nameAr: r.nameAr.trim(),
      category: quickAddCategory,
      descriptionEn: r.descriptionEn?.trim() || '',
      descriptionAr: r.descriptionAr?.trim() || '',
      isActive: true,
      priority: 'medium' as const,
      feeCurrency: 'AED',
    }))
    setImportPreview(rules)
    setImportErrors([])
    setImportWarnings([])
  }, [quickAddRules, quickAddCategory, isAr])

  const handleAddCategory = async (data: { key: string; labelEn: string; labelAr: string; icon: string; color: string; border: string }) => {
    try {
      const res = await api.post('/service-categories', data)
      if (res.ok) {
        addToast('success', isAr ? 'تم إنشاء الفئة بنجاح' : 'Category created successfully')
        fetchCategories()
      } else {
        const err = await res.json()
        addToast('error', err.error || (isAr ? 'فشل في إنشاء الفئة' : 'Failed to create category'))
      }
    } catch {
      addToast('error', isAr ? 'خطأ في الاتصال' : 'Connection error')
    }
  }

  // ─── Field management ─────────────────────────────────────────────────────

  const updateEditingRule = (key: string, value: unknown) => {
    setEditingRule(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const toggleRequiredAction = (action: string) => {
    if (!editingRule) return
    const actions = editingRule.requiredActions || []
    updateEditingRule('requiredActions',
      actions.includes(action) ? actions.filter((a: string) => a !== action) : [...actions, action]
    )
  }

  const addField = () => {
    if (!editingRule) return
    const fields = [...(editingRule.fields || []), createEmptyField(editingRule.fields?.length || 0)]
    updateEditingRule('fields', fields)
  }

  const removeField = (index: number) => {
    if (!editingRule || !editingRule.fields) return
    const fields = editingRule.fields.filter((_, i) => i !== index)
    updateEditingRule('fields', fields)
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    if (!editingRule || !editingRule.fields) return
    const fields = [...editingRule.fields]
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= fields.length) return
    ;[fields[index], fields[newIndex]] = [fields[newIndex], fields[index]]
    updateEditingRule('fields', fields)
  }

  const openFieldEditor = (index: number) => {
    setEditingFieldIndex(index)
    setFieldEditorOpen(true)
  }

  const saveFieldFromEditor = (updatedField: ServiceRuleField) => {
    if (!editingRule || !editingRule.fields) return
    const fields = [...editingRule.fields]
    if (editingFieldIndex >= 0 && editingFieldIndex < fields.length) {
      fields[editingFieldIndex] = updatedField
    } else {
      fields.push(updatedField)
    }
    updateEditingRule('fields', fields)
  }

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const getCategoryBadge = (category: string) => {
    const cat = getCategoryConfig(category, customCategories)
    const Icon = cat.icon
    return (
      <Badge className={`${cat.color} gap-1 text-[10px] px-1.5 py-0 h-5 font-medium`}>
        <Icon className="h-3 w-3" />
        {isAr ? cat.labelAr : cat.labelEn}
      </Badge>
    )
  }

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      search: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      add: 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-900/30 dark:text-uae-green-400',
      edit: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      delete: 'bg-uae-red-100 text-uae-red-700 dark:bg-uae-red-900/30 dark:text-uae-red-400',
    }
    return (
      <Badge className={`${colors[action] || 'bg-gray-100 text-gray-700'} text-[9px] px-1.5 py-0 h-4 capitalize`}>
        {action}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const opt = PRIORITY_OPTIONS.find(p => p.value === priority)
    if (!opt) return null
    return (
      <Badge className={`${opt.color} text-[9px] px-1.5 py-0 h-4 font-medium capitalize`}>
        {isAr ? opt.labelAr : opt.labelEn}
      </Badge>
    )
  }

  // ─── Tab Bar Helper ───────────────────────────────────────────────────────

  const renderTabBar = () => (
    <div className="flex items-center gap-1 px-4 pt-3 border-b border-border bg-muted/30">
      {([
        { key: 'rules' as const, icon: Settings, label: isAr ? 'القواعد' : 'Rules' },
        { key: 'analytics' as const, icon: BarChart3, label: isAr ? 'التحليلات' : 'Analytics' },
      ]).map(tab => (
        <button
          key={tab.key}
          onClick={() => setMainTab(tab.key)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg transition-colors ${
            mainTab === tab.key
              ? 'bg-background text-foreground border border-border border-b-0 shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <tab.icon className="h-3.5 w-3.5" />
          {tab.label}
        </button>
      ))}
    </div>
  )

  // ─── Render ───────────────────────────────────────────────────────────────

  // If Analytics tab, render that panel directly
  if (mainTab === 'analytics') {
    return (
      <div className="h-full flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
        {renderTabBar()}
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <RuleAnalyticsPanel />
          </Suspense>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Auth Dialog - shown when auth is required but no token is set */}
      {authEnabled && !authVerified && (
        <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-ae-gold-500" />
                {isAr ? 'التحقق من الهوية' : 'Authentication Required'}
              </DialogTitle>
              <DialogDescription>
                {isAr ? 'أدخل رمز المشرف للوصول إلى تعديل البيانات' : 'Enter admin token to access data modification features'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  {isAr ? 'رمز المشرف' : 'Admin Token'}
                </Label>
                <Input
                  type="password"
                  value={authTokenInput}
                  onChange={(e) => setAuthTokenInput(e.target.value)}
                  placeholder={isAr ? 'أدخل الرمز...' : 'Enter token...'}
                  className="text-sm"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAuthSubmit() }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isAr ? 'ملاحظة: صفحات العرض متاحة للجميع. يتطلب التعديل مصادقة فقط.' : 'Note: Read-only pages are publicly accessible. Only modifications require authentication.'}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleAuthSubmit} className="bg-ae-gold-600 hover:bg-ae-gold-700 text-white" disabled={!authTokenInput.trim()}>
                {isAr ? 'تحقق' : 'Authenticate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-background to-ae-gold-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Settings className="h-5 w-5 text-ae-gold-500" />
              {isAr ? 'قواعد وكيل الذكاء الاصطناعي' : 'AI Agent Service Rules'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isAr
                ? 'إدارة القواعد التي تحدد كيفية تفاعل وكيل الذكاء الاصطناعي مع الخدمات'
                : 'Manage rules that define how the AI agent interacts with services'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 border-ae-gold-500/40 hover:bg-ae-gold-500/10 hover:text-ae-gold-600"
              onClick={handleOpenImport}
            >
              <Upload className="h-3.5 w-3.5" />
              {isAr ? 'استيراد' : 'Import'}
            </Button>
            <Button
              size="sm"
              className="text-xs gap-1.5 bg-ae-gold-600 hover:bg-ae-gold-700 text-white"
              onClick={handleOpenCreate}
            >
              <Plus className="h-3.5 w-3.5" />
              {isAr ? 'إضافة قاعدة' : 'Add Rule'}
            </Button>
          </div>
        </div>
      </div>

      {/* Search & Category Filters */}
      <div className="px-4 sm:px-6 py-3 border-b border-border bg-muted/20 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'البحث عن خدمة...' : 'Search services...'}
            className="pl-9 text-sm h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Category Tabs with Add Category button */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              categoryFilter === 'all'
                ? 'bg-ae-gold-500 text-white shadow-sm'
                : 'bg-muted hover:bg-muted/80 text-muted-foreground'
            }`}
          >
            {isAr ? 'الكل' : 'All'}
            <span className="bg-white/20 rounded-full px-1.5 py-0 text-[10px]">{categoryCounts.all || 0}</span>
          </button>
          {allCategories.map(cat => {
            const Icon = cat.icon
            return (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  categoryFilter === cat.key
                    ? 'bg-ae-gold-500 text-white shadow-sm'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                <Icon className="h-3 w-3" />
                {isAr ? cat.labelAr : cat.labelEn}
                <span className="bg-white/20 rounded-full px-1.5 py-0 text-[10px]">{categoryCounts[cat.key] || 0}</span>
              </button>
            )
          })}
          {/* Add Category Button */}
          <button
            onClick={() => setAddCategoryOpen(true)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors bg-muted/60 hover:bg-ae-gold-500/20 text-muted-foreground hover:text-ae-gold-600 border border-dashed border-muted-foreground/30 hover:border-ae-gold-500/50"
            title={isAr ? 'إضافة فئة جديدة' : 'Add new category'}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                      <div className="flex gap-2">
                        <Skeleton className="h-5 w-16" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="bg-muted rounded-full p-6 mb-4">
              <Settings className="h-12 w-12 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {isAr ? 'لا توجد قواعد خدمة' : 'No Service Rules Found'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mb-6">
              {isAr
                ? 'ابدأ بتحميل خدمات الوزارة أو أنشئ قاعدة جديدة يدوياً'
                : 'Get started by loading MOEI services or create a new rule manually'}
            </p>
            <div className="flex gap-3">
              <Button className="gap-2 bg-ae-gold-600 hover:bg-ae-gold-700 text-white" onClick={handleOpenCreate}>
                <Plus className="h-4 w-4" />
                {isAr ? 'إضافة قاعدة' : 'Add Rule'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRules.map(rule => {
              const cat = getCategoryConfig(rule.category, customCategories)
              const CatIcon = cat.icon
              return (
                <Card
                  key={rule.id}
                  className={`border hover:shadow-md transition-all card-hover-glow ${
                    !rule.isActive ? 'opacity-60' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      {/* Category Icon */}
                      <div className={`w-10 h-10 rounded-lg ${cat.color} flex items-center justify-center shrink-0`}>
                        <CatIcon className="h-5 w-5" />
                      </div>

                      {/* Rule Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-sm text-foreground truncate">
                              {isAr ? rule.nameAr : rule.nameEn}
                            </h4>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {isAr ? rule.nameEn : rule.nameAr}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getPriorityBadge(rule.priority)}
                            {getCategoryBadge(rule.category)}
                          </div>
                        </div>

                        {/* Details Row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                          {rule.feeAmount && (
                            <span className="flex items-center gap-1">
                              💰 {rule.feeAmount} {rule.feeCurrency}
                            </span>
                          )}
                          {(isAr ? rule.processingTimeAr : rule.processingTimeEn) && (
                            <span className="flex items-center gap-1">
                              ⏱️ {isAr ? rule.processingTimeAr : rule.processingTimeEn}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            📋 {rule.fields?.length || 0} {isAr ? 'حقول' : 'fields'}
                          </span>
                          {rule.slaHours && (
                            <span className="flex items-center gap-1">
                              🕐 SLA: {rule.slaHours}h
                            </span>
                          )}
                        </div>

                        {/* Tags */}
                        {rule.tags && rule.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1 mt-1.5">
                            <Tag className="h-3 w-3 text-muted-foreground/50" />
                            {rule.tags.slice(0, 5).map(tag => (
                              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">
                                {tag}
                              </Badge>
                            ))}
                            {rule.tags.length > 5 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{rule.tags.length - 5}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Actions Badges & Controls Row */}
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {rule.requiredActions?.map(action => (
                            <span key={action}>{getActionBadge(action)}</span>
                          ))}

                          <div className="flex-1" />

                          {/* Active Toggle */}
                          <div className="flex items-center gap-1.5">
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => handleToggleActive(rule)}
                              className="scale-75"
                            />
                            <span className={`text-[10px] font-medium ${rule.isActive ? 'text-uae-green-600' : 'text-muted-foreground'}`}>
                              {rule.isActive
                                ? (isAr ? 'نشط' : 'Active')
                                : (isAr ? 'غير نشط' : 'Inactive')}
                            </span>
                          </div>

                          {/* Edit & Delete Buttons */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 hover:bg-ae-gold-500/10 hover:text-ae-gold-600"
                            onClick={() => handleOpenEdit(rule)}
                          >
                            <Pencil className="h-3 w-3" />
                            <span className="hidden sm:inline">{isAr ? 'تعديل' : 'Edit'}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 hover:bg-uae-red-500/10 hover:text-uae-red-500"
                            onClick={() => setDeleteTarget(rule)}
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">{isAr ? 'حذف' : 'Delete'}</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Edit/Create Dialog ─────────────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-base">
              {isCreating ? (
                <>
                  <Plus className="h-4 w-4 text-ae-gold-500" />
                  {isAr ? 'إنشاء قاعدة جديدة' : 'Create New Rule'}
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4 text-ae-gold-500" />
                  {isAr ? 'تعديل القاعدة' : 'Edit Rule'}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isCreating
                ? (isAr ? 'إنشاء قاعدة خدمة جديدة لوكيل الذكاء الاصطناعي' : 'Create a new AI agent service rule')
                : (isAr ? 'تعديل تفاصيل قاعدة الخدمة' : 'Edit service rule details')}
            </DialogDescription>
          </DialogHeader>

          {/* Tabs - 5 tabs */}
          <Tabs value={dialogTab} onValueChange={setDialogTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-2">
              <TabsList className="w-full h-9">
                <TabsTrigger value="basic" className="text-xs flex-1">
                  {isAr ? 'المعلومات الأساسية' : 'Basic Info'}
                </TabsTrigger>
                <TabsTrigger value="agent" className="text-xs flex-1">
                  {isAr ? 'الوكيل' : 'Agent'}
                </TabsTrigger>
                <TabsTrigger value="details" className="text-xs flex-1">
                  {isAr ? 'تفاصيل الخدمة' : 'Details'}
                </TabsTrigger>
                <TabsTrigger value="fields" className="text-xs flex-1">
                  {isAr ? 'الحقول' : 'Fields'}
                  {editingRule?.fields?.length ? (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                      {editingRule.fields.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs flex-1">
                  {isAr ? 'متقدم' : 'Advanced'}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ─── Basic Info Tab ─────────────────────────────────────────── */}
            <TabsContent value="basic" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
              {/* Names */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'اسم الخدمة (إنجليزي)' : 'Service Name (English)'}
                    <span className="text-uae-red-500"> *</span>
                  </Label>
                  <Input
                    value={editingRule?.nameEn || ''}
                    onChange={(e) => updateEditingRule('nameEn', e.target.value)}
                    placeholder="New Electricity Connection"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'اسم الخدمة (عربي)' : 'Service Name (Arabic)'}
                    <span className="text-uae-red-500"> *</span>
                  </Label>
                  <Input
                    value={editingRule?.nameAr || ''}
                    onChange={(e) => updateEditingRule('nameAr', e.target.value)}
                    placeholder="توصيل كهرباء جديد"
                    className="text-sm"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Category & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الفئة' : 'Category'}
                    <span className="text-uae-red-500"> *</span>
                  </Label>
                  <Select value={editingRule?.category || ''} onValueChange={(v) => updateEditingRule('category', v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder={isAr ? 'اختر الفئة' : 'Select category'} />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map(cat => (
                        <SelectItem key={cat.key} value={cat.key}>
                          <span className="flex items-center gap-2">
                            <cat.icon className="h-3.5 w-3.5" />
                            {isAr ? cat.labelAr : cat.labelEn}
                            {cat.isCustom && <span className="text-[9px] text-muted-foreground">({isAr ? 'مخصص' : 'custom'})</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الأولوية' : 'Priority'}
                  </Label>
                  <Select value={editingRule?.priority || 'medium'} onValueChange={(v) => updateEditingRule('priority', v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${opt.color.split(' ')[0]}`} />
                            {isAr ? opt.labelAr : opt.labelEn}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الوصف (إنجليزي)' : 'Description (English)'}
                  </Label>
                  <Textarea
                    value={editingRule?.descriptionEn || ''}
                    onChange={(e) => updateEditingRule('descriptionEn', e.target.value)}
                    placeholder="Apply for a new electricity connection..."
                    className="text-sm min-h-[70px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الوصف (عربي)' : 'Description (Arabic)'}
                  </Label>
                  <Textarea
                    value={editingRule?.descriptionAr || ''}
                    onChange={(e) => updateEditingRule('descriptionAr', e.target.value)}
                    placeholder="التقدم بطلب توصيل كهرباء جديد..."
                    className="text-sm min-h-[70px]"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Fee & Processing Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'مبلغ الرسوم' : 'Fee Amount'}
                  </Label>
                  <Input
                    value={editingRule?.feeAmount || ''}
                    onChange={(e) => updateEditingRule('feeAmount', e.target.value)}
                    placeholder="1,500 or Free"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'العملة' : 'Currency'}
                  </Label>
                  <Select value={editingRule?.feeCurrency || 'AED'} onValueChange={(v) => updateEditingRule('feeCurrency', v)}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AED">AED</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="Free">{isAr ? 'مجاني' : 'Free'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'مدة المعالجة (إنجليزي)' : 'Processing Time (EN)'}
                  </Label>
                  <Input
                    value={editingRule?.processingTimeEn || ''}
                    onChange={(e) => updateEditingRule('processingTimeEn', e.target.value)}
                    placeholder="3-5 working days"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'مدة المعالجة (عربي)' : 'Processing Time (AR)'}
                  </Label>
                  <Input
                    value={editingRule?.processingTimeAr || ''}
                    onChange={(e) => updateEditingRule('processingTimeAr', e.target.value)}
                    placeholder="٣-٥ أيام عمل"
                    className="text-sm"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Eligibility */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الأهلية (إنجليزي)' : 'Eligibility (English)'}
                  </Label>
                  <Textarea
                    value={editingRule?.eligibilityEn || ''}
                    onChange={(e) => updateEditingRule('eligibilityEn', e.target.value)}
                    placeholder="UAE residents and citizens with valid Emirates ID"
                    className="text-sm min-h-[50px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الأهلية (عربي)' : 'Eligibility (Arabic)'}
                  </Label>
                  <Textarea
                    value={editingRule?.eligibilityAr || ''}
                    onChange={(e) => updateEditingRule('eligibilityAr', e.target.value)}
                    placeholder="مقيمون ومواطنو الإمارات بحالة الهوية"
                    className="text-sm min-h-[50px]"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Required Actions */}
              <div className="space-y-2 p-3 rounded-lg border border-border bg-muted/30">
                <Label className="text-xs font-medium">
                  {isAr ? 'الإجراءات المتاحة' : 'Available Actions'}
                </Label>
                <div className="flex flex-wrap gap-4">
                  {ACTIONS.map(action => (
                    <label key={action} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={editingRule?.requiredActions?.includes(action) || false}
                        onCheckedChange={() => toggleRequiredAction(action)}
                      />
                      <span className="text-xs capitalize">{action}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
                <Switch
                  checked={editingRule?.isActive ?? true}
                  onCheckedChange={(v) => updateEditingRule('isActive', v)}
                />
                <div>
                  <Label className="text-xs font-medium">
                    {isAr ? 'قاعدة نشطة' : 'Active Rule'}
                  </Label>
                  <p className="text-[10px] text-muted-foreground">
                    {isAr
                      ? 'القواعد غير النشطة لن يستخدمها وكيل الذكاء الاصطناعي'
                      : 'Inactive rules will not be used by the AI agent'}
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* ─── Agent & Auto-Response Tab ────────────────────────────────── */}
            <TabsContent value="agent" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
              <div className="p-3 rounded-lg border border-ae-gold-500/30 bg-ae-gold-500/5">
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? 'تُعطى هذه التعليمات لوكيل الذكاء الاصطناعي عند التعامل مع هذه الخدمة. كن محدداً ودقيقاً.'
                    : 'These instructions are given to the AI agent when handling this service. Be specific and precise.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'تعليمات الوكيل (إنجليزي)' : 'Agent Instructions (English)'}
                </Label>
                <Textarea
                  value={editingRule?.agentInstructionsEn || ''}
                  onChange={(e) => updateEditingRule('agentInstructionsEn', e.target.value)}
                  placeholder="Always verify the property type before proceeding. Commercial connections require additional NOC from the municipality. Ask for load requirement in kW to determine fee tier."
                  className="text-sm min-h-[180px] font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'تعليمات الوكيل (عربي)' : 'Agent Instructions (Arabic)'}
                </Label>
                <Textarea
                  value={editingRule?.agentInstructionsAr || ''}
                  onChange={(e) => updateEditingRule('agentInstructionsAr', e.target.value)}
                  placeholder="تحقق دائماً من نوع العقار قبل المتابعة. التوصيلات التجارية تتطلب عدم ممانعة إضافية من البلدية. اسأل عن متطلبات الحمل بالكيلوواط لتحديد فئة الرسوم."
                  className="text-sm min-h-[180px] font-mono text-xs"
                  dir="rtl"
                />
              </div>

              <Separator className="my-2" />

              <div className="p-3 rounded-lg border border-teal-500/30 bg-teal-500/5">
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? 'قالب الرد التلقائي يُستخدم عند الحاجة لرسالة رد تلقائي فوري للعميل.'
                    : 'Auto-response templates are used when an immediate automated reply to the customer is needed.'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'قالب الرد التلقائي (إنجليزي)' : 'Auto-Response Template (English)'}
                </Label>
                <Textarea
                  value={editingRule?.autoResponseEn || ''}
                  onChange={(e) => updateEditingRule('autoResponseEn', e.target.value)}
                  placeholder="Thank you for contacting MOEI regarding {service_name}. Your request has been received and will be processed within {sla_hours} hours. Reference number: {ref_number}"
                  className="text-sm min-h-[120px] font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'قالب الرد التلقائي (عربي)' : 'Auto-Response Template (Arabic)'}
                </Label>
                <Textarea
                  value={editingRule?.autoResponseAr || ''}
                  onChange={(e) => updateEditingRule('autoResponseAr', e.target.value)}
                  placeholder="شكراً لتواصلكم مع وزارة البنية التحتية بشأن {service_name}. تم استلام طلبكم وسيتم معالجته خلال {sla_hours} ساعة. رقم المرجع: {ref_number}"
                  className="text-sm min-h-[120px] font-mono text-xs"
                  dir="rtl"
                />
              </div>
            </TabsContent>

            {/* ─── Service Details Tab ──────────────────────────────────────── */}
            <TabsContent value="details" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
              {/* Required Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'المستندات المطلوبة (إنجليزي)' : 'Required Documents (English)'}
                  </Label>
                  <Textarea
                    value={editingRule?.requiredDocumentsEn || ''}
                    onChange={(e) => updateEditingRule('requiredDocumentsEn', e.target.value)}
                    placeholder="Emirates ID copy&#10;Title deed&#10;NOC from landlord"
                    className="text-sm min-h-[100px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'المستندات المطلوبة (عربي)' : 'Required Documents (Arabic)'}
                  </Label>
                  <Textarea
                    value={editingRule?.requiredDocumentsAr || ''}
                    onChange={(e) => updateEditingRule('requiredDocumentsAr', e.target.value)}
                    placeholder="صورة الهوية الإماراتية&#10;صك الملكية&#10;عدم ممانعة من المالك"
                    className="text-sm min-h-[100px]"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* Service URL */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  {isAr ? 'رابط الخدمة' : 'Service URL'}
                </Label>
                <Input
                  value={editingRule?.serviceUrl || ''}
                  onChange={(e) => updateEditingRule('serviceUrl', e.target.value)}
                  placeholder="https://services.moei.gov.ae/..."
                  className="text-sm"
                  type="url"
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Phone className="h-3 w-3" />
                    {isAr ? 'هاتف التواصل' : 'Contact Phone'}
                  </Label>
                  <Input
                    value={editingRule?.contactPhone || ''}
                    onChange={(e) => updateEditingRule('contactPhone', e.target.value)}
                    placeholder="+971-4-XXX-XXXX"
                    className="text-sm"
                    type="tel"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {isAr ? 'بريد التواصل' : 'Contact Email'}
                  </Label>
                  <Input
                    value={editingRule?.contactEmail || ''}
                    onChange={(e) => updateEditingRule('contactEmail', e.target.value)}
                    placeholder="service@moei.gov.ae"
                    className="text-sm"
                    type="email"
                  />
                </div>
              </div>

              {/* Business Hours */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {isAr ? 'ساعات العمل (إنجليزي)' : 'Business Hours (English)'}
                  </Label>
                  <Input
                    value={editingRule?.businessHoursEn || ''}
                    onChange={(e) => updateEditingRule('businessHoursEn', e.target.value)}
                    placeholder="Sun-Thu: 7:30 AM - 2:30 PM"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {isAr ? 'ساعات العمل (عربي)' : 'Business Hours (Arabic)'}
                  </Label>
                  <Input
                    value={editingRule?.businessHoursAr || ''}
                    onChange={(e) => updateEditingRule('businessHoursAr', e.target.value)}
                    placeholder="الأحد-الخميس: ٧:٣٠ ص - ٢:٣٠ م"
                    className="text-sm"
                    dir="rtl"
                  />
                </div>
              </div>

              {/* SLA Hours */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  {isAr ? 'ساعات اتفاقية مستوى الخدمة (SLA)' : 'SLA Hours'}
                </Label>
                <Input
                  value={editingRule?.slaHours ?? 72}
                  onChange={(e) => updateEditingRule('slaHours', parseInt(e.target.value) || 0)}
                  placeholder="72"
                  className="text-sm max-w-[200px]"
                  type="number"
                  min={0}
                />
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? 'الحد الأقصى لساعات الاستجابة للخدمة' : 'Maximum response time in hours for this service'}
                </p>
              </div>
            </TabsContent>

            {/* ─── Fields Tab ──────────────────────────────────────────────── */}
            <TabsContent value="fields" className="flex-1 overflow-hidden flex flex-col">
              <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-medium">
                    {isAr ? 'حقول النموذج' : 'Form Fields'}
                  </Label>
                  <Badge variant="secondary" className="h-4 text-[10px] px-1.5">
                    {editingRule?.fields?.length || 0}
                  </Badge>
                </div>
                <Button size="sm" className="text-xs gap-1 h-7 bg-ae-gold-600 hover:bg-ae-gold-700 text-white" onClick={addField}>
                  <Plus className="h-3 w-3" />
                  {isAr ? 'إضافة حقل' : 'Add Field'}
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {(!editingRule?.fields || editingRule.fields.length === 0) ? (
                    <div className="py-12 text-center">
                      <div className="bg-muted rounded-full p-4 mx-auto w-fit mb-3">
                        <Copy className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {isAr ? 'لا توجد حقول بعد. أضف حقلاً جديداً' : 'No fields yet. Add a new field to get started.'}
                      </p>
                    </div>
                  ) : (
                    editingRule.fields.map((field, index) => {
                      const ft = FIELD_TYPES.find(f => f.value === field.fieldType)
                      return (
                        <div
                          key={field.id || `field-${index}`}
                          className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-ae-gold-500/30 transition-colors bg-card group"
                        >
                          {/* Drag Handle & Order */}
                          <div className="flex flex-col items-center gap-0.5 shrink-0">
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                            <span className="text-[9px] text-muted-foreground font-mono">{index + 1}</span>
                          </div>

                          {/* Field Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground truncate">
                                {isAr ? field.labelAr : field.labelEn}
                              </span>
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0">
                                {ft ? (isAr ? ft.labelAr : ft.labelEn) : field.fieldType}
                              </Badge>
                              {field.required && (
                                <span className="text-uae-red-500 text-[10px] font-medium">*</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <code className="text-[10px] text-muted-foreground font-mono">{field.fieldKey}</code>
                              {field.forActions.length > 0 && (
                                <div className="flex gap-0.5">
                                  {field.forActions.map(a => (
                                    <span key={a} className="text-[8px] text-muted-foreground bg-muted rounded px-1 capitalize">{a}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Move & Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === 0}
                              onClick={() => moveField(index, 'up')}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              disabled={index === (editingRule.fields?.length || 0) - 1}
                              onClick={() => moveField(index, 'down')}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:text-ae-gold-600"
                              onClick={() => openFieldEditor(index)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:text-uae-red-500"
                              onClick={() => removeField(index)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ─── Advanced Tab ────────────────────────────────────────────── */}
            <TabsContent value="advanced" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
              {/* Tags */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Tag className="h-3 w-3" />
                  {isAr ? 'الوسوم' : 'Tags'}
                </Label>
                <Input
                  value={(editingRule?.tags || []).join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    updateEditingRule('tags', tags)
                  }}
                  placeholder={isAr ? 'كهرباء، سكني، تجاري' : 'electricity, residential, commercial'}
                  className="text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? 'افصل بين الوسوم بفواصل' : 'Separate tags with commas'}
                </p>
                {editingRule?.tags && editingRule.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editingRule.tags.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-2 py-0.5 h-5 gap-1">
                        {tag}
                        <button
                          onClick={() => {
                            const newTags = editingRule.tags?.filter((_, idx) => idx !== i) || []
                            updateEditingRule('tags', newTags)
                          }}
                          className="hover:text-uae-red-500 transition-colors"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Escalation Rules */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Shield className="h-3 w-3" />
                  {isAr ? 'قواعد التصعيد' : 'Escalation Rules'}
                </Label>
                <Textarea
                  value={editingRule?.escalationRules || '{}'}
                  onChange={(e) => updateEditingRule('escalationRules', e.target.value)}
                  placeholder={'{\n  "levels": [\n    {"hours": 24, "action": "notify_supervisor"},\n    {"hours": 48, "action": "escalate_manager"}\n  ]\n}'}
                  className="text-sm min-h-[120px] font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? 'تنسيق JSON لقواعد التصعيد التلقائي' : 'JSON format for automatic escalation rules'}
                </p>
              </div>

              {/* Related Services */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Link className="h-3 w-3" />
                  {isAr ? 'الخدمات ذات الصلة' : 'Related Services'}
                </Label>
                <Textarea
                  value={editingRule?.relatedServices || '[]'}
                  onChange={(e) => updateEditingRule('relatedServices', e.target.value)}
                  placeholder={'[\n  "service-id-1",\n  "service-id-2"\n]'}
                  className="text-sm min-h-[100px] font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  {isAr ? 'مصفوفة JSON لمعرفات الخدمات ذات الصلة' : 'JSON array of related service IDs'}
                </p>
              </div>

              {/* Version (read-only) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'الإصدار' : 'Version'}
                </Label>
                <div className="flex items-center gap-3">
                  <Input
                    value={editingRule?.version || 1}
                    className="text-sm max-w-[120px] bg-muted"
                    disabled
                  />
                  <span className="text-xs text-muted-foreground">
                    {isAr ? '(للقراءة فقط - يتم التحديث تلقائياً)' : '(Read-only - auto-incremented on save)'}
                  </span>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Dialog Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border gap-2 bg-muted/10">
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              className="text-sm"
            >
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleSaveRule}
              disabled={saving || !editingRule?.nameEn || !editingRule?.nameAr || !editingRule?.category}
              className="text-sm bg-ae-gold-600 hover:bg-ae-gold-700 text-white gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              {isCreating
                ? (isAr ? 'إنشاء القاعدة' : 'Create Rule')
                : (isAr ? 'حفظ التغييرات' : 'Save Changes')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-uae-red-500" />
              {isAr ? 'تأكيد الحذف' : 'Confirm Deletion'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isAr
                ? `هل أنت متأكد من حذف "${deleteTarget?.nameAr || deleteTarget?.nameEn}"؟ سيتم حذف جميع الحقول المرتبطة أيضاً. لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteTarget?.nameEn}"? All associated fields will also be deleted. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-sm">
              {isAr ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="text-sm bg-uae-red-600 hover:bg-uae-red-700 text-white"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              {isAr ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Field Editor Dialog ──────────────────────────────────────────── */}
      <FieldEditorDialog
        open={fieldEditorOpen}
        onOpenChange={setFieldEditorOpen}
        field={
          editingFieldIndex >= 0 && editingRule?.fields?.[editingFieldIndex]
            ? editingRule.fields[editingFieldIndex]
            : createEmptyField(editingRule?.fields?.length || 0)
        }
        onSave={saveFieldFromEditor}
        language={language}
        isRTL={isRTL}
      />

      {/* ─── Add Category Dialog ──────────────────────────────────────────── */}
      <AddCategoryDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        onSave={handleAddCategory}
        language={language}
        isRTL={isRTL}
      />

      {/* ─── Import Dialog ────────────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-3 border-b border-border">
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-ae-gold-500" />
              {isAr ? 'استيراد قواعد الخدمة' : 'Import Service Rules'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isAr ? 'استيراد قواعد خدمة من ملف JSON أو CSV أو إضافتها بسرعة' : 'Import service rules from JSON/CSV file or add them quickly'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
            {/* Mode Toggle - 3 modes */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={importMode === 'paste' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs gap-1.5 ${importMode === 'paste' ? 'bg-ae-gold-600 hover:bg-ae-gold-700 text-white' : ''}`}
                onClick={() => setImportMode('paste')}
              >
                <FileJson className="h-3.5 w-3.5" />
                {isAr ? 'لصق البيانات' : 'Paste Data'}
              </Button>
              <Button
                variant={importMode === 'file' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs gap-1.5 ${importMode === 'file' ? 'bg-ae-gold-600 hover:bg-ae-gold-700 text-white' : ''}`}
                onClick={() => setImportMode('file')}
              >
                <Upload className="h-3.5 w-3.5" />
                {isAr ? 'رفع ملف' : 'Upload File'}
              </Button>
              <Button
                variant={importMode === 'quickAdd' ? 'default' : 'outline'}
                size="sm"
                className={`text-xs gap-1.5 ${importMode === 'quickAdd' ? 'bg-ae-gold-600 hover:bg-ae-gold-700 text-white' : ''}`}
                onClick={() => setImportMode('quickAdd')}
              >
                <ListPlus className="h-3.5 w-3.5" />
                {isAr ? 'إضافة سريعة' : 'Quick Add'}
              </Button>
            </div>

            {/* Template Download & Sample Data Buttons */}
            {importMode !== 'quickAdd' && (
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 px-2.5 gap-1.5 border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-600"
                  onClick={() => downloadFile(IMPORT_TEMPLATE, 'service-rules-template.json', 'application/json')}
                >
                  <Download className="h-3 w-3" />
                  {isAr ? 'تحميل قالب JSON' : 'Download JSON Template'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 px-2.5 gap-1.5 border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-600"
                  onClick={() => downloadFile(CSV_TEMPLATE, 'service-rules-template.csv', 'text/csv')}
                >
                  <Download className="h-3 w-3" />
                  {isAr ? 'تحميل قالب CSV' : 'Download CSV Template'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[10px] h-7 px-2.5 gap-1.5 border-ae-gold-500/40 hover:bg-ae-gold-500/10 hover:text-ae-gold-600"
                  onClick={() => {
                    setImportMode('paste')
                    setImportText(SAMPLE_DATA)
                  }}
                >
                  <Database className="h-3 w-3" />
                  {isAr ? 'بيانات نموذجية' : 'Sample Data'}
                </Button>
              </div>
            )}

            {/* Format Guide */}
            {importMode !== 'quickAdd' && (
              <div className="p-3 rounded-lg border border-dashed border-ae-gold-500/40 bg-ae-gold-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-ae-gold-500" />
                    {isAr ? 'التنسيق المطلوب' : 'Expected Format'}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] h-6 px-2 gap-1"
                    onClick={() => {
                      setImportMode('paste')
                      setImportText(IMPORT_TEMPLATE)
                    }}
                  >
                    <Copy className="h-3 w-3" />
                    {isAr ? 'نسخ القالب' : 'Copy Template'}
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground">
                    {isAr
                      ? 'يدعم مصفوفة JSON مباشرة أو كائن مع حقل "rules". CSV: صف عناوين مع أعمدة مطلوبة.'
                      : 'Supports JSON array directly or object with "rules" field. CSV: Header row with required columns.'}
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px]">
                    <div>
                      <span className="font-semibold text-foreground">{isAr ? 'حقول مطلوبة:' : 'Required fields:'}</span>
                      <span className="text-muted-foreground"> nameEn, nameAr, category</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{isAr ? 'فئات صالحة:' : 'Valid categories:'}</span>
                      <span className="text-muted-foreground"> electricity_water, housing, petroleum, transport, sustainability, general</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{isAr ? 'أولويات:' : 'Priorities:'}</span>
                      <span className="text-muted-foreground"> low, medium, high, urgent</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">{isAr ? 'حقول إضافية:' : 'Optional fields:'}</span>
                      <span className="text-muted-foreground"> descriptionEn/Ar, feeAmount, priority, slaMinutes, tags, fields</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-ae-gold-600 dark:text-ae-gold-400">
                    {isAr
                      ? 'نصيحة: استخدم "slaMinutes" (مثلاً 480 = 8 ساعات) أو "slaHours". الحقول المبسطة: { key, type, labelEn, labelAr, required }'
                      : 'Tip: Use "slaMinutes" (e.g. 480 = 8hrs) or "slaHours". Simplified fields: { key, type, labelEn, labelAr, required }'}
                  </p>
                </div>
              </div>
            )}

            {/* Quick Add Mode */}
            {importMode === 'quickAdd' && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg border border-dashed border-ae-gold-500/40 bg-ae-gold-500/5">
                  <Label className="text-xs font-medium flex items-center gap-1.5">
                    <ListPlus className="h-3 w-3 text-ae-gold-500" />
                    {isAr ? 'إضافة سريعة — أنشئ عدة قواعد دفعة واحدة' : 'Quick Add — Create multiple rules at once'}
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {isAr ? 'اختر فئة واحدة ثم أضف أسماء وأوصاف القواعد. سيتم تعيين نفس الفئة لجميع القواعد.' : 'Choose one category then add rule names and descriptions. All rules will get the same category.'}
                  </p>
                </div>

                {/* Category Selector */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    {isAr ? 'الفئة لجميع القواعد' : 'Category for All Rules'}
                    <span className="text-uae-red-500"> *</span>
                  </Label>
                  <Select value={quickAddCategory} onValueChange={setQuickAddCategory}>
                    <SelectTrigger className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allCategories.map(cat => (
                        <SelectItem key={cat.key} value={cat.key}>
                          <span className="flex items-center gap-2">
                            <cat.icon className="h-3.5 w-3.5" />
                            {isAr ? cat.labelAr : cat.labelEn}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Rules List */}
                <div className="space-y-3">
                  {quickAddRules.map((rule, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground">
                          {isAr ? `قاعدة ${idx + 1}` : `Rule ${idx + 1}`}
                        </span>
                        {quickAddRules.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-uae-red-500 hover:bg-uae-red-500/10"
                            onClick={() => {
                              setQuickAddRules(prev => prev.filter((_, i) => i !== idx))
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          value={rule.nameEn}
                          onChange={(e) => {
                            setQuickAddRules(prev => prev.map((r, i) => i === idx ? { ...r, nameEn: e.target.value } : r))
                          }}
                          placeholder={isAr ? 'اسم الخدمة (إنجليزي)' : 'Service Name (English)'}
                          className="text-sm h-8"
                        />
                        <Input
                          value={rule.nameAr}
                          onChange={(e) => {
                            setQuickAddRules(prev => prev.map((r, i) => i === idx ? { ...r, nameAr: e.target.value } : r))
                          }}
                          placeholder={isAr ? 'اسم الخدمة (عربي)' : 'Service Name (Arabic)'}
                          className="text-sm h-8"
                          dir="rtl"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          value={rule.descriptionEn}
                          onChange={(e) => {
                            setQuickAddRules(prev => prev.map((r, i) => i === idx ? { ...r, descriptionEn: e.target.value } : r))
                          }}
                          placeholder={isAr ? 'الوصف (إنجليزي) — اختياري' : 'Description (English) — optional'}
                          className="text-sm h-8"
                        />
                        <Input
                          value={rule.descriptionAr}
                          onChange={(e) => {
                            setQuickAddRules(prev => prev.map((r, i) => i === idx ? { ...r, descriptionAr: e.target.value } : r))
                          }}
                          placeholder={isAr ? 'الوصف (عربي) — اختياري' : 'Description (Arabic) — optional'}
                          className="text-sm h-8"
                          dir="rtl"
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs gap-1.5 border-dashed"
                    onClick={() => {
                      setQuickAddRules(prev => [...prev, { nameEn: '', nameAr: '', descriptionEn: '', descriptionAr: '' }])
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {isAr ? 'إضافة قاعدة أخرى' : 'Add Another Rule'}
                  </Button>
                </div>
              </div>
            )}

            {/* Paste Mode */}
            {importMode === 'paste' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {isAr ? 'لصق بيانات JSON أو CSV هنا' : 'Paste JSON or CSV data here'}
                </Label>
                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`{\n  "rules": [\n    { "nameEn": "...", "nameAr": "...", "category": "..." }\n  ]\n}`}
                  className="text-sm min-h-[200px] font-mono text-xs"
                />
              </div>
            )}

            {/* File Upload Mode */}
            {importMode === 'file' && (
              <div className="space-y-3">
                <div
                  className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center hover:border-ae-gold-500/50 hover:bg-ae-gold-500/5 transition-colors cursor-pointer"
                  onClick={() => document.getElementById('import-file-input')?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation()
                    const file = e.dataTransfer.files[0]
                    if (file) setImportFile(file)
                  }}
                >
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    {isAr ? 'اسحب الملف هنا أو انقر للاختيار' : 'Drag & drop file here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? 'يدعم ملفات .json و .csv' : 'Supports .json and .csv files'}
                  </p>
                  <input
                    id="import-file-input"
                    type="file"
                    accept=".json,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) setImportFile(file)
                    }}
                  />
                </div>
                {importFile && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    {importFile.name.endsWith('.csv') ? (
                      <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                    ) : (
                      <FileJson className="h-5 w-5 text-amber-600" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{importFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {(importFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setImportFile(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Preview Button */}
            <Button
              onClick={importMode === 'quickAdd' ? handleQuickAddPreview : handleImportPreview}
              disabled={
                importing ||
                (importMode === 'paste' && !importText.trim()) ||
                (importMode === 'file' && !importFile) ||
                (importMode === 'quickAdd' && !quickAddRules.some(r => r.nameEn.trim() && r.nameAr.trim()))
              }
              className="w-full bg-ae-gold-600 hover:bg-ae-gold-700 text-white gap-1.5 text-sm"
            >
              <Eye className="h-3.5 w-3.5" />
              {isAr ? 'معاينة البيانات' : 'Preview Data'}
            </Button>

            {/* Validation Errors */}
            {importErrors.length > 0 && (
              <div className="p-3 rounded-lg border border-uae-red-200 dark:border-uae-red-800/40 bg-uae-red-50/50 dark:bg-uae-red-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-uae-red-500" />
                  <span className="text-xs font-semibold text-uae-red-700 dark:text-uae-red-400">
                    {isAr ? `أخطاء التحقق (${importErrors.length})` : `Validation Errors (${importErrors.length})`}
                  </span>
                </div>
                <ul className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {importErrors.map((err, i) => (
                    <li key={i} className="text-xs text-uae-red-600 dark:text-uae-red-400 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>
                      {err}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {importWarnings.length > 0 && (
              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                    {isAr ? `تحذيرات (${importWarnings.length})` : `Warnings (${importWarnings.length})`}
                  </span>
                </div>
                <ul className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {importWarnings.map((warn, i) => (
                    <li key={i} className="text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">⚠</span>
                      {warn}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            {importPreview.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {isAr ? `معاينة القواعد (${importPreview.length})` : `Preview Rules (${importPreview.length})`}
                  </Label>
                  <Badge className={`text-[10px] ${importErrors.length === 0 ? 'bg-uae-green-100 text-uae-green-700 dark:bg-uae-green-900/30 dark:text-uae-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                    {importErrors.length === 0
                      ? (isAr ? 'جميع القواعد صالحة' : 'All rules valid')
                      : (isAr ? `${importPreview.length - importErrors.length} صالحة من ${importPreview.length}` : `${importPreview.length - importErrors.length} valid of ${importPreview.length}`)}
                  </Badge>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <ScrollArea className="max-h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">{isAr ? 'الاسم (إنجليزي)' : 'Name (EN)'}</th>
                          <th className="text-left p-2 font-medium">{isAr ? 'الاسم (عربي)' : 'Name (AR)'}</th>
                          <th className="text-left p-2 font-medium">{isAr ? 'الفئة' : 'Category'}</th>
                          <th className="text-left p-2 font-medium">{isAr ? 'الأولوية' : 'Priority'}</th>
                          <th className="text-left p-2 font-medium">{isAr ? 'الرسوم' : 'Fee'}</th>
                          <th className="text-left p-2 font-medium">{isAr ? 'نشط' : 'Active'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((rule, i) => {
                          const hasError = importErrors.some(err => {
                            const match = err.match(/Rule (\d+)/)
                            return match && parseInt(match[1]) === i + 1
                          })
                          return (
                            <tr key={i} className={`border-t ${hasError ? 'bg-uae-red-50/50 dark:bg-uae-red-900/10' : 'hover:bg-muted/30'}`}>
                              <td className="p-2 truncate max-w-[150px]">{rule.nameEn || '-'}</td>
                              <td className="p-2 truncate max-w-[150px]" dir="rtl">{rule.nameAr || '-'}</td>
                              <td className="p-2">
                                <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground">
                                  {rule.category || '-'}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Badge className="text-[9px] px-1.5 py-0 bg-muted text-muted-foreground capitalize">
                                  {rule.priority || 'medium'}
                                </Badge>
                              </td>
                              <td className="p-2">{rule.feeAmount ? `${rule.feeAmount} ${rule.feeCurrency || 'AED'}` : '-'}</td>
                              <td className="p-2">
                                {rule.isActive !== false ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-uae-green-500" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>

          {/* Dialog Footer */}
          <DialogFooter className="px-6 py-4 border-t border-border gap-2 bg-muted/10">
            <Button variant="outline" onClick={() => setImportOpen(false)} className="text-sm">
              {isAr ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleImportConfirm}
              disabled={importing || importPreview.length === 0 || importErrors.length >= importPreview.length}
              className="text-sm bg-ae-gold-600 hover:bg-ae-gold-700 text-white gap-1.5"
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {importing
                ? (isAr ? 'جاري الاستيراد...' : 'Importing...')
                : (isAr ? `استيراد ${importPreview.length > 0 ? importPreview.length : ''} قاعدة` : `Import ${importPreview.length > 0 ? importPreview.length : ''} Rules`)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
