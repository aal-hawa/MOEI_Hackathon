'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Globe,
  Headphones,
  LayoutDashboard,
  Search,
  MessageCircle,
  Phone,
  Monitor,
  FileText,
  Settings,
  Moon,
  Sun,
  Sparkles,
  BarChart3,
  Users,
  HelpCircle,
  Zap,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useTranslation } from '@/i18n'
import { useTheme } from 'next-themes'

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const navigateTo = useCallback((pageView: string) => {
    useAppStore.getState().setPageView(pageView as any)
    setOpen(false)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('commandPalettePlaceholder') || 'Search commands, navigate, or take action...'} />
      <CommandList>
        <CommandEmpty>{t('noResultsFound') || 'No results found.'}</CommandEmpty>

        <CommandGroup heading={t('navigation') || 'Navigation'}>
          <CommandItem onSelect={() => navigateTo('home')} className="gap-3">
            <Globe className="w-4 h-4" />
            <span>{t('hub') || 'Home'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('customer')} className="gap-3">
            <MessageCircle className="w-4 h-4" />
            <span>{t('customerPortal') || 'Customer Portal'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('admin')} className="gap-3">
            <Headphones className="w-4 h-4" />
            <span>{t('agentDashboard') || 'Agent Dashboard'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('executive')} className="gap-3">
            <LayoutDashboard className="w-4 h-4" />
            <span>{t('executiveDashboard') || 'Executive Dashboard'}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('quickActions') || 'Quick Actions'}>
          <CommandItem onSelect={() => navigateTo('customer')} className="gap-3">
            <Search className="w-4 h-4" />
            <span>{t('smartSearch') || 'AI Smart Search'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('customer')} className="gap-3">
            <FileText className="w-4 h-4" />
            <span>{t('createCase') || 'Create Case'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('customer')} className="gap-3">
            <Phone className="w-4 h-4" />
            <span>{t('reportPowerOutage') || 'Report Power Outage'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('customer')} className="gap-3">
            <Zap className="w-4 h-4" />
            <span>{t('checkRequestStatus') || 'Check Request Status'}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('analytics') || 'Analytics'}>
          <CommandItem onSelect={() => navigateTo('executive')} className="gap-3">
            <BarChart3 className="w-4 h-4" />
            <span>{t('sentimentTrends') || 'Sentiment Trends'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('executive')} className="gap-3">
            <Users className="w-4 h-4" />
            <span>{t('workforcePlanning') || 'Workforce Planning'}</span>
          </CommandItem>
          <CommandItem onSelect={() => navigateTo('executive')} className="gap-3">
            <Sparkles className="w-4 h-4" />
            <span>{t('aiPredictions') || 'AI Predictions'}</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading={t('settings') || 'Settings'}>
          <CommandItem onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark') }} className="gap-3">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? (t('lightMode') || 'Light Mode') : (t('darkMode') || 'Dark Mode')}</span>
          </CommandItem>
          <CommandItem onSelect={() => { useAppStore.getState().setLanguage(useAppStore.getState().language === 'en' ? 'ar' : 'en'); setOpen(false) }} className="gap-3">
            <Globe className="w-4 h-4" />
            <span>{t('switchLang') || 'العربية'}</span>
          </CommandItem>
          <CommandItem className="gap-3">
            <HelpCircle className="w-4 h-4" />
            <span>{t('helpSupport') || 'Help & Support'}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
