'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Country Profile
   Clean accordion with left accent borders + inline field editing
   ─────────────────────────────────────────────────────────────── */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type { DossierResponse, CountryField, FieldHistoryEntry } from '@/lib/types';
import { editField, fetchFieldHistory, logUserAction } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  Database,
  Shield,
  CheckCircle2,
  Pencil,
  History,
  Loader2,
  X,
} from 'lucide-react';

interface CountryProfileProps {
  dossierData: DossierResponse | null;
  loading: boolean;
  onFieldEdited?: () => void;
}

/* ── Domain order ──────────────────────────────────────────── */
const domainOrder = [
  'identity',
  'economy',
  'energy',
  'infrastructure',
  'sustainability',
  'innovation',
  'uae_relations',
  'trade',
  'sectors',
  'demographics',
  'geography',
  'governance',
  'health',
  'education',
  'defense',
  'agriculture',
];

/* ── Domain accent colors ──────────────────────────────────── */
const domainAccentColors: Record<string, string> = {
  identity: '#C9A84C',
  economy: '#0D9488',
  energy: '#DC2626',
  infrastructure: '#C9A84C',
  sustainability: '#0D9488',
  innovation: '#6366F1',
  uae_relations: '#0D9488',
  trade: '#C9A84C',
  sectors: '#64748B',
  demographics: '#0D9488',
  geography: '#DC2626',
  governance: '#0D9488',
  health: '#C9A84C',
  education: '#64748B',
  defense: '#DC2626',
  agriculture: '#0D9488',
};

/* ── Confidence badge color ─────────────────────────────────── */
function confidenceColor(conf: string): string {
  switch (conf) {
    case 'high':
      return 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20';
    case 'medium':
      return 'bg-[#C9A84C]/10 text-[#92400E] border-[#C9A84C]/20';
    case 'low':
      return 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20';
    default:
      return 'bg-gray-100 text-gray-500 border-gray-200';
  }
}

export default function CountryProfile({
  dossierData,
  loading,
  onFieldEdited,
}: CountryProfileProps) {
  const { t, lang } = useLanguage();
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());

  // Field editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Field history state
  const [historyField, setHistoryField] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<FieldHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Group fields by domain
  const grouped = useMemo(() => {
    if (!dossierData?.fields) return {};

    const map: Record<string, CountryField[]> = {};
    for (const field of dossierData.fields) {
      const domain = field.domain || 'other';
      if (!map[domain]) map[domain] = [];
      map[domain].push(field);
    }

    return map;
  }, [dossierData]);

  // Coverage stats
  const found = dossierData?.fields.filter((f) => f.value != null).length ?? 0;
  const total = dossierData?.fields.length ?? 0;
  const coveragePct = total > 0 ? Math.round((found / total) * 100) : 0;

  // Toggle domain expansion
  const toggleDomain = (domain: string) => {
    setExpandedDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      return next;
    });
  };

  // Start editing a field
  const startEdit = (field: CountryField) => {
    setEditingField(field.field_name);
    setEditValue(field.value || '');
    setEditSource(field.source_name || '');
    setEditNote('');
    setHistoryField(null);
  };

  // Save field edit
  const saveEdit = async () => {
    if (!dossierData || !editingField) return;
    setEditSaving(true);
    try {
      await editField(dossierData.iso3, editingField, {
        value: editValue,
        source: editSource || undefined,
        note: editNote || undefined,
        changed_by: 'web_user',
      });
      await logUserAction('edit_field', `Edited ${editingField}`, dossierData.iso3);
      setEditingField(null);
      onFieldEdited?.();
    } catch {
      // Silently fail
    }
    setEditSaving(false);
  };

  // Show field history
  const showHistory = async (countryIso: string, fieldName: string) => {
    setHistoryField(fieldName);
    setHistoryLoading(true);
    try {
      const data = await fetchFieldHistory(countryIso, fieldName);
      setHistoryData(data);
    } catch {
      setHistoryData([]);
    }
    setHistoryLoading(false);
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
          <div className="h-4 w-32 bg-gray-100 rounded mb-4" />
          <div className="h-2 w-full bg-gray-50 rounded" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse">
            <div className="h-5 w-40 bg-gray-100 rounded mb-3" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-50 rounded w-full" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // No data state
  if (!dossierData) {
    return (
      <div className="max-w-screen-xl mx-auto px-4 py-12">
        <motion.div
          className="flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center mb-5">
            <Database className="w-8 h-8 text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-700 mb-2">
            {t('profile.title')}
          </h2>
          <p className="text-sm text-gray-400 max-w-sm">
            {t('profile.selectCountryDesc')}
          </p>
        </motion.div>
      </div>
    );
  }

  // Sort domains by defined order
  const sortedDomains = Object.keys(grouped).sort(
    (a, b) => {
      const ia = domainOrder.indexOf(a);
      const ib = domainOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    },
  );

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6 space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Coverage bar */}
      <Card className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-gray-700">
                {t('profile.dossier')} — {dossierData.iso3}
              </span>
            </div>
            <span className="text-sm font-semibold text-[#0D9488]">
              {t('profile.fieldCount', { found, total })}
            </span>
          </div>
          <Progress value={coveragePct} className="h-2 bg-gray-100" />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-gray-400">{coveragePct}% {t('common.coverage')}</span>
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-[#0D9488]" />
              <span className="text-[10px] text-[#0D9488] font-medium">{found} {t('common.fields')}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domain sections */}
      {sortedDomains.map((domain, domainIdx) => {
        const fields = grouped[domain];
        const isExpanded = expandedDomains.has(domain);
        const domainFound = fields.filter((f) => f.value != null).length;
        const domainLabel = (() => {
          const translated = t(`domain.${domain}`);
          // If t() returned the key itself (not found), fall back to pretty-printed domain name
          return translated === `domain.${domain}`
            ? domain.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : translated;
        })();
        const accentColor = domainAccentColors[domain] || '#64748B';

        return (
          <motion.div
            key={domain}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: domainIdx * 0.03 }}
          >
            <Card
              className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden"
              style={{ borderLeft: `4px solid ${accentColor}` }}
            >
              {/* Domain header - clickable */}
              <button
                className="w-full text-left"
                onClick={() => toggleDomain(domain)}
                aria-expanded={isExpanded}
              >
                <CardHeader className="py-3 px-5 border-b border-gray-100 group hover:bg-gray-50 transition-colors duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-500" />
                      )}
                      <CardTitle className="text-sm font-semibold text-gray-800">
                        {domainLabel}
                      </CardTitle>
                      <span className="text-[10px] text-gray-400 font-normal">
                        {domainFound}/{fields.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${fields.length > 0 ? (domainFound / fields.length) * 100 : 0}%`,
                            backgroundColor: accentColor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </button>

              {/* Fields table with animated expand/collapse */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {t('common.name')}
                              </th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {t('common.value')}
                              </th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {t('common.source')}
                              </th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {t('common.date')}
                              </th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                {t('profile.confidence')}
                              </th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider w-20">
                                {t('common.actions')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map((field, idx) => (
                              <tr
                                key={`${field.field_name}-${idx}`}
                                className={`border-b border-gray-50 hover:bg-gray-50 transition-colors duration-100 ${
                                  field.value == null ? 'opacity-40' : ''
                                }`}
                              >
                                <td className="px-4 py-2.5">
                                  <span
                                    className={`text-xs ${
                                      field.value == null
                                        ? 'italic text-gray-400'
                                        : 'text-gray-700 font-medium'
                                    }`}
                                  >
                                    {field.field_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {editingField === field.field_name ? (
                                    <div className="space-y-2 min-w-[200px]">
                                      <Input
                                        value={editValue}
                                        onChange={e => setEditValue(e.target.value)}
                                        className="text-xs h-7"
                                        placeholder={t('field.newValue')}
                                      />
                                      <Input
                                        value={editSource}
                                        onChange={e => setEditSource(e.target.value)}
                                        className="text-xs h-7"
                                        placeholder={t('field.source')}
                                      />
                                      <Input
                                        value={editNote}
                                        onChange={e => setEditNote(e.target.value)}
                                        className="text-xs h-7"
                                        placeholder={t('field.note')}
                                      />
                                      <div className="flex gap-1">
                                        <Button size="sm" onClick={saveEdit} disabled={editSaving} className="h-6 px-2 text-[10px] bg-[#9C7A2D] hover:bg-[#8B6A1D]">
                                          {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : t('field.save')}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingField(null)} className="h-6 px-2 text-[10px]">
                                          <X className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    field.value != null ? (
                                      <span className="text-xs text-gray-800 font-semibold">
                                        {field.value}
                                        {field.unit && (
                                          <span className="text-gray-400 ml-1 font-normal">{field.unit}</span>
                                        )}
                                      </span>
                                    ) : (
                                      <span className="text-xs italic text-gray-300">
                                        {t('common.notFound')}
                                      </span>
                                    )
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {field.source_name ? (
                                    <span className="text-[11px] text-gray-500 max-w-[150px] truncate block">
                                      {field.source_name}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  <span className="text-[11px] text-gray-500">
                                    {field.as_of_date || '—'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-2 py-0 rounded-md ${confidenceColor(field.confidence)}`}
                                  >
                                    {t(`confidence.${field.confidence}`) || field.confidence}
                                  </Badge>
                                </td>
                                <td className="px-4 py-2.5">
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startEdit(field)}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-[#9C7A2D] hover:bg-[#9C7A2D]/5"
                                      title={t('field.edit')}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => showHistory(dossierData.iso3, field.field_name)}
                                      className="h-6 w-6 p-0 text-gray-400 hover:text-[#6366F1] hover:bg-[#6366F1]/5"
                                      title={t('field.history')}
                                    >
                                      <History className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>
        );
      })}

      {/* Field History Modal */}
      <AnimatePresence>
        {historyField && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setHistoryField(null)}
          >
            <motion.div
              className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[70vh] overflow-auto"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div>
                  <h3 className="text-sm font-bold text-gray-800">{t('field.historyTitle')}</h3>
                  <p className="text-xs text-gray-500">{historyField.replace(/_/g, ' ')}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setHistoryField(null)} className="h-7 w-7 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  </div>
                ) : historyData.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">{t('field.noHistory')}</p>
                ) : (
                  <div className="space-y-3">
                    {historyData.map((h, i) => (
                      <div key={`${h.id}-${i}`} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-md bg-[#9C7A2D]/10 text-[#9C7A2D] border-[#9C7A2D]/20">
                            {h.changed_by}
                          </Badge>
                          <span className="text-[10px] text-gray-400">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-gray-600 space-y-1">
                          <div>
                            <span className="text-gray-400">{t('field.oldValue')}:</span>{' '}
                            <span className="text-gray-500 line-through">{h.old_value || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">{t('field.newValue')}:</span>{' '}
                            <span className="text-gray-800 font-medium">{h.new_value}</span>
                          </div>
                          {h.note && (
                            <div className="text-[10px] text-gray-400 italic">💬 {h.note}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
