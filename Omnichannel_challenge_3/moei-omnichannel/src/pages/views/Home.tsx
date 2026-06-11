'use client'

import { motion } from 'framer-motion'
import { Shield, Users, ArrowRight, BarChart3, Phone, Building2, Sparkles, Globe2, Headphones, Info, BookOpen, MessageSquare, Headset, Cpu, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import PageShell from '@/components/layout/page-shell'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'

export default function LandingPage() {
  const setPageView = useAppStore((s) => s.setPageView)
  const { t, isRTL, language } = useTranslation()

  const portals = [
    {
      id: 'customer',
      title: language === 'ar' ? 'بوابة العميل' : 'Customer Portal',
      description: language === 'ar' 
        ? 'الوصول إلى الخدمات وتقديم الطلبات والتحدث مع وكلاء الذكاء الاصطناعي'
        : 'Access services, submit requests, chat with AI agents.',
      icon: Users,
      color: 'primary',
      hoverBg: 'bg-primary',
      lightBg: 'bg-primary/8',
      border: 'border-primary/15',
      iconColor: 'text-primary',
      accentBar: 'bg-primary',
    },
    {
      id: 'admin',
      title: language === 'ar' ? 'لوحة تحكم الموظفين' : 'Admin Dashboard',
      description: language === 'ar'
        ? 'إدارة الحالات والواتساب والمكالمات وإعدادات الذكاء الاصطناعي'
        : 'Manage cases, WhatsApp, calls, and AI configuration.',
      icon: Shield,
      color: 'gold',
      hoverBg: 'bg-ae-gold-500',
      lightBg: 'bg-ae-gold-50',
      border: 'border-ae-gold-200',
      iconColor: 'text-ae-gold-600',
      accentBar: 'bg-ae-gold-500',
    },
    {
      id: 'executive',
      title: language === 'ar' ? 'التحليلات التنفيذية' : 'Executive Analytics',
      description: language === 'ar'
        ? 'لوحات مؤشرات الأداء الرئيسية والتحليلات التنبؤية والرؤى'
        : 'KPI dashboards, predictive analytics, and insights.',
      icon: BarChart3,
      color: 'green',
      hoverBg: 'bg-ae-green-500',
      lightBg: 'bg-ae-green-50',
      border: 'border-ae-green-200',
      iconColor: 'text-ae-green-600',
      accentBar: 'bg-ae-green-500',
    },
    {
      id: 'voice-call',
      title: language === 'ar' ? 'مركز المكالمات الصوتية' : 'Voice Call Center',
      description: language === 'ar'
        ? 'وكيل صوتي بالذكاء الاصطناعي مع تقنية التعرف على الكلام وتوليد الصوت'
        : 'AI voice agent with real-time STT/TTS pipeline.',
      icon: Phone,
      color: 'emerald',
      hoverBg: 'bg-emerald-600',
      lightBg: 'bg-emerald-50',
      border: 'border-emerald-200',
      iconColor: 'text-emerald-600',
      accentBar: 'bg-emerald-500',
    },
  ]

  const features = [
    {
      icon: Sparkles,
      title: language === 'ar' ? 'ذكاء اصطناعي موحد' : 'Unified AI Brain',
      description: language === 'ar' 
        ? 'محرك ذكاء اصطناعي واحد يخدم جميع القنوات'
        : 'Single AI engine serving all channels with context preservation',
    },
    {
      icon: Globe2,
      title: language === 'ar' ? 'دعم متعدد اللغات' : 'Multilingual Support',
      description: language === 'ar'
        ? 'دعم كامل للعربية والإنجليزية في جميع الخدمات'
        : 'Full Arabic & English support across all services',
    },
    {
      icon: Headphones,
      title: language === 'ar' ? 'قنوات متعددة' : 'Omnichannel',
      description: language === 'ar'
        ? 'واتساب وصوت وويب وبريد إلكتروني في منصة واحدة'
        : 'WhatsApp, Voice, Web & Email in one platform',
    },
    {
      icon: Building2,
      title: language === 'ar' ? 'حكومي آمن' : 'Government Secure',
      description: language === 'ar'
        ? 'متكامل مع UAE PASS لضمان الأمان والخصوصية'
        : 'UAE PASS integrated for security and privacy compliance',
    },
  ]

  // How-to guide steps for judges
  const guideSteps = [
    {
      step: '1',
      icon: MessageSquare,
      title: language === 'ar' ? 'ابدأ محادثة' : 'Start a Conversation',
      description: language === 'ar'
        ? 'اذهب إلى بوابة العميل وابدأ محادثة عبر الواتساب أو الدردشة المباشرة. سيرد عليك وكيل الذكاء الاصطناعي تلقائياً.'
        : 'Go to Customer Portal and start a conversation via WhatsApp or Live Chat. The AI agent will respond automatically.',
    },
    {
      step: '2',
      icon: Headset,
      title: language === 'ar' ? 'اختبر مركز الاتصال' : 'Test the Call Center',
      description: language === 'ar'
        ? 'من لوحة تحكم الموظف، شاهد المحادثات الواردة في الوقت الفعلي. يمكنك التدخل أو التصعيد أو نقل المحادثات.'
        : 'From the Agent Dashboard, view incoming conversations in real-time. You can intervene, escalate, or transfer chats.',
    },
    {
      step: '3',
      icon: Cpu,
      title: language === 'ar' ? 'استكشف نماذج الذكاء الاصطناعي' : 'Explore AI Models',
      description: language === 'ar'
        ? 'في قسم "نماذج الذكاء الاصطناعي"، يمكنك اختيار مزود الذكاء الاصطناعي وتعديل المعلمات مثل درجة الحرية والحد الأقصى للرموز.'
        : 'In "AI Models" section, you can choose the AI provider and adjust parameters like temperature and max tokens.',
    },
    {
      step: '4',
      icon: BarChart3,
      title: language === 'ar' ? 'راجع التحليلات التنفيذية' : 'Review Executive Analytics',
      description: language === 'ar'
        ? 'تحقق من لوحة القيادة التنفيذية لمؤشرات الأداء الرئيسية والتحليلات التنبؤية ورؤى الذكاء الاصطناعي.'
        : 'Check the Executive Dashboard for KPIs, predictive analytics, and AI-driven insights.',
    },
    {
      step: '5',
      icon: Phone,
      title: language === 'ar' ? 'جرّب المكالمة الصوتية' : 'Try Voice Call',
      description: language === 'ar'
        ? 'انتقل إلى مركز المكالمات الصوتية لاختبار وكيل الذكاء الاصطناعي الصوتي مع تحويل الكلام إلى نص ونص إلى كلام.'
        : 'Navigate to Voice Call Center to test the AI voice agent with real-time STT/TTS.',
    },
    {
      step: '6',
      icon: Building2,
      title: language === 'ar' ? 'خدمات الإدارات' : 'Department Services',
      description: language === 'ar'
        ? 'راجع حالات الإدارات حيث يمكن للإدارات الموافقة أو رفض الحالات المحالة من مركز الاتصال.'
        : 'Review department cases where departments can approve or reject cases referred from the call center.',
    },
  ]

  return (
    <PageShell activeRoute="home">
      <div className="flex-1 flex flex-col bg-white">
        {/* ── Judge Notice Banner ── */}
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <Info className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-800">
                  {language === 'ar' ? 'تنبيه للجنة التحكيم' : 'Notice for Judges'}
                </p>
                <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                  {language === 'ar'
                    ? 'الصفحة الرئيسية و"خدمات الإدارات" ليست جزءاً من مركز الاتصال الأساسي — إنها صفحات مساعدة فقط. يُرجى تقييم مركز الاتصال من خلال: بوابة العميل (للمحادثات) ولوحة تحكم الموظفين (لإدارة المكالمات) ومركز المكالمات الصوتية.'
                    : 'The Home page and "Department Services" are NOT part of the core call center — they are supporting pages only. Please evaluate the call center through: Customer Portal (for conversations), Agent Dashboard (for call management), and Voice Call Center.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-ae-green-50/40 via-white to-white">
          {/* Subtle decorative elements */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary/3 blur-[150px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-ae-gold-500/3 blur-[120px] pointer-events-none" />
          
          {/* Subtle geometric pattern */}
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
            backgroundImage: `radial-gradient(circle, #006352 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }} />

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              transition={{ duration: 0.7 }}
              className="text-center mb-12 sm:mb-16"
            >
              {/* Government badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/8 border border-primary/15 text-primary text-xs font-semibold mb-6"
              >
                <Shield className="w-3.5 h-3.5" />
                {language === 'ar' ? 'حكومة الإمارات العربية المتحدة' : 'UAE Government Platform'}
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-ae-black-800 mb-5">
                {language === 'ar' ? (
                  <>
                    بوابة{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-ae-green-500">
                      MOEI
                    </span>{' '}
                    متعددة القنوات
                  </>
                ) : (
                  <>
                    MOEI{' '}
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-ae-green-500">
                      Omnichannel
                    </span>{' '}
                    Gateway
                  </>
                )}
              </h1>
              <p className="text-base sm:text-lg text-ae-black-400 max-w-2xl mx-auto leading-relaxed">
                {language === 'ar'
                  ? 'المنصة الذكية الموحدة للتواصل مع العملاء — الحفاظ على السياق عبر جميع القنوات'
                  : 'Unified AI Digital Brain — Cross-channel context preservation across WhatsApp, Voice, Web & Email.'}
              </p>
            </motion.div>

            {/* Portal Cards Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {portals.map((portal, index) => {
                const Icon = portal.icon
                return (
                  <motion.div
                    key={portal.id}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
                  >
                    <Card 
                      className="bg-white border border-ae-black-100 shadow-sm hover:shadow-lg relative overflow-hidden transition-all duration-300 group cursor-pointer h-full rounded-xl"
                      onClick={() => setPageView(portal.id)}
                    >
                      {/* Top accent bar */}
                      <div className={`h-1 ${portal.accentBar} group-hover:h-1.5 transition-all duration-300`} />
                      <CardContent className="p-5 sm:p-6 flex flex-col items-center text-center h-full">
                        <div className={`w-12 h-12 rounded-xl ${portal.lightBg} ${portal.border} border ${portal.iconColor} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:${portal.hoverBg} group-hover:text-white group-hover:border-transparent transition-all duration-400`}>
                          <Icon className="w-6 h-6" />
                        </div>
                        <h2 className="text-base font-bold mb-2 text-ae-black-700">{portal.title}</h2>
                        <p className="text-ae-black-300 mb-4 flex-grow text-sm leading-relaxed">
                          {portal.description}
                        </p>
                        <div className={`flex items-center ${portal.iconColor} font-semibold text-sm group-hover:translate-x-1 transition-transform duration-300`}>
                          {language === 'ar' ? 'دخول' : 'Enter'} <ArrowRight className="w-4 h-4 ms-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── How-To Guide for Judges ── */}
        <section className="bg-gradient-to-b from-teal-50/60 to-white border-y border-teal-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-semibold mb-4">
                <BookOpen className="w-3.5 h-3.5" />
                {language === 'ar' ? 'دليل الاستخدام' : 'How-To Guide'}
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ae-black-800 mb-3">
                {language === 'ar' ? 'كيفية تقييم المشروع' : 'How to Evaluate This Project'}
              </h2>
              <p className="text-ae-black-400 text-sm sm:text-base max-w-2xl mx-auto">
                {language === 'ar'
                  ? 'اتبع هذه الخطوات لاستكشاف جميع إمكانيات مركز الاتصال الذكي'
                  : 'Follow these steps to explore all the capabilities of the AI-powered call center'}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {guideSteps.map((step, index) => {
                const StepIcon = step.icon
                return (
                  <motion.div
                    key={step.step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + index * 0.08 }}
                    className="group"
                  >
                    <div className="bg-white rounded-xl border border-ae-black-100 p-5 hover:shadow-md hover:border-teal-200 transition-all duration-300 h-full">
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-teal-50 border border-teal-100">
                          <StepIcon className="w-5 h-5 text-teal-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                              {language === 'ar' ? 'خطوة' : 'STEP'} {step.step}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-ae-black-700 mb-1">{step.title}</h3>
                          <p className="text-xs text-ae-black-400 leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Quick Start CTA */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="mt-8 text-center"
            >
              <Button
                onClick={() => setPageView('customer')}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-6 h-11 font-semibold gap-2 shadow-sm"
              >
                {language === 'ar' ? 'ابدأ التجربة الآن' : 'Start Exploring Now'}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-ae-black-50/50 border-y border-ae-black-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl sm:text-3xl font-bold text-ae-black-800 mb-3">
                {language === 'ar' ? 'لماذا MOEI الذكية؟' : 'Why MOEI AI?'}
              </h2>
              <p className="text-ae-black-400 text-sm sm:text-base max-w-xl mx-auto">
                {language === 'ar'
                  ? 'منصة متطورة تعمل بالذكاء الاصطناعي لخدمة المواطنين والمقيمين'
                  : 'An AI-powered platform designed to serve citizens and residents efficiently'}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => {
                const FeatureIcon = feature.icon
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 + index * 0.1 }}
                    className="text-center"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-ae-black-100 shadow-sm flex items-center justify-center mx-auto mb-3">
                      <FeatureIcon className="w-5 h-5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-ae-black-700 mb-1">{feature.title}</h3>
                    <p className="text-xs text-ae-black-400 leading-relaxed">{feature.description}</p>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Key Call Center Features for Judges */}
        <section className="bg-white py-12 sm:py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 }}
              className="text-center mb-8"
            >
              <h2 className="text-xl sm:text-2xl font-bold text-ae-black-800 mb-2">
                {language === 'ar' ? 'ميزات مركز الاتصال الأساسية' : 'Core Call Center Features'}
              </h2>
              <p className="text-ae-black-400 text-sm">
                {language === 'ar'
                  ? 'الميزات التي يجب تقييمها في مركز الاتصال'
                  : 'Features to evaluate in the call center'}
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 gap-3">
              {[
                { text: language === 'ar' ? 'وكيل ذكاء اصطناعي متعدد اللغات (عربي/إنجليزي)' : 'Multilingual AI Agent (Arabic/English)', icon: '🌐' },
                { text: language === 'ar' ? 'محادثات واتساب مع ردود ذكية' : 'WhatsApp conversations with AI replies', icon: '💬' },
                { text: language === 'ar' ? 'مكالمات صوتية مع تحويل الكلام لنص' : 'Voice calls with real-time STT/TTS', icon: '📞' },
                { text: language === 'ar' ? 'تصعيد وتحويل المحادثات لموظفين بشريين' : 'Escalation & transfer to human agents', icon: '🔄' },
                { text: language === 'ar' ? 'إنشاء حالات تلقائياً من المحادثات' : 'Auto case creation from conversations', icon: '📋' },
                { text: language === 'ar' ? 'تحليل المشاعر في الوقت الفعلي' : 'Real-time sentiment analysis', icon: '📊' },
                { text: language === 'ar' ? 'تكامل UAE PASS للهوية' : 'UAE PASS identity integration', icon: '🛡️' },
                { text: language === 'ar' ? 'لوحة تحكم شاملة للموظفين' : 'Comprehensive agent dashboard', icon: '🖥️' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 1.0 + i * 0.05 }}
                  className="flex items-center gap-3 bg-ae-green-50/50 border border-ae-green-100 rounded-lg px-4 py-2.5"
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ae-green-600 shrink-0" />
                    <span className="text-sm text-ae-black-700">{item.text}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-ae-black-50/30 border-t border-ae-black-100 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 1.0 }}
            >
              <h2 className="text-xl sm:text-2xl font-bold text-ae-black-800 mb-3">
                {language === 'ar' ? 'ابدأ الآن' : 'Get Started'}
              </h2>
              <p className="text-ae-black-400 text-sm mb-6">
                {language === 'ar'
                  ? 'اختر البوابة المناسبة لك للبدء في استخدام خدماتنا'
                  : 'Choose the right portal to start using our services'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button 
                  onClick={() => setPageView('customer')}
                  className="bg-primary hover:bg-primary/90 text-white rounded-lg px-6 h-11 font-semibold gap-2 shadow-sm"
                >
                  <Users className="w-4 h-4" />
                  {language === 'ar' ? 'بوابة العميل' : 'Customer Portal'}
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setPageView('admin')}
                  className="border-primary/20 text-primary hover:bg-primary hover:text-white rounded-lg px-6 h-11 font-semibold gap-2"
                >
                  <Shield className="w-4 h-4" />
                  {language === 'ar' ? 'لوحة التحكم' : 'Admin Dashboard'}
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </PageShell>
  )
}
