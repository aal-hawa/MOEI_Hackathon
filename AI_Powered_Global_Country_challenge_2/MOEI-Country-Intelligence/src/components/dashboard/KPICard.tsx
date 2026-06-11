'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – KPI Card
   Modern card: white bg, clean border, large bold number, left accent
   ─────────────────────────────────────────────────────────────── */

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import ResizeContainer from './ResizeContainer';

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    direction: string;
    good_up: boolean;
    spark?: number[];
    cagr_pct?: number;
    change_pct?: number;
  };
  source?: string;
  as_of?: string;
  index?: number;
}

export default function KPICard({
  title,
  value,
  unit,
  trend,
  source,
  as_of,
  index = 0,
}: KPICardProps) {
  const { t } = useLanguage();

  // Determine trend color and icon
  const getTrendInfo = () => {
    if (!trend) return { color: 'text-gray-400', bg: 'bg-gray-100', icon: null, label: '' };

    const isUp = trend.direction === 'up';
    const isDown = trend.direction === 'down';
    const isGoodUp = trend.good_up;

    let color: string;
    let bg: string;
    let label: string;

    if (isUp) {
      const good = isGoodUp;
      color = good ? 'text-[#0D9488]' : 'text-[#DC2626]';
      bg = good ? 'bg-[#0D9488]/10' : 'bg-[#DC2626]/10';
      label = good ? t('kpi.up') : t('kpi.up');
    } else if (isDown) {
      const good = !isGoodUp;
      color = good ? 'text-[#0D9488]' : 'text-[#DC2626]';
      bg = good ? 'bg-[#0D9488]/10' : 'bg-[#DC2626]/10';
      label = t('kpi.down');
    } else {
      color = 'text-gray-500';
      bg = 'bg-gray-100';
      label = t('kpi.flat');
    }

    const icon = isUp ? (
      <TrendingUp className="w-3 h-3" />
    ) : isDown ? (
      <TrendingDown className="w-3 h-3" />
    ) : (
      <Minus className="w-3 h-3" />
    );

    return { color, bg, icon, label };
  };

  const trendInfo = getTrendInfo();

  // Build sparkline data
  const sparkData = trend?.spark
    ? trend.spark.map((v, i) => ({ i, v }))
    : null;

  const sparkColor = trend
    ? trend.direction === 'up'
      ? trend.good_up
        ? '#0D9488'
        : '#DC2626'
      : trend.direction === 'down'
        ? !trend.good_up
          ? '#0D9488'
          : '#DC2626'
        : '#9CA3AF'
    : '#9CA3AF';

  // Left accent border color
  const accentColor = trend
    ? trend.direction === 'up'
      ? trend.good_up ? '#0D9488' : '#DC2626'
      : trend.direction === 'down'
        ? !trend.good_up ? '#0D9488' : '#DC2626'
        : '#C9A84C'
    : '#C9A84C';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: 'easeOut' }}
      className="relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden"
      style={{
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div className="p-4">
        {/* Label */}
        <h3 className="text-[11px] font-medium text-gray-500 uppercase tracking-wider leading-tight line-clamp-2 mb-2">
          {title}
        </h3>

        {/* Value */}
        <div className="flex items-end gap-1.5 mb-1">
          <span className="text-2xl font-bold text-gray-900 leading-none tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && (
            <span className="text-xs font-medium text-gray-400 mb-0.5">{unit}</span>
          )}
        </div>

        {/* Trend badge */}
        {trend && (
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${trendInfo.color} ${trendInfo.bg}`}
            >
              {trendInfo.icon}
              {trend.change_pct != null && (
                <span>{trend.change_pct > 0 ? '+' : ''}{trend.change_pct.toFixed(1)}%</span>
              )}
            </span>
            {trend.cagr_pct != null && (
              <span className="text-[10px] text-gray-400">
                CAGR: <span className={`font-semibold ${trendInfo.color}`}>{trend.cagr_pct.toFixed(1)}%</span>
              </span>
            )}
          </div>
        )}

        {/* Sparkline */}
        {sparkData && sparkData.length > 1 && (
          <ResizeContainer className="mt-3 h-8 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 2.5, fill: sparkColor, stroke: '#fff', strokeWidth: 1 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ResizeContainer>
        )}

        {/* Source and date */}
        {(source || as_of) && (
          <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
            {source && (
              <span className="text-[10px] text-gray-400 truncate max-w-[70%]">
                {source}
              </span>
            )}
            {as_of && (
              <span className="text-[10px] text-gray-400 shrink-0">
                {as_of}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
