'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollFade } from '@/components/ui/scroll-fade'
import { toast } from '@/hooks/use-toast'
import {
  Bot, FileText, Users, FormInput, ShieldCheck, CheckCircle2, XCircle,
  AlertTriangle, Save, Search, SlidersHorizontal, X
} from 'lucide-react'

export function AIPromptsView() {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const [formFields, setFormFields] = useState<any[]>([])
  const [editingField, setEditingField] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [aiSeedOpen, setAiSeedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSection, setFilterSection] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterAIStatus, setFilterAIStatus] = useState('all')

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
    fetchFormFields()
  }, [fetchFormFields])

  const openEditDialog = (field: any) => {
    setEditingField({ ...field })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingField) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        aiValidationPrompt: editingField.aiValidationPrompt,
        aiAutoValidate: editingField.aiAutoValidate,
      }
      const res = await authFetch(`/api/form-fields/${editingField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        fetchFormFields()
        toast({ title: t('admin.aiPrompts.saved', language), description: t('admin.aiPrompts.savedDesc', language) })
        setDialogOpen(false)
        setEditingField(null)
      } else {
        toast({ title: t('admin.aiPrompts.saveFailed', language), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('admin.aiPrompts.saveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const sectionLabels: Record<string, { en: string; ar: string; icon: React.ReactNode; color: string }> = {
    personal: { en: 'Personal Information', ar: 'المعلومات الشخصية', icon: <Users className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    loan: { en: 'Loan Details', ar: 'تفاصيل القرض', icon: <FileText className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    arrear: { en: 'Arrear Details', ar: 'تفاصيل المتأخرات', icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600 bg-red-50 border-red-200' },
    request: { en: 'Request Details', ar: 'تفاصيل الطلب', icon: <FormInput className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    validation: { en: 'Cross-Field Verification', ar: 'التحقق عبر الحقول', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50 border-teal-200' },
    cross_field: { en: 'Cross-Field Verification', ar: 'التحقق عبر الحقول', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50 border-teal-200' },
    financial: { en: 'Financial Information', ar: 'المعلومات المالية', icon: <FileText className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  }

  // Collect unique field types for filter dropdown
  const uniqueFieldTypes = useMemo(() => {
    const types = new Set<string>()
    formFields.forEach((f: any) => { if (f.fieldType) types.add(f.fieldType) })
    return Array.from(types).sort()
  }, [formFields])

  // Filtered fields
  const filteredFields = useMemo(() => {
    return formFields.filter((f: any) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesName = (f.labelEN || '').toLowerCase().includes(q) ||
          (f.labelAR || '').toLowerCase().includes(q) ||
          (f.fieldKey || '').toLowerCase().includes(q)
        if (!matchesName) return false
      }
      // Section filter
      if (filterSection !== 'all' && f.section !== filterSection) return false
      // Type filter
      if (filterType !== 'all' && f.fieldType !== filterType) return false
      // AI status filter
      if (filterAIStatus === 'ready' && !(f.aiAutoValidate && f.aiValidationPrompt)) return false
      if (filterAIStatus === 'noPrompt' && !(f.aiAutoValidate && !f.aiValidationPrompt)) return false
      if (filterAIStatus === 'disabled' && f.aiAutoValidate) return false
      return true
    })
  }, [formFields, searchQuery, filterSection, filterType, filterAIStatus])

  // Active filter count
  const activeFilterCount = [
    searchQuery.trim() !== '',
    filterSection !== 'all',
    filterType !== 'all',
    filterAIStatus !== 'all',
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setSearchQuery('')
    setFilterSection('all')
    setFilterType('all')
    setFilterAIStatus('all')
  }

  return (
    <motion.div key="form-builder" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">{t('admin.aiPrompts.title', language)}</h2>
          <p className="text-sm text-ae-black-400">{t('admin.aiPrompts.desc', language)}</p>
        </div>
        <div className="flex gap-2">
          <AlertDialog open={aiSeedOpen} onOpenChange={setAiSeedOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-ae-gold-500 text-ae-gold-600 hover:bg-ae-gold-50">
                <Bot className="w-4 h-4 me-1" /> {t('admin.aiPrompts.seedDefaults', language)}
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
                  onClick={async () => {
                    try {
                      toast({ title: t('admin.aiPrompts.seeding', language), description: t('admin.aiPrompts.seedingDesc', language) })
                      const res = await authFetch('/api/form-fields/seed', { method: 'POST' })
                      if (res.ok) {
                        const data = await res.json() as any
                        toast({ title: t('admin.aiPrompts.seedComplete', language), description: data.message })
                        fetchFormFields()
                      } else {
                        toast({ title: t('admin.aiPrompts.seedFailed', language), variant: 'destructive' })
                      }
                    } catch {
                      toast({ title: t('admin.aiPrompts.seedFailed', language), variant: 'destructive' })
                    }
                  }}
                >
                  {t('admin.confirm.seedProceed', language)}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-ae-gold-200 bg-ae-gold-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-ae-gold-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-gold-700">{formFields.filter((f: any) => f.aiAutoValidate).length}</div>
              <div className="text-xs text-ae-gold-600">{t('admin.aiPrompts.fieldsWithAI', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-ae-green-200 bg-ae-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-ae-green-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-green-700">{formFields.filter((f: any) => f.aiAutoValidate && f.aiValidationPrompt).length}</div>
              <div className="text-xs text-ae-green-600">{t('admin.aiPrompts.promptsConfigured', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-ae-red-200 bg-ae-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-ae-red-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-red-700">{formFields.filter((f: any) => f.aiAutoValidate && !f.aiValidationPrompt).length}</div>
              <div className="text-xs text-ae-red-600">{t('admin.aiPrompts.missingPrompts', language)}</div>
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
          <Select value={filterSection} onValueChange={setFilterSection}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={isAr ? 'جميع الأقسام' : 'All Sections'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الأقسام' : 'All Sections'}</SelectItem>
              {Object.entries(sectionLabels).map(([key, info]) => (
                <SelectItem key={key} value={key}>{isAr ? info.ar : info.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={isAr ? 'جميع الأنواع' : 'All Types'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الأنواع' : 'All Types'}</SelectItem>
              {uniqueFieldTypes.map(type => (
                <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAIStatus} onValueChange={setFilterAIStatus}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue placeholder={isAr ? 'حالة AI' : 'AI Status'} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{isAr ? 'جميع الحالات' : 'All Statuses'}</SelectItem>
              <SelectItem value="ready">{isAr ? 'جاهز' : 'Ready'}</SelectItem>
              <SelectItem value="noPrompt">{isAr ? 'بدون مطالبة' : 'No Prompt'}</SelectItem>
              <SelectItem value="disabled">{isAr ? 'معطّل' : 'Disabled'}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">
              {isAr ? `${filteredFields.length} من ${formFields.length} حقل` : `${filteredFields.length} of ${formFields.length} fields`}
            </span>
            {filterSection !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {isAr ? sectionLabels[filterSection]?.ar : sectionLabels[filterSection]?.en}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterSection('all')} />
              </Badge>
            )}
            {filterType !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1 capitalize">
                {filterType}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterType('all')} />
              </Badge>
            )}
            {filterAIStatus !== 'all' && (
              <Badge variant="secondary" className="text-xs gap-1">
                {filterAIStatus === 'ready' ? (isAr ? 'جاهز' : 'Ready') : filterAIStatus === 'noPrompt' ? (isAr ? 'بدون مطالبة' : 'No Prompt') : (isAr ? 'معطّل' : 'Disabled')}
                <X className="w-3 h-3 cursor-pointer" onClick={() => setFilterAIStatus('all')} />
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

      {/* Fields List — Full Width, clicking opens dialog */}
      {formFields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-ae-black-400">
            <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium mb-1">{t('admin.aiPrompts.noFields', language)}</p>
            <p className="text-sm mb-4">{t('admin.aiPrompts.noFieldsDesc', language)}</p>
            <AlertDialog open={aiSeedOpen} onOpenChange={setAiSeedOpen}>
              <AlertDialogTrigger asChild>
                <Button className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                  <Bot className="w-4 h-4 me-2" /> {t('admin.aiPrompts.seedDefaults', language)}
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
                    onClick={async () => {
                      try {
                        const res = await authFetch('/api/form-fields/seed', { method: 'POST' })
                        if (res.ok) {
                          toast({ title: t('admin.aiPrompts.seedComplete', language) })
                          fetchFormFields()
                        }
                      } catch {
                        toast({ title: t('admin.aiPrompts.seedFailed', language), variant: 'destructive' })
                      }
                    }}
                  >
                    {t('admin.confirm.seedProceed', language)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredFields.length === 0 ? (
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
            <React.Fragment>
            {Array.from(new Set(filteredFields.map((f: any) => f.section))).sort().map((section) => {
            const sectionFields = filteredFields.filter((f: any) => f.section === section)
            if (sectionFields.length === 0) return null
            const sInfo = sectionLabels[section] || sectionLabels.personal
            return (
              <div key={section}>
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${sInfo.color}`}>
                  {sInfo.icon}
                  <span className="text-sm font-semibold">{isAr ? sInfo.ar : sInfo.en}</span>
                  <Badge variant="outline" className="text-[10px] ms-auto">{sectionFields.length} {t('admin.aiPrompts.fields', language)}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {sectionFields.map((field: any) => (
                    <Card
                      key={field.id}
                      className="cursor-pointer hover:shadow-md transition-all hover:border-ae-gold-300 group"
                      onClick={() => openEditDialog(field)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="font-medium text-sm text-ae-black-700 truncate">
                              {isAr ? field.labelAR : field.labelEN}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {field.aiAutoValidate && field.aiValidationPrompt ? (
                              <Badge className="text-[10px] bg-ae-green-500/10 text-ae-green-600 border-ae-green-500/20 hover:bg-ae-green-500/10">
                                <CheckCircle2 className="w-3 h-3 me-0.5" /> {t('admin.aiPrompts.ready', language)}
                              </Badge>
                            ) : field.aiAutoValidate ? (
                              <Badge className="text-[10px] bg-ae-red-500/10 text-ae-red-600 border-ae-red-500/20 hover:bg-ae-red-500/10">
                                <XCircle className="w-3 h-3 me-0.5" /> {t('admin.aiPrompts.noPrompt', language)}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-ae-black-400">
                                {t('admin.aiPrompts.disabled', language)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-ae-black-300 font-mono mb-2">{field.fieldKey}</div>
                        {field.aiValidationPrompt ? (
                          <p className="text-xs text-ae-black-400 line-clamp-2 leading-relaxed break-words">
                            {field.aiValidationPrompt}
                          </p>
                        ) : (
                          <p className="text-xs text-ae-black-300 italic">
                            {isAr ? 'انقر لإضافة مطالبة التحقق' : 'Click to add verification prompt'}
                          </p>
                        )}
                        <div className="mt-2 flex justify-end">
                          <span className="text-[10px] text-ae-gold-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            {isAr ? 'اضغط للتعديل →' : 'Click to edit →'}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
            </React.Fragment>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingField(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {editingField && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-ae-gold-600" />
                  </div>
                  {isAr ? editingField.labelAR : editingField.labelEN}
                </DialogTitle>
                <DialogDescription>
                  {t('admin.aiPrompts.editPrompt', language)}
                </DialogDescription>
              </DialogHeader>

              <ScrollFade className="flex-1 min-h-0">
                <ScrollArea className="h-full px-6 py-4">
                  <div className="space-y-5">
                    {/* Field Info */}
                    <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.aiPrompts.fieldName', language)}</span>
                        <div className="text-sm font-medium truncate">{isAr ? editingField.labelAR : editingField.labelEN}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.aiPrompts.fieldKey', language)}</span>
                        <div className="text-sm font-mono text-muted-foreground">{editingField.fieldKey}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.aiPrompts.fieldType', language)}</span>
                        <div className="text-sm">{editingField.fieldType}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('admin.aiPrompts.section', language)}</span>
                        <div className="text-sm capitalize">{editingField.section}</div>
                      </div>
                    </div>
                  </div>

                  {/* AI Verification Toggle */}
                  <div className="flex items-center justify-between p-4 rounded-lg border border-ae-gold-200 bg-ae-gold-50/50 dark:bg-ae-gold-950/20">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                        <Bot className="w-4 h-4 text-ae-gold-600" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold">{t('admin.aiPrompts.enableAI', language)}</Label>
                        <p className="text-xs text-muted-foreground">{t('admin.aiPrompts.enableAIDesc', language)}</p>
                      </div>
                    </div>
                    <Switch
                      checked={editingField.aiAutoValidate}
                      onCheckedChange={(checked) => setEditingField({ ...editingField, aiAutoValidate: checked })}
                    />
                  </div>

                  {/* AI Verification Prompt */}
                  {editingField.aiAutoValidate && (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-semibold">{t('admin.aiPrompts.promptLabel', language)}</Label>
                        <p className="text-xs text-muted-foreground mt-1">{t('admin.aiPrompts.promptDesc', language)}</p>
                      </div>
                      <Textarea
                        value={editingField.aiValidationPrompt || ''}
                        onChange={(e) => setEditingField({ ...editingField, aiValidationPrompt: e.target.value })}
                        placeholder={t('admin.aiPrompts.promptPlaceholder', language)}
                        rows={10}
                        className="text-sm leading-relaxed resize-y min-h-[200px]"
                        dir={isAr ? 'rtl' : 'ltr'}
                      />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{(editingField.aiValidationPrompt || '').length} {t('admin.aiPrompts.characters', language)}</span>
                        {(editingField.aiValidationPrompt || '').length > 0 && (editingField.aiValidationPrompt || '').length < 50 && (
                          <span className="text-amber-500">{t('admin.aiPrompts.tooShort', language)}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              </ScrollFade>

              <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
                <div className="flex items-center gap-3 w-full justify-end">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingField(null) }}>
                    {t('common.cancel', language)}
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                  >
                    {saving ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {isAr ? 'جاري الحفظ...' : 'Saving...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Save className="w-4 h-4" />
                        {t('common.save', language)}
                      </span>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
