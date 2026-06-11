'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  CheckCircle2,
  Clock,
  Star,
  CalendarDays,
  CreditCard,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  ChevronRight,
  Loader2,
  FileText,
  Paperclip,
  Mic,
  Smile,
  X,
  ArrowRight,
  Zap,
  Home,
  Flame,
  Building2,
  Droplets,
  Monitor,
  Send,
  AlertCircle,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// ─── Shared Animation Variants ──────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
}

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
}

// ─── Section Header Component ────────────────────────────────────────────────

export function SectionHeader({
  title,
  description,
  icon: Icon,
  accentColor = 'from-brand-600 to-brand-400',
}: {
  title: string
  description?: string
  icon?: React.ElementType
  accentColor?: string
}) {
  const { isRTL } = useTranslation()
  return (
    <motion.div variants={fadeUp} custom={0} className="mb-6">
      <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        {Icon && (
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${accentColor} flex items-center justify-center shadow-md`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
        <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
          <h2 className="text-2xl sm:text-3xl font-bold text-base-900">{title}</h2>
          {description && (
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">{description}</p>
          )}
        </div>
      </div>
      <div className={`w-20 h-1 bg-gradient-to-r ${accentColor} rounded-full mt-3 ${isRTL ? 'mr-auto' : ''}`} />
    </motion.div>
  )
}

// ─── Toast Notification System ───────────────────────────────────────────────

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

let toastListeners: ((toasts: ToastItem[]) => void)[] = []
let toastQueue: ToastItem[] = []

function emitToast(message: string, type: ToastItem['type'] = 'success') {
  const id = `toast-${Date.now()}`
  toastQueue = [...toastQueue, { id, message, type }]
  toastListeners.forEach((fn) => fn([...toastQueue]))
  setTimeout(() => {
    toastQueue = toastQueue.filter((t) => t.id !== id)
    toastListeners.forEach((fn) => fn([...toastQueue]))
  }, 3500)
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  useEffect(() => {
    toastListeners.push(setToasts)
    return () => {
      toastListeners = toastListeners.filter((fn) => fn !== setToasts)
    }
  }, [])
  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 min-w-[280px] ${
              toast.type === 'success'
                ? 'bg-emerald-600 text-white'
                : toast.type === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-brand-600 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

// ─── Back to Top Button ──────────────────────────────────────────────────────

export function BackToTopButton() {
  const [visible, setVisible] = useState(false)
  const { t, isRTL } = useTranslation()

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={`fixed bottom-40 ${isRTL ? 'left-6' : 'right-6'} z-50 w-11 h-11 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center`}
          aria-label={t('backToTop')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// ─── 1. Service Request Progress Tracker ─────────────────────────────────────

interface ProgressStage {
  key: string
  labelKey: string
  icon: React.ElementType
  timestamp?: string
  status: 'completed' | 'current' | 'pending'
  estimatedTime?: string
}

interface TrackedRequest {
  refNumber: string
  title: string
  stages: ProgressStage[]
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  submitted: FileText,
  underReview: Search,
  approved: CheckCircle2,
  inProgress: Clock,
  completed: CheckCircle2
}

export function ServiceRequestProgressTracker() {
  const { t, isRTL } = useTranslation()
  const [requests, setRequests] = useState<TrackedRequest[]>([])
  const [selectedReq, setSelectedReq] = useState<TrackedRequest | null>(null)
  const [lookupRef, setLookupRef] = useState('')
  const [lookupResult, setLookupResult] = useState<TrackedRequest | null>(null)
  const [lookupError, setLookupError] = useState(false)

  useEffect(() => {
    fetch('/api/portal/service-requests')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          const reqs = data.map((r: any) => ({
            refNumber: r.refNumber,
            title: r.title,
            stages: r.stages.map((s: any) => ({
              ...s,
              icon: STAGE_ICONS[s.key] || CheckCircle2
            }))
          }))
          setRequests(reqs)
          if (reqs.length > 0) setSelectedReq(reqs[0])
        }
      })
      .catch(console.error)
  }, [])

  const handleLookup = useCallback(() => {
    if (!lookupRef.trim()) return
    const found = requests.find((r) => r.refNumber.toUpperCase() === lookupRef.toUpperCase())
    if (found) {
      setLookupResult(found)
      setSelectedReq(found)
      setLookupError(false)
      emitToast(t('toastCaseCreated'))
    } else {
      setLookupResult(null)
      setLookupError(true)
    }
  }, [lookupRef, t])

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Request Selector */}
      <div className="flex flex-wrap gap-2">
        {requests.map((req) => (
          <button
            key={req.refNumber}
            onClick={() => { setSelectedReq(req); setLookupResult(null); setLookupError(false) }}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
              selectedReq?.refNumber === req.refNumber
                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                : 'bg-white text-base-700 border-base-200 hover:bg-brand-50 hover:border-brand-300'
            }`}
          >
            <span className="font-mono font-semibold">{req.refNumber}</span>
            <span className="mx-1.5 opacity-50">•</span>
            <span>{t((req as any).titleKey || req.title)}</span>
          </button>
        ))}
      </div>

      {/* Progress Stages */}
      <div className="relative">
        {selectedReq && <div className={`hidden sm:flex items-center justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          {selectedReq.stages.map((stage, i) => {
            const Icon = stage.icon
            const isLast = i === selectedReq.stages.length - 1
            return (
              <div key={stage.key} className="flex-1 flex flex-col items-center relative">
                {/* Connecting line */}
                {!isLast && (
                  <div className={`absolute top-4 ${isRTL ? 'right-1/2' : 'left-1/2'} w-full h-0.5 ${
                    stage.status === 'completed' ? 'bg-emerald-400' : 'bg-base-200'
                  }`} style={{ zIndex: 0 }} />
                )}
                {/* Icon circle */}
                <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center mb-2 transition-all ${
                  stage.status === 'completed' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' :
                  stage.status === 'current' ? 'bg-brand-600 text-white shadow-md shadow-brand-200 ring-4 ring-brand-100' :
                  'bg-base-100 text-base-400 border border-base-200'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                {/* Label */}
                <p className={`text-xs font-medium text-center ${
                  stage.status === 'completed' ? 'text-emerald-700' :
                  stage.status === 'current' ? 'text-brand-700' :
                  'text-base-400'
                }`}>
                  {t(stage.labelKey as Parameters<typeof t>[0])}
                </p>
                {/* Timestamp */}
                {stage.timestamp && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stage.timestamp}</p>
                )}
                {/* Estimated time */}
                {stage.estimatedTime && (
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3 text-brand-500" />
                    <span className="text-[10px] text-brand-600 font-medium">{t('estimatedTimeRemaining')}: {stage.estimatedTime}</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>}

        {/* Mobile vertical layout */}
        {selectedReq && <div className="sm:hidden space-y-3">
          {selectedReq.stages.map((stage, i) => {
            const Icon = stage.icon
            return (
              <div key={stage.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    stage.status === 'completed' ? 'bg-emerald-500 text-white' :
                    stage.status === 'current' ? 'bg-brand-600 text-white ring-2 ring-brand-200' :
                    'bg-base-100 text-base-400 border border-base-200'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {i < selectedReq.stages.length - 1 && (
                    <div className={`w-0.5 h-6 ${stage.status === 'completed' ? 'bg-emerald-300' : 'bg-base-200'}`} />
                  )}
                </div>
                <div className="pt-1">
                  <p className={`text-sm font-medium ${
                    stage.status === 'completed' ? 'text-emerald-700' :
                    stage.status === 'current' ? 'text-brand-700' : 'text-base-400'
                  }`}>
                    {t(stage.labelKey as Parameters<typeof t>[0])}
                  </p>
                  {stage.timestamp && <p className="text-xs text-muted-foreground">{stage.timestamp}</p>}
                  {stage.estimatedTime && (
                    <p className="text-xs text-brand-600 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {t('estimatedTimeRemaining')}: {stage.estimatedTime}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>}
      </div>

      {/* Track Another Request */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-brand-50/50 to-transparent">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-base-800 mb-2 flex items-center gap-2">
            <Search className="w-4 h-4 text-brand-600" />
            {t('trackAnotherRequest')}
          </p>
          <div className="flex gap-2">
            <Input
              value={lookupRef}
              onChange={(e) => { setLookupRef(e.target.value); setLookupError(false) }}
              placeholder={t('enterRefNumber')}
              className="h-9 text-sm flex-1"
            />
            <Button size="sm" className="h-9 bg-brand-600 hover:bg-brand-700 text-white" onClick={handleLookup} aria-label={t('lookup')}>
              {t('lookup')}
            </Button>
          </div>
          {lookupError && <p className="text-xs text-red-600 mt-2">{t('requestNotFound')}</p>}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── 2. Appointment Scheduling ───────────────────────────────────────────────

interface AppointmentSlot {
  time: string
  available: boolean
}

interface Appointment {
  id: string
  date: string
  time: string
  service: string
  status: 'upcoming' | 'completed' | 'cancelled'
  ref: string
}

function generateSlots(date: Date): AppointmentSlot[] {
  const slots: AppointmentSlot[] = []
  const day = date.getDay()
  // Fri/Sat are weekend in UAE
  if (day === 5 || day === 6) return []
  const hours = [8, 9, 10, 11, 13, 14, 15, 16]
  hours.forEach((h) => {
    slots.push({ time: `${h.toString().padStart(2, '0')}:00`, available: true })
    slots.push({ time: `${h.toString().padStart(2, '0')}:30`, available: true })
  })
  return slots
}

const MOEI_SERVICES = [
  { key: 'electricity', labelKey: 'catElectricityWater' },
  { key: 'housing', labelKey: 'catHousing' },
  { key: 'petroleum', labelKey: 'catPetroleum' },
  { key: 'transport', labelKey: 'catTransport' },
  { key: 'digital', labelKey: 'catDigital' },
  { key: 'sustainability', labelKey: 'catSustainability' },
]

export function AppointmentScheduler() {
  const { t, isRTL } = useTranslation()
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [selectedService, setSelectedService] = useState<string | null>(null)
  // slots derived from selectedDate via useMemo below
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)
  const [bookingRef, setBookingRef] = useState('')
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    fetch('/api/portal/appointments')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setUpcomingAppointments(data.map((a: any) => ({
            id: a.id,
            date: new Date(a.date).toISOString().split('T')[0],
            time: a.timeSlot,
            service: a.service,
            status: a.status === 'scheduled' ? 'upcoming' : a.status,
            ref: a.id.slice(-6).toUpperCase()
          })))
        }
      })
      .catch(console.error)
  }, [])

  // Generate next 14 days
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  }).filter((d) => d.getDay() !== 5 && d.getDay() !== 6) // Skip UAE weekend

  const slots = useMemo(() => {
    if (selectedDate) {
      return generateSlots(selectedDate)
    }
    return []
  }, [selectedDate])

  // Reset selectedTime when selectedDate changes (event handler pattern)
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date)
    setSelectedTime(null)
  }, [])

  const handleBook = useCallback(async () => {
    if (!selectedDate || !selectedTime || !selectedService) return
    setBooking(true)
    
    try {
      const res = await fetch('/api/portal/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate.toISOString(),
          timeSlot: selectedTime,
          service: t(selectedService as Parameters<typeof t>[0])
        })
      })
      const data = await res.json()
      if (res.ok) {
        const newAppt: Appointment = {
          id: data.id,
          date: new Date(data.date).toISOString().split('T')[0],
          time: data.timeSlot,
          service: data.service,
          status: 'upcoming',
          ref: data.id.slice(-6).toUpperCase(),
        }
        setUpcomingAppointments((prev) => [newAppt, ...prev])
        setBookingRef(newAppt.ref)
        setBooked(true)
        emitToast(t('toastAppointmentBooked'))
        setTimeout(() => {
          setBooked(false)
          setSelectedDate(null)
          setSelectedTime(null)
          setSelectedService(null)
        }, 3000)
      }
    } catch (error) {
      console.error(error)
      emitToast(t('bookingFailed'), 'error')
    } finally {
      setBooking(false)
    }
  }, [selectedDate, selectedTime, selectedService, t])

  const morningSlots = slots.filter((s) => parseInt(s.time) < 12)
  const afternoonSlots = slots.filter((s) => parseInt(s.time) >= 12)

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {booked ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-emerald-800 mb-1">{t('bookingConfirmed')}</h3>
          <p className="text-sm text-muted-foreground">{t('bookingReference')}: <span className="font-mono font-bold text-brand-700">{bookingRef}</span></p>
        </motion.div>
      ) : (
        <>
          {/* Service Type Selection */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('selectService')}</p>
            <div className="flex flex-wrap gap-2">
              {MOEI_SERVICES.map((svc) => (
                <button
                  key={svc.key}
                  onClick={() => setSelectedService(svc.key)}
                  aria-label={`${t('selectService')}: ${t(svc.labelKey as any)}`}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    selectedService === svc.key
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-base-700 border-base-200 hover:bg-brand-50'
                  }`}
                >
                  {t(svc.labelKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('selectDate')}</p>
            <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
              {availableDates.map((d) => {
                const isSelected = selectedDate && d.toDateString() === selectedDate.toDateString()
                const isToday = d.toDateString() === new Date().toDateString()
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => handleDateSelect(d)}
                    aria-label={d.toDateString()}
                    className={`flex-shrink-0 w-16 py-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                        : 'bg-white text-base-700 border-base-200 hover:bg-brand-50'
                    }`}
                  >
                    <p className="text-[10px] uppercase font-medium opacity-70">
                      {d.toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { weekday: 'short' })}
                    </p>
                    <p className="text-lg font-bold">{d.getDate()}</p>
                    <p className="text-[10px] opacity-70">
                      {d.toLocaleDateString(isRTL ? 'ar-AE' : 'en-AE', { month: 'short' })}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time Slots */}
          {selectedDate && (
            <div>
              <p className="text-sm font-semibold text-base-800 mb-2">{t('availableSlots')}</p>
              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noSlotsAvailable')}</p>
              ) : (
                <div className="space-y-3">
                  {/* Morning */}
                  {morningSlots.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('morning')}</p>
                      <div className="flex flex-wrap gap-2">
                        {morningSlots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => slot.available && setSelectedTime(slot.time)}
                            aria-label={`${t('timeSlot')}: ${slot.time}`}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                              selectedTime === slot.time
                                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                : slot.available
                                  ? 'bg-white text-base-700 border-base-200 hover:bg-brand-50'
                                  : 'bg-base-50 text-base-300 border-base-100 cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Afternoon */}
                  {afternoonSlots.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{t('afternoon')}</p>
                      <div className="flex flex-wrap gap-2">
                        {afternoonSlots.map((slot) => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => slot.available && setSelectedTime(slot.time)}
                            aria-label={`${t('timeSlot')}: ${slot.time}`}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                              selectedTime === slot.time
                                ? 'bg-brand-600 text-white border-brand-600 shadow-md'
                                : slot.available
                                  ? 'bg-white text-base-700 border-base-200 hover:bg-brand-50'
                                  : 'bg-base-50 text-base-300 border-base-100 cursor-not-allowed'
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Confirm Booking */}
          <Button
            className="w-full bg-brand-600 hover:bg-brand-700 text-white h-11"
            disabled={!selectedDate || !selectedTime || !selectedService || booking}
            onClick={handleBook}
            aria-label={t('confirmBooking')}
          >
            {booking ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CalendarDays className="w-4 h-4 mr-2" />}
            {t('confirmBooking')}
          </Button>
        </>
      )}

      {/* Upcoming Appointments */}
      <div>
        <p className="text-sm font-semibold text-base-800 mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-600" />
          {t('upcomingAppointments')}
        </p>
        {upcomingAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">{t('noUpcomingAppointments')}</p>
        ) : (
          <div className="space-y-2">
            {upcomingAppointments.map((appt) => (
              <div key={appt.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-base-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-5 h-5 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-base-900">{appt.service}</p>
                  <p className="text-xs text-muted-foreground">{appt.date} • {appt.time}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <Badge variant="outline" className="text-[10px] font-mono">{appt.ref}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-1">{appt.status === 'upcoming' ? t('upcomingAppointments').toString().slice(0, 8) : appt.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 4. Payments & Bills Section ─────────────────────────────────────────────

interface BillItem {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'overdue'
  description: string
  dueDate?: string
}

// Removed MOCK_BILLS

export function PaymentsSection() {
  const { t, isRTL } = useTranslation()
  const [paying, setPaying] = useState(false)
  const [paySuccess, setPaySuccess] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank' | 'applepay'>('card')
  const [payDialogOpen, setPayDialogOpen] = useState(false)

  const [bills, setBills] = useState<BillItem[]>([])

  useEffect(() => {
    fetch('/api/portal/bills')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setBills(data.map((b: any) => ({
            id: b.id,
            date: new Date(b.createdAt).toISOString().split('T')[0],
            amount: b.amount,
            status: b.status,
            description: b.description || 'Service Bill',
            dueDate: b.dueDate ? new Date(b.dueDate).toISOString().split('T')[0] : undefined
          })))
        }
      })
      .catch(console.error)
  }, [])

  const totalOutstanding = bills.filter((b) => b.status !== 'paid').reduce((s, b) => s + b.amount, 0)
  const nextDueDate = bills.filter((b) => b.dueDate && b.status !== 'paid').sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))[0]?.dueDate

  const handlePay = useCallback(() => {
    setPaying(true)
    setTimeout(() => {
      setPaying(false)
      setPaySuccess(true)
      emitToast(t('toastPaymentSuccess'))
      setTimeout(() => {
        setPaySuccess(false)
        setPayDialogOpen(false)
      }, 2500)
    }, 2000)
  }, [t])

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Outstanding Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-brand-600 to-brand-700 text-white">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-white/70 uppercase tracking-wider">{t('totalOutstanding')}</p>
            <p className="text-2xl font-bold mt-1">{t('aed')} {totalOutstanding.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('nextDueDate')}</p>
            <p className="text-lg font-bold text-base-900 mt-1">{nextDueDate || '—'}</p>
            <Badge variant="outline" className="mt-1 text-[10px] text-amber-700 bg-amber-50 border-amber-200">{t('billPending')}</Badge>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('paymentStatus')}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-2 rounded-full bg-base-100 overflow-hidden">
                <div className="h-full w-2/3 rounded-full bg-emerald-500" />
              </div>
              <span className="text-sm font-bold text-emerald-700">2/3</span>
            </div>
            <Button className="w-full mt-3 h-9 bg-brand-600 hover:bg-brand-700 text-white text-xs" onClick={() => setPayDialogOpen(true)} aria-label={t('payNow')}>
              <CreditCard className="w-4 h-4 mr-1.5" /> {t('payNow')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bill History */}
      <div>
        <p className="text-sm font-semibold text-base-800 mb-3">{t('billHistory')}</p>
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {bills.map((bill) => (
            <div key={bill.id} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-base-100 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                bill.status === 'paid' ? 'bg-emerald-50' : bill.status === 'overdue' ? 'bg-red-50' : 'bg-amber-50'
              }`}>
                <CreditCard className={`w-4 h-4 ${
                  bill.status === 'paid' ? 'text-emerald-600' : bill.status === 'overdue' ? 'text-red-600' : 'text-amber-600'
                }`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-base-900 truncate">{t(bill.description as any) || bill.description}</p>
                <p className="text-xs text-muted-foreground">{bill.date}</p>
              </div>
              <div className={`text-right flex-shrink-0 ${isRTL ? 'text-left' : ''}`}>
                <p className="text-sm font-bold text-base-900">{t('aed')} {bill.amount.toFixed(2)}</p>
                <Badge variant="outline" className={`text-[9px] ${
                  bill.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  bill.status === 'overdue' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {t(bill.status === 'paid' ? 'billPaid' : bill.status === 'overdue' ? 'billOverdue' : 'billPending')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Pay Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {paySuccess ? (
                <><CheckCircle2 className="w-5 h-5 text-emerald-600" />{t('paymentSuccess')}</>
              ) : (
                <><CreditCard className="w-5 h-5 text-brand-600" />{t('payNow')}</>
              )}
            </DialogTitle>
          </DialogHeader>
          {paySuccess ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto mb-3" />
              <p className="text-lg font-bold text-emerald-800">{t('paymentSuccess')}</p>
              <p className="text-sm text-muted-foreground mt-1">{t('aed')} {totalOutstanding.toFixed(2)}</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="text-center p-4 bg-brand-50 rounded-xl">
                <p className="text-xs text-brand-700 uppercase font-medium">{t('totalOutstanding')}</p>
                <p className="text-3xl font-bold text-brand-800">{t('aed')} {totalOutstanding.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">{t('paymentMethod')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'card' as const, label: t('paymentCard'), icon: CreditCard },
                    { key: 'bank' as const, label: t('paymentBank'), icon: Building2 },
                    { key: 'applepay' as const, label: t('paymentApplePay'), icon: Zap },
                  ]).map((method) => (
                    <button
                      key={method.key}
                      onClick={() => setPaymentMethod(method.key)}
                      aria-label={`${t('selectPaymentMethod')}: ${method.label}`}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        paymentMethod === method.key
                          ? 'bg-brand-50 border-brand-300 shadow-md'
                          : 'bg-white border-base-200 hover:bg-base-50'
                      }`}
                    >
                      <method.icon className={`w-5 h-5 mx-auto mb-1 ${paymentMethod === method.key ? 'text-brand-600' : 'text-base-400'}`} />
                      <p className="text-[11px] font-medium">{method.label}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {!paySuccess && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayDialogOpen(false)}>{t('cancel')}</Button>
              <Button className="bg-brand-600 hover:bg-brand-700 text-white" onClick={handlePay} disabled={paying} aria-label={t('payNow')}>
                {paying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CreditCard className="w-4 h-4 mr-1" />}
                {paying ? t('paymentProcessing') : `${t('payNow')} ${t('aed')} ${totalOutstanding.toFixed(2)}`}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── 5. Feedback & Rating System ──────────────────────────────────────────────

interface FeedbackEntry {
  id: string
  rating: number
  category: string
  comment: string
  emoji: string
  createdAt: string
  anonymized?: boolean
}

const FEEDBACK_CATEGORIES = [
  { key: 'feedbackServiceQuality', labelKey: 'feedbackServiceQuality' },
  { key: 'feedbackResponseTime', labelKey: 'feedbackResponseTime' },
  { key: 'feedbackStaffHelpfulness', labelKey: 'feedbackStaffHelpfulness' },
  { key: 'feedbackEaseOfUse', labelKey: 'feedbackEaseOfUse' },
  { key: 'feedbackOverall', labelKey: 'feedbackOverall' },
]

const EMOJI_OPTIONS = [
  { emoji: '😊', labelKey: 'emojiHappy' },
  { emoji: '🙂', labelKey: 'emojiSatisfied' },
  { emoji: '😐', labelKey: 'emojiNeutral' },
  { emoji: '😕', labelKey: 'emojiDissatisfied' },
  { emoji: '😞', labelKey: 'emojiUnhappy' },
]

// Removed MOCK_RECENT_FEEDBACK

export function FeedbackRatingSystem() {
  const { t, isRTL } = useTranslation()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [category, setCategory] = useState<string | null>(null)
  const [emoji, setEmoji] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [recentFeedback, setRecentFeedback] = useState<FeedbackEntry[]>([])
  const [myFeedback, setMyFeedback] = useState<FeedbackEntry[]>([])

  useEffect(() => {
    fetch('/api/feedback')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRecentFeedback(data.map((f: any) => ({
            id: f.id,
            rating: f.rating,
            category: 'feedbackOverall', // fallback
            comment: f.comment,
            emoji: f.rating >= 4 ? '😊' : f.rating >= 3 ? '😐' : '😞',
            createdAt: new Date(f.createdAt).toLocaleDateString(),
            anonymized: true
          })))
        }
      })
      .catch(console.error)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (rating === 0 || !category) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          categories: [category],
          comment,
          channel: 'web'
        })
      })
      if (res.ok) {
        const data = await res.json()
        const entry: FeedbackEntry = {
          id: data.id,
          rating,
          category,
          comment,
          emoji: emoji || '',
          createdAt: t('justNow'),
        }
        setMyFeedback((prev) => [entry, ...prev])
        setSubmitted(true)
        emitToast(t('toastFeedbackSubmitted'))
        setTimeout(() => {
          setSubmitted(false)
          setRating(0)
          setCategory(null)
          setEmoji(null)
          setComment('')
        }, 3000)
      } else {
        emitToast('Feedback submission failed', 'error')
      }
    } catch (e) {
      console.error(e)
      emitToast('Feedback submission failed', 'error')
    } finally {
      setSubmitting(false)
    }
  }, [rating, category, emoji, comment, t])

  return (
    <div className={`space-y-6 ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {submitted ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-emerald-800">{t('feedbackSubmitted')}</h3>
        </motion.div>
      ) : (
        <>
          {/* Star Rating */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('rateYourExperience')}</p>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(star)}
                  aria-label={t('rateStars', { star: star.toString() }) || `Rate ${star} stars`}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoverRating || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-base-200'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Emoji Quick Select */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('emojiPicker')}</p>
            <div className="flex gap-2">
              {EMOJI_OPTIONS.map((opt) => (
                <button
                  key={opt.emoji}
                  aria-label={t('emojiLabel', { emoji: opt.emoji }) || `Select emoji ${opt.emoji}`}
                  onClick={() => setEmoji(opt.emoji)}
                  className={`text-2xl p-2 rounded-xl border transition-all ${
                    emoji === opt.emoji
                      ? 'bg-brand-50 border-brand-300 shadow-md scale-110'
                      : 'bg-white border-base-100 hover:bg-base-50'
                  }`}
                  title={t(opt.labelKey as Parameters<typeof t>[0])}
                >
                  {opt.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('selectCategory')}</p>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  aria-label={t(cat.labelKey as any)}
                  onClick={() => setCategory(cat.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    category === cat.key
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-base-700 border-base-200 hover:bg-brand-50'
                  }`}
                >
                  {t(cat.labelKey as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <p className="text-sm font-semibold text-base-800 mb-2">{t('writeFeedback')}</p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('writeFeedback')}
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full bg-brand-600 hover:bg-brand-700 text-white h-11"
            disabled={rating === 0 || !category || submitting}
            onClick={handleSubmit}
            aria-label={t('submitFeedback')}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MessageSquare className="w-4 h-4 mr-2" />}
            {t('submitFeedback')}
          </Button>
        </>
      )}

      {/* Recent Feedback from Others */}
      <div>
        <p className="text-sm font-semibold text-base-800 mb-3">{t('recentFeedback')}</p>
        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
          {recentFeedback.map((fb) => (
            <div key={fb.id} className="p-3 bg-white rounded-xl border border-base-100 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{fb.emoji}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-base-200'}`} />
                  ))}
                </div>
                <Badge variant="outline" className="text-[9px] ml-auto">{t(fb.category as Parameters<typeof t>[0])}</Badge>
              </div>
              <p className="text-xs text-base-700 leading-relaxed">{fb.comment}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{fb.anonymized ? t('anonymous') : ''} • {fb.createdAt}</p>
            </div>
          ))}
        </div>
      </div>

      {/* My Feedback History */}
      {myFeedback.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-base-800 mb-3">{t('yourFeedbackHistory')}</p>
          <div className="space-y-2">
            {myFeedback.map((fb) => (
              <div key={fb.id} className="p-3 bg-brand-50/50 rounded-xl border border-brand-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{fb.emoji}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= fb.rating ? 'fill-amber-400 text-amber-400' : 'text-base-200'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground ml-auto">{fb.createdAt}</span>
                </div>
                {fb.comment && <p className="text-xs text-base-700 mt-1">{fb.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 7. Communication Hub Enhancement (Chat Toolbar) ────────────────────────

export function ChatToolbar({
  onAttach = () => console.warn('Missing handler: ChatToolbar.onAttach'),
  onVoice = () => console.warn('Missing handler: ChatToolbar.onVoice'),
  onEmoji = () => console.warn('Missing handler: ChatToolbar.onEmoji'),
  isRecording,
  onStopRecording = () => console.warn('Missing handler: ChatToolbar.onStopRecording'),
}: {
  onAttach?: () => void
  onVoice?: () => void
  onEmoji?: () => void
  isRecording?: boolean
  onStopRecording?: () => void
}) {
  const { t, isRTL } = useTranslation()
  const [showEmojis, setShowEmojis] = useState(false)
  const commonEmojis = ['👍', '❤️', '😊', '🙏', '✅', '🇦🇪']

  return (
    <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Attach File */}
      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-brand-600" onClick={onAttach} title={t('attachFile')}>
        <Paperclip className="w-4 h-4" />
      </Button>

      {/* Voice Message */}
      {isRecording ? (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 animate-pulse" onClick={onStopRecording} title={t('stopRecording')}>
          <div className="w-3 h-3 rounded-sm bg-red-500" />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-brand-600" onClick={onVoice} title={t('voiceMessage')}>
          <Mic className="w-4 h-4" />
        </Button>
      )}

      {/* Emoji Picker */}
      <div className="relative">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-brand-600" onClick={() => setShowEmojis(!showEmojis)} title={t('emojiPicker')}>
          <Smile className="w-4 h-4" />
        </Button>
        <AnimatePresence>
          {showEmojis && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className={`absolute bottom-10 ${isRTL ? 'right-0' : 'left-0'} bg-white rounded-xl shadow-lg border border-base-200 p-2 flex gap-1 z-50`}
            >
              {commonEmojis.map((em) => (
                <button
                  key={em}
                  className="text-lg hover:scale-125 transition-transform p-1"
                  onClick={() => { onEmoji?.(); setShowEmojis(false) }}
                >
                  {em}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Enhanced Glassmorphism Search Box ───────────────────────────────────────

export function GlassmorphismSearchBox({
  value,
  onChange,
  onKeyDown,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  placeholder: string
}) {
  const { isRTL } = useTranslation()
  return (
    <div className="relative max-w-lg gradient-border rounded-2xl">
      <Search className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 text-white/60 z-10 ${isRTL ? 'right-4' : 'left-4'}`} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full h-13 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl text-base text-white placeholder-white/50 pl-12 pr-4 shadow-2xl focus:outline-none focus:ring-2 focus:ring-brand-400/50 focus:bg-white/15 transition-all relative z-10"
      />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-brand-500/10 to-transparent pointer-events-none z-0" />
    </div>
  )
}

// ─── Animated Loading Skeletons ───────────────────────────────────────────────

export function PortalSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

export { emitToast, fadeUp, stagger }
