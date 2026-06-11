'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Report Generator
   Modern role selector with clean white cards + Recharts
   ─────────────────────────────────────────────────────────────── */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { DashboardData, TearsheetData, DossierResponse, ReportRole } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ExportButtons from '@/components/common/ExportButtons';
import {
  Crown,
  Shield,
  Briefcase,
  Users,
  FileText,
  TrendingUp,
  AlertTriangle,
  Sparkles,
  BarChart3,
  Database,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  CartesianGrid,
} from 'recharts';
import ChartWrapper from '@/components/dashboard/ChartWrapper';
import ResizeContainer from '@/components/dashboard/ResizeContainer';
import MarkdownContent from '@/components/common/MarkdownContent';

interface ReportGeneratorProps {
  dashboardData: DashboardData | null;
  tearsheetData: TearsheetData | null;
  dossierData: DossierResponse | null;
  loading: boolean;
}

const roles: { key: ReportRole; icon: React.ReactNode; color: string }[] = [
  { key: 'minister', icon: <Crown className="w-4 h-4" />, color: '#C9A84C' },
  { key: 'deputy', icon: <Shield className="w-4 h-4" />, color: '#0D9488' },
  { key: 'client', icon: <Briefcase className="w-4 h-4" />, color: '#C9A84C' },
  { key: 'manager', icon: <Users className="w-4 h-4" />, color: '#0D9488' },
  { key: 'team', icon: <FileText className="w-4 h-4" />, color: '#64748B' },
];

// MOEI color palette for charts
const CHART_COLORS = ['#C9A84C', '#0D9488', '#DC2626', '#64748B', '#2C7A6B', '#9C7A2D', '#3D9985', '#A6492F', '#475569', '#14B8A6'];
const PIE_COLORS = ['#C9A84C', '#0D9488', '#64748B', '#2C7A6B', '#9C7A2D', '#DC2626', '#3D9985', '#A6492F', '#475569', '#14B8A6'];

const tooltipStyle = {
  borderRadius: '8px',
  border: '1px solid #E5E7EB',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  background: 'white',
};

export default function ReportGenerator({
  dashboardData,
  tearsheetData,
  dossierData,
  loading,
}: ReportGeneratorProps) {
  const { t, lang } = useLanguage();
  const [activeRole, setActiveRole] = useState<ReportRole>('minister');

  const headline = tearsheetData?.headline ?? [];
  const trajectory = tearsheetData?.trajectory ?? [];
  const trade = tearsheetData?.trade ?? dashboardData?.data?.trade ?? null;
  const sectors = tearsheetData?.sectors ?? [];
  const energy = tearsheetData?.energy ?? [];
  const uae = tearsheetData?.uae ?? [];
  const read = tearsheetData?.read ?? null;
  const insightPanels = dashboardData?.dashboard?.insight_panels ?? [];
  const riskPanels = dashboardData?.dashboard?.risk_panels ?? [];
  const opportunityPanels = dashboardData?.dashboard?.opportunity_panels ?? [];
  const analysis = dashboardData?.data?.analysis ?? null;
  const fields = dossierData?.fields ?? [];
  const foundFields = fields.filter((f) => f.value != null);
  const totalFields = fields.length;
  const coveragePct = totalFields > 0 ? Math.round((foundFields.length / totalFields) * 100) : 0;

  // ── Chart data preparation ──────────────────────────────────

  // Sector distribution data (for minister pie chart)
  const sectorPieData = useMemo(() =>
    sectors.map((s, i) => ({
      name: s.display || s.key,
      value: typeof s.value === 'number' ? s.value : parseFloat(String(s.value)) || 10 - i,
    })).slice(0, 8),
  [sectors]);

  // Minister KPI bar data
  const ministerKpiBarData = useMemo(() =>
    headline.slice(0, 6).map((h) => {
      const numVal = parseFloat(String(h.key).replace(/[^0-9.-]/g, ''));
      return {
        name: h.display.length > 15 ? h.display.slice(0, 15) + '…' : h.display,
        value: isNaN(numVal) ? 0 : numVal,
        unit: h.unit || '',
      };
    }),
  [headline]);

  // Export partners bar data
  const exportPartnerData = useMemo(() =>
    trade?.export_partners?.slice(0, 6).map((p) => ({
      name: p.name,
      value: p.share_pct,
    })) ?? [],
  [trade]);

  // Deputy trajectory trend data
  const trajectoryChartData = useMemo(() => {
    const merged = trajectory.slice(0, 4).flatMap((tr) => {
      const latestYear = tr.latest_year || 2024;
      return (tr.spark || []).map((val, idx) => ({
        year: latestYear - (tr.spark.length - 1 - idx),
        [tr.display || tr.key]: val,
      }));
    }).reduce<Record<number, Record<string, number>>>((acc, point) => {
      const year = point.year;
      if (!acc[year]) acc[year] = { year };
      Object.entries(point).forEach(([k, v]) => {
        if (k !== 'year') acc[year][k] = v as number;
      });
      return acc;
    }, {} as Record<number, Record<string, number>>);
    return Object.values(merged).sort((a, b) => (a.year as number) - (b.year as number));
  }, [trajectory]);

  // Deputy risk vs opportunity data
  const riskOppData = useMemo(() => [
    { name: t('dashboard.risks'), value: riskPanels.length, fill: '#DC2626' },
    { name: t('dashboard.opportunities'), value: opportunityPanels.length, fill: '#0D9488' },
  ], [riskPanels.length, opportunityPanels.length, t]);

  // Client trade partner comparison data
  const clientTradeData = useMemo(() => {
    if (!trade) return [];
    const expPartners = trade.export_partners?.slice(0, 5) ?? [];
    const impPartners = trade.import_partners?.slice(0, 5) ?? [];
    const allNames = [...new Set([...expPartners.map(p => p.name), ...impPartners.map(p => p.name)])];
    return allNames.slice(0, 6).map(name => {
      const exp = expPartners.find(p => p.name === name);
      const imp = impPartners.find(p => p.name === name);
      return {
        name,
        [t('trade.exports')]: exp?.share_pct ?? 0,
        [t('trade.imports')]: imp?.share_pct ?? 0,
      };
    });
  }, [trade, t]);

  // Client UAE relations pie data
  const uaePieData = useMemo(() =>
    uae.slice(0, 6).map((item, i) => ({
      name: item.display || item.key,
      value: typeof item.value === 'number' ? item.value : 10 + i * 5,
    })),
  [uae]);

  // Manager KPI metrics bar data
  const managerKpiData = useMemo(() =>
    headline.slice(0, 8).map((h) => {
      const numVal = parseFloat(String(h.key).replace(/[^0-9.-]/g, ''));
      return {
        name: h.display.length > 12 ? h.display.slice(0, 12) + '…' : h.display,
        value: isNaN(numVal) ? 0 : numVal,
      };
    }),
  [headline]);

  // Manager energy distribution data (unique to manager role)
  const managerEnergyData = useMemo(() =>
    energy.slice(0, 6).map((e, i) => ({
      name: e.display || e.key,
      value: typeof e.value === 'number' ? e.value : parseFloat(String(e.value)) || 10 - i,
    })),
  [energy]);

  // Team coverage pie data
  const coveragePieData = useMemo(() => [
    { name: t('reports.fieldsFound'), value: foundFields.length, fill: '#0D9488' },
    { name: t('reports.missingFields'), value: totalFields - foundFields.length, fill: '#E5E7EB' },
  ], [foundFields.length, totalFields, t]);

  // Team domain distribution data
  const domainDistData = useMemo(() => {
    const domainMap: Record<string, number> = {};
    fields.forEach((f) => {
      const rawDomain = f.domain || 'other';
      const d = t(`domain.${rawDomain}`) !== `domain.${rawDomain}` ? t(`domain.${rawDomain}`) : rawDomain;
      domainMap[d] = (domainMap[d] || 0) + 1;
    });
    return Object.entries(domainMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [fields, t]);

  // Team confidence distribution data
  const confidenceDistData = useMemo(() => {
    const confMap: Record<string, number> = {};
    fields.forEach((f) => {
      const rawConf = f.confidence || 'unknown';
      const c = t(`confidence.${rawConf}`) !== `confidence.${rawConf}` ? t(`confidence.${rawConf}`) : rawConf;
      confMap[c] = (confMap[c] || 0) + 1;
    });
    return Object.entries(confMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [fields, t]);

  const reportData = useMemo(() => ({
    role: activeRole,
    country: dashboardData?.iso3 ?? tearsheetData?.iso3 ?? '',
    country_name: tearsheetData?.country ?? dashboardData?.dashboard?.country ?? '',
    generated_at: new Date().toISOString(),
    headline,
    trajectory,
    trade,
    sectors,
    energy,
    uae,
    read,
    analysis,
    insights: insightPanels,
    risks: riskPanels,
    opportunities: opportunityPanels,
    coverage: { found: foundFields.length, total: totalFields, pct: coveragePct },
    fields: fields.map(f => ({
      field_name: f.field_name,
      domain: f.domain,
      value: f.value,
      source_url: f.source_url,
      confidence: f.confidence,
      corroborated: f.corroborated,
    })),
    sources: [
      ...new Map(
        fields
          .filter(f => f.source_url)
          .map(f => [f.source_url!, {
            label: f.source_name ?? f.source_url!,
            url: f.source_url!,
            domain: f.source_url!.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0],
            verified: f.corroborated >= 2 || f.confidence === 'high',
          }])
          .values()
      ).values(),
    ].map(s => s),
  }), [activeRole, dashboardData, tearsheetData, headline, trajectory, trade, sectors, energy, uae, read, analysis, insightPanels, riskPanels, opportunityPanels, foundFields.length, totalFields, coveragePct, fields]);

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
        <div className="flex gap-3 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-32 bg-white border border-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse space-y-3">
          <div className="h-5 w-48 bg-gray-100 rounded" />
          <div className="h-4 w-full bg-gray-50 rounded" />
          <div className="h-4 w-3/4 bg-gray-50 rounded" />
        </div>
      </div>
    );
  }

  if (!dashboardData && !tearsheetData && !dossierData) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <motion.div
          className="flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">
            {t('reports.title')}
          </h2>
          <p className="text-sm text-gray-400 max-w-sm">
            {t('reports.noCountry')}
          </p>
        </motion.div>
      </div>
    );
  }

  // ── Role-specific renderers ──────────────────────────────

  const renderMinisterReport = () => (
    <div className="space-y-4" id="report-content">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-1 h-8 rounded-full bg-[#C9A84C]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('report.minister.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {dashboardData?.iso3 ?? tearsheetData?.iso3 ?? ''} · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}
          </p>
        </div>
      </div>

      {headline.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {headline.slice(0, 4).map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow"
              style={{ borderLeft: `4px solid ${i % 2 === 0 ? '#C9A84C' : '#0D9488'}` }}
            >
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{h.display}</p>
              <p className="text-xl font-bold text-gray-900 mt-1 tracking-tight">{h.key} <span className="text-xs font-normal text-gray-400">{h.unit}</span></p>
            </motion.div>
          ))}
        </div>
      )}

      {read && (
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="h-0.5 bg-[#C9A84C]" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">{t('dashboard.executiveSummary')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownContent content={read} size="sm" />
          </CardContent>
        </Card>
      )}

      <Card className="bg-white border border-gray-200 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider">
            {t('reports.talkingPoints')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {opportunityPanels.slice(0, 2).map((p, i) => (
              <li key={i} className="flex gap-3 text-sm text-gray-700">
                <div className="flex-shrink-0 w-5 h-5 rounded bg-[#0D9488]/10 flex items-center justify-center mt-0.5">
                  <Sparkles className="w-3 h-3 text-[#0D9488]" />
                </div>
                <MarkdownContent content={p.content} size="sm" />
              </li>
            ))}
            {riskPanels.slice(0, 1).map((p, i) => (
              <li key={`risk-${i}`} className="flex gap-3 text-sm text-gray-700">
                <div className="flex-shrink-0 w-5 h-5 rounded bg-[#DC2626]/10 flex items-center justify-center mt-0.5">
                  <AlertTriangle className="w-3 h-3 text-[#DC2626]" />
                </div>
                <MarkdownContent content={p.content} size="sm" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Minister Charts: Sector Pie + Export Partners Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sectorPieData.length > 0 && (
          <ChartWrapper title={t('reports.keyMetrics')} accentColor="#C9A84C">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-gray-800">{sectorPieData.length}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest">
                  {t('domain.sectors')}
                </span>
              </div>
              <ResizeContainer className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sectorPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {sectorPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ResizeContainer>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {sectorPieData.map((item, index) => (
                  <div key={`legend-${index}`} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-gray-500 truncate max-w-[80px]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartWrapper>
        )}

        {exportPartnerData.length > 0 && (
          <ChartWrapper title={t('trade.exportPartners')} accentColor="#0D9488">
            <ResizeContainer className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={exportPartnerData} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} width={100} orientation={lang === 'ar' ? 'right' : 'left'} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(value: number) => [`${value.toFixed(1)}%`, t('trade.share')]} contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18} fill="#0D9488" animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}
      </div>
    </div>
  );

  const renderDeputyReport = () => (
    <div className="space-y-4" id="report-content">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-1 h-8 rounded-full bg-[#0D9488]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('report.deputy.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {dashboardData?.iso3 ?? tearsheetData?.iso3 ?? ''} · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}
          </p>
        </div>
      </div>

      {headline.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {headline.slice(0, 8).map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white border border-gray-200 rounded-xl p-3 hover:shadow-md transition-shadow"
            >
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">{h.display}</p>
              <p className="text-lg font-bold text-gray-900 mt-1 tracking-tight">{h.key} <span className="text-xs font-normal text-gray-400">{h.unit}</span></p>
              {h.trend && (
                <Badge variant="outline" className="mt-1.5 text-[10px] rounded-md px-2 border-gray-200">
                  {h.trend.direction === 'up' ? '↑' : h.trend.direction === 'down' ? '↓' : '→'}
                  {h.trend.change_pct != null && ` ${h.trend.change_pct.toFixed(1)}%`}
                </Badge>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {read && (
        <Card className="bg-white border border-gray-200 rounded-xl">
          <CardContent className="p-4">
            <MarkdownContent content={read} size="sm" />
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #0D9488' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider">{t('dashboard.analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownContent content={analysis} size="sm" />
          </CardContent>
        </Card>
      )}

      {/* Deputy Charts: Trajectory Line Chart + Risk/Opportunity Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trajectoryChartData.length > 0 && trajectory.length > 0 && (
          <ChartWrapper title={t('dashboard.trends')} accentColor="#0D9488">
            <ResizeContainer className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trajectoryChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {trajectory.slice(0, 4).map((tr, i) => (
                    <Line
                      key={tr.key}
                      type="monotone"
                      dataKey={tr.display || tr.key}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={false}
                      animationDuration={800}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}

        {(riskPanels.length > 0 || opportunityPanels.length > 0) && (
          <ChartWrapper title={t('reports.riskOverview')} accentColor="#DC2626">
            <ResizeContainer className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskOppData} margin={{ top: 20, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={48} animationDuration={800}>
                    {riskOppData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {riskPanels.length > 0 && (
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #DC2626' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-[#DC2626] uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('dashboard.risks')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {riskPanels.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-medium text-gray-700">{p.title}</p>
                  <MarkdownContent content={p.content} size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {opportunityPanels.length > 0 && (
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #0D9488' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                {t('dashboard.opportunities')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {opportunityPanels.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-medium text-gray-700">{p.title}</p>
                  <MarkdownContent content={p.content} size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderClientReport = () => (
    <div className="space-y-4" id="report-content">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-1 h-8 rounded-full bg-[#C9A84C]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('report.client.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {dashboardData?.iso3 ?? tearsheetData?.iso3 ?? ''} · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}
          </p>
        </div>
      </div>

      {headline.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
            {t('reports.countrySnapshot')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {headline.slice(0, 6).map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white border border-gray-200 rounded-xl p-3"
              >
                <p className="text-[11px] text-gray-500 uppercase font-medium">{h.display}</p>
                <p className="text-sm font-bold text-gray-900 mt-1 tracking-tight">{h.key} <span className="text-xs text-gray-400">{h.unit}</span></p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {read && (
        <Card className="bg-white border border-gray-200 rounded-xl">
          <CardContent className="p-4">
            <MarkdownContent content={read} size="sm" />
          </CardContent>
        </Card>
      )}

      {/* Client Charts: Trade Bar Chart + UAE Relations Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clientTradeData.length > 0 && (
          <ChartWrapper title={t('reports.tradeAnalysis')} accentColor="#C9A84C">
            <ResizeContainer className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientTradeData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}%`} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={t('trade.exports')} fill="#C9A84C" radius={[4, 4, 0, 0]} barSize={18} animationDuration={800} />
                  <Bar dataKey={t('trade.imports')} fill="#0D9488" radius={[4, 4, 0, 0]} barSize={18} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}

        {uaePieData.length > 0 && (
          <ChartWrapper title={t('reports.investmentHighlights')} accentColor="#0D9488">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-gray-800">{uaePieData.length}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest">{t('domain.uae')}</span>
              </div>
              <ResizeContainer className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={uaePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {uaePieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ResizeContainer>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {uaePieData.map((item, index) => (
                  <div key={`legend-${index}`} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                    <span className="text-gray-500 truncate max-w-[80px]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartWrapper>
        )}
      </div>

      {uae.length > 0 && (
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="h-0.5 bg-[#0D9488]" />
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider">{t('domain.uae')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {uae.map((item, i) => (
                <div key={i} className="flex justify-between text-xs p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                  <span className="text-gray-500">{item.display || item.key}</span>
                  <span className="font-semibold text-gray-700">{item.value != null ? String(item.value) : '—'}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderManagerReport = () => (
    <div className="space-y-4" id="report-content">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-1 h-8 rounded-full bg-[#0D9488]" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('report.manager.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {dashboardData?.iso3 ?? tearsheetData?.iso3 ?? ''} · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}
          </p>
        </div>
      </div>

      {headline.length > 0 && (
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5" />
            {t('dashboard.kpis')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {headline.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-white border border-gray-200 rounded-xl p-3"
              >
                <p className="text-[11px] text-gray-500 uppercase font-medium">{h.display}</p>
                <p className="text-sm font-bold text-gray-900 mt-1 tracking-tight">{h.key} <span className="text-xs text-gray-400">{h.unit}</span></p>
                {h.trend && (
                  <Badge variant="outline" className="mt-1.5 text-[10px] rounded-md px-2 border-gray-200">
                    {h.trend.direction === 'up' ? '↑' : h.trend.direction === 'down' ? '↓' : '→'}
                    {h.trend.change_pct != null && ` ${h.trend.change_pct.toFixed(1)}%`}
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Manager Charts: Horizontal KPI Bar + Energy Donut (distinct from other roles) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {managerKpiData.length > 0 && (
          <ChartWrapper title={t('reports.departmentalMetrics')} accentColor="#64748B">
            <ResizeContainer className="w-full h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={managerKpiData} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#374151' }} width={90} orientation={lang === 'ar' ? 'right' : 'left'} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} animationDuration={800}>
                    {managerKpiData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}

        {managerEnergyData.length > 0 && (
          <ChartWrapper title={t('domain.energy')} accentColor="#9C7A2D">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-gray-800">{managerEnergyData.length}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest">
                  {t('domain.energy')}
                </span>
              </div>
              <ResizeContainer className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={managerEnergyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {managerEnergyData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#9C7A2D', '#2C7A6B', '#C9A84C', '#A6492F', '#3D9985', '#64748B'][index % 6]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ResizeContainer>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {managerEnergyData.map((item, index) => (
                  <div key={`legend-${index}`} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ['#9C7A2D', '#2C7A6B', '#C9A84C', '#A6492F', '#3D9985', '#64748B'][index % 6] }} />
                    <span className="text-gray-500 truncate max-w-[80px]">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartWrapper>
        )}
      </div>

      {trade && (
        <Card className="bg-white border border-gray-200 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider">{t('dashboard.trade')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('trade.exportPartners')}</h4>
                {trade.export_partners.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-50 hover:bg-gray-50 transition-colors rounded px-1">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="text-gray-500 font-medium">{p.share_pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
              <div>
                <h4 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('trade.importPartners')}</h4>
                {trade.import_partners.slice(0, 5).map((p, i) => (
                  <div key={i} className="flex justify-between text-xs py-1.5 border-b border-gray-50 hover:bg-gray-50 transition-colors rounded px-1">
                    <span className="text-gray-700">{p.name}</span>
                    <span className="text-gray-500 font-medium">{p.share_pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (
        <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #0D9488' }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider">{t('dashboard.analysis')}</CardTitle>
          </CardHeader>
          <CardContent>
            <MarkdownContent content={analysis} size="sm" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {riskPanels.length > 0 && (
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #DC2626' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-[#DC2626] uppercase tracking-wider">{t('dashboard.risks')}</CardTitle>
            </CardHeader>
            <CardContent>
              {riskPanels.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-medium text-gray-700">{p.title}</p>
                  <MarkdownContent content={p.content} size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
        {opportunityPanels.length > 0 && (
          <Card className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: '4px solid #0D9488' }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold text-[#0D9488] uppercase tracking-wider">{t('dashboard.opportunities')}</CardTitle>
            </CardHeader>
            <CardContent>
              {opportunityPanels.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-xs font-medium text-gray-700">{p.title}</p>
                  <MarkdownContent content={p.content} size="sm" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  const renderTeamReport = () => (
    <div className="space-y-4" id="report-content">
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
        <div className="w-1 h-8 rounded-full bg-gray-400" />
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('report.team.title')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {dashboardData?.iso3 ?? tearsheetData?.iso3 ?? ''} · {new Date().toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-US')}
          </p>
        </div>
      </div>

      <Card className="bg-white border border-gray-200 rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-3.5 h-3.5" />
            {t('reports.coverageMetrics')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-3 rounded-xl bg-[#0D9488]/5 border border-[#0D9488]/10">
              <p className="text-2xl font-bold text-[#0D9488]">{foundFields.length}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('reports.fieldsFound')}</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-2xl font-bold text-gray-500">{totalFields}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('reports.totalFields')}</p>
            </div>
            <div className="p-3 rounded-xl bg-[#C9A84C]/5 border border-[#C9A84C]/10">
              <p className="text-2xl font-bold text-[#92400E]">{coveragePct}%</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('reports.coverage')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Charts: Coverage Pie + Domain Bar + Confidence Donut */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {totalFields > 0 && (
          <ChartWrapper title={t('reports.dataCoverage')} accentColor="#0D9488">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-gray-800">{coveragePct}%</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest">{t('reports.coverage')}</span>
              </div>
              <ResizeContainer className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={coveragePieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {coveragePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ResizeContainer>
            </div>
          </ChartWrapper>
        )}

        {domainDistData.length > 0 && (
          <ChartWrapper title={t('reports.domainDistribution')} accentColor="#C9A84C">
            <ResizeContainer className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={domainDistData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#9CA3AF' }} axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20} animationDuration={800}>
                    {domainDistData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ResizeContainer>
          </ChartWrapper>
        )}

        {confidenceDistData.length > 0 && (
          <ChartWrapper title={t('reports.confidenceDistribution')} accentColor="#64748B">
            <div className="relative">
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-gray-800">{confidenceDistData.length}</span>
                <span className="text-[9px] text-gray-400 uppercase tracking-widest">{t('reports.confidence')}</span>
              </div>
              <ResizeContainer className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={confidenceDistData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={68}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                      animationDuration={800}
                    >
                      {confidenceDistData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </ResizeContainer>
              <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1">
                {confidenceDistData.map((item, index) => (
                  <div key={`legend-${index}`} className="flex items-center gap-1 text-[9px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <span className="text-gray-500">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartWrapper>
        )}
      </div>

      {fields.length > 0 && (
        <Card className="bg-white border border-gray-200 rounded-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-gray-700 uppercase tracking-wider">
              {t('reports.rawDataTable')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-96 overflow-y-auto custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('reports.field')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('reports.value')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('reports.domain')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('reports.source')}</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('reports.confidence')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((f, i) => (
                    <tr key={i} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${f.value == null ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-700 font-medium">{f.field_name}</td>
                      <td className="px-3 py-1.5 text-gray-800 font-semibold">{f.value ?? '—'}</td>
                      <td className="px-3 py-1.5 text-gray-500">{f.domain}</td>
                      <td className="px-3 py-1.5 text-gray-500">{f.source_name ?? '—'}</td>
                      <td className="px-3 py-1.5">
                        <Badge variant="outline" className="text-[9px] rounded-md">{f.confidence}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderReport = () => {
    switch (activeRole) {
      case 'minister': return renderMinisterReport();
      case 'deputy': return renderDeputyReport();
      case 'client': return renderClientReport();
      case 'manager': return renderManagerReport();
      case 'team': return renderTeamReport();
    }
  };

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Role selector - clean cards */}
      <div className="mb-6">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">{t('reports.selectRole')}</h3>
        <div className="flex gap-2 flex-wrap">
          {roles.map(({ key, icon, color }) => {
            const isActive = activeRole === key;
            return (
              <motion.button
                key={key}
                onClick={() => setActiveRole(key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#0F172A] text-white shadow-md'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <span style={{ color: isActive ? color : undefined }}>{icon}</span>
                <span>{t(`role.${key}`)}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeRoleBar"
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ backgroundColor: color }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        <p className="mt-2 text-xs text-gray-400 max-w-2xl leading-relaxed">
          {t(`role.${activeRole}.desc`)}
        </p>
      </div>

      {/* Export buttons */}
      <div className="mb-4 flex justify-end">
        <ExportButtons
          data={reportData}
          elementId="report-content"
          filenamePrefix={`MOEI-Report-${activeRole}-${dashboardData?.iso3 ?? tearsheetData?.iso3 ?? 'country'}`}
          lang={lang}
          countryIso={dashboardData?.iso3 ?? tearsheetData?.iso3 ?? dossierData?.iso3}
        />
      </div>

      {/* Report content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeRole}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {renderReport()}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
