'use client'

import React, { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollFade } from '@/components/ui/scroll-fade'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { toast } from '@/hooks/use-toast'
import {
  FileText, Users, FormInput, ShieldCheck, Asterisk, Bot,
  Eye, EyeOff, Info, FileCheck, TextCursorInput, Save
} from 'lucide-react'

interface FieldRulesTabProps {
  formFields: any[]
  editingField: any
  setEditingField: (f: any) => void
  onRefresh: () => void
}

export function FieldRulesTab({ formFields, editingField, setEditingField, onRefresh }: FieldRulesTabProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Stats for field rules
  const requiredCount = formFields.filter((f: any) => f.required).length
  const hiddenCount = formFields.filter((f: any) => f.isVisible === false).length
  const fieldsWithRules = formFields.filter((f: any) => {
    const v = f.validation ? (typeof f.validation === 'string' ? JSON.parse(f.validation) : f.validation) : {}
    return v && Object.keys(v).length > 0
  }).length

  const openEditDialog = (field: any) => {
    const parsedValidation = field.validation ? (typeof field.validation === 'string' ? JSON.parse(field.validation) : field.validation) : {}
    setEditingField({
      ...field,
      _validation: parsedValidation,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingField) return
    setSaving(true)
    try {
      const { _validation, ...rest } = editingField
      const payload: Record<string, unknown> = {
        required: rest.required,
        isVisible: rest.isVisible,
        ruleDescriptionEN: rest.ruleDescriptionEN || null,
        ruleDescriptionAR: rest.ruleDescriptionAR || null,
        showRule: rest.showRule ?? false,
        validation: _validation && Object.keys(_validation).length > 0 ? _validation : null,
      }
      const res = await authFetch(`/api/form-fields/${editingField.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        onRefresh()
        toast({ title: t('admin.workflows.fieldSaved', language) })
        setDialogOpen(false)
        setEditingField(null)
      } else {
        toast({ title: t('admin.workflows.fieldSaveFailed', language), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('admin.workflows.fieldSaveFailed', language), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const sectionLabels: Record<string, { en: string; ar: string; icon: React.ReactNode; color: string }> = {
    personal: { en: 'Personal Information', ar: 'المعلومات الشخصية', icon: <Users className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    loan: { en: 'Loan & Arrear Details', ar: 'تفاصيل القرض والمتأخرات', icon: <FileText className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    request: { en: 'Request Details', ar: 'تفاصيل الطلب', icon: <FormInput className="w-4 h-4" />, color: 'text-purple-600 bg-purple-50 border-purple-200' },
    cross_field: { en: 'Cross-Field Verification', ar: 'التحقق عبر الحقول', icon: <ShieldCheck className="w-4 h-4" />, color: 'text-teal-600 bg-teal-50 border-teal-200' },
  }

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-semibold text-ae-black-700">{t('admin.workflows.fieldRules', language)}</h3>
        <p className="text-sm text-ae-black-400">{t('admin.workflows.fieldRulesDesc', language)}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-ae-gold-200 bg-ae-gold-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-ae-gold-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-gold-700">{fieldsWithRules}</div>
              <div className="text-xs text-ae-gold-600">{t('admin.workflows.fieldsWithRules', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-ae-red-200 bg-ae-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-red-500/10 flex items-center justify-center">
              <Asterisk className="w-5 h-5 text-ae-red-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-red-700">{requiredCount}</div>
              <div className="text-xs text-ae-red-600">{t('admin.workflows.fieldsRequired', language)}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-ae-black-200 bg-ae-black-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-ae-black-500/10 flex items-center justify-center">
              <EyeOff className="w-5 h-5 text-ae-black-600" />
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold text-ae-black-700">{hiddenCount}</div>
              <div className="text-xs text-ae-black-600">{t('admin.workflows.fieldsHidden', language)}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {formFields.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-ae-black-400">
            <ShieldCheck className="w-16 h-16 mx-auto mb-4 opacity-20" />
            <p className="text-sm">{t('admin.aiPrompts.noFields', language)}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Field List — Full Width, clicking opens dialog */}
          {['personal', 'loan', 'request', 'cross_field'].map((section) => {
            const sectionFields = formFields.filter((f: any) => f.section === section)
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
                  {sectionFields.map((field: any) => {
                    const parsedValidation = field.validation ? (typeof field.validation === 'string' ? JSON.parse(field.validation) : field.validation) : {}
                    const hasRules = parsedValidation && Object.keys(parsedValidation).length > 0
                    const ruleDescPreview = field.ruleDescriptionEN || field.ruleDescriptionAR || (hasRules ? (isAr ? 'قواعد مكونة' : 'Rules configured') : '')

                    return (
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
                              {field.required ? (
                                <Badge className="text-[10px] bg-ae-red-500/10 text-ae-red-600 border-ae-red-500/20 hover:bg-ae-red-500/10">
                                  <Asterisk className="w-3 h-3 me-0.5" /> {t('admin.workflows.required', language)}
                                </Badge>
                              ) : (
                                <Badge className="text-[10px] bg-ae-black-500/5 text-ae-black-400 border-ae-black-500/10 hover:bg-ae-black-500/5">
                                  {t('admin.workflows.optional', language)}
                                </Badge>
                              )}
                              {field.isVisible === false && (
                                <Badge className="text-[10px] bg-ae-black-500/10 text-ae-black-500 border-ae-black-500/20 hover:bg-ae-black-500/10">
                                  <EyeOff className="w-3 h-3" />
                                </Badge>
                              )}
                              {field.aiAutoValidate && (
                                <Badge className="text-[10px] bg-ae-green-500/10 text-ae-green-600 border-ae-green-500/20 hover:bg-ae-green-500/10">
                                  <Bot className="w-3 h-3" />
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] text-ae-black-300 font-mono mb-2">{field.fieldKey}</div>
                          {ruleDescPreview ? (
                            <p className="text-xs text-ae-black-400 line-clamp-2 leading-relaxed break-words">
                              {ruleDescPreview}
                            </p>
                          ) : (
                            <p className="text-xs text-ae-black-300 italic">
                              {isAr ? 'انقر لتعديل القواعد' : 'Click to edit rules'}
                            </p>
                          )}
                          <div className="mt-2 flex justify-end">
                            <span className="text-[10px] text-ae-gold-500 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAr ? 'اضغط للتعديل →' : 'Click to edit →'}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingField(null) }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {editingField && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-ae-gold-600" />
                  </div>
                  {isAr ? editingField.labelAR : editingField.labelEN}
                </DialogTitle>
                <DialogDescription>
                  {t('admin.workflows.editFieldRules', language)}
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

                  {/* Editor Tabs: General / Validation / Display */}
                  <Tabs defaultValue="general" className="w-full">
                    <TabsList className="w-full grid grid-cols-3">
                      <TabsTrigger value="general" className="gap-1.5">
                        <Info className="w-3.5 h-3.5" />
                        <span>{t('admin.workflows.fieldGeneral', language)}</span>
                      </TabsTrigger>
                      <TabsTrigger value="validation" className="gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>{t('admin.workflows.fieldValidation', language)}</span>
                      </TabsTrigger>
                      <TabsTrigger value="display" className="gap-1.5">
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>{t('admin.workflows.fieldDisplay', language)}</span>
                      </TabsTrigger>
                    </TabsList>

                    {/* General Tab */}
                    <TabsContent value="general" className="space-y-4 mt-4">
                      {/* Required Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-lg border border-ae-red-200 bg-ae-red-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-ae-red-500/10 flex items-center justify-center">
                            <Asterisk className="w-4 h-4 text-ae-red-600" />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold">{t('admin.workflows.required', language)}</Label>
                            <p className="text-xs text-muted-foreground">{t('admin.workflows.requiredDesc', language)}</p>
                          </div>
                        </div>
                        <Switch
                          checked={editingField.required ?? true}
                          onCheckedChange={(checked) => setEditingField({ ...editingField, required: checked })}
                        />
                      </div>

                      {/* Visible Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-lg border border-ae-green-200 bg-ae-green-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-ae-green-500/10 flex items-center justify-center">
                            {editingField.isVisible !== false ? (
                              <Eye className="w-4 h-4 text-ae-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <Label className="text-sm font-semibold">{t('admin.workflows.visible', language)}</Label>
                            <p className="text-xs text-muted-foreground">{t('admin.workflows.visibleDesc', language)}</p>
                          </div>
                        </div>
                        <Switch
                          checked={editingField.isVisible !== false}
                          onCheckedChange={(checked) => setEditingField({ ...editingField, isVisible: checked })}
                        />
                      </div>
                    </TabsContent>

                    {/* Validation Tab */}
                    <TabsContent value="validation" className="space-y-4 mt-4">
                      {editingField.fieldType === 'number' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.minValue', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.min ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, min: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="0"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.maxValue', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.max ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, max: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="1000000"
                                className="text-sm"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {editingField.fieldType === 'text' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.minLength', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.minLength ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, minLength: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="0"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.maxLength', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.maxLength ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, maxLength: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="500"
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">{t('admin.workflows.regexPattern', language)}</Label>
                            <p className="text-xs text-muted-foreground">{t('admin.workflows.regexDesc', language)}</p>
                            <Input
                              value={editingField._validation?.regex ?? ''}
                              onChange={(e) => setEditingField({
                                ...editingField,
                                _validation: { ...editingField._validation, regex: e.target.value || undefined }
                              })}
                              placeholder="^[a-zA-Z0-9]+$"
                              className="text-sm font-mono"
                            />
                          </div>
                        </>
                      )}

                      {editingField.fieldType === 'select' && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">{t('admin.workflows.allowedValues', language)}</Label>
                          <p className="text-xs text-muted-foreground">{t('admin.workflows.allowedValuesDesc', language)}</p>
                          <Textarea
                            value={Array.isArray(editingField._validation?.allowedValues) ? editingField._validation.allowedValues.join(', ') : (editingField._validation?.allowedValues ?? '')}
                            onChange={(e) => setEditingField({
                              ...editingField,
                              _validation: {
                                ...editingField._validation,
                                allowedValues: e.target.value ? e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) : undefined
                              }
                            })}
                            placeholder="value1, value2, value3"
                            rows={3}
                            className="text-sm"
                          />
                        </div>
                      )}

                      {editingField.fieldType === 'file' && (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.maxFiles', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.maxFiles ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, maxFiles: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="5"
                                className="text-sm"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">{t('admin.workflows.maxFileSize', language)}</Label>
                              <Input
                                type="number"
                                value={editingField._validation?.maxFileSize ?? ''}
                                onChange={(e) => setEditingField({
                                  ...editingField,
                                  _validation: { ...editingField._validation, maxFileSize: e.target.value === '' ? undefined : Number(e.target.value) }
                                })}
                                placeholder="10"
                                className="text-sm"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold">{t('admin.workflows.allowedTypes', language)}</Label>
                            <Input
                              value={Array.isArray(editingField._validation?.allowedTypes) ? editingField._validation.allowedTypes.join(', ') : (editingField._validation?.allowedTypes ?? '')}
                              onChange={(e) => setEditingField({
                                ...editingField,
                                _validation: {
                                  ...editingField._validation,
                                  allowedTypes: e.target.value ? e.target.value.split(',').map((v: string) => v.trim()).filter(Boolean) : undefined
                                }
                              })}
                              placeholder="pdf, jpg, png"
                              className="text-sm"
                            />
                          </div>
                        </>
                      )}

                      {!['number', 'text', 'select', 'file'].includes(editingField.fieldType) && (
                        <div className="p-4 rounded-lg bg-muted/50 border text-center">
                          <TextCursorInput className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-xs text-muted-foreground">
                            {t('admin.workflows.noValidationRules', language)}
                          </p>
                        </div>
                      )}

                      {/* Custom Error Messages — always visible */}
                      <Separator />
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold">{t('admin.workflows.customMessage', language)}</Label>
                        <Input
                          value={editingField._validation?.customMessage ?? ''}
                          onChange={(e) => setEditingField({
                            ...editingField,
                            _validation: { ...editingField._validation, customMessage: e.target.value || undefined }
                          })}
                          placeholder="e.g. Please enter a valid value"
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label className="text-xs font-semibold">{t('admin.workflows.customMessageAr', language)}</Label>
                        <Input
                          value={editingField._validation?.customMessageAr ?? ''}
                          onChange={(e) => setEditingField({
                            ...editingField,
                            _validation: { ...editingField._validation, customMessageAr: e.target.value || undefined }
                          })}
                          placeholder="مثال: الرجاء إدخال قيمة صالحة"
                          className="text-sm"
                          dir="rtl"
                        />
                      </div>
                    </TabsContent>

                    {/* Display Tab */}
                    <TabsContent value="display" className="space-y-4 mt-4">
                      {/* Show Rule Toggle */}
                      <div className="flex items-center justify-between p-4 rounded-lg border border-ae-gold-200 bg-ae-gold-50/50">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                            <FileCheck className="w-4 h-4 text-ae-gold-600" />
                          </div>
                          <div>
                            <Label className="text-sm font-semibold">{t('admin.workflows.showRule', language)}</Label>
                            <p className="text-xs text-muted-foreground">{t('admin.workflows.showRuleDesc', language)}</p>
                          </div>
                        </div>
                        <Switch
                          checked={editingField.showRule ?? false}
                          onCheckedChange={(checked) => setEditingField({ ...editingField, showRule: checked })}
                        />
                      </div>

                      {/* Rule Description EN */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('admin.workflows.ruleDescriptionEN', language)}</Label>
                        <p className="text-xs text-muted-foreground">{t('admin.workflows.ruleDescriptionDesc', language)}</p>
                        <Textarea
                          value={editingField.ruleDescriptionEN ?? ''}
                          onChange={(e) => setEditingField({ ...editingField, ruleDescriptionEN: e.target.value })}
                          placeholder="e.g. Must be between 1,000 and 5,000,000 AED"
                          rows={3}
                          className="text-sm resize-y"
                        />
                      </div>

                      {/* Rule Description AR */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">{t('admin.workflows.ruleDescriptionAR', language)}</Label>
                        <Textarea
                          value={editingField.ruleDescriptionAR ?? ''}
                          onChange={(e) => setEditingField({ ...editingField, ruleDescriptionAR: e.target.value })}
                          placeholder="مثال: يجب أن يكون بين 1,000 و 5,000,000 درهم"
                          rows={3}
                          className="text-sm resize-y"
                          dir="rtl"
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
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
    </div>
  )
}
