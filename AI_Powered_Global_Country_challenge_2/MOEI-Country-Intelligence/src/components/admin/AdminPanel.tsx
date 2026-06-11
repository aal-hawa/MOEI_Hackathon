'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Admin Panel
   All backend v2 management features in one panel
   Sources tab redesigned as unified "Sources & Parameters" view
   with 3 card sections: Trusted Sources, Paid Sources, Internal DB
   ─────────────────────────────────────────────────────────────── */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/LanguageContext';
import type {
  AdminTab,
  SourceEntry,
  LogEvent,
  BuildRun,
  AgentMemoryEntry,
  ModelConfig,
  APIKeyEntry,
  InternalDataset,
} from '@/lib/types';
import {
  fetchSourceEntries,
  addSource,
  setSourceStatus,
  fetchLogs,
  fetchBuildRuns,
  fetchAgentMemory,
  fetchModelConfig,
  updateModelConfig,
  fetchAPIKeys,
  addAPIKey,
  deleteAPIKey,
  fetchInternalDatasets,
  addInternalDataset,
  deleteInternalDataset,
  fetchInternalDataset,
} from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Database,
  ScrollText,
  Play,
  Brain,
  Settings,
  Key,
  FolderOpen,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Shield,
  Clock,
  AlertTriangle,
  Eye,
  Upload,
  Lock,
  Globe,
  Server,
} from 'lucide-react';

interface AdminPanelProps {
  backendOffline: boolean;
}

/* ── Tab config ────────────────────────────────────────────── */
const adminTabs: { key: AdminTab; icon: React.ReactNode }[] = [
  { key: 'sources', icon: <Database className="w-4 h-4" /> },
  { key: 'logs', icon: <ScrollText className="w-4 h-4" /> },
  { key: 'runs', icon: <Play className="w-4 h-4" /> },
  { key: 'memory', icon: <Brain className="w-4 h-4" /> },
  { key: 'models', icon: <Settings className="w-4 h-4" /> },
];

const tabLabelKey: Record<AdminTab, string> = {
  sources: 'admin.sources.tab',
  logs: 'admin.logs',
  runs: 'admin.runs',
  memory: 'admin.memory',
  models: 'admin.models',
};

/* ── Custom hook for data fetching (avoids lint issues) ──── */
function useAsyncData<T>(fetcher: () => Promise<T>, initialValue: T) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  useEffect(() => { fetcherRef.current = fetcher; });

  const refresh = useCallback(() => {
    setLoading(true);
    fetcherRef.current()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return { data, setData, loading, refresh };
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════ */
export default function AdminPanel({ backendOffline }: AdminPanelProps) {
  const { t, lang, isRTL, dir } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('sources');

  return (
    <motion.div
      className="max-w-screen-xl mx-auto px-4 py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      dir={dir}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#9C7A2D]" />
          {t('admin.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('admin.subtitle')}</p>
      </div>

      {/* Backend offline warning */}
      {backendOffline && (
        <div className="mb-4 p-4 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0" />
          <p className="text-sm text-[#92400E]">
            {t('admin.backendOffline')}
          </p>
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 mb-6 overflow-x-auto">
        {adminTabs.map(({ key, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
              activeTab === key
                ? 'bg-white text-[#0F172A] shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            {icon}
            <span>{t(tabLabelKey[key])}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'sources' && <SourcesAndParametersSection />}
          {activeTab === 'logs' && <ActivityLogSection />}
          {activeTab === 'runs' && <BuildRunsSection />}
          {activeTab === 'memory' && <AgentMemorySection />}
          {activeTab === 'models' && <ModelConfigSection />}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   UNIFIED SOURCES & PARAMETERS (3 card sections)
   ══════════════════════════════════════════════════════════════ */
function SourcesAndParametersSection() {
  return (
    <div className="space-y-6">
      <TrustedSourceRegistry />
      <PaidPrivateSources />
      <InternalDatabaseSection />
    </div>
  );
}

/* ── Section 1: Trusted Source Registry ──────────────────────── */
function TrustedSourceRegistry() {
  const { t } = useLanguage();
  const { data: sources, loading, refresh: load } = useAsyncData(fetchSourceEntries, [] as SourceEntry[]);
  const [newDomain, setNewDomain] = useState('');
  const [newName, setNewName] = useState('');
  const [newTier, setNewTier] = useState('2');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      await addSource({
        domain: newDomain.trim(),
        name: newName.trim() || newDomain.trim(),
        url: `https://${newDomain.trim()}`,
        tier: parseInt(newTier),
        category: '',
      });
      setNewDomain('');
      setNewName('');
      setNewTier('2');
      load();
    } catch { /* empty */ }
    setAdding(false);
  };

  const handleStatus = async (domain: string, status: 'trusted' | 'blocked') => {
    try { await setSourceStatus(domain, status); load(); } catch { /* empty */ }
  };

  const tierBadge = (tier: number) => {
    const colors: Record<number, string> = {
      1: 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20',
      2: 'bg-[#9C7A2D]/10 text-[#9C7A2D] border-[#9C7A2D]/20',
      3: 'bg-[#A6492F]/10 text-[#A6492F] border-[#A6492F]/20',
    };
    return colors[tier] || 'bg-gray-100 text-gray-500 border-gray-200';
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'trusted': return 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20';
      case 'blocked': return 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  return (
    <Card className="border border-gray-200 rounded-xl overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0F172A]/5 flex items-center justify-center">
              <Globe className="w-4.5 h-4.5 text-[#0F172A]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">{t('admin.sources.title')}</h3>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{t('admin.sources.desc')}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 px-3 text-xs gap-1.5 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Inline add form - always visible */}
        <div className="flex items-end gap-3 mb-5 pb-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.sources.domain')}</label>
            <Input
              placeholder={t('admin.sources.domainPlaceholder')}
              value={newDomain}
              onChange={e => setNewDomain(e.target.value)}
              className="text-xs h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.sources.name')}</label>
            <Input
              placeholder={t('admin.sources.namePlaceholder')}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="text-xs h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <div className="w-28 shrink-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.sources.tier')}</label>
            <Select value={newTier} onValueChange={v => setNewTier(v)}>
              <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Tier 1</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newDomain.trim()}
            className="h-9 text-xs bg-[#9C7A2D] hover:bg-[#8B6A1D] shrink-0 px-4"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('admin.sources.add')}
          </Button>
        </div>

        {/* Source table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState message={t('admin.noData')} icon={<Globe className="w-5 h-5" />} />
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.sources.domain')}</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.sources.name')}</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.sources.tier')}</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.sources.status')}</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.sources.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s, i) => (
                  <tr key={`${s.name}-${i}`} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-600 font-mono">{s.domain}</td>
                    <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{s.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 rounded-md ${tierBadge(s.tier)}`}>
                        {t('admin.sources.tier')} {s.tier}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className={`text-[10px] px-2 py-0 rounded-md ${statusColor(s.status)}`}>
                        {t(`admin.sources.${s.status}`)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        {s.status !== 'trusted' && (
                          <Button size="sm" variant="ghost" onClick={() => handleStatus(s.domain, 'trusted')} className="h-7 px-2 text-[10px] text-[#0D9488] hover:bg-[#0D9488]/5">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.sources.setTrusted')}
                          </Button>
                        )}
                        {s.status !== 'blocked' && (
                          <Button size="sm" variant="ghost" onClick={() => handleStatus(s.domain, 'blocked')} className="h-7 px-2 text-[10px] text-[#DC2626] hover:bg-[#DC2626]/5">
                            <XCircle className="w-3 h-3 mr-1" /> {t('admin.sources.setBlocked')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Section 2: Paid & Private Sources ──────────────────────── */
function PaidPrivateSources() {
  const { t } = useLanguage();
  const { data: keys, loading, refresh: load } = useAsyncData(fetchAPIKeys, [] as APIKeyEntry[]);
  const [newProvider, setNewProvider] = useState('');
  const [newKey, setNewKey] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!newProvider.trim() || !newKey.trim()) return;
    setAdding(true);
    try {
      await addAPIKey({ provider: newProvider.trim(), key: newKey.trim() });
      setNewProvider('');
      setNewKey('');
      load();
    } catch { /* empty */ }
    setAdding(false);
  };

  const handleDelete = async (provider: string) => {
    try { await deleteAPIKey(provider); load(); } catch { /* empty */ }
  };

  const maskKey = (provider: string) => {
    // Show first 2 and last 2 chars of provider, with dots
    if (provider.length <= 4) return '••••••';
    return provider.slice(0, 2) + '••••••' + provider.slice(-2);
  };

  return (
    <Card className="border border-gray-200 rounded-xl overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#9C7A2D]/10 flex items-center justify-center">
              <Key className="w-4.5 h-4.5 text-[#9C7A2D]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">{t('admin.paid.title')}</h3>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{t('admin.paid.desc')}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 px-3 text-xs gap-1.5 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Inline add form - always visible */}
        <div className="flex items-end gap-3 mb-5 pb-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.paid.provider')}</label>
            <Input
              placeholder={t('admin.paid.providerPlaceholder')}
              value={newProvider}
              onChange={e => setNewProvider(e.target.value)}
              className="text-xs h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.paid.apiKey')}</label>
            <Input
              type="password"
              placeholder={t('admin.paid.apiKeyPlaceholder')}
              value={newKey}
              onChange={e => setNewKey(e.target.value)}
              className="text-xs h-9"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newProvider.trim() || !newKey.trim()}
            className="h-9 text-xs bg-[#9C7A2D] hover:bg-[#8B6A1D] shrink-0 px-4"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Key className="w-3.5 h-3.5 mr-1" /> {t('admin.paid.connect')}</>}
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : keys.length === 0 ? (
          <EmptyState message={t('admin.paid.emptyState')} icon={<Key className="w-5 h-5" />} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {keys.map((k) => (
              <div key={k.provider} className="border border-gray-200 rounded-lg p-4 hover:border-[#9C7A2D]/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#0F172A]">{k.provider}</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-md bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20">
                    <Lock className="w-2.5 h-2.5 mr-1" /> {t('admin.paid.maskedKey')}
                  </Badge>
                </div>
                <div className="text-[10px] text-gray-400 mb-1 font-mono">
                  ••••••••{k.has_key ? '●●' : '○○'}
                </div>
                <div className="text-[10px] text-gray-400 mb-3">
                  {t('admin.paid.addedBy')}: {k.added_by} · {t('admin.paid.connectedOn')}: {new Date(k.added_at).toLocaleDateString()}
                </div>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(k.provider)} className="h-7 text-[10px] text-[#DC2626] hover:bg-[#DC2626]/5 w-full">
                  <Trash2 className="w-3 h-3 mr-1" /> {t('admin.delete')}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Section 3: Internal Database ───────────────────────────── */
function InternalDatabaseSection() {
  const { t } = useLanguage();
  const { data: datasets, loading, refresh: load } = useAsyncData(fetchInternalDatasets, [] as InternalDataset[]);
  const [newDSName, setNewDSName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [previewDS, setPreviewDS] = useState<InternalDataset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      reader.readAsText(file);
    });
  };

  const handleAdd = async () => {
    if (!newDSName.trim() || !selectedFile) return;
    setAdding(true);
    try {
      const content = await readFileContent(selectedFile);
      await addInternalDataset({
        name: newDSName.trim(),
        content,
        filename: selectedFile.name,
      });
      setNewDSName('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch { /* empty */ }
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    try { await deleteInternalDataset(id); load(); } catch { /* empty */ }
  };

  return (
    <Card className="border border-gray-200 rounded-xl overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#0D9488]/10 flex items-center justify-center">
              <Server className="w-4.5 h-4.5 text-[#0D9488]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0F172A]">{t('admin.internal.title')}</h3>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{t('admin.internal.desc')}</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="h-8 px-3 text-xs gap-1.5 shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Isolation guarantee banner */}
        <div className="mb-5 p-3 bg-[#0F172A]/[0.03] border border-[#0F172A]/10 rounded-lg flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-[#0F172A] shrink-0" />
          <p className="text-[11px] text-[#0F172A]/70 font-medium">
            {t('admin.internal.isolation')}
          </p>
        </div>

        {/* Inline add form - always visible */}
        <div className="flex items-end gap-3 mb-5 pb-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.internal.datasetName')}</label>
            <Input
              placeholder={t('admin.internal.datasetNamePlaceholder')}
              value={newDSName}
              onChange={e => setNewDSName(e.target.value)}
              className="text-xs h-9"
            />
          </div>
          <div className="w-52 shrink-0">
            <label className="text-[10px] text-gray-400 uppercase font-semibold mb-1 block">{t('admin.internal.fileLabel')}</label>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json,.tsv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div className="h-9 px-3 border border-gray-200 rounded-md flex items-center text-xs text-gray-500 bg-white cursor-pointer hover:border-gray-300 transition-colors">
                <Upload className="w-3.5 h-3.5 mr-2 shrink-0" />
                <span className="truncate">
                  {selectedFile ? selectedFile.name : t('admin.internal.selectFile')}
                </span>
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !newDSName.trim() || !selectedFile}
            className="h-9 text-xs bg-[#9C7A2D] hover:bg-[#8B6A1D] shrink-0 px-4"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><FolderOpen className="w-3.5 h-3.5 mr-1" /> {t('admin.internal.linkDataset')}</>}
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-gray-300 animate-spin" />
          </div>
        ) : datasets.length === 0 ? (
          <EmptyState message={t('admin.internal.emptyState')} icon={<Server className="w-5 h-5" />} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {datasets.map((ds) => (
              <div key={ds.id} className="border border-gray-200 rounded-lg p-4 hover:border-[#0D9488]/30 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#0F172A]">{ds.name}</span>
                  <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-md bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20">
                    {ds.n_rows} {t('admin.internal.rows')}
                  </Badge>
                </div>
                <div className="text-[10px] text-gray-400 mb-3 space-y-0.5">
                  {ds.filename && <div className="flex items-center gap-1"><FolderOpen className="w-3 h-3" /> {ds.filename}</div>}
                  <div>{new Date(ds.created_at).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={async () => {
                    try {
                      const detail = await fetchInternalDataset(ds.id);
                      setPreviewDS(detail);
                    } catch { /* empty */ }
                  }} className="h-7 text-[10px] text-[#6366F1] hover:bg-[#6366F1]/5 flex-1">
                    <Eye className="w-3 h-3 mr-1" /> {t('admin.internal.preview')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(ds.id)} className="h-7 text-[10px] text-[#DC2626] hover:bg-[#DC2626]/5">
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Preview modal */}
        {previewDS && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewDS(null)}>
            <Card className="max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{previewDS.name}</CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setPreviewDS(null)} className="h-7 w-7 p-0">✕</Button>
              </CardHeader>
              <CardContent>
                {previewDS.preview && previewDS.preview.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <tbody>
                        {previewDS.preview.slice(0, 20).map((row, ri) => (
                          <tr key={ri} className="border-b border-gray-100">
                            {row.map((cell, ci) => (
                              <td key={ci} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">{previewDS.n_rows} {t('admin.internal.rows')}</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
   ACTIVITY LOG
   ══════════════════════════════════════════════════════════════ */
function ActivityLogSection() {
  const { t } = useLanguage();
  const { data: logs, loading, refresh: load } = useAsyncData(() => fetchLogs(100), [] as LogEvent[]);

  return (
    <SectionWrapper title={t('admin.logs.title')} desc={t('admin.logs.desc')} loading={loading} onRefresh={load}>
      {logs.length === 0 && !loading ? (
        <EmptyState message={t('admin.noData')} icon={<ScrollText className="w-5 h-5" />} />
      ) : (
        <div className="max-h-[500px] overflow-y-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.actorType')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.actor')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.action')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.detail')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.country')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.logs.timestamp')}</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={`${log.id}-${i}`} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 rounded-md ${
                      log.actor_type === 'ai' ? 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20' : 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20'
                    }`}>
                      {log.actor_type === 'ai' ? t('admin.logs.ai') : t('admin.logs.user')}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-700 font-medium">{log.actor}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-800">{log.action}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[200px] truncate">{log.detail || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{log.country_iso || '—'}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionWrapper>
  );
}

/* ══════════════════════════════════════════════════════════════
   BUILD RUNS
   ══════════════════════════════════════════════════════════════ */
function BuildRunsSection() {
  const { t } = useLanguage();
  const { data: runs, loading, refresh: load } = useAsyncData(() => fetchBuildRuns(50), [] as BuildRun[]);

  const statusStyle = (s: string) => {
    switch (s) {
      case 'completed': return 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20';
      case 'running': return 'bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20';
      case 'failed': return 'bg-[#DC2626]/10 text-[#DC2626] border-[#DC2626]/20';
      default: return 'bg-gray-100 text-gray-500 border-gray-200';
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'completed': return t('admin.runs.completed');
      case 'running': return t('admin.runs.running');
      case 'failed': return t('admin.runs.failed');
      default: return s;
    }
  };

  return (
    <SectionWrapper title={t('admin.runs.title')} desc={t('admin.runs.desc')} loading={loading} onRefresh={load}>
      {runs.length === 0 && !loading ? (
        <EmptyState message={t('admin.noData')} icon={<Play className="w-5 h-5" />} />
      ) : (
        <div className="max-h-[500px] overflow-y-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.runs.runId')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.runs.country')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.runs.status')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.runs.startedAt')}</th>
                <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase">{t('admin.runs.duration')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-2.5 text-xs font-mono text-gray-600">{run.run_id?.slice(0, 8)}…</td>
                  <td className="px-4 py-2.5 text-xs font-medium text-gray-800">{run.country_iso}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-[10px] px-2 py-0 rounded-md ${statusStyle(run.status)}`}>
                      {run.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                      {statusLabel(run.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">{new Date(run.started_at).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-xs text-gray-500">
                    {run.duration_s ? `${run.duration_s.toFixed(1)}s` : run.status === 'running' ? '…' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionWrapper>
  );
}

/* ══════════════════════════════════════════════════════════════
   AGENT MEMORY
   ══════════════════════════════════════════════════════════════ */
function AgentMemorySection() {
  const { t } = useLanguage();
  const { data: memory, loading, refresh: load } = useAsyncData(() => fetchAgentMemory(), [] as AgentMemoryEntry[]);

  return (
    <SectionWrapper title={t('admin.memory.title')} desc={t('admin.memory.desc')} loading={loading} onRefresh={load}>
      {memory.length === 0 && !loading ? (
        <EmptyState message={t('admin.noData')} icon={<Brain className="w-5 h-5" />} />
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {memory.map((m, i) => (
            <Card key={`${m.id}-${i}`} className="border border-gray-200 rounded-xl">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] px-2 py-0 rounded-md bg-[#6366F1]/10 text-[#6366F1] border-[#6366F1]/20">
                    {m.agent}
                  </Badge>
                  <span className="text-[10px] text-gray-400 font-mono">run: {m.run_id?.slice(0, 8)}…</span>
                  <span className="text-[10px] text-gray-400 ml-auto flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(m.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">{m.note}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </SectionWrapper>
  );
}

/* ══════════════════════════════════════════════════════════════
   MODEL CONFIG
   ══════════════════════════════════════════════════════════════ */
function ModelConfigSection() {
  const { t } = useLanguage();
  const { data: config, loading, refresh: load } = useAsyncData(fetchModelConfig, null as ModelConfig | null);
  const [saving, setSaving] = useState<string | null>(null);
  const [editedAgents, setEditedAgents] = useState<Record<string, { model: string; temperature: number }>>({});
  const [initialized, setInitialized] = useState(false);

  // Initialize editedAgents from config on first load
  if (config?.agents && !initialized) {
    setEditedAgents(config.agents);
    setInitialized(true);
  }

  const handleSave = async (agent: string) => {
    const edited = editedAgents[agent];
    if (!edited) return;
    setSaving(agent);
    try { await updateModelConfig(agent, edited.model, edited.temperature); } catch { /* empty */ }
    setSaving(null);
  };

  return (
    <SectionWrapper title={t('admin.models.title')} desc={t('admin.models.desc')} loading={loading} onRefresh={load}>
      {config ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t('admin.models.defaultProvider')}:</span>
              <Badge className="bg-[#9C7A2D]/10 text-[#9C7A2D] border-[#9C7A2D]/20 text-xs">{config.default_provider}</Badge>
            </div>
            {config.active_provider && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Active:</span>
                <Badge className={`text-xs ${config.active_provider === 'z-sdk-web' ? 'bg-[#0D9488]/10 text-[#0D9488] border-[#0D9488]/20' : 'bg-[#9C7A2D]/10 text-[#9C7A2D] border-[#9C7A2D]/20'}`}>
                  {config.active_provider === 'z-sdk-web' ? 'Z SDK Web ✓' : 'OpenAI Direct'}
                </Badge>
              </div>
            )}
            {config.providers && config.providers.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Provider:</span>
                <Select
                  value={config.active_provider || 'z-sdk-web'}
                  onValueChange={(v) => {
                    // Provider switching is handled by updating .env OPENAI_API_BASE
                    // For now, just show the selection UI
                  }}
                >
                  <SelectTrigger className="text-xs h-7 w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.providers.map(p => (
                      <SelectItem key={p} value={p}>
                        {p === 'z-sdk-web' ? '🌐 Z SDK Web' : '🔑 OpenAI Direct'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{t('admin.models.availableModels')}:</span>
              <span className="text-xs text-gray-600">{config.options.length} models</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(editedAgents).map(([agent, settings]) => (
              <Card key={agent} className="border border-gray-200 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-[#6366F1]" />
                    <span className="text-sm font-semibold text-gray-800">{agent}</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">{t('admin.models.model')}</label>
                      <Select value={settings.model} onValueChange={v => setEditedAgents(prev => ({ ...prev, [agent]: { ...prev[agent], model: v } }))}>
                        <SelectTrigger className="text-xs h-9 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {config.options.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 uppercase font-semibold">
                        {t('admin.models.temperature')}: {settings.temperature.toFixed(2)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.05"
                        value={settings.temperature}
                        onChange={e => setEditedAgents(prev => ({ ...prev, [agent]: { ...prev[agent], temperature: parseFloat(e.target.value) } }))}
                        className="w-full mt-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#9C7A2D]"
                      />
                    </div>
                    <Button size="sm" onClick={() => handleSave(agent)} disabled={saving === agent} className="h-8 text-xs bg-[#9C7A2D] hover:bg-[#8B6A1D] w-full">
                      {saving === agent ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      {t('admin.models.save')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : !loading ? (
        <EmptyState message={t('admin.noData')} icon={<Settings className="w-5 h-5" />} />
      ) : null}
    </SectionWrapper>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function SectionWrapper({
  title,
  desc,
  loading,
  onRefresh,
  children,
}: {
  title: string;
  desc: string;
  loading: boolean;
  onRefresh: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} className="h-8 px-3 text-xs gap-1.5">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </Button>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3 text-gray-300">
        {icon || <Database className="w-6 h-6" />}
      </div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  );
}
