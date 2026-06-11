'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Trade Bar Chart
   Clean horizontal bars with white tooltip, no glass effects
   ─────────────────────────────────────────────────────────────── */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { TradePartner, TradeGoods, Language } from '@/lib/types';
import { useLanguage } from '@/lib/LanguageContext';
import ChartWrapper from './ChartWrapper';
import ResizeContainer from './ResizeContainer';

interface TradeBarChartProps {
  data: TradePartner[] | TradeGoods[];
  title: string;
  lang: Language;
  loading?: boolean;
}

export default function TradeBarChart({
  data,
  title,
  lang,
  loading,
}: TradeBarChartProps) {
  const { t } = useLanguage();

  if (!data || data.length === 0) {
    return (
      <ChartWrapper title={title} loading={loading}>
        <div className="flex items-center justify-center h-48 text-sm text-gray-400">
          {t('app.noData')}
        </div>
      </ChartWrapper>
    );
  }

  // Sort data by share_pct descending and take top 10
  const sorted = [...data]
    .sort((a, b) => b.share_pct - a.share_pct)
    .slice(0, 10);

  const isRTL = lang === 'ar';

  return (
    <ChartWrapper title={title} loading={loading} accentColor="#C9A84C">
      <ResizeContainer className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 5, right: 60, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#374151' }}
              width={120}
              orientation={isRTL ? 'right' : 'left'}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `${value.toFixed(1)}%`,
                name === 'share_pct' ? t('trade.share') : name,
              ]}
              contentStyle={{
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                background: 'white',
              }}
            />
            <Bar
              dataKey="share_pct"
              radius={[0, 4, 4, 0]}
              barSize={20}
              fill="#C9A84C"
              animationDuration={800}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="share_pct"
                position="right"
                formatter={(v: number) => `${v.toFixed(1)}%`}
                style={{ fontSize: 10, fill: '#6B7280', fontWeight: 500 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ResizeContainer>
    </ChartWrapper>
  );
}
