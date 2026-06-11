
import { useState, useCallback, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { authFetch } from '@/lib/utils'
import { t } from '@/lib/i18n'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from '@/hooks/use-toast'
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, CheckCircle,
  AlertTriangle, XCircle, Database, RefreshCw, Trash2,
  Download, ChevronRight, FileText, Table2, MapPin, Shield,
  Loader2, AlertCircle, History, Info
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────

type ImportStep = 'upload' | 'preview' | 'mapping' | 'validation' | 'import'

interface PreviewData {
  headers: string[]
  rows: string[][]
  totalRows: number
  types: string[]
  fileName: string
}

interface TableSchema {
  table: string
  columns: Array<{
    name: string
    type: string
    required: boolean
    label: string
  }>
}

interface ImportError {
  row: number
  column: string
  message: string
}

interface ImportResult {
  imported: number
  errors: ImportError[]
  skipped: number
  totalProcessed: number
}

interface ImportHistoryEntry {
  id: string
  fileName: string
  targetTable: string
  imported: number
  skipped: number
  errors: number
  timestamp: string
}

// ── Constants ──────────────────────────────────────────────────────

const TARGET_TABLES = [
  { value: 'Applicant', en: 'Applicant', ar: 'مقدم الطلب' },
  { value: 'HousingLoan', en: 'Housing Loan', ar: 'القرض الإسكاني' },
  { value: 'Arrear', en: 'Arrear', ar: 'المتأخرات' },
  { value: 'ReschedulingRequest', en: 'Rescheduling Request', ar: 'طلب إعادة الجدولة' },
]

const STEP_CONFIG: Array<{ id: ImportStep; en: string; ar: string; icon: React.ElementType }> = [
  { id: 'upload', en: 'Upload', ar: 'رفع الملف', icon: Upload },
  { id: 'preview', en: 'Preview', ar: 'معاينة', icon: Table2 },
  { id: 'mapping', en: 'Mapping', ar: 'تعيين الأعمدة', icon: MapPin },
  { id: 'validation', en: 'Validation', ar: 'التحقق', icon: Shield },
  { id: 'import', en: 'Import', ar: 'استيراد', icon: Database },
]

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-100 text-blue-700 border-blue-200',
  number: 'bg-green-100 text-green-700 border-green-200',
  date: 'bg-purple-100 text-purple-700 border-purple-200',
}

const TYPE_LABELS: Record<string, { en: string; ar: string }> = {
  string: { en: 'Text', ar: 'نص' },
  number: { en: 'Number', ar: 'رقم' },
  date: { en: 'Date', ar: 'تاريخ' },
}

// ── Component ──────────────────────────────────────────────────────

export function DataImport() {
  const { language } = useAppStore()
  const isAr = language === 'ar'
  const fileInputRef = useRef<HTMLInputElement>(null)

  // State
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [targetTable, setTargetTable] = useState<string>('Applicant')
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [allRows, setAllRows] = useState<string[][]>([])
  const [tableSchema, setTableSchema] = useState<TableSchema | null>(null)
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importHistory, setImportHistory] = useState<ImportHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [validationErrors, setValidationErrors] = useState<ImportError[]>([])
  const [validationWarnings, setValidationWarnings] = useState<string[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const stepIndex = STEP_CONFIG.findIndex(s => s.id === currentStep)

  // ── Step Navigation ──

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case 'upload': return !!selectedFile && !!targetTable
      case 'preview': return !!previewData
      case 'mapping': return Object.values(columnMapping).some(v => v && v !== 'skip')
      case 'validation': return true
      default: return false
    }
  }

  const goNext = () => {
    const idx = stepIndex
    if (idx < STEP_CONFIG.length - 1) {
      setCurrentStep(STEP_CONFIG[idx + 1].id)
    }
  }

  const goBack = () => {
    const idx = stepIndex
    if (idx > 0) {
      setCurrentStep(STEP_CONFIG[idx - 1].id)
    }
  }

  // ── File Upload Handler ──

  const handleFileSelect = async (file: File) => {
    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx')) {
      toast({
        title: isAr ? 'صيغة ملف غير مدعومة' : 'Unsupported file format',
        description: isAr ? 'يرجى رفع ملف CSV أو XLSX' : 'Please upload a .csv or .xlsx file',
        variant: 'destructive',
      })
      return
    }

    setSelectedFile(file)
    setPreviewData(null)
    setAllRows([])
    setColumnMapping({})
    setImportResult(null)
    setValidationErrors([])
    setValidationWarnings([])

    // Parse file using papaparse on client side for full data
    try {
      const text = await file.text()
      const Papa = (await import('papaparse')).default
      const result = Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        dynamicTyping: false,
      })

      const allData = result.data as string[][]
      if (allData.length < 2) {
        toast({
          title: isAr ? 'الملف فارغ' : 'File is empty',
          description: isAr ? 'لا توجد بيانات في الملف' : 'No data rows found in the file',
          variant: 'destructive',
        })
        return
      }

      const headers = allData[0].map((h: string) => (h || '').trim())
      const dataRows = allData.slice(1)
      const previewRows = dataRows.slice(0, 5)
      const totalRows = dataRows.length

      // Detect types
      const types: string[] = headers.map((_: string, colIdx: number) => {
        const sampleValues = previewRows.map(row => row[colIdx]).filter(v => v !== undefined && v !== '')
        if (sampleValues.length === 0) return 'string'
        const numCount = sampleValues.filter(v => !isNaN(Number(v)) && v.trim() !== '').length
        if (numCount === sampleValues.length) return 'number'
        const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/
        const dateCount = sampleValues.filter(v => datePattern.test(v.trim())).length
        if (dateCount > sampleValues.length * 0.5) return 'date'
        return 'string'
      })

      setPreviewData({ headers, rows: previewRows, totalRows, types, fileName: file.name })
      setAllRows(dataRows)

      // Auto-map columns by name match
      const autoMapping: Record<string, string> = {}
      const schema = await fetchSchema(targetTable)
      if (schema) {
        headers.forEach((header, idx) => {
          const headerLower = header.toLowerCase().replace(/[_\s-]/g, '')
          const match = schema.columns.find(col =>
            col.name.toLowerCase().replace(/[_\s-]/g, '') === headerLower ||
            col.label.toLowerCase().replace(/[_\s-]/g, '') === headerLower
          )
          autoMapping[idx] = match ? match.name : 'skip'
        })
        setColumnMapping(autoMapping)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: isAr ? 'فشل تحليل الملف' : 'Failed to parse file',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  // ── Fetch Schema ──

  const fetchSchema = useCallback(async (table: string): Promise<TableSchema | null> => {
    try {
      const res = await authFetch(`/api/import/schema/${table}`)
      if (res.ok) {
        const data = (await res.json()) as TableSchema
        setTableSchema(data)
        return data
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err)
    }
    return null
  }, [])

  // ── Handle table change ──

  const handleTableChange = async (table: string) => {
    setTargetTable(table)
    await fetchSchema(table)

    // Re-auto-map columns if we have preview data
    if (previewData && tableSchema) {
      const autoMapping: Record<string, string> = {}
      previewData.headers.forEach((header, idx) => {
        const headerLower = header.toLowerCase().replace(/[_\s-]/g, '')
        const match = tableSchema.columns.find(col =>
          col.name.toLowerCase().replace(/[_\s-]/g, '') === headerLower ||
          col.label.toLowerCase().replace(/[_\s-]/g, '') === headerLower
        )
        autoMapping[idx] = match ? match.name : 'skip'
      })
      setColumnMapping(autoMapping)
    }
  }

  // ── Validate Data ──

  const validateData = (): boolean => {
    if (!previewData || !tableSchema) return false

    const errors: ImportError[] = []
    const warnings: string[] = []
    const requiredCols = tableSchema.columns.filter(c => c.required).map(c => c.name)
    const mappedCols = Object.values(columnMapping).filter(v => v && v !== 'skip')

    // Check required columns are mapped
    for (const reqCol of requiredCols) {
      if (!mappedCols.includes(reqCol)) {
        errors.push({
          row: 0,
          column: reqCol,
          message: isAr ? `العمود المطلوب "${reqCol}" غير معين` : `Required column "${reqCol}" is not mapped`,
        })
      }
    }

    // Validate sample rows
    const sampleSize = Math.min(allRows.length, 20)
    for (let i = 0; i < sampleSize; i++) {
      const row = allRows[i]
      for (const [colIdx, dbCol] of Object.entries(columnMapping)) {
        if (dbCol === 'skip' || !dbCol) continue
        const colSchema = tableSchema.columns.find(c => c.name === dbCol)
        const value = row[parseInt(colIdx)]

        if ((!value || String(value).trim() === '') && colSchema?.required) {
          errors.push({
            row: i + 1,
            column: dbCol,
            message: isAr ? `السطر ${i + 1}: الحقل المطلوب "${dbCol}" فارغ` : `Row ${i + 1}: Required field "${dbCol}" is empty`,
          })
        } else if (value && colSchema?.type === 'number') {
          const num = Number(String(value).replace(/,/g, ''))
          if (isNaN(num)) {
            errors.push({
              row: i + 1,
              column: dbCol,
              message: isAr ? `السطر ${i + 1}: القيمة "${value}" ليست رقماً صالحاً` : `Row ${i + 1}: "${value}" is not a valid number`,
            })
          }
        }
      }
    }

    if (allRows.length > 500) {
      warnings.push(isAr ? `مجموعة بيانات كبيرة (${allRows.length} صف). قد يستغرق الاستيراد بعض الوقت.` : `Large dataset (${allRows.length} rows). Import may take a while.`)
    }

    const unmappedCols = previewData.headers.filter((_, idx) => !columnMapping[idx] || columnMapping[idx] === 'skip')
    if (unmappedCols.length > 0) {
      warnings.push(isAr ? `${unmappedCols.length} عمود غير معين وسيتم تجاهله` : `${unmappedCols.length} column(s) are unmapped and will be skipped`)
    }

    setValidationErrors(errors)
    setValidationWarnings(warnings)

    return errors.filter(e => e.row > 0).length === 0 || errors.filter(e => e.row === 0).length === 0
  }

  // ── Execute Import ──

  const executeImport = async () => {
    if (!previewData || !tableSchema) return

    setLoading(true)
    setUploadProgress(0)

    try {
      // Simulate progress during import
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 5, 90))
      }, 200)

      const res = await authFetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: previewData.headers,
          rows: allRows,
          targetTable,
          columnMapping,
          importOptions: { skipDuplicates },
        }),
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (res.ok) {
        const result: ImportResult = await res.json()
        setImportResult(result)

        // Add to history
        const historyEntry: ImportHistoryEntry = {
          id: Date.now().toString(),
          fileName: previewData.fileName,
          targetTable,
          imported: result.imported,
          skipped: result.skipped,
          errors: result.errors.length,
          timestamp: new Date().toISOString(),
        }
        setImportHistory(prev => [historyEntry, ...prev].slice(0, 20))

        toast({
          title: isAr ? 'تم الاستيراد بنجاح' : 'Import completed',
          description: isAr
            ? `تم استيراد ${result.imported} سجل، تم تخطي ${result.skipped}`
            : `Imported ${result.imported} records, skipped ${result.skipped}`,
        })
      } else {
        const errData = await res.json() as Record<string, string>
        toast({
          title: isAr ? 'فشل الاستيراد' : 'Import failed',
          description: errData.error || errData.message || (isAr ? 'حدث خطأ أثناء الاستيراد' : 'An error occurred during import'),
          variant: 'destructive',
        })
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      toast({
        title: isAr ? 'خطأ في الشبكة' : 'Network error',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Handle step transition with validation ──

  const handleNext = async () => {
    if (currentStep === 'upload' && selectedFile) {
      // Already parsed in handleFileSelect, just advance
      await fetchSchema(targetTable)
      goNext()
    } else if (currentStep === 'mapping') {
      // Run validation before moving to validation step
      validateData()
      goNext()
    } else if (currentStep === 'validation') {
      // Execute import
      goNext()
      await executeImport()
    } else {
      goNext()
    }
  }

  // ── Reset ──

  const resetImport = () => {
    setCurrentStep('upload')
    setSelectedFile(null)
    setPreviewData(null)
    setAllRows([])
    setColumnMapping({})
    setImportResult(null)
    setValidationErrors([])
    setValidationWarnings([])
    setUploadProgress(0)
  }

  // ── Render Helpers ──

  const getTableLabel = (table: string) => {
    const t = TARGET_TABLES.find(tt => tt.value === table)
    return t ? (isAr ? t.ar : t.en) : table
  }

  // ── Step Indicator ──

  const renderStepIndicator = () => (
    <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
      {STEP_CONFIG.map((step, idx) => {
        const StepIcon = step.icon
        const isActive = step.id === currentStep
        const isCompleted = idx < stepIndex
        return (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => { if (isCompleted || idx <= stepIndex) setCurrentStep(step.id) }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#B68A35]/10 text-[#B68A35] border border-[#B68A35]/30'
                  : isCompleted
                    ? 'bg-green-50 text-green-600 border border-green-200'
                    : 'bg-gray-50 text-gray-400 border border-gray-100'
              }`}
            >
              <StepIcon className="w-4 h-4" />
              <span className="hidden sm:inline">{isAr ? step.ar : step.en}</span>
              {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
            </button>
            {idx < STEP_CONFIG.length - 1 && (
              <ChevronRight className={`w-4 h-4 shrink-0 ${idx < stepIndex ? 'text-green-400' : 'text-gray-300'} ${isAr ? 'rotate-180' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Step: Upload ──

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* Target Table Selector */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          {isAr ? 'الجدول المستهدف' : 'Target Table'}
        </label>
        <Select value={targetTable} onValueChange={handleTableChange}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder={isAr ? 'اختر الجدول' : 'Select table'} />
          </SelectTrigger>
          <SelectContent>
            {TARGET_TABLES.map(table => (
              <SelectItem key={table.value} value={table.value}>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-[#B68A35]" />
                  {isAr ? table.ar : table.en}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFileSelect(file)
        }}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? 'border-[#B68A35] bg-[#B68A35]/5 scale-[1.01]'
            : selectedFile
              ? 'border-green-300 bg-green-50/50'
              : 'border-gray-300 hover:border-[#B68A35]/50 hover:bg-gray-50'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileSelect(file)
          }}
        />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {selectedFile ? (
            <>
              <FileSpreadsheet className="w-12 h-12 mx-auto text-green-500" />
              <div className="text-lg font-medium text-green-700">{selectedFile.name}</div>
              <div className="text-sm text-green-600">
                {(selectedFile.size / 1024).toFixed(1)} KB
                {previewData && ` • ${previewData.totalRows} ${isAr ? 'صف' : 'rows'}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedFile(null)
                  setPreviewData(null)
                  setAllRows([])
                }}
              >
                <Trash2 className="w-3.5 h-3.5 me-1" />
                {isAr ? 'إزالة' : 'Remove'}
              </Button>
            </>
          ) : (
            <>
              <Upload className="w-12 h-12 mx-auto text-gray-400" />
              <div className="text-lg font-medium text-gray-600">
                {isAr ? 'اسحب الملف هنا أو انقر للرفع' : 'Drag & drop your file here or click to browse'}
              </div>
              <div className="text-sm text-gray-400">
                {isAr ? 'CSV أو XLSX' : 'Supports .csv and .xlsx files'}
              </div>
              <Button variant="outline" className="mt-2 border-[#B68A35]/30 text-[#B68A35] hover:bg-[#B68A35]/10">
                {isAr ? 'اختيار ملف' : 'Choose File'}
              </Button>
            </>
          )}
        </motion.div>
      </div>

      {/* Schema Preview */}
      {tableSchema && (
        <Card className="border-[#B68A35]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-[#B68A35] flex items-center gap-2">
              <Info className="w-4 h-4" />
              {isAr ? `أعمدة جدول ${getTableLabel(targetTable)}` : `${getTableLabel(targetTable)} Table Columns`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tableSchema.columns.map(col => (
                <Badge
                  key={col.name}
                  variant="outline"
                  className={`text-xs ${col.required ? 'border-[#B68A35]/40 text-[#B68A35]' : 'border-gray-200 text-gray-500'}`}
                >
                  {col.label}
                  {col.required && <span className="ms-1 text-red-400">*</span>}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  // ── Step: Preview ──

  const renderPreviewStep = () => {
    if (!previewData) return null

    return (
      <div className="space-y-4">
        {/* File Info */}
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="border-[#B68A35]/30 text-[#B68A35]">
            <FileText className="w-3.5 h-3.5 me-1" />
            {previewData.fileName}
          </Badge>
          <Badge variant="outline" className="border-green-300 text-green-600">
            {previewData.totalRows} {isAr ? 'صف' : 'rows'}
          </Badge>
          <Badge variant="outline" className="border-blue-300 text-blue-600">
            {previewData.headers.length} {isAr ? 'عمود' : 'columns'}
          </Badge>
        </div>

        {/* Data Table Preview */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-96">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="px-3 py-2 text-start text-xs font-medium text-gray-500 w-10">#</th>
                      {previewData.headers.map((header, idx) => (
                        <th key={idx} className="px-3 py-2 text-start">
                          <div className="text-xs font-medium text-gray-700">{header}</div>
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1 mt-1 ${TYPE_COLORS[previewData.types[idx]] || ''}`}
                          >
                            {TYPE_LABELS[previewData.types[idx]] ? (isAr ? TYPE_LABELS[previewData.types[idx]].ar : TYPE_LABELS[previewData.types[idx]].en) : previewData.types[idx]}
                          </Badge>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-xs text-gray-400">{rowIdx + 1}</td>
                        {previewData.headers.map((_, colIdx) => (
                          <td key={colIdx} className="px-3 py-2 text-xs text-gray-600 max-w-[200px] truncate">
                            {row[colIdx] || <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="text-xs text-gray-400 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" />
          {isAr
            ? `عرض أول 5 صفوف من ${previewData.totalRows} صف`
            : `Showing first 5 of ${previewData.totalRows} rows`}
        </div>
      </div>
    )
  }

  // ── Step: Column Mapping ──

  const renderMappingStep = () => {
    if (!previewData || !tableSchema) return null

    const dbColumns = tableSchema.columns

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isAr
              ? 'عيّن كل عمود من الملف إلى الحقل المناسب في قاعدة البيانات'
              : 'Map each file column to the corresponding database field'}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => {
              // Auto-map by name matching
              const autoMapping: Record<string, string> = {}
              previewData.headers.forEach((header, idx) => {
                const headerLower = header.toLowerCase().replace(/[_\s-]/g, '')
                const match = dbColumns.find(col =>
                  col.name.toLowerCase().replace(/[_\s-]/g, '') === headerLower ||
                  col.label.toLowerCase().replace(/[_\s-]/g, '') === headerLower
                )
                autoMapping[idx] = match ? match.name : 'skip'
              })
              setColumnMapping(autoMapping)
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 me-1" />
            {isAr ? 'تعيين تلقائي' : 'Auto-map'}
          </Button>
        </div>

        {/* Mapping Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-[#B68A35]/5">
                    <th className="px-4 py-3 text-start text-xs font-medium text-[#B68A35]">
                      {isAr ? 'عمود الملف' : 'File Column'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-[#B68A35]">
                      {isAr ? 'النوع' : 'Type'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-[#B68A35] w-8">
                      →
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-[#B68A35]">
                      {isAr ? 'حقل قاعدة البيانات' : 'Database Field'}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-[#B68A35]">
                      {isAr ? 'معاينة' : 'Sample'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.headers.map((header, idx) => {
                    const mappedValue = columnMapping[idx] || 'skip'
                    const isMapped = mappedValue !== 'skip' && mappedValue
                    const sampleValues = previewData.rows.map(r => r[idx]).filter(Boolean).slice(0, 2)
                    const colSchema = dbColumns.find(c => c.name === mappedValue)

                    return (
                      <tr key={idx} className={`border-b border-gray-50 ${isMapped ? '' : 'bg-red-50/30'}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-700">{header}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={`text-[9px] h-4 px-1 ${TYPE_COLORS[previewData.types[idx]] || ''}`}
                          >
                            {TYPE_LABELS[previewData.types[idx]] ? (isAr ? TYPE_LABELS[previewData.types[idx]].ar : TYPE_LABELS[previewData.types[idx]].en) : previewData.types[idx]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-300">→</td>
                        <td className="px-4 py-3">
                          <Select
                            value={mappedValue}
                            onValueChange={(val) => {
                              setColumnMapping(prev => ({ ...prev, [idx]: val }))
                            }}
                          >
                            <SelectTrigger className="w-full min-w-[180px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">
                                <span className="text-gray-400">{isAr ? '— تخطي —' : '— Skip —'}</span>
                              </SelectItem>
                              {dbColumns.map(col => (
                                <SelectItem key={col.name} value={col.name}>
                                  <div className="flex items-center gap-2">
                                    <span>{col.label}</span>
                                    <Badge variant="outline" className="text-[8px] h-3 px-1">
                                      {col.type}
                                    </Badge>
                                    {col.required && <span className="text-red-400 text-[8px]">*</span>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400 max-w-[150px] truncate">
                          {sampleValues.join(', ') || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Options */}
        <div className="flex items-center gap-3">
          <Checkbox
            id="skipDuplicates"
            checked={skipDuplicates}
            onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
          />
          <label htmlFor="skipDuplicates" className="text-sm text-gray-600 cursor-pointer">
            {isAr ? 'تخطي السجلات المكررة' : 'Skip duplicate records'}
          </label>
        </div>

        {/* Mapping Summary */}
        <div className="flex items-center gap-4 text-sm">
          <span className="text-green-600">
            ✓ {Object.values(columnMapping).filter(v => v && v !== 'skip').length} {isAr ? 'معين' : 'mapped'}
          </span>
          <span className="text-gray-400">
            {Object.values(columnMapping).filter(v => !v || v === 'skip').length} {isAr ? 'متخطى' : 'skipped'}
          </span>
        </div>
      </div>
    )
  }

  // ── Step: Validation ──

  const renderValidationStep = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-700">{allRows.length - validationErrors.filter(e => e.row > 0).length}</div>
              <div className="text-xs text-green-600">{isAr ? 'صفوف صالحة' : 'Valid rows'}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="w-8 h-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold text-red-700">{validationErrors.length}</div>
              <div className="text-xs text-red-600">{isAr ? 'أخطاء' : 'Errors'}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <div>
              <div className="text-2xl font-bold text-amber-700">{validationWarnings.length}</div>
              <div className="text-xs text-amber-600">{isAr ? 'تحذيرات' : 'Warnings'}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Config Summary */}
      <Card className="border-[#B68A35]/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-[#B68A35]">
            {isAr ? 'ملخص الاستيراد' : 'Import Summary'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{isAr ? 'الجدول' : 'Target Table'}</span>
            <span className="font-medium">{getTableLabel(targetTable)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{isAr ? 'الملف' : 'Source File'}</span>
            <span className="font-medium">{previewData?.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{isAr ? 'إجمالي الصفوف' : 'Total Rows'}</span>
            <span className="font-medium">{allRows.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{isAr ? 'الأعمدة المعينة' : 'Mapped Columns'}</span>
            <span className="font-medium">{Object.values(columnMapping).filter(v => v && v !== 'skip').length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{isAr ? 'تخطي المكررات' : 'Skip Duplicates'}</span>
            <span className="font-medium">{skipDuplicates ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {validationWarnings.length > 0 && (
        <div className="space-y-2">
          {validationWarnings.map((warning, idx) => (
            <div key={idx} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span className="text-amber-700">{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {validationErrors.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-red-600 mb-2">
            {isAr ? 'أخطاء التحقق' : 'Validation Errors'} ({validationErrors.length})
          </h4>
          <ScrollArea className="max-h-48">
            <div className="space-y-1">
              {validationErrors.slice(0, 50).map((error, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 bg-red-50 border border-red-100 rounded text-xs">
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-red-600">
                    {error.row > 0 && <span className="font-medium">{isAr ? `سطر ${error.row}:` : `Row ${error.row}:`}</span>}
                    {' '}{error.message}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {validationErrors.filter(e => e.row > 0).length > 0 && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <span className="text-blue-700">
            {isAr
              ? 'سيتم تخطي الصفوف التي بها أخطاء أثناء الاستيراد. سيتم استيراد الصفوف الصالحة فقط.'
              : 'Rows with errors will be skipped during import. Only valid rows will be imported.'}
          </span>
        </div>
      )}
    </div>
  )

  // ── Step: Import ──

  const renderImportStep = () => (
    <div className="space-y-6">
      {loading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12"
        >
          <Loader2 className="w-12 h-12 mx-auto text-[#B68A35] animate-spin mb-4" />
          <h3 className="text-lg font-medium text-gray-700">
            {isAr ? 'جارٍ الاستيراد...' : 'Importing data...'}
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            {isAr ? 'يرجى عدم إغلاق الصفحة' : 'Please do not close this page'}
          </p>
          <div className="max-w-md mx-auto mt-6">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-gray-400 mt-2">{uploadProgress}%</p>
          </div>
        </motion.div>
      ) : importResult ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Result Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-12 h-12 mx-auto text-green-500 mb-3" />
                <div className="text-3xl font-bold text-green-700">{importResult.imported}</div>
                <div className="text-sm text-green-600">{isAr ? 'تم الاستيراد' : 'Imported'}</div>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <div className="text-3xl font-bold text-amber-700">{importResult.skipped}</div>
                <div className="text-sm text-amber-600">{isAr ? 'تم التخطي' : 'Skipped'}</div>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/50">
              <CardContent className="p-6 text-center">
                <XCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
                <div className="text-3xl font-bold text-red-700">{importResult.errors.length}</div>
                <div className="text-sm text-red-600">{isAr ? 'أخطاء' : 'Errors'}</div>
              </CardContent>
            </Card>
          </div>

          {/* Error Details */}
          {importResult.errors.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-red-600">
                  {isAr ? 'تفاصيل الأخطاء' : 'Error Details'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {importResult.errors.slice(0, 50).map((error, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 border-b border-red-50 text-xs">
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span className="text-red-600">
                          <span className="font-medium">{isAr ? `سطر ${error.row}` : `Row ${error.row}`}</span>
                          {' — '}{error.column}: {error.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-center">
            <Button onClick={resetImport} className="bg-[#B68A35] hover:bg-[#9A7429] text-white gap-2">
              <Upload className="w-4 h-4" />
              {isAr ? 'استيراد ملف آخر' : 'Import Another File'}
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Database className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>{isAr ? 'جاهز للاستيراد' : 'Ready to import'}</p>
        </div>
      )}
    </div>
  )

  // ── Import History ──

  const renderHistory = () => (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
          <History className="w-4 h-4" />
          {isAr ? 'سجل الاستيراد' : 'Import History'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {importHistory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            {isAr ? 'لا يوجد سجل استيراد بعد' : 'No import history yet'}
          </p>
        ) : (
          <ScrollArea className="max-h-48">
            <div className="space-y-2">
              {importHistory.map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-[#B68A35] shrink-0" />
                    <span className="truncate">{entry.fileName}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{getTableLabel(entry.targetTable)}</Badge>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-green-600">✓{entry.imported}</span>
                    {entry.skipped > 0 && <span className="text-amber-600">⚠{entry.skipped}</span>}
                    {entry.errors > 0 && <span className="text-red-600">✗{entry.errors}</span>}
                    <span className="text-gray-400">
                      {new Date(entry.timestamp).toLocaleTimeString(isAr ? 'ar-AE' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )

  // ── Main Render ──

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ae-black-700">
            {isAr ? 'استيراد البيانات' : 'Data Import'}
          </h2>
          <p className="text-sm text-ae-black-400">
            {isAr ? 'استيراد البيانات من ملفات CSV إلى قاعدة البيانات' : 'Import structured data from CSV files into the system database'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-1 text-xs"
          >
            <History className="w-3.5 h-3.5" />
            {isAr ? 'السجل' : 'History'}
          </Button>
          {currentStep !== 'upload' && (
            <Button variant="outline" size="sm" onClick={resetImport} className="gap-1 text-xs">
              <RefreshCw className="w-3.5 h-3.5" />
              {isAr ? 'إعادة تعيين' : 'Reset'}
            </Button>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Main Content Card */}
      <Card className="border-[#B68A35]/10">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {currentStep === 'upload' && (
              <motion.div key="upload" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {renderUploadStep()}
              </motion.div>
            )}
            {currentStep === 'preview' && (
              <motion.div key="preview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {renderPreviewStep()}
              </motion.div>
            )}
            {currentStep === 'mapping' && (
              <motion.div key="mapping" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {renderMappingStep()}
              </motion.div>
            )}
            {currentStep === 'validation' && (
              <motion.div key="validation" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {renderValidationStep()}
              </motion.div>
            )}
            {currentStep === 'import' && (
              <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {renderImportStep()}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      {currentStep !== 'import' && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="gap-2"
          >
            <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
            {isAr ? 'السابق' : 'Previous'}
          </Button>

          <div className="text-sm text-gray-400">
            {isAr ? `الخطوة ${stepIndex + 1} من ${STEP_CONFIG.length}` : `Step ${stepIndex + 1} of ${STEP_CONFIG.length}`}
          </div>

          <Button
            onClick={handleNext}
            disabled={!canGoNext() || loading}
            className="bg-[#B68A35] hover:bg-[#9A7429] text-white gap-2"
          >
            {currentStep === 'validation'
              ? (isAr ? 'بدء الاستيراد' : 'Start Import')
              : (isAr ? 'التالي' : 'Next')}
            <ArrowRight className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      )}

      {/* Import History */}
      {showHistory && renderHistory()}
    </motion.div>
  )
}
