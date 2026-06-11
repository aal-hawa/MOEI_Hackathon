'use client'

import { useState, useEffect } from 'react'
import { Mail, Eye, Send, Loader2, Shield, FileCheck, PenLine, AlertCircle } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useIsMobile } from '@/hooks/use-mobile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

// ─── Types ─────────────────────────────────────────────────────────────────────

type EmailTemplate = 'uaepass_login' | 'request_confirmation' | 'custom'

// ─── Email Validation ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

// ─── Mock values for template placeholders ─────────────────────────────────────

const MOCK_UAEPASS_LINK = 'https://uaepass.ae/login?ref=MOEI-2024-SVC'
const MOCK_REF_NUMBER = 'MOEI-2024-00358'
const MOCK_PROCESSING_TIME_EN = '3-5 business days'
const MOCK_PROCESSING_TIME_AR = '3-5 أيام عمل'

// ─── Template Content ──────────────────────────────────────────────────────────

const UAEPASS_TEMPLATE = {
  en: {
    subject: 'UAE PASS Login Required — MOEI Service Request',
    body: `Dear Customer,

To proceed with your service request at the Ministry of Energy & Infrastructure, you are required to authenticate using UAE PASS.

Please click the link below to log in with your UAE PASS credentials:

🔗 ${MOCK_UAEPASS_LINK}

This link is secure and will redirect you to the official UAE PASS authentication portal.

If you did not initiate this request, please disregard this email or contact us at 8005555.

Best regards,
MOEI Digital Services`,
  },
  ar: {
    subject: 'تسجيل دخول الهوية الرقمية المطلوب — طلب خدمة وزارة الطاقة والبنية التحتية',
    body: `عزيزي العميل،

للمتابعة في معاملة طلب الخدمة لدى وزارة الطاقة والبنية التحتية، يرجى تسجيل الدخول باستخدام الهوية الرقمية (UAE PASS).

يرجى النقر على الرابط أدناه لتسجيل الدخول باستخدام بيانات الهوية الرقمية:

🔗 ${MOCK_UAEPASS_LINK}

هذا الرابط آمن وسيحوّلك إلى بوابة الهوية الرقمية الرسمية.

إذا لم تكن قد طلبت هذه الخدمة، يرجى تجاهل هذا البريد أو الاتصال بنا على 8005555.

مع أطيب التحيات،
الخدمات الرقمية - وزارة الطاقة والبنية التحتية`,
  },
}

const CONFIRMATION_TEMPLATE = {
  en: {
    subject: 'Request Confirmation — MOEI',
    body: `Dear Customer,

This is to confirm that your service request has been received and is being processed.

Reference Number: ${MOCK_REF_NUMBER}
Estimated Processing Time: ${MOCK_PROCESSING_TIME_EN}

You can track your request status through our portal or by calling 8005555.

Best regards,
MOEI Customer Service`,
  },
  ar: {
    subject: 'تأكيد الطلب — وزارة الطاقة والبنية التحتية',
    body: `عزيزي العميل،

نؤكد استلام طلب الخدمة الخاص بكم وجاري معالجته.

الرقم المرجعي: ${MOCK_REF_NUMBER}
الوقت المتوقع للمعالجة: ${MOCK_PROCESSING_TIME_AR}

يمكنكم متابعة حالة الطلب من خلال بوابتنا الإلكترونية أو الاتصال على 8005555.

مع أطيب التحيات،
خدمة العملاء - وزارة الطاقة والبنية التحتية`,
  },
}

// ─── Component ─────────────────────────────────────────────────────────────────

interface SendUaepassEmailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customerName: string
  customerId?: string
}

export function SendUaepassEmailDialog({
  open,
  onOpenChange,
  customerName,
  customerId,
}: SendUaepassEmailDialogProps) {
  const { language, currentAgent } = useAppStore()
  const isAr = language === 'ar'
  const isMobile = useIsMobile()

  const [toEmail, setToEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [template, setTemplate] = useState<EmailTemplate>('uaepass_login')
  const [customSubject, setCustomSubject] = useState('')
  const [customBody, setCustomBody] = useState('')
  const [sending, setSending] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const emailInvalid = toEmail.trim() !== '' && !isValidEmail(toEmail.trim())
  const emailEmpty = toEmail.trim() === ''
  const customSubjectEmpty = template === 'custom' && customSubject.trim() === ''
  const customBodyEmpty = template === 'custom' && customBody.trim() === ''

  // Reset form when dialog closes
  const resetForm = () => {
    setToEmail('')
    setEmailTouched(false)
    setTemplate('uaepass_login')
    setCustomSubject('')
    setCustomBody('')
    setPreviewing(false)
    setSendError(null)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Use requestAnimationFrame to avoid synchronous setState in render
      requestAnimationFrame(() => {
        resetForm()
      })
    }
    onOpenChange(nextOpen)
  }

  // Get template content
  const getTemplateContent = () => {
    const lang = isAr ? 'ar' : 'en'
    switch (template) {
      case 'uaepass_login':
        return UAEPASS_TEMPLATE[lang]
      case 'request_confirmation':
        return CONFIRMATION_TEMPLATE[lang]
      case 'custom':
        return {
          subject: customSubject,
          body: customBody,
        }
    }
  }

  const content = getTemplateContent()

  // Send email
  const handleSend = async () => {
    setEmailTouched(true)

    // Validate email
    if (emailEmpty) {
      toast.error(isAr ? 'يرجى إدخال البريد الإلكتروني' : 'Please enter email address')
      return
    }
    if (emailInvalid) {
      toast.error(isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Invalid email format')
      return
    }

    // Validate custom template
    if (template === 'custom') {
      if (customSubjectEmpty) {
        toast.error(isAr ? 'يرجى إدخال موضوع الرسالة' : 'Please enter email subject')
        return
      }
      if (customBodyEmpty) {
        toast.error(isAr ? 'يرجى إدخال نص الرسالة' : 'Please enter email body')
        return
      }
    }

    setSendError(null)
    setSending(true)
    try {
      const res = await fetch('/api/email/send?XTransformPort=3002', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toEmail.trim(),
          subject: content.subject,
          body: content.body,
          type: template === 'uaepass_login' ? 'uaepass_login' : template,
          customerId,
          customerName,
        }),
      })

      if (res.ok) {
        toast.success(isAr ? 'تم إرسال البريد بنجاح' : 'Email sent successfully')
        onOpenChange(false)
        resetForm()

        // Log action
        if (currentAgent) {
          try {
            await fetch('/api/employer-sessions/action?XTransformPort=3002', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentId: currentAgent.id,
                agentEmail: currentAgent.email,
                action: 'send_uaepass_email',
                details: { to: toEmail.trim(), template, customerName, customerId },
                channel: 'email',
                targetId: customerId,
              }),
            })
          } catch { /* silent */ }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        const errorMsg = data.error || (isAr ? 'فشل إرسال البريد' : 'Failed to send email')
        setSendError(errorMsg)
        toast.error(errorMsg)
      }
    } catch {
      const errorMsg = isAr ? 'خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.' : 'Network error. Please try again.'
      setSendError(errorMsg)
      toast.error(errorMsg)
    }
    setSending(false)
  }

  // ─── Shared Content ────────────────────────────────────────────────────────

  const dialogTitleContent = (
    <>
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-green-100 flex items-center justify-center">
        <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
      </div>
      <div>
        <div>{isAr ? 'إرسال بريد إلكتروني' : 'Send Email'}</div>
        <div className="text-xs font-normal text-muted-foreground">
          {isAr ? 'هوية الإمارات المتحدة (UAE PASS)' : 'UAE PASS Integration'}
        </div>
      </div>
    </>
  )

  const dialogDesc = isAr
    ? `إرسال بريد إلى ${customerName}`
    : `Send email to ${customerName}`

  const isSendDisabled = emailEmpty || emailInvalid || sending ||
    (template === 'custom' && (customSubjectEmpty || customBodyEmpty))

  const bodyContent = (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Send error */}
      {sendError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      {/* To Email */}
      <div className="space-y-2">
        <Label htmlFor="uaepass-email" className="text-sm">
          {isAr ? 'بريد العميل الإلكتروني' : 'Customer Email'}
        </Label>
        <Input
          id="uaepass-email"
          type="email"
          placeholder="customer@example.com"
          value={toEmail}
          onChange={(e) => {
            setToEmail(e.target.value)
            setSendError(null)
          }}
          onBlur={() => setEmailTouched(true)}
          className={`text-sm min-h-[44px] w-full ${
            emailTouched && emailInvalid
              ? 'border-red-400 focus-visible:ring-red-400'
              : ''
          }`}
        />
        {emailTouched && emailInvalid && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {isAr ? 'صيغة البريد الإلكتروني غير صحيحة' : 'Please enter a valid email address'}
          </p>
        )}
      </div>

      {/* Template Selector */}
      <div className="space-y-2">
        <Label className="text-sm">{isAr ? 'نوع الرسالة' : 'Email Template'}</Label>
        <Select value={template} onValueChange={(v) => setTemplate(v as EmailTemplate)}>
          <SelectTrigger className="text-sm min-h-[44px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="uaepass_login">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-ae-gold-500" />
                {isAr ? 'طلب تسجيل الهوية الرقمية' : 'UAE PASS Login Request'}
              </div>
            </SelectItem>
            <SelectItem value="request_confirmation">
              <div className="flex items-center gap-2">
                <FileCheck className="w-3.5 h-3.5 text-green-500" />
                {isAr ? 'تأكيد الطلب' : 'Request Confirmation'}
              </div>
            </SelectItem>
            <SelectItem value="custom">
              <div className="flex items-center gap-2">
                <PenLine className="w-3.5 h-3.5 text-amber-500" />
                {isAr ? 'رسالة مخصصة' : 'Custom Email'}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Custom Subject & Body (for custom template) */}
      {template === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label className="text-sm">{isAr ? 'الموضوع' : 'Subject'}</Label>
            <Input
              value={customSubject}
              onChange={(e) => setCustomSubject(e.target.value)}
              placeholder={isAr ? 'أدخل موضوع الرسالة' : 'Enter email subject'}
              className={`text-sm min-h-[44px] ${
                customSubjectEmpty && emailTouched ? 'border-red-400 focus-visible:ring-red-400' : ''
              }`}
            />
            {customSubjectEmpty && emailTouched && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {isAr ? 'الموضوع مطلوب' : 'Subject is required'}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label className="text-sm">{isAr ? 'نص الرسالة' : 'Body'}</Label>
            <Textarea
              value={customBody}
              onChange={(e) => setCustomBody(e.target.value)}
              placeholder={isAr ? 'أدخل نص الرسالة' : 'Enter email body'}
              className={`text-sm min-h-[120px] resize-none ${
                customBodyEmpty && emailTouched ? 'border-red-400 focus-visible:ring-red-400' : ''
              }`}
              rows={5}
            />
            {customBodyEmpty && emailTouched && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {isAr ? 'نص الرسالة مطلوب' : 'Email body is required'}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Preview */}
      {template !== 'custom' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{isAr ? 'معاينة' : 'Preview'}</Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 min-h-[32px]"
              onClick={() => setPreviewing(!previewing)}
            >
              <Eye className="w-3 h-3" />
              {previewing ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'عرض' : 'Show')}
            </Button>
          </div>
          <AnimatePresence>
            {previewing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-ae-black-100 bg-ae-black-50/30 p-3 text-xs overflow-hidden"
              >
                <div className="mb-2">
                  <span className="text-ae-black-400">{isAr ? 'الموضوع:' : 'Subject:'} </span>
                  <span className="font-medium text-ae-black-700">{content.subject}</span>
                </div>
                <div className="whitespace-pre-wrap text-ae-black-600 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                  {content.body}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Template badge */}
      {template === 'uaepass_login' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-200">
          <Shield className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-[11px] text-green-700">
            {isAr
              ? 'سيحتوي البريد على رابط تسجيل دخول الهوية الرقمية الرسمي'
              : 'Email will contain official UAE PASS login link'}
          </p>
        </div>
      )}
    </div>
  )

  const footerContent = (
    <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
      <Button
        variant="outline"
        onClick={() => onOpenChange(false)}
        className="text-sm min-h-[44px] w-full sm:w-auto"
      >
        {isAr ? 'إلغاء' : 'Cancel'}
      </Button>
      <Button
        onClick={handleSend}
        disabled={isSendDisabled}
        className="text-sm bg-ae-gold-500 hover:bg-ae-gold-600 text-white gap-1.5 min-h-[44px] w-full sm:w-auto"
      >
        {sending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isAr ? 'إرسال' : 'Send'}
      </Button>
    </div>
  )

  // ─── Mobile: Sheet (slide up from bottom) ──────────────────────────────────
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="w-full max-h-[92vh] flex flex-col p-0 gap-0 rounded-t-2xl overflow-hidden">
          <SheetHeader className="px-4 pt-4 pb-3 shrink-0 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              {dialogTitleContent}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {dialogDesc}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {bodyContent}
          </div>

          <SheetFooter className="px-4 py-4 border-t shrink-0">
            {footerContent}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  // ─── Desktop: Dialog ───────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-full max-w-lg max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            {dialogTitleContent}
          </DialogTitle>
          <DialogDescription>
            {dialogDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {bodyContent}
        </div>

        <DialogFooter className="px-4 sm:px-6 py-4 border-t shrink-0">
          {footerContent}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
