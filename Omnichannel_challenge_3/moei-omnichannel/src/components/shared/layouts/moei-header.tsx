// MOEI Header - Redesigned to match UAE Design Language System (DLS)
// Follows the UAE Government design system guidelines from designsystem.gov.ae
// Structure: UAE Bar → Main Header → Navigation Bar

import {
  Globe,
  Fingerprint,
  Home,
  Search,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  MessageSquare,
  Phone,
  Mail,
  Building2,
  LayoutDashboard,
  BarChart4,
  Accessibility,
  Minus,
  Plus,
  Eye,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore, Language, LANGUAGE_LABELS, RTL_LANGUAGES } from '@/store/app-store'
import { t as tSync } from '@/pages/i18n'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import React, { useState, useSyncExternalStore, useRef, useEffect, Fragment } from 'react'

export interface NavItem {
  pageView?: string
  href?: string
  label: string
  icon?: React.ElementType
  id: string
  group?: 'main' | 'communications' | 'departments'
}

export interface MoeiHeaderProps {
  title: { en: string; ar: string }
  onBack?: () => void
  showUaePass?: boolean
  uaePassUser?: { name: string } | null
  onUaePassClick?: () => void
  onLogout?: () => void
  actions?: React.ReactNode
  navItems?: NavItem[]
  activeRoute?: string
}

const emptySubscribe = () => () => {}

// Default navigation items organized by group (Task 8: separate communications from dashboards)
const defaultNavItems: NavItem[] = [
  // Main group
  { id: 'home', pageView: 'home', label: 'Home', icon: Home, group: 'main' },
  { id: 'customer', pageView: 'customer', label: 'Customer Portal', icon: LayoutDashboard, group: 'main' },
  { id: 'admin', pageView: 'admin', label: 'Agent Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'executive', pageView: 'executive', label: 'Executive Dashboard', icon: BarChart4, group: 'main' },
  // Departments group
  { id: 'departments', pageView: 'departments', label: 'Departments', icon: Building2, group: 'departments' },
  // Communications group
  { id: 'whatsapp', pageView: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, group: 'communications' },
  { id: 'email', pageView: 'email', label: 'Email', icon: Mail, group: 'communications' },
  { id: 'voice-call', pageView: 'voice-call', label: 'Voice Call', icon: Phone, group: 'communications' },
]

export function MoeiHeader({
  title,
  onBack,
  showUaePass = true,
  uaePassUser,
  onUaePassClick,
  onLogout,
  actions,
  navItems = [],
  activeRoute,
}: MoeiHeaderProps) {
  const { language, setLanguage, setPageView } = useAppStore()
  const isRTL = RTL_LANGUAGES.includes(language)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [fontSize, setFontSize] = useState(100) // percentage
  const [highContrast, setHighContrast] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`
  }, [fontSize])

  // Apply high contrast
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast)
  }, [highContrast])

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const items: NavItem[] = navItems.length > 0 ? navItems : defaultNavItems.map(item => ({
    ...item,
    label: tSync(item.id as any, language) || item.label,
  }))

  // Group items by category
  const mainItems = items.filter(i => i.group === 'main' || !i.group)
  const commItems = items.filter(i => i.group === 'communications')
  const deptItems = items.filter(i => i.group === 'departments')

  const handleNav = (item: NavItem) => {
    if (item.pageView) {
      setPageView(item.pageView as any)
    }
    setMobileMenuOpen(false)
  }

  const isItemActive = (item: NavItem) => activeRoute === item.id

  // MOEI / UAE DLS color scheme
  const goldPrimary = '#92722A'
  const goldLight = '#B68A35'
  const greenPrimary = '#006352'
  const darkText = '#1A1A1A'
  const mutedText = '#5C5C5C'

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      {/* ── UAE Government Top Bar ── */}
      <div className="bg-[#1A1A1A] text-white">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-8">
          <div className="flex items-center gap-3 text-[11px] text-white/70">
            <span>UAE Government</span>
            <span className="text-white/30">|</span>
            <a href="https://u.ae" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              u.ae
            </a>
          </div>
          <div className="flex items-center gap-1">
            {/* Accessibility Controls */}
            <div className="hidden md:flex items-center gap-0.5 text-white/70 border-e border-white/20 pe-2 me-2">
              <button
                onClick={() => setFontSize(Math.max(80, fontSize - 10))}
                className="p-1 hover:text-white transition-colors"
                aria-label="Decrease font size"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] min-w-[28px] text-center">{fontSize}%</span>
              <button
                onClick={() => setFontSize(Math.min(130, fontSize + 10))}
                className="p-1 hover:text-white transition-colors"
                aria-label="Increase font size"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                onClick={() => setHighContrast(!highContrast)}
                className={cn('p-1 transition-colors', highContrast ? 'text-yellow-400' : 'hover:text-white')}
                aria-label="Toggle high contrast"
              >
                <Eye className="w-3 h-3" />
              </button>
            </div>

            {/* Language Selector */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-white/90 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Globe className="w-3 h-3" />
                <span>{LANGUAGE_LABELS[language]?.native || 'English'}</span>
                <ChevronDown className={cn('w-2.5 h-2.5 transition-transform', langMenuOpen && 'rotate-180')} />
              </button>
              {langMenuOpen && (
                <div className={cn(
                  'absolute top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1 animate-in fade-in-0 zoom-in-95',
                  isRTL ? 'left-0' : 'right-0'
                )}>
                  <div className="px-3 py-1.5 border-b border-gray-100">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Official Languages</span>
                  </div>
                  {(['en', 'ar'] as Language[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setLangMenuOpen(false) }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-xs transition-colors',
                        language === lang ? 'bg-[#92722A]/8 text-[#92722A] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <span>{LANGUAGE_LABELS[lang]?.native}</span>
                      <span className="text-gray-400">{LANGUAGE_LABELS[lang]?.english}</span>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 border-b border-t border-gray-100 mt-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Other Languages</span>
                  </div>
                  {(['fr', 'pt', 'es', 'ur', 'hi', 'zh'] as Language[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => { setLanguage(lang); setLangMenuOpen(false) }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-xs transition-colors',
                        language === lang ? 'bg-[#92722A]/8 text-[#92722A] font-semibold' : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      <span>{LANGUAGE_LABELS[lang]?.native}</span>
                      <span className="text-gray-400">{LANGUAGE_LABELS[lang]?.english}</span>
                    </button>
                  ))}
                  <div className="px-3 py-1.5 border-t border-gray-100">
                    <span className="text-[9px] text-gray-400 italic">Other languages use automated translation</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Header: Logo + Controls ── */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          {/* MOEI Logo + Star Rating */}
          <div className="flex items-center gap-3" dir="ltr">
            <a onClick={() => handleNav({ pageView: 'home', label: '', id: 'home' })} className="cursor-pointer">
              <img
                src="/uae_moei_ar.png"
                alt="Ministry of Energy & Infrastructure"
                className="h-9 sm:h-10 md:h-11 w-auto"
              />
            </a>
            <div className="w-px h-8 bg-[#E1E3E5] hidden lg:block" />
            <img
              src="/global-star.png"
              alt="Global Star Rating System for Services"
              className="h-7 sm:h-8 lg:h-9 w-auto hidden lg:block"
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[#4B4F58] hover:text-[#92722A] rounded-full lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </Button>

            {/* Search */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-[#4B4F58] hover:text-[#92722A] rounded-full hidden lg:flex"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </Button>

            {/* Custom Actions */}
            {actions}

            {/* UAE PASS Login / User Menu */}
            {showUaePass && (
              <>
                {uaePassUser ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 bg-[#006352] text-white rounded-lg px-3 py-1.5 hover:bg-[#006352]/90 transition-colors"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span className="text-xs font-medium hidden sm:inline max-w-[140px] truncate">
                        {uaePassUser.name}
                      </span>
                      <ChevronDown className={cn('w-3 h-3 transition-transform', userMenuOpen && 'rotate-180')} />
                    </button>
                    {userMenuOpen && (
                      <div className={cn(
                        'absolute top-full mt-1 w-56 bg-white rounded-xl shadow-lg border border-[#E1E3E5] z-50 py-1.5 animate-in fade-in-0 zoom-in-95',
                        isRTL ? 'left-0' : 'right-0'
                      )}>
                        <div className="px-3 py-2 border-b border-[#E1E3E5]">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#006352]/10 flex items-center justify-center">
                              <User className="w-4 h-4 text-[#006352]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#1A1A1A] truncate">{uaePassUser.name}</p>
                              <p className="text-[10px] text-[#006352] font-medium">UAE PASS Verified</p>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => { setUserMenuOpen(false); onLogout?.() }}
                          className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-[#DC2626] hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="w-4 h-4" />
                          {tSync('logout', language) || 'Logout'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={onUaePassClick}
                    className="bg-[#006352] text-white hover:bg-[#006352]/90 font-medium text-xs px-4 rounded-lg flex items-center gap-1.5 transition-all hidden lg:flex"
                  >
                    <Fingerprint className="w-3.5 h-3.5" />
                    <span>{tSync('loginToAccess', language) || 'Login with UAE PASS'}</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Gold Accent Line ── */}
      <div className="h-[2px] bg-gradient-to-r from-[#C4A35A] via-[#92722A] to-[#C4A35A]" />

      {/* ── Navigation Bar ── */}
      <div className="bg-white border-b border-[#E1E3E5]">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-10 gap-0">
            {/* Desktop Navigation - Grouped */}
            <nav className="hidden lg:flex items-center h-10 gap-0">
              {/* Main Navigation */}
              {mainItems.map((item) => {
                const isActive = isItemActive(item)
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNav(item)}
                    className={cn(
                      'h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                      isActive
                        ? 'text-[#92722A] border-[#92722A]'
                        : 'text-[#3E4046] border-transparent hover:text-[#92722A] hover:border-[#92722A]/50'
                    )}
                  >
                    {Icon && <Icon className="w-3.5 h-3.5" />}
                    {item.label}
                  </button>
                )
              })}

              {/* Departments Divider + Items */}
              {deptItems.length > 0 && (
                <>
                  <div className="w-px h-5 bg-[#E1E3E5] mx-1" />
                  {deptItems.map((item) => {
                    const isActive = isItemActive(item)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item)}
                        className={cn(
                          'h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                          isActive
                            ? 'text-[#006352] border-[#006352]'
                            : 'text-[#3E4046] border-transparent hover:text-[#006352] hover:border-[#006352]/50'
                        )}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {item.label}
                      </button>
                    )
                  })}
                </>
              )}

              {/* Communications Divider + Items */}
              {commItems.length > 0 && (
                <>
                  <div className="w-px h-5 bg-[#E1E3E5] mx-1" />
                  {commItems.map((item) => {
                    const isActive = isItemActive(item)
                    const Icon = item.icon
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item)}
                        className={cn(
                          'h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                          isActive
                            ? 'text-[#92722A] border-[#92722A]'
                            : 'text-[#3E4046] border-transparent hover:text-[#92722A] hover:border-[#92722A]/50'
                        )}
                      >
                        {Icon && <Icon className="w-3.5 h-3.5" />}
                        {item.label}
                      </button>
                    )
                  })}
                </>
              )}
            </nav>

            {/* Mobile: show current page name */}
            <div className="lg:hidden flex-1 text-center">
              <span className="text-sm font-bold text-[#92722A]">
                {items.find(i => i.id === activeRoute)?.label || tSync('home', language)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile Navigation Sheet ── */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side={isRTL ? 'left' : 'right'} className="bg-white text-[#1A1A1A] border-[#E1E3E5] w-72 p-0">
          <SheetTitle className="sr-only">{tSync('menu', language) || 'Menu'}</SheetTitle>
          {/* Mobile Logo */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E1E3E5]" dir="ltr">
            <img src="/uae_moei_ar.png" alt="MOEI Logo" className="h-8 w-auto" />
          </div>
          <div className="overflow-y-auto max-h-[calc(100dvh-8rem)]">
            {/* Main Section */}
            {mainItems.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-bold text-[#92722A] uppercase tracking-wider">
                    {language === 'ar' ? 'الرئيسية' : 'Navigation'}
                  </span>
                </div>
                {mainItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item)}
                      className={cn(
                        'w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive
                          ? 'text-[#92722A] bg-[#92722A]/8'
                          : 'text-[#3E4046] hover:text-[#92722A] hover:bg-[#92722A]/5'
                      )}
                    >
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Departments Section */}
            {deptItems.length > 0 && (
              <div className="py-2 border-t border-[#E1E3E5]">
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-bold text-[#006352] uppercase tracking-wider">
                    {language === 'ar' ? 'الإدارات' : 'Departments'}
                  </span>
                </div>
                {deptItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item)}
                      className={cn(
                        'w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive
                          ? 'text-[#006352] bg-[#006352]/8'
                          : 'text-[#3E4046] hover:text-[#006352] hover:bg-[#006352]/5'
                      )}
                    >
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Communications Section */}
            {commItems.length > 0 && (
              <div className="py-2 border-t border-[#E1E3E5]">
                <div className="px-4 py-1.5">
                  <span className="text-[10px] font-bold text-[#92722A] uppercase tracking-wider">
                    {language === 'ar' ? 'التواصل' : 'Communications'}
                  </span>
                </div>
                {commItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item)}
                      className={cn(
                        'w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive
                          ? 'text-[#92722A] bg-[#92722A]/8'
                          : 'text-[#3E4046] hover:text-[#92722A] hover:bg-[#92722A]/5'
                      )}
                    >
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Mobile UAE PASS */}
            {showUaePass && (
              <div className="py-2 border-t border-[#E1E3E5]">
                {uaePassUser ? (
                  <>
                    <div className="flex items-center gap-2.5 px-4 py-2">
                      <div className="w-8 h-8 rounded-full bg-[#006352]/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-[#006352]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1A1A1A] truncate">{uaePassUser.name}</p>
                        <p className="text-[10px] text-[#006352] font-medium">UAE PASS Verified</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { onLogout?.(); setMobileMenuOpen(false) }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#DC2626] hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      {tSync('logout', language) || 'Logout'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { onUaePassClick?.(); setMobileMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#006352] hover:bg-[#006352]/5 transition-colors"
                  >
                    <Fingerprint className="w-4 h-4" />
                    {tSync('loginToAccess', language) || 'Login with UAE PASS'}
                  </button>
                )}
              </div>
            )}

            {/* Mobile Language Quick Toggle */}
            <div className="py-2 border-t border-[#E1E3E5]">
              <button
                onClick={() => { setLanguage(language === 'ar' ? 'en' : 'ar'); setMobileMenuOpen(false) }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#3E4046] hover:text-[#92722A] hover:bg-[#92722A]/5 transition-colors"
              >
                <Globe className="w-4 h-4" />
                {language === 'ar' ? 'English' : 'العربية'}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
