'use client'

import { useAppStore } from '@/lib/store'
import { Bell, Search, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const viewTitles: Record<string, { en: string; ar: string }> = {
  dashboard: { en: 'Dashboard', ar: 'لوحة القيادة' },
  'new-request': { en: 'New Rescheduling Request', ar: 'طلب إعادة جدولة جديد' },
  cases: { en: 'Case Management', ar: 'إدارة الحالات' },
  'case-detail': { en: 'Case Details', ar: 'تفاصيل الحالة' },
  simulation: { en: 'Scenario Simulation', ar: 'محاكاة السيناريو' },
  settings: { en: 'Settings', ar: 'الإعدادات' },
}

export function Header() {
  const { currentView, language, sidebarCollapsed } = useAppStore()
  const isAr = language === 'ar'
  const title = viewTitles[currentView] || { en: 'Dashboard', ar: 'لوحة القيادة' }

  return (
    <header
      className="sticky top-0 z-40 h-16 bg-[#006352] border-b border-[#004D40] flex items-center justify-between px-6 shadow-sm"
      style={{ marginLeft: sidebarCollapsed ? 72 : 260, transition: 'margin-left 0.3s ease' }}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-white tracking-tight">
          {isAr ? title.ar : title.en}
        </h1>
        <div className="hidden md:flex items-center text-xs gap-1.5">
          <span className="text-[#C6A87C] font-bold">MOEI</span>
          <span className="text-white/50">/</span>
          <span className="text-white/80">{isAr ? title.ar : title.en}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="hidden md:flex relative">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            placeholder={isAr ? 'بحث...' : 'Search cases...'}
            className="ps-9 w-64 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 focus:border-[#C6A87C] focus:ring-[#C6A87C]/30 transition-all"
          />
        </div>

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-9 w-9 hover:bg-white/10 transition-colors">
              <Bell className="w-4 h-4 text-white" />
              <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-[#E04E48] text-white border-0 shadow-sm">
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <span className="text-sm font-medium">New request submitted</span>
              <span className="text-xs text-muted-foreground">2 minutes ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <span className="text-sm font-medium">High-risk case escalated</span>
              <span className="text-xs text-muted-foreground">15 minutes ago</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 cursor-pointer">
              <span className="text-sm font-medium">Assessment completed</span>
              <span className="text-xs text-muted-foreground">1 hour ago</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-white hover:bg-gray-100 transition-colors shadow-sm">
              <User className="w-4 h-4 text-[#006352]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b">
              <p className="text-sm font-semibold">Finance Officer</p>
              <p className="text-xs text-muted-foreground">Finance & Collection Dept.</p>
            </div>
            <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Preferences</DropdownMenuItem>
            <DropdownMenuItem className="text-[#E04E48] cursor-pointer font-medium">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
