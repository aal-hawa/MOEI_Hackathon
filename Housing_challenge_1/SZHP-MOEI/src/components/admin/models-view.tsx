'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useSystemConfig } from '@/hooks/use-system-config'
import { t } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ScrollFade } from '@/components/ui/scroll-fade'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Bot, Plus, Trash2, Edit3, CheckCircle2, XCircle, Zap, Globe,
  HardDrive, Sparkles, RefreshCw, Search, Download, Star, StarOff,
  Eye, Server, Key, Settings2, Loader2, Wifi, WifiOff, ChevronDown,
  Cloud, Monitor, Cpu
} from 'lucide-react'
import { motion } from 'framer-motion'

interface ModelConfig {
  id: string
  name: string
  provider: string
  modelId: string
  baseUrl: string
  apiKey: string | null
  isActive: boolean
  isDefault: boolean
  capabilities: string
  maxTokens: number
  temperature: number
  descriptionEN: string | null
  descriptionAR: string | null
  lastTestedAt: string | null
  lastTestResult: string | null
  createdAt: string
}

interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  family?: string
  parameterSize?: string
  quantization?: string
}

const PROVIDER_CONFIG: Record<string, { label: string; labelAr: string; icon: React.ElementType; color: string; bgColor: string; borderColor: string; needsApiKey: boolean }> = {
  recentech: { label: 'Recentech AI', labelAr: 'Recentech AI', icon: Sparkles, color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', needsApiKey: true },
  openai: { label: 'OpenAI', labelAr: 'OpenAI', icon: Cloud, color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', needsApiKey: true },
  gemini: { label: 'Google Gemini', labelAr: 'جوجل جيميني', icon: Globe, color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', needsApiKey: true },
  ollama: { label: 'Ollama (Local)', labelAr: 'Ollama (محلي)', icon: HardDrive, color: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', needsApiKey: false },
  openai_compatible: { label: 'OpenAI-Compatible', labelAr: 'متوافق مع OpenAI', icon: Server, color: 'text-teal-600', bgColor: 'bg-teal-50', borderColor: 'border-teal-200', needsApiKey: true },
}

export function ModelsView() {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const { getString, reload } = useSystemConfig()
  
  const defaultLlmId = getString('default_llm_id', '')
  const defaultVlmId = getString('default_vlm_id', '')

  const [models, setModels] = useState<ModelConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<Partial<ModelConfig> | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvider, setFilterProvider] = useState('all')

  // Ollama state
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([])
  const [ollamaConnected, setOllamaConnected] = useState(false)
  const [ollamaLoading, setOllamaLoading] = useState(false)
  const [ollamaSearchQuery, setOllamaSearchQuery] = useState('')
  const [ollamaSearchResults, setOllamaSearchResults] = useState<any[]>([])
  const [ollamaSearching, setOllamaSearching] = useState(false)
  const [pullingModel, setPullingModel] = useState<string | null>(null)
  const [ollamaTab, setOllamaTab] = useState('installed')
  
  // Hardware & Search Source
  const [hardware, setHardware] = useState<{ ramGb: number; cores: number; hasGPU: boolean; gpuName: string | null; vramGb: number } | null>(null)
  const [searchProvider, setSearchProvider] = useState<'ollama' | 'hf'>('ollama')

  const fetchModels = useCallback(async () => {
    try {
      const res = await authFetch('/api/models')
      if (res.ok) {
        const data = await res.json()
        setModels(data)
      }
    } catch (err) {
      console.error('Failed to fetch models:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchOllamaModels = useCallback(async () => {
    setOllamaLoading(true)
    try {
      const res = await authFetch('/api/models/ollama/list')
      if (res.ok) {
        const data = await res.json()
        setOllamaConnected(data.connected)
        setOllamaModels(data.models || [])
      } else {
        setOllamaConnected(false)
        setOllamaModels([])
      }
    } catch {
      setOllamaConnected(false)
      setOllamaModels([])
    } finally {
      setOllamaLoading(false)
    }
  }, [])

  const fetchHardware = useCallback(async () => {
    try {
      const res = await authFetch('/api/system/hardware')
      if (res.ok) {
        const data = await res.json()
        if (data.success) setHardware(data.hardware)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchModels()
    fetchOllamaModels()
    fetchHardware()
  }, [fetchModels, fetchOllamaModels, fetchHardware])

  const handleSeed = async () => {
    try {
      toast({ title: isAr ? 'جارٍ إضافة النماذج الافتراضية...' : 'Seeding default models...' })
      const res = await authFetch('/api/models/seed', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        toast({ title: isAr ? 'تمت إضافة النماذج' : 'Models seeded', description: data.message })
        fetchModels()
      } else {
        toast({ title: isAr ? 'فشل الإضافة' : 'Seed failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'فشل الإضافة' : 'Seed failed', variant: 'destructive' })
    }
  }

  const handleTest = async (model: ModelConfig) => {
    setTesting(model.id)
    try {
      const res = await authFetch('/api/models/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: model.id }),
      })
      const data = await res.json()
      if (data.success) {
        toast({
          title: isAr ? 'الاتصال ناجح' : 'Connection successful',
          description: `${data.message} (${data.responseTime}ms)`,
        })
      } else {
        toast({
          title: isAr ? 'فشل الاتصال' : 'Connection failed',
          description: data.message,
          variant: 'destructive',
        })
      }
      fetchModels()
    } catch {
      toast({ title: isAr ? 'فشل الاختبار' : 'Test failed', variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  const handleSetDefaultModel = async (model: ModelConfig, type: 'llm' | 'vlm') => {
    try {
      const configKey = type === 'llm' ? 'default_llm_id' : 'default_vlm_id'
      const res = await authFetch('/api/system-config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: [{ configKey, configValue: model.id }] }),
      })
      if (res.ok) {
        const data = await res.json()
        const result = data.results?.[0]
        if (result?.status === 'updated') {
          toast({ title: isAr ? 'تم تحديث النموذج الافتراضي' : 'Default model updated', description: `${model.name} → ${type.toUpperCase()}` })
          reload()
          fetchModels()
        } else {
          toast({ title: isAr ? 'فشل الحفظ' : 'Save failed', description: result?.status || 'Unknown error', variant: 'destructive' })
        }
      } else {
        toast({ title: isAr ? 'فشل التحديث' : 'Failed to set default', variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'فشل التحديث' : 'Failed to set default', variant: 'destructive' })
    }
  }

  const handleToggleActive = async (model: ModelConfig) => {
    try {
      const res = await authFetch(`/api/models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !model.isActive }),
      })
      if (res.ok) {
        toast({ title: isAr ? 'تم تحديث الحالة' : 'Status updated' })
        fetchModels()
      } else {
        const data = await res.json().catch(() => null)
        toast({ title: isAr ? 'فشل التحديث' : 'Update failed', description: data?.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'فشل التحديث' : 'Update failed', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await authFetch(`/api/models/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast({ title: isAr ? 'تم حذف النموذج' : 'Model deleted' })
        fetchModels()
        reload() // Refresh config in case deleted model was default LLM/VLM
      } else {
        const data = await res.json().catch(() => null)
        toast({ title: isAr ? 'فشل الحذف' : 'Delete failed', description: data?.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'فشل الحذف' : 'Delete failed', variant: 'destructive' })
    }
  }

  const openAddDialog = () => {
    setEditingModel({
      name: '',
      provider: 'recentech',
      modelId: 'glm-4-flash',
      baseUrl: 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1',
      apiKey: '',
      isActive: true,
      isDefault: false,
      capabilities: ['chat'],
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: '',
      descriptionAR: '',
    })
    setDialogOpen(true)
  }

  const openEditDialog = (model: ModelConfig) => {
    setEditingModel({
      ...model,
      capabilities: JSON.parse(model.capabilities || '[]'),
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!editingModel) return
    setSaving(true)
    try {
      const payload = {
        name: editingModel.name,
        provider: editingModel.provider,
        modelId: editingModel.modelId,
        baseUrl: editingModel.baseUrl,
        apiKey: editingModel.apiKey,
        isActive: editingModel.isActive,
        isDefault: editingModel.isDefault,
        capabilities: editingModel.capabilities,
        maxTokens: editingModel.maxTokens,
        temperature: editingModel.temperature,
        descriptionEN: editingModel.descriptionEN,
        descriptionAR: editingModel.descriptionAR,
      }

      let success = false
      if (editingModel.id) {
        const res = await authFetch(`/api/models/${editingModel.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast({ title: isAr ? 'تم تحديث النموذج' : 'Model updated' })
          success = true
        } else {
          const data = await res.json().catch(() => null)
          toast({ title: isAr ? 'فشل التحديث' : 'Update failed', description: data?.error, variant: 'destructive' })
        }
      } else {
        const res = await authFetch('/api/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          toast({ title: isAr ? 'تم إضافة النموذج' : 'Model added' })
          success = true
        } else {
          const data = await res.json().catch(() => null)
          toast({ title: isAr ? 'فشل الإضافة' : 'Add failed', description: data?.error, variant: 'destructive' })
        }
      }

      if (success) {
        setDialogOpen(false)
        setEditingModel(null)
        fetchModels()
      }
    } catch {
      toast({ title: isAr ? 'فشل الحفظ' : 'Save failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const evaluateHardware = (modelName: string, tags: any[], hw: {ramGb: number, cores: number, hasGPU: boolean, vramGb: number} | null) => {
    if (!hw) return null
    const allText = [modelName, ...(tags || []).map((t:any) => typeof t === 'string' ? t : t.name)].join(' ')
    const matchB = allText.match(/\b(\d+(?:\.\d+)?)[bB]\b/)
    const matchM = allText.match(/\b(\d+(?:\.\d+)?)[mM]\b/)
    let paramBillion = 0
    if (matchB) paramBillion = parseFloat(matchB[1])
    else if (matchM) paramBillion = parseFloat(matchM[1]) / 1000
    else return null

    // For GGUF Q4: ~0.7GB per 1B parameters + 1GB overhead
    const requiredMem = paramBillion * 0.7 + 1 
    
    if (hw.hasGPU && hw.vramGb >= requiredMem) {
      return { level: 'success', icon: Zap, label: 'Blazing Fast (GPU)', labelAr: 'سريع جداً (يعمل على كرت الشاشة)', color: 'text-ae-green-600 bg-ae-green-50 border-ae-green-200' }
    } else if (hw.hasGPU && (hw.vramGb + hw.ramGb) >= requiredMem) {
      return { level: 'warning', icon: CheckCircle2, label: 'Moderate (Shared Mem)', labelAr: 'سرعة متوسطة (ذاكرة مشتركة)', color: 'text-amber-600 bg-amber-50 border-amber-200' }
    } else if (!hw.hasGPU && hw.ramGb >= requiredMem) {
      return { level: 'warning', icon: CheckCircle2, label: 'Slow (CPU Only)', labelAr: 'بطيء (يعمل على المعالج فقط)', color: 'text-amber-600 bg-amber-50 border-amber-200' }
    } else {
      return { level: 'danger', icon: XCircle, label: 'Likely to crash', labelAr: 'قد يتعطل (ذاكرة غير كافية)', color: 'text-ae-red-600 bg-ae-red-50 border-ae-red-200' }
    }
  }

  const handleSearchOllama = async () => {
    if (!ollamaSearchQuery.trim()) return
    setOllamaSearching(true)
    try {
      if (searchProvider === 'hf') {
        const res = await authFetch(`/api/models/hf/search?q=${encodeURIComponent(ollamaSearchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setOllamaSearchResults(data.models || [])
        }
      } else {
        const res = await authFetch(`/api/models/ollama/search?q=${encodeURIComponent(ollamaSearchQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setOllamaSearchResults(data.models || [])
        }
      }
    } catch {
      toast({ title: isAr ? 'فشل البحث' : 'Search failed', variant: 'destructive' })
    } finally {
      setOllamaSearching(false)
    }
  }

  const handlePullOllama = async (modelName: string) => {
    setPullingModel(modelName)
    try {
      const res = await authFetch('/api/models/ollama/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: isAr ? 'تم تحميل النموذج' : 'Model pulled', description: data.message })
        fetchOllamaModels()
      } else {
        toast({ title: isAr ? 'فشل التحميل' : 'Pull failed', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: isAr ? 'فشل التحميل' : 'Pull failed', variant: 'destructive' })
    } finally {
      setPullingModel(null)
    }
  }

  const handleDeleteOllama = async (modelName: string) => {
    try {
      const res = await authFetch('/api/models/ollama/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelName }),
      })
      if (res.ok) {
        toast({ title: isAr ? 'تم حذف النموذج المحلي' : 'Local model deleted' })
        fetchOllamaModels()
      }
    } catch {
      toast({ title: isAr ? 'فشل الحذف' : 'Delete failed', variant: 'destructive' })
    }
  }

  const handleAddOllamaToConfig = (model: OllamaModel) => {
    setEditingModel({
      name: `Ollama — ${model.name}`,
      provider: 'ollama',
      modelId: model.name,
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: null,
      isActive: true,
      isDefault: false,
      capabilities: ['chat'],
      maxTokens: 4096,
      temperature: 0.7,
      descriptionEN: `Local Ollama model. Family: ${model.family || 'unknown'}, Size: ${model.parameterSize || 'unknown'}`,
      descriptionAR: `نموذج Ollama محلي. العائلة: ${model.family || 'غير معروف'}`,
    })
    setDialogOpen(true)
  }

  // Filter models
  const filteredModels = models.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.modelId.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesProvider = filterProvider === 'all' || m.provider === filterProvider
    return matchesSearch && matchesProvider
  })

  // Stats
  const activeCount = models.filter(m => m.isActive).length

  const fallbackModelId = models.find(m => m.isActive && m.isDefault)?.id || models.find(m => m.isActive)?.id
  const effectiveLlmId = defaultLlmId || fallbackModelId
  const effectiveVlmId = defaultVlmId || fallbackModelId

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">
            {isAr ? 'إدارة نماذج الذكاء الاصطناعي' : 'AI Models Management'}
          </h2>
          <p className="text-sm text-ae-black-400">
            {isAr ? 'إضافة وإدارة نماذج الذكاء الاصطناعي من مختلف المزودين' : 'Add and manage AI models from multiple providers'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeed} className="border-secondary text-secondary-foreground hover:bg-secondary/10">
            <RefreshCw className="w-4 h-4 me-1" />
            {isAr ? 'إضافة الافتراضية' : 'Seed Defaults'}
          </Button>
          <Button onClick={openAddDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
            <Plus className="w-4 h-4 me-1" />
            {isAr ? 'إضافة نموذج' : 'Add Model'}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold text-foreground truncate">{models.length}</div>
                <div className="text-xs text-muted-foreground font-medium truncate">{isAr ? 'إجمالي النماذج' : 'Total Models'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold text-foreground truncate">{activeCount}</div>
                <div className="text-xs text-muted-foreground font-medium truncate">{isAr ? 'نشط' : 'Active'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-blue-200 bg-gradient-to-b from-blue-50/50 to-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground truncate">
                  {models.find(m => m.id === effectiveLlmId)?.name || (isAr ? 'غير محدد' : 'Not set')}
                </div>
                <div className="text-xs text-blue-600 font-medium truncate">{isAr ? 'LLM — تحليل النصوص' : 'LLM — Text Analysis'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="border-purple-200 bg-gradient-to-b from-purple-50/50 to-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-foreground truncate">
                  {models.find(m => m.id === effectiveVlmId)?.name || (isAr ? 'غير محدد' : 'Not set')}
                </div>
                <div className="text-xs text-purple-600 font-medium truncate">{isAr ? 'VLM — تحليل الصور والمستندات' : 'VLM — Image & Docs'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="border-border bg-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-bold text-foreground truncate">{ollamaModels.length}</div>
                <div className="text-xs text-muted-foreground font-medium truncate">{isAr ? 'نماذج محلية' : 'Local Models'}</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="configured" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="configured">
            {isAr ? 'النماذج المُكوّنة' : 'Configured Models'}
          </TabsTrigger>
          <TabsTrigger value="ollama">
            {isAr ? 'المحرك المحلي للنماذج' : 'Local Engine'}
          </TabsTrigger>
        </TabsList>

        {/* Configured Models Tab */}
        <TabsContent value="configured" className="mt-4 space-y-4">
          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={isAr ? 'بحث عن نموذج...' : 'Search models...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ps-9"
              />
            </div>
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-full sm:w-[220px] bg-white">
                <SelectValue placeholder={isAr ? "جميع المزودين" : "All Providers"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {isAr ? 'جميع المزودين' : 'All Providers'}
                </SelectItem>
                {Object.entries(PROVIDER_CONFIG).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                        {isAr ? cfg.labelAr : cfg.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Models Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-ae-gold-500" />
            </div>
          ) : filteredModels.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium text-ae-black-400">
                  {isAr ? 'لا توجد نماذج' : 'No models found'}
                </p>
                <p className="text-sm text-ae-black-300 mb-4">
                  {isAr ? 'أضف نماذج الذكاء الاصطناعي أو استخدم الإضافة الافتراضية' : 'Add AI models or seed defaults to get started'}
                </p>
                <Button onClick={handleSeed} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                  <RefreshCw className="w-4 h-4 me-2" />
                  {isAr ? 'إضافة النماذج الافتراضية' : 'Seed Default Models'}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            >
              {filteredModels.map((model, idx) => {
                const pConfig = PROVIDER_CONFIG[model.provider] || PROVIDER_CONFIG.openai_compatible
                const ProviderIcon = pConfig.icon
                const capabilities = JSON.parse(model.capabilities || '[]')
                return (
                  <motion.div 
                    key={model.id}
                    initial={{ opacity: 0, y: 15 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: idx * 0.05 }}
                    className="h-full"
                  >
                    <Card
                      className={`h-full flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-ae-gold-300 ${
                        effectiveLlmId === model.id && effectiveVlmId === model.id 
                          ? 'border-ae-gold-400 ring-1 ring-ae-gold-200 shadow-ae-gold-500/10 bg-gradient-to-b from-white to-ae-gold-50/30' 
                          : effectiveLlmId === model.id 
                          ? 'border-blue-400 ring-1 ring-blue-200 shadow-blue-500/10 bg-gradient-to-b from-white to-blue-50/30'
                          : effectiveVlmId === model.id
                          ? 'border-purple-400 ring-1 ring-purple-200 shadow-purple-500/10 bg-gradient-to-b from-white to-purple-50/30'
                          : 'border bg-white/60 backdrop-blur-sm'
                      } ${!model.isActive ? 'opacity-60 grayscale-[0.2]' : ''}`}
                    >
                      <CardContent className="p-4 flex-1 flex flex-col">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-xl ${pConfig.bgColor} ${pConfig.borderColor} border flex items-center justify-center shrink-0 shadow-sm`}>
                              <ProviderIcon className={`w-6 h-6 ${pConfig.color}`} />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-sm text-ae-black-700 truncate">{model.name}</div>
                              <div className="text-xs text-ae-black-400 font-mono mt-0.5 truncate">{model.modelId}</div>
                            </div>
                          </div>
                          <div>
                            {effectiveLlmId === model.id && (
                              <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] shrink-0 shadow-sm border-0 mb-1 flex items-center w-max">
                                <Star className="w-3 h-3 me-1 fill-current" />
                                {isAr ? 'LLM (تحليل النصوص)' : 'LLM (Text Analysis)'}
                              </Badge>
                            )}
                            {effectiveVlmId === model.id && (
                              <Badge className="bg-gradient-to-r from-purple-500 to-purple-600 text-white text-[10px] shrink-0 shadow-sm border-0 flex items-center w-max">
                                <Eye className="w-3 h-3 me-1 fill-current" />
                                {isAr ? 'VLM (تحليل الصور)' : 'VLM (Image & Docs)'}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Provider & Status */}
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] font-medium ${pConfig.color} ${pConfig.borderColor} bg-white/80`}>
                            {isAr ? pConfig.labelAr : pConfig.label}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] font-medium bg-white/80 ${model.isActive ? 'border-ae-green-400 text-ae-green-600' : 'border-ae-red-300 text-ae-red-500'}`}>
                            {model.isActive ? (isAr ? 'نشط' : 'Active') : (isAr ? 'معطّل' : 'Inactive')}
                          </Badge>
                          {model.lastTestResult && (
                            <Badge variant="outline" className={`text-[10px] font-medium bg-white/80 ${model.lastTestResult === 'success' ? 'border-ae-green-400 text-ae-green-600' : 'border-ae-red-400 text-ae-red-600'}`}>
                              {model.lastTestResult === 'success' ? <Wifi className="w-3 h-3 me-0.5" /> : <WifiOff className="w-3 h-3 me-0.5" />}
                              {model.lastTestResult === 'success' ? (isAr ? 'متصل' : 'Connected') : (isAr ? 'غير متصل' : 'Failed')}
                            </Badge>
                          )}
                        </div>

                        {/* Capabilities */}
                        <div className="flex gap-1.5 flex-wrap mb-4">
                          {capabilities.map((cap: string) => (
                            <span key={cap} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {cap}
                            </span>
                          ))}
                        </div>

                        <div className="flex-1">
                          {/* Description */}
                          {((isAr ? model.descriptionAR : model.descriptionEN)) && (
                            <p className="text-xs text-ae-black-500 line-clamp-3 mb-4">
                              {isAr ? model.descriptionAR : model.descriptionEN}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 pt-3 border-t mt-4 flex-wrap">
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs font-medium hover:bg-ae-gold-50 hover:text-ae-gold-600 transition-colors" onClick={() => handleTest(model)} disabled={testing === model.id}>
                            {testing === model.id ? <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" /> : <Zap className="w-3.5 h-3.5 me-1.5" />}
                            {isAr ? 'اختبار' : 'Test'}
                          </Button>
                          {effectiveLlmId !== model.id && (
                            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs font-medium hover:bg-blue-50 hover:text-blue-600 transition-colors" onClick={() => handleSetDefaultModel(model, 'llm')}>
                              <Star className="w-3.5 h-3.5 me-1.5" />
                              {isAr ? 'تعيين كـ LLM' : 'Set as LLM (Text)'}
                            </Button>
                          )}
                          {effectiveVlmId !== model.id && capabilities.includes('vision') && (
                            <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs font-medium hover:bg-purple-50 hover:text-purple-600 transition-colors" onClick={() => handleSetDefaultModel(model, 'vlm')}>
                              <Eye className="w-3.5 h-3.5 me-1.5" />
                              {isAr ? 'تعيين كـ VLM' : 'Set as VLM (Vision)'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 text-xs font-medium hover:bg-slate-100 transition-colors" onClick={() => handleToggleActive(model)}>
                            {model.isActive ? <XCircle className="w-3.5 h-3.5 me-1.5" /> : <CheckCircle2 className="w-3.5 h-3.5 me-1.5" />}
                            {model.isActive ? (isAr ? 'تعطيل' : 'Disable') : (isAr ? 'تفعيل' : 'Enable')}
                          </Button>
                          <div className="ms-auto flex shrink-0">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 transition-colors" onClick={() => openEditDialog(model)}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-ae-red-500 hover:text-ae-red-600 hover:bg-ae-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{isAr ? 'حذف النموذج؟' : 'Delete Model?'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {isAr ? `هل أنت متأكد من حذف "${model.name}"؟` : `Are you sure you want to delete "${model.name}"?`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                                  <AlertDialogAction className="bg-ae-red-500 hover:bg-ae-red-600 text-white" onClick={() => handleDelete(model.id)}>
                                    {isAr ? 'حذف' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </TabsContent>

        {/* Local Engine Tab */}
        <TabsContent value="ollama" className="mt-4 space-y-4">
          {/* Hardware & Engine Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className={ollamaConnected ? 'border-ae-green-200 bg-ae-green-50/30' : 'border-ae-red-200 bg-ae-red-50/30'}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ollamaConnected ? 'bg-ae-green-500/10' : 'bg-ae-red-500/10'}`}>
                    <HardDrive className={`w-5 h-5 ${ollamaConnected ? 'text-ae-green-600' : 'text-ae-red-600'}`} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">
                      {isAr ? 'خادم النماذج المحلي' : 'Local Inference Server'}
                    </div>
                    <div className="text-xs text-ae-black-400">
                      {ollamaConnected
                        ? (isAr ? `متصل — ${ollamaModels.length} نموذج مثبت` : `Connected — ${ollamaModels.length} models installed`)
                        : (isAr ? 'غير متصل — تأكد من تشغيل الخادم محلياً' : 'Not connected — make sure server is running locally')}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={fetchOllamaModels} disabled={ollamaLoading}>
                  {ollamaLoading ? <Loader2 className="w-4 h-4 me-1 animate-spin" /> : <RefreshCw className="w-4 h-4 me-1" />}
                  {isAr ? 'تحديث' : 'Refresh'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-slate-500/10 shrink-0">
                  <Monitor className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    {isAr ? 'مواصفات الجهاز المكتشفة' : 'Detected Hardware'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 space-y-0.5">
                    {hardware ? (
                      <>
                        {hardware.hasGPU && <div className="text-purple-600 font-medium">{hardware.vramGb} GB VRAM • {hardware.gpuName}</div>}
                        <div>{isAr ? `${hardware.ramGb} جيجا رام • ${hardware.cores} أنوية معالج` : `${hardware.ramGb} GB RAM • ${hardware.cores} CPU Cores`}</div>
                      </>
                    ) : (
                      <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> {isAr ? 'جاري الفحص...' : 'Detecting...'}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Local Engine Sub-tabs */}
          <Tabs value={ollamaTab} onValueChange={setOllamaTab}>
            <TabsList>
              <TabsTrigger value="installed">
                {isAr ? 'النماذج المثبتة' : 'Installed Models'}
              </TabsTrigger>
              <TabsTrigger value="search">
                {isAr ? 'البحث والتحميل' : 'Discover & Pull'}
              </TabsTrigger>
            </TabsList>

            {/* Installed Local Models */}
            <TabsContent value="installed" className="mt-4">
              {ollamaModels.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm text-ae-black-400">
                      {ollamaConnected
                        ? (isAr ? 'لا توجد نماذج مثبتة. ابحث وحمل نماذج جديدة.' : 'No models installed. Search and pull new models.')
                        : (isAr ? 'الخادم غير متصل' : 'Server not connected')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ollamaModels.map((model) => (
                    <Card key={model.name} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center shrink-0">
                              <Cpu className="w-4 h-4 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{model.name}</div>
                              <div className="text-[10px] text-ae-black-400">
                                {model.parameterSize && `${model.parameterSize} • `}
                                {(model.size / 1e9).toFixed(1)} GB
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => handleAddOllamaToConfig(model)}>
                            <Plus className="w-3 h-3 me-1" />
                            {isAr ? 'إضافة للتكوين' : 'Add to Config'}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-ae-red-500">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>{isAr ? 'حذف النموذج المحلي؟' : 'Delete Local Model?'}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {isAr ? `حذف "${model.name}" من الجهاز محلياً؟` : `Delete "${model.name}" locally?`}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{isAr ? 'إلغاء' : 'Cancel'}</AlertDialogCancel>
                                  <AlertDialogAction className="bg-ae-red-500 hover:bg-ae-red-600 text-white" onClick={() => handleDeleteOllama(model.name)}>
                                    {isAr ? 'حذف' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

            {/* Search & Pull Local Models */}
            <TabsContent value="search" className="mt-4 space-y-4">
              
              {/* Direct Pull Section */}
              <Card className="border border-ae-gold-200 bg-ae-gold-50/20">
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-sm">{isAr ? 'تحميل مباشر (HuggingFace أو Ollama)' : 'Direct Pull (HuggingFace or Registry)'}</h3>
                    <p className="text-xs text-ae-black-400">
                      {isAr ? 'أدخل اسم النموذج للتحميل المباشر. بالنسبة لنماذج HuggingFace، استخدم الصيغة hf.co/username/repo' : 'Enter a model name to pull directly. For HuggingFace models, use the format hf.co/username/repo'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Download className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder={isAr ? 'مثال: hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF' : 'e.g. hf.co/bartowski/Llama-3.2-1B-Instruct-GGUF'}
                        id="direct-pull-input"
                        className="ps-9 font-mono text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value;
                            if (val) handlePullOllama(val);
                          }
                        }}
                      />
                    </div>
                    <Button 
                      onClick={() => {
                        const input = document.getElementById('direct-pull-input') as HTMLInputElement;
                        if (input && input.value) handlePullOllama(input.value);
                      }}
                      className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white"
                      disabled={!!pullingModel}
                    >
                      {pullingModel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 me-1" />}
                      {isAr ? 'تحميل' : 'Pull'}
                    </Button>
                  </div>
                  {pullingModel && (
                    <p className="text-xs text-ae-gold-600 animate-pulse">
                      {isAr ? `جارٍ تحميل ${pullingModel}... قد يستغرق هذا بعض الوقت.` : `Pulling ${pullingModel}... This may take a while depending on the model size.`}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Separator className="my-4" />

              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                  <button 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${searchProvider === 'ollama' ? 'bg-white shadow-sm text-ae-black-700' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => { setSearchProvider('ollama'); setOllamaSearchResults([]); }}
                  >
                    {isAr ? 'سجل Ollama' : 'Ollama Registry'}
                  </button>
                  <button 
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${searchProvider === 'hf' ? 'bg-white shadow-sm text-ae-black-700' : 'text-slate-500 hover:text-slate-700'}`}
                    onClick={() => { setSearchProvider('hf'); setOllamaSearchResults([]); }}
                  >
                    {isAr ? 'Hugging Face' : 'Hugging Face'}
                  </button>
                </div>
                <div className="relative flex-1">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={searchProvider === 'hf' ? (isAr ? 'ابحث في HuggingFace (مثل: llama gguf)...' : 'Search Hugging Face GGUF models...') : (isAr ? 'ابحث في السجل (مثل: llama, mistral)...' : 'Search registry (e.g. llama, mistral)...')}
                    value={ollamaSearchQuery}
                    onChange={(e) => setOllamaSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchOllama()}
                    className="ps-9"
                  />
                </div>
                <Button onClick={handleSearchOllama} disabled={ollamaSearching}>
                  {ollamaSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  {isAr ? 'بحث' : 'Search'}
                </Button>
              </div>

              {ollamaSearchResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {ollamaSearchResults.map((model: any) => {
                    const hwBadge = evaluateHardware(model.name, model.tags, hardware);
                    const HwIcon = hwBadge?.icon;
                    return (
                    <Card key={model.name} className="border flex flex-col transition-all hover:shadow-md">
                      <CardContent className="p-4 flex-1 flex flex-col">
                        <div className="mb-2">
                          <div className="font-medium text-sm truncate" title={model.name}>{model.name}</div>
                          <p className="text-xs text-ae-black-400 line-clamp-2 mt-1">{model.description || ''}</p>
                        </div>
                        
                        {hwBadge && (
                          <div className={`flex items-center gap-1.5 mt-2 mb-3 px-2 py-1.5 rounded-md border text-[10px] font-medium w-fit ${hwBadge.color}`}>
                            <HwIcon className="w-3.5 h-3.5" />
                            {isAr ? hwBadge.labelAr : hwBadge.label}
                          </div>
                        )}

                        <div className="flex-1" />
                        
                        {model.tags && model.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap mb-3 mt-2">
                            {model.tags.slice(0, 4).map((tag: any) => (
                              <span key={tag.name} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-3 text-xs w-full mt-auto"
                          onClick={() => handlePullOllama(searchProvider === 'hf' ? `hf.co/${model.name}` : model.name)}
                          disabled={pullingModel === (searchProvider === 'hf' ? `hf.co/${model.name}` : model.name)}
                        >
                          {pullingModel === (searchProvider === 'hf' ? `hf.co/${model.name}` : model.name) ? (
                            <Loader2 className="w-4 h-4 animate-spin me-1.5" />
                          ) : (
                            <Download className="w-4 h-4 me-1.5" />
                          )}
                          {isAr ? 'تحميل وتثبيت' : 'Pull & Install'}
                        </Button>
                      </CardContent>
                    </Card>
                  )})}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Model Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingModel(null) }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {editingModel && (
            <>
              <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-ae-gold-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-ae-gold-600" />
                  </div>
                  {editingModel.id
                    ? (isAr ? 'تعديل النموذج' : 'Edit Model')
                    : (isAr ? 'إضافة نموذج جديد' : 'Add New Model')}
                </DialogTitle>
                <DialogDescription>
                  {isAr ? 'تكوين إعدادات نموذج الذكاء الاصطناعي' : 'Configure AI model settings'}
                </DialogDescription>
              </DialogHeader>

              <ScrollFade className="flex-1 min-h-0">
              <ScrollArea className="h-full px-6 py-4">
                <div className="space-y-5">
                  {/* Provider Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{isAr ? 'المزود' : 'Provider'}</Label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(PROVIDER_CONFIG).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              const updates: Partial<typeof editingModel> = { provider: key }
                              if (key === 'recentech') {
                                updates.baseUrl = 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1'
                                updates.modelId = 'glm-4-flash'
                                updates.apiKey = ''
                              } else if (key === 'openai') {
                                updates.baseUrl = 'https://api.openai.com/v1'
                                updates.modelId = 'gpt-4o'
                                updates.apiKey = ''
                              } else if (key === 'gemini') {
                                updates.baseUrl = 'https://recentech-ai-worker.42abudhabi424242.workers.dev/v1'
                                updates.modelId = 'gemini-2.5-flash'
                                updates.apiKey = ''
                              } else if (key === 'ollama') {
                                updates.baseUrl = 'http://127.0.0.1:11434'
                                updates.modelId = 'llama3'
                                updates.apiKey = null
                              } else if (key === 'openai_compatible') {
                                updates.baseUrl = 'http://localhost:8080/v1'
                                updates.modelId = 'default'
                                updates.apiKey = ''
                              }
                              setEditingModel({ ...editingModel, ...updates })
                            }}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${editingModel.provider === key
                              ? `${cfg.bgColor} ${cfg.borderColor} ${cfg.color} ring-1 ring-current/20`
                              : 'border-border hover:bg-muted text-ae-black-500'
                            }`}
                          >
                            <Icon className="w-4 h-4 shrink-0" />
                            <span className="truncate">{isAr ? cfg.labelAr : cfg.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">{isAr ? 'اسم العرض' : 'Display Name'}</Label>
                    <Input
                      value={editingModel.name || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                      placeholder={isAr ? 'مثال: Recentech AI — GLM-4-Flash' : 'e.g. Recentech AI — GLM-4-Flash'}
                    />
                  </div>

                  {/* Model ID */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">{isAr ? 'معرف النموذج' : 'Model ID'}</Label>
                    <Input
                      value={editingModel.modelId || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, modelId: e.target.value })}
                      placeholder="glm-4-flash"
                      className="font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {isAr ? 'معرف النموذج كما هو محدد في واجهة برمجة التطبيقات' : 'The model identifier as specified in the API'}
                    </p>
                  </div>

                  {/* Base URL */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">{isAr ? 'عنوان URL الأساسي' : 'Base URL'}</Label>
                    <Input
                      value={editingModel.baseUrl || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, baseUrl: e.target.value })}
                      placeholder="https://api.example.com/v1"
                      className="font-mono text-xs"
                    />
                  </div>

                  {/* API Key */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5" />
                      {isAr ? 'مفتاح API' : 'API Key'}
                      {!PROVIDER_CONFIG[editingModel.provider || 'recentech']?.needsApiKey && (
                        <Badge variant="outline" className="text-[10px]">{isAr ? 'اختياري' : 'Optional'}</Badge>
                      )}
                    </Label>
                    <Input
                      type="password"
                      value={editingModel.apiKey || ''}
                      onChange={(e) => setEditingModel({ ...editingModel, apiKey: e.target.value || null })}
                      placeholder={PROVIDER_CONFIG[editingModel.provider || 'recentech']?.needsApiKey
                        ? (isAr ? 'أدخل مفتاح API' : 'Enter API key')
                        : (isAr ? 'اختياري للنماذج المحلية' : 'Optional for local models')}
                    />
                  </div>

                  {/* Temperature & Max Tokens */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">{isAr ? 'الحرارة' : 'Temperature'}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={2}
                        step={0.1}
                        value={editingModel.temperature ?? 0.7}
                        onChange={(e) => setEditingModel({ ...editingModel, temperature: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">{isAr ? 'الحد الأقصى للرموز' : 'Max Tokens'}</Label>
                      <Input
                        type="number"
                        min={256}
                        max={128000}
                        step={256}
                        value={editingModel.maxTokens ?? 4096}
                        onChange={(e) => setEditingModel({ ...editingModel, maxTokens: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Capabilities */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{isAr ? 'القدرات' : 'Capabilities'}</Label>
                    <div className="flex gap-2 flex-wrap">
                      {['chat', 'vision', 'tts', 'asr', 'image_gen'].map((cap) => {
                        const caps = (editingModel.capabilities as string[]) || []
                        const isActive = caps.includes(cap)
                        return (
                          <button
                            key={cap}
                            type="button"
                            onClick={() => {
                              const newCaps = isActive
                                ? caps.filter((c: string) => c !== cap)
                                : [...caps, cap]
                              setEditingModel({ ...editingModel, capabilities: newCaps })
                            }}
                            className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${isActive
                              ? 'bg-ae-gold-50 border-ae-gold-300 text-ae-gold-700'
                              : 'border-border text-ae-black-400 hover:bg-muted'
                            }`}
                          >
                            {cap}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Active & Default */}
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingModel.isActive ?? true}
                        onCheckedChange={(checked) => setEditingModel({ ...editingModel, isActive: checked })}
                      />
                      <Label className="text-sm">{isAr ? 'نشط' : 'Active'}</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={editingModel.isDefault ?? false}
                        onCheckedChange={(checked) => setEditingModel({ ...editingModel, isDefault: checked })}
                      />
                      <Label className="text-sm">{isAr ? 'افتراضي' : 'Default'}</Label>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">{isAr ? 'الوصف (إنجليزي)' : 'Description (EN)'}</Label>
                      <Textarea
                        value={editingModel.descriptionEN || ''}
                        onChange={(e) => setEditingModel({ ...editingModel, descriptionEN: e.target.value })}
                        placeholder="Model description in English"
                        rows={2}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">{isAr ? 'الوصف (عربي)' : 'Description (AR)'}</Label>
                      <Textarea
                        value={editingModel.descriptionAR || ''}
                        onChange={(e) => setEditingModel({ ...editingModel, descriptionAR: e.target.value })}
                        placeholder="وصف النموذج بالعربية"
                        rows={2}
                        className="text-sm"
                        dir="rtl"
                      />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              </ScrollFade>

              <DialogFooter className="px-6 py-4 border-t bg-muted/30 shrink-0">
                <div className="flex items-center gap-3 w-full justify-end">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingModel(null) }}>
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </Button>
                  <Button onClick={handleSave} disabled={saving || !editingModel.name} className="bg-ae-gold-500 hover:bg-ae-gold-600 text-white">
                    {saving ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isAr ? 'جارٍ الحفظ...' : 'Saving...'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {editingModel.id ? (isAr ? 'تحديث' : 'Update') : (isAr ? 'إضافة' : 'Add Model')}
                      </span>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
