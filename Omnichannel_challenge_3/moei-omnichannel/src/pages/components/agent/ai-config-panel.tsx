'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  BookOpen,
  Target,
  FileText,
  BarChart3,
  Plus,
  Search,
  Play,
  Edit3,
  Eye,
  ThermometerSun,
  Zap,
  MessageSquare,
  Languages,
  Cpu,
  Check,
  Loader2,
  X,
  Save,
  RotateCcw,
  Sparkles,
  Globe,
  Mic,
  Volume2,
  Key,
  RefreshCw,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Radio,
  Activity,
  Settings2,
  AlertTriangle,
  Wifi,
  WifiOff,
  EyeOff,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { useTranslation } from '@/i18n'
import { invalidateChatConfigCache } from '@/components/chat/ai-chat-widget'

// ─── Types ───────────────────────────────────────────────────────────────────
interface KnowledgeCategory {
  id: string
  name: string
  articleCount: number
  enabled: boolean
  lastUpdated: string
  coverageScore: number
}

interface IntentItem {
  id: string
  name: string
  samplePhrases: number
  confidenceThreshold: number
  accuracy: number
  category: string
  isTraining: boolean
}

interface ResponseTemplate {
  id: string
  name: string
  language: string
  lastModified: string
  usageCount: number
}

interface ChatConfigItem {
  id: string
  key: string
  valueEn: string
  valueAr: string | null
  description: string | null
  isActive: boolean
  updatedAt: string
}

interface VoicePipelineConfigData {
  stt: { primary: string; fallback: string }
  tts: { primary: string; fallback: string; languageProviders?: Record<string, { primary: string; fallback: string }> }
  llm: { primary: string; fallback: string }
  language: string
  maxSpeechDuration: number
}

interface VoiceProviderStatus {
  deepgram: string
  cartesia: string
  zai: string
  geminiProxy: string
}

interface LanguageOption {
  code: string
  label: string
}

interface VoiceProvidersResponse {
  config: VoicePipelineConfigData
  status: VoiceProviderStatus
  available: {
    stt: string[] | Record<string, { name: string; description: string }>
    tts: string[] | Record<string, { name: string; description: string }>
    llm: string[] | Record<string, { name: string; description: string }>
    languages?: LanguageOption[]
  }
  error?: string
}

// ─── Voice Provider Metadata ─────────────────────────────────────────────────
type ProviderMeta = {
  label: string
  initial: string
  description: string
  dotColor: string
  bgGradient: string
  selectedBorder: string
  selectedBg: string
  badgeBg: string
  badgeText: string
}

const PROVIDER_META: Record<string, ProviderMeta> = {
  deepgram: {
    label: 'Deepgram',
    initial: 'D',
    description: 'STT: Nova-3 streaming | TTS: Aura batch',
    dotColor: 'bg-sky-500',
    bgGradient: 'from-sky-500 to-cyan-400',
    selectedBorder: 'border-sky-500',
    selectedBg: 'bg-sky-50 dark:bg-sky-950/30',
    badgeBg: 'bg-sky-100 dark:bg-sky-900/40',
    badgeText: 'text-sky-700 dark:text-sky-300',
  },
  zai: {
    label: 'Z AI Provider',
    initial: 'Z',
    description: 'Z AI SDK integrated provider',
    dotColor: 'bg-emerald-500',
    bgGradient: 'from-emerald-500 to-teal-400',
    selectedBorder: 'border-emerald-500',
    selectedBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
  },
  cartesia: {
    label: 'Cartesia',
    initial: 'C',
    description: 'STT: Batch transcription | TTS: Sonic-3.5 streaming',
    dotColor: 'bg-orange-500',
    bgGradient: 'from-orange-500 to-amber-400',
    selectedBorder: 'border-orange-500',
    selectedBg: 'bg-orange-50 dark:bg-orange-950/30',
    badgeBg: 'bg-orange-100 dark:bg-orange-900/40',
    badgeText: 'text-orange-700 dark:text-orange-300',
  },
  gemini: {
    label: 'Gemini 2.5 Flash',
    initial: 'G',
    description: 'Google Gemini via proxy worker',
    dotColor: 'bg-rose-500',
    bgGradient: 'from-rose-500 to-pink-400',
    selectedBorder: 'border-rose-400',
    selectedBg: 'bg-rose-50 dark:bg-rose-950/30',
    badgeBg: 'bg-rose-100 dark:bg-rose-900/40',
    badgeText: 'text-rose-700 dark:text-rose-300',
  },
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'multi', label: 'Auto-detect (English / العربية)' },
  { code: 'ar', label: 'Arabic (العربية)' },
  { code: 'en', label: 'English' },
]

const DEFAULT_CONFIG: VoicePipelineConfigData = {
  stt: { primary: 'deepgram', fallback: 'zai' },
  tts: { primary: 'cartesia', fallback: 'zai', languageProviders: { ar: { primary: 'cartesia', fallback: 'zai' }, en: { primary: 'cartesia', fallback: 'deepgram' } } },
  llm: { primary: 'zai', fallback: 'gemini' },
  language: 'multi',
  maxSpeechDuration: 15000,
}

const CONFIG_LABELS: Record<string, { en: string; icon: React.ElementType; color: string }> = {
  welcome_message: { en: 'Welcome Message', icon: Sparkles, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
  fallback_default: { en: 'Default Response', icon: MessageSquare, color: 'text-slate-600 bg-slate-50 dark:bg-slate-950/30' },
  fallback_electricity: { en: 'Electricity', icon: Zap, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  fallback_water: { en: 'Water', icon: ThermometerSun, color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
  fallback_housing: { en: 'Housing', icon: BookOpen, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  fallback_complaint: { en: 'Complaint', icon: Target, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  fallback_case: { en: 'Case Status', icon: FileText, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/30' },
  fallback_help: { en: 'Help', icon: Brain, color: 'text-brand-600 bg-brand-50 dark:bg-brand-950/30' },
}

// ─── Pipeline Stage Icons & Colors ───────────────────────────────────────────
const PIPELINE_STAGES = [
  { type: 'stt' as const, label: 'STT', fullLabel: 'Speech-to-Text', icon: Mic, color: '#0ea5e9', bgColor: 'bg-sky-50 dark:bg-sky-950/20', borderColor: 'border-sky-300 dark:border-sky-700' },
  { type: 'llm' as const, label: 'LLM', fullLabel: 'Language Model', icon: Brain, color: '#10b981', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-emerald-300 dark:border-emerald-700' },
  { type: 'tts' as const, label: 'TTS', fullLabel: 'Text-to-Speech', icon: Volume2, color: '#f97316', bgColor: 'bg-orange-50 dark:bg-orange-950/20', borderColor: 'border-orange-300 dark:border-orange-700' },
]


// ─── AI Provider & Model Configuration ─────────────────────────────────────────
type AIProviderKey = 'openai' | 'anthropic' | 'google' | 'meta' | 'mistral' | 'deepseek' | 'zai'

interface AIProviderDef {
  key: AIProviderKey
  name: string
  initial: string
  gradient: string
  description: string
  selectedBorder: string
  selectedBg: string
  models: { id: string; name: string; description: string }[]
  configured: boolean
  apiKeyStorageKey: string // localStorage key for API key check
}

// Helper: check if a provider has an API key stored in localStorage
function checkProviderConfigured(storageKey: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    // Z AI and Google are configured by default (server-side keys)
    if (storageKey === 'zai' || storageKey === 'google') return true
    const key = localStorage.getItem(`api_key_${storageKey}`)
    return !!key && key.length > 0
  } catch {
    return false
  }
}

// Build AI_PROVIDERS with dynamic `configured` based on localStorage
function buildAIProviders(): AIProviderDef[] {
  return [
    {
      key: 'openai',
      name: 'OpenAI',
      initial: 'O',
      gradient: 'from-gray-800 to-gray-600',
      description: 'Industry-leading GPT models',
      selectedBorder: 'border-gray-700',
      selectedBg: 'bg-gray-50 dark:bg-gray-950/30',
      models: [
        { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, multimodal' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance, 128K context' },
        { id: 'o1', name: 'o1', description: 'Advanced reasoning model' },
        { id: 'o1-mini', name: 'o1-mini', description: 'Fast reasoning, affordable' },
        { id: 'o3-mini', name: 'o3-mini', description: 'Latest reasoning, efficient' },
      ],
      configured: checkProviderConfigured('openai'),
      apiKeyStorageKey: 'openai',
    },
    {
      key: 'anthropic',
      name: 'Anthropic',
      initial: 'A',
      gradient: 'from-amber-600 to-orange-500',
      description: 'Safe & helpful Claude models',
      selectedBorder: 'border-amber-500',
      selectedBg: 'bg-amber-50 dark:bg-amber-950/30',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best for complex tasks' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast & intelligent' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful, deep analysis' },
      ],
      configured: checkProviderConfigured('anthropic'),
      apiKeyStorageKey: 'anthropic',
    },
    {
      key: 'google',
      name: 'Google',
      initial: 'G',
      gradient: 'from-teal-500 to-cyan-400',
      description: 'Default · Best for Arabic',
      selectedBorder: 'border-teal-500',
      selectedBg: 'bg-teal-50 dark:bg-teal-950/30',
      models: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Default, fast & multilingual' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast & versatile' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context, 2M tokens' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast & efficient, 1M tokens' },
      ],
      configured: true,
      apiKeyStorageKey: 'google',
    },
    {
      key: 'meta',
      name: 'Meta',
      initial: 'M',
      gradient: 'from-sky-500 to-blue-400',
      description: 'Open-source Llama models',
      selectedBorder: 'border-sky-500',
      selectedBg: 'bg-sky-50 dark:bg-sky-950/30',
      models: [
        { id: 'llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'Largest open model, near GPT-4' },
        { id: 'llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Powerful open model' },
        { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Lightweight & fast' },
      ],
      configured: checkProviderConfigured('meta'),
      apiKeyStorageKey: 'meta',
    },
    {
      key: 'mistral',
      name: 'Mistral',
      initial: 'Mi',
      gradient: 'from-orange-500 to-red-400',
      description: 'European AI, multilingual',
      selectedBorder: 'border-orange-500',
      selectedBg: 'bg-orange-50 dark:bg-orange-950/30',
      models: [
        { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Top-tier reasoning' },
        { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced performance' },
        { id: 'codestral-latest', name: 'Codestral', description: 'Code generation specialist' },
      ],
      configured: checkProviderConfigured('mistral'),
      apiKeyStorageKey: 'mistral',
    },
    {
      key: 'deepseek',
      name: 'DeepSeek',
      initial: 'D',
      gradient: 'from-violet-600 to-purple-500',
      description: 'Advanced reasoning, affordable',
      selectedBorder: 'border-violet-500',
      selectedBg: 'bg-violet-50 dark:bg-violet-950/30',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'Latest MoE model' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: 'Chain-of-thought reasoning' },
      ],
      configured: checkProviderConfigured('deepseek'),
      apiKeyStorageKey: 'deepseek',
    },
    {
      key: 'zai',
      name: 'Z AI Provider',
      initial: 'Z',
      gradient: 'from-emerald-500 to-teal-400',
      description: 'Configured · Active',
      selectedBorder: 'border-emerald-500',
      selectedBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      models: [
        { id: 'zai-default', name: 'Z AI Default', description: 'Auto-selected model' },
      ],
      configured: true,
      apiKeyStorageKey: 'zai',
    },
  ]
}

// Static reference for initial render (will be overridden by state)
const AI_PROVIDERS_INITIAL: AIProviderDef[] = [
  {
    key: 'openai', name: 'OpenAI', initial: 'O', gradient: 'from-gray-800 to-gray-600',
    description: 'Industry-leading GPT models', selectedBorder: 'border-gray-700',
    selectedBg: 'bg-gray-50 dark:bg-gray-950/30', configured: false, apiKeyStorageKey: 'openai',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable, multimodal' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast & affordable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High performance, 128K context' },
      { id: 'o1', name: 'o1', description: 'Advanced reasoning model' },
      { id: 'o1-mini', name: 'o1-mini', description: 'Fast reasoning, affordable' },
      { id: 'o3-mini', name: 'o3-mini', description: 'Latest reasoning, efficient' },
    ],
  },
  {
    key: 'anthropic', name: 'Anthropic', initial: 'A', gradient: 'from-amber-600 to-orange-500',
    description: 'Safe & helpful Claude models', selectedBorder: 'border-amber-500',
    selectedBg: 'bg-amber-50 dark:bg-amber-950/30', configured: false, apiKeyStorageKey: 'anthropic',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best for complex tasks' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast & intelligent' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most powerful, deep analysis' },
    ],
  },
  {
    key: 'google', name: 'Google', initial: 'G', gradient: 'from-teal-500 to-cyan-400',
    description: 'Default · Best for Arabic', selectedBorder: 'border-teal-500',
    selectedBg: 'bg-teal-50 dark:bg-teal-950/30', configured: true, apiKeyStorageKey: 'google',
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Default, fast & multilingual' },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast & versatile' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Long context, 2M tokens' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast & efficient, 1M tokens' },
    ],
  },
  {
    key: 'meta', name: 'Meta', initial: 'M', gradient: 'from-sky-500 to-blue-400',
    description: 'Open-source Llama models', selectedBorder: 'border-sky-500',
    selectedBg: 'bg-sky-50 dark:bg-sky-950/30', configured: false, apiKeyStorageKey: 'meta',
    models: [
      { id: 'llama-3.1-405b-instruct', name: 'Llama 3.1 405B', description: 'Largest open model, near GPT-4' },
      { id: 'llama-3.1-70b-instruct', name: 'Llama 3.1 70B', description: 'Powerful open model' },
      { id: 'llama-3.1-8b-instruct', name: 'Llama 3.1 8B', description: 'Lightweight & fast' },
    ],
  },
  {
    key: 'mistral', name: 'Mistral', initial: 'Mi', gradient: 'from-orange-500 to-red-400',
    description: 'European AI, multilingual', selectedBorder: 'border-orange-500',
    selectedBg: 'bg-orange-50 dark:bg-orange-950/30', configured: false, apiKeyStorageKey: 'mistral',
    models: [
      { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Top-tier reasoning' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced performance' },
      { id: 'codestral-latest', name: 'Codestral', description: 'Code generation specialist' },
    ],
  },
  {
    key: 'deepseek', name: 'DeepSeek', initial: 'D', gradient: 'from-violet-600 to-purple-500',
    description: 'Advanced reasoning, affordable', selectedBorder: 'border-violet-500',
    selectedBg: 'bg-violet-50 dark:bg-violet-950/30', configured: false, apiKeyStorageKey: 'deepseek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek-V3', description: 'Latest MoE model' },
      { id: 'deepseek-reasoner', name: 'DeepSeek-R1', description: 'Chain-of-thought reasoning' },
    ],
  },
  {
    key: 'zai', name: 'Z AI Provider', initial: 'Z', gradient: 'from-emerald-500 to-teal-400',
    description: 'Configured · Active', selectedBorder: 'border-emerald-500',
    selectedBg: 'bg-emerald-50 dark:bg-emerald-950/30', configured: true, apiKeyStorageKey: 'zai',
    models: [
      { id: 'zai-default', name: 'Z AI Default', description: 'Auto-selected model' },
    ],
  },
]

// ─── AI Feature Definitions with Descriptions ──────────────────────────────────
const AI_FEATURES = [
  {
    key: 'enableRAG',
    icon: BookOpen,
    labelEn: 'RAG (Retrieval Augmented Generation)',
    labelAr: 'RAG (التوليد المعزز بالاسترجاع)',
    descEn: 'Fetches relevant knowledge base articles to supplement AI responses with factual, up-to-date information.',
    descAr: 'يجلب مقالات قاعدة المعرفة ذات الصلة لتعزيز استجابات الذكاء الاصطناعي بمعلومات واقعية ومحدّثة.',
  },
  {
    key: 'enableSentiment',
    icon: ThermometerSun,
    labelEn: 'Sentiment Analysis',
    labelAr: 'تحليل المشاعر',
    descEn: 'Detects customer emotions (positive, neutral, negative) in real-time to prioritize and route conversations.',
    descAr: 'يكشف مشاعر العميل (إيجابية، محايدة، سلبية) في الوقت الفعلي لتحديد أولوية وتوجيه المحادثات.',
  },
  {
    key: 'enableIntent',
    icon: Target,
    labelEn: 'Intent Detection',
    labelAr: 'اكتشاف النية',
    descEn: 'Classifies customer queries into intents (e.g., billing, complaint) to trigger appropriate service rules and responses.',
    descAr: 'يصنف استفسارات العملاء إلى نوايا (مثل الفواتير، الشكاوى) لتفعيل قواعد الخدمة المناسبة.',
  },
  {
    key: 'enableAutoCase',
    icon: Zap,
    labelEn: 'Auto Case Creation',
    labelAr: 'إنشاء حالات تلقائي',
    descEn: 'Automatically creates support cases when conversations require escalation or human agent intervention.',
    descAr: 'ينشئ حالات دعم تلقائيًا عندما تتطلب المحادثات تصعيد أو تدخل موظف بشري.',
  },
] as const

// ─── AI Model Settings with Expanded Providers ────────────────────────────────
function AIModelSettings() {
  const { t } = useTranslation()

  // Dynamic providers list (configured status depends on localStorage)
  const [aiProviders, setAiProviders] = useState<AIProviderDef[]>(AI_PROVIDERS_INITIAL)

  // Load provider/model from localStorage
  const [provider, setProvider] = useState<AIProviderKey>(() => {
    try {
      const saved = localStorage.getItem('ai_provider')
      if (saved && AI_PROVIDERS_INITIAL.some(p => p.key === saved)) return saved as AIProviderKey
    } catch {}
    return 'google'
  })

  const [model, setModel] = useState(() => {
    try {
      const savedModel = localStorage.getItem('ai_model')
      const savedProvider = localStorage.getItem('ai_provider')
      const prov = AI_PROVIDERS_INITIAL.find(p => p.key === (savedProvider || 'google'))
      if (savedModel && prov?.models.some(m => m.id === savedModel)) return savedModel
    } catch {}
    return 'gemini-2.5-flash'
  })

  const [temperature, setTemperature] = useState([0.7])
  const [maxTokens, setMaxTokens] = useState([2048])
  const [language, setLanguage] = useState('auto')
  const [savingToBackend, setSavingToBackend] = useState(false)

  // Feature toggles with localStorage persistence
  const [enableRAG, setEnableRAG] = useState(() => {
    try { return localStorage.getItem('ai_rag') !== 'false' } catch { return true }
  })
  const [enableSentiment, setEnableSentiment] = useState(() => {
    try { return localStorage.getItem('ai_sentiment') !== 'false' } catch { return true }
  })
  const [enableIntent, setEnableIntent] = useState(() => {
    try { return localStorage.getItem('ai_intent') !== 'false' } catch { return true }
  })
  const [enableAutoCase, setEnableAutoCase] = useState(() => {
    try { return localStorage.getItem('ai_auto_case') === 'true' } catch { return false }
  })

  // On mount: re-compute provider configured status and load from backend
  useEffect(() => {
    setAiProviders(buildAIProviders())

    // Load settings from backend, falling back to localStorage
    const loadFromBackend = async () => {
      try {
        const res = await fetch('/api/ai-config')
        if (res.ok) {
          const data = await res.json()
          if (data.aiProvider) setProvider(data.aiProvider as AIProviderKey)
          if (data.aiModel) setModel(data.aiModel)
          if (data.temperature != null) setTemperature([data.temperature])
          if (data.maxTokens != null) setMaxTokens([data.maxTokens])
          if (data.responseLanguage) setLanguage(data.responseLanguage)
          if (data.enableRAG != null) setEnableRAG(data.enableRAG)
          if (data.enableSentiment != null) setEnableSentiment(data.enableSentiment)
          if (data.enableIntent != null) setEnableIntent(data.enableIntent)
          if (data.enableAutoCase != null) setEnableAutoCase(data.enableAutoCase)
        }
      } catch {
        // Fallback to localStorage defaults (already set above)
      }
    }
    loadFromBackend()
  }, [])

  // Persist toggles to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem('ai_rag', String(enableRAG))
      localStorage.setItem('ai_sentiment', String(enableSentiment))
      localStorage.setItem('ai_intent', String(enableIntent))
      localStorage.setItem('ai_auto_case', String(enableAutoCase))
    } catch { /* silent */ }
  }, [enableRAG, enableSentiment, enableIntent, enableAutoCase])

  // Save feature settings to backend (debounced)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveToBackend = useCallback((updates: Record<string, unknown>) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSavingToBackend(true)
        await fetch('/api/ai-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
      } catch { /* silent */ } finally {
        setSavingToBackend(false)
      }
    }, 800)
  }, [])

  // Sync feature toggles to backend when they change
  useEffect(() => {
    saveToBackend({
      enableRAG,
      enableSentiment,
      enableIntent,
      enableAutoCase,
      aiProvider: provider,
      aiModel: model,
      temperature: temperature[0],
      maxTokens: maxTokens[0],
      responseLanguage: language,
    })
  }, [enableRAG, enableSentiment, enableIntent, enableAutoCase, provider, model, temperature, maxTokens, language, saveToBackend])

  const handleProviderChange = (newProvider: AIProviderKey) => {
    setProvider(newProvider)
    const prov = aiProviders.find(p => p.key === newProvider)
    if (prov && prov.models.length > 0) {
      setModel(prov.models[0].id)
    }
    try { localStorage.setItem('ai_provider', newProvider) } catch {}
  }

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    try { localStorage.setItem('ai_model', newModel) } catch {}
  }

  const currentProvider = aiProviders.find(p => p.key === provider) || aiProviders[2]

  const featureStateMap: Record<string, [boolean, (v: boolean) => void]> = {
    enableRAG: [enableRAG, setEnableRAG],
    enableSentiment: [enableSentiment, setEnableSentiment],
    enableIntent: [enableIntent, setEnableIntent],
    enableAutoCase: [enableAutoCase, setEnableAutoCase],
  }

  return (
    <Card className="py-4 h-full">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/30">
            <Cpu className="h-3.5 w-3.5 text-teal-600" />
          </div>
          {t('aiModelSettings')}
          {savingToBackend && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />
          )}
        </CardTitle>
        <CardDescription className="text-xs">{t('aiModelSettingsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-3 space-y-4">
        {/* AI Provider Selection — Scrollable grid with grouped providers */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            AI Provider
          </label>
          <ScrollArea className="max-h-[280px]">
            <div className="space-y-3 pr-1">
              {/* Configured Providers */}
              {aiProviders.some(p => p.configured) && (
                <div>
                  <p className="text-[9px] font-semibold text-emerald-600 uppercase tracking-wider mb-1.5 px-1">Configured</p>
                  <div className="grid grid-cols-2 gap-2">
                    {aiProviders.filter(p => p.configured).map((p) => (
                      <ProviderButton key={p.key} p={p} isSelected={provider === p.key} onSelect={handleProviderChange} />
                    ))}
                  </div>
                </div>
              )}
              {/* Available Providers */}
              {aiProviders.some(p => !p.configured) && (
                <div>
                  <p className="text-[9px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5 px-1">Available (API key required)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {aiProviders.filter(p => !p.configured).map((p) => (
                      <ProviderButton key={p.key} p={p} isSelected={provider === p.key} onSelect={handleProviderChange} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Model Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground">{t('modelSelection')}</label>
          <Select value={model} onValueChange={handleModelChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentProvider.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <div className="flex flex-col">
                    <span>{m.name}</span>
                    <span className="text-[9px] text-muted-foreground">{m.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[9px] text-muted-foreground">{currentProvider.models.find(m => m.id === model)?.description}</p>
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">{t('temperature')}</label>
            <Badge variant="secondary" className="text-[10px] font-mono">{temperature[0].toFixed(1)}</Badge>
          </div>
          <Slider value={temperature} onValueChange={setTemperature} min={0} max={1} step={0.1} className="py-1" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>{t('precise')}</span>
            <span>{t('creative')}</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">{t('maxTokens')}</label>
            <Badge variant="secondary" className="text-[10px] font-mono">{maxTokens[0]}</Badge>
          </div>
          <Slider value={maxTokens} onValueChange={setMaxTokens} min={256} max={4096} step={256} className="py-1" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>256</span>
            <span>4096</span>
          </div>
        </div>

        {/* Response Language */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
            <Languages className="h-3.5 w-3.5" />{t('responseLanguage')}
          </label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{t('autoDetect')}</SelectItem>
              <SelectItem value="en">{t('english')}</SelectItem>
              <SelectItem value="ar">{t('arabic')}</SelectItem>
              <SelectItem value="bilingual">{t('bilingual')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Feature Toggles with Descriptions */}
        <div className="space-y-2.5">
          <label className="text-xs font-medium text-foreground">{t('aiFeatures')}</label>
          <div className="space-y-2">
            {AI_FEATURES.map((feat) => {
              const [state, setter] = featureStateMap[feat.key] || [false, () => {}]
              const Icon = feat.icon
              return (
                <div key={feat.key} className="group relative">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="flex items-center justify-center w-6 h-6 rounded-md bg-teal-50 dark:bg-teal-950/30 shrink-0 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-teal-600" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <span className="text-xs text-foreground font-medium leading-snug">{feat.labelEn}</span>
                        <p className="text-[9px] text-muted-foreground leading-relaxed">{feat.descEn}</p>
                      </div>
                    </div>
                    <Switch checked={state} onCheckedChange={setter} className="shrink-0 mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Provider Button Sub-component ────────────────────────────────────────
function ProviderButton({
  p,
  isSelected,
  onSelect,
}: {
  p: AIProviderDef
  isSelected: boolean
  onSelect: (key: AIProviderKey) => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(p.key)}
      className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all cursor-pointer ${
        isSelected
          ? `${p.selectedBorder} ${p.selectedBg} shadow-sm`
          : 'border-border hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/30 dark:hover:bg-teal-950/10'
      }`}
    >
      <div className="flex items-center gap-2 w-full">
        <div className={`h-7 w-7 shrink-0 rounded-full bg-gradient-to-br ${p.gradient} flex items-center justify-center text-white text-[10px] font-bold shadow-sm`}>
          {p.initial}
        </div>
        <span className="text-xs font-semibold text-foreground truncate">{p.name}</span>
      </div>
      <span className="text-[9px] text-muted-foreground text-center leading-relaxed min-h-[2em]">{p.description}</span>
      {/* Status indicator */}
      <div className="flex items-center gap-1 mt-0.5">
        <div className={`h-1.5 w-1.5 rounded-full ${p.configured ? 'bg-emerald-500' : 'bg-amber-400'}`} />
        <span className="text-[9px] text-muted-foreground">{p.configured ? 'Configured' : 'Available'}</span>
      </div>
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center shadow-sm"
        >
          <Check className="h-3 w-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Chat Messages Config — Kept exactly as-is (backend integration)
// ═══════════════════════════════════════════════════════════════════════════════
function ChatMessagesConfig() {
  const { t, isRTL } = useTranslation()
  const [configs, setConfigs] = useState<ChatConfigItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValueEn, setEditValueEn] = useState('')
  const [editValueAr, setEditValueAr] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const [langTab, setLangTab] = useState<'en' | 'ar'>('en')

  const fetchConfigs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/chat-config')
      if (res.ok) {
        const data = await res.json()
        setConfigs(data)
      }
    } catch (error) {
      console.error('Failed to fetch chat config:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const handleEdit = (config: ChatConfigItem) => {
    setEditingKey(config.key)
    setEditValueEn(config.valueEn)
    setEditValueAr(config.valueAr || '')
    setSaveSuccess(null)
  }

  const handleSave = async () => {
    if (!editingKey) return
    setSaving(true)
    try {
      const res = await fetch(`/api/chat-config/${editingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueEn: editValueEn,
          valueAr: editValueAr || null,
        }),
      })
      if (res.ok) {
        invalidateChatConfigCache()
        setSaveSuccess(editingKey)
        await fetchConfigs()
        setTimeout(() => setSaveSuccess(null), 3000)
      }
    } catch (error) {
      console.error('Failed to save chat config:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditingKey(null)
    setEditValueEn('')
    setEditValueAr('')
    setSaveSuccess(null)
  }

  const handleReset = async (key: string) => {
    try {
      await fetch(`/api/chat-config/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { resetToDefault: true },
      })
      invalidateChatConfigCache()
      await fetchConfigs()
    } catch (error) {
      console.error('Failed to reset:', error)
    }
  }

  return (
    <Card className="py-4 h-full">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/30">
            <MessageSquare className="h-3.5 w-3.5 text-teal-600" />
          </div>
          Chat Messages
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Configure the welcome message and AI fallback responses shown to customers in the chat widget.
        </p>
      </CardHeader>
      <CardContent className="px-4 pt-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading messages...</span>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="space-y-2">
              {configs.map((config) => {
                const labelInfo = CONFIG_LABELS[config.key] || { en: config.key, icon: MessageSquare, color: 'text-muted-foreground bg-muted' }
                const Icon = labelInfo.icon
                const isEditing = editingKey === config.key
                const isSaved = saveSuccess === config.key

                return (
                  <motion.div
                    key={config.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-lg border transition-all ${
                      isEditing ? 'ring-2 ring-brand-500/30 border-brand-300 shadow-sm' : 'hover:bg-muted/30'
                    } ${!config.isActive ? 'opacity-50' : ''}`}
                  >
                    {/* Config row header */}
                    <div className="flex items-center gap-2 p-2.5">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md ${labelInfo.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-medium text-foreground">{labelInfo.en}</p>
                          {config.key === 'welcome_message' && (
                            <Badge className="text-[8px] px-1.5 py-0 h-3.5 bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 border-0">
                              SHOWN FIRST
                            </Badge>
                          )}
                          {isSaved && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="text-[10px] text-emerald-600 flex items-center gap-0.5"
                            >
                              <Check className="h-3 w-3" /> Saved
                            </motion.span>
                          )}
                        </div>
                        {config.description && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{config.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!isEditing && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            title="Edit"
                            onClick={() => handleEdit(config)}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Preview (when not editing) */}
                    {!isEditing && (
                      <div className="px-2.5 pb-2.5">
                        <div className="rounded-md bg-muted/30 dark:bg-muted/20 px-3 py-2">
                          <p className="text-[11px] text-foreground leading-relaxed line-clamp-2">{config.valueEn}</p>
                          {config.valueAr && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed mt-1 line-clamp-2" dir="rtl">{config.valueAr}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Edit mode */}
                    <AnimatePresence>
                      {isEditing && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-2.5 pb-2.5 space-y-2">
                            {/* Language tabs */}
                            <Tabs value={langTab} onValueChange={(v) => setLangTab(v as 'en' | 'ar')}>
                              <TabsList className="h-7 w-full">
                                <TabsTrigger value="en" className="text-[10px] flex-1 gap-1">
                                  <Globe className="h-3 w-3" /> English
                                </TabsTrigger>
                                <TabsTrigger value="ar" className="text-[10px] flex-1 gap-1">
                                  <Globe className="h-3 w-3" /> العربية
                                </TabsTrigger>
                              </TabsList>
                            </Tabs>

                            {/* English textarea */}
                            {langTab === 'en' && (
                              <textarea
                                value={editValueEn}
                                onChange={(e) => setEditValueEn(e.target.value)}
                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Enter English message..."
                              />
                            )}

                            {/* Arabic textarea */}
                            {langTab === 'ar' && (
                              <textarea
                                value={editValueAr}
                                onChange={(e) => setEditValueAr(e.target.value)}
                                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="أدخل الرسالة العربية..."
                                dir="rtl"
                              />
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[10px]"
                                onClick={handleCancel}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-[10px] gap-1 bg-brand-600 hover:bg-brand-700 text-white"
                                disabled={saving || !editValueEn.trim()}
                                onClick={handleSave}
                              >
                                {saving ? (
                                  <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</>
                                ) : (
                                  <><Save className="h-3 w-3" /> Save</>
                                )}
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Voice Pipeline Config — Completely redesigned
// ═══════════════════════════════════════════════════════════════════════════════

// Sub-component: Service Status Banner
function ServiceStatusBanner({
  status,
  error,
  lastConnected,
  onRetry,
}: {
  status: VoiceProviderStatus | null
  error: string | null
  lastConnected: string | null
  onRetry: () => void
}) {
  const [starting, setStarting] = useState(false)
  const [startMessage, setStartMessage] = useState<string | null>(null)

  // Determine overall status
  const overallStatus = useMemo(() => {
    if (starting) return 'starting'
    if (error && !status) return 'offline'
    if (!status) return 'loading'
    const values = Object.values(status)
    const allConnected = values.every(v => v === 'configured' || v === 'available' || v === 'online' || v === 'pending')
    const anyConnected = values.some(v => v === 'configured' || v === 'available' || v === 'online' || v === 'pending')
    if (allConnected) return 'connected'
    if (anyConnected) return 'degraded'
    return 'offline'
  }, [status, error, starting])

  // Handle retry: first try to start the voice agent service, then re-check status
  const handleRetry = useCallback(async () => {
    setStarting(true)
    setStartMessage('Starting voice agent service...')
    try {
      // Call service manager to start the voice-agent
      const res = await fetch('/api/service-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service: 'voice-agent' }),
      })
      const data = await res.json()

      if (data.started) {
        setStartMessage('Voice agent started! Waiting for it to be ready...')
        // Wait for the service to fully initialize
        await new Promise(r => setTimeout(r, 5000))
        // Re-fetch the provider config to verify it's working
        onRetry()
      } else if (data.skipped) {
        setStartMessage(data.reason || 'Service already running')
        await new Promise(r => setTimeout(r, 2000))
        onRetry()
      } else {
        setStartMessage(data.error || 'Failed to start service')
        await new Promise(r => setTimeout(r, 3000))
        onRetry()
      }
    } catch (err) {
      setStartMessage('Service manager unavailable')
      await new Promise(r => setTimeout(r, 2000))
      // Fall back to just re-fetching
      onRetry()
    } finally {
      setStarting(false)
      setStartMessage(null)
    }
  }, [onRetry])

  const statusConfig = {
    connected: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
      border: 'border-emerald-200 dark:border-emerald-800/40',
      dot: 'bg-emerald-500',
      text: 'text-emerald-700 dark:text-emerald-400',
      label: 'Voice Agent Connected',
      icon: Wifi,
    },
    degraded: {
      bg: 'bg-amber-50 dark:bg-amber-950/20',
      border: 'border-amber-200 dark:border-amber-800/40',
      dot: 'bg-amber-500',
      text: 'text-amber-700 dark:text-amber-400',
      label: 'Voice Agent Degraded — some providers unavailable',
      icon: AlertTriangle,
    },
    offline: {
      bg: 'bg-red-50 dark:bg-red-950/20',
      border: 'border-red-200 dark:border-red-800/40',
      dot: 'bg-red-500',
      text: 'text-red-700 dark:text-red-400',
      label: 'Voice Agent Offline',
      icon: WifiOff,
    },
    starting: {
      bg: 'bg-blue-50 dark:bg-blue-950/20',
      border: 'border-blue-200 dark:border-blue-800/40',
      dot: 'bg-blue-500',
      text: 'text-blue-700 dark:text-blue-400',
      label: startMessage || 'Starting voice agent...',
      icon: Loader2,
    },
    loading: {
      bg: 'bg-muted/50',
      border: 'border-border',
      dot: 'bg-muted-foreground',
      text: 'text-muted-foreground',
      label: 'Checking status...',
      icon: Activity,
    },
  }

  const cfg = statusConfig[overallStatus]
  const StatusIcon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${cfg.border} ${cfg.bg} p-3`}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative">
            <div className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
            {overallStatus === 'connected' && (
              <motion.div
                className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${cfg.dot}`}
                animate={{ scale: [1, 1.8, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            {overallStatus === 'starting' && (
              <motion.div
                className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${cfg.dot}`}
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            )}
          </div>
          <StatusIcon className={`h-4 w-4 ${cfg.text} shrink-0 ${overallStatus === 'starting' ? 'animate-spin' : ''}`} />
          <div className="min-w-0">
            <p className={`text-xs font-medium ${cfg.text} truncate`}>{cfg.label}</p>
            {lastConnected && overallStatus !== 'connected' && overallStatus !== 'starting' && (
              <p className="text-[9px] text-muted-foreground truncate">Last connected: {lastConnected}</p>
            )}
          </div>
        </div>
        {(overallStatus === 'offline' || overallStatus === 'degraded') && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[9px] px-2.5 gap-1 shrink-0"
            onClick={handleRetry}
            disabled={starting}
          >
            <RefreshCw className={`h-3 w-3 ${starting ? 'animate-spin' : ''}`} /> {starting ? 'Starting...' : 'Retry'}
          </Button>
        )}
      </div>
    </motion.div>
  )
}


// Sub-component: Pipeline Flow Visualization
function PipelineFlowVisualization({ config }: { config: VoicePipelineConfigData }) {
  const langLabel = config.language === 'ar' ? 'العربية' : config.language === 'en' ? 'EN' : 'Auto'
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center gap-0 py-3">
        {PIPELINE_STAGES.map((stage, i) => {
          const primaryProvider = config[stage.type].primary
          const meta = PROVIDER_META[primaryProvider]
          const StageIcon = stage.icon

          return (
            <div key={stage.type} className="flex items-center">
              {/* Stage node */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className={`relative rounded-xl border-2 ${stage.borderColor} ${stage.bgColor} px-4 py-2.5 min-w-[100px]`}>
                  <div className="flex items-center gap-2 mb-1">
                    <StageIcon className="h-3.5 w-3.5" style={{ color: stage.color }} />
                    <span className="text-[10px] font-bold text-foreground">{stage.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-4 w-4 rounded-full bg-gradient-to-br ${meta.bgGradient} flex items-center justify-center text-white text-[7px] font-bold shadow-sm`}>
                      {meta.initial}
                    </div>
                    <span className="text-[9px] text-muted-foreground truncate">{meta.label}</span>
                  </div>
                  {/* Animated pulse on the active flow */}
                  {i === 1 && (
                    <motion.div
                      className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}
                </div>
                <span className="text-[8px] text-muted-foreground mt-1">{stage.fullLabel}</span>
              </motion.div>

              {/* Arrow between stages */}
              {i < PIPELINE_STAGES.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.1 + 0.05 }}
                  className="flex items-center mx-1"
                >
                  <div className="flex items-center">
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50" />
                    </motion.div>
                  </div>
                  <div className="w-4 h-px bg-muted-foreground/20" />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
      {/* Language badge */}
      <div className="flex justify-center">
        <div className="flex items-center gap-1.5 rounded-full bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 px-3 py-1">
          <Languages className="h-3 w-3 text-violet-600" />
          <span className="text-[9px] font-medium text-violet-700 dark:text-violet-300">
            Language: {langLabel}
          </span>
        </div>
      </div>
    </div>
  )
}


// Sub-component: Provider Selection Card
function ProviderCard({
  providerKey,
  isSelected,
  isFallback,
  providerStatus,
  onClick,
  roleType,
}: {
  providerKey: string
  isSelected: boolean
  isFallback: boolean
  providerStatus: string | null
  onClick: () => void
  roleType?: 'stt' | 'tts' | 'llm'
}) {
  const meta = PROVIDER_META[providerKey]
  if (!meta) return null

  // Role-specific descriptions
  const roleDescriptions: Record<string, Record<string, string>> = {
    stt: {
      deepgram: 'Nova-3 streaming, Arabic & English',
      cartesia: 'Batch transcription, Arabic & English',
      zai: 'ZAI SDK batch ASR',
    },
    tts: {
      cartesia: 'Sonic-3.5 streaming, Arabic & English',
      deepgram: 'Aura-2 TTS, 7 langs (no Arabic)',
      zai: 'ZAI SDK batch TTS',
      gemini: 'Gemini Flash TTS, multilingual',
    },
    llm: {
      zai: 'ZAI SDK chat completions',
      gemini: 'Gemini 2.5 Flash',
    },
  }
  const description = (roleType && roleDescriptions[roleType]?.[providerKey]) || meta.description

  const isAvailable = providerStatus === 'configured' || providerStatus === 'available' || providerStatus === 'online'
  const isDegraded = providerStatus === 'degraded'
  const statusDotColor = isAvailable
    ? 'bg-emerald-500'
    : isDegraded
      ? 'bg-amber-500'
      : providerStatus
        ? 'bg-red-400'
        : 'bg-muted-foreground/30'

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`relative text-left p-3 rounded-xl border-2 transition-all cursor-pointer w-full ${
        isSelected
          ? `${meta.selectedBorder} ${meta.selectedBg} shadow-sm`
          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Provider avatar */}
        <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${meta.bgGradient} flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0`}>
          {meta.initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-foreground truncate">{meta.label}</span>
            <div className="relative">
              <div className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
              {isAvailable && (
                <motion.div
                  className={`absolute inset-0 h-1.5 w-1.5 rounded-full ${statusDotColor}`}
                  animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">{description}</p>
        </div>
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-teal-500 flex items-center justify-center shadow-sm"
        >
          <Check className="h-3 w-3 text-white" />
        </motion.div>
      )}

      {/* Fallback badge */}
      {isFallback && isSelected && (
        <Badge variant="outline" className="absolute -bottom-1 left-3 text-[7px] px-1.5 py-0 h-3.5 bg-background">
          FALLBACK
        </Badge>
      )}
    </motion.button>
  )
}


// Sub-component: API Keys Section
function APIKeysSection({ status, onStatusChange }: { status: VoiceProviderStatus | null; onStatusChange: () => void }) {
  const [keysOpen, setKeysOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [keyValue, setKeyValue] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [keySaved, setKeySaved] = useState<string | null>(null)

  const keyProviders = [
    { key: 'deepgram', name: 'Deepgram', icon: Mic, statusKey: 'deepgram' as keyof VoiceProviderStatus, placeholder: 'Enter Deepgram API key...', link: 'https://console.deepgram.com', linkLabel: 'Get Key →', info: '$200 free credit · Nova-3 · EN + AR' },
    { key: 'cartesia', name: 'Cartesia', icon: Volume2, statusKey: 'cartesia' as keyof VoiceProviderStatus, placeholder: 'Enter Cartesia API key...', link: 'https://cartesia.ai', linkLabel: 'Get Key →', info: '20K free credits · Sonic-3.5 · 42 langs' },
    { key: 'zai', name: 'Z AI Provider', icon: Zap, statusKey: 'zai' as keyof VoiceProviderStatus, placeholder: 'Enter Z AI API key...', link: '#', linkLabel: 'Built-in', info: 'SDK integrated · Chat + TTS + ASR' },
    { key: 'geminiProxy', name: 'Gemini Proxy', icon: Brain, statusKey: 'geminiProxy' as keyof VoiceProviderStatus, placeholder: 'Enter Gemini API key...', link: 'https://aistudio.google.com', linkLabel: 'Get Key →', info: 'Google AI Studio · Flash models' },
  ]

  const getStatusInfo = (providerStatus: string | undefined) => {
    if (!providerStatus) return { dot: 'bg-muted-foreground/30', label: 'Unknown' }
    if (providerStatus === 'configured' || providerStatus === 'available' || providerStatus === 'online') {
      return { dot: 'bg-emerald-500', label: 'Configured' }
    }
    if (providerStatus === 'degraded') {
      return { dot: 'bg-amber-500', label: 'Degraded' }
    }
    return { dot: 'bg-red-400', label: 'Missing Key' }
  }

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key ? '••••••••' : ''
    return key.slice(0, 4) + '••••••' + key.slice(-4)
  }

  return (
    <Collapsible open={keysOpen} onOpenChange={setKeysOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors cursor-pointer">
          <Key className="h-3.5 w-3.5 text-amber-600" />
          <span className="text-xs font-medium text-foreground flex-1 text-left">API Keys</span>
          <div className="flex items-center gap-1.5">
            {status && (
              <div className="flex items-center gap-1">
                {keyProviders.slice(0, 3).map((p) => {
                  const info = getStatusInfo(status[p.statusKey])
                  return (
                    <div
                      key={p.key}
                      className={`h-1.5 w-1.5 rounded-full ${info.dot}`}
                      title={`${p.name}: ${info.label}`}
                    />
                  )
                })}
              </div>
            )}
            {keysOpen ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-2 pl-1">
          {keyProviders.map((provider) => {
            const statusInfo = getStatusInfo(status?.[provider.statusKey])
            const isEditing = editingProvider === provider.key

            return (
              <div key={provider.key} className="rounded-lg border border-border/40 p-2.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <provider.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-foreground flex-1">{provider.name}</span>
                  <div className="flex items-center gap-1.5">
                    <div className={`h-1.5 w-1.5 rounded-full ${statusInfo.dot}`} />
                    <span className="text-[9px] text-muted-foreground">{statusInfo.label}</span>
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      <Input
                        type="password"
                        value={keyValue}
                        onChange={(e) => setKeyValue(e.target.value)}
                        placeholder={provider.placeholder}
                        className="h-7 text-xs flex-1"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[9px] px-2 shrink-0"
                        onClick={() => {
                          setEditingProvider(null)
                          setKeyValue('')
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[9px] px-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                        disabled={!keyValue.trim() || savingKey}
                        onClick={async () => {
                          if (!editingProvider || !keyValue.trim()) return
                          setSavingKey(true)
                          try {
                            const res = await fetch('/api/voice-providers/api-keys', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ provider: editingProvider, apiKey: keyValue.trim() }),
                            })
                            const data = await res.json()
                            if (res.ok && data.success) {
                              setKeySaved(editingProvider)
                              setEditingProvider(null)
                              setKeyValue('')
                              onStatusChange()
                              setTimeout(() => setKeySaved(null), 3000)
                            } else {
                              alert(data.error || 'Failed to save API key')
                            }
                          } catch (err) {
                            alert('Failed to save API key — service may be offline')
                          } finally {
                            setSavingKey(false)
                          }
                        }}
                      >
                        {savingKey ? <><Loader2 className="h-3 w-3 animate-spin" /> Saving...</> : 'Save'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      {keySaved === provider.key ? (
                        <div className="flex items-center gap-1.5">
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">API key saved successfully</span>
                        </div>
                      ) : (status?.[provider.statusKey] === 'configured' || status?.[provider.statusKey] === 'available') ? (
                        <div className="flex items-center gap-1.5">
                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {provider.key === 'zai' || provider.key === 'geminiProxy' 
                              ? 'rk_•••••••••••5cc8' 
                              : `sk_•••••••••••${provider.key === 'deepgram' ? '5c2c' : 'kb3i'}`}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">No API key configured</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-5 text-[8px] px-2 shrink-0"
                      onClick={() => {
                        setEditingProvider(provider.key)
                        setKeyValue('')
                      }}
                    >
                      Configure
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[8px] text-muted-foreground">{provider.info}</p>
                  {provider.link !== '#' && (
                    <a
                      href={provider.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[8px] text-teal-600 hover:underline"
                    >
                      {provider.linkLabel}
                    </a>
                  )}
                </div>
              </div>
            )
          })}

          {/* Setup instructions */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 p-2.5 mt-2">
            <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400 mb-1">
              How to configure API keys:
            </p>
            <ol className="text-[9px] text-amber-600 dark:text-amber-500 space-y-0.5 list-decimal list-inside">
              <li>Sign up at each provider (links above)</li>
              <li>Copy your API keys from their dashboards</li>
              <li>Set them in <code className="bg-amber-100 dark:bg-amber-900/40 px-0.5 rounded text-[8px]">src/worker/voice-agent/.env</code></li>
              <li>Restart the voice agent service</li>
            </ol>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}


// Main VoicePipelineConfig component
export function VoicePipelineConfig() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<VoicePipelineConfigData>(DEFAULT_CONFIG)
  const [status, setStatus] = useState<VoiceProviderStatus | null>(null)
  const [available, setAvailable] = useState<{ stt: string[]; tts: string[]; llm: string[]; languages: LanguageOption[] }>({
    stt: ['deepgram', 'cartesia', 'zai'],
    tts: ['cartesia', 'deepgram', 'zai', 'gemini'],
    llm: ['zai', 'gemini'],
    languages: LANGUAGE_OPTIONS,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastConnected, setLastConnected] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'fail' | null>(null)
  const [providerErrors, setProviderErrors] = useState<Array<{
    id: string; provider: string; category: string; error: string;
    timestamp: string; fallbackUsed?: string; resolved: boolean
  }>>([])
  const [showAllErrors, setShowAllErrors] = useState(false)
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/voice-providers')
      const data: VoiceProvidersResponse = await res.json()
      if (res.ok && data.config) {
        setConfig(data.config)
        if (data.status) {
          setStatus(data.status)
          setLastConnected(new Date().toLocaleTimeString())
        }
        if (data.available) {
          const normalizeProviders = (providers: string[] | Record<string, unknown>) => {
            if (Array.isArray(providers)) return providers
            return Object.keys(providers)
          }
          setAvailable({
            stt: normalizeProviders(data.available.stt),
            tts: normalizeProviders(data.available.tts),
            llm: normalizeProviders(data.available.llm),
            languages: data.available.languages || LANGUAGE_OPTIONS,
          })
        }
      } else {
        if (data.config) setConfig(data.config)
        if (data.status) {
          setStatus(data.status)
        }
        if (data.available) {
          const normalizeProviders = (providers: string[] | Record<string, unknown>) => {
            if (Array.isArray(providers)) return providers
            return Object.keys(providers)
          }
          setAvailable({
            stt: normalizeProviders(data.available.stt),
            tts: normalizeProviders(data.available.tts),
            llm: normalizeProviders(data.available.llm),
            languages: data.available.languages || LANGUAGE_OPTIONS,
          })
        }
        setError(data.error || 'Voice agent service unavailable')
      }
    } catch {
      setError('Failed to connect to voice agent service')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [fetchConfig])

  // Fetch provider errors (admin only — not shown to customers)
  const fetchProviderErrors = useCallback(async () => {
    try {
      const res = await fetch('/api/voice-providers/errors?active=true')
      if (res.ok) {
        const data = await res.json()
        setProviderErrors(data.errors || [])
      }
    } catch {
      // silently ignore — errors are supplementary info
    }
  }, [])

  useEffect(() => {
    fetchProviderErrors()
    // Poll every 10 seconds for new errors
    const interval = setInterval(fetchProviderErrors, 10000)
    return () => clearInterval(interval)
  }, [fetchProviderErrors])

  const handleSave = useCallback(async () => {
    setSaving(true)
    setSaveSuccess(false)
    setError(null)
    try {
      const res = await fetch('/api/voice-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
        await fetchConfig()
      } else {
        setError('Failed to save configuration')
      }
    } catch {
      setError('Failed to connect to voice agent service')
    } finally {
      setSaving(false)
    }
  }, [config, fetchConfig])

  const handleTest = useCallback(async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/voice-providers')
      if (res.ok) {
        setTestResult('success')
      } else {
        setTestResult('fail')
      }
    } catch {
      setTestResult('fail')
    } finally {
      setTesting(false)
      setTimeout(() => setTestResult(null), 4000)
    }
  }, [])

  const handleReset = useCallback(() => {
    setConfig(DEFAULT_CONFIG)
  }, [])

  const updateProvider = useCallback((type: 'stt' | 'tts' | 'llm', role: 'primary' | 'fallback', value: string) => {
    setConfig(prev => ({
      ...prev,
      [type]: { ...prev[type], [role]: value },
    }))
  }, [])

  const getProviderStatus = useCallback((providerKey: string): string | null => {
    if (!status) return null
    const key = providerKey === 'gemini' ? 'geminiProxy' : providerKey
    return status[key as keyof VoiceProviderStatus] || null
  }, [status])

  const providerSections = [
    { type: 'stt' as const, label: 'Speech-to-Text', icon: Mic, color: '#0ea5e9', bgColor: 'bg-sky-50 dark:bg-sky-950/20', borderColor: 'border-sky-200 dark:border-sky-800/40', iconColor: 'text-sky-600' },
    { type: 'tts' as const, label: 'Text-to-Speech', icon: Volume2, color: '#f97316', bgColor: 'bg-orange-50 dark:bg-orange-950/20', borderColor: 'border-orange-200 dark:border-orange-800/40', iconColor: 'text-orange-600' },
    { type: 'llm' as const, label: 'Language Model', icon: Brain, color: '#10b981', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20', borderColor: 'border-emerald-200 dark:border-emerald-800/40', iconColor: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm rounded-xl py-4">
        <CardHeader className="px-4 pb-0 pt-0">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/30">
              <Radio className="h-3.5 w-3.5 text-teal-600" />
            </div>
            Voice Pipeline
          </CardTitle>
          <CardDescription className="text-xs">
            Configure the speech-to-text, text-to-speech, and language model providers for the voice agent
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pt-3 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading pipeline config...</span>
            </div>
          ) : (
            <>
              {/* 1. Service Status Banner */}
              <ServiceStatusBanner
                status={status}
                error={error}
                lastConnected={lastConnected}
                onRetry={fetchConfig}
              />

              {/* 2. Pipeline Flow Visualization */}
              <PipelineFlowVisualization config={config} />

              <Separator />

              {/* 2.5. Language Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40">
                    <Languages className="h-4 w-4 text-violet-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Language Configuration</p>
                    <p className="text-[10px] text-muted-foreground">Set the primary language for speech recognition and synthesis</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {available.languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setConfig(prev => ({ ...prev, language: lang.code }))}
                      className={`relative flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all duration-200 text-left ${
                        config.language === lang.code
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-sm shadow-violet-200 dark:shadow-violet-900/20'
                          : 'border-muted bg-background hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/50 dark:hover:bg-violet-950/10'
                      }`}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold shrink-0 ${
                        config.language === lang.code
                          ? 'bg-violet-500 text-white'
                          : 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'
                      }`}>
                        {lang.code === 'multi' ? '🌐' : lang.code === 'ar' ? 'ع' : 'En'}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold truncate ${
                          config.language === lang.code ? 'text-violet-700 dark:text-violet-200' : 'text-foreground'
                        }`}>
                          {lang.label}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {lang.code === 'multi' ? 'Auto-detect Arabic & English' 
                            : lang.code === 'ar' ? 'التعرف على اللغة العربية' 
                            : 'English speech recognition'}
                        </p>
                      </div>
                      {config.language === lang.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute top-2 right-2"
                        >
                          <Check className="h-3.5 w-3.5 text-violet-600" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
                {config.language === 'ar' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[10px] text-amber-700 dark:text-amber-300">
                      <span className="font-semibold">Arabic mode:</span> Deepgram Nova-3 will use Arabic language model for STT (supports 17 Arabic dialects including UAE Arabic). TTS uses Cartesia Sonic-3.5 (primary, supports Arabic) with ZAI SDK as fallback. The LLM will respond primarily in Arabic.
                    </div>
                  </motion.div>
                )}
                {config.language === 'en' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2"
                  >
                    <Globe className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div className="text-[10px] text-emerald-700 dark:text-emerald-300">
                      <span className="font-semibold">English mode:</span> Deepgram Nova-3 will use the English language model for STT. TTS uses Cartesia Sonic-3.5 (primary) with Deepgram Aura as fallback. The LLM will respond in English.
                    </div>
                  </motion.div>
                )}
                {config.language === 'multi' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-start gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-800/40 px-3 py-2"
                  >
                    <Globe className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                    <div className="text-[10px] text-sky-700 dark:text-sky-300">
                      <span className="font-semibold">Auto-detect mode:</span> Deepgram Nova-3 will use the Arabic language model (optimized for UAE). If English speech is poorly recognized, ZAI ASR provides automatic fallback. TTS uses language-specific providers configured below. The LLM responds in the same language as the user.
                    </div>
                  </motion.div>
                )}
              </div>

              <Separator />

              {/* 2.6. Language-Specific TTS Provider Mapping */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40">
                    <Volume2 className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Language → TTS Provider Mapping</p>
                    <p className="text-[10px] text-muted-foreground">Choose which TTS provider to use for each language — no hardcoded routing</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Arabic TTS Provider */}
                  <div className="rounded-xl border-2 border-orange-200 dark:border-orange-800/40 bg-orange-50/50 dark:bg-orange-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-200 dark:bg-orange-800/60 text-xs font-bold text-orange-800 dark:text-orange-200">
                        ع
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-orange-700 dark:text-orange-300">Arabic (العربية)</p>
                        <p className="text-[9px] text-muted-foreground">Cartesia & Gemini support Arabic</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground w-14">Primary</span>
                        <select
                          value={config.tts.languageProviders?.ar?.primary || 'cartesia'}
                          onChange={(e) => {
                            const newLP = { ...config.tts.languageProviders }
                            if (!newLP.ar) newLP.ar = { primary: 'cartesia', fallback: 'zai' }
                            newLP.ar = { ...newLP.ar, primary: e.target.value }
                            setConfig(prev => ({ ...prev, tts: { ...prev.tts, languageProviders: newLP } }))
                          }}
                          className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="cartesia">Cartesia (Sonic-3.5)</option>
                          <option value="zai">Z AI Provider</option>
                          <option value="gemini">Gemini (⚠ Regional)</option>
                          <option value="deepgram">Deepgram (⚠ No Arabic)</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground w-14">Fallback</span>
                        <select
                          value={config.tts.languageProviders?.ar?.fallback || 'zai'}
                          onChange={(e) => {
                            const newLP = { ...config.tts.languageProviders }
                            if (!newLP.ar) newLP.ar = { primary: 'cartesia', fallback: 'zai' }
                            newLP.ar = { ...newLP.ar, fallback: e.target.value }
                            setConfig(prev => ({ ...prev, tts: { ...prev.tts, languageProviders: newLP } }))
                          }}
                          className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="zai">Z AI Provider</option>
                          <option value="gemini">Gemini (⚠ Regional)</option>
                          <option value="cartesia">Cartesia (Sonic-3.5)</option>
                          <option value="deepgram">Deepgram (⚠ No Arabic)</option>
                        </select>
                      </div>
                    </div>
                    {(config.tts.languageProviders?.ar?.primary === 'deepgram' || config.tts.languageProviders?.ar?.fallback === 'deepgram') && (
                      <div className="flex items-start gap-1.5 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40 px-2 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-red-600 mt-0.5 shrink-0" />
                        <span className="text-[9px] text-red-700 dark:text-red-300">Deepgram Aura does NOT support Arabic (EN, ES, NL, FR, DE, IT, JA only). It will fail and fall back.</span>
                      </div>
                    )}
                    {(config.tts.languageProviders?.ar?.primary === 'gemini' || config.tts.languageProviders?.ar?.fallback === 'gemini') && (
                      <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-2 py-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
                        <span className="text-[9px] text-amber-700 dark:text-amber-300">Gemini TTS supports Arabic but may have regional restrictions. If it fails, it will fall back automatically.</span>
                      </div>
                    )}
                  </div>

                  {/* English TTS Provider */}
                  <div className="rounded-xl border-2 border-sky-200 dark:border-sky-800/40 bg-sky-50/50 dark:bg-sky-950/10 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-200 dark:bg-sky-800/60 text-xs font-bold text-sky-800 dark:text-sky-200">
                        En
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">English</p>
                        <p className="text-[9px] text-muted-foreground">All providers support English</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground w-14">Primary</span>
                        <select
                          value={config.tts.languageProviders?.en?.primary || 'cartesia'}
                          onChange={(e) => {
                            const newLP = { ...config.tts.languageProviders }
                            if (!newLP.en) newLP.en = { primary: 'cartesia', fallback: 'deepgram' }
                            newLP.en = { ...newLP.en, primary: e.target.value }
                            setConfig(prev => ({ ...prev, tts: { ...prev.tts, languageProviders: newLP } }))
                          }}
                          className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="cartesia">Cartesia (Sonic-3.5)</option>
                          <option value="deepgram">Deepgram (Aura)</option>
                          <option value="gemini">Gemini (Kore)</option>
                          <option value="zai">Z AI Provider</option>
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-muted-foreground w-14">Fallback</span>
                        <select
                          value={config.tts.languageProviders?.en?.fallback || 'deepgram'}
                          onChange={(e) => {
                            const newLP = { ...config.tts.languageProviders }
                            if (!newLP.en) newLP.en = { primary: 'cartesia', fallback: 'deepgram' }
                            newLP.en = { ...newLP.en, fallback: e.target.value }
                            setConfig(prev => ({ ...prev, tts: { ...prev.tts, languageProviders: newLP } }))
                          }}
                          className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-[10px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                          <option value="deepgram">Deepgram (Aura)</option>
                          <option value="cartesia">Cartesia (Sonic-3.5)</option>
                          <option value="gemini">Gemini (Kore)</option>
                          <option value="zai">Z AI Provider</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 px-3 py-2">
                  <Volume2 className="h-3.5 w-3.5 text-orange-600 mt-0.5 shrink-0" />
                  <div className="text-[9px] text-orange-700 dark:text-orange-300">
                    <span className="font-semibold">How it works:</span> When the AI responds in Arabic, the Arabic TTS provider is used. When it responds in English, the English TTS provider is used. This is admin-configurable — choose any combination you prefer. If a provider fails, it automatically falls back to the configured fallback provider.
                  </div>
                </div>
              </div>

              <Separator />

              {/* 2.7. Listening Duration Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                    <Activity className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Listening Duration</p>
                    <p className="text-[10px] text-muted-foreground">Maximum time the agent listens before processing speech</p>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/10 px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">Max speech duration</span>
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300">
                      {(config.maxSpeechDuration || 15000) / 1000}s
                    </span>
                  </div>
                  <Slider
                    value={[config.maxSpeechDuration || 15000]}
                    min={5000}
                    max={30000}
                    step={1000}
                    onValueChange={(val) => setConfig(prev => ({ ...prev, maxSpeechDuration: val[0] }))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground">
                    <span>5s (short)</span>
                    <span>15s (default)</span>
                    <span>30s (long)</span>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
                    <Activity className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[9px] text-amber-700 dark:text-amber-300">
                      <span className="font-semibold">How it works:</span> When the user speaks, the agent listens for up to this duration before processing. 
                      Shorter values (5-10s) are better for quick Q&A. Longer values (15-30s) allow for more detailed responses and are recommended for Arabic speakers who may speak at a different pace.
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 3. Provider Configuration Sections */}
              <div className="space-y-5">
                {providerSections.map((section, sectionIndex) => (
                  <div key={section.type}>
                    {/* Section header */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${section.bgColor} border ${section.borderColor}`}>
                        <section.icon className={`h-4 w-4 ${section.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{section.label}</p>
                        <p className="text-[9px] text-muted-foreground">
                          Active: <span className="font-medium text-foreground">{PROVIDER_META[config[section.type].primary]?.label || config[section.type].primary}</span>
                          <span className="mx-1 text-muted-foreground/50">→</span>
                          <span className="text-muted-foreground">{PROVIDER_META[config[section.type].fallback]?.label || config[section.type].fallback} (fallback)</span>
                        </p>
                      </div>
                    </div>

                    {/* Primary row */}
                    <div className="mb-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-teal-300 text-teal-700 dark:border-teal-700 dark:text-teal-300">
                          Primary
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {available[section.type].map((p) => (
                          <ProviderCard
                            key={p}
                            providerKey={p}
                            isSelected={config[section.type].primary === p}
                            isFallback={false}
                            providerStatus={getProviderStatus(p)}
                            onClick={() => updateProvider(section.type, 'primary', p)}
                            roleType={section.type}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Fallback row */}
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground">
                          Fallback
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {available[section.type]
                          .filter((p) => p !== config[section.type].primary)
                          .map((p) => (
                            <ProviderCard
                              key={p}
                              providerKey={p}
                              isSelected={config[section.type].fallback === p}
                              isFallback={true}
                              providerStatus={getProviderStatus(p)}
                              onClick={() => updateProvider(section.type, 'fallback', p)}
                              roleType={section.type}
                            />
                          ))}
                      </div>
                    </div>

                    {sectionIndex < providerSections.length - 1 && <Separator className="mt-5" />}
                  </div>
                ))}
              </div>

              <Separator />

              {/* 4. API Keys Section */}
              <APIKeysSection status={status} onStatusChange={fetchConfig} />

              {/* 4.5. Provider Error Alerts — Admin only, NOT shown to customers */}
              {providerErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Provider Alerts</p>
                      <p className="text-[10px] text-muted-foreground">{providerErrors.length} active issue{providerErrors.length !== 1 ? 's' : ''} — primary providers falling back</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[9px] px-2"
                      onClick={() => setShowAllErrors(!showAllErrors)}
                    >
                      {showAllErrors ? 'Show Less' : 'Show All'}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {(showAllErrors ? providerErrors : providerErrors.slice(0, 3)).map((err) => {
                      const meta = PROVIDER_META[err.provider]
                      const categoryLabel = err.category === 'tts' ? 'TTS' : err.category === 'stt' ? 'STT' : 'LLM'
                      const categoryColor = err.category === 'tts'
                        ? 'text-orange-700 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/40'
                        : err.category === 'stt'
                          ? 'text-sky-700 bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800/40'
                          : 'text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40'
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(err.timestamp).getTime()
                        if (diff < 60000) return 'just now'
                        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
                        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
                        return new Date(err.timestamp).toLocaleDateString()
                      })()

                      return (
                        <motion.div
                          key={err.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`rounded-lg border px-3 py-2 ${categoryColor}`}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-bold">{categoryLabel}</span>
                                <span className="text-[10px]">→</span>
                                <span className="text-[10px] font-semibold flex items-center gap-1">
                                  {meta ? meta.label : err.provider}
                                </span>
                                {err.fallbackUsed && (
                                  <>
                                    <span className="text-[9px] text-muted-foreground">fell back to</span>
                                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5">
                                      {PROVIDER_META[err.fallbackUsed]?.label || err.fallbackUsed}
                                    </Badge>
                                  </>
                                )}
                                <span className="text-[9px] text-muted-foreground ml-auto">{timeAgo}</span>
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{err.error}</p>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 5. Save success indicator */}
              <AnimatePresence>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-1.5 text-xs text-emerald-600 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3 py-2"
                  >
                    <Check className="h-4 w-4" />
                    Configuration saved successfully
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Test result indicator */}
              <AnimatePresence>
                {testResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className={`flex items-center gap-1.5 text-xs rounded-lg border px-3 py-2 ${
                      testResult === 'success'
                        ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                        : 'text-red-600 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800/40'
                    }`}
                  >
                    {testResult === 'success' ? (
                      <>
                        <Wifi className="h-4 w-4" />
                        Connection test successful — all providers responding
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4" />
                        Connection test failed — voice agent service unreachable
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 6. Actions */}
              <div className="flex items-center gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] gap-1.5"
                  onClick={handleReset}
                  disabled={loading}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset to Defaults
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-[10px] gap-1.5"
                  onClick={handleTest}
                  disabled={testing || loading}
                >
                  {testing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Testing...</>
                  ) : (
                    <><Radio className="h-3.5 w-3.5" /> Test Connection</>
                  )}
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-[10px] gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={saving || loading}
                  onClick={handleSave}
                >
                  {saving ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5" /> Save Pipeline</>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Knowledge Base Management — Kept mostly as-is
// ═══════════════════════════════════════════════════════════════════════════════
function KnowledgeBaseManagement() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [categories, setCategories] = useState<KnowledgeCategory[]>([
    { id: 'kb-1', name: t('electricityWater'), articleCount: 12, enabled: true, lastUpdated: '2h ago', coverageScore: 94 },
    { id: 'kb-2', name: t('housingServices'), articleCount: 8, enabled: true, lastUpdated: '1d ago', coverageScore: 87 },
    { id: 'kb-3', name: t('petroleumEnergy'), articleCount: 6, enabled: true, lastUpdated: '3d ago', coverageScore: 78 },
    { id: 'kb-4', name: t('transportServices'), articleCount: 5, enabled: false, lastUpdated: '5d ago', coverageScore: 62 },
    { id: 'kb-5', name: t('digitalServices'), articleCount: 9, enabled: true, lastUpdated: '6h ago', coverageScore: 91 },
    { id: 'kb-6', name: t('sustainability'), articleCount: 7, enabled: true, lastUpdated: '1d ago', coverageScore: 83 },
  ])

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories
    return categories.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [categories, searchQuery])

  const toggleCategory = (id: string) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, enabled: !c.enabled } : c))
  }

  return (
    <Card className="bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm rounded-2xl overflow-hidden relative">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <CardHeader className="px-6 pb-4 pt-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#1B1D21]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-200/50 text-teal-700">
                <BookOpen className="h-4 w-4" />
              </div>
              {t('knowledgeBase')}
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-1.5">{t('knowledgeBaseDesc')}</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="h-9 gap-2 bg-[#006352] hover:bg-[#005042] text-white rounded-lg shadow-sm transition-all hover:shadow-md">
                <Plus className="h-4 w-4" />{t('addKnowledge')}
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-gray-200/50 shadow-xl bg-white/95 backdrop-blur-xl">
              <DialogHeader>
                <DialogTitle className="text-[#006352]">{t('addKnowledgeTitle')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <Input placeholder={t('categoryName')} className="rounded-lg focus-visible:ring-[#006352]" />
                <Input placeholder={t('articleTitle')} className="rounded-lg focus-visible:ring-[#006352]" />
                <textarea className="w-full min-h-[160px] rounded-lg border border-gray-200 bg-white/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006352] transition-shadow resize-none" placeholder={t('articleContent')} />
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" className="rounded-lg">{t('cancel')}</Button>
                  <Button className="rounded-lg bg-[#006352] hover:bg-[#005042] text-white">{t('submit')}</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Search & Coverage */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="h-10 pl-9 rounded-xl border-gray-200 bg-gray-50/50 hover:bg-white focus:bg-white transition-colors focus-visible:ring-[#006352]"
              placeholder={t('searchCategories')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-50/50 to-[#006352]/5 border border-teal-100 w-full md:w-auto min-w-[240px]">
            <div className="flex-1">
              <p className="text-[11px] font-medium text-teal-800/70 uppercase tracking-wider">{t('overallCoverage')}</p>
              <p className="text-lg font-bold text-[#006352]">82.5%</p>
            </div>
            <div className="w-24 h-2 rounded-full bg-teal-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-400 to-[#006352]" style={{ width: '82.5%' }} />
            </div>
          </div>
        </div>

        {/* Category Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCategories.map((cat) => (
            <motion.div 
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              key={cat.id} 
              className={cn(
                "flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 group relative overflow-hidden",
                cat.enabled 
                  ? "bg-white hover:border-[#006352]/30 hover:shadow-md border-gray-200/60" 
                  : "bg-gray-50/50 border-gray-200/40 opacity-70 grayscale-[0.2]"
              )}
            >
              {cat.enabled && (
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[#006352] to-teal-400" />
              )}
              <Switch checked={cat.enabled} onCheckedChange={() => toggleCategory(cat.id)} className="mt-0.5 data-[state=checked]:bg-[#006352]" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-sm font-bold text-gray-900 truncate">{cat.name}</p>
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full border-none font-semibold",
                    cat.enabled ? "bg-teal-50 text-[#006352]" : "bg-gray-100 text-gray-500"
                  )}>
                    {cat.articleCount} {t('articles')}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3 text-[11px]">
                  <span className="text-gray-500 font-medium">{t('updated')}: {cat.lastUpdated}</span>
                  <span className={cn(
                    "font-bold flex items-center gap-1",
                    cat.coverageScore >= 85 ? 'text-[#006352]' : cat.coverageScore >= 70 ? 'text-[#b8860b]' : 'text-rose-600'
                  )}>
                    {cat.coverageScore}% {t('coverage')}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Intent Training — Kept mostly as-is
// ═══════════════════════════════════════════════════════════════════════════════
function IntentTraining() {
  const { t } = useTranslation()
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [trainingIntents, setTrainingIntents] = useState<Set<string>>(new Set())

  const intents: IntentItem[] = useMemo(() => [
    { id: 'int-1', name: t('billingInquiry'), samplePhrases: 45, confidenceThreshold: 0.85, accuracy: 94, category: 'billing', isTraining: false },
    { id: 'int-2', name: t('serviceComplaint'), samplePhrases: 38, confidenceThreshold: 0.90, accuracy: 91, category: 'complaint', isTraining: false },
    { id: 'int-3', name: t('caseStatusCheck'), samplePhrases: 52, confidenceThreshold: 0.80, accuracy: 97, category: 'inquiry', isTraining: false },
    { id: 'int-4', name: t('outageReport'), samplePhrases: 28, confidenceThreshold: 0.88, accuracy: 89, category: 'emergency', isTraining: false },
    { id: 'int-5', name: t('connectionRequest'), samplePhrases: 33, confidenceThreshold: 0.82, accuracy: 92, category: 'service', isTraining: false },
    { id: 'int-6', name: t('paymentIssue'), samplePhrases: 41, confidenceThreshold: 0.87, accuracy: 90, category: 'billing', isTraining: false },
    { id: 'int-7', name: t('housingApplication'), samplePhrases: 22, confidenceThreshold: 0.84, accuracy: 86, category: 'service', isTraining: false },
    { id: 'int-8', name: t('generalInquiry'), samplePhrases: 67, confidenceThreshold: 0.75, accuracy: 95, category: 'inquiry', isTraining: false },
  ], [t])

  const filteredIntents = categoryFilter === 'all' ? intents : intents.filter(i => i.category === categoryFilter)

  const handleTrain = (id: string) => {
    setTrainingIntents(prev => new Set(prev).add(id))
    setTimeout(() => {
      setTrainingIntents(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }, 3000)
  }

  return (
    <Card className="bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm rounded-2xl overflow-hidden relative">
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      <CardHeader className="px-6 pb-4 pt-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#1B1D21]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200/50 text-amber-600">
                <Target className="h-4 w-4" />
              </div>
              {t('intentTraining')}
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-1.5">{t('intentTrainingDesc')}</CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-[140px] text-xs bg-gray-50/50 border-gray-200 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-gray-200 shadow-xl bg-white/95 backdrop-blur-xl">
                <SelectItem value="all">{t('allCategories')}</SelectItem>
                <SelectItem value="billing">{t('billing')}</SelectItem>
                <SelectItem value="complaint">{t('complaint')}</SelectItem>
                <SelectItem value="inquiry">{t('inquiry')}</SelectItem>
                <SelectItem value="emergency">{t('emergency')}</SelectItem>
                <SelectItem value="service">{t('service')}</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 gap-2 bg-[#b8860b] hover:bg-[#996f09] text-white rounded-lg shadow-sm transition-all hover:shadow-md">
              <Plus className="h-4 w-4" />{t('addIntent')}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 gap-3">
          {filteredIntents.map((intent) => (
            <motion.div 
              whileHover={{ scale: 1.005 }}
              key={intent.id} 
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-gray-200/60 bg-white hover:border-[#b8860b]/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1.5">
                  <p className="text-sm font-bold text-gray-900">{intent.name}</p>
                  <Badge variant="outline" className="bg-amber-50/50 text-amber-700 border-amber-200/50 text-[10px] px-2 rounded-full font-medium">
                    {intent.samplePhrases} {t('phrases')}
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-500 text-[10px] px-2 rounded-full capitalize">
                    {intent.category}
                  </Badge>
                </div>
                <div className="flex items-center gap-6 text-xs mt-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 font-medium">{t('threshold')}</span>
                    <span className="font-semibold text-gray-700">{(intent.confidenceThreshold * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-px h-6 bg-gray-200" />
                  <div className="flex flex-col gap-1">
                    <span className="text-gray-400 font-medium">{t('accuracy')}</span>
                    <span className={cn(
                      "font-bold flex items-center gap-1",
                      intent.accuracy >= 90 ? 'text-[#006352]' : intent.accuracy >= 80 ? 'text-[#b8860b]' : 'text-rose-600'
                    )}>
                      {intent.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                className={cn(
                  "h-10 px-4 gap-2 rounded-lg transition-all border font-semibold",
                  trainingIntents.has(intent.id) 
                    ? "bg-amber-50 text-amber-700 border-amber-200/50"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:text-[#b8860b] hover:border-[#b8860b]/30"
                )}
                disabled={trainingIntents.has(intent.id)}
                onClick={() => handleTrain(intent.id)}
              >
                {trainingIntents.has(intent.id) ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
                    <AnimatePresence>
                      <motion.span initial={{ width: 0 }} animate={{ width: 'auto' }} exit={{ width: 0 }}>
                        {t('training')}
                      </motion.span>
                    </AnimatePresence>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />{t('train')}
                  </>
                )}
              </Button>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Response Templates — Kept mostly as-is
// ═══════════════════════════════════════════════════════════════════════════════
function ResponseTemplates() {
  const { t } = useTranslation()
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null)

  const templates: ResponseTemplate[] = [
    { id: 'tpl-1', name: t('greetingTemplate'), language: 'EN/AR', lastModified: '2h ago', usageCount: 245 },
    { id: 'tpl-2', name: t('complaintAckTemplate'), language: 'EN/AR', lastModified: '1d ago', usageCount: 189 },
    { id: 'tpl-3', name: t('serviceInquiryTemplate'), language: 'EN', lastModified: '3d ago', usageCount: 156 },
    { id: 'tpl-4', name: t('outageResponseTemplate'), language: 'EN/AR', lastModified: '6h ago', usageCount: 98 },
    { id: 'tpl-5', name: t('billingExplanationTemplate'), language: 'EN', lastModified: '2d ago', usageCount: 134 },
    { id: 'tpl-6', name: t('caseFollowUpTemplate'), language: 'EN/AR', lastModified: '4d ago', usageCount: 112 },
  ]

  return (
    <Card className="bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm rounded-2xl overflow-hidden relative">
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl -translate-y-1/2 -z-10 pointer-events-none" />
      <CardHeader className="px-6 pb-4 pt-6 border-b border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-[#1B1D21]">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-50 to-violet-100/50 border border-violet-200/50 text-violet-600">
                <MessageSquare className="h-4 w-4" />
              </div>
              {t('responseTemplates')}
            </CardTitle>
            <CardDescription className="text-xs text-gray-500 mt-1.5">{t('responseTemplatesDesc')}</CardDescription>
          </div>
          <Button size="sm" className="h-9 gap-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-sm transition-all hover:shadow-md">
            <Plus className="h-4 w-4" />{t('createTemplate')}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <motion.div 
              whileHover={{ y: -2, scale: 1.01 }}
              transition={{ duration: 0.2 }}
              key={tpl.id} 
              className="flex flex-col p-4 rounded-xl border border-gray-200/60 bg-white hover:border-violet-500/30 hover:shadow-md transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-50 text-violet-500 group-hover:bg-violet-100 transition-colors">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{tpl.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 rounded border-gray-200 text-gray-500 font-medium">
                        {tpl.language}
                      </Badge>
                      <span className="text-[10px] text-gray-400">{t('updated')}: {tpl.lastModified}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-50">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
                  {tpl.usageCount} {t('uses')}
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md border-gray-200 text-gray-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200" title={t('edit')}>
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Dialog open={previewTemplate === tpl.id} onOpenChange={(open) => !open && setPreviewTemplate(null)}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-7 w-7 p-0 rounded-md border-gray-200 text-gray-500 hover:text-violet-600 hover:bg-violet-50 hover:border-violet-200" title={t('preview')} onClick={() => setPreviewTemplate(tpl.id)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl border-gray-200/50 shadow-xl bg-white/95 backdrop-blur-xl">
                      <DialogHeader>
                        <DialogTitle className="text-violet-700 flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          {tpl.name}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="rounded-xl border border-gray-200 p-5 text-sm text-gray-700 bg-gray-50/50 leading-relaxed shadow-inner">
                        <p>{t('templatePreviewPlaceholder')}</p>
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setPreviewTemplate(null)}>
                          {t('close')}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Performance Metrics — Kept mostly as-is
// ═══════════════════════════════════════════════════════════════════════════════
function PerformanceMetrics() {
  const { t } = useTranslation()

  const weeklyData = useMemo(() => [
    { day: 'Mon', accuracy: 91 },
    { day: 'Tue', accuracy: 92 },
    { day: 'Wed', accuracy: 90 },
    { day: 'Thu', accuracy: 93 },
    { day: 'Fri', accuracy: 94 },
    { day: 'Sat', accuracy: 92 },
    { day: 'Sun', accuracy: 93 },
  ], [])

  const metrics = [
    { label: t('escalationRate'), value: '8.2%', color: 'text-amber-600' },
    { label: t('avgConfidenceScore'), value: '0.87', color: 'text-brand-600' },
    { label: t('falsePositiveRate'), value: '3.1%', color: 'text-uae-green-600' },
    { label: t('aiCsat'), value: '4.2/5', color: 'text-teal-600' },
  ]

  return (
    <Card className="bg-white/80 backdrop-blur-xl border border-gray-200/50 shadow-sm rounded-xl py-4">
      <CardHeader className="px-4 pb-0 pt-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-50 dark:bg-teal-950/30">
            <BarChart3 className="h-3.5 w-3.5 text-teal-600" />
          </div>
          {t('aiPerformanceMetrics')}
        </CardTitle>
        <CardDescription className="text-xs">{t('aiPerformanceMetricsDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="px-4 pt-2 space-y-4">
        {/* Weekly Accuracy Trend */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-100)" />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} />
              <YAxis domain={[85, 100]} tick={{ fontSize: 9, fill: 'var(--color-base-400)' }} tickLine={false} axisLine={false} width={25} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-base-50)',
                  border: '1px solid var(--color-base-200)',
                  borderRadius: '8px',
                  fontSize: '11px',
                }}
              />
              <Line type="monotone" dataKey="accuracy" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: '#0D9488' }} name={t('accuracyPercent')} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <Separator />

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border p-2.5 bg-muted/10">
              <p className="text-[9px] text-muted-foreground">{m.label}</p>
              <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


// ═══════════════════════════════════════════════════════════════════════════════
// Main Component — Tab-based layout
// ═══════════════════════════════════════════════════════════════════════════════
export default function AIConfigPanel() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800/40">
          <Brain className="h-4.5 w-4.5 text-teal-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">{t('aiConfigPanel')}</h3>
          <p className="text-[10px] text-muted-foreground">{t('aiConfigPanelDesc')}</p>
        </div>
      </div>

      {/* Tab Layout */}
      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="h-9 w-full grid grid-cols-4">
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Models</span>
            <span className="sm:hidden">Models</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="text-xs gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Voice Pipeline</span>
            <span className="sm:hidden">Voice</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Knowledge</span>
            <span className="sm:hidden">Know</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: AI Models — model/provider configuration */}
        <TabsContent value="chat" className="mt-4">
          <AIModelSettings />
        </TabsContent>

        {/* Tab 2: Voice Pipeline */}
        <TabsContent value="voice" className="mt-4">
          <VoicePipelineConfig />
        </TabsContent>

        {/* Tab 3: Knowledge & Training */}
        <TabsContent value="knowledge" className="mt-4 space-y-4">
          <KnowledgeBaseManagement />
          <IntentTraining />
          <ResponseTemplates />
        </TabsContent>

        {/* Tab 4: Analytics */}
        <TabsContent value="analytics" className="mt-4">
          <PerformanceMetrics />
        </TabsContent>
      </Tabs>
    </div>
  )
}
