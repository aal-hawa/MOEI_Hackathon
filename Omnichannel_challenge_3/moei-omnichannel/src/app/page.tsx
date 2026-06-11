'use client'

import { useAppStore } from '@/store/app-store'
import LandingPage from '@/views/Home'
import Customer from '@/views/Customer'
import Admin from '@/views/Admin'
import Executive from '@/views/Executive'
import VoiceCall from '@/views/VoiceCall'
import WhatsApp from '@/views/WhatsApp'
import EmailPortal from '@/views/EmailPortal'
import Departments from '@/views/Departments'

export default function AppShell() {
  const pageView = useAppStore((s) => s.pageView)

  switch (pageView) {
    case 'customer':
      return <Customer />
    case 'admin':
      return <Admin />
    case 'executive':
      return <Executive />
    case 'voice-call':
      return <VoiceCall />
    case 'whatsapp':
      return <WhatsApp />
    case 'email':
      return <EmailPortal />
    case 'departments':
      return <Departments />
    case 'home':
    default:
      return <LandingPage />
  }
}
