'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Header
   Dark navy header with official MOEI logo, Global Star badge,
   and modern pill navigation – matching official MOEI website style
   ─────────────────────────────────────────────────────────────── */

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Globe, Languages, LayoutGrid, Shield } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { Section, LibraryCountry } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface HeaderProps {
  activeSection: Section;
  onSectionChange: (s: Section) => void;
  selectedCountry: string;
  onCountryChange: (c: string) => void;
  countries: LibraryCountry[];
}

const sections: { key: Section }[] = [
  { key: 'dashboard' },
  { key: 'profile' },
  { key: 'briefings' },
  { key: 'reports' },
  { key: 'compare' },
  { key: 'chat' },
  { key: 'admin' },
];

const navKeys: Record<Section, string> = {
  dashboard: 'nav.dashboard',
  profile: 'nav.profile',
  briefings: 'nav.briefings',
  reports: 'nav.reports',
  compare: 'nav.compare',
  chat: 'nav.chat',
  admin: 'nav.admin',
};

export default function Header({
  activeSection,
  onSectionChange,
  selectedCountry,
  onCountryChange,
  countries,
}: HeaderProps) {
  const { lang, t, toggleLang, isRTL, dir } = useLanguage();

  return (
    <header className="sticky top-0 z-50 bg-[#0F172A] border-b border-[#1E293B]" dir={dir}>
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Left: MOEI Logo + Global Star Badge */}
          <motion.div
            className={`flex items-center gap-2.5 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Official MOEI Logo */}
            <a
              href="https://www.moei.gov.ae"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center shrink-0"
              aria-label={t('a11y.moeiWebsite')}
            >
              <Image
                src="/uae_moei_ar.png"
                alt={t('app.moeiFullName')}
                width={120}
                height={40}
                className="h-9 w-auto object-contain"
                priority
              />
            </a>

            {/* Global Star Rating Badge */}
            <a
              href="https://u.ae/en/about-the-uae/official-national-awards/global-star-rating-system"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center shrink-0"
              aria-label={t('a11y.globalStarRating')}
            >
              <Image
                src="/global-star.png"
                alt={t('app.globalStarRating')}
                width={28}
                height={28}
                className="h-7 w-auto object-contain"
                priority
              />
            </a>
          </motion.div>

          {/* Center: Navigation pills */}
          <motion.nav
            className="hidden md:flex items-center gap-1 bg-[#1E293B] rounded-lg p-1"
            role="tablist"
            aria-label={t('a11y.mainNav')}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
          >
            {sections.map(({ key }) => {
              const isActive = activeSection === key;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onSectionChange(key)}
                  className="relative px-4 py-1.5 text-sm font-medium rounded-md transition-colors duration-150"
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavPill"
                      className="absolute inset-0 bg-[#9C7A2D] rounded-md"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span
                    className={`relative z-10 ${
                      isActive ? 'text-white' : 'text-[#94A3B8] hover:text-[#CBD5E1]'
                    }`}
                  >
                    {t(navKeys[key])}
                  </span>
                </button>
              );
            })}
          </motion.nav>

          {/* Right: Language toggle + Country selector */}
          <motion.div
            className={`flex items-center gap-2 shrink-0 ${isRTL ? 'flex-row-reverse' : ''}`}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            {/* Language toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLang}
              className="h-8 px-2.5 text-xs font-semibold border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-white hover:border-[#475569] bg-transparent transition-all duration-150"
              aria-label={t('a11y.switchLang')}
            >
              <Languages className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'AR' : 'EN'}</span>
            </Button>

            {/* All Countries button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCountryChange('')}
              className="h-8 px-2.5 text-xs font-semibold border-[#334155] text-[#94A3B8] hover:bg-[#1E293B] hover:text-white hover:border-[#475569] bg-transparent transition-all duration-150"
              aria-label={t('nav.allCountries')}
              title={t('nav.allCountries')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('nav.all')}</span>
            </Button>

            {/* Country selector */}
            <Select value={selectedCountry} onValueChange={onCountryChange}>
              <SelectTrigger
                size="sm"
                className="w-[170px] h-8 text-xs border-[#334155] text-[#CBD5E1] hover:border-[#475569] hover:text-white bg-transparent transition-all duration-150"
              >
                <Globe className="w-3.5 h-3.5 opacity-60" />
                <SelectValue placeholder={t('dashboard.selectCountry')} />
              </SelectTrigger>
              <SelectContent className="max-h-72 bg-[#1E293B] border-[#334155]">
                {/* Group: Countries with data first */}
                {countries.filter((c) => c.found > 0).length > 0 && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {t('nav.withData')}
                  </div>
                )}
                {countries
                  .filter((c) => c.found > 0)
                  .map((c) => (
                    <SelectItem key={c.country_iso} value={c.country_iso} className="text-[#CBD5E1] focus:bg-[#334155] focus:text-white">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-[#64748B] font-mono">{c.country_iso}</span>
                        <span>{c.name}</span>
                        <span className="text-[10px] text-[#2C7A6B] ml-auto font-medium">
                          {c.found}/{c.total}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                {countries.filter((c) => c.found === 0).length > 0 && (
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-[#64748B] uppercase tracking-wider mt-1">
                    {t('nav.noDataYet')}
                  </div>
                )}
                {countries
                  .filter((c) => c.found === 0)
                  .map((c) => (
                    <SelectItem key={c.country_iso} value={c.country_iso} className="text-[#CBD5E1] focus:bg-[#334155] focus:text-white">
                      <span className="flex items-center gap-1.5">
                        <span className="text-xs text-[#64748B] font-mono">{c.country_iso}</span>
                        <span>{c.name}</span>
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </motion.div>
        </div>

        {/* Mobile navigation */}
        <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto scrollbar-none" role="tablist">
          {sections.map(({ key }) => {
            const isActive = activeSection === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={isActive}
                onClick={() => onSectionChange(key)}
                className={`relative px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#9C7A2D] text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1E293B]'
                }`}
              >
                {t(navKeys[key])}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
