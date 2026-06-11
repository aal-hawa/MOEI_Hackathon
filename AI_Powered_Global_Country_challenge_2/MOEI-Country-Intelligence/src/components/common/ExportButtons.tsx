'use client';

/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Export Buttons v3
   Premium dropdown with format-specific icons, server-side
   PDF & DOCX generation, and enhanced descriptions.
   ─────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Language } from '@/lib/types';
import { useLanguage } from '@/lib/LanguageContext';
import { exportAsJSON, exportAsHTML, exportForPrint } from '@/lib/exportUtils';
import { exportServerPDF, exportServerDOCX, exportServerZIP } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  FileJson,
  FileDown,
  Printer,
  Loader2,
  ChevronDown,
  Download,
  Globe,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image as ImageIcon,
} from 'lucide-react';

interface ExportButtonsProps {
  data: unknown;
  elementId?: string;
  filenamePrefix: string;
  lang: Language;
  countryIso?: string;
}

interface ExportOption {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  handler: () => void | Promise<void>;
  disabled: boolean;
  badge?: string;
}

export default function ExportButtons({
  data,
  elementId,
  filenamePrefix,
  lang,
  countryIso,
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);

  const { t } = useLanguage();

  const handleJSON = () => {
    setExporting('json');
    try {
      exportAsJSON(data, filenamePrefix);
    } catch {
      // Silently fail
    }
    setTimeout(() => setExporting(null), 600);
  };

  const handleHTML = () => {
    setExporting('html');
    try {
      exportAsHTML(data, filenamePrefix, `MOEI Report - ${filenamePrefix}`, lang);
    } catch {
      // Silently fail
    }
    setTimeout(() => setExporting(null), 600);
  };

  const handleServerPDF = async () => {
    setExporting('pdf');
    try {
      const dataWithLang = { ...(data as Record<string, unknown>), lang };
      await exportServerPDF(dataWithLang, filenamePrefix);
    } catch {
      // Silently fail
    }
    setExporting(null);
  };

  const handleServerDOCX = async () => {
    setExporting('docx');
    try {
      const dataWithLang = { ...(data as Record<string, unknown>), lang };
      await exportServerDOCX(dataWithLang, filenamePrefix);
    } catch {
      // Silently fail
    }
    setExporting(null);
  };

  const handlePrint = () => {
    setExporting('print');
    try {
      exportForPrint(data, `MOEI Report - ${filenamePrefix}`, lang);
    } catch {
      // Fallback
      window.print();
    }
    setTimeout(() => setExporting(null), 800);
  };

  const handleExcel = async () => {
    setExporting('xlsx');
    try {
      if (countryIso) {
        const { exportBackendExcel } = await import('@/lib/api');
        await exportBackendExcel(countryIso);
      }
    } catch {
      // Silently fail
    }
    setTimeout(() => setExporting(null), 600);
  };

  const handlePPTX = async () => {
    setExporting('pptx');
    try {
      if (countryIso) {
        const { exportBackendPPTX } = await import('@/lib/api');
        await exportBackendPPTX(countryIso);
      }
    } catch {
      // Silently fail
    }
    setTimeout(() => setExporting(null), 600);
  };

  const handleInfographic = async () => {
    setExporting('svg');
    try {
      if (countryIso) {
        const { exportBackendInfographic } = await import('@/lib/api');
        await exportBackendInfographic(countryIso);
      }
    } catch {
      // Silently fail
    }
    setTimeout(() => setExporting(null), 600);
  };

  const handleZIP = async () => {
    setExporting('zip');
    try {
      const dataWithLang = { ...(data as Record<string, unknown>), lang };
      await exportServerZIP(dataWithLang, filenamePrefix);
    } catch {
      // Silently fail
    }
    setExporting(null);
  };

  const exportOptions: ExportOption[] = [
    {
      key: 'zip',
      label: 'ZIP',
      description: t('export.zipDesc'),
      icon: <FileDown className="w-4 h-4" />,
      handler: handleZIP,
      disabled: false,
      badge: t('export.new'),
    },
    {
      key: 'pdf',
      label: t('export.pdfLabel'),
      description: t('export.pdfDesc'),
      icon: <FileDown className="w-4 h-4" />,
      handler: handleServerPDF,
      disabled: false,
      badge: t('export.pro'),
    },
    {
      key: 'docx',
      label: t('export.docxLabel'),
      description: t('export.docxDesc'),
      icon: <FileText className="w-4 h-4" />,
      handler: handleServerDOCX,
      disabled: false,
      badge: t('export.new'),
    },
    {
      key: 'xlsx',
      label: t('export.xlsxLabel'),
      description: t('export.xlsxDesc'),
      icon: <FileSpreadsheet className="w-4 h-4" />,
      handler: handleExcel,
      disabled: !countryIso,
      badge: t('export.backend'),
    },
    {
      key: 'pptx',
      label: t('export.pptxLabel'),
      description: t('export.pptxDesc'),
      icon: <Presentation className="w-4 h-4" />,
      handler: handlePPTX,
      disabled: !countryIso,
      badge: t('export.backend'),
    },
    {
      key: 'svg',
      label: t('export.svgLabel'),
      description: t('export.svgDesc'),
      icon: <ImageIcon className="w-4 h-4" />,
      handler: handleInfographic,
      disabled: !countryIso,
      badge: t('export.backend'),
    },
    {
      key: 'html',
      label: t('export.htmlLabel'),
      description: t('export.htmlDesc'),
      icon: <Globe className="w-4 h-4" />,
      handler: handleHTML,
      disabled: false,
      badge: t('export.embed'),
    },
    {
      key: 'print',
      label: t('export.printLabel'),
      description: t('export.printDesc'),
      icon: <Printer className="w-4 h-4" />,
      handler: handlePrint,
      disabled: false,
    },
    {
      key: 'json',
      label: t('export.jsonLabel'),
      description: t('export.jsonDesc'),
      icon: <FileJson className="w-4 h-4" />,
      handler: handleJSON,
      disabled: false,
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {/* ── Dropdown menu for all export options ── */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 gap-2 border-[#C9A84C]/30 text-[#9C7A2D] hover:bg-[#F7F2E8] hover:border-[#C9A84C]/50 hover:text-[#9C7A2D] transition-all duration-200 shadow-sm font-medium"
                disabled={!!exporting}
              >
                <AnimatePresence mode="wait">
                  {exporting ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span className="text-[11px]">
                        {t('export.exporting')}
                      </span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-[11px]">
                        {t('export.exportLabel')}
                      </span>
                      <ChevronDown className="w-3 h-3 opacity-50" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#9C7A2D] text-white text-[10px]">
            {t('export.tooltip')}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent
          align="end"
          className="w-72 p-1.5 shadow-xl border-[#E8D5A0]/50 rounded-xl"
        >
          <DropdownMenuLabel className="px-2.5 py-2 text-[10px] uppercase tracking-widest text-[#9C7A2D] font-bold">
            {t('export.formats')}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-[#E8D5A0]/30" />

          {exportOptions.map((option) => (
            <DropdownMenuItem
              key={option.key}
              onClick={() => {
                if (!option.disabled && !exporting) {
                  option.handler();
                }
              }}
              disabled={option.disabled || exporting === option.key}
              className="flex items-start gap-3 px-2.5 py-2.5 rounded-lg cursor-pointer my-0.5 focus:bg-[#F7F2E8] focus:text-inherit transition-colors duration-150"
            >
              <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                option.key === 'pdf' ? 'bg-[#A6492F]/10 text-[#A6492F]' :
                option.key === 'zip' ? 'bg-[#9C7A2D]/10 text-[#9C7A2D]' :
                option.key === 'docx' ? 'bg-[#2C7A6B]/10 text-[#2C7A6B]' :
                option.key === 'html' ? 'bg-[#2C7A6B]/10 text-[#2C7A6B]' :
                option.key === 'print' ? 'bg-[#9C7A2D]/10 text-[#9C7A2D]' :
                'bg-gray-100 text-gray-500'
              }`}>
                {exporting === option.key ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  option.icon
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-gray-800">
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-[#9C7A2D]/10 text-[#9C7A2D] uppercase tracking-wider">
                      {option.badge}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-gray-400 leading-snug mt-0.5">
                  {option.description}
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Quick-access small icon buttons ── */}
      <div className="hidden sm:flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleServerPDF}
              disabled={!!exporting}
              className="h-7 w-7 p-0 text-gray-400 hover:text-[#A6492F] hover:bg-[#A6492F]/5 transition-colors"
            >
              {exporting === 'pdf' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#A6492F] text-white text-[10px]">
            {t('export.pdfLabel')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleServerDOCX}
              disabled={!!exporting}
              className="h-7 w-7 p-0 text-gray-400 hover:text-[#2C7A6B] hover:bg-[#2C7A6B]/5 transition-colors"
            >
              {exporting === 'docx' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#2C7A6B] text-white text-[10px]">
            {t('export.docxLabel')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHTML}
              disabled={!!exporting}
              className="h-7 w-7 p-0 text-gray-400 hover:text-[#2C7A6B] hover:bg-[#2C7A6B]/5 transition-colors"
            >
              {exporting === 'html' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#2C7A6B] text-white text-[10px]">
            {t('export.htmlLabel')}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrint}
              disabled={!!exporting}
              className="h-7 w-7 p-0 text-gray-400 hover:text-[#9C7A2D] hover:bg-[#9C7A2D]/5 transition-colors"
            >
              {exporting === 'print' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Printer className="w-3.5 h-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="bg-[#9C7A2D] text-white text-[10px]">
            {t('export.printLabel')}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
