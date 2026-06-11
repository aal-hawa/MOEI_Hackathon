
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  CheckCircle2,
  FileText,
  FileCheck2,
} from 'lucide-react'

import { useAppStore } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { NewRequestForm } from '@/components/forms/new-request-form'
import { MOCK_HOUSING_ASSISTANCE_FILES } from '@/lib/uaepass-mock'
import { MoeiPageLayout } from '@/components/moei'
import { MOEI_GOLD } from '@/lib/constants'

export default function NewRequestPage() {
  const navigate = useNavigate()
  const { language } = useAppStore()
  const { isAuthenticated, userRole, userProfile, logout } = useAuthStore()
  const isAr = language === 'ar'

  const hasPreviousOrders = isAuthenticated && userRole === 'citizen' && userProfile?.idn && (MOCK_HOUSING_ASSISTANCE_FILES[userProfile.idn]?.length > 0)

  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSuccess = () => {
    setIsSubmitted(true)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const uaePassUser = isAuthenticated && userProfile
    ? { name: isAr && userProfile.fullnameAR ? userProfile.fullnameAR : userProfile.fullnameEN }
    : null

  const headerActions = hasPreviousOrders ? (
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigate('/my-requests')}
      className="flex border-[#C9A84C]/45 text-[#006B5A] hover:bg-[#FBF4DE] gap-1.5 h-8 mr-2 bg-white/70 font-bold"
    >
      <FileCheck2 className="w-3.5 h-3.5" />
      <span>{isAr ? 'تتبع حالة الطلب' : 'Track Order Status'}</span>
    </Button>
  ) : undefined

  return (
    <MoeiPageLayout
      title={{ en: 'New Request', ar: 'طلب جديد' }}
      onBack={() => navigate('/')}
      showUaePass={true}
      uaePassUser={uaePassUser}
      onLogout={isAuthenticated ? handleLogout : undefined}
      headerActions={headerActions}
    >
      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-7"
      >
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full border border-[#D9C176] bg-white/75 text-[#8F6B22] text-xs font-bold shadow-sm mb-3">
          {isAr ? 'خدمة حكومية رقمية فورية' : 'Executive Digital Government Service'}
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[#174236]">
          {t('moei.newRequest', language)}
        </h2>
        <div className="mt-3 mx-auto w-24 h-1 rounded-full shadow-[0_0_18px_rgba(201,168,76,0.45)]" style={{ backgroundColor: MOEI_GOLD }} />
      </motion.div>

      {/* Form or Success Screen */}
      {isSubmitted ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-8"
        >
          <Card className="w-full max-w-md shadow-lg border-green-100">
            <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {isAr ? 'تم إرسال طلبك بنجاح' : 'Request Submitted Successfully'}
              </h3>
              <p className="text-gray-500 mb-8 leading-relaxed">
                {isAr 
                  ? 'لقد تم استلام طلبك وهو الآن قيد المراجعة. سيتم إعلامك بأي تحديثات عبر القنوات الرسمية.'
                  : 'Your request has been received and is currently under review. You will be notified of any updates through official channels.'}
              </p>
              <div className="flex flex-col w-full gap-3">
                <Button onClick={() => navigate('/')} className="w-full text-white hover:bg-[#9A7429]" style={{ backgroundColor: MOEI_GOLD }}>
                  <Home className="w-4 h-4 me-2" />
                  {isAr ? 'العودة للرئيسية' : 'Return to Home'}
                </Button>
                <Button onClick={() => navigate('/my-requests')} variant="outline" className="w-full border-gray-300">
                  <FileText className="w-4 h-4 me-2" />
                  {isAr ? 'متابعة طلباتي' : 'Track My Requests'}
                </Button>
                <Button variant="outline" onClick={() => { setIsSubmitted(false); window.location.reload() }} className="w-full">
                  {isAr ? 'طلب جديد' : 'New Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <NewRequestForm onSuccess={handleSuccess} />
      )}
    </MoeiPageLayout>
  )
}
