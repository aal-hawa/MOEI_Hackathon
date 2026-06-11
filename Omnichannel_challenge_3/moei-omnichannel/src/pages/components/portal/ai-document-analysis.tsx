'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  Image as ImageIcon,
  File,
  Upload,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Zap,
  Droplets,
  Home,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from '@/i18n'
import { useAppStore } from '@/store/app-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnalysisResult {
  documentType: string
  keyData: Record<string, string>
  recommendations: string[]
  summary: string
}

interface UploadedFile {
  name: string
  type: string
  size: number
  content: string // base64
}

type AnalysisState = 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'

// ─── File type icon helper ──────────────────────────────────────────────────

function getFileIcon(type: string) {
  if (type === 'application/pdf') return FileText
  if (type.startsWith('image/')) return ImageIcon
  return File
}

function getFileTypeColor(type: string) {
  if (type === 'application/pdf') return 'bg-red-50 text-red-600'
  if (type.startsWith('image/')) return 'bg-purple-50 text-purple-600'
  return 'bg-blue-50 text-tech-blue'
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
]

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// ─── Component ───────────────────────────────────────────────────────────────

export default function AIDocumentAnalysis() {
  const { t, isRTL, language } = useTranslation()
  const { setChatOpen } = useAppStore()

  const [state, setState] = useState<AnalysisState>('idle')
  const [progress, setProgress] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSection, setExpandedSection] = useState<string | null>('type')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── File validation ─────────────────────────────────────────────────
  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type) && !file.name.endsWith('.pdf') && !file.name.endsWith('.txt') && !file.name.endsWith('.csv')) {
      return t('docFileInvalid')
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('docFileTooLarge')
    }
    return null
  }, [t])

  // ─── Process file ───────────────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      setState('error')
      return
    }

    setError(null)
    setState('uploading')
    setProgress(0)

    // Read file as base64
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1] || ''
      const uploaded: UploadedFile = {
        name: file.name,
        type: file.type,
        size: file.size,
        content: base64,
      }
      setUploadedFile(uploaded)
      setState('analyzing')
      setProgress(10)

      // Simulate progress animation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + Math.random() * 15
        })
      }, 400)

      // Call the document analysis API
      try {
        const res = await fetch('/api/ai/document-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: uploaded.name,
            fileType: uploaded.type,
            content: uploaded.content,
            language,
          }),
        })

        clearInterval(progressInterval)

        if (res.ok) {
          const data = await res.json()
          setResult(data)
          setProgress(100)
          setTimeout(() => setState('complete'), 500)
        } else {
          setError(t('docAnalysisFailed'))
          setState('error')
        }
      } catch {
        clearInterval(progressInterval)
        setError(t('docAnalysisFailed'))
        setState('error')
      }
    }
    reader.readAsDataURL(file)
  }, [validateFile, language, t])

  // ─── Drag & drop handlers ───────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      processFile(files[0])
    }
  }, [processFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }, [processFile])

  // ─── Ask AI about document ──────────────────────────────────────────
  const handleAskAI = useCallback(() => {
    if (!result || !uploadedFile) return
    // Open the chat with document context
    setChatOpen(true)
  }, [result, uploadedFile, setChatOpen])

  // ─── Reset ──────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setState('idle')
    setProgress(0)
    setUploadedFile(null)
    setResult(null)
    setError(null)
    setExpandedSection('type')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // ─── Get document type display ──────────────────────────────────────
  const getDocTypeDisplay = (type: string) => {
    const map: Record<string, { key: string; icon: React.ElementType }> = {
      electricity_bill: { key: 'docTypeElectricityBill', icon: Zap },
      water_application: { key: 'docTypeWaterApplication', icon: Droplets },
      housing_permit: { key: 'docTypeHousingPermit', icon: Home },
      identity: { key: 'docTypeIdentity', icon: FileText },
      contract: { key: 'docTypeContract', icon: FileText },
    }
    const entry = map[type] || { key: 'docTypeGeneral', icon: File }
    return { label: t(entry.key as Parameters<typeof t>[0]), Icon: entry.icon }
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className={`space-y-6 ${isRTL ? 'rtl font-arabic' : ''}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <AnimatePresence mode="wait">
        {state === 'idle' && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            {/* Drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
                isDragging
                  ? 'border-brand-500 bg-brand-50/50 scale-[1.02] shadow-lg shadow-brand-100'
                  : 'border-brand-200 bg-gradient-to-b from-white to-brand-50/30 hover:border-brand-400 hover:bg-brand-50/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Animated upload icon */}
              <motion.div
                animate={isDragging ? { scale: 1.1, y: -5 } : { scale: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="mx-auto mb-4"
              >
                <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center transition-colors ${
                  isDragging ? 'bg-brand-100' : 'bg-brand-50'
                }`}>
                  <Upload className={`w-8 h-8 transition-colors ${isDragging ? 'text-brand-600' : 'text-brand-400'}`} />
                </div>
              </motion.div>

              <p className="text-sm font-semibold text-base-900 mb-1">
                {isDragging ? t('docDropZoneActive') : t('docDropZone')}
              </p>
              <p className="text-xs text-muted-foreground">{t('docSupportedFormats')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('docFileSizeLimit')}</p>

              {/* Supported file type icons */}
              <div className="flex items-center justify-center gap-3 mt-4">
                {[
                  { icon: FileText, label: 'PDF', color: 'text-red-500 bg-red-50' },
                  { icon: ImageIcon, label: 'Image', color: 'text-purple-500 bg-purple-50' },
                  { icon: File, label: 'Text', color: 'text-blue-500 bg-blue-50' },
                ].map((ft) => (
                  <div key={ft.label} className="flex flex-col items-center gap-1">
                    <div className={`w-9 h-9 rounded-lg ${ft.color} flex items-center justify-center`}>
                      <ft.icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{ft.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {(state === 'uploading' || state === 'analyzing') && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* File info card */}
            {uploadedFile && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${getFileTypeColor(uploadedFile.type)} flex items-center justify-center`}>
                      {(() => { const FIcon = getFileIcon(uploadedFile.type); return <FIcon className="w-5 h-5" /> })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-base-900 truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.size)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                      <span className="text-xs text-brand-600 font-medium">
                        {state === 'uploading' ? t('docUploading') : t('docProgress')}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{t('docAnalyzing')}</span>
                <span className="text-xs font-bold text-brand-600">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Animated analysis steps */}
            <div className="space-y-2">
              {[
                { label: t('docDocumentType'), done: progress > 25 },
                { label: t('docKeyData'), done: progress > 50 },
                { label: t('docRecommendations'), done: progress > 75 },
                { label: t('docSummary'), done: progress > 90 },
              ].map((step, i) => (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2"
                >
                  {step.done ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border-2 border-base-200" />
                  )}
                  <span className={`text-xs ${step.done ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}`}>
                    {step.label}
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {state === 'complete' && result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Success header */}
            <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-800">{t('docAnalysisComplete')}</p>
                {uploadedFile && <p className="text-xs text-emerald-600">{uploadedFile.name}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-emerald-700 hover:bg-emerald-100"
                onClick={handleReset}
              >
                {t('docUploadAnother')}
              </Button>
            </div>

            {/* Document Type */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'type' ? null : 'type')}
                className="w-full p-4 flex items-center justify-between hover:bg-base-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                    {(() => {
                      const { Icon } = getDocTypeDisplay(result.documentType)
                      return <Icon className="w-4 h-4 text-brand-600" />
                    })()}
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{t('docDocumentType')}</p>
                    <p className="text-sm font-semibold text-base-900">{getDocTypeDisplay(result.documentType).label}</p>
                  </div>
                </div>
                {expandedSection === 'type' ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'type' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <Badge className="bg-brand-50 text-brand-700 border-brand-200">{result.documentType.replace(/_/g, ' ')}</Badge>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Key Data */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'data' ? null : 'data')}
                className="w-full p-4 flex items-center justify-between hover:bg-base-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{t('docKeyData')}</p>
                    <p className="text-sm font-semibold text-base-900">{Object.keys(result.keyData).length} {t('docKeyData').toLowerCase()}</p>
                  </div>
                </div>
                {expandedSection === 'data' ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'data' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {Object.entries(result.keyData).map(([key, value]) => (
                        <div key={key} className="flex items-start gap-2 p-2 bg-base-50 rounded-lg">
                          <span className="text-xs font-medium text-brand-700 min-w-[100px]">{key}</span>
                          <span className="text-xs text-base-900 flex-1">{value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Recommendations */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'recs' ? null : 'recs')}
                className="w-full p-4 flex items-center justify-between hover:bg-base-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-uae-green-50 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-uae-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{t('docRecommendations')}</p>
                    <p className="text-sm font-semibold text-base-900">{result.recommendations.length} {t('docRecommendations').toLowerCase()}</p>
                  </div>
                </div>
                {expandedSection === 'recs' ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'recs' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {result.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-2 p-2 bg-uae-green-50 rounded-lg">
                          <span className="w-5 h-5 rounded-full bg-uae-green-100 text-uae-green-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                          <span className="text-xs text-uae-green-800">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Summary */}
            <Card className="border-0 shadow-sm overflow-hidden">
              <button
                onClick={() => setExpandedSection(expandedSection === 'summary' ? null : 'summary')}
                className="w-full p-4 flex items-center justify-between hover:bg-base-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-muted-foreground">{t('docSummary')}</p>
                    <p className="text-sm font-semibold text-base-900 line-clamp-1">{result.summary.slice(0, 60)}...</p>
                  </div>
                </div>
                {expandedSection === 'summary' ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {expandedSection === 'summary' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4">
                      <p className="text-sm text-base-800 leading-relaxed">{result.summary}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Ask AI button */}
            <Button
              className="w-full bg-brand-600 hover:bg-brand-700 text-white h-11 gap-2"
              onClick={handleAskAI}
            >
              <MessageSquare className="w-4 h-4" />
              {t('docAskAI')}
            </Button>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3 p-4 bg-red-50 rounded-xl border border-red-200">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800">{t('docAnalysisFailed')}</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-red-700 hover:bg-red-100"
                onClick={handleReset}
              >
                {t('retry')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
