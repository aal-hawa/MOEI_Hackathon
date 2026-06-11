'use client'

import React, { useSyncExternalStore, useState, ReactNode, useRef, useEffect } from 'react'
import {
  Globe, Menu, Moon, Sun, Shield, Phone, Fingerprint, Home,
  ChevronDown, MessageSquare, Mail, Building2, LayoutDashboard,
  BarChart4, User, LogOut, Minus, Plus, Eye, Search,
  Facebook, Twitter, Instagram, Youtube, Linkedin, Send, ExternalLink, MapPin,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useAppStore, Language, LANGUAGE_LABELS, RTL_LANGUAGES } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const emptySubscribe = () => () => {}

export interface NavItem {
  pageView?: string
  href?: string
  label: string
  icon?: React.ElementType
  id: string
  group?: 'main' | 'communications' | 'departments'
}

interface PageShellProps {
  children: ReactNode
  activeRoute: string
  navItems?: NavItem[]
  rightActions?: ReactNode
  mobileMenuActions?: ReactNode
  overlays?: ReactNode
}

// Default navigation items organized by group
const defaultNavItems: NavItem[] = [
  { id: 'home', pageView: 'home', label: 'Home', icon: Home, group: 'main' },
  { id: 'customer', pageView: 'customer', label: 'Customer Portal', icon: LayoutDashboard, group: 'main' },
  { id: 'admin', pageView: 'admin', label: 'Agent Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'executive', pageView: 'executive', label: 'Executive Dashboard', icon: BarChart4, group: 'main' },
  { id: 'departments', pageView: 'departments', label: 'Departments', icon: Building2, group: 'departments' },
  { id: 'whatsapp', pageView: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, group: 'communications' },
  { id: 'email', pageView: 'email', label: 'Email', icon: Mail, group: 'communications' },
  { id: 'voice-call', pageView: 'voice-call', label: 'Voice Call', icon: Phone, group: 'communications' },
]

export default function PageShell({
  children,
  activeRoute,
  navItems = [],
  rightActions,
  mobileMenuActions,
  overlays,
}: PageShellProps) {
  const { language, setLanguage, setPageView } = useAppStore()
  const { t, isRTL } = useTranslation()
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const [fontSize, setFontSize] = useState(100)
  const [highContrast, setHighContrast] = useState(false)
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const langMenuRef = useRef<HTMLDivElement>(null)

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}%`
  }, [fontSize])

  // Apply high contrast
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast)
  }, [highContrast])

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const items: NavItem[] = navItems.length > 0 ? navItems : defaultNavItems.map(item => ({
    ...item,
    label: t(item.id as any) || item.label,
  }))

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

  const handleSubscribe = () => {
    if (email) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  return (
    <div className={cn('min-h-screen flex flex-col bg-background', isRTL ? 'font-arabic' : '')} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* ── UAE Government Top Bar ── */}
      <div className="bg-[#1A1A1A] text-white">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-8">
          <div className="flex items-center gap-3 text-[11px] text-white/70">
            <span>UAE Government</span>
            <span className="text-white/30">|</span>
            <a href="https://u.ae" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">u.ae</a>
          </div>
          <div className="flex items-center gap-1">
            {/* Accessibility Controls */}
            <div className="hidden md:flex items-center gap-0.5 text-white/70 border-e border-white/20 pe-2 me-2">
              <button onClick={() => setFontSize(Math.max(80, fontSize - 10))} className="p-1 hover:text-white transition-colors" aria-label="Decrease font size">
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-[10px] min-w-[28px] text-center">{fontSize}%</span>
              <button onClick={() => setFontSize(Math.min(130, fontSize + 10))} className="p-1 hover:text-white transition-colors" aria-label="Increase font size">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => setHighContrast(!highContrast)} className={cn('p-1 transition-colors', highContrast ? 'text-yellow-400' : 'hover:text-white')} aria-label="Toggle high contrast">
                <Eye className="w-3 h-3" />
              </button>
            </div>
            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="flex items-center justify-center w-7 h-7 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {mounted && (theme === 'dark' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />)}
            </button>
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
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3" dir="ltr">
              <a onClick={() => handleNav({ pageView: 'home', label: '', id: 'home' })} className="cursor-pointer">
                <img src="/uae_moei_ar.png" alt="Ministry of Energy & Infrastructure" className="h-9 sm:h-10 md:h-11 w-auto" />
              </a>
              <div className="w-px h-8 bg-[#E1E3E5] hidden lg:block" />
              <img src="/global-star.png" alt="Global Star Rating System for Services" className="h-7 sm:h-8 lg:h-9 w-auto hidden lg:block" />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-9 w-9 text-[#4B4F58] hover:text-[#92722A] rounded-full lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </Button>
              {rightActions}
            </div>
          </div>
        </div>

        {/* Gold Accent Line */}
        <div className="h-[2px] bg-gradient-to-r from-[#C4A35A] via-[#92722A] to-[#C4A35A]" />

        {/* Navigation Bar */}
        <div className="bg-white border-b border-[#E1E3E5]">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-10 gap-0">
              <nav className="hidden lg:flex items-center h-10 gap-0">
                {mainItems.map((item) => {
                  const isActive = isItemActive(item)
                  const Icon = item.icon
                  return (
                    <button key={item.id} onClick={() => handleNav(item)}
                      className={cn('h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                        isActive ? 'text-[#92722A] border-[#92722A]' : 'text-[#3E4046] border-transparent hover:text-[#92722A] hover:border-[#92722A]/50')}>
                      {Icon && <Icon className="w-3.5 h-3.5" />}
                      {item.label}
                    </button>
                  )
                })}
                {deptItems.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-[#E1E3E5] mx-1" />
                    {deptItems.map((item) => {
                      const isActive = isItemActive(item)
                      const Icon = item.icon
                      return (
                        <button key={item.id} onClick={() => handleNav(item)}
                          className={cn('h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                            isActive ? 'text-[#006352] border-[#006352]' : 'text-[#3E4046] border-transparent hover:text-[#006352] hover:border-[#006352]/50')}>
                          {Icon && <Icon className="w-3.5 h-3.5" />}
                          {item.label}
                        </button>
                      )
                    })}
                  </>
                )}
                {commItems.length > 0 && (
                  <>
                    <div className="w-px h-5 bg-[#E1E3E5] mx-1" />
                    {commItems.map((item) => {
                      const isActive = isItemActive(item)
                      const Icon = item.icon
                      return (
                        <button key={item.id} onClick={() => handleNav(item)}
                          className={cn('h-10 px-3 text-[13px] font-semibold transition-colors border-b-2 whitespace-nowrap flex items-center gap-1.5',
                            isActive ? 'text-[#92722A] border-[#92722A]' : 'text-[#3E4046] border-transparent hover:text-[#92722A] hover:border-[#92722A]/50')}>
                          {Icon && <Icon className="w-3.5 h-3.5" />}
                          {item.label}
                        </button>
                      )
                    })}
                  </>
                )}
              </nav>
              <div className="lg:hidden flex-1 text-center">
                <span className="text-sm font-bold text-[#92722A]">
                  {items.find(i => i.id === activeRoute)?.label || t('home')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side={isRTL ? 'left' : 'right'} className="bg-white text-[#1A1A1A] border-[#E1E3E5] w-72 p-0">
          <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#E1E3E5]" dir="ltr">
            <img src="/uae_moei_ar.png" alt="MOEI Logo" className="h-8 w-auto" />
          </div>
          <div className="overflow-y-auto max-h-[calc(100dvh-8rem)]">
            {mainItems.length > 0 && (
              <div className="py-2">
                <div className="px-4 py-1.5"><span className="text-[10px] font-bold text-[#92722A] uppercase tracking-wider">{isRTL ? 'الرئيسية' : 'Navigation'}</span></div>
                {mainItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button key={item.id} onClick={() => handleNav(item)}
                      className={cn('w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive ? 'text-[#92722A] bg-[#92722A]/8' : 'text-[#3E4046] hover:text-[#92722A] hover:bg-[#92722A]/5')}>
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}
            {deptItems.length > 0 && (
              <div className="py-2 border-t border-[#E1E3E5]">
                <div className="px-4 py-1.5"><span className="text-[10px] font-bold text-[#006352] uppercase tracking-wider">{isRTL ? 'الإدارات' : 'Departments'}</span></div>
                {deptItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button key={item.id} onClick={() => handleNav(item)}
                      className={cn('w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive ? 'text-[#006352] bg-[#006352]/8' : 'text-[#3E4046] hover:text-[#006352] hover:bg-[#006352]/5')}>
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}
            {commItems.length > 0 && (
              <div className="py-2 border-t border-[#E1E3E5]">
                <div className="px-4 py-1.5"><span className="text-[10px] font-bold text-[#92722A] uppercase tracking-wider">{isRTL ? 'التواصل' : 'Communications'}</span></div>
                {commItems.map((item) => {
                  const isActive = isItemActive(item)
                  return (
                    <button key={item.id} onClick={() => handleNav(item)}
                      className={cn('w-full text-start px-4 py-2.5 text-sm font-semibold flex items-center gap-3 transition-colors',
                        isActive ? 'text-[#92722A] bg-[#92722A]/8' : 'text-[#3E4046] hover:text-[#92722A] hover:bg-[#92722A]/5')}>
                      {item.icon && <item.icon className="w-4 h-4" />}
                      {item.label}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="py-2 border-t border-[#E1E3E5]">
              <div className="flex items-center gap-2 px-4">
                {mobileMenuActions}
                <button onClick={() => { setLanguage(isRTL ? 'en' : 'ar'); setMobileMenuOpen(false) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#4B4F58] hover:text-[#92722A] hover:bg-[#92722A]/8 transition-colors text-xs font-semibold">
                  <Globe className="w-3.5 h-3.5" />
                  {isRTL ? 'English' : 'العربية'}
                </button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Page Overlays */}
      {overlays}

      {/* ── Footer — Redesigned to match UAE DLS / MOEI website ── */}
      <footer className="shrink-0 mt-auto bg-white">
        {/* Gold accent line */}
        <div className="h-[3px] bg-gradient-to-r from-[#C4A35A] via-[#92722A] to-[#C4A35A]" />

        {/* Main footer content */}
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
            {/* Ministry Info */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/uae_moei_ar.png" alt="MOEI Logo" className="h-10 w-auto" />
              </div>
              <p className="text-xs text-[#5C5C5C] leading-relaxed mb-4 max-w-xs">
                {isRTL
                  ? 'وزارة الطاقة والبنية التحتية - منصة الذكاء الاصطناعي الموحدة للتواصل مع العملاء عبر جميع القنوات'
                  : 'Ministry of Energy & Infrastructure — Unified AI-powered customer engagement platform delivering seamless service across all channels.'}
              </p>
              <div>
                <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-2">{isRTL ? 'تابعنا' : 'Follow Us'}</h4>
                <div className="flex items-center gap-2">
                  {[Facebook, Twitter, Instagram, Youtube, Linkedin].map((Icon, i) => (
                    <button key={i} className="w-8 h-8 rounded-full bg-[#F5F5F5] hover:bg-[#92722A]/10 flex items-center justify-center text-[#5C5C5C] hover:text-[#92722A] transition-colors">
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">{isRTL ? 'روابط سريعة' : 'Quick Links'}</h4>
              <ul className="space-y-2.5">
                {[
                  { label: isRTL ? 'عن الوزارة' : 'About MOEI', href: 'https://www.moei.gov.ae/en/about-us' },
                  { label: isRTL ? 'الخدمات الإلكترونية' : 'E-Services', href: 'https://www.moei.gov.ae/en/services' },
                  { label: isRTL ? 'المركز الإعلامي' : 'Media Center', href: 'https://www.moei.gov.ae/en/media-center' },
                  { label: isRTL ? 'الشروط والأحكام' : 'Terms & Conditions', href: '#' },
                  { label: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy', href: '#' },
                  { label: isRTL ? 'اتصل بنا' : 'Contact Us', href: '#' },
                ].map((link) => (
                  <li key={link.label}>
                    <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-xs text-[#5C5C5C] hover:text-[#92722A] transition-colors inline-flex items-center gap-1 group">
                      {link.label}
                      <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">{isRTL ? 'اتصل بنا' : 'Contact Us'}</h4>
              <ul className="space-y-3">
                <li className="flex items-start gap-2.5 text-xs text-[#5C5C5C]">
                  <Phone className="w-3.5 h-3.5 text-[#92722A] shrink-0 mt-0.5" />
                  <div><span className="font-semibold text-[#1A1A1A]">800-MOEI</span> <span className="text-[#5C5C5C]">(800-6634)</span><br /><span className="text-[10px] text-[#92722A]">{isRTL ? 'مجاني' : 'Toll-Free'}</span></div>
                </li>
                <li className="flex items-center gap-2.5 text-xs text-[#5C5C5C]">
                  <Mail className="w-3.5 h-3.5 text-[#92722A] shrink-0" />
                  <a href="mailto:info@moei.gov.ae" className="hover:text-[#92722A] transition-colors">info@moei.gov.ae</a>
                </li>
                <li className="flex items-start gap-2.5 text-xs text-[#5C5C5C]">
                  <MapPin className="w-3.5 h-3.5 text-[#92722A] shrink-0 mt-0.5" />
                  <span>{isRTL ? 'أبوظبي، الإمارات العربية المتحدة' : 'Abu Dhabi, United Arab Emirates'}</span>
                </li>
              </ul>
            </div>

            {/* Newsletter */}
            <div>
              <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">{isRTL ? 'ابقَ على اطلاع' : 'Stay Updated'}</h4>
              <p className="text-xs text-[#5C5C5C] mb-3">{isRTL ? 'احصل على أحدث تحديثات خدمات الوزارة' : 'Get the latest MOEI service updates'}</p>
              <div className="flex gap-1.5">
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={isRTL ? 'أدخل بريدك الإلكتروني' : 'Enter your email'} className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#E1E3E5] rounded-lg focus:outline-none focus:border-[#92722A] focus:ring-1 focus:ring-[#92722A]/20" dir="ltr" />
                <button onClick={handleSubscribe} className="px-3 py-2 bg-[#92722A] text-white rounded-lg hover:bg-[#7D6324] transition-colors shrink-0" aria-label="Subscribe"><Send className="w-3.5 h-3.5" /></button>
              </div>
              {subscribed && <p className="text-[10px] text-[#006352] font-medium mt-1.5">{isRTL ? 'شكراً لاشتراكك!' : 'Thank you for subscribing!'}</p>}
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#E1E3E5]">
                <img src="/global-star.png" alt="UAE Star Rating" className="h-8 w-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="bg-[#1A1A1A] text-white">
          <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] text-white/70">
              <Shield className="w-3 h-3 text-[#C4A35A] shrink-0" />
              <span>{t('uaeGovernmentSeal')}</span>
              <span className="text-white/30">|</span>
              <span>© {new Date().getFullYear()} {isRTL ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-white/70">
              <span>{t('footerRights')}</span>
              <span className="text-white/30">|</span>
              <div className="flex items-center gap-1">
                <Fingerprint className="w-3 h-3 text-[#C4A35A]" />
                <span>{isRTL ? 'مدعوم من UAE PASS' : 'Powered by UAE PASS'}</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
