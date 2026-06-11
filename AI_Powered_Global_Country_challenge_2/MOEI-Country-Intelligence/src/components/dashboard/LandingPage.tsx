'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Landing Page
   Stunning data-rich landing experience when no country is selected
   ─────────────────────────────────────────────────────────────── */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { LibraryCountry } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import Image from 'next/image';
import {
  Search,
  Globe,
  Database,
  Clock,
  Star,
  ChevronDown,
  MapPin,
  TrendingUp,
  ArrowRight,
  BookOpen,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────── */
interface LandingPageProps {
  countries: LibraryCountry[];
  onCountryChange: (iso: string) => void;
}

type RegionKey =
  | 'middle_east'
  | 'europe'
  | 'asia'
  | 'africa'
  | 'americas'
  | 'oceania';

/* ── Region Mapping (ISO2 → Region) ──────────────────────────── */
const ISO2_TO_REGION: Record<string, RegionKey> = {
  // Middle East
  AE: 'middle_east', SA: 'middle_east', KW: 'middle_east',
  QA: 'middle_east', BH: 'middle_east', OM: 'middle_east',
  YE: 'middle_east', IQ: 'middle_east', IR: 'middle_east',
  JO: 'middle_east', LB: 'middle_east', PS: 'middle_east',
  SY: 'middle_east',
  // Europe
  AL: 'europe', AD: 'europe', AM: 'europe', AT: 'europe',
  AZ: 'europe', BY: 'europe', BE: 'europe', BA: 'europe',
  BG: 'europe', HR: 'europe', CY: 'europe', CZ: 'europe',
  DK: 'europe', EE: 'europe', FI: 'europe', FR: 'europe',
  GE: 'europe', DE: 'europe', GR: 'europe', HU: 'europe',
  IS: 'europe', IE: 'europe', IT: 'europe', XK: 'europe',
  LV: 'europe', LI: 'europe', LT: 'europe', LU: 'europe',
  MT: 'europe', MD: 'europe', MC: 'europe', ME: 'europe',
  NL: 'europe', MK: 'europe', NO: 'europe', PL: 'europe',
  PT: 'europe', RO: 'europe', RU: 'europe', SM: 'europe',
  RS: 'europe', SK: 'europe', SI: 'europe', ES: 'europe',
  SE: 'europe', CH: 'europe', UA: 'europe', GB: 'europe',
  VA: 'europe',
  // Asia
  AF: 'asia', BD: 'asia', BT: 'asia', BN: 'asia', KH: 'asia',
  CN: 'asia', IN: 'asia', ID: 'asia', JP: 'asia', KZ: 'asia',
  KG: 'asia', LA: 'asia', MY: 'asia', MV: 'asia', MN: 'asia',
  MM: 'asia', NP: 'asia', KP: 'asia', PK: 'asia', PH: 'asia',
  SG: 'asia', KR: 'asia', LK: 'asia', TW: 'asia', TJ: 'asia',
  TH: 'asia', TL: 'asia', TM: 'asia', UZ: 'asia', VN: 'asia',
  // Africa
  DZ: 'africa', AO: 'africa', BJ: 'africa', BW: 'africa',
  BF: 'africa', BI: 'africa', CM: 'africa', CV: 'africa',
  CF: 'africa', TD: 'africa', KM: 'africa', CG: 'africa',
  CD: 'africa', CI: 'africa', DJ: 'africa', EG: 'africa',
  GQ: 'africa', ER: 'africa', SZ: 'africa', ET: 'africa',
  GA: 'africa', GM: 'africa', GH: 'africa', GN: 'africa',
  GW: 'africa', KE: 'africa', LS: 'africa', LR: 'africa',
  LY: 'africa', MG: 'africa', MW: 'africa', ML: 'africa',
  MR: 'africa', MU: 'africa', MA: 'africa', MZ: 'africa',
  NA: 'africa', NE: 'africa', NG: 'africa', RW: 'africa',
  ST: 'africa', SN: 'africa', SC: 'africa', SL: 'africa',
  SO: 'africa', ZA: 'africa', SS: 'africa', SD: 'africa',
  TZ: 'africa', TG: 'africa', TN: 'africa', UG: 'africa',
  ZM: 'africa', ZW: 'africa',
  // Americas
  AG: 'americas', AR: 'americas', BS: 'americas', BB: 'americas',
  BZ: 'americas', BM: 'americas', BO: 'americas', BR: 'americas',
  CA: 'americas', CL: 'americas', CO: 'americas', CR: 'americas',
  CU: 'americas', DM: 'americas', DO: 'americas', EC: 'americas',
  SV: 'americas', GD: 'americas', GT: 'americas', GY: 'americas',
  HT: 'americas', HN: 'americas', JM: 'americas', MX: 'americas',
  NI: 'americas', PA: 'americas', PY: 'americas', PE: 'americas',
  PR: 'americas', KN: 'americas', LC: 'americas', VC: 'americas',
  SR: 'americas', TT: 'americas', US: 'americas', UY: 'americas',
  VE: 'americas',
  // Oceania
  AU: 'oceania', FJ: 'oceania', KI: 'oceania', MH: 'oceania',
  FM: 'oceania', NR: 'oceania', NZ: 'oceania', PW: 'oceania',
  PG: 'oceania', WS: 'oceania', SB: 'oceania', TO: 'oceania',
  TV: 'oceania', VU: 'oceania',
};

/* ── Region Labels ────────────────────────────────────────────── */
const REGION_LABELS: Record<RegionKey, { en: string; ar: string; icon: typeof Globe }> = {
  middle_east: { en: 'Middle East', ar: 'الشرق الأوسط', icon: MapPin },
  europe: { en: 'Europe', ar: 'أوروبا', icon: Globe },
  asia: { en: 'Asia', ar: 'آسيا', icon: Globe },
  africa: { en: 'Africa', ar: 'أفريقيا', icon: Globe },
  americas: { en: 'Americas', ar: 'الأمريكتان', icon: Globe },
  oceania: { en: 'Oceania', ar: 'أوقيانوسيا', icon: Globe },
};

/* ── Region display order ─────────────────────────────────────── */
const REGION_ORDER: RegionKey[] = [
  'middle_east',
  'europe',
  'asia',
  'africa',
  'americas',
  'oceania',
];

/* ── Animation variants ───────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: 'easeOut' },
  },
};

const heroVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02, transition: { duration: 0.2, ease: 'easeOut' } },
};

/* ── Helpers ──────────────────────────────────────────────────── */
function formatRelativeTime(dateStr: string, lang: 'en' | 'ar', t: (key: string, params?: Record<string, string | number>) => string): string {
  if (!dateStr) return t('common.na');
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t('common.justNow');
    if (diffMins < 60) return t('common.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('common.hoursAgo', { count: diffHours });
    if (diffDays < 7) return t('common.daysAgo', { count: diffDays });
    return date.toLocaleDateString(lang === 'ar' ? 'ar' : 'en');
  } catch {
    return t('common.na');
  }
}

function getCoverageColor(pct: number): string {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-[#C9A84C]';
  if (pct >= 25) return 'bg-orange-400';
  return 'bg-red-400';
}

function getCoverageBadge(pct: number, t: (key: string, params?: Record<string, string | number>) => string): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' } {
  if (pct >= 80) return { text: t('coverage.comprehensive'), variant: 'default' };
  if (pct >= 50) return { text: t('coverage.good'), variant: 'secondary' };
  if (pct >= 25) return { text: t('coverage.partial'), variant: 'outline' };
  return { text: t('coverage.limited'), variant: 'destructive' };
}

/* ── Country Card Component ───────────────────────────────────── */
function CountryCard({
  country,
  onClick,
  lang,
  index,
  t,
}: {
  country: LibraryCountry;
  onClick: () => void;
  lang: 'en' | 'ar';
  index: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const pct = country.total > 0 ? Math.round((country.found / country.total) * 100) : 0;
  const coverageBadge = getCoverageBadge(pct, t);
  const isRTL = lang === 'ar';

  return (
    <motion.div
      variants={itemVariants}
      className="h-full"
      custom={index}
    >
      <motion.div variants={cardHover}>
        <Card
          className="cursor-pointer bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg hover:border-[#C9A84C]/40 transition-all duration-200 h-full"
          onClick={onClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
          aria-label={`${t('common.select')} ${country.name}`}
        >
          <div className="h-1 bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]" />
          <CardContent className="p-4">
            {/* Header row */}
            <div className={`flex items-start justify-between mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex items-center gap-2.5 min-w-0 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#0F172A] text-white text-xs font-bold shrink-0">
                  {country.iso2}
                </div>
                <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <h3 className="text-sm font-bold text-gray-900 truncate">{country.name}</h3>
                  <span className="text-[10px] font-mono text-gray-400">{country.country_iso}</span>
                </div>
              </div>
              <ArrowRight className={`w-4 h-4 text-gray-300 shrink-0 mt-1 ${isRTL ? 'rotate-180' : ''}`} />
            </div>

            {/* Coverage bar */}
            <div className="mb-2">
              <div className={`flex items-center justify-between mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-[11px] font-medium text-gray-500">
                  {t('common.coverage')}
                </span>
                <span className="text-[11px] font-bold text-gray-700">
                  {country.found}/{country.total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${getCoverageColor(pct)}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: 0.1 + index * 0.02, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Footer row */}
            <div className={`flex items-center justify-between mt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Badge variant={coverageBadge.variant} className="text-[10px] px-1.5 py-0">
                {coverageBadge.text}
              </Badge>
              <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <Clock className="w-3 h-3" />
                <span>{formatRelativeTime(country.updated_at, lang, t)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

/* ── Featured Country Card (larger, highlighted) ──────────────── */
function FeaturedCountryCard({
  country,
  onClick,
  lang,
  rank,
  t,
}: {
  country: LibraryCountry;
  onClick: () => void;
  lang: 'en' | 'ar';
  rank: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const pct = country.total > 0 ? Math.round((country.found / country.total) * 100) : 0;
  const isRTL = lang === 'ar';

  return (
    <motion.div variants={itemVariants}>
      <Card
        className="cursor-pointer bg-gradient-to-br from-white to-gray-50 border border-[#C9A84C]/30 rounded-xl overflow-hidden hover:shadow-xl hover:border-[#C9A84C]/60 transition-all duration-200"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick();
          }
        }}
        aria-label={`${t('common.select')} ${country.name}`}
      >
        <div className="h-1.5 bg-gradient-to-r from-[#9C7A2D] via-[#C9A84C] to-[#9C7A2D]" />
        <CardContent className="p-5">
          <div className={`flex items-center gap-3 mb-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="relative">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#0F172A] text-white text-sm font-bold">
                {country.iso2}
              </div>
              <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#9C7A2D] text-white text-[10px] font-bold shadow-sm">
                {rank}
              </div>
            </div>
            <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
              <h3 className="text-sm font-bold text-gray-900 truncate">{country.name}</h3>
              <span className="text-[11px] font-mono text-gray-400">{country.country_iso}</span>
            </div>
            <ArrowRight className={`w-4 h-4 text-[#C9A84C] ml-auto shrink-0 ${isRTL ? 'rotate-180 mr-auto ml-0' : ''}`} />
          </div>

          {/* Coverage */}
          <div className="mb-2">
            <div className={`flex items-center justify-between mb-1.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <span className="text-[11px] font-medium text-gray-500">
                {t('landing.dataCompleteness')}
              </span>
              <span className="text-xs font-bold text-[#9C7A2D]">{pct}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, delay: 0.2 + rank * 0.1, ease: 'easeOut' }}
              />
            </div>
          </div>

          <div className={`flex items-center justify-between mt-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-[11px] font-medium text-gray-500">
              {country.found} {t('common.fields')}
            </span>
            <div className={`flex items-center gap-1 text-[11px] text-gray-400 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Clock className="w-3 h-3" />
              <span>{formatRelativeTime(country.updated_at, lang, t)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ── Main Landing Page Component ──────────────────────────────── */
export default function LandingPage({ countries, onCountryChange }: LandingPageProps) {
  const { lang, t } = useLanguage();
  const isRTL = lang === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Set<RegionKey>>(new Set(['middle_east']));

  // ── Derived data ────────────────────────────────────────────
  const countriesWithData = useMemo(
    () => countries.filter((c) => c.found > 0),
    [countries],
  );

  const totalDataPoints = useMemo(
    () => countries.reduce((sum, c) => sum + c.found, 0),
    [countries],
  );

  const lastUpdated = useMemo(() => {
    if (countries.length === 0) return null;
    const sorted = [...countries].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    );
    return sorted[0].updated_at;
  }, [countries]);

  const featuredCountries = useMemo(() => {
    return [...countries]
      .filter((c) => c.total > 0)
      .sort((a, b) => {
        const pctA = a.found / a.total;
        const pctB = b.found / b.total;
        if (pctB !== pctA) return pctB - pctA;
        return b.found - a.found;
      })
      .slice(0, 6);
  }, [countries]);

  const countriesByRegion = useMemo(() => {
    const grouped: Record<RegionKey, LibraryCountry[]> = {
      middle_east: [],
      europe: [],
      asia: [],
      africa: [],
      americas: [],
      oceania: [],
    };

    countries.forEach((c) => {
      const region = ISO2_TO_REGION[c.iso2] || 'asia'; // default fallback
      grouped[region].push(c);
    });

    // Sort each region's countries by name
    Object.keys(grouped).forEach((key) => {
      grouped[key as RegionKey].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [countries]);

  const filteredCountriesByRegion = useMemo(() => {
    if (!searchQuery.trim()) return countriesByRegion;

    const q = searchQuery.toLowerCase();
    const filtered: Record<RegionKey, LibraryCountry[]> = {
      middle_east: [],
      europe: [],
      asia: [],
      africa: [],
      americas: [],
      oceania: [],
    };

    (Object.keys(countriesByRegion) as RegionKey[]).forEach((region) => {
      filtered[region] = countriesByRegion[region].filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.country_iso.toLowerCase().includes(q) ||
          c.iso2.toLowerCase().includes(q),
      );
    });

    return filtered;
  }, [countriesByRegion, searchQuery]);

  const totalFiltered = useMemo(
    () => Object.values(filteredCountriesByRegion).reduce((s, arr) => s + arr.length, 0),
    [filteredCountriesByRegion],
  );

  // ── Handlers ────────────────────────────────────────────────
  const toggleRegion = (region: RegionKey) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  // ── Stats ───────────────────────────────────────────────────
  const stats = [
    {
      icon: Globe,
      label: t('landing.totalCountries'),
      value: countries.length,
      color: 'text-[#0F172A]',
      bgColor: 'bg-[#0F172A]/5',
    },
    {
      icon: Database,
      label: t('landing.countriesWithData'),
      value: countriesWithData.length,
      color: 'text-[#2C7A6B]',
      bgColor: 'bg-[#2C7A6B]/5',
    },
    {
      icon: BookOpen,
      label: t('landing.dataPoints'),
      value: totalDataPoints.toLocaleString(),
      color: 'text-[#9C7A2D]',
      bgColor: 'bg-[#9C7A2D]/5',
    },
    {
      icon: Clock,
      label: t('landing.lastUpdated'),
      value: lastUpdated ? formatRelativeTime(lastUpdated, lang, t) : t('common.na'),
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
  ];

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6 space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ═══════════════════════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════════════════════ */}
      <motion.section variants={heroVariants} className="text-center">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A] p-8 md:p-12">
          {/* Decorative elements */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 left-0 w-64 h-64 bg-[#C9A84C] rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#C9A84C] rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
          </div>

          <div className="relative z-10">
            <motion.div
              className="flex items-center justify-center gap-4 mb-4"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Image
                src="/uae_moei_ar.png"
                alt="Ministry of Energy & Infrastructure - UAE"
                width={140}
                height={48}
                className="h-12 w-auto object-contain drop-shadow-lg"
                priority
              />
              <Image
                src="/global-star.png"
                alt="Global Star Rating System"
                width={36}
                height={36}
                className="h-9 w-auto object-contain drop-shadow-lg"
                priority
              />
            </motion.div>

            <motion.h1
              className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-white mb-3 tracking-tight"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              {t('landing.platformTitle')}
            </motion.h1>

            <motion.p
              className="text-sm md:text-base text-[#94A3B8] max-w-2xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {t('landing.platformDesc')}
            </motion.p>

            <motion.div
              className="flex items-center justify-center gap-4 mt-5 flex-wrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30 text-[11px] px-3 py-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                {t('landing.advancedAnalytics')}
              </Badge>
              <Badge className="bg-[#2C7A6B]/20 text-[#2C7A6B] border-[#2C7A6B]/30 text-[11px] px-3 py-1">
                <Database className="w-3 h-3 mr-1" />
                {t('landing.sourceVerifiedData')}
              </Badge>
              <Badge className="bg-white/10 text-white/80 border-white/20 text-[11px] px-3 py-1">
                <Globe className="w-3 h-3 mr-1" />
                {countries.length} {t('common.countries')}
              </Badge>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════
          QUICK STATS ROW
          ═══════════════════════════════════════════════════════ */}
      <motion.section variants={containerVariants}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <CardContent className="p-4">
                  <div className={`flex items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg ${stat.bgColor} shrink-0`}>
                      <stat.icon className={`w-4.5 h-4.5 ${stat.color}`} />
                    </div>
                    <div className={`min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                      <p className="text-lg font-bold text-gray-900 leading-tight">{stat.value}</p>
                      <p className="text-[11px] text-gray-500 truncate">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════════
          FEATURED COUNTRIES
          ═══════════════════════════════════════════════════════ */}
      {featuredCountries.length > 0 && (
        <motion.section variants={containerVariants}>
          <motion.div variants={itemVariants} className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-[#C9A84C] to-[#9C7A2D] text-white">
              <Star className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">
              {t('landing.featuredCountries')}
            </h2>
            <span className="text-[11px] text-gray-400 font-medium">
              {t('landing.highestDataCoverage')}
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featuredCountries.map((country, idx) => (
              <FeaturedCountryCard
                key={country.country_iso}
                country={country}
                onClick={() => onCountryChange(country.country_iso)}
                lang={lang}
                rank={idx + 1}
                t={t}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════════
          SEARCH + ALL COUNTRIES BY REGION
          ═══════════════════════════════════════════════════════ */}
      <motion.section variants={containerVariants}>
        <motion.div variants={itemVariants} className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0F172A] text-white">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">
            {t('landing.allCountries')}
          </h2>
          <span className="text-[11px] text-gray-400 font-medium">
            {searchQuery
              ? t('landing.resultsCount', { count: totalFiltered })
              : t('landing.resultsCount', { count: countries.length })}
          </span>
          <div className="flex-1 h-px bg-gray-200" />
        </motion.div>

        {/* Search input */}
        <motion.div variants={itemVariants} className="mb-5">
          <div className="relative max-w-md">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`} />
            <Input
              type="text"
              placeholder={t('landing.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${isRTL ? 'pr-10 pl-3' : 'pl-10 pr-3'} h-10 bg-white border-gray-200 text-sm focus-visible:border-[#C9A84C] focus-visible:ring-[#C9A84C]/20`}
              aria-label={t('a11y.search')}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-medium ${isRTL ? 'left-3' : 'right-3'}`}
              >
                {t('common.clear')}
              </button>
            )}
          </div>
        </motion.div>

        {/* Regional sections */}
        <AnimatePresence>
          {REGION_ORDER.map((region) => {
            const regionCountries = filteredCountriesByRegion[region];
            if (regionCountries.length === 0) return null;

            const label = REGION_LABELS[region];
            const RegionIcon = label.icon;
            const isExpanded = expandedRegions.has(region) || !!searchQuery.trim();

            return (
              <motion.div
                key={region}
                variants={itemVariants}
                className="mb-4"
              >
                <Collapsible
                  open={isExpanded}
                  onOpenChange={() => {
                    if (!searchQuery.trim()) toggleRegion(region);
                  }}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#0F172A]/5">
                        <RegionIcon className="w-3 h-3 text-[#0F172A]" />
                      </div>
                      <span className="text-sm font-semibold text-gray-800">
                        {lang === 'ar' ? label.ar : label.en}
                      </span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {regionCountries.length}
                      </Badge>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className={`${isRTL ? 'mr-auto' : 'ml-auto'}`}
                      >
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      </motion.div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <motion.div
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-2 pb-3 px-1"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {regionCountries.map((country, idx) => (
                        <CountryCard
                          key={country.country_iso}
                          country={country}
                          onClick={() => onCountryChange(country.country_iso)}
                          lang={lang}
                          index={idx}
                          t={t}
                        />
                      ))}
                    </motion.div>
                  </CollapsibleContent>
                </Collapsible>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* No results */}
        {totalFiltered === 0 && searchQuery && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">
              {t('landing.noResults', { query: searchQuery })}
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs text-[#9C7A2D] hover:text-[#C9A84C] font-medium"
            >
              {t('landing.clearSearch')}
            </button>
          </motion.div>
        )}
      </motion.section>
    </motion.div>
  );
}
