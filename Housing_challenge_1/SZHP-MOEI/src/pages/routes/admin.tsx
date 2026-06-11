import React, { useEffect, useState, useCallback, useRef, Suspense } from 'react'

import { useNavigate } from 'react-router-dom'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { useAppStore, type DashboardStats, type RequestData } from '@/lib/store'
import { useAuthStore } from '@/lib/auth-store'
import { authFetch } from '@/lib/utils'

// Shared components
import { LoadingSpinner, BrandedLogo, OnlineBadge } from '@/components/shared'

// All heavy sub-components are dynamically imported to reduce initial chunk size
// This prevents ChunkLoadError and speeds up initial page load
const StatsCards = React.lazy(() => import('@/components/dashboard/stats-cards').then(m => ({ default: m.StatsCards })))
const Charts = React.lazy(() => import('@/components/dashboard/charts').then(m => ({ default: m.Charts })))
const RecentCases = React.lazy(() => import('@/components/dashboard/recent-cases').then(m => ({ default: m.RecentCases })))
const CaseList = React.lazy(() => import('@/components/cases/case-list').then(m => ({ default: m.CaseList })))
const CaseDetail = React.lazy(() => import('@/components/assessment/case-detail'))
const UsersView = React.lazy(() => import('@/components/admin/users-view').then(m => ({ default: m.UsersView })))
const AuditView = React.lazy(() => import('@/components/admin/audit-view').then(m => ({ default: m.AuditView })))
const ModelsView = React.lazy(() => import('@/components/admin/models-view').then(m => ({ default: m.ModelsView })))
const AIPromptsView = React.lazy(() => import('@/components/admin/ai-prompts-view').then(m => ({ default: m.AIPromptsView })))
const WorkflowsView = React.lazy(() => import('@/components/admin/workflows-view').then(m => ({ default: m.WorkflowsView })))
const SettingsView = React.lazy(() => import('@/components/admin/settings-view').then(m => ({ default: m.SettingsView })))
const AdminChatbot = React.lazy(() => import('@/components/admin/admin-chatbot').then(m => ({ default: m.default || m.AdminChatbot })))
const DataImport = React.lazy(() => import('@/components/admin/data-import').then(m => ({ default: m.DataImport })))

import { motion, AnimatePresence } from 'framer-motion'
import { Settings, Shield, FileText, Bot, GitBranch, ListFilter, Plus, ShieldAlert, Globe, Briefcase, Menu, Cpu, ChevronLeft, ChevronRight, Home, LogOut, MessageSquare, Upload, FileDown, Calendar } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import { toast } from '@/hooks/use-toast'
import { t } from '@/lib/i18n'

import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/use-mobile'

import { canAccessView, getRoleLabel, getDefaultPermissions } from '@/lib/rbac'
import { useSystemConfig } from '@/hooks/use-system-config'

export default function AdminPage() {
  const {
    currentView,
    selectedCaseId,
    sidebarCollapsed,
    language,
    setView,
    selectCase,
  } = useAppStore()
  const { isAuthenticated, userRole, userProfile, permissions, logout, _hasHydrated } = useAuthStore()
  const isAr = language === 'ar'
  const { getString, getBoolean } = useSystemConfig()
  const systemVersion = getString('system_version', '9.0.0')
  const isAdminChatbotEnabled = getBoolean('admin_chatbot_enabled', true)
  const navigate = useNavigate()

  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null)
  const [cases, setCases] = useState<RequestData[]>([])
  const [selectedCase, setSelectedCase] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [casesLoading, setCasesLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [chatbotOpen, setChatbotOpen] = useState(false)
  const [dashboardPeriod, setDashboardPeriod] = useState<string>('all')
  const [dashboardDateFrom, setDashboardDateFrom] = useState<string>('')
  const [dashboardDateTo, setDashboardDateTo] = useState<string>('')
  const [exportingPDF, setExportingPDF] = useState(false)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()

  // Close chatbot if admin chatbot setting is disabled
  useEffect(() => {
    if (!isAdminChatbotEnabled && chatbotOpen) {
      setChatbotOpen(false)
    }
  }, [isAdminChatbotEnabled, chatbotOpen])

  // Auth guard: redirect to login if not authenticated (wait for hydration)
  useEffect(() => {
    if (!_hasHydrated) return // Wait for zustand persist to hydrate
    if (!isAuthenticated) {
      navigate('/admin/login')
    }
  }, [isAuthenticated, _hasHydrated, navigate])

  const fetchDashboard = useCallback(async (period?: string, dateFrom?: string, dateTo?: string) => {
    try {
      const p = period || dashboardPeriod
      const df = dateFrom ?? dashboardDateFrom
      const dt = dateTo ?? dashboardDateTo
      let url = `/api/dashboard?period=${p}`
      if (p === 'custom' && df && dt) {
        url += `&fromDate=${df}&toDate=${dt}`
      }
      const res = await authFetch(url)
      if (res.ok) {
        const data = await res.json()
        setDashboardStats(data)
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [dashboardPeriod, dashboardDateFrom, dashboardDateTo])

  const fetchCases = useCallback(async () => {
    setCasesLoading(true)
    try {
      const res = await authFetch('/api/requests')
      if (res.ok) {
        const data = await res.json()
        setCases(data)
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err)
    } finally {
      setCasesLoading(false)
    }
  }, [])

  const fetchCaseDetail = useCallback(async (id: string) => {
    setDetailLoading(true)
    try {
      const res = await authFetch(`/api/requests/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedCase(data)
      }
    } catch (err) {
      console.error('Failed to fetch case:', err)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
    fetchCases()
  }, [fetchDashboard, fetchCases])

  useEffect(() => {
    if (selectedCaseId) {
      fetchCaseDetail(selectedCaseId)
    }
  }, [selectedCaseId, fetchCaseDetail])

  const handleSelectCase = (id: string) => {
    selectCase(id)
  }

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return
    setExportingPDF(true)
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('l', 'mm', 'a4') // landscape
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()

      // Add title
      pdf.setFontSize(16)
      pdf.text('SZHP Dashboard Report', 14, 15)
      pdf.setFontSize(10)
      pdf.text(`Period: ${dashboardPeriod} | Generated: ${new Date().toLocaleString()}`, 14, 22)

      // Add dashboard image
      const imgWidth = pdfWidth - 28
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      pdf.addImage(imgData, 'PNG', 14, 28, imgWidth, Math.min(imgHeight, pdfHeight - 35))

      pdf.save(`SZHP-Dashboard-Report-${new Date().toISOString().split('T')[0]}.pdf`)
      toast({ title: isAr ? 'تم تصدير التقرير بنجاح' : 'Report exported successfully' })
    } catch (err) {
      console.error('PDF export failed:', err)
      toast({ title: isAr ? 'فشل تصدير التقرير' : 'Export failed', variant: 'destructive' })
    } finally {
      setExportingPDF(false)
    }
  }

  const handleAssess = async (id: string) => {
    try {
      toast({ title: t('admin.assess.running', language), description: t('admin.assess.runningDesc', language) })
      const res = await authFetch(`/api/requests/${id}/assess`, { method: 'POST' })
      if (res.ok) {
        toast({ title: t('admin.assess.complete', language), description: t('admin.assess.completeDesc', language) })
        fetchCases()
        fetchDashboard()
        if (selectedCaseId === id) fetchCaseDetail(id)
      } else {
        const err = await res.json()
        toast({ title: t('admin.assess.failed', language), description: err.error || t('admin.assess.networkError', language), variant: 'destructive' })
      }
    } catch {
      toast({ title: t('admin.assess.failed', language), description: t('admin.assess.networkError', language), variant: 'destructive' })
    }
  }

  // Nav items with translation keys & RBAC
  const allNavItems = [
    { id: 'cases', translationKey: 'admin.nav.cases', icon: ListFilter, permission: 'cases' },
    { id: 'form-builder', translationKey: 'admin.nav.aiPrompts', icon: Bot, permission: 'settings' },
    { id: 'workflows', translationKey: 'admin.nav.workflows', icon: GitBranch, permission: 'workflows' },
    { id: 'users', translationKey: 'admin.nav.users', icon: Briefcase, permission: 'employees.view' },
    { id: 'audit', translationKey: 'admin.nav.audit', icon: FileText, permission: 'audit.view' },
    { id: 'models', translationKey: 'admin.nav.models', icon: Cpu, permission: 'models' },
    { id: 'data-import', translationKey: 'admin.nav.dataImport', icon: Upload, permission: 'settings' },
    { id: 'settings', translationKey: 'admin.nav.settings', icon: Settings, permission: 'settings' },
  ]
  // Use effective permissions: if permissions are empty but user has an admin role, use default role permissions
  const effectivePermissions = (permissions && permissions.length > 0)
    ? permissions
    : getDefaultPermissions(userRole)
  const navItems = allNavItems.filter(item => canAccessView(userRole, effectivePermissions, item.permission))

  const userName = isAuthenticated && userProfile
    ? (isAr && userProfile.fullnameAR ? userProfile.fullnameAR : userProfile.fullnameEN)
    : t('admin.header.roleAdmin', language)

  // Helper: render sidebar content (shared between desktop and mobile)
  const renderSidebarContent = (onNavigate: () => void, collapsed: boolean) => (
    <>
      {/* Logo */}
      <BrandedLogo
        variant={collapsed ? 'icon-only' : 'compact'}
        className="px-4 h-16 border-b border-[rgba(201,168,76,0.2)] shrink-0"
        titleClassName="text-[var(--moei-text)]"
        subtitleClassName="text-[var(--moei-muted)]"
      />

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = currentView === item.id || (item.id === 'cases' && currentView === 'case-detail')
          const Icon = item.icon
          return (
            <button key={item.id} onClick={() => { setView(item.id as any); onNavigate(); }} aria-current={isActive ? 'page' : undefined} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-bold transition-all duration-200 group relative min-w-0 ${isActive ? 'moei-nav-item-active' : 'moei-nav-item'}`}>
              <Icon className={`w-5 h-5 shrink-0 ${isActive && 'text-[var(--moei-gold)]'}`} />
              {!collapsed && (
                <span className="truncate min-w-0">
                  {t(item.translationKey, language)}
                </span>
              )}
              {isActive && <div className="absolute start-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[var(--moei-gold)] rounded-e-full" />}
            </button>
          )
        })}

        {/* New Request - navigates to /new-request */}
        <button
          onClick={() => { navigate('/new-request'); onNavigate(); }}
          className="moei-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-bold transition-all duration-200 group relative mt-2"
        >
          <Plus className="w-5 h-5 shrink-0" />
          {!collapsed && (
            <span className="truncate min-w-0">
              {t('admin.newRequest', language)}
            </span>
          )}
        </button>
      </nav>

      {/* Bottom Actions */}
      <div className="px-2 py-2 border-t border-[rgba(201,168,76,0.2)] space-y-1">
        <button onClick={() => { navigate('/'); onNavigate(); }} className="moei-nav-item w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors min-w-0">
          <Home className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="truncate min-w-0">{t('admin.home', language)}</span>}
        </button>
        <button onClick={() => { useAppStore.getState().setLanguage(isAr ? 'en' : 'ar'); onNavigate(); }} className="moei-nav-item w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors min-w-0">
          <Globe className="w-5 h-5 shrink-0" />
          {!collapsed && <span>{isAr ? 'English' : 'العربية'}</span>}
        </button>
        {isAuthenticated && (
          <button onClick={() => { logout(); onNavigate(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--moei-danger)] hover:bg-[var(--moei-danger-soft)] transition-colors">
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{t('admin.signOut', language)}</span>}
          </button>
        )}
      </div>
    </>
  )

  const viewTitle = currentView === 'dashboard' ? t('admin.nav.dashboard', language) :
    currentView === 'cases' || currentView === 'case-detail' ? t('admin.cases', language) :
    currentView === 'form-builder' ? t('admin.nav.aiPrompts', language) :
    currentView === 'workflows' ? t('admin.nav.workflows', language) :
    currentView === 'users' ? t('admin.users.title', language) :
    currentView === 'audit' ? t('admin.audit.title', language) :
    currentView === 'models' ? t('admin.nav.models', language) :
    currentView === 'data-import' ? t('admin.nav.dataImport', language) :
    currentView === 'settings' ? t('admin.nav.settings', language) :
    t('admin.nav.dashboard', language)

  // Show nothing while checking auth or waiting for hydration (prevents flash of content)
  if (!_hasHydrated || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="md" label={t('admin.header.loading', language)} />
      </div>
    )
  }

  // Access Check: Prevent citizens from accessing the dashboard
  if (userRole === 'citizen') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" dir={isAr ? 'rtl' : 'ltr'}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
          <Card className="border-red-100 shadow-xl overflow-hidden bg-white">
            <div className="h-1.5 bg-red-500 w-full" />
            <CardHeader className="text-center pb-2 pt-8">
              <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">
                {isAr ? 'وصول غير مصرح به' : 'Access Denied'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center px-8 pb-8">
              <p className="text-gray-500 mb-8 leading-relaxed">
                {isAr 
                  ? 'عذراً، لا تملك الصلاحيات اللازمة للوصول إلى لوحة تحكم الإدارة. هذه المنطقة مخصصة لموظفي البرنامج فقط.'
                  : 'Sorry, you do not have permission to access the admin dashboard. This area is restricted to employees only.'}
              </p>
              <div className="flex flex-col gap-3">
                <Button onClick={() => navigate('/')} className="w-full text-white hover:bg-[#9A7429]" style={{ backgroundColor: '#B68A35' }}>
                  <Home className="w-4 h-4 me-2" />
                  {isAr ? 'العودة للصفحة الرئيسية' : 'Return to Home'}
                </Button>
                <Button variant="outline" onClick={() => logout()} className="w-full">
                  <LogOut className="w-4 h-4 me-2" />
                  {isAr ? 'تسجيل الخروج' : 'Sign Out'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="moei-ops min-h-screen flex overflow-x-hidden" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Skip to content link for accessibility */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:start-2 focus:px-4 focus:py-2 focus:bg-ae-gold-500 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium">
        {t('admin.skipToContent', language)}
      </a>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <motion.aside
          initial={false}
          animate={{ width: sidebarCollapsed ? 72 : 260 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="moei-sidebar fixed start-0 top-0 h-screen z-50 flex flex-col border-e shadow-2xl"
        >
          {renderSidebarContent(() => {}, sidebarCollapsed)}
          {/* Collapse Toggle - desktop only */}
          <button onClick={() => useAppStore.getState().toggleSidebar()} aria-label={isAr ? (sidebarCollapsed ? 'توسيع القائمة' : 'طي القائمة') : (sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')} className="flex items-center justify-center h-12 border-t border-[rgba(201,168,76,0.2)] text-[var(--moei-muted)] hover:text-[var(--moei-gold)] hover:bg-[var(--moei-gold-soft)] transition-colors">
            {sidebarCollapsed ? (
              <ChevronRight className="w-5 h-5 rtl:rotate-180" />
            ) : (
              <ChevronLeft className="w-5 h-5 rtl:rotate-180" />
            )}
          </button>
        </motion.aside>
      )}

      {/* Mobile Sheet Sidebar */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side={isAr ? "right" : "left"} className="moei-sidebar p-0 w-[280px] sm:max-w-[280px] border-[rgba(201,168,76,0.2)] text-[var(--moei-text)] [&>button]:text-[var(--moei-muted)] [&>button]:hover:text-[var(--moei-gold)]">
            <SheetTitle className="sr-only">{t('admin.szhpAdmin', language)}</SheetTitle>
            <SheetDescription className="sr-only">Navigation menu</SheetDescription>
            <div className="flex flex-col h-full">
              {renderSidebarContent(() => setMobileMenuOpen(false), false)}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300" style={{ marginInlineStart: isMobile ? 0 : (sidebarCollapsed ? 72 : 260) }}>
        {/* Header */}
        <header className="moei-topbar sticky top-0 z-40 backdrop-blur-md border-b px-4 sm:px-6 h-16 flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile hamburger */}
            {isMobile && (
              <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ms-2 rounded-lg hover:bg-ae-black-50 transition-colors shrink-0" aria-label="Open menu">
                <Menu className="w-5 h-5 text-[var(--moei-text)]" />
              </button>
            )}
            <h2 className="text-base sm:text-lg font-black text-[var(--moei-text)] truncate min-w-0">
              {viewTitle}
            </h2>
            {/* Hide user name on mobile */}
            {isAuthenticated && userProfile && !isMobile && (
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm text-[var(--moei-muted)]">{userName}</span>
                <Badge variant="outline" className="text-xs border-[var(--moei-border-strong)] text-[var(--moei-gold)]">
                  {getRoleLabel(userRole, language)}
                </Badge>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {isAdminChatbotEnabled && (
              <button
                onClick={() => setChatbotOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#B68A35]/30 bg-[#B68A35]/5 hover:bg-[#B68A35]/10 text-[#B68A35] transition-colors text-sm font-medium"
                title={t('admin.chatbot.title', language)}
                aria-label={t('admin.chatbot.title', language)}
              >
                <Bot className="w-4 h-4" />
                <span className="hidden sm:inline">{t('admin.chatbot.buttonLabel', language)}</span>
              </button>
            )}
            <OnlineBadge size="sm" />
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content" className="flex-1 p-4 sm:p-6 overflow-y-scroll overflow-x-hidden">
          <Suspense fallback={<LoadingSpinner />}>
          <AnimatePresence mode="wait">
            {currentView === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
                {/* Dashboard Period Filter + Date Range + Export */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-ae-black-500 font-medium">{isAr ? 'الفترة الزمنية:' : 'Time Period:'}</span>
                    {[
                      { value: 'all', label: isAr ? 'الكل' : 'All Time' },
                      { value: 'quarter', label: isAr ? 'هذا الربع' : 'This Quarter' },
                      { value: 'month', label: isAr ? 'هذا الشهر' : 'This Month' },
                      { value: '30d', label: isAr ? 'آخر 30 يوم' : 'Last 30 Days' },
                      { value: 'custom', label: isAr ? 'مخصص' : 'Custom' },
                    ].map((opt) => (
                      <Button
                        key={opt.value}
                        variant={dashboardPeriod === opt.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setDashboardPeriod(opt.value)
                          if (opt.value !== 'custom') {
                            fetchDashboard(opt.value)
                          }
                        }}
                        className={dashboardPeriod === opt.value ? 'bg-ae-gold-500 hover:bg-ae-gold-600 text-white' : 'text-ae-black-500 hover:text-ae-black-700'}
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                  <Button
                    onClick={handleExportPDF}
                    disabled={exportingPDF}
                    className="bg-[#B68A35] hover:bg-[#9A7429] text-white gap-2"
                  >
                    {exportingPDF ? (
                      <>
                        <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        <span className="hidden sm:inline">{isAr ? 'جاري التصدير...' : 'Exporting...'}</span>
                      </>
                    ) : (
                      <>
                        <FileDown className="w-4 h-4" />
                        <span>{isAr ? 'تصدير التقرير' : 'Export Report'}</span>
                      </>
                    )}
                  </Button>
                </div>
                {/* Custom Date Range Filter */}
                {dashboardPeriod === 'custom' && (
                  <div className="flex items-center gap-3 flex-wrap bg-ae-gold-50/50 border border-ae-gold-200/50 rounded-lg p-3">
                    <Calendar className="w-4 h-4 text-ae-gold-600 shrink-0" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-sm text-ae-black-500 font-medium">{isAr ? 'من:' : 'From:'}</label>
                      <input
                        type="date"
                        value={dashboardDateFrom}
                        onChange={(e) => setDashboardDateFrom(e.target.value)}
                        className="border border-ae-gold-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ae-gold-300"
                      />
                      <label className="text-sm text-ae-black-500 font-medium">{isAr ? 'إلى:' : 'To:'}</label>
                      <input
                        type="date"
                        value={dashboardDateTo}
                        onChange={(e) => setDashboardDateTo(e.target.value)}
                        className="border border-ae-gold-200 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-ae-gold-300"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          if (dashboardDateFrom && dashboardDateTo) {
                            fetchDashboard('custom', dashboardDateFrom, dashboardDateTo)
                          } else {
                            toast({ title: isAr ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please select both start and end dates', variant: 'destructive' })
                          }
                        }}
                        className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                      >
                        {isAr ? 'تطبيق' : 'Apply'}
                      </Button>
                    </div>
                  </div>
                )}
                <div ref={dashboardRef}>
                  <StatsCards stats={dashboardStats} loading={loading} />
                  <Charts stats={dashboardStats} loading={loading} />
                </div>
                <RecentCases cases={dashboardStats?.recentRequests || []} loading={loading} onSelectCase={handleSelectCase} />
              </motion.div>
            )}

            {currentView === 'cases' && (
              <motion.div key="cases" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <CaseList cases={cases} loading={casesLoading} onSelectCase={handleSelectCase} onAssess={handleAssess} onNewRequest={() => navigate('/new-request')} />
              </motion.div>
            )}

            {currentView === 'case-detail' && (
              <motion.div key="case-detail" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <CaseDetail caseData={selectedCase} loading={detailLoading} onBack={() => setView('cases')} onStatusChange={() => { if (selectedCaseId) { fetchCaseDetail(selectedCaseId); fetchCases(); fetchDashboard() } }} />
              </motion.div>
            )}

            {/* AI Verification Prompts View — DIALOG-BASED */}
            {currentView === 'form-builder' && (
              <AIPromptsView />
            )}

            {/* Workflows View — Business Rules & Limits with Field Rules */}
            {currentView === 'workflows' && (
              <WorkflowsView />
            )}

            {/* Users View — Employee Management */}
            {currentView === 'users' && (
              <UsersView />
            )}

            {/* Audit View — Audit Trail & Activity Log */}
            {currentView === 'audit' && (
              <AuditView />
            )}

            {/* Models View — AI Model Management */}
            {currentView === 'models' && (
              <ModelsView />
            )}

            {/* Data Import View */}
            {currentView === 'data-import' && (
              <DataImport />
            )}

            {currentView === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <SettingsView />
              </motion.div>
            )}
          </AnimatePresence>
          </Suspense>
        </main>

        {/* Footer */}
        <footer className="border-t border-[rgba(201,168,76,0.2)] bg-[rgba(10,22,40,0.82)] backdrop-blur-sm px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between text-xs text-[var(--moei-muted)] gap-2">
          <div className="flex items-center gap-2">
            <Shield className="w-3 h-3 text-ae-gold-500" />
            <span>{t('admin.footer.title', language)}</span>
            <span className="text-ae-black-200">|</span>
            <span>{t('admin.footer.ministry', language)}</span>
          </div>
          <div className="flex items-center gap-3">
            <OnlineBadge size="sm" />
            <span>v{systemVersion}</span>
          </div>
        </footer>
      </div>

      {/* Admin AI Chatbot Panel */}
      <Suspense fallback={null}>
        <AdminChatbot open={chatbotOpen} onOpenChange={setChatbotOpen} currentView={currentView} />
      </Suspense>
    </div>
  )
}
