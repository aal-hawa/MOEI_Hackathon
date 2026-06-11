'use client'

import { useAppStore, type ViewType } from '@/lib/store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FilePlus,
  ListFilter,
  FlaskConical,
  Settings,
  ChevronLeft,
  ChevronRight,
  Shield,
  Languages,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const navItems: { id: ViewType; label: string; labelAr: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', labelAr: 'لوحة القيادة', icon: LayoutDashboard },
  { id: 'new-request', label: 'New Request', labelAr: 'طلب جديد', icon: FilePlus },
  { id: 'cases', label: 'Case Management', labelAr: 'إدارة الحالات', icon: ListFilter },
  { id: 'simulation', label: 'Simulation', labelAr: 'محاكاة', icon: FlaskConical },
  { id: 'settings', label: 'Settings', labelAr: 'الإعدادات', icon: Settings },
]

export function Sidebar() {
  const { currentView, setView, sidebarCollapsed, toggleSidebar, language } = useAppStore()
  const isAr = language === 'ar'

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className={cn(
        'fixed start-0 top-0 h-screen bg-white text-[#1B1D21] z-50 flex flex-col',
        'border-e border-[#E1E3E5] shadow-md'
      )}
    >
      {/* Logo Area */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-[#E1E3E5] shrink-0 bg-white">
        <div className="w-10 h-10 rounded-lg bg-[#006352] flex items-center justify-center shrink-0 shadow-sm">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <div className="text-sm font-bold text-[#006352] uppercase tracking-wide">MOEI</div>
              <div className="text-[10px] text-gray-500 leading-tight">
                {isAr ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto custom-scrollbar bg-white">
        {navItems.map((item) => {
          const isActive = currentView === item.id || 
            (item.id === 'cases' && currentView === 'case-detail')
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                'hover:bg-gray-100 group relative',
                isActive
                  ? 'bg-[#006352]/10 text-[#006352] shadow-sm'
                  : 'text-gray-600 hover:text-[#006352]'
              )}
            >
              <Icon className={cn('w-5 h-5 shrink-0 transition-colors', isActive ? 'text-[#006352]' : 'text-gray-400 group-hover:text-[#006352]')} />
              <AnimatePresence>
                {!sidebarCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {isAr ? item.labelAr : item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {sidebarCollapsed && (
                <div className="absolute start-full ms-2 px-2 py-1 bg-[#1B1D21] text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg border border-[#3E4046]">
                  {isAr ? item.labelAr : item.label}
                </div>
              )}
              {isActive && (
                <div className="absolute start-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#006352] rounded-e-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Language Toggle */}
      <div className="px-2 py-2 border-t border-[#E1E3E5] bg-white">
        <button
          onClick={() => useAppStore.getState().setLanguage(isAr ? 'en' : 'ar')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:text-[#006352] hover:bg-gray-100 transition-colors"
        >
          <Languages className="w-5 h-5 shrink-0 text-gray-400" />
          <AnimatePresence>
            {!sidebarCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="overflow-hidden whitespace-nowrap"
              >
                {isAr ? 'English' : 'العربية'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-[#E1E3E5] bg-gray-50 text-gray-400 hover:text-[#006352] hover:bg-gray-100 transition-colors"
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  )
}
