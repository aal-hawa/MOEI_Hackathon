'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Trend Line Chart
   Clean area chart with white tooltip, no glass effects
   ─────────────────────────────────────────────────────────────── */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import type { TrendData, Language } from '@/lib/types';
import { useLanguage } from '@/lib/LanguageContext';
import ChartWrapper from './ChartWrapper';
import ResizeContainer from './ResizeContainer';

interface TrendLineChartProps {
  data: TrendData;
  title: string;
  fieldKey: string;
  lang: Language;
  loading?: boolean;
}

/* Clean tooltip component */
function CustomTooltip({ active, payload, label, title, unit, t }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: number;
  title: string;
  unit?: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white rounded-lg px-3 py-2 shadow-lg border border-gray-200">
      <p className="text-[10px] text-gray-400 mb-0.5">
        {t('common.year')} {label}
      </p>
      <p className="text-sm font-semibold text-gray-800">
        {payload[0].value.toLocaleString()}
        {unit && <span className="text-[11px] font-normal text-gray-400 ml-1">{unit}</span>}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">{title}</p>
    </div>
  );
}

export default function TrendLineChart({
  data,
  title,
  fieldKey,
  lang,
  loading,
}: TrendLineChartProps) {
  const { t } = useLanguage();

  if (!data || !data.spark || data.spark.length === 0) {
    return (
      <ChartWrapper title={title} loading={loading}>
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          {t('app.noData')}
        </div>
      </ChartWrapper>
    );
  }

  const isRTL = lang === 'ar';

  // Determine color based on direction and good_up
  const isGoodDirection =
    (data.direction === 'up' && data.good_up) ||
    (data.direction === 'down' && !data.good_up);

  const lineColor = data.direction === 'flat'
    ? '#9CA3AF'
    : isGoodDirection
      ? '#0D9488'
      : '#DC2626';

  const areaFill = lineColor;

  // Build chart data with year labels
  const chartData = data.spark.map((value, index) => {
    const year = data.latest_year - (data.spark.length - 1 - index);
    return { year, value };
  });

  // Direction label
  const directionLabels: Record<string, string> = {
    up: t('trend.improving'),
    down: t('trend.declining'),
    flat: t('trend.stable'),
  };

  return (
    <ChartWrapper title={title} loading={loading} accentColor={lineColor}>
      {/* Direction badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold"
          style={{
            backgroundColor: `${lineColor}10`,
            color: lineColor,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: lineColor }}
          />
          {directionLabels[data.direction] || data.direction}
        </span>
        {data.cagr_pct != null && (
          <span className="text-[11px] text-gray-400">
            {t('kpi.cagr')}: <span className="font-semibold" style={{ color: lineColor }}>{data.cagr_pct.toFixed(1)}%</span>
          </span>
        )}
        {data.change_pct != null && (
          <span className="text-[11px] text-gray-400">
            {t('kpi.change')}: <span className="font-semibold" style={{ color: lineColor }}>
              {data.change_pct > 0 ? '+' : ''}{data.change_pct.toFixed(1)}%
            </span>
          </span>
        )}
      </div>

      {/* Chart */}
      <ResizeContainer className="w-full h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <defs>
              <linearGradient id={`gradient-${fieldKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={areaFill} stopOpacity={0.15} />
                <stop offset="95%" stopColor={areaFill} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={{ stroke: '#E5E7EB' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) =>
                v >= 1000000000
                  ? `${(v / 1000000000).toFixed(1)}B`
                  : v >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : v >= 1000
                      ? `${(v / 1000).toFixed(1)}K`
                      : String(v)
              }
            />
            <Tooltip
              content={<CustomTooltip title={title} unit={data.unit} t={t} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              fill={`url(#gradient-${fieldKey})`}
              dot={false}
              activeDot={{ r: 4, fill: lineColor, stroke: '#fff', strokeWidth: 2 }}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </ResizeContainer>

      {/* Source */}
      {data.source && (
        <div className="mt-2 text-[10px] text-gray-400">
          {t('common.source')}: {data.source}
        </div>
      )}
    </ChartWrapper>
  );
}
