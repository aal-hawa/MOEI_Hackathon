'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Chart Wrapper
   Clean white card with subtle border, no glass effects
   ─────────────────────────────────────────────────────────────── */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ChartWrapperProps {
  title: string;
  purpose?: string;
  children: ReactNode;
  loading?: boolean;
  accentColor?: string;
}

export default function ChartWrapper({
  title,
  purpose,
  children,
  loading,
  accentColor = '#2C7A6B',
}: ChartWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Card className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div
              className="w-1 h-5 rounded-full shrink-0"
              style={{ backgroundColor: accentColor }}
            />
            <CardTitle className="text-sm font-semibold text-gray-900 tracking-tight">
              {title}
            </CardTitle>
          </div>
          {purpose && (
            <CardDescription className="text-xs text-gray-400">
              {purpose}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4 bg-gray-100" />
              <Skeleton className="h-[200px] w-full rounded-lg bg-gray-50" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-16 bg-gray-100" />
                <Skeleton className="h-3 w-16 bg-gray-100" />
                <Skeleton className="h-3 w-16 bg-gray-100" />
              </div>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
