'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ShieldAlert,
  BarChart4,
  Cpu,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Languages,
  MessageSquare,
  Bell,
  LogIn,
  User,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmployerNotificationBell } from '@/components/agent/employer-notification-bell'
import { EmployerLoginDialog } from '@/components/agent/employer-login-dialog'

const navItems: { id: string; label: string; labelAr: string; icon: React.ElementType; section?: string; badge?: () => number }[] = [
  { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة القيادة', icon: LayoutDashboard, section: 'workspace' },
  { id: 'conversations', label: 'Conversations', labelAr: 'المحادثات', icon: MessageSquare, section: 'workspace' },
  { id: 'rules', label: 'Service Rules', labelAr: 'قواعد الخدمة', icon: ShieldAlert, section: 'workspace' },
  { id: 'insights', label: 'Team Insights', labelAr: 'رؤى الفريق', icon: BarChart4, section: 'workspace' },
  { id: 'notifications', label: 'Notifications', labelAr: 'الإشعارات', icon: Bell, section: 'workspace' },
  { id: 'ai-config', label: 'AI Models', labelAr: 'نماذج الذكاء الاصطناعي', icon: Cpu, section: 'configure' },
  { id: 'settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings2, section: 'configure' },
]

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar, language, currentAgent, conversationSessions, employerUnreadCount } = useAppStore()
  const isAr = language === 'ar'
  const [loginOpen, setLoginOpen] = useState(false)

  const workspaceItems = navItems.filter(i => i.section === 'workspace')
  const configureItems = navItems.filter(i => i.section === 'configure')

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 68 : 256 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'z-40 shrink-0 border-e border-ae-black-100 bg-white',
        // Desktop: vertical sidebar — overflow-hidden prevents horizontal scroll
        'md:relative md:h-full md:flex-col md:flex md:overflow-hidden',
        // Mobile: bottom nav bar
        'max-md:fixed max-md:!w-full max-md:!h-[60px] max-md:bottom-0 max-md:start-0 max-md:flex-row max-md:border-e-0 max-md:border-t'
      )}
    >
      {/* ===== DESKTOP BRANDING ===== */}
      <div className="hidden md:flex flex-col shrink-0">
        {/* Thin gold accent stripe */}
        <div className="h-[3px] bg-ae-gold-500 shrink-0" />

        {/* Branding + Agent Info */}
        <div className="px-4 pt-5 pb-4 overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo mark or Agent Avatar */}
            {currentAgent ? (
              <button
                onClick={() => setLoginOpen(true)}
                className="relative shrink-0"
              >
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-ae-gold-500 text-white text-xs font-semibold">
                    {currentAgent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-ae-gold-500 flex items-center justify-center shrink-0">
                <Shield className="w-4.5 h-4.5 text-white" />
              </div>
            )}
            <AnimatePresence>
              {!sidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  {currentAgent ? (
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ae-black-800 tracking-wide truncate">
                        {currentAgent.name}
                      </div>
                      <div className="text-[10px] text-ae-gold-500 leading-tight mt-0.5 truncate">
                        {currentAgent.role}
                      </div>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-ae-black-800 tracking-wide truncate">
                        MOEI
                      </div>
                      <div className="text-[10px] text-ae-black-400 leading-tight mt-0.5 truncate">
                        {isAr
                          ? 'وزارة الطاقة والبنية التحتية'
                          : 'Energy & Infrastructure'}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Employer Login / Notification row */}
        <div className="mx-3 px-1 pb-2 flex items-center justify-center gap-1.5">
          {/* Notification Bell */}
          <EmployerNotificationBell />

          {/* Login/Profile button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-ae-black-400 hover:text-ae-gold-600 hover:bg-ae-gold-50 rounded-full transition-colors"
            onClick={() => setLoginOpen(true)}
            aria-label={currentAgent ? (isAr ? 'الملف الشخصي' : 'Profile') : (isAr ? 'تسجيل الدخول' : 'Login')}
          >
            {currentAgent ? (
              <User className="h-[18px] w-[18px]" />
            ) : (
              <LogIn className="h-[18px] w-[18px]" />
            )}
          </Button>
        </div>

        {/* Subtle divider */}
        <div className="mx-3 h-px bg-ae-black-100" />
      </div>

      {/* ===== MOBILE TOP ACCENT ===== */}
      <div className="md:hidden absolute top-0 start-0 end-0 h-[3px] bg-ae-gold-500" />

      {/* Mobile: Employer + Notification row */}
      <div className="md:hidden absolute -top-[60px] start-0 end-0 h-[60px] bg-white border-b border-ae-black-100 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {currentAgent ? (
            <>
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-ae-gold-500 text-white text-[10px] font-semibold">
                  {currentAgent.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-ae-black-700 truncate max-w-[100px]">{currentAgent.name}</span>
            </>
          ) : (
            <span className="text-xs font-medium text-ae-black-400">MOEI</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <EmployerNotificationBell />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-ae-black-400 hover:text-ae-gold-600 rounded-full"
            onClick={() => setLoginOpen(true)}
          >
            {currentAgent ? <User className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ===== NAVIGATION ===== */}
      <nav
        className={cn(
          'flex-1 md:py-3 md:px-2.5 overflow-y-auto overflow-x-hidden custom-scrollbar',
          // Mobile bottom nav
          'max-md:flex max-md:flex-row max-md:justify-around max-md:items-center max-md:py-0 max-md:px-1 max-md:overflow-x-hidden'
        )}
      >
        {/* Workspace section */}
        <div className={cn(
          'md:space-y-0.5',
          'max-md:flex max-md:flex-row max-md:gap-0'
        )}>
          {!sidebarCollapsed && (
            <div className="hidden md:block px-3 pt-2 pb-1.5 text-[10px] font-bold text-ae-black-400 uppercase tracking-wider">
              Workspace
            </div>
          )}
          {workspaceItems.map((item) => {
            const isActive = currentView === item.id
            const Icon = item.icon
            return (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive}
                isAr={isAr}
                sidebarCollapsed={sidebarCollapsed}
                onClick={() => setView(item.id)}
                badgeCount={
                  item.id === 'conversations' ? conversationSessions.filter(s => s.status === 'active').length :
                  item.id === 'notifications' ? employerUnreadCount :
                  0
                }
              />
            )
          })}
        </div>

        {/* Section divider */}
        <div className="hidden md:block mx-2 my-2 h-px bg-ae-black-100" />
        <div className={cn(
          'md:space-y-0.5',
          'max-md:flex max-md:flex-row max-md:gap-0'
        )}>
          {!sidebarCollapsed && (
            <div className="hidden md:block px-3 pt-2 pb-1.5 text-[10px] font-bold text-ae-black-400 uppercase tracking-wider">
              Configure
            </div>
          )}
          {configureItems.map((item) => {
            const isActive = currentView === item.id
            return (
              <NavItem
                key={item.id}
                item={item}
                isActive={isActive}
                isAr={isAr}
                sidebarCollapsed={sidebarCollapsed}
                onClick={() => setView(item.id)}
              />
            )
          })}
        </div>
      </nav>

      {/* ===== LANGUAGE TOGGLE (Desktop only) ===== */}
      <div className="hidden md:block px-2.5 py-1.5 border-t border-ae-black-100 overflow-hidden">
        <button
          onClick={() => useAppStore.getState().setLanguage(isAr ? 'en' : 'ar')}
          className={cn(
            'w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm',
            'text-ae-black-400 hover:text-ae-gold-700 hover:bg-ae-gold-50',
            'transition-colors duration-150 group min-w-0'
          )}
        >
          <Languages className="w-[18px] h-[18px] shrink-0 text-ae-black-300 group-hover:text-ae-gold-500 transition-colors" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap text-[13px] truncate"
              >
                {isAr ? 'English' : 'العربية'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* ===== COLLAPSE TOGGLE (Desktop only) ===== */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'hidden md:flex items-center justify-center h-10 shrink-0',
          'border-t border-ae-black-100',
          'text-ae-black-300 hover:text-ae-gold-600 hover:bg-ae-gold-50/50',
          'transition-colors duration-150'
        )}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* ===== EMPLOYER LOGIN DIALOG ===== */}
      <EmployerLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </motion.aside>
  )
}

// ─── Nav Item Sub-component ─────────────────────────────────────────────────

function NavItem({
  item,
  isActive,
  isAr,
  sidebarCollapsed,
  onClick,
  badgeCount = 0,
}: {
  item: typeof navItems[number]
  isActive: boolean
  isAr: boolean
  sidebarCollapsed: boolean
  onClick: () => void
  badgeCount?: number
}) {
  const Icon = item.icon
  const label = isAr ? item.labelAr : item.label

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center transition-all duration-150 relative group',
        // Desktop
        'md:w-full md:gap-2.5 md:px-3 md:py-[9px] md:rounded-lg md:text-[13px]',
        // Mobile
        'max-md:flex-col max-md:gap-0.5 max-md:px-2 max-md:py-1.5 max-md:rounded-md max-md:text-[9px]',
        // Active state
        isActive
          ? 'md:bg-ae-gold-50 md:text-ae-gold-700 max-md:text-ae-gold-500'
          : 'text-ae-black-400 md:hover:text-ae-black-700 md:hover:bg-ae-black-50 max-md:text-ae-black-400'
      )}
    >
      {/* Icon */}
      <div className="relative">
        <Icon
          className={cn(
            'shrink-0 transition-colors duration-150',
            'md:w-[18px] md:h-[18px] max-md:w-5 max-md:h-5',
            isActive
              ? 'text-ae-gold-600'
              : 'text-ae-black-300 group-hover:text-ae-black-500 max-md:text-ae-black-400'
          )}
        />
        {/* Badge count on icon */}
        {badgeCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-uae-red-500 text-[7px] font-bold text-white px-0.5">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>

      {/* Desktop Label */}
      <div className="hidden md:flex items-center gap-2 min-w-0 overflow-hidden">
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'overflow-hidden whitespace-nowrap block truncate',
                isActive ? 'font-semibold' : 'font-medium'
              )}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
        {/* Badge in label area (desktop only, when expanded) */}
        {!sidebarCollapsed && badgeCount > 0 && (
          <Badge className="text-[8px] px-1 py-0 h-4 min-w-[16px] bg-uae-red-500 text-white shrink-0">
            {badgeCount > 99 ? '99+' : badgeCount}
          </Badge>
        )}
      </div>

      {/* Mobile Label */}
      <span
        className={cn(
          'md:hidden truncate max-w-[52px] text-center leading-tight',
          isActive ? 'font-semibold' : ''
        )}
      >
        {label}
      </span>

      {/* Desktop Collapsed Tooltip */}
      {sidebarCollapsed && (
        <div className="hidden md:block absolute start-full ms-2 px-2.5 py-1.5 bg-ae-black-800 text-white text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
          {label}
          {badgeCount > 0 && (
            <Badge className="ml-1.5 text-[8px] px-1 py-0 h-3 bg-uae-red-500 text-white">{badgeCount}</Badge>
          )}
        </div>
      )}

      {/* Active indicator — desktop left edge */}
      {isActive && (
        <motion.div
          layoutId="sidebar-active-indicator"
          className="hidden md:block absolute start-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-ae-gold-500 rounded-e-full"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}

      {/* Active indicator — mobile top dot */}
      {isActive && (
        <motion.div
          layoutId="mobile-active-indicator"
          className="md:hidden absolute -top-0 w-4 h-[3px] bg-ae-gold-500 rounded-full"
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        />
      )}
    </button>
  )
}
