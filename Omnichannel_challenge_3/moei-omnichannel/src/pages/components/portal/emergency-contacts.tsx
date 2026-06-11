'use client'

import { motion } from 'framer-motion'
import { Phone, Zap, Shield, PhoneCall, Clock, MessageSquare, AlertTriangle } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface EmergencyContact {
  id: string
  number: string
  titleKey: string
  descKey: string
  icon: React.ElementType
  accentColor: string
  bgColor: string
  iconColor: string
}

// Real MOEI emergency contact numbers
const EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: 'emergency',
    number: '171',
    titleKey: 'moeiEmergency',
    descKey: 'moeiEmergencyDesc',
    icon: AlertTriangle,
    accentColor: 'border-l-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/20',
    iconColor: 'text-red-600',
  },
  {
    id: 'tollfree',
    number: '800 6634',
    titleKey: 'moeiTollFree',
    descKey: 'moeiTollFreeDesc',
    icon: Phone,
    accentColor: 'border-l-[#92722A]',
    bgColor: 'bg-[#92722A]/5 dark:bg-[#92722A]/10',
    iconColor: 'text-[#92722A]',
  },
  {
    id: 'whatsapp',
    number: '800 6634',
    titleKey: 'moeiWhatsApp',
    descKey: 'moeiWhatsAppDesc',
    icon: MessageSquare,
    accentColor: 'border-l-[#25D366]',
    bgColor: 'bg-[#25D366]/5 dark:bg-[#25D366]/10',
    iconColor: 'text-[#25D366]',
  },
  {
    id: 'electricity',
    number: '997',
    titleKey: 'electricityEmergency',
    descKey: 'electricityEmergencyDesc',
    icon: Zap,
    accentColor: 'border-l-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/20',
    iconColor: 'text-amber-600',
  },
]

export default function EmergencyContacts() {
  const { t } = useTranslation()

  return (
    <Card className="border-0 shadow-md overflow-hidden">
      {/* MOEI gold gradient top border */}
      <div className="h-1.5 bg-gradient-to-r from-[#92722A] via-[#B68A35] to-[#92722A]" />

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#92722A]/10 dark:bg-[#92722A]/20 flex items-center justify-center">
            <PhoneCall className="w-5 h-5 text-[#92722A]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{t('emergencyTitle')}</h2>
            <p className="text-sm text-muted-foreground">{t('emergencyDesc')}</p>
          </div>
        </div>

        {/* Emergency contacts grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {EMERGENCY_CONTACTS.map((contact, i) => {
            const Icon = contact.icon

            return (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className={`relative rounded-xl border-l-4 ${contact.accentColor} ${contact.bgColor} p-4 hover:shadow-sm transition-all duration-200`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg bg-white/80 dark:bg-background/50 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4.5 h-4.5 ${contact.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-0.5">
                      {t(contact.titleKey as Parameters<typeof t>[0])}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      {t(contact.descKey as Parameters<typeof t>[0])}
                    </p>
                    {/* Phone number */}
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold tracking-wide ${contact.iconColor}`}>
                        {contact.number}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Call Now button */}
                <Button
                  variant="outline"
                  size="sm"
                  className={`mt-3 w-full h-8 text-xs gap-1.5 ${contact.iconColor} border-current/20 hover:bg-white/60 dark:hover:bg-background/40`}
                  onClick={() => {
                    window.open(`tel:${contact.number.replace(/\s/g, '')}`, '_self')
                  }}
                >
                  <Phone className="w-3.5 h-3.5" />
                  {t('callNow')}
                </Button>
              </motion.div>
            )
          })}
        </div>

        {/* Operating hours */}
        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50 border border-border/50">
          <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <p className="text-xs text-muted-foreground">{t('operatingHours')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
