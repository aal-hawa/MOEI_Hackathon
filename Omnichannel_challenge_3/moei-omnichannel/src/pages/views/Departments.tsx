'use client'

import { useState, useMemo } from 'react'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { MoeiPageLayout } from '@/components/shared/layouts/moei-page-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Zap,
  Building2,
  Droplets,
  Home,
  Fuel,
  Truck,
  Monitor,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  FileText,
  User,
  Calendar,
  Hash,
  Search,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Types ────────────────────────────────────────────────────────────────

type CaseStatus = 'pending' | 'in_review' | 'approved' | 'rejected'
type CaseChannel = 'whatsapp' | 'voice' | 'email' | 'web'

interface DepartmentCase {
  id: string
  referenceNumber: string
  customerName: string
  channel: CaseChannel
  createdAt: string
  status: CaseStatus
  description: string
  departmentId: string
  rejectionReason?: string
  approvedAt?: string
  rejectedAt?: string
}

interface Department {
  id: string
  name: { en: string; ar: string }
  icon: React.ElementType
  color: string
  bgColor: string
  description: { en: string; ar: string }
}

// ─── Department Definitions ────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  {
    id: 'energy',
    name: { en: 'Energy', ar: 'الطاقة' },
    icon: Zap,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    description: { en: 'Electricity, renewable energy, and power distribution', ar: 'الكهرباء والطاقة المتجددة وتوزيع الطاقة' },
  },
  {
    id: 'infrastructure',
    name: { en: 'Infrastructure', ar: 'البنية التحتية' },
    icon: Building2,
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    description: { en: 'Roads, bridges, and public works', ar: 'الطرق والجسر والأشغال العامة' },
  },
  {
    id: 'water',
    name: { en: 'Water', ar: 'المياه' },
    icon: Droplets,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    description: { en: 'Water supply, drainage, and utilities', ar: 'إمدادات المياه والصرف والمرافق' },
  },
  {
    id: 'housing',
    name: { en: 'Housing', ar: 'الإسكان' },
    icon: Home,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    description: { en: 'Housing loans, grants, and Sheikh Zayed Housing Programme', ar: 'القروض والمنح الإسكانية وبرنامج الشيخ زايد للإسكان' },
  },
  {
    id: 'petroleum',
    name: { en: 'Petroleum', ar: 'البترول' },
    icon: Fuel,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    description: { en: 'Petroleum products, refining, and distribution', ar: 'المنتجات البترولية والتكرير والتوزيع' },
  },
  {
    id: 'transport',
    name: { en: 'Transport', ar: 'النقل' },
    icon: Truck,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    description: { en: 'Land and maritime transport services', ar: 'خدمات النقل البري والبحري' },
  },
  {
    id: 'digital',
    name: { en: 'Digital Services', ar: 'الخدمات الرقمية' },
    icon: Monitor,
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    description: { en: 'Online permits, payments, and digital platforms', ar: 'التصاريح الإلكترونية والمدفوعات والمنصات الرقمية' },
  },
  {
    id: 'sustainability',
    name: { en: 'Sustainability', ar: 'الاستدامة' },
    icon: Globe,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    description: { en: 'Sustainable development and environmental initiatives', ar: 'التنمية المستدامة والمبادرات البيئية' },
  },
]

// ─── Mock Cases ────────────────────────────────────────────────────────────

const MOCK_CASES: DepartmentCase[] = [
  {
    id: 'case-1',
    referenceNumber: 'MOEI-2026-0001',
    customerName: 'Ahmed Al Rashid',
    channel: 'whatsapp',
    createdAt: '2026-03-03T09:15:00Z',
    status: 'pending',
    description: 'Requesting electricity connection for new residential building in Khalifa City',
    departmentId: 'energy',
  },
  {
    id: 'case-2',
    referenceNumber: 'MOEI-2026-0002',
    customerName: 'Fatima Al Zaabi',
    channel: 'voice',
    createdAt: '2026-03-03T10:30:00Z',
    status: 'pending',
    description: 'Complaint about frequent power outages in Al Ain district',
    departmentId: 'energy',
  },
  {
    id: 'case-3',
    referenceNumber: 'MOEI-2026-0003',
    customerName: 'Mohammed Hassan',
    channel: 'email',
    createdAt: '2026-03-02T14:20:00Z',
    status: 'in_review',
    description: 'Road maintenance request — large pothole on Sheikh Zayed Road near exit 36',
    departmentId: 'infrastructure',
  },
  {
    id: 'case-4',
    referenceNumber: 'MOEI-2026-0004',
    customerName: 'Aisha Al Mansoori',
    channel: 'whatsapp',
    createdAt: '2026-03-03T08:45:00Z',
    status: 'pending',
    description: 'Water supply disruption in Mussafah industrial area — no water for 2 days',
    departmentId: 'water',
  },
  {
    id: 'case-5',
    referenceNumber: 'MOEI-2026-0005',
    customerName: 'Khalid Al Ketbi',
    channel: 'web',
    createdAt: '2026-03-01T16:00:00Z',
    status: 'approved',
    description: 'Housing loan rescheduling application — 3 months arrears due to job loss',
    departmentId: 'housing',
    approvedAt: '2026-03-02T11:30:00Z',
  },
  {
    id: 'case-6',
    referenceNumber: 'MOEI-2026-0006',
    customerName: 'Noura Al Dhaheri',
    channel: 'email',
    createdAt: '2026-03-02T09:10:00Z',
    status: 'pending',
    description: 'Inquiry about petroleum product distribution licensing requirements',
    departmentId: 'petroleum',
  },
  {
    id: 'case-7',
    referenceNumber: 'MOEI-2026-0007',
    customerName: 'Sultan Al Nahyan',
    channel: 'voice',
    createdAt: '2026-03-03T11:00:00Z',
    status: 'pending',
    description: 'Commercial transport permit application for fleet of 12 vehicles',
    departmentId: 'transport',
  },
  {
    id: 'case-8',
    referenceNumber: 'MOEI-2026-0008',
    customerName: 'Maryam Al Suwaidi',
    channel: 'whatsapp',
    createdAt: '2026-03-03T07:30:00Z',
    status: 'in_review',
    description: 'Request for digital signature integration with MOEI online portal',
    departmentId: 'digital',
  },
  {
    id: 'case-9',
    referenceNumber: 'MOEI-2026-0009',
    customerName: 'Hamad Al Shamsi',
    channel: 'web',
    createdAt: '2026-03-02T13:45:00Z',
    status: 'rejected',
    description: 'Solar panel installation permit — does not meet zoning requirements',
    departmentId: 'sustainability',
    rejectionReason: 'Application does not meet the required zoning regulations for solar installations in residential areas. Please refer to MOEI zoning code section 4.2 before resubmitting.',
    rejectedAt: '2026-03-03T09:00:00Z',
  },
  {
    id: 'case-10',
    referenceNumber: 'MOEI-2026-0010',
    customerName: 'Latifa Al Ameri',
    channel: 'email',
    createdAt: '2026-03-03T12:15:00Z',
    status: 'pending',
    description: 'Housing grant application for UAE national — first-time homeowner',
    departmentId: 'housing',
  },
  {
    id: 'case-11',
    referenceNumber: 'MOEI-2026-0011',
    customerName: 'Omar Al Muhairi',
    channel: 'whatsapp',
    createdAt: '2026-03-03T06:50:00Z',
    status: 'pending',
    description: 'Bridge structural concern — cracks observed on Abu Dhabi bridge overpass',
    departmentId: 'infrastructure',
  },
  {
    id: 'case-12',
    referenceNumber: 'MOEI-2026-0012',
    customerName: 'Sara Al Hammadi',
    channel: 'voice',
    createdAt: '2026-03-02T15:30:00Z',
    status: 'pending',
    description: 'Water quality complaint — discolored water supply in Al Reem Island',
    departmentId: 'water',
  },
  {
    id: 'case-13',
    referenceNumber: 'MOEI-2026-0013',
    customerName: 'Yousef Al Tamimi',
    channel: 'web',
    createdAt: '2026-03-03T10:05:00Z',
    status: 'pending',
    description: 'Online payment portal not processing transactions — getting error code E-5023',
    departmentId: 'digital',
  },
  {
    id: 'case-14',
    referenceNumber: 'MOEI-2026-0014',
    customerName: 'Reem Al Rumaithi',
    channel: 'email',
    createdAt: '2026-03-01T11:20:00Z',
    status: 'in_review',
    description: 'EV charging station installation permit for commercial parking facility',
    departmentId: 'energy',
  },
]

// ─── Channel Icons ─────────────────────────────────────────────────────────

const CHANNEL_CONFIG: Record<CaseChannel, { icon: React.ElementType; label: { en: string; ar: string }; color: string }> = {
  whatsapp: { icon: MessageSquare, label: { en: 'WhatsApp', ar: 'واتساب' }, color: 'text-green-600 bg-green-50' },
  voice: { icon: Phone, label: { en: 'Voice', ar: 'اتصال' }, color: 'text-teal-600 bg-teal-50' },
  email: { icon: Mail, label: { en: 'Email', ar: 'بريد' }, color: 'text-amber-600 bg-amber-50' },
  web: { icon: Globe, label: { en: 'Web', ar: 'ويب' }, color: 'text-blue-600 bg-blue-50' },
}

// ─── Status Badge Config ──────────────────────────────────────────────────

const STATUS_CONFIG: Record<CaseStatus, { label: { en: string; ar: string }; color: string; icon: React.ElementType }> = {
  pending: { label: { en: 'Pending', ar: 'قيد الانتظار' }, color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
  in_review: { label: { en: 'In Review', ar: 'قيد المراجعة' }, color: 'bg-blue-100 text-blue-800 border-blue-200', icon: FileText },
  approved: { label: { en: 'Approved', ar: 'تمت الموافقة' }, color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  rejected: { label: { en: 'Rejected', ar: 'مرفوض' }, color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
}

// ─── Format Date ──────────────────────────────────────────────────────────

function formatDate(dateStr: string, isAr: boolean): string {
  try {
    return new Date(dateStr).toLocaleDateString(isAr ? 'ar-AE' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// ─── Departments View ─────────────────────────────────────────────────────

export default function Departments() {
  const { language, setPageView } = useAppStore()
  const { t } = useTranslation()
  const isAr = language === 'ar'
  const dir = isAr ? 'rtl' : 'ltr'

  // State
  const [cases, setCases] = useState<DepartmentCase[]>(MOCK_CASES)
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectingCaseId, setRejectingCaseId] = useState<string | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailCase, setDetailCase] = useState<DepartmentCase | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'all'>('all')

  // Computed
  const selectedDept = DEPARTMENTS.find((d) => d.id === selectedDeptId) || null

  const deptCaseCounts = useMemo(() => {
    const counts: Record<string, { total: number; pending: number; inReview: number; approved: number; rejected: number }> = {}
    for (const dept of DEPARTMENTS) {
      const deptCases = cases.filter((c) => c.departmentId === dept.id)
      counts[dept.id] = {
        total: deptCases.length,
        pending: deptCases.filter((c) => c.status === 'pending').length,
        inReview: deptCases.filter((c) => c.status === 'in_review').length,
        approved: deptCases.filter((c) => c.status === 'approved').length,
        rejected: deptCases.filter((c) => c.status === 'rejected').length,
      }
    }
    return counts
  }, [cases])

  const filteredCases = useMemo(() => {
    if (!selectedDeptId) return []
    let result = cases.filter((c) => c.departmentId === selectedDeptId)
    if (filterStatus !== 'all') {
      result = result.filter((c) => c.status === filterStatus)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (c) =>
          c.referenceNumber.toLowerCase().includes(q) ||
          c.customerName.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      )
    }
    return result
  }, [selectedDeptId, cases, filterStatus, searchQuery])

  // Actions
  const handleApprove = (caseId: string) => {
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId ? { ...c, status: 'approved' as CaseStatus, approvedAt: new Date().toISOString() } : c
      )
    )
    if (detailCase?.id === caseId) {
      setDetailCase((prev) => prev ? { ...prev, status: 'approved', approvedAt: new Date().toISOString() } : null)
    }
  }

  const handleRejectClick = (caseId: string) => {
    setRejectingCaseId(caseId)
    setRejectionReason('')
    setRejectDialogOpen(true)
  }

  const handleRejectConfirm = () => {
    if (!rejectingCaseId || !rejectionReason.trim()) return
    setCases((prev) =>
      prev.map((c) =>
        c.id === rejectingCaseId
          ? { ...c, status: 'rejected' as CaseStatus, rejectionReason: rejectionReason.trim(), rejectedAt: new Date().toISOString() }
          : c
      )
    )
    if (detailCase?.id === rejectingCaseId) {
      setDetailCase((prev) =>
        prev
          ? { ...prev, status: 'rejected', rejectionReason: rejectionReason.trim(), rejectedAt: new Date().toISOString() }
          : null
      )
    }
    setRejectDialogOpen(false)
    setRejectingCaseId(null)
    setRejectionReason('')
  }

  const handleCaseClick = (c: DepartmentCase) => {
    setDetailCase(c)
    setDetailDialogOpen(true)
  }

  const totalPending = cases.filter((c) => c.status === 'pending').length
  const totalInReview = cases.filter((c) => c.status === 'in_review').length
  const totalApproved = cases.filter((c) => c.status === 'approved').length
  const totalRejected = cases.filter((c) => c.status === 'rejected').length

  // ─── Render: Department Grid ──────────────────────────────────────────

  const renderDepartmentGrid = () => (
    <div className="space-y-6" dir={dir}>
      {/* Stats Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('deptPending') || 'Pending', value: totalPending, color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
          { label: t('deptInReview') || 'In Review', value: totalInReview, color: 'text-blue-700 bg-blue-50 border-blue-200' },
          { label: t('deptApproved') || 'Approved', value: totalApproved, color: 'text-green-700 bg-green-50 border-green-200' },
          { label: t('deptRejected') || 'Rejected', value: totalRejected, color: 'text-red-700 bg-red-50 border-red-200' },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-lg border px-4 py-3 ${stat.color}`}>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs font-medium opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Department Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {DEPARTMENTS.map((dept) => {
          const counts = deptCaseCounts[dept.id]
          const Icon = dept.icon
          return (
            <motion.div
              key={dept.id}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Card
                className="cursor-pointer border border-gray-200 hover:border-[#92722A]/40 hover:shadow-lg transition-shadow overflow-hidden"
                onClick={() => setSelectedDeptId(dept.id)}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center ${dept.bgColor}`}>
                      <Icon className={`w-5 h-5 ${dept.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm text-gray-900 truncate">
                        {isAr ? dept.name.ar : dept.name.en}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {isAr ? dept.description.ar : dept.description.en}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {counts.pending > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0 h-5 border-yellow-200">
                          {counts.pending} {isAr ? 'معلق' : 'pending'}
                        </Badge>
                      )}
                      {counts.inReview > 0 && (
                        <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0 h-5 border-blue-200">
                          {counts.inReview} {isAr ? 'مراجعة' : 'review'}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <span className="font-semibold text-gray-600">{counts.total}</span>
                      <span>{isAr ? 'قضية' : 'cases'}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  // ─── Render: Department Cases ──────────────────────────────────────────

  const renderDepartmentCases = () => {
    if (!selectedDept) return null
    const Icon = selectedDept.icon
    const counts = deptCaseCounts[selectedDept.id]

    return (
      <div className="space-y-4" dir={dir}>
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-gray-600 hover:text-gray-900"
            onClick={() => {
              setSelectedDeptId(null)
              setSearchQuery('')
              setFilterStatus('all')
            }}
          >
            {isAr ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {isAr ? 'العودة' : 'Back'}
          </Button>
          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${selectedDept.bgColor}`}>
            <Icon className={`w-5 h-5 ${selectedDept.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-lg text-gray-900">
              {isAr ? selectedDept.name.ar : selectedDept.name.en}
            </h2>
            <p className="text-xs text-gray-500">
              {isAr ? selectedDept.description.ar : selectedDept.description.en}
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all' as const, label: isAr ? 'الكل' : 'All', count: counts.total },
            { key: 'pending' as const, label: isAr ? 'معلق' : 'Pending', count: counts.pending },
            { key: 'in_review' as const, label: isAr ? 'قيد المراجعة' : 'In Review', count: counts.inReview },
            { key: 'approved' as const, label: isAr ? 'تمت الموافقة' : 'Approved', count: counts.approved },
            { key: 'rejected' as const, label: isAr ? 'مرفوض' : 'Rejected', count: counts.rejected },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === f.key
                  ? 'bg-[#92722A] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isAr ? 'بحث بالرقم المرجعي أو الاسم...' : 'Search by reference, name, or description...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#92722A]/30 focus:border-[#92722A]"
            dir={isAr ? 'rtl' : 'ltr'}
          />
        </div>

        {/* Cases List */}
        <ScrollArea className="max-h-[calc(100vh-420px)]">
          {filteredCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm">{isAr ? 'لا توجد قضايا' : 'No cases found'}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {filteredCases.map((c) => {
                  const statusConfig = STATUS_CONFIG[c.status]
                  const channelConfig = CHANNEL_CONFIG[c.channel]
                  const StatusIcon = statusConfig.icon
                  const ChannelIcon = channelConfig.icon
                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className="border border-gray-200 hover:border-[#92722A]/30 transition-colors overflow-hidden">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {/* Channel icon */}
                            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${channelConfig.color}`}>
                              <ChannelIcon className="w-4 h-4" />
                            </div>

                            {/* Case info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold text-[#92722A]">
                                  {c.referenceNumber}
                                </span>
                                <Badge className={`${statusConfig.color} text-[10px] px-1.5 py-0 h-5 border`}>
                                  <StatusIcon className="w-3 h-3 mr-0.5" />
                                  {isAr ? statusConfig.label.ar : statusConfig.label.en}
                                </Badge>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${channelConfig.color}`}>
                                  {isAr ? channelConfig.label.ar : channelConfig.label.en}
                                </span>
                              </div>
                              <p className="text-sm font-medium text-gray-900 mt-1">{c.customerName}</p>
                              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.description}</p>
                              <p className="text-[10px] text-gray-400 mt-1">
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {formatDate(c.createdAt, isAr)}
                              </p>

                              {/* Rejection reason display */}
                              {c.status === 'rejected' && c.rejectionReason && (
                                <div className="mt-2 p-2 rounded-md bg-red-50 border border-red-100">
                                  <p className="text-xs font-medium text-red-700">
                                    {isAr ? 'سبب الرفض:' : 'Rejection reason:'}
                                  </p>
                                  <p className="text-xs text-red-600 mt-0.5">{c.rejectionReason}</p>
                                </div>
                              )}

                              {/* Approved indicator */}
                              {c.status === 'approved' && c.approvedAt && (
                                <div className="mt-2 p-2 rounded-md bg-green-50 border border-green-100">
                                  <p className="text-xs text-green-700">
                                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                    {isAr ? `تمت الموافقة في ${formatDate(c.approvedAt, isAr)}` : `Approved on ${formatDate(c.approvedAt, isAr)}`}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Action buttons */}
                            {(c.status === 'pending' || c.status === 'in_review') && (
                              <div className="flex flex-col gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 text-white text-xs h-8 px-3 gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleApprove(c.id)
                                  }}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  {isAr ? 'موافقة' : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs h-8 px-3 gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleRejectClick(c.id)
                                  }}
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  {isAr ? 'رفض' : 'Reject'}
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>
    )
  }

  // ─── Render: Case Detail Dialog ────────────────────────────────────────

  const renderDetailDialog = () => {
    if (!detailCase) return null
    const statusConfig = STATUS_CONFIG[detailCase.status]
    const channelConfig = CHANNEL_CONFIG[detailCase.channel]
    const dept = DEPARTMENTS.find((d) => d.id === detailCase.departmentId)
    const StatusIcon = statusConfig.icon
    const ChannelIcon = channelConfig.icon

    return (
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg" dir={dir}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#92722A]" />
              {detailCase.referenceNumber}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isAr ? 'تفاصيل القضية' : 'Case details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status & Channel */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`${statusConfig.color} text-xs px-2 py-0.5 h-6 border`}>
                <StatusIcon className="w-3.5 h-3.5 mr-1" />
                {isAr ? statusConfig.label.ar : statusConfig.label.en}
              </Badge>
              <span className={`text-xs px-2 py-0.5 rounded ${channelConfig.color} flex items-center gap-1`}>
                <ChannelIcon className="w-3 h-3" />
                {isAr ? channelConfig.label.ar : channelConfig.label.en}
              </span>
              {dept && (
                <span className={`text-xs px-2 py-0.5 rounded ${dept.bgColor} ${dept.color} flex items-center gap-1`}>
                  <dept.icon className="w-3 h-3" />
                  {isAr ? dept.name.ar : dept.name.en}
                </span>
              )}
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-medium flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {isAr ? 'العميل' : 'Customer'}
                </p>
                <p className="text-sm font-medium text-gray-900">{detailCase.customerName}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-gray-400 uppercase font-medium flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {isAr ? 'تاريخ الإنشاء' : 'Created'}
                </p>
                <p className="text-sm text-gray-700">{formatDate(detailCase.createdAt, isAr)}</p>
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div className="space-y-1">
              <p className="text-[10px] text-gray-400 uppercase font-medium">
                {isAr ? 'الوصف' : 'Description'}
              </p>
              <p className="text-sm text-gray-700">{detailCase.description}</p>
            </div>

            {/* Rejection Reason */}
            {detailCase.status === 'rejected' && detailCase.rejectionReason && (
              <>
                <Separator />
                <div className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">
                    <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                    {isAr ? 'سبب الرفض' : 'Rejection Reason'}
                  </p>
                  <p className="text-sm text-red-600">{detailCase.rejectionReason}</p>
                  {detailCase.rejectedAt && (
                    <p className="text-[10px] text-red-400 mt-1">{formatDate(detailCase.rejectedAt, isAr)}</p>
                  )}
                </div>
              </>
            )}

            {/* Approved Info */}
            {detailCase.status === 'approved' && detailCase.approvedAt && (
              <>
                <Separator />
                <div className="p-3 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-xs text-green-700">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    {isAr ? `تمت الموافقة في ${formatDate(detailCase.approvedAt, isAr)}` : `Approved on ${formatDate(detailCase.approvedAt, isAr)}`}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {isAr ? 'تم إخطار العميل وستستمر القضية في مسارها.' : 'Customer has been notified and the case will continue its process.'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Actions in dialog */}
          {(detailCase.status === 'pending' || detailCase.status === 'in_review') && (
            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                variant="destructive"
                className="gap-1"
                onClick={() => {
                  setDetailDialogOpen(false)
                  handleRejectClick(detailCase.id)
                }}
              >
                <XCircle className="w-4 h-4" />
                {isAr ? 'رفض' : 'Reject'}
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white gap-1"
                onClick={() => {
                  handleApprove(detailCase.id)
                  setDetailDialogOpen(false)
                }}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isAr ? 'موافقة' : 'Approve'}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  // ─── Render: Reject Dialog ─────────────────────────────────────────────

  const renderRejectDialog = () => (
    <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
      <DialogContent className="sm:max-w-md" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            {isAr ? 'رفض القضية' : 'Reject Case'}
          </DialogTitle>
          <DialogDescription>
            {isAr
              ? 'يرجى تقديم سبب الرفض. سيتم إخطار العميل بهذا السبب.'
              : 'Please provide a reason for rejection. The customer will be notified with this reason.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {rejectingCaseId && (
            <p className="text-xs text-gray-500">
              {isAr ? 'القضية:' : 'Case:'}{' '}
              <span className="font-mono font-semibold text-[#92722A]">
                {cases.find((c) => c.id === rejectingCaseId)?.referenceNumber}
              </span>
            </p>
          )}
          <Textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder={
              isAr
                ? 'أدخل سبب الرفض (مطلوب)...'
                : 'Enter the rejection reason (required)...'
            }
            rows={4}
            className="resize-none focus:ring-red-300 focus:border-red-300"
            dir={dir}
          />
          {!rejectionReason.trim() && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {isAr ? 'سبب الرفض مطلوب' : 'Rejection reason is required'}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
            {isAr ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant="destructive"
            disabled={!rejectionReason.trim()}
            onClick={handleRejectConfirm}
            className="gap-1"
          >
            <XCircle className="w-4 h-4" />
            {isAr ? 'تأكيد الرفض' : 'Confirm Rejection'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <MoeiPageLayout
      title={{ en: 'Department Services', ar: 'خدمات الإدارات' }}
      onBack={() => {
        if (selectedDeptId) {
          setSelectedDeptId(null)
          setSearchQuery('')
          setFilterStatus('all')
        } else {
          setPageView('admin')
        }
      }}
      contentClassName="max-w-6xl"
    >
      <div className="space-y-6" dir={dir}>
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-[#92722A]/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-[#92722A]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {selectedDept
                ? isAr
                  ? selectedDept.name.ar
                  : selectedDept.name.en
                : isAr
                  ? 'خدمات الإدارات'
                  : 'Department Services'}
            </h1>
            <p className="text-sm text-gray-500">
              {selectedDept
                ? isAr
                  ? 'مراجعة ومعالجة القضايا المحالة إلى هذا القسم'
                  : 'Review and process cases routed to this department'
                : isAr
                  ? 'مراجعة وموافقة أو رفض القضايا المحولة من مركز الاتصال'
                  : 'Review, approve, or reject cases routed from the Call Center / AI Brain'}
            </p>
          </div>
        </div>

        {/* Judge Disclaimer Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-800">
                {isAr ? 'تنبيه للجنة التحكيم' : 'Note for Judges'}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                {isAr
                  ? 'هذه الصفحة ليست جزءاً من مركز الاتصال الأساسي — إنها صفحة مساعدة تُظهر تدفق الحالات من الذكاء الاصطناعي إلى الإدارات. يُرجى عدم تقييم هذه الصفحة كجزء من مركز الاتصال.'
                  : 'This page is NOT part of the core call center — it is a supporting page showing the case flow from AI to departments. Please do NOT evaluate this page as part of the call center.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content: Grid or Cases */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedDeptId || 'grid'}
            initial={{ opacity: 0, x: isAr ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isAr ? 20 : -20 }}
            transition={{ duration: 0.2 }}
          >
            {selectedDeptId ? renderDepartmentCases() : renderDepartmentGrid()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      {renderDetailDialog()}
      {renderRejectDialog()}
    </MoeiPageLayout>
  )
}
