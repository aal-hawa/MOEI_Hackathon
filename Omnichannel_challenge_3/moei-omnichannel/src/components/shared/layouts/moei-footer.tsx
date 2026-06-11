// MOEI Footer - Redesigned to match UAE DLS / MOEI website footer design
// Structure: Gold accent → 4-column content → Bottom bar with government seal

import {
  Shield,
  ExternalLink,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  Linkedin,
  Send,
  Globe,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t } from '@/pages/i18n'
import { useState } from 'react'

export interface MoeiFooterProps {
  version?: string
  className?: string
}

export function MoeiFooter({ version = 'v3.0', className }: MoeiFooterProps) {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = () => {
    if (email) {
      setSubscribed(true)
      setEmail('')
      setTimeout(() => setSubscribed(false), 3000)
    }
  }

  return (
    <footer className={cn('shrink-0 mt-auto bg-white', className)}>
      {/* Gold accent line at top */}
      <div className="h-[3px] bg-gradient-to-r from-[#C4A35A] via-[#92722A] to-[#C4A35A]" />

      {/* Main footer content */}
      <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 sm:py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {/* Column 1: Ministry Info */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/uae_moei_ar.png"
                alt="MOEI Logo"
                className="h-10 w-auto"
              />
            </div>
            <p className="text-xs text-[#5C5C5C] leading-relaxed mb-4 max-w-xs">
              {isAr
                ? 'وزارة الطاقة والبنية التحتية - منصة الذكاء الاصطناعي الموحدة للتواصل مع العملاء عبر جميع القنوات'
                : 'Ministry of Energy & Infrastructure — Unified AI-powered customer engagement platform delivering seamless service across all channels.'}
            </p>
            {/* Social Media */}
            <div>
              <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-2">
                {isAr ? 'تابعنا' : 'Follow Us'}
              </h4>
              <div className="flex items-center gap-2">
                {[
                  { icon: Facebook, label: 'Facebook' },
                  { icon: Twitter, label: 'X (Twitter)' },
                  { icon: Instagram, label: 'Instagram' },
                  { icon: Youtube, label: 'YouTube' },
                  { icon: Linkedin, label: 'LinkedIn' },
                ].map(({ icon: Icon, label }) => (
                  <button
                    key={label}
                    aria-label={label}
                    className="w-8 h-8 rounded-full bg-[#F5F5F5] hover:bg-[#92722A]/10 flex items-center justify-center text-[#5C5C5C] hover:text-[#92722A] transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">
              {isAr ? 'روابط سريعة' : 'Quick Links'}
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: isAr ? 'عن الوزارة' : 'About MOEI', href: 'https://www.moei.gov.ae/en/about-us' },
                { label: isAr ? 'الخدمات الإلكترونية' : 'E-Services', href: 'https://www.moei.gov.ae/en/services' },
                { label: isAr ? 'المركز الإعلامي' : 'Media Center', href: 'https://www.moei.gov.ae/en/media-center' },
                { label: t('footerTermsOfService', language), href: 'https://www.moei.gov.ae/en/terms-of-use' },
                { label: t('footerPrivacyPolicy', language), href: 'https://www.moei.gov.ae/en/privacy-policy' },
                { label: t('footerContact', language), href: 'https://www.moei.gov.ae/en/contact-with-us' },
              ].map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#5C5C5C] hover:text-[#92722A] transition-colors inline-flex items-center gap-1 group"
                  >
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">
              {isAr ? 'اتصل بنا' : 'Contact Us'}
            </h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-xs text-[#5C5C5C]">
                <Phone className="w-3.5 h-3.5 text-[#92722A] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-[#1A1A1A]">800-MOEI</span>
                  <span className="text-[#5C5C5C]"> (800-6634)</span>
                  <br />
                  <span className="text-[10px] text-[#92722A]">{isAr ? 'مجاني' : 'Toll-Free'}</span>
                </div>
              </li>
              <li className="flex items-center gap-2.5 text-xs text-[#5C5C5C]">
                <Mail className="w-3.5 h-3.5 text-[#92722A] shrink-0" />
                <a href="mailto:info@moei.gov.ae" className="hover:text-[#92722A] transition-colors">info@moei.gov.ae</a>
              </li>
              <li className="flex items-start gap-2.5 text-xs text-[#5C5C5C]">
                <MapPin className="w-3.5 h-3.5 text-[#92722A] shrink-0 mt-0.5" />
                <span>{isAr ? 'أبوظبي، الإمارات العربية المتحدة' : 'Abu Dhabi, United Arab Emirates'}</span>
              </li>
              <li className="flex items-center gap-2.5 text-xs text-[#5C5C5C]">
                <Globe className="w-3.5 h-3.5 text-[#92722A] shrink-0" />
                <a href="https://www.moei.gov.ae" target="_blank" rel="noopener noreferrer" className="hover:text-[#92722A] transition-colors">www.moei.gov.ae</a>
              </li>
            </ul>
          </div>

          {/* Column 4: Newsletter */}
          <div>
            <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider mb-3 pb-2 border-b border-[#E1E3E5]">
              {isAr ? 'ابقَ على اطلاع' : 'Stay Updated'}
            </h4>
            <p className="text-xs text-[#5C5C5C] mb-3">
              {isAr
                ? 'احصل على أحدث تحديثات خدمات الوزارة والإعلانات'
                : 'Get the latest MOEI service updates and announcements'}
            </p>
            <div className="flex gap-1.5">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isAr ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                className="flex-1 min-w-0 px-3 py-2 text-xs border border-[#E1E3E5] rounded-lg focus:outline-none focus:border-[#92722A] focus:ring-1 focus:ring-[#92722A]/20 transition-colors"
                dir="ltr"
              />
              <button
                onClick={handleSubscribe}
                className="px-3 py-2 bg-[#92722A] text-white rounded-lg hover:bg-[#7D6324] transition-colors shrink-0"
                aria-label="Subscribe"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            {subscribed && (
              <p className="text-[10px] text-[#006352] font-medium mt-1.5">
                {isAr ? 'شكراً لاشتراكك!' : 'Thank you for subscribing!'}
              </p>
            )}
            {/* Government badges */}
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[#E1E3E5]">
              <img src="/global-star.png" alt="UAE Star Rating" className="h-8 w-auto" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — copyright and government branding */}
      <div className="bg-[#1A1A1A] text-white">
        <div className="max-w-[1536px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-white/70">
            <Shield className="w-3 h-3 text-[#C4A35A] shrink-0" />
            <span>{t('uaeGovernmentSeal', language)}</span>
            <span className="text-white/30">|</span>
            <span>© {new Date().getFullYear()} {isAr ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'}</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-white/70">
            <span>{t('footerRights', language)}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50 font-medium">{version}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
