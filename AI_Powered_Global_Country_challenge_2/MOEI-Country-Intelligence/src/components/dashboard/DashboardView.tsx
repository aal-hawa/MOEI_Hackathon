'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Dashboard View
   Modern, clean design with strong typography and proper spacing
   Handles: loading, no-data (with build button), and full data
   ─────────────────────────────────────────────────────────────── */

import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { DashboardData, TearsheetData, LibraryCountry } from '@/lib/types';
import KPICard from './KPICard';
import ChartWrapper from './ChartWrapper';
import TradeBarChart from './TradeBarChart';
import TrendLineChart from './TrendLineChart';
import DomainPieChart from './DomainPieChart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen,
  TrendingUp,
  BarChart3,
  PieChart,
  Lightbulb,
  AlertTriangle,
  Sparkles,
  Handshake,
  Database,
  Rocket,
  MapPin,
  Globe,
  Loader2,
  ShieldCheck,
  MessageSquare,
  Newspaper,
  Users,
  RefreshCw,
} from 'lucide-react';
import MarkdownContent from '@/components/common/MarkdownContent';

interface DashboardViewProps {
  dashboardData: DashboardData | null;
  tearsheetData: TearsheetData | null;
  loading: boolean;
  selectedCountry: string;
  countries: LibraryCountry[];
  onBuildDossier: (country: string) => Promise<void>;
  building: boolean;
  buildProgress: string | null;
  backendOffline?: boolean;
  councilData?: string | null;
  newsItems?: Array<{ title: string; link: string; published: string; source: string; }>;
}

/* ── Stagger animation variants ────────────────────────────── */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

/* ── Section Header ──────────────────────────────────────────── */
function SectionHeader({ icon, title, id }: { icon: React.ReactNode; title: string; id?: string }) {
  return (
    <motion.div
      id={id}
      className="flex items-center gap-3 mb-4 mt-8 first:mt-0"
      variants={itemVariants}
    >
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#0F172A] text-white">
        {icon}
      </div>
      <h2 className="text-sm font-bold text-gray-900 tracking-tight uppercase">{title}</h2>
      <div className="flex-1 h-px bg-gray-200" />
    </motion.div>
  );
}

/* ── Get country display name ──────────────────────────────── */
function getCountryName(countries: LibraryCountry[], iso: string): string {
  const c = countries.find((c) => c.country_iso === iso);
  return c?.name ?? iso;
}

export default function DashboardView({
  dashboardData,
  tearsheetData,
  loading,
  selectedCountry,
  countries,
  onBuildDossier,
  building,
  buildProgress,
  backendOffline = false,
  councilData,
  newsItems,
}: DashboardViewProps) {
  const { t, lang } = useLanguage();
  const countryName = getCountryName(countries, selectedCountry);

  // ── Loading skeleton ──────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse">
          <div className="h-5 w-48 bg-gray-100 rounded mb-4" />
          <div className="h-4 w-full bg-gray-100 rounded mb-2" />
          <div className="h-4 w-3/4 bg-gray-100 rounded mb-2" />
          <div className="h-4 w-5/6 bg-gray-100 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border border-gray-200 animate-pulse">
              <div className="h-3 w-24 bg-gray-100 rounded mb-3" />
              <div className="h-8 w-20 bg-gray-100 rounded mb-2" />
              <div className="h-2 w-16 bg-gray-50 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Building progress state ────────────────────────────────
  if (building) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16">
        <motion.div
          className="flex flex-col items-center justify-center text-center max-w-md mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center shadow-lg">
              <Loader2 className="w-9 h-9 text-[#C9A84C] animate-spin" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-[#C9A84C] shadow-sm">
              <Database className="w-3.5 h-3.5 text-white" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('dashboard.buildingDossier', { country: countryName })}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {t('dashboard.gatheringIntelligence')}
          </p>
          <div className="w-full max-w-sm">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C] rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: '85%' }}
                transition={{ duration: 10, ease: 'linear' }}
              />
            </div>
          </div>
          {buildProgress && (
            <motion.p
              className="text-xs text-[#9C7A2D] font-medium mt-3"
              key={buildProgress}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {buildProgress}
            </motion.p>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Backend offline state ────────────────────────────────────
  if (backendOffline && selectedCountry) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16">
        <motion.div
          className="flex flex-col items-center justify-center text-center max-w-lg mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-900 to-red-700 flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-9 h-9 text-red-200" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('dashboard.backendOffline')}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm">
            {t('dashboard.backendOfflineDesc')}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-left w-full max-w-sm">
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              {t('dashboard.toStartServices')}
            </p>
            <code className="text-xs bg-gray-900 text-green-400 px-3 py-2 rounded-lg block font-mono">
              bash start.sh
            </code>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── No data state — country selected but no dossier yet ───
  if (!dashboardData && !tearsheetData && selectedCountry) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16">
        <motion.div
          className="flex flex-col items-center justify-center text-center max-w-lg mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          {/* Illustration */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0F172A] to-[#1E293B] flex items-center justify-center shadow-lg">
              <MapPin className="w-9 h-9 text-[#C9A84C]" />
            </div>
            <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-7 h-7 rounded-full bg-[#C9A84C] shadow-sm">
              <Rocket className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {t('dashboard.noDataYet', { country: countryName })}
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed max-w-sm">
            {t('dashboard.noDataDesc')}
          </p>

          {/* Build button */}
          <Button
            onClick={() => onBuildDossier(selectedCountry)}
            disabled={building}
            className="bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C] hover:from-[#8A6A24] hover:to-[#B8983F] text-white font-semibold px-6 py-2.5 rounded-xl shadow-lg shadow-[#9C7A2D]/20 transition-all duration-200"
          >
            <Rocket className="w-4 h-4 mr-2" />
            {t('dashboard.buildDossier')}
          </Button>

          {/* Quick info card */}
          <Card className="mt-8 w-full bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]" />
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-[#9C7A2D]" />
                <span className="text-xs font-bold text-[#9C7A2D] uppercase tracking-wider">
                  {t('dashboard.whatYoullGet')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: BarChart3, label: t('dashboard.keyPerformanceIndicators') },
                  { icon: TrendingUp, label: t('dashboard.trendAnalysis') },
                  { icon: Globe, label: t('dashboard.tradeData') },
                  { icon: Lightbulb, label: t('dashboard.insightsOpportunities') },
                  { icon: PieChart, label: t('dashboard.energySectors') },
                  { icon: Handshake, label: t('dashboard.uaeRelations') },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                    <item.icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // ── No data state — no country selected at all ────────────
  if (!dashboardData && !tearsheetData && !selectedCountry) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-16">
        <motion.div
          className="flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
            <BookOpen className="w-7 h-7 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            {t('dashboard.selectCountry')}
          </h2>
          <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
            {t('dashboard.selectCountryDesc')}
          </p>
        </motion.div>
      </div>
    );
  }

  const headline = tearsheetData?.headline ?? [];
  const trajectory = tearsheetData?.trajectory ?? [];
  const trade = tearsheetData?.trade ?? dashboardData?.data?.trade ?? null;
  const sectors = tearsheetData?.sectors ?? [];
  const energy = tearsheetData?.energy ?? [];
  const uae = tearsheetData?.uae ?? [];
  const read = tearsheetData?.read ?? null;

  const kpiItems = headline.map((h) => ({
    title: h.display,
    value: h.display,
    unit: h.unit,
    trend: h.trend
      ? {
          direction: h.trend.direction,
          good_up: h.trend.good_up,
          spark: h.trend.spark,
          cagr_pct: h.trend.cagr_pct,
          change_pct: h.trend.change_pct,
        }
      : undefined,
    source: h.source,
    as_of: h.as_of,
  }));

  const trendItems = trajectory.map((tr) => ({
    key: tr.key,
    display: tr.display,
    unit: tr.unit,
    latest: tr.latest,
    latest_year: tr.latest_year,
    direction: tr.direction,
    good_up: tr.good_up,
    spark: tr.spark,
    move: tr.move,
  }));

  const sectorPieData = sectors.map((s) => ({
    name: s.display || s.key,
    value: typeof s.value === 'number' ? s.value : parseFloat(String(s.value)) || 0,
  }));

  const energyPieData = energy.map((e) => ({
    name: e.display || e.key,
    value: typeof e.value === 'number' ? e.value : parseFloat(String(e.value)) || 0,
  }));

  const insightPanels = dashboardData?.dashboard?.insight_panels ?? [];
  const riskPanels = dashboardData?.dashboard?.risk_panels ?? [];
  const opportunityPanels = dashboardData?.dashboard?.opportunity_panels ?? [];
  const analysis = dashboardData?.data?.analysis ?? null;
  const predictive = dashboardData?.data?.predictive ?? null;
  const council = councilData ?? dashboardData?.data?.council ?? null;
  const trendDataMap = dashboardData?.data?.trends ?? {};

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6 space-y-1"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Country Name Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#0F172A] text-white text-sm font-bold">
            {countries.find(c => c.country_iso === selectedCountry)?.iso2 || selectedCountry}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{countryName}</h1>
            <span className="text-xs text-gray-400 font-mono">{selectedCountry}</span>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBuildDossier(selectedCountry)}
          disabled={building}
          className="h-8 px-3 text-xs font-semibold border-[#C9A84C]/30 text-[#9C7A2D] hover:bg-[#C9A84C]/10 hover:border-[#C9A84C]/50 bg-transparent"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('dashboard.reResearch')}
        </Button>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════
          1. EXECUTIVE READ
          ═══════════════════════════════════════════════════════ */}
      {read && (
        <>
          <SectionHeader
            icon={<BookOpen className="w-3.5 h-3.5" />}
            title={t('dashboard.executiveSummary')}
            id="section-executive"
          />
          <motion.div variants={itemVariants}>
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#9C7A2D] to-[#C9A84C]" />
              <CardContent className="p-5">
                <MarkdownContent content={read} />

              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          2. KPI STRIP
          ═══════════════════════════════════════════════════════ */}
      {kpiItems.length > 0 && (
        <>
          <SectionHeader
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            title={t('dashboard.kpis')}
            id="section-kpis"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiItems.map((kpi, idx) => (
              <KPICard
                key={`kpi-${idx}`}
                title={kpi.title}
                value={kpi.value}
                unit={kpi.unit}
                trend={kpi.trend}
                source={kpi.source}
                as_of={kpi.as_of}
                index={idx}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          3. TRAJECTORY
          ═══════════════════════════════════════════════════════ */}
      {trendItems.length > 0 && (
        <>
          <SectionHeader
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            title={t('dashboard.trends')}
            id="section-trajectory"
          />
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
            variants={containerVariants}
          >
            {trendItems.map((tr) => {
              const dashTrend = trendDataMap[tr.key];
              const trendDataSource = dashTrend ?? {
                unit: tr.unit,
                latest: tr.latest,
                latest_year: tr.latest_year,
                base_year: tr.latest_year - (tr.spark?.length ?? 1) + 1,
                span_years: tr.spark?.length ?? 1,
                good_up: tr.good_up,
                spark: tr.spark,
                direction: tr.direction as 'up' | 'down' | 'flat',
                source: '',
                url: '',
              };

              return (
                <motion.div key={`trend-${tr.key}`} variants={itemVariants}>
                  <TrendLineChart
                    data={trendDataSource}
                    title={tr.display || tr.key}
                    fieldKey={tr.key}
                    lang={lang}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        </>
      )}

      {Object.keys(trendDataMap).length > 0 && trendItems.length === 0 && (
        <>
          <SectionHeader
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            title={t('dashboard.trends')}
            id="section-trends-dash"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(trendDataMap).map(([key, trendData]) => (
              <TrendLineChart
                key={`trend-dash-${key}`}
                data={trendData}
                title={key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                fieldKey={key}
                lang={lang}
              />
            ))}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          4. TRADE SECTION
          ═══════════════════════════════════════════════════════ */}
      {trade && (
        <>
          <SectionHeader
            icon={<BarChart3 className="w-3.5 h-3.5" />}
            title={t('dashboard.trade')}
            id="section-trade"
          />
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-md">
              {t('trade.year')}: {trade.year}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="chart-trade-exports">
            <TradeBarChart
              data={trade.export_partners}
              title={t('trade.exportPartners')}
              lang={lang}
            />
            <TradeBarChart
              data={trade.import_partners}
              title={t('trade.importPartners')}
              lang={lang}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4" id="chart-trade-goods">
            <TradeBarChart
              data={trade.export_goods}
              title={t('trade.exportGoods')}
              lang={lang}
            />
            <TradeBarChart
              data={trade.import_goods}
              title={t('trade.importGoods')}
              lang={lang}
            />
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          5. SECTORS & ENERGY
          ═══════════════════════════════════════════════════════ */}
      {(sectorPieData.length > 0 || energyPieData.length > 0) && (
        <>
          <SectionHeader
            icon={<PieChart className="w-3.5 h-3.5" />}
            title={t('dashboard.sectorsAndEnergy')}
            id="section-sectors-energy"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sectorPieData.length > 0 && (
              <motion.div id="chart-sectors" variants={itemVariants}>
                <DomainPieChart
                  data={sectorPieData}
                  title={t('domain.sectors')}
                  lang={lang}
                />
              </motion.div>
            )}
            {energyPieData.length > 0 && (
              <motion.div id="chart-energy" variants={itemVariants}>
                <DomainPieChart
                  data={energyPieData}
                  title={t('dashboard.energy')}
                  lang={lang}
                />
              </motion.div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          6. INSIGHT PANELS
          ═══════════════════════════════════════════════════════ */}
      {(insightPanels.length > 0 || riskPanels.length > 0 || opportunityPanels.length > 0 || analysis || predictive) && (
        <>
          <SectionHeader
            icon={<Lightbulb className="w-3.5 h-3.5" />}
            title={t('dashboard.insights')}
            id="section-insights"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analysis && (
              <motion.div variants={itemVariants}>
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="h-0.5 bg-[#2C7A6B]" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-[#2C7A6B]" />
                      <span className="text-xs font-bold text-[#2C7A6B] uppercase tracking-wider">{t('dashboard.analysis')}</span>
                    </div>
                    <MarkdownContent content={analysis} />

                  </CardContent>
                </Card>
              </motion.div>
            )}

            {insightPanels.map((panel, idx) => (
              <motion.div key={`insight-${idx}`} variants={itemVariants}>
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="h-0.5 bg-[#9C7A2D]" />
                  <CardContent className="p-4">
                    <div className="text-xs font-bold text-[#9C7A2D] uppercase tracking-wider mb-3">{panel.title}</div>
                    <MarkdownContent content={panel.content} size="sm" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {opportunityPanels.map((panel, idx) => (
              <motion.div key={`opp-${idx}`} variants={itemVariants}>
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="h-0.5 bg-[#2C7A6B]" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-[#2C7A6B]" />
                      <span className="text-xs font-bold text-[#2C7A6B] uppercase tracking-wider">{panel.title}</span>
                    </div>
                    <MarkdownContent content={panel.content} size="sm" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {riskPanels.map((panel, idx) => (
              <motion.div key={`risk-${idx}`} variants={itemVariants}>
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="h-0.5 bg-[#A6492F]" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#A6492F]" />
                      <span className="text-xs font-bold text-[#A6492F] uppercase tracking-wider">{panel.title}</span>
                    </div>
                    <MarkdownContent content={panel.content} size="sm" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}

            {predictive && (
              <motion.div variants={itemVariants}>
                <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow duration-200">
                  <div className="h-0.5 bg-[#9C7A2D]" />
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-3.5 h-3.5 text-[#9C7A2D]" />
                      <span className="text-xs font-bold text-[#9C7A2D] uppercase tracking-wider">{t('dashboard.predictive')}</span>
                    </div>
                    <MarkdownContent content={predictive} size="sm" />
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          7. COUNCIL VERDICT
          ═══════════════════════════════════════════════════════ */}
      {council && (
        <>
          <SectionHeader
            icon={<ShieldCheck className="w-3.5 h-3.5" />}
            title={t('dashboard.council')}
            id="section-council"
          />
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-[#1a1a2e]/5 to-white border border-[#C9A84C]/30 rounded-xl overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#9C7A2D] to-[#C9A84C]" />
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-[#9C7A2D]" />
                  <span className="text-xs font-bold text-[#9C7A2D] uppercase tracking-wider">
                    {t('dashboard.councilDesc')}
                  </span>
                </div>
                <MarkdownContent content={council} />
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          8. NEWS & DEVELOPMENTS
          ═══════════════════════════════════════════════════════ */}
      {newsItems && newsItems.length > 0 && (
        <>
          <SectionHeader
            icon={<Newspaper className="w-3.5 h-3.5" />}
            title={t('dashboard.news')}
            id="section-news"
          />
          <motion.div variants={itemVariants}>
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {newsItems.slice(0, 5).map((item, idx) => (
                    <a
                      key={`news-${idx}`}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 rounded-lg hover:bg-gray-50 transition-colors duration-150 border border-transparent hover:border-gray-200"
                    >
                      <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.source && (
                          <span className="text-[10px] font-medium text-[#9C7A2D] bg-[#C9A84C]/10 px-1.5 py-0.5 rounded">
                            {item.source}
                          </span>
                        )}
                        {item.published && (
                          <span className="text-[10px] text-gray-400">
                            {new Date(item.published).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════
          9. UAE RELATIONS
          ═══════════════════════════════════════════════════════ */}
      {uae.length > 0 && (
        <>
          <SectionHeader
            icon={<Handshake className="w-3.5 h-3.5" />}
            title={t('domain.uae')}
            id="section-uae"
          />
          <motion.div variants={itemVariants}>
            <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="h-0.5 bg-gradient-to-r from-[#2C7A6B] to-[#3D9985]" />
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {uae.map((item, idx) => (
                    <div
                      key={`uae-${idx}`}
                      className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-all duration-150"
                    >
                      <span className="text-[11px] font-semibold text-[#2C7A6B] uppercase tracking-wider block mb-1">
                        {item.display || item.key}
                      </span>
                      <span className="text-sm font-bold text-gray-900 block">
                        {item.value != null ? String(item.value) : '—'}
                        {item.unit && (
                          <span className="text-xs font-normal text-gray-400 ml-1">{item.unit}</span>
                        )}
                      </span>
                      {item.source && (
                        <span className="text-[10px] text-gray-400 block mt-1">{item.source}</span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
}
