
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  PlusCircle,
  Bot,
  Brain,
  FileCheck2,
  Scale,
  GitBranch,
  Users,
  BarChart3,
  Globe,
  ArrowRight,
  CheckCircle2,
  Lock,
  Percent,
  TrendingUp,
  History,
  FileCheck,
  Clock,
  ChevronRight,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/lib/store'
import { useSystemConfig } from '@/hooks/use-system-config'
import { BrandedLogo, LanguageToggle, OnlineBadge, SectionHeading } from '@/components/shared'

export default function LandingPage() {
  const navigate = useNavigate()
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const { getNumber, getPercentage, getString } = useSystemConfig()

  // Read landing page metrics from admin-configurable system config
  const systemVersion = getString('system_version', '9.0.0')

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 overflow-x-hidden selection:bg-ae-green-500/20 selection:text-ae-green-900" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <BrandedLogo
            title={t('landing.header.title', language)}
            subtitle={t('landing.header.ministry', language)}
          />
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageToggle variant="default" />
            <LanguageToggle variant="icon" />
            <OnlineBadge className="hidden sm:flex" />
            <Button variant="outline" size="sm" onClick={() => navigate('/admin')} className="inline-flex gap-1.5 rounded-full border-gray-200 shadow-sm hover:border-ae-green-500 hover:text-ae-green-600 hover:bg-ae-green-50/50 transition-all font-semibold">
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">{t('landing.header.admin', language)}</span>
            </Button>
            <Button size="sm" onClick={() => navigate('/new-request')} className="rounded-full bg-gradient-to-r from-ae-green-600 to-ae-green-500 hover:from-ae-green-700 hover:to-ae-green-600 text-white gap-1.5 shadow-md shadow-ae-green-500/20 transition-all hover:shadow-lg hover:-translate-y-0.5 font-semibold">
              <PlusCircle className="w-4 h-4" />
              <span className="hidden sm:inline">{t('landing.header.newRequest', language)}</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
      {/* ─── Hero Section ─── */}
      <section className="relative overflow-hidden pt-24 pb-16 sm:pt-32 sm:pb-24 lg:pt-40 lg:pb-32">
        {/* Dynamic Abstract Background Mesh */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[50%] rounded-full bg-ae-green-500/10 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute bottom-[-10%] right-[-5%] w-[35%] h-[45%] rounded-full bg-ae-gold-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute top-[20%] right-[15%] w-[25%] h-[30%] rounded-full bg-blue-500/5 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto animate-fade-in-up">
            <Badge className="mb-8 rounded-full px-4 py-1.5 bg-white border border-gray-200 text-ae-green-700 shadow-sm shadow-ae-green-500/5 hover:bg-gray-50 transition-colors backdrop-blur-md">
              <span className="flex items-center gap-2 font-semibold">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ae-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-ae-green-500"></span>
                </span>
                {t('landing.hero.badge', language)}
              </span>
            </Badge>
            {/* Bilingual Title */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-ae-black-800 mb-3 leading-[1.1] tracking-tight drop-shadow-sm">
              {t('landing.hero.title1', language)}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-ae-green-600 to-ae-green-400 relative inline-block">
                {t('landing.hero.title2', language)}
                <svg className="absolute -bottom-2 left-0 w-full h-3 text-ae-gold-400/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </span>
            </h1>
            {/* Arabic subtitle for English mode, English subtitle for Arabic mode */}
            <p className={`text-xl sm:text-2xl ${isAr ? 'font-semibold' : ''} text-ae-gold-600 mb-4`}>
              {isAr ? 'AI Agent for Housing Arrears Rescheduling' : 'وكيل ذكي لإعادة جدولة متأخرات القروض السكنية'}
            </p>
            {/* SZHP + MOEI branding subtitle */}
            <p className="text-base sm:text-lg text-gray-500 mb-3 font-medium">
              Sheikh Zayed Housing Programme | UAE Ministry of Energy and Infrastructure
            </p>
            <p className="text-lg sm:text-xl lg:text-2xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed font-medium">
              {t('landing.hero.description', language)}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                onClick={() => navigate('/admin')}
                className="rounded-full bg-ae-green-600 hover:bg-ae-green-700 text-white text-base px-8 h-14 gap-2 w-full sm:w-auto shadow-lg shadow-ae-green-600/20 hover:shadow-xl hover:-translate-y-1 transition-all"
              >
                <LayoutDashboard className="w-5 h-5" />
                <span className="font-semibold">{t('landing.hero.adminDashboard', language)}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/new-request')}
                className="rounded-full border-gray-200 text-ae-black-700 hover:bg-white text-base px-8 h-14 gap-2 w-full sm:w-auto bg-white/50 backdrop-blur-md shadow-sm hover:border-ae-green-500 hover:text-ae-green-600 hover:-translate-y-1 transition-all"
              >
                <PlusCircle className="w-5 h-5" />
                <span className="font-semibold">{t('landing.hero.newReschedulingRequest', language)}</span>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Challenge Overview (6 MOEI-Specific Feature Cards) ─── */}
      <section className="py-16 sm:py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-sm font-bold tracking-widest text-ae-green-600 uppercase mb-3">
              {t('landing.challenge.badge', language)}
            </h2>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ae-black-800 mb-6">
              {t('landing.challenge.title', language)}
            </h3>
            <p className="text-gray-500 max-w-3xl mx-auto text-lg sm:text-xl font-medium">
              {t('landing.challenge.description', language)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Percent,
                title: t('landing.challenge.deduction20.title', language),
                description: t('landing.challenge.deduction20.desc', language),
                color: 'bg-ae-green-50 text-ae-green-600 border-ae-green-200',
              },
              {
                icon: Users,
                title: t('landing.challenge.incomePerMember.title', language),
                description: t('landing.challenge.incomePerMember.desc', language),
                color: 'bg-ae-gold-50 text-ae-gold-600 border-ae-gold-200',
              },
              {
                icon: TrendingUp,
                title: t('landing.challenge.incomeStability.title', language),
                description: t('landing.challenge.incomeStability.desc', language),
                color: 'bg-blue-50 text-blue-600 border-blue-200',
              },
              {
                icon: History,
                title: t('landing.challenge.paymentHistory.title', language),
                description: t('landing.challenge.paymentHistory.desc', language),
                color: 'bg-purple-50 text-purple-600 border-purple-200',
              },
              {
                icon: FileCheck,
                title: t('landing.challenge.documentVerification.title', language),
                description: t('landing.challenge.documentVerification.desc', language),
                color: 'bg-amber-50 text-amber-600 border-amber-200',
              },
              {
                icon: Clock,
                title: t('landing.challenge.periodRule.title', language),
                description: t('landing.challenge.periodRule.desc', language),
                color: 'bg-teal-50 text-teal-600 border-teal-200',
              },
            ].map((item, i) => (
              <div key={item.title} className="group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="h-full bg-white/70 backdrop-blur-xl border border-white rounded-3xl p-8 hover:shadow-2xl hover:shadow-ae-green-500/5 hover:-translate-y-2 transition-all duration-300">
                  <div className={`w-14 h-14 rounded-2xl ${item.color} border flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className="w-7 h-7" />
                  </div>
                  <h4 className="text-xl font-bold text-ae-black-800 mb-3 group-hover:text-ae-green-700 transition-colors">{item.title}</h4>
                  <p className="text-base text-gray-500 leading-relaxed font-medium">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works (MOEI-specific 5 steps) ─── */}
      <section className="py-16 sm:py-24 bg-white relative border-y border-gray-100 shadow-sm">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-sm font-bold tracking-widest text-ae-gold-500 uppercase mb-3">
              {t('landing.howItWorks.badge', language)}
            </h2>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ae-black-800 mb-6">
              {t('landing.howItWorks.title', language)}
            </h3>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg sm:text-xl font-medium">
              {t('landing.howItWorks.description', language)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6 sm:gap-4 items-start">
            {[
              {
                step: '01',
                icon: PlusCircle,
                title: t('landing.howItWorks.step1.moeiTitle', language),
                desc: t('landing.howItWorks.step1.moeiDesc', language),
              },
              {
                step: '02',
                icon: Brain,
                title: t('landing.howItWorks.step2.moeiTitle', language),
                desc: t('landing.howItWorks.step2.moeiDesc', language),
              },
              {
                step: '03',
                icon: Scale,
                title: t('landing.howItWorks.step3.moeiTitle', language),
                desc: t('landing.howItWorks.step3.moeiDesc', language),
              },
              {
                step: '04',
                icon: Bot,
                title: t('landing.howItWorks.step4.moeiTitle', language),
                desc: t('landing.howItWorks.step4.moeiDesc', language),
              },
              {
                step: '05',
                icon: CheckCircle2,
                title: t('landing.howItWorks.step5.moeiTitle', language),
                desc: t('landing.howItWorks.step5.moeiDesc', language),
              },
            ].map((item, i) => (
              <div key={item.step} className="text-center group animate-fade-in-up relative" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ae-green-50 to-ae-green-100/50 border border-ae-green-200 text-ae-green-600 flex items-center justify-center mx-auto mb-6 shadow-sm group-hover:bg-ae-green-600 group-hover:text-white transition-all duration-500 group-hover:shadow-lg group-hover:-translate-y-1 group-hover:shadow-ae-green-500/20">
                  <item.icon className="w-8 h-8" />
                </div>
                <div className="text-xs font-bold tracking-widest text-ae-gold-500 uppercase mb-2">{t('landing.howItWorks.step', language)} {item.step}</div>
                <h4 className="text-lg font-bold text-ae-black-800 mb-3">{item.title}</h4>
                <p className="text-sm text-gray-500 font-medium leading-relaxed break-words">{item.desc}</p>
                {i < 4 && (
                  <div className="hidden lg:block absolute top-10 -right-8 w-16 h-[2px] bg-gradient-to-r from-ae-green-200 to-transparent z-0"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Key Metrics (4 MOEI-specific stat cards) ─── */}
      <section className="py-16 sm:py-24 relative overflow-hidden bg-ae-green-700 text-white">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-ae-green-800 via-ae-green-700 to-ae-green-900 opacity-90" />
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-ae-gold-500/20 rounded-full blur-[100px] -translate-y-1/2" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <h2 className="text-sm font-bold tracking-widest text-ae-gold-400 uppercase mb-3">
              {t('landing.impact.badge', language)}
            </h2>
            <h3 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {t('landing.impact.title', language)}
            </h3>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[
              { value: t('landing.impact.serviceTime.label', language), label: t('landing.impact.serviceTime.desc', language), desc: '' },
              { value: t('landing.impact.maxDeduction.label', language), label: t('landing.impact.maxDeduction.desc', language), desc: '' },
              { value: t('landing.impact.incomeThreshold.label', language), label: t('landing.impact.incomeThreshold.desc', language), desc: '' },
              { value: t('landing.impact.governance.label', language), label: t('landing.impact.governance.desc', language), desc: '' },
            ].map((metric, i) => (
              <div key={metric.label} className="text-center group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/10 hover:bg-white/20 hover:border-white/30 transition-all duration-300 hover:-translate-y-2">
                  <div className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-ae-gold-300 to-ae-gold-500 mb-3 drop-shadow-sm group-hover:scale-105 transition-transform">{metric.value}</div>
                  <div className="text-base font-bold text-white mb-2 tracking-wide">{metric.label}</div>
                  {metric.desc && <div className="text-sm text-ae-green-100 font-medium break-words opacity-90">{metric.desc}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MOEI Compliance Section ─── */}
      <section className="py-16 sm:py-24 bg-white relative overflow-hidden border-y border-gray-100">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-0 right-0 w-[40%] h-[50%] bg-ae-green-500/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[30%] h-[40%] bg-ae-gold-500/5 rounded-full blur-[100px]" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16 animate-fade-in-up">
            <Badge className="mb-4 bg-ae-green-50 text-ae-green-700 border-ae-green-200">
              <ShieldCheck className="w-3 h-3 me-1" />
              {t('landing.moei.title', language)}
            </Badge>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-ae-black-800 mb-4">
              {t('landing.compliance.title', language)}
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-lg sm:text-xl font-medium">
              {t('landing.moei.description', language)}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 20% Deduction Rule Visual */}
            <Card className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-ae-green-50 border border-ae-green-200 flex items-center justify-center">
                    <Percent className="w-6 h-6 text-ae-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ae-black-800">{t('landing.moei.deductionRule.title', language)}</h3>
                    <p className="text-sm text-gray-500">{t('landing.compliance.deductionRule.desc', language)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400">0%</span>
                    <div className="flex-1 h-6 bg-gray-200 rounded-full overflow-hidden relative">
                      <div className="h-full bg-gradient-to-r from-ae-green-500 to-ae-green-400 rounded-full" style={{ width: '20%' }} />
                      <div className="absolute right-0 top-0 h-full w-0.5 bg-red-400" style={{ left: '20%' }} />
                      <div className="absolute top-0 h-full w-full flex items-center justify-center">
                        <span className="text-[10px] font-bold text-white drop-shadow-sm">20%</span>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">100%</span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-ae-green-600 font-semibold">{isAr ? 'مسموح' : 'Allowed'}</span>
                    <span className="text-red-500 font-semibold">{isAr ? 'غير مسموح' : 'Not Allowed'}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">{t('landing.moei.deductionRule.description', language)}</p>
              </CardContent>
            </Card>

            {/* Period Rule */}
            <Card className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-ae-gold-50 border border-ae-gold-200 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-ae-gold-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ae-black-800">{t('landing.moei.periodRule.title', language)}</h3>
                    <p className="text-sm text-gray-500">{t('landing.compliance.periodRule.desc', language)}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-ae-green-50/50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-ae-green-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ae-black-800">{isAr ? 'إعادة جدولة ضمن المدة المسموحة' : 'Rescheduling within allowed period'}</div>
                      <div className="text-xs text-gray-500">{isAr ? 'الخطة متوافقة مع قواعد المدة' : 'Plan complies with period rules'}</div>
                    </div>
                    <Badge className="bg-ae-green-50 text-ae-green-600 border-ae-green-200 text-xs">{t('caseDetail.pass', language)}</Badge>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-red-50/50 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-ae-black-800">{isAr ? 'تجاوز الحد الأقصى للمدة' : 'Exceeds maximum period'}</div>
                      <div className="text-xs text-gray-500">{isAr ? 'يجب تقصير مدة الخطة' : 'Plan duration must be shortened'}</div>
                    </div>
                    <Badge className="bg-red-50 text-red-600 border-red-200 text-xs">{t('caseDetail.fail', language)}</Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">{t('landing.moei.periodRule.description', language)}</p>
              </CardContent>
            </Card>

            {/* Income Per Family Member */}
            <Card className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ae-black-800">{t('landing.moei.incomeCalc.title', language)}</h3>
                    <p className="text-sm text-gray-500">{t('landing.compliance.incomeCalc.desc', language)}</p>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-center">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-400 mb-1">{isAr ? 'إجمالي الدخل' : 'Total Income'}</div>
                      <div className="text-lg font-bold text-ae-black-800">15,000</div>
                    </div>
                    <div className="text-2xl text-gray-300 font-bold">÷</div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-400 mb-1">{isAr ? 'حجم الأسرة' : 'Family Size'}</div>
                      <div className="text-lg font-bold text-ae-black-800">6</div>
                    </div>
                    <div className="text-2xl text-gray-300 font-bold">=</div>
                    <div className="bg-ae-green-50 rounded-lg p-3 border border-ae-green-200">
                      <div className="text-xs text-ae-green-600 mb-1">{isAr ? 'لكل فرد' : 'Per Member'}</div>
                      <div className="text-lg font-bold text-ae-green-600">2,500</div>
                      <div className="text-[10px] text-ae-green-500">AED</div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">{t('landing.moei.incomeCalc.description', language)}</p>
              </CardContent>
            </Card>

            {/* AI Agent Processing */}
            <Card className="bg-white border-gray-200 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center">
                    <Bot className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ae-black-800">{t('landing.compliance.aiProcess.title', language)}</h3>
                    <p className="text-sm text-gray-500">{t('landing.compliance.aiProcess.desc', language)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: CheckCircle2, color: 'text-ae-green-600', label: isAr ? 'تحليل الدخل والأسرة' : 'Analyze Income & Family', bg: 'bg-ae-green-50' },
                    { icon: Scale, color: 'text-ae-gold-600', label: isAr ? 'التحقق من قواعد الخصم والمدة' : 'Validate Deduction & Period Rules', bg: 'bg-ae-gold-50' },
                    { icon: FileCheck2, color: 'text-blue-600', label: isAr ? 'التحقق من المستندات' : 'Verify Documents', bg: 'bg-blue-50' },
                    { icon: Brain, color: 'text-purple-600', label: isAr ? 'إنشاء التوصية' : 'Generate Recommendation', bg: 'bg-purple-50' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className={`w-8 h-8 rounded-lg ${step.bg} flex items-center justify-center shrink-0`}>
                        <step.icon className={`w-4 h-4 ${step.color}`} />
                      </div>
                      <span className="text-sm font-medium text-ae-black-700">{step.label}</span>
                      {i < 3 && <ChevronRight className="w-4 h-4 text-gray-300 ms-auto rtl:rotate-180" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ─── Technical Architecture ─── */}
      <section className="py-12 sm:py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14 animate-fade-in-up">
            <Badge className="mb-4 bg-ae-gold-50 text-ae-gold-700 border-ae-gold-200">
              {t('landing.architecture.badge', language)}
            </Badge>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-ae-black-800 mb-4">
              {t('landing.architecture.title', language)}
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-base sm:text-lg">
              {t('landing.architecture.description', language)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                icon: Bot,
                title: t('landing.architecture.aiLayer.title', language),
                items: [
                  t('landing.architecture.aiLayer.1', language),
                  t('landing.architecture.aiLayer.2', language),
                  t('landing.architecture.aiLayer.3', language),
                  t('landing.architecture.aiLayer.4', language),
                ],
              },
              {
                icon: Scale,
                title: t('landing.architecture.rulesEngine.title', language),
                items: [
                  t('landing.architecture.rulesEngine.1', language),
                  t('landing.architecture.rulesEngine.2', language),
                  t('landing.architecture.rulesEngine.3', language),
                  t('landing.architecture.rulesEngine.4', language),
                ],
              },
              {
                icon: Lock,
                title: t('landing.architecture.security.title', language),
                items: [
                  t('landing.architecture.security.1', language),
                  t('landing.architecture.security.2', language),
                  t('landing.architecture.security.3', language),
                  t('landing.architecture.security.4', language),
                ],
              },
              {
                icon: BarChart3,
                title: t('landing.architecture.dashboard.title', language),
                items: [
                  t('landing.architecture.dashboard.1', language),
                  t('landing.architecture.dashboard.2', language),
                  t('landing.architecture.dashboard.3', language),
                  t('landing.architecture.dashboard.4', language),
                ],
              },
              {
                icon: GitBranch,
                title: t('landing.architecture.workflow.title', language),
                items: [
                  t('landing.architecture.workflow.1', language),
                  t('landing.architecture.workflow.2', language),
                  t('landing.architecture.workflow.3', language),
                  t('landing.architecture.workflow.4', language),
                ],
              },
              {
                icon: Globe,
                title: t('landing.architecture.localization.title', language),
                items: [
                  t('landing.architecture.localization.1', language),
                  t('landing.architecture.localization.2', language),
                  t('landing.architecture.localization.3', language),
                  t('landing.architecture.localization.4', language),
                ],
              },
            ].map((item) => (
              <Card key={item.title} className="bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow animate-fade-in-up">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-ae-gold-50 border border-ae-gold-200 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-ae-gold-600" />
                    </div>
                    <h3 className="text-base font-semibold text-ae-black-800">{item.title}</h3>
                  </div>
                  <ul className="space-y-2">
                    {item.items.map((listItem) => (
                      <li key={listItem} className="flex items-start gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 text-ae-green-500 shrink-0 mt-0.5" />
                        {listItem}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Section ─── */}
      <section className="py-20 sm:py-32 relative overflow-hidden bg-slate-50">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-ae-green-200 to-transparent"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-ae-green-500/5 rounded-full blur-[100px]"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="animate-fade-in-up">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-ae-black-800 mb-6 tracking-tight">
              {t('landing.cta.title', language)}
            </h2>
            <p className="text-gray-500 mb-12 text-lg sm:text-xl max-w-2xl mx-auto font-medium">
              {t('landing.cta.description', language)}
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <div 
                className="flex-1 max-w-sm rounded-3xl bg-white border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-ae-gold-500/10 hover:border-ae-gold-200 cursor-pointer group transition-all duration-300 hover:-translate-y-2" 
                onClick={() => navigate('/admin')}
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ae-gold-50 to-ae-gold-100 border border-ae-gold-200 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <LayoutDashboard className="w-10 h-10 text-ae-gold-600" />
                </div>
                <h4 className="text-2xl font-bold text-ae-black-800 mb-3">{t('landing.cta.adminCard.title', language)}</h4>
                <p className="text-base text-gray-500 font-medium mb-8">
                  {t('landing.cta.adminCard.desc', language)}
                </p>
                <Button className="w-full rounded-full bg-ae-gold-500 hover:bg-ae-gold-600 text-white h-14 text-base font-semibold transition-colors duration-300 gap-2 shadow-md shadow-ae-gold-500/20">
                  {t('landing.cta.adminCard.button', language)} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </Button>
              </div>

              <div 
                className="flex-1 max-w-sm rounded-3xl bg-white border border-gray-100 p-8 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-ae-green-500/10 hover:border-ae-green-200 cursor-pointer group transition-all duration-300 hover:-translate-y-2" 
                onClick={() => navigate('/new-request')}
              >
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-ae-green-50 to-ae-green-100 border border-ae-green-200 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 shadow-sm">
                  <PlusCircle className="w-10 h-10 text-ae-green-600" />
                </div>
                <h4 className="text-2xl font-bold text-ae-black-800 mb-3">{t('landing.cta.requestCard.title', language)}</h4>
                <p className="text-base text-gray-500 font-medium mb-8">
                  {t('landing.cta.requestCard.desc', language)}
                </p>
                <Button className="w-full rounded-full bg-ae-green-600 hover:bg-ae-green-700 text-white h-14 text-base font-semibold transition-colors duration-300 gap-2 shadow-md shadow-ae-green-600/20">
                  {t('landing.cta.requestCard.button', language)} <ArrowRight className="w-5 h-5 rtl:rotate-180" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      </main>

      {/* ─── Footer (sticky) ─── */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <BrandedLogo
              size="sm"
              title={t('landing.footer.title', language)}
              subtitle={t('landing.footer.ministry', language)}
              titleClassName="text-sm"
              subtitleClassName="text-xs text-gray-500"
            />
            <div className="flex flex-col items-center md:items-end gap-1">
              <div className="text-sm font-semibold text-ae-gold-600">{t('landing.footer.moei', language)}</div>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-xs text-gray-500">
                <OnlineBadge size="sm" className="border-ae-green-500/50" />
                <Separator orientation="vertical" className="h-4 bg-gray-200" />
                <span>v{systemVersion}</span>
                <Separator orientation="vertical" className="h-4 bg-gray-200" />
                <span>{t('landing.footer.uaeVision', language)}</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
