'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Domain Pie Chart
   Clean donut chart, no glass effects
   ─────────────────────────────────────────────────────────────── */

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { Language } from '@/lib/types';
import { useLanguage } from '@/lib/LanguageContext';
import ChartWrapper from './ChartWrapper';
import ResizeContainer from './ResizeContainer';

interface DomainPieChartProps {
  data: Array<{ name: string; value: number }>;
  title: string;
  lang: Language;
  loading?: boolean;
}

// Modern palette: teal, amber, slate
const COLORS = [
  '#0D9488',
  '#C9A84C',
  '#64748B',
  '#0F766E',
  '#D4A853',
  '#475569',
  '#14B8A6',
  '#92400E',
  '#334155',
  '#5EEAD4',
  '#FCD34D',
  '#94A3B8',
];

export default function DomainPieChart({
  data,
  title,
  lang,
  loading,
}: DomainPieChartProps) {
  const { t } = useLanguage();
  const isRTL = lang === 'ar';

  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} loading={loading}>
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          {t('app.noData')}
        </div>
      </ChartWrapper>
    );
  }

  // Calculate total for center label
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <ChartWrapper title={title} loading={loading}>
      <div className="relative">
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-bold text-gray-800 tracking-tight">
            {total >= 1000000000
              ? `${(total / 1000000000).toFixed(1)}B`
              : total >= 1000000
                ? `${(total / 1000000).toFixed(1)}M`
                : total >= 1000
                  ? `${(total / 1000).toFixed(1)}K`
                  : total.toLocaleString()}
          </span>
          <span className="text-[10px] text-gray-400 uppercase tracking-widest">
            {t('common.total')}
          </span>
        </div>

        <ResizeContainer className="w-full h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={85}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => {
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
                  return [
                    `${value.toLocaleString()} (${pct}%)`,
                    name,
                  ];
                }}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #E5E7EB',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  background: 'white',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ResizeContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {data.map((item, index) => {
          const pct = total > 0 ? ((item.value / total) * 100) : 0;
          const color = COLORS[index % COLORS.length];
          return (
            <div
              key={`legend-${index}`}
              className={`flex items-center gap-2 text-[11px] ${isRTL ? 'flex-row-reverse' : ''}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-600 min-w-0 truncate flex-1">{item.name}</span>
              <span className="text-gray-400 font-medium shrink-0 w-10 text-right">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </ChartWrapper>
  );
}
