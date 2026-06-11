'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Delegation Briefings
   إحاطة عن الوفود القادمة من وزارة الطاقة من دولة أخرى
   لمعرفة من هم الوفد ومعلومات عنهم من مصادر موثوقة
   ─────────────────────────────────────────────────────────────── */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { LibraryCountry } from '@/lib/types';
import { sendChat } from '@/lib/api';
import MarkdownContent from '@/components/common/MarkdownContent';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Users,
  Search,
  Loader2,
  ShieldCheck,
  Globe,
  Building2,
  UserCircle,
  FileText,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

interface DelegationBriefingsProps {
  selectedCountry: string;
  countries: LibraryCountry[];
}

interface DelegationResult {
  answer: string;
  timestamp: string;
  query: string;
}

/* ── Animation variants ────────────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

/* ── Section Header ──────────────────────────────────────────── */
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-8 first:mt-0">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0F172A] text-white">
        {icon}
      </div>
      <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */
export default function DelegationBriefings({
  selectedCountry,
  countries,
}: DelegationBriefingsProps) {
  const { t, lang, isRTL, dir } = useLanguage();
  const countryName = countries.find((c) => c.country_iso === selectedCountry)?.name ?? selectedCountry;
  const countryIso2 = countries.find((c) => c.country_iso === selectedCountry)?.iso2 ?? selectedCountry;

  const [researching, setResearching] = useState(false);
  const [results, setResults] = useState<DelegationResult[]>([]);
  const [customQuery, setCustomQuery] = useState('');

  // ── Research delegation ──────────────────────────────────
  const handleResearch = useCallback(
    async (query?: string) => {
      if (!selectedCountry) return;
      setResearching(true);

      const delegationQuery =
        query ||
        (lang === 'ar'
          ? `قدّم إحاطة شاملة عن الوفود القادمة من ${countryName} لوزارة الطاقة والبنية التحتية في الإمارات. أريد معرفة: 1) من هم أعضاء الوفد وكبار المسؤولين في وزارة الطاقة في ${countryName}؟ 2) ما هي مجالات اهتمامهم الرئيسية؟ 3) ما هي أبرز مشاريع التعاون بين ${countryName} والإمارات؟ 4) ما هي الخلفية المهنية لكبار المسؤولين؟ 5) ما هي أولوياتهم الحالية في قطاع الطاقة والبنية التحتية؟`
          : `Provide a comprehensive intelligence briefing on incoming delegations from ${countryName} to the UAE Ministry of Energy & Infrastructure. I need to know: 1) Who are the key delegation members and senior officials from ${countryName}'s Ministry of Energy? 2) What are their main areas of interest? 3) What are the key cooperation projects between ${countryName} and the UAE? 4) What is the professional background of senior officials? 5) What are their current priorities in the energy and infrastructure sector?`);

      try {
        const response = await sendChat(delegationQuery, lang, selectedCountry);
        setResults((prev) => [
          {
            answer: response.answer,
            timestamp: new Date().toISOString(),
            query: delegationQuery,
          },
          ...prev,
        ]);
      } catch {
        setResults((prev) => [
          {
            answer: t('briefings.retrievalFailed'),
            timestamp: new Date().toISOString(),
            query: delegationQuery,
          },
          ...prev,
        ]);
      } finally {
        setResearching(false);
      }
    },
    [selectedCountry, countryName, lang],
  );

  // ── Quick research buttons ───────────────────────────────
  const quickResearchButtons = [
    {
      icon: Users,
      label: t('briefings.delegationMembers'),
      query:
        lang === 'ar'
          ? `من هم أعضاء الوفد الرسمي وكبار المسؤولين من ${countryName} في مجال الطاقة والبنية التحتية؟ اذكر أسماءهم ومناصبهم وخلفياتهم المهنية.`
          : `Who are the official delegation members and senior officials from ${countryName} in the energy and infrastructure sector? List their names, positions, and professional backgrounds.`,
    },
    {
      icon: Building2,
      label: t('briefings.cooperationProjects'),
      query:
        lang === 'ar'
          ? `ما هي أبرز مشاريع التعاون بين ${countryName} والإمارات العربية المتحدة في قطاعات الطاقة والبنية التحتية؟ اذكر التفاصيل والحالة الحالية.`
          : `What are the key cooperation projects between ${countryName} and the UAE in the energy and infrastructure sectors? Provide details and current status.`,
    },
    {
      icon: Globe,
      label: t('briefings.energyPriorities'),
      query:
        lang === 'ar'
          ? `ما هي أولويات ${countryName} الحالية في قطاع الطاقة والبنية التحتية؟ ما هي الاستراتيجيات الوطنية والمبادرات الجديدة؟`
          : `What are ${countryName}'s current priorities in the energy and infrastructure sector? What are the national strategies and new initiatives?`,
    },
    {
      icon: ShieldCheck,
      label: t('briefings.bilateralRelations'),
      query:
        lang === 'ar'
          ? `ما هي طبيعة العلاقات الثنائية بين ${countryName} والإمارات؟ ما هي الاتفاقيات ومذكرات التفاهم الموقعة؟`
          : `What is the nature of bilateral relations between ${countryName} and the UAE? What agreements and MoUs have been signed?`,
    },
  ];

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6 space-y-1"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      dir={dir}
    >
      {/* ── Country Header ──────────────────────────────────── */}
      <motion.div variants={itemVariants} className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#0F172A] text-white text-sm font-bold shrink-0">
          {countryIso2}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {t('briefings.titleCountry', { country: countryName })}
          </h1>
          <p className="text-xs text-gray-400 font-mono">{selectedCountry}</p>
        </div>
      </motion.div>

      {/* ── Description Card ────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-[#0F172A] to-[#1E293B] border-0 rounded-xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]" />
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#C9A84C]/20 shrink-0">
                <Users className="w-5 h-5 text-[#C9A84C]" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white mb-1.5">
                  {t('briefings.delegations')}
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {t('briefings.delegationsDesc')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Quick Research Buttons ──────────────────────────── */}
      <motion.div variants={itemVariants}>
        <SectionHeader
          icon={<Search className="w-3.5 h-3.5" />}
          title={t('briefings.quickResearch')}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickResearchButtons.map((btn) => (
            <Button
              key={btn.label}
              variant="outline"
              onClick={() => handleResearch(btn.query)}
              disabled={researching}
              className={`h-auto py-3 px-3 flex flex-col items-center gap-2 border-gray-200 hover:border-[#C9A84C]/50 hover:bg-[#C9A84C]/5 transition-all duration-200 ${
                isRTL ? 'flex-row-reverse' : ''
              }`}
            >
              <btn.icon className="w-5 h-5 text-[#9C7A2D]" />
              <span className="text-[11px] font-semibold text-gray-700">{btn.label}</span>
            </Button>
          ))}
        </div>
      </motion.div>

      {/* ── Custom Query ────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-[#9C7A2D]" />
              <span className="text-xs font-bold text-[#9C7A2D] uppercase tracking-wider">
                {t('briefings.customQuery')}
              </span>
            </div>
            <div className="flex gap-2">
              <Textarea
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder={t('briefings.askAboutDelegation', { country: countryName })}
                className="min-h-[60px] bg-gray-50 border-gray-200 text-sm resize-none"
                dir={dir}
              />
              <Button
                onClick={() => {
                  if (customQuery.trim()) {
                    handleResearch(customQuery.trim());
                    setCustomQuery('');
                  }
                }}
                disabled={researching || !customQuery.trim()}
                className="bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C] hover:from-[#8A6A24] hover:to-[#B8983F] text-white font-semibold px-4 rounded-xl shrink-0 self-end"
              >
                {researching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Researching State ───────────────────────────────── */}
      <AnimatePresence>
        {researching && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center shadow-lg">
                <Loader2 className="w-7 h-7 text-[#C9A84C] animate-spin" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-6 h-6 rounded-full bg-[#C9A84C] shadow-sm">
                <Users className="w-3 h-3 text-white" />
              </div>
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">
              {t('briefings.researching')}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm">
              {t('briefings.researchingDelegation', { country: countryName })}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results ─────────────────────────────────────────── */}
      <AnimatePresence>
        {results.length > 0 && !researching && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible">
            <SectionHeader
              icon={<FileText className="w-3.5 h-3.5" />}
              title={t('briefings.delegationResults')}
            />

            {results.map((result, idx) => (
              <motion.div key={idx} variants={itemVariants} className="mb-4">
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className={`h-1 ${idx === 0 ? 'bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]' : 'bg-gray-200'}`} />
                  <CardContent className="p-5">
                    {/* Result header */}
                    <div className={`flex items-center justify-between mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {idx === 0 && (
                          <span className="text-[10px] font-bold text-white bg-[#9C7A2D] px-2 py-0.5 rounded">
                            {t('common.latest')}
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400">
                          {new Date(result.timestamp).toLocaleString(
                            lang === 'ar' ? 'ar-AE' : 'en-US',
                            { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' },
                          )}
                        </span>
                      </div>
                      {idx === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResearch(result.query)}
                          disabled={researching}
                          className="h-7 px-2 text-[11px] text-[#9C7A2D] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5"
                        >
                          <RefreshCw className="w-3 h-3 mr-1" />
                          {t('briefings.reResearch')}
                        </Button>
                      )}
                    </div>

                    {/* Formatted answer */}
                    <MarkdownContent content={result.answer} />

                    {/* Source verification note */}
                    <div className={`flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#2C7A6B] shrink-0" />
                      <span className="text-[10px] text-gray-400">
                        {t('briefings.aiGeneratedDisclaimer')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty State ─────────────────────────────────────── */}
      {results.length === 0 && !researching && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col items-center justify-center py-12 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#C9A84C]/10 flex items-center justify-center mb-4">
            <UserCircle className="w-8 h-8 text-[#9C7A2D]" />
          </div>
          <h3 className="text-base font-bold text-gray-800 mb-2">
            {t('briefings.startResearch', { country: countryName })}
          </h3>
          <p className="text-sm text-gray-500 max-w-md leading-relaxed mb-6">
            {t('briefings.emptyStateDesc')}
          </p>

          {/* Full research button */}
          <Button
            onClick={() => handleResearch()}
            disabled={researching}
            className="bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C] hover:from-[#8A6A24] hover:to-[#B8983F] text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-[#9C7A2D]/20 transition-all duration-200"
          >
            <Search className="w-4 h-4 mr-2" />
            {t('briefings.researchDelegation')}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
