
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  CreditCard,
  FileSearch,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MoeiPageLayout } from '@/components/moei'
import { MOEI_GOLD } from '@/lib/constants'
import { getStatusConfig } from '@/lib/status-config'

interface RequestData {
  id: string
  status: string
  createdAt: string
  reasonCategory: string
  reason: string
  requestedDurationMonths: number
  applicant?: {
    nameAr?: string
    nameEn?: string
    monthlyIncome?: number
    employerType?: string
    familySize?: number
    emiratesId?: string
  }
  loan?: {
    originalAmount: number
    remainingBalance: number
    monthlyInstallment?: number
    loanType?: string
  }
  arrear?: {
    missedMonths: number
    totalOverdue: number
    delayDays: number
  }
}

export default function MyRequestsPage() {
  const navigate = useNavigate()
  const { language } = useAppStore()
  const { isAuthenticated, userProfile, logout } = useAuthStore()
  const isAr = language === 'ar'

  const [requests, setRequests] = useState<RequestData[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/')
      return
    }

    const fetchRequests = async () => {
      try {
        const res = await authFetch('/api/requests')
        if (res.ok) {
          const data = await res.json()
          // Server returns a flat array, but handle both formats for robustness
          const requestsList = Array.isArray(data) ? data : (data.requests || data.data || [])
          setRequests(requestsList)
        }
      } catch (err) {
        console.error('Failed to fetch requests', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()
  }, [isAuthenticated, navigate])

  const getStatusInfo = (status: string) => {
    const cfg = getStatusConfig(status)
    const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
      Clock, CheckCircle2, XCircle, AlertTriangle, FileSearch,
    }
    const Icon = iconMap[cfg.icon ?? 'FileSearch'] ?? FileSearch
    return {
      icon: Icon,
      color: cfg.textColor,
      bg: cfg.color,
      border: cfg.borderColor,
      label: isAr ? cfg.label.ar : cfg.label.en,
    }
  }

  const uaePassUser = isAuthenticated && userProfile
    ? { name: isAr && userProfile.fullnameAR ? userProfile.fullnameAR : userProfile.fullnameEN }
    : null

  return (
    <MoeiPageLayout
      title={{ en: 'My Requests', ar: 'طلباتي' }}
      onBack={() => navigate('/')}
      showUaePass={true}
      uaePassUser={uaePassUser}
      onLogout={isAuthenticated ? handleLogout : undefined}
      contentClassName="max-w-5xl"
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 flex items-center gap-3">
          <FileText className="w-8 h-8" style={{ color: MOEI_GOLD }} />
          {isAr ? 'طلباتي' : 'My Requests'}
        </h2>
        <p className="text-gray-500 mt-2">
          {isAr ? 'تتبع حالة طلباتك لإعادة جدولة المستحقات السكنية.' : 'Track the status of your housing arrears rescheduling requests.'}
        </p>
        <div className="mt-4 w-20 h-1 rounded-full" style={{ backgroundColor: MOEI_GOLD }} />
      </motion.div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin" style={{ color: MOEI_GOLD }} />
          <p className="mt-4 text-gray-500">{isAr ? 'جاري تحميل الطلبات...' : 'Loading requests...'}</p>
        </div>
      ) : requests.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-dashed border-2 bg-transparent shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <FileSearch className="w-16 h-16 text-gray-300 mb-4" />
              <h3 className="text-xl font-bold text-gray-800 mb-2">{isAr ? 'لا توجد طلبات' : 'No Requests Found'}</h3>
              <p className="text-gray-500 mb-6">{isAr ? 'لم تقم بتقديم أي طلبات حتى الآن.' : 'You haven\'t submitted any requests yet.'}</p>
              <Button onClick={() => navigate('/new-request')} style={{ backgroundColor: MOEI_GOLD }} className="text-white">
                {isAr ? 'تقديم طلب جديد' : 'Submit New Request'}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid gap-4">
          {requests.map((req, index) => {
            const statusInfo = getStatusInfo(req.status)
            const StatusIcon = statusInfo.icon

            return (
              <motion.div
                key={req.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="overflow-hidden hover:shadow-md transition-shadow border-gray-200">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row">
                      {/* Status Sidebar */}
                      <div className={cn("p-4 sm:w-48 flex sm:flex-col items-center sm:items-start justify-between sm:justify-center gap-2 border-b sm:border-b-0 sm:border-e", isAr ? "sm:border-l" : "sm:border-r", statusInfo.bg, statusInfo.border)}>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={cn("w-5 h-5", statusInfo.color)} />
                          <span className={cn("font-bold", statusInfo.color)}>{statusInfo.label}</span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          {new Date(req.createdAt).toLocaleString(isAr ? 'ar-AE' : 'en-AE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      
                      {/* Details */}
                      <div className="p-5 flex-1 space-y-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">{isAr ? 'رقم الطلب' : 'Request Number'}</p>
                            <h4 className="font-mono font-bold text-gray-900">{req.id.substring(0, 8).toUpperCase()}...</h4>
                            {req.applicant && (
                              <p className="text-sm text-gray-600 mt-1">
                                {isAr && req.applicant.nameAr ? req.applicant.nameAr : req.applicant.nameEn || ''}
                              </p>
                            )}
                          </div>
                          <div className="text-end">
                            <p className="text-xs text-gray-500 mb-1">{isAr ? 'نوع الطلب' : 'Request Type'}</p>
                            <Badge variant="outline" className="text-gray-700 bg-gray-50">
                              {req.reasonCategory === 'reschedule_arrears' ? (isAr ? 'إعادة جدولة المتأخرات' : 'Reschedule Arrears') : 
                               req.reasonCategory === 'postpone_instalment' ? (isAr ? 'تأجيل القسط' : 'Postpone Instalment') : 
                               req.reasonCategory === 'reduce_instalment' ? (isAr ? 'تخفيض القسط' : 'Reduce Instalment') :
                               (isAr ? 'أخرى' : 'Other')}
                            </Badge>
                          </div>
                        </div>

                        {(req.loan || req.arrear) && (
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                            {req.loan && (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                                    <CreditCard className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-500">{isAr ? 'المبلغ الأصلي' : 'Original Amount'}</p>
                                    <p className="text-sm font-semibold text-gray-900">{new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(req.loan.originalAmount)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-500">{isAr ? 'الرصيد المتبقي' : 'Remaining Balance'}</p>
                                    <p className="text-sm font-semibold text-gray-900">{new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(req.loan.remainingBalance)}</p>
                                  </div>
                                </div>
                              </>
                            )}
                            {req.arrear && req.arrear.totalOverdue > 0 && (
                              <div className="flex items-center gap-2 col-span-2">
                                <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                                  <AlertTriangle className="w-4 h-4 text-red-600" />
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-500">{isAr ? 'إجمالي المتأخرات' : 'Total Overdue'}</p>
                                  <p className="text-sm font-semibold text-red-600">{new Intl.NumberFormat(isAr ? 'ar-AE' : 'en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 0 }).format(req.arrear.totalOverdue)}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}
    </MoeiPageLayout>
  )
}
