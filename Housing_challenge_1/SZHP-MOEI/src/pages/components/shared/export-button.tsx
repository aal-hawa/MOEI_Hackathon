
import * as React from 'react'
import { DownloadIcon, FileTextIcon, FileSpreadsheetIcon, FileIcon } from 'lucide-react'
import { format } from 'date-fns'

import { t, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ─── MOEI Gold Color Constants ──────────────────────────────────────────
const MOEI_GOLD = '#B68A35'

// ─── Types ──────────────────────────────────────────────────────────────
export interface ExportColumn {
  key: string
  label: string
  labelAr?: string
}

export interface ExportButtonProps {
  data: Record<string, unknown>[]
  columns: ExportColumn[]
  filename: string
  language?: Language
  className?: string
  compact?: boolean
  disabled?: boolean
}

// ─── CSV Export ─────────────────────────────────────────────────────────
function exportToCSV(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  language: Language
): void {
  const header = columns.map((col) => (language === 'ar' && col.labelAr) ? col.labelAr : col.label)

  const escapeCSV = (val: unknown): string => {
    const str = val === null || val === undefined ? '' : String(val)
    // If the string contains comma, newline, or double quote, wrap in quotes
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows = data.map((row) =>
    columns.map((col) => escapeCSV(row[col.key])).join(',')
  )

  // Add BOM for Arabic/UTF-8 support
  const BOM = '\uFEFF'
  const csvContent = BOM + [header.join(','), ...rows].join('\n')

  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

// ─── Excel Export (XML Spreadsheet) ────────────────────────────────────
function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  language: Language
): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm')

  const escapeXML = (str: string): string =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const getCellValue = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    if (typeof val === 'number') return String(val)
    return escapeXML(String(val))
  }

  const getType = (val: unknown): string => {
    if (typeof val === 'number') return 'Number'
    return 'String'
  }

  const headerRow = columns.map((col) => {
    const label = (language === 'ar' && col.labelAr) ? col.labelAr : col.label
    return `<Cell><Data ss:Type="String">${escapeXML(label)}</Data></Cell>`
  }).join('')

  const dataRows = data.map((row) =>
    '<Row>' +
    columns.map((col) =>
      `<Cell><Data ss:Type="${getType(row[col.key])}">${getCellValue(row[col.key])}</Data></Cell>`
    ).join('') +
    '</Row>'
  ).join('\n')

  const reportTitle = escapeXML(t('export.reportTitle', language, { filename }))
  const generatedLabel = escapeXML(t('export.generatedAt', language, { timestamp }))

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Font ss:FontName="Arial" ss:Size="10" />
      <Alignment ss:Vertical="Bottom" />
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF" />
      <Interior ss:Color="${MOEI_GOLD}" ss:Pattern="Solid" />
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" />
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC" />
      </Borders>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1" ss:Color="${MOEI_GOLD}" />
    </Style>
    <Style ss:ID="Timestamp">
      <Font ss:FontName="Arial" ss:Size="9" ss:Color="#888888" />
    </Style>
  </Styles>
  <Worksheet ss:Name="${escapeXML(filename)}">
    <Table>
      <Column ss:Width="200" />
      <Row>
        <Cell ss:MergeAcross="${Math.max(0, columns.length - 1)}" ss:StyleID="Title">
          <Data ss:Type="String">${reportTitle}</Data>
        </Cell>
      </Row>
      <Row>
        <Cell ss:MergeAcross="${Math.max(0, columns.length - 1)}" ss:StyleID="Timestamp">
          <Data ss:Type="String">${generatedLabel}</Data>
        </Cell>
      </Row>
      <Row />
      <Row ss:StyleID="Header">
        ${headerRow}
      </Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`

  downloadFile(xml, `${filename}.xlsx`, 'application/vnd.ms-excel')
}

// ─── PDF Export (Print-to-PDF) ─────────────────────────────────────────
function exportToPDF(
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
  language: Language
): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm')
  const isRtl = language === 'ar'

  const getCellValue = (val: unknown): string => {
    if (val === null || val === undefined) return ''
    return String(val)
  }

  const headerCells = columns.map((col) => {
    const label = (language === 'ar' && col.labelAr) ? col.labelAr : col.label
    return `<th style="background-color: ${MOEI_GOLD}; color: #fff; padding: 10px 14px; text-align: ${isRtl ? 'right' : 'left'}; font-weight: 600; font-size: 12px; border-bottom: 2px solid #9A7429; white-space: nowrap;">${label}</th>`
  }).join('')

  const dataRows = data.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
    const cells = columns.map((col) =>
      `<td style="padding: 8px 14px; text-align: ${isRtl ? 'right' : 'left'}; font-size: 11px; border-bottom: 1px solid #E5E7EB; background-color: ${bg};">${getCellValue(row[col.key])}</td>`
    ).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const reportTitle = t('export.reportTitle', language, { filename })
  const generatedLabel = t('export.generatedAt', language, { timestamp })
  const ministryLabel = t('landing.header.ministry', language)

  const html = `<!DOCTYPE html>
<html dir="${isRtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    @page { size: landscape; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Arial', 'Segoe UI', Tahoma, sans-serif; color: #1F2937; padding: 20px; }
    .header { margin-bottom: 24px; border-bottom: 3px solid ${MOEI_GOLD}; padding-bottom: 16px; }
    .header h1 { font-size: 20px; font-weight: 700; color: ${MOEI_GOLD}; margin-bottom: 4px; }
    .header .subtitle { font-size: 11px; color: #6B7280; }
    .header .ministry { font-size: 10px; color: #9CA3AF; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: none; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E5E7EB; font-size: 9px; color: #9CA3AF; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${reportTitle}</h1>
    <div class="subtitle">${generatedLabel}</div>
    <div class="ministry">${ministryLabel}</div>
  </div>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${dataRows}</tbody>
  </table>
  <div class="footer">
    SZHP AI Rescheduling Agent &mdash; ${timestamp}
  </div>
</body>
</html>`

  // Open a new window for printing
  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
    // Wait for content to load then trigger print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print()
      }, 300)
    }
  }
}

// ─── File Download Helper ──────────────────────────────────────────────
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ─── Component ──────────────────────────────────────────────────────────
export function ExportButton({
  data,
  columns,
  filename,
  language = 'en',
  className,
  compact = false,
  disabled = false,
}: ExportButtonProps) {
  const isRtl = language === 'ar'
  const hasData = data.length > 0

  return (
    <DropdownMenu dir={isRtl ? 'rtl' : 'ltr'}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled || !hasData}
          className={cn(
            'gap-2',
            compact ? 'h-8 text-xs px-2' : 'h-9 text-sm px-3',
            className
          )}
        >
          <DownloadIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          <span>{t('export.button', language)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isRtl ? 'start' : 'end'} className="w-48">
        <DropdownMenuLabel>{t('export.button', language)}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* PDF Export */}
        <DropdownMenuItem
          onClick={() => exportToPDF(data, columns, filename, language)}
          className="cursor-pointer gap-2"
        >
          <FileTextIcon className="h-4 w-4 text-red-500" />
          <span>{t('export.pdf', language)}</span>
        </DropdownMenuItem>

        {/* Excel Export */}
        <DropdownMenuItem
          onClick={() => exportToExcel(data, columns, filename, language)}
          className="cursor-pointer gap-2"
        >
          <FileSpreadsheetIcon className="h-4 w-4 text-green-600" />
          <span>{t('export.excel', language)}</span>
        </DropdownMenuItem>

        {/* CSV Export */}
        <DropdownMenuItem
          onClick={() => exportToCSV(data, columns, filename, language)}
          className="cursor-pointer gap-2"
        >
          <FileIcon className="h-4 w-4 text-blue-500" />
          <span>{t('export.csv', language)}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default ExportButton
