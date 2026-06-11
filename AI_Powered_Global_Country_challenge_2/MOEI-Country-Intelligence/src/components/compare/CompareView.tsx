'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Compare View
   Clean comparison with white table, proper borders, no glass
   ─────────────────────────────────────────────────────────────── */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { CompareData } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, Plus, X, Trophy, Sparkles } from 'lucide-react';

interface CompareViewProps {
  compareData: CompareData | null;
  loading: boolean;
  onCompare: (countries: string[]) => void;
}

export default function CompareView({
  compareData,
  loading,
  onCompare,
}: CompareViewProps) {
  const { t, lang, isRTL, dir } = useLanguage();
  const [countryInput, setCountryInput] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);

  const isRTLDir = isRTL;
  const ArrowIcon = isRTLDir ? ArrowLeft : ArrowRight;

  const addCountry = useCallback(() => {
    const trimmed = countryInput.trim();
    if (trimmed && selectedCountries.length < 5 && !selectedCountries.includes(trimmed)) {
      setSelectedCountries((prev) => [...prev, trimmed]);
      setCountryInput('');
    }
  }, [countryInput, selectedCountries]);

  const removeCountry = useCallback((c: string) => {
    setSelectedCountries((prev) => prev.filter((x) => x !== c));
  }, []);

  const runCompare = useCallback(() => {
    if (selectedCountries.length >= 2) {
      onCompare(selectedCountries);
    }
  }, [selectedCountries, onCompare]);

  // Determine leader for each metric
  const getLeaderForField = (
    fieldKey: string,
    countries: CompareData['countries'],
  ): number => {
    let bestIdx = -1;
    let bestVal = -Infinity;
    countries.forEach((c, idx) => {
      const field = c.fields[fieldKey];
      if (field?.found && field.value != null) {
        const num = typeof field.value === 'number' ? field.value : parseFloat(String(field.value));
        if (!isNaN(num) && num > bestVal) {
          bestVal = num;
          bestIdx = idx;
        }
      }
    });
    return bestIdx;
  };

  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
        <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
        <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-gray-50 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto px-4 py-6" dir={dir}>
      {/* Country input */}
      <Card className="bg-white border border-gray-200 rounded-xl shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-700">
            {t('compare.selectCountries')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Selected country badges */}
          <div className={`flex flex-wrap items-center gap-2 mb-3 ${isRTLDir ? 'flex-row-reverse' : ''}`}>
            <AnimatePresence>
              {selectedCountries.map((c, idx) => (
                <motion.div
                  key={c}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  <Badge
                    className="bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20 gap-1.5 pr-1.5 pl-3 py-1 text-xs font-medium rounded-md"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" />
                    {c}
                    <button
                      onClick={() => removeCountry(c)}
                      className="ml-0.5 hover:bg-[#0D9488]/15 rounded p-0.5 transition-colors"
                      aria-label={`${t('compare.removeCountry')} ${c}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                </motion.div>
              ))}
            </AnimatePresence>
            <div className={`flex items-center gap-2 ${isRTLDir ? 'flex-row-reverse' : ''}`}>
              <Input
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCountry()}
                placeholder={t('compare.addCountry')}
                className="h-8 w-44 text-sm border-gray-200 bg-white focus:border-[#0D9488]/40 focus:ring-[#0D9488]/10"
                disabled={selectedCountries.length >= 5}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCountry}
                disabled={!countryInput.trim() || selectedCountries.length >= 5}
                className="h-8 rounded-md border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className={`flex items-center gap-3 ${isRTLDir ? 'flex-row-reverse' : ''}`}>
            <Button
              onClick={runCompare}
              disabled={selectedCountries.length < 2}
              className="bg-[#0F172A] hover:bg-[#0F172A]/90 text-white rounded-md px-5"
            >
              {t('compare.sideBySide')}
              <ArrowIcon className="w-4 h-4 ml-1" />
            </Button>
            <span className="text-xs text-gray-400">
              {selectedCountries.length < 2
                ? t('compare.minCountries')
                : `${selectedCountries.length}/5 ${t('common.countries')}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Comparison table */}
      {compareData && compareData.countries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-gray-100">
              <CardTitle className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-[#C9A84C]" />
                {t('compare.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider min-w-[200px]">
                        {t('compare.indicator')}
                      </th>
                      {compareData.countries.map((c) => (
                        <th key={c.iso3} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wider min-w-[150px]">
                          {c.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {compareData.fields.map((fieldKey, rowIdx) => {
                      const leaderIdx = getLeaderForField(fieldKey, compareData.countries);
                      return (
                        <tr
                          key={fieldKey}
                          className={`border-b border-gray-50 transition-colors duration-100 ${
                            rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                          } hover:bg-[#0D9488]/3`}
                        >
                          <td className="px-4 py-2.5 text-xs font-medium text-gray-700">
                            {fieldKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </td>
                          {compareData.countries.map((c, cIdx) => {
                            const field = c.fields[fieldKey];
                            const isLeader = cIdx === leaderIdx;
                            return (
                              <td
                                key={`${c.iso3}-${fieldKey}`}
                                className={`px-4 py-2.5 text-xs transition-colors duration-100 ${
                                  isLeader
                                    ? 'bg-[#0D9488]/5 font-semibold text-[#0D9488]'
                                    : 'text-gray-600'
                                }`}
                              >
                                {field?.found ? (
                                  <span className="flex items-center gap-1.5">
                                    {isLeader && <Trophy className="w-3 h-3 text-[#C9A84C]" />}
                                    {String(field.value ?? '—')}
                                    {field.unit && (
                                      <span className="text-gray-400 font-normal text-[10px]">{field.unit}</span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-300 italic">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* AI Insight panel */}
      {compareData && compareData.countries.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.15 }}
        >
          <Card className="bg-white border border-gray-200 rounded-xl shadow-sm mt-4 overflow-hidden border-l-4 border-l-[#C9A84C]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-[#92400E] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('compare.aiInsights')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-600 leading-relaxed">
                {t('compare.comparisonSummary', {
                  countries: compareData.countries.map((c) => c.name).join(` ${t('compare.vs')} `),
                  fieldCount: compareData.fields.length,
                  domainCount: compareData.domains.length,
                })}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Empty state */}
      {!compareData && selectedCountries.length === 0 && (
        <motion.div
          className="flex flex-col items-center justify-center py-12 text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
            <Trophy className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">
            {t('compare.title')}
          </h2>
          <p className="text-sm text-gray-400 max-w-sm">
            {t('compare.selectCountries')}
          </p>
        </motion.div>
      )}
    </div>
  );
}
