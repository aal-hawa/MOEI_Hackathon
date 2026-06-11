'use client'

import { Command } from 'lucide-react'
import ExecutiveDashboard from '@/components/dashboard/executive-dashboard'
import PageShell from '@/components/layout/page-shell'
import { useTranslation } from '@/i18n'
import { useRealtime } from '@/hooks/use-realtime'
import { Button } from '@/components/ui/button'
import { CommandPalette } from '@/components/command-palette'
import { toast } from '@/hooks/use-toast'

export default function ExecutiveDashboardPage() {
  const { t } = useTranslation()
  useRealtime()

  return (
    <PageShell 
      activeRoute="executive"
      rightActions={
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 hidden md:flex"
          title="Command Palette (Ctrl+K)"
          aria-label="Command Palette"
          onClick={() => toast({ title: t('comingSoon') || 'Coming Soon', description: 'Command palette will be available in a future update.' })}
        >
          <Command className="w-4 h-4" />
        </Button>
      }
      mobileMenuActions={
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
          title="Command Palette (Ctrl+K)"
          onClick={() => toast({ title: t('comingSoon') || 'Coming Soon', description: 'Command palette will be available in a future update.' })}
        >
          <Command className="w-4 h-4" />
        </Button>
      }
      overlays={
        <CommandPalette />
      }
    >
      <ExecutiveDashboard />
    </PageShell>
  )
}
