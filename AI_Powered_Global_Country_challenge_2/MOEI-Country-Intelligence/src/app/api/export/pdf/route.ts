import PDFDocument from 'pdfkit';
import type { Transform } from 'stream';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrendData {
  direction: string;
  good_up: boolean;
  change_pct?: number;
  cagr_pct?: number;
}

interface HeadlineItem {
  key: string;
  display: string;
  unit: string;
  as_of: string;
  source: string;
  trend?: TrendData;
}

interface TrajectoryItem {
  key: string;
  latest: number;
  latest_year: number;
  unit: string;
  direction: string;
  good_up: boolean;
  display: string;
}

interface TradePartner {
  name: string;
  value: number;
  code: string;
  share_pct: number;
}

interface TradeData {
  year: number;
  export_partners: TradePartner[];
  import_partners: TradePartner[];
  export_goods: TradePartner[];
  import_goods: TradePartner[];
}

interface KeyValueItem {
  key: string;
  value: string | number;
  unit?: string;
  display: string;
  source?: string;
}

interface InsightItem {
  title: string;
  content: string;
}

interface SourceItem {
  label: string;
  url: string;
  domain: string;
  verified: boolean;
}

interface FieldItem {
  field_name: string;
  domain: string;
  value: string | null;
  source_url: string | null;
  confidence: string;
  corroborated: number;
}

interface ReportData {
  role: string;
  country: string;
  country_name?: string;
  generated_at: string;
  lang?: string;
  headline: HeadlineItem[];
  trajectory: TrajectoryItem[];
  trade: TradeData | null;
  sectors: KeyValueItem[];
  energy: KeyValueItem[];
  uae: KeyValueItem[];
  read: string | null;
  analysis: string | null;
  insights: InsightItem[];
  risks: InsightItem[];
  opportunities: InsightItem[];
  coverage: { found: number; total: number; pct: number };
  sources?: SourceItem[];
  fields?: FieldItem[];
}

// ─── Color Palette ────────────────────────────────────────────────────────────

const COLORS = {
  primaryGold: '#9C7A2D',
  teal: '#2C7A6B',
  lightGold: '#C9A84C',
  red: '#A6492F',
  green: '#3D9985',
  black: '#1A1A1A',
  darkGray: '#4A4A4A',
  mediumGray: '#6B6B6B',
  lightGray: '#F2F2F2',
  white: '#FFFFFF',
  altRowGray: '#F7F7F7',
};

const CHART_COLORS = [
  COLORS.teal, COLORS.primaryGold, COLORS.lightGold, COLORS.red,
  COLORS.green, '#64748b', '#E8D5A0', '#94a3b8',
];

// ─── Role Configuration ───────────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { title: string; classification: string }> = {
  minister: { title: 'Ministerial Strategic Brief', classification: 'CABINET-LEVEL' },
  deputy: { title: 'Deputy Minister Operational Review', classification: 'SENIOR OFFICIAL' },
  client: { title: 'Investment Intelligence Brief', classification: 'CONFIDENTIAL' },
  manager: { title: 'Departmental Performance Report', classification: 'INTERNAL' },
  team: { title: 'Analytical Data Report', classification: 'ANALYTICAL' },
};

// ─── RTL / Language Support ───────────────────────────────────────────────────

type Lang = 'en' | 'ar';

const SECTION_LABELS: Record<string, Record<Lang, string>> = {
  executiveSummary: { en: 'Executive Summary', ar: 'الملخص التنفيذي' },
  kpis: { en: 'Key Performance Indicators', ar: 'مؤشرات الأداء الرئيسية' },
  trajectory: { en: 'Trajectory Overview', ar: 'نظرة عامة على الاتجاهات' },
  trade: { en: 'Trade & Commerce', ar: 'التجارة والاقتصاد' },
  exportPartners: { en: 'Top Export Partners', ar: 'أهم شركاء التصدير' },
  importPartners: { en: 'Top Import Partners', ar: 'أهم شركاء الاستيراد' },
  exportGoods: { en: 'Top Export Goods', ar: 'أهم السلع المصدرة' },
  importGoods: { en: 'Top Import Goods', ar: 'أهم السلع المستوردة' },
  sectors: { en: 'Economic Sectors', ar: 'القطاعات الاقتصادية' },
  energy: { en: 'Energy Profile', ar: 'ملف الطاقة' },
  uae: { en: 'UAE Bilateral Relations', ar: 'العلاقات الثنائية مع الإمارات' },
  insights: { en: 'Strategic Insights', ar: 'الرؤى الاستراتيجية' },
  risks: { en: 'Risk Assessment', ar: 'تقييم المخاطر' },
  opportunities: { en: 'Opportunities', ar: 'الفرص' },
  analysis: { en: 'Detailed Analysis', ar: 'التحليل التفصيلي' },
  sources: { en: 'Sources & References', ar: 'المصادر والمراجع' },
  kpiChart: { en: 'KPI Comparison', ar: 'مقارنة المؤشرات' },
  sectorDist: { en: 'Sector Distribution', ar: 'توزيع القطاعات' },
  energyMix: { en: 'Energy Mix', ar: 'مزيج الطاقة' },
  riskSummary: { en: 'Risk Severity Summary', ar: 'ملخص شدة المخاطر' },
  tradeYear: { en: 'Trade Data Year', ar: 'سنة بيانات التجارة' },
  noData: { en: 'No data available.', ar: 'لا تتوفر بيانات.' },
};

function t(key: string, lang: Lang): string {
  return SECTION_LABELS[key]?.[lang] || SECTION_LABELS[key]?.en || key;
}

// ─── Page Layout Constants ────────────────────────────────────────────────────

const PAGE_WIDTH = 595.28; // A4
const PAGE_HEIGHT = 841.89; // A4
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 40;
const FOOTER_HEIGHT = 35;

// ─── Helper: Strip Markdown ───────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '\u2022 ')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/---+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ─── Helper: Format Number ────────────────────────────────────────────────────

function formatNumber(value: string | number): string {
  if (typeof value === 'string') return value;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed?.(2) ?? String(value);
}

// ─── Helper: Get Trend Indicator ──────────────────────────────────────────────

function getTrendIndicator(direction: string, goodUp?: boolean): { symbol: string; color: string } {
  const dir = direction?.toLowerCase();
  if (dir === 'up' || dir === 'rising' || dir === 'increasing') {
    return { symbol: '\u25B2', color: goodUp === false ? COLORS.red : COLORS.green };
  }
  if (dir === 'down' || dir === 'falling' || dir === 'decreasing') {
    return { symbol: '\u25BC', color: goodUp === true ? COLORS.red : COLORS.green };
  }
  return { symbol: '\u25CF', color: COLORS.mediumGray };
}

// ─── Helper: Check Page Space & Add New Page ──────────────────────────────────

interface PageState {
  pageNum: number;
  tocEntries: { title: string; page: number }[];
  lang: Lang;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, state: PageState, countryName: string): void {
  if (doc.y + needed > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT) {
    doc.addPage();
    state.pageNum++;
    addHeader(doc, countryName, state.lang);
  }
}

// ─── Helper: Draw Page Header ─────────────────────────────────────────────────

function addHeader(doc: PDFKit.PDFDocument, countryName: string, lang: Lang = 'en'): void {
  const headerY = 20;
  const align = lang === 'ar' ? 'right' : 'left';

  // Gold accent line
  doc
    .save()
    .moveTo(MARGIN, headerY + 14)
    .lineTo(PAGE_WIDTH - MARGIN, headerY + 14)
    .lineWidth(1)
    .strokeColor(COLORS.lightGold)
    .stroke()
    .restore();

  // Header text
  const headerText = lang === 'ar'
    ? `منصة استخبارات الدول | ${countryName}`
    : `MOEI Country Intelligence Platform | ${countryName}`;

  doc
    .fontSize(8)
    .fillColor(COLORS.mediumGray)
    .text(headerText, MARGIN, headerY, {
      width: CONTENT_WIDTH,
      align,
    });

  // Move past header area - set y to after header
  doc.y = MARGIN;
}

// ─── Helper: Draw Page Footer ─────────────────────────────────────────────────

function addFooters(doc: PDFKit.PDFDocument, lang: Lang = 'en'): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Skip footer on cover page
    if (i === 0) continue;

    const footerY = PAGE_HEIGHT - 30;

    // Gold accent line
    doc
      .save()
      .moveTo(MARGIN, footerY - 4)
      .lineTo(PAGE_WIDTH - MARGIN, footerY - 4)
      .lineWidth(0.5)
      .strokeColor(COLORS.lightGold)
      .stroke()
      .restore();

    const pageText = lang === 'ar'
      ? `صفحة ${i} من ${range.count - 1}`
      : `Page ${i} of ${range.count - 1}`;

    doc
      .fontSize(8)
      .fillColor(COLORS.mediumGray)
      .text(pageText, MARGIN, footerY, {
        width: CONTENT_WIDTH,
        align: 'center',
      });
  }
}

// ─── Helper: Draw Section Header ──────────────────────────────────────────────

function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  state: PageState,
  countryName: string
): void {
  ensureSpace(doc, 50, state, countryName);

  const y = doc.y + 10;
  const align = state.lang === 'ar' ? 'right' : 'left';

  // Teal header bar
  doc
    .save()
    .rect(MARGIN, y, CONTENT_WIDTH, 28)
    .fill(COLORS.teal)
    .restore();

  // Title text
  doc
    .fontSize(13)
    .fillColor(COLORS.white)
    .text(title, MARGIN + 12, y + 7, {
      width: CONTENT_WIDTH - 24,
      align,
    });

  // Gold accent line below
  doc
    .save()
    .rect(MARGIN, y + 28, CONTENT_WIDTH, 2)
    .fill(COLORS.lightGold)
    .restore();

  doc.y = y + 40;
}

// ─── Helper: Draw Table ───────────────────────────────────────────────────────

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: string[][],
  state: PageState,
  countryName: string
): void {
  const headerHeight = 26;
  const rowHeight = 22;
  const isRTL = state.lang === 'ar';

  // Check if header fits
  ensureSpace(doc, headerHeight + rowHeight * 2, state, countryName);

  // Draw table header
  const hY = doc.y;
  doc.save().rect(MARGIN, hY, CONTENT_WIDTH, headerHeight).fill(COLORS.teal).restore();

  let x = MARGIN;
  for (const col of columns) {
    const colAlign = isRTL ? (col.align === 'left' ? 'right' : col.align === 'right' ? 'left' : col.align) : col.align;
    doc
      .fontSize(8)
      .fillColor(COLORS.white)
      .text(col.header, x + 5, hY + 7, {
        width: col.width - 10,
        align: colAlign || 'left',
        lineBreak: false,
        ellipsis: true,
      });
    x += col.width;
  }

  doc.y = hY + headerHeight;

  // Draw rows
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    // Check if row fits on page
    if (doc.y + rowHeight > PAGE_HEIGHT - MARGIN - FOOTER_HEIGHT) {
      doc.addPage();
      state.pageNum++;
      addHeader(doc, countryName, state.lang);
      // Redraw table header on new page
      const newHeaderY = doc.y;
      doc.save().rect(MARGIN, newHeaderY, CONTENT_WIDTH, headerHeight).fill(COLORS.teal).restore();
      let nx = MARGIN;
      for (const col of columns) {
        const colAlign = isRTL ? (col.align === 'left' ? 'right' : col.align === 'right' ? 'left' : col.align) : col.align;
        doc
          .fontSize(8)
          .fillColor(COLORS.white)
          .text(col.header, nx + 5, newHeaderY + 7, {
            width: col.width - 10,
            align: colAlign || 'left',
            lineBreak: false,
            ellipsis: true,
          });
        nx += col.width;
      }
      doc.y = newHeaderY + headerHeight;
    }

    const rY = doc.y;
    const bgColor = r % 2 === 0 ? COLORS.white : COLORS.altRowGray;

    // Row background
    doc.save().rect(MARGIN, rY, CONTENT_WIDTH, rowHeight).fill(bgColor).restore();

    // Row border bottom
    doc
      .save()
      .moveTo(MARGIN, rY + rowHeight)
      .lineTo(MARGIN + CONTENT_WIDTH, rY + rowHeight)
      .lineWidth(0.3)
      .strokeColor('#DDDDDD')
      .stroke()
      .restore();

    // Cell content
    let cx = MARGIN;
    for (let c = 0; c < columns.length && c < row.length; c++) {
      const col = columns[c];
      const cellText = row[c] || '';
      const colAlign = isRTL ? (col.align === 'left' ? 'right' : col.align === 'right' ? 'left' : col.align) : col.align;
      doc
        .fontSize(7.5)
        .fillColor(COLORS.darkGray)
        .text(cellText, cx + 5, rY + 6, {
          width: col.width - 10,
          align: colAlign || 'left',
          lineBreak: false,
          ellipsis: true,
        });
      cx += col.width;
    }

    doc.y = rY + rowHeight;
  }

  doc.y += 8;
}

// ─── Chart Helper: Horizontal Bar Chart ───────────────────────────────────────

function drawBarChart(
  doc: PDFKit.PDFDocument,
  data: Array<{ label: string; value: number; color?: string }>,
  options: { x: number; y: number; width: number; height: number; barColor?: string; title?: string },
  state: PageState,
  countryName: string
): void {
  const { x, y: startY, width, height, barColor = COLORS.teal, title } = options;
  if (!data || data.length === 0) return;

  const barHeight = Math.min(16, (height - 20) / data.length - 4);
  const totalChartHeight = data.length * (barHeight + 6) + 20;
  ensureSpace(doc, totalChartHeight + 20, state, countryName);

  const actualY = doc.y;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const labelWidth = 110;
  const chartWidth = width - labelWidth - 50;

  // Title if provided
  if (title) {
    doc
      .fontSize(9)
      .fillColor(COLORS.darkGray)
      .text(title, x, actualY, { width, align: state.lang === 'ar' ? 'right' : 'left' });
    doc.y += 14;
  }

  const chartStartY = doc.y;

  data.forEach((item, i) => {
    const barY = chartStartY + i * (barHeight + 6);
    const barW = Math.max((item.value / maxVal) * chartWidth, 2);
    const color = item.color || barColor;

    // Label
    doc.fontSize(7).fillColor(COLORS.darkGray)
      .text(item.label, x, barY + 3, { width: labelWidth, align: state.lang === 'ar' ? 'right' : 'left', lineBreak: false, ellipsis: true });

    // Bar background (light gray)
    doc.save().rect(x + labelWidth + 5, barY, chartWidth, barHeight).fill('#E8E8E8').restore();

    // Bar
    doc.save().rect(x + labelWidth + 5, barY, barW, barHeight).fill(color).restore();

    // Value text
    doc.fontSize(7).fillColor(COLORS.mediumGray)
      .text(item.value.toLocaleString(), x + labelWidth + chartWidth + 10, barY + 3, { width: 40, align: 'left' });
  });

  doc.y = chartStartY + data.length * (barHeight + 6) + 10;
}

// ─── Chart Helper: Pie/Donut Chart ────────────────────────────────────────────

function drawDonutChart(
  doc: PDFKit.PDFDocument,
  data: Array<{ label: string; value: number; color?: string }>,
  options: { cx: number; cy: number; radius: number; innerRadius?: number; title?: string },
  state: PageState,
  countryName: string
): void {
  if (!data || data.length === 0) return;

  const { cx, radius, innerRadius = 0, title } = options;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return;

  const estimatedHeight = radius * 2 + 30;
  ensureSpace(doc, estimatedHeight + 20, state, countryName);

  // Title if provided
  if (title) {
    doc
      .fontSize(9)
      .fillColor(COLORS.darkGray)
      .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH, align: state.lang === 'ar' ? 'right' : 'left' });
    doc.y += 14;
  }

  const centerY = doc.y + radius;

  // Draw pie/donut segments
  let startAngle = 0;
  data.forEach((item, i) => {
    const pct = item.value / total;
    const endAngle = startAngle + pct * 2 * Math.PI;
    const color = item.color || CHART_COLORS[i % CHART_COLORS.length];

    // Draw sector as a path
    doc.save();
    doc.moveTo(cx, centerY);
    const steps = Math.max(Math.ceil(pct * 36), 3);
    for (let s = 0; s <= steps; s++) {
      const angle = startAngle + (endAngle - startAngle) * (s / steps);
      const px = cx + radius * Math.cos(angle - Math.PI / 2);
      const py = centerY + radius * Math.sin(angle - Math.PI / 2);
      doc.lineTo(px, py);
    }
    doc.lineTo(cx, centerY);
    doc.fill(color);
    doc.restore();

    // If inner radius (donut), draw white circle in center
    startAngle = endAngle;
  });

  // Draw inner circle for donut effect
  if (innerRadius > 0) {
    doc.save().circle(cx, centerY, innerRadius).fill(COLORS.white).restore();
    // Center text
    doc.fontSize(14).fillColor(COLORS.black)
      .text(String(data.length), cx - 15, centerY - 8, { width: 30, align: 'center' });
  }

  // Draw legend to the right of the chart
  const legendX = cx + radius + 25;
  let legendY = centerY - (data.length * 15) / 2;

  data.forEach((item, i) => {
    const color = item.color || CHART_COLORS[i % CHART_COLORS.length];
    const pctStr = ((item.value / total) * 100).toFixed(0);

    doc.save().rect(legendX, legendY, 8, 8).fill(color).restore();
    doc.fontSize(7).fillColor(COLORS.darkGray)
      .text(`${item.label} (${pctStr}%)`, legendX + 12, legendY, { width: 140, lineBreak: false, ellipsis: true });
    legendY += 15;
  });

  doc.y = Math.max(centerY + radius, legendY) + 10;
}

// ─── Chart Helper: Risk Severity Bars ─────────────────────────────────────────

function drawRiskSeverityBars(
  doc: PDFKit.PDFDocument,
  items: InsightItem[],
  accentColor: string,
  state: PageState,
  countryName: string
): void {
  if (!items || items.length === 0) return;

  const barHeight = 8;
  const totalHeight = items.length * 24 + 10;
  ensureSpace(doc, totalHeight, state, countryName);

  const startY = doc.y;

  items.forEach((item, i) => {
    const barY = startY + i * 24;
    // Estimate severity from content length (simple heuristic)
    const severity = Math.min(item.content.length / 200, 1);
    const barW = Math.max(severity * (CONTENT_WIDTH - 120), 10);

    // Label
    doc.fontSize(7.5).fillColor(COLORS.darkGray)
      .text(item.title, MARGIN, barY, { width: CONTENT_WIDTH - 10, lineBreak: false, ellipsis: true });

    // Severity bar background
    doc.save().rect(MARGIN, barY + 11, CONTENT_WIDTH - 80, barHeight).fill('#E8E8E8').restore();

    // Severity bar
    doc.save().rect(MARGIN, barY + 11, barW, barHeight).fill(accentColor).restore();

    // Severity label
    const severityLabel = severity > 0.7 ? (state.lang === 'ar' ? 'مرتفع' : 'High') :
      severity > 0.4 ? (state.lang === 'ar' ? 'متوسط' : 'Medium') : (state.lang === 'ar' ? 'منخفض' : 'Low');
    doc.fontSize(6.5).fillColor(accentColor)
      .text(severityLabel, MARGIN + barW + 5, barY + 11, { width: 60 });
  });

  doc.y = startY + items.length * 24 + 10;
}

// ─── Helper: Draw Text Block ──────────────────────────────────────────────────

function drawTextBlock(
  doc: PDFKit.PDFDocument,
  text: string,
  state: PageState,
  countryName: string,
  fontSize: number = 9.5,
  color: string = COLORS.darkGray
): void {
  const cleanText = stripMarkdown(text);
  if (!cleanText) return;

  // Estimate height needed
  const charsPerLine = Math.floor(CONTENT_WIDTH / (fontSize * 0.52));
  const lineCount = Math.ceil(cleanText.length / charsPerLine) + (cleanText.split('\n').length - 1);
  const estimatedHeight = lineCount * (fontSize * 1.5) + 10;

  ensureSpace(doc, Math.min(estimatedHeight, 80), state, countryName);

  const align = state.lang === 'ar' ? 'right' : 'justify';

  doc
    .fontSize(fontSize)
    .fillColor(color)
    .text(cleanText, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      align,
      lineGap: 3,
    });

  doc.y += 10;
}

// ─── Helper: Draw Insight Card ────────────────────────────────────────────────

function drawInsightCard(
  doc: PDFKit.PDFDocument,
  title: string,
  content: string,
  accentColor: string,
  state: PageState,
  countryName: string
): void {
  ensureSpace(doc, 70, state, countryName);

  const startY = doc.y;

  // Accent bar on left
  doc.save().rect(MARGIN, startY, 3, 18).fill(accentColor).restore();

  // Title
  doc
    .fontSize(10)
    .fillColor(COLORS.black)
    .text(title, MARGIN + 10, startY + 2, {
      width: CONTENT_WIDTH - 14,
    });

  doc.y += 6;

  // Content
  drawTextBlock(doc, content, state, countryName, 8.5, COLORS.darkGray);

  // Subtle separator
  doc
    .save()
    .moveTo(MARGIN + 10, doc.y)
    .lineTo(PAGE_WIDTH - MARGIN, doc.y)
    .lineWidth(0.3)
    .strokeColor('#E0E0E0')
    .stroke()
    .restore();

  doc.y += 8;
}

// ─── Cover Page ───────────────────────────────────────────────────────────────

function drawCoverPage(
  doc: PDFKit.PDFDocument,
  data: ReportData,
  roleConfig: { title: string; classification: string },
  lang: Lang
): void {
  const countryName = data.country_name || data.country;
  const dateStr = new Date(data.generated_at).toLocaleDateString(lang === 'ar' ? 'ar-AE' : 'en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const align = lang === 'ar' ? 'right' : 'left';
  const centerAlign = 'center' as const;

  // Top gold band
  doc.save().rect(0, 0, PAGE_WIDTH, 8).fill(COLORS.primaryGold).restore();

  // Teal header block
  const tealTop = 80;
  doc.save().rect(0, tealTop, PAGE_WIDTH, 200).fill(COLORS.teal).restore();

  // MOEI branding
  const ministryText = lang === 'ar' ? 'وزارة الطاقة والبنية التحتية' : 'MINISTRY OF ECONOMY & INDUSTRY';
  doc
    .fontSize(11)
    .fillColor(COLORS.lightGold)
    .text(ministryText, MARGIN, tealTop + 30, {
      width: CONTENT_WIDTH,
      align: centerAlign,
      characterSpacing: 3,
    });

  // Platform name
  const platformText = lang === 'ar' ? 'منصة استخبارات الدول' : 'Country Intelligence Platform';
  doc
    .fontSize(22)
    .fillColor(COLORS.white)
    .text(platformText, MARGIN, tealTop + 58, {
      width: CONTENT_WIDTH,
      align: centerAlign,
    });

  // Gold divider
  const dividerY = tealTop + 100;
  doc
    .save()
    .moveTo(PAGE_WIDTH / 2 - 80, dividerY)
    .lineTo(PAGE_WIDTH / 2 + 80, dividerY)
    .lineWidth(2)
    .strokeColor(COLORS.lightGold)
    .stroke()
    .restore();

  // Country name
  doc
    .fontSize(36)
    .fillColor(COLORS.white)
    .text(countryName.toUpperCase(), MARGIN, dividerY + 18, {
      width: CONTENT_WIDTH,
      align: centerAlign,
    });

  // Role title
  doc
    .fontSize(14)
    .fillColor(COLORS.lightGold)
    .text(roleConfig.title, MARGIN, dividerY + 68, {
      width: CONTENT_WIDTH,
      align: centerAlign,
    });

  // Classification badge
  const badgeY = tealTop + 220;
  const badgeWidth = doc.widthOfString(roleConfig.classification, { size: 9 }) + 24;
  const badgeX = (PAGE_WIDTH - badgeWidth) / 2;

  doc.save().rect(badgeX, badgeY, badgeWidth, 22).fill(COLORS.red).restore();
  doc
    .fontSize(9)
    .fillColor(COLORS.white)
    .text(roleConfig.classification, badgeX, badgeY + 6, {
      width: badgeWidth,
      align: centerAlign,
      characterSpacing: 1.5,
    });

  // Date & details section
  const detailsY = badgeY + 60;
  const dateLabel = lang === 'ar' ? 'التاريخ' : 'Date';
  const codeLabel = lang === 'ar' ? 'رمز الدولة' : 'Country Code';

  doc
    .fontSize(10)
    .fillColor(COLORS.darkGray)
    .text(`${dateLabel}: ${dateStr}`, MARGIN, detailsY, { width: CONTENT_WIDTH, align: centerAlign });

  doc
    .fontSize(9)
    .fillColor(COLORS.mediumGray)
    .text(`${codeLabel}: ${data.country}`, MARGIN, detailsY + 22, {
      width: CONTENT_WIDTH,
      align: centerAlign,
    });

  // Coverage bar
  if (data.coverage) {
    const coverageLabel = lang === 'ar' ? 'تغطية البيانات' : 'Data Coverage';
    const coverageY = detailsY + 55;
    doc
      .fontSize(9)
      .fillColor(COLORS.mediumGray)
      .text(`${coverageLabel}: ${data.coverage.found}/${data.coverage.total} (${data.coverage.pct.toFixed(0)}%)`, MARGIN, coverageY, {
        width: CONTENT_WIDTH,
        align: centerAlign,
      });

    // Progress bar
    const barWidth = 200;
    const barHeight = 6;
    const barX = (PAGE_WIDTH - barWidth) / 2;
    const barY = coverageY + 18;
    const fillWidth = (data.coverage.pct / 100) * barWidth;

    doc.save().rect(barX, barY, barWidth, barHeight).fill('#E0E0E0').restore();
    doc.save().rect(barX, barY, fillWidth, barHeight).fill(COLORS.teal).restore();
  }

  // Bottom gold band
  doc.save().rect(0, PAGE_HEIGHT - 8, PAGE_WIDTH, 8).fill(COLORS.primaryGold).restore();

  // Footer note
  const footerNote = lang === 'ar'
    ? 'يحتوي هذا المستند على معلومات خاصة. التوزيع مقيد حسب مستوى التصنيف.'
    : 'This document contains privileged information. Distribution is restricted per classification level.';
  doc
    .fontSize(7)
    .fillColor(COLORS.mediumGray)
    .text(footerNote, MARGIN, PAGE_HEIGHT - 50, {
      width: CONTENT_WIDTH,
      align: centerAlign,
    });
}

// ─── Table of Contents ────────────────────────────────────────────────────────

function drawTableOfContents(
  doc: PDFKit.PDFDocument,
  tocEntries: { title: string; page: number }[],
  lang: Lang
): void {
  doc.y = MARGIN + 10;

  const tocTitle = lang === 'ar' ? 'جدول المحتويات' : 'Table of Contents';
  doc
    .fontSize(18)
    .fillColor(COLORS.teal)
    .text(tocTitle, MARGIN, doc.y, { width: CONTENT_WIDTH });

  doc.y += 8;

  // Gold accent line
  doc
    .save()
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + 120, doc.y)
    .lineWidth(2)
    .strokeColor(COLORS.lightGold)
    .stroke()
    .restore();

  doc.y += 16;

  for (const entry of tocEntries) {
    const entryY = doc.y;

    // Section title
    doc
      .fontSize(10)
      .fillColor(COLORS.black)
      .text(entry.title, MARGIN + 8, entryY, {
        width: CONTENT_WIDTH - 60,
        continued: false,
      });

    // Page number right-aligned
    doc
      .fontSize(10)
      .fillColor(COLORS.teal)
      .text(String(entry.page), MARGIN + CONTENT_WIDTH - 30, entryY, {
        width: 30,
        align: 'right',
      });

    // Dotted line
    const titleWidth = doc.widthOfString(entry.title, { size: 10 });
    const dotStartX = MARGIN + 8 + titleWidth + 6;
    const dotEndX = MARGIN + CONTENT_WIDTH - 36;
    if (dotEndX > dotStartX + 10) {
      const dotSpacing = 4;
      let dx = dotStartX;
      doc.save();
      while (dx < dotEndX) {
        doc.circle(dx, entryY + 6, 0.5).fill(COLORS.lightGray);
        dx += dotSpacing;
      }
      doc.restore();
    }

    doc.y = entryY + 22;
  }
}

// ─── Main PDF Generation ──────────────────────────────────────────────────────

async function generatePDF(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lang: Lang = data.lang === 'ar' ? 'ar' : 'en';
    const isRTL = lang === 'ar';

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
      bufferPages: true,
      autoFirstPage: true,
      ...(isRTL ? { features: ['rtla'] as string[] } : {}),
    });

    const chunks: Buffer[] = [];
    const transform = doc as unknown as Transform;
    transform.on('data', (chunk: Buffer) => chunks.push(chunk));
    transform.on('end', () => resolve(Buffer.concat(chunks)));
    transform.on('error', reject);

    const countryName = data.country_name || data.country;
    const roleConfig = ROLE_CONFIG[data.role] || ROLE_CONFIG.team;
    const state: PageState = { pageNum: 1, tocEntries: [], lang };

    // ── Cover Page ──────────────────────────────────────────────────────────
    drawCoverPage(doc, data, roleConfig, lang);

    // ── Placeholder for TOC ─────────────────────────────────────────────────
    const tocSections = [
      t('executiveSummary', lang),
      t('kpis', lang),
      t('trajectory', lang),
      t('trade', lang),
      t('sectors', lang),
      t('energy', lang),
      t('uae', lang),
      t('insights', lang),
      t('risks', lang),
      t('opportunities', lang),
      t('analysis', lang),
      t('sources', lang),
    ];

    // Reserve space for TOC on page 2
    doc.addPage();
    state.pageNum = 2;
    addHeader(doc, countryName, lang);

    const sectionPageMap: Map<string, number> = new Map();

    // ── Executive Summary ───────────────────────────────────────────────────
    doc.addPage();
    state.pageNum++;
    addHeader(doc, countryName, lang);
    sectionPageMap.set(t('executiveSummary', lang), state.pageNum);

    drawSectionHeader(doc, t('executiveSummary', lang), state, countryName);
    if (data.read) {
      drawTextBlock(doc, data.read, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Key Performance Indicators ──────────────────────────────────────────
    ensureSpace(doc, 80, state, countryName);
    sectionPageMap.set(t('kpis', lang), state.pageNum);

    drawSectionHeader(doc, t('kpis', lang), state, countryName);

    if (data.headline && data.headline.length > 0) {
      const kpiColumns: TableColumn[] = [
        { header: 'Metric', width: 130 },
        { header: 'Value', width: 90 },
        { header: 'Unit', width: 55 },
        { header: 'Trend', width: 55, align: 'center' },
        { header: 'As Of', width: 60 },
        { header: 'Source', width: CONTENT_WIDTH - 390 },
      ];

      const kpiRows = data.headline.map((item) => {
        const trend = item.trend;
        let trendStr = '\u2014';
        if (trend) {
          const indicator = getTrendIndicator(trend.direction, trend.good_up);
          let changeStr = '';
          if (trend.change_pct != null) {
            changeStr = ` (${trend.change_pct > 0 ? '+' : ''}${trend.change_pct.toFixed(1)}%)`;
          }
          trendStr = `${indicator.symbol}${changeStr}`;
        }
        return [
          item.key || item.display,
          item.display,
          item.unit,
          trendStr,
          item.as_of,
          item.source,
        ];
      });

      drawTable(doc, kpiColumns, kpiRows, state, countryName);

      // ── KPI Bar Chart ─────────────────────────────────────────────────────
      doc.y += 6;
      const kpiChartData = data.headline.slice(0, 8).map(item => {
        const numVal = parseFloat(String(item.display).replace(/[^0-9.-]/g, ''));
        return {
          label: item.key || item.display,
          value: isNaN(numVal) ? 0 : Math.abs(numVal),
        };
      }).filter(d => d.value > 0);

      if (kpiChartData.length > 0) {
        drawBarChart(doc, kpiChartData, {
          x: MARGIN,
          y: doc.y,
          width: CONTENT_WIDTH,
          height: kpiChartData.length * 22 + 30,
          barColor: COLORS.teal,
          title: t('kpiChart', lang),
        }, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Trajectory Overview ─────────────────────────────────────────────────
    ensureSpace(doc, 80, state, countryName);
    sectionPageMap.set(t('trajectory', lang), state.pageNum);

    drawSectionHeader(doc, t('trajectory', lang), state, countryName);

    if (data.trajectory && data.trajectory.length > 0) {
      const trajColumns: TableColumn[] = [
        { header: 'Indicator', width: 140 },
        { header: 'Latest Value', width: 95, align: 'right' },
        { header: 'Year', width: 55, align: 'center' },
        { header: 'Unit', width: 65 },
        { header: 'Direction', width: 75, align: 'center' },
        { header: 'Display', width: CONTENT_WIDTH - 430 },
      ];

      const trajRows = data.trajectory.map((item) => {
        const indicator = getTrendIndicator(item.direction, item.good_up);
        return [
          item.key,
          formatNumber(item.latest),
          String(item.latest_year),
          item.unit,
          `${indicator.symbol} ${item.direction}`,
          item.display,
        ];
      });

      drawTable(doc, trajColumns, trajRows, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Trade & Commerce ────────────────────────────────────────────────────
    sectionPageMap.set(t('trade', lang), state.pageNum);
    drawSectionHeader(doc, t('trade', lang), state, countryName);

    if (data.trade) {
      // Trade year label
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(`${t('tradeYear', lang)}: ${data.trade.year}`, MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 12;

      // Export Partners
      ensureSpace(doc, 60, state, countryName);
      doc
        .fontSize(10)
        .fillColor(COLORS.teal)
        .text(t('exportPartners', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 8;

      const partnerColumns: TableColumn[] = [
        { header: 'Country', width: 170 },
        { header: 'Value (USD)', width: 120, align: 'right' },
        { header: 'Share (%)', width: 85, align: 'center' },
        { header: 'Code', width: 55, align: 'center' },
        { header: '', width: CONTENT_WIDTH - 430 },
      ];

      if (data.trade.export_partners && data.trade.export_partners.length > 0) {
        const expRows = data.trade.export_partners.map((p) => [
          p.name,
          formatNumber(p.value),
          `${p.share_pct.toFixed(1)}%`,
          p.code,
          '',
        ]);
        drawTable(doc, partnerColumns, expRows, state, countryName);

        // ── Export Partners Bar Chart ────────────────────────────────────────
        doc.y += 4;
        const exportChartData = data.trade.export_partners.slice(0, 6).map(p => ({
          label: p.name,
          value: p.share_pct,
          color: COLORS.primaryGold,
        }));
        if (exportChartData.length > 0) {
          drawBarChart(doc, exportChartData, {
            x: MARGIN,
            y: doc.y,
            width: CONTENT_WIDTH,
            height: exportChartData.length * 22 + 30,
            barColor: COLORS.primaryGold,
          }, state, countryName);
        }
      }

      // Import Partners
      ensureSpace(doc, 60, state, countryName);
      doc
        .fontSize(10)
        .fillColor(COLORS.teal)
        .text(t('importPartners', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 8;

      if (data.trade.import_partners && data.trade.import_partners.length > 0) {
        const impRows = data.trade.import_partners.map((p) => [
          p.name,
          formatNumber(p.value),
          `${p.share_pct.toFixed(1)}%`,
          p.code,
          '',
        ]);
        drawTable(doc, partnerColumns, impRows, state, countryName);

        // ── Import Partners Bar Chart ────────────────────────────────────────
        doc.y += 4;
        const importChartData = data.trade.import_partners.slice(0, 6).map(p => ({
          label: p.name,
          value: p.share_pct,
          color: COLORS.teal,
        }));
        if (importChartData.length > 0) {
          drawBarChart(doc, importChartData, {
            x: MARGIN,
            y: doc.y,
            width: CONTENT_WIDTH,
            height: importChartData.length * 22 + 30,
            barColor: COLORS.teal,
          }, state, countryName);
        }
      }

      // Export Goods
      ensureSpace(doc, 60, state, countryName);
      doc
        .fontSize(10)
        .fillColor(COLORS.teal)
        .text(t('exportGoods', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 8;

      const goodsColumns: TableColumn[] = [
        { header: 'Commodity', width: 190 },
        { header: 'Value (USD)', width: 120, align: 'right' },
        { header: 'Share (%)', width: 85, align: 'center' },
        { header: '', width: CONTENT_WIDTH - 395 },
      ];

      if (data.trade.export_goods && data.trade.export_goods.length > 0) {
        const expGoodsRows = data.trade.export_goods.map((g) => [
          g.name,
          formatNumber(g.value),
          `${g.share_pct.toFixed(1)}%`,
          '',
        ]);
        drawTable(doc, goodsColumns, expGoodsRows, state, countryName);
      }

      // Import Goods
      ensureSpace(doc, 60, state, countryName);
      doc
        .fontSize(10)
        .fillColor(COLORS.teal)
        .text(t('importGoods', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 8;

      if (data.trade.import_goods && data.trade.import_goods.length > 0) {
        const impGoodsRows = data.trade.import_goods.map((g) => [
          g.name,
          formatNumber(g.value),
          `${g.share_pct.toFixed(1)}%`,
          '',
        ]);
        drawTable(doc, goodsColumns, impGoodsRows, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Economic Sectors ────────────────────────────────────────────────────
    ensureSpace(doc, 80, state, countryName);
    sectionPageMap.set(t('sectors', lang), state.pageNum);

    drawSectionHeader(doc, t('sectors', lang), state, countryName);

    if (data.sectors && data.sectors.length > 0) {
      const sectorColumns: TableColumn[] = [
        { header: 'Sector', width: 180 },
        { header: 'Value', width: 120, align: 'right' },
        { header: 'Unit', width: 70 },
        { header: 'Display', width: CONTENT_WIDTH - 370 },
      ];

      const sectorRows = data.sectors.map((s) => [
        s.key,
        typeof s.value === 'number' ? formatNumber(s.value) : String(s.value),
        s.unit || '',
        s.display,
      ]);

      drawTable(doc, sectorColumns, sectorRows, state, countryName);

      // ── Sector Distribution Pie Chart ─────────────────────────────────────
      doc.y += 6;
      const sectorChartData = data.sectors.map((s, i) => {
        const numVal = typeof s.value === 'number' ? s.value : parseFloat(String(s.value).replace(/[^0-9.-]/g, ''));
        return {
          label: s.key,
          value: isNaN(numVal) ? 0 : Math.abs(numVal),
          color: CHART_COLORS[i % CHART_COLORS.length],
        };
      }).filter(d => d.value > 0);

      if (sectorChartData.length > 0) {
        drawDonutChart(doc, sectorChartData, {
          cx: MARGIN + 80,
          cy: doc.y + 80,
          radius: 70,
          innerRadius: 30,
          title: t('sectorDist', lang),
        }, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Energy Profile ──────────────────────────────────────────────────────
    ensureSpace(doc, 80, state, countryName);
    sectionPageMap.set(t('energy', lang), state.pageNum);

    drawSectionHeader(doc, t('energy', lang), state, countryName);

    if (data.energy && data.energy.length > 0) {
      const energyColumns: TableColumn[] = [
        { header: 'Energy Type', width: 180 },
        { header: 'Value', width: 120, align: 'right' },
        { header: 'Unit', width: 70 },
        { header: 'Display', width: CONTENT_WIDTH - 370 },
      ];

      const energyRows = data.energy.map((e) => [
        e.key,
        typeof e.value === 'number' ? formatNumber(e.value) : String(e.value),
        e.unit || '',
        e.display,
      ]);

      drawTable(doc, energyColumns, energyRows, state, countryName);

      // ── Energy Mix Donut Chart ────────────────────────────────────────────
      doc.y += 6;
      const energyChartData = data.energy.map((e, i) => {
        const numVal = typeof e.value === 'number' ? e.value : parseFloat(String(e.value).replace(/[^0-9.-]/g, ''));
        return {
          label: e.key,
          value: isNaN(numVal) ? 0 : Math.abs(numVal),
          color: CHART_COLORS[i % CHART_COLORS.length],
        };
      }).filter(d => d.value > 0);

      if (energyChartData.length > 0) {
        drawDonutChart(doc, energyChartData, {
          cx: MARGIN + 80,
          cy: doc.y + 80,
          radius: 70,
          innerRadius: 30,
          title: t('energyMix', lang),
        }, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── UAE Bilateral Relations ─────────────────────────────────────────────
    ensureSpace(doc, 80, state, countryName);
    sectionPageMap.set(t('uae', lang), state.pageNum);

    drawSectionHeader(doc, t('uae', lang), state, countryName);

    if (data.uae && data.uae.length > 0) {
      const uaeColumns: TableColumn[] = [
        { header: 'Metric', width: 180 },
        { header: 'Value', width: 120, align: 'right' },
        { header: 'Unit', width: 70 },
        { header: 'Display', width: CONTENT_WIDTH - 370 },
      ];

      const uaeRows = data.uae.map((u) => [
        u.key,
        typeof u.value === 'number' ? formatNumber(u.value) : String(u.value),
        u.unit || '',
        u.display,
      ]);

      drawTable(doc, uaeColumns, uaeRows, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Strategic Insights ──────────────────────────────────────────────────
    ensureSpace(doc, 60, state, countryName);
    sectionPageMap.set(t('insights', lang), state.pageNum);

    drawSectionHeader(doc, t('insights', lang), state, countryName);

    if (data.insights && data.insights.length > 0) {
      for (const insight of data.insights) {
        drawInsightCard(doc, insight.title, insight.content, COLORS.teal, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Risk Assessment ─────────────────────────────────────────────────────
    ensureSpace(doc, 60, state, countryName);
    sectionPageMap.set(t('risks', lang), state.pageNum);

    drawSectionHeader(doc, t('risks', lang), state, countryName);

    if (data.risks && data.risks.length > 0) {
      for (const risk of data.risks) {
        drawInsightCard(doc, risk.title, risk.content, COLORS.red, state, countryName);
      }

      // ── Risk Severity Summary Bars ────────────────────────────────────────
      doc.y += 4;
      drawRiskSeverityBars(doc, data.risks, COLORS.red, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Opportunities ───────────────────────────────────────────────────────
    ensureSpace(doc, 60, state, countryName);
    sectionPageMap.set(t('opportunities', lang), state.pageNum);

    drawSectionHeader(doc, t('opportunities', lang), state, countryName);

    if (data.opportunities && data.opportunities.length > 0) {
      for (const opp of data.opportunities) {
        drawInsightCard(doc, opp.title, opp.content, COLORS.green, state, countryName);
      }

      // ── Opportunity Severity Summary Bars ─────────────────────────────────
      doc.y += 4;
      drawRiskSeverityBars(doc, data.opportunities, COLORS.green, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Detailed Analysis ───────────────────────────────────────────────────
    ensureSpace(doc, 60, state, countryName);
    sectionPageMap.set(t('analysis', lang), state.pageNum);

    drawSectionHeader(doc, t('analysis', lang), state, countryName);

    if (data.analysis) {
      drawTextBlock(doc, data.analysis, state, countryName);
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Sources & References ────────────────────────────────────────────────
    ensureSpace(doc, 60, state, countryName);
    sectionPageMap.set(t('sources', lang), state.pageNum);

    drawSectionHeader(doc, t('sources', lang), state, countryName);

    if (data.sources && data.sources.length > 0) {
      const verifiedSources = data.sources.filter((s) => s.verified);
      const unverifiedSources = data.sources.filter((s) => !s.verified);

      if (verifiedSources.length > 0) {
        const verifiedLabel = lang === 'ar' ? `مصادر موثوقة (${verifiedSources.length})` : `Verified Sources (${verifiedSources.length})`;
        doc
          .fontSize(10)
          .fillColor(COLORS.green)
          .text(verifiedLabel, MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.y += 8;

        const sourceColumns: TableColumn[] = [
          { header: 'Source', width: 160 },
          { header: 'Domain', width: 120 },
          { header: 'Status', width: 65, align: 'center' },
          { header: 'URL', width: CONTENT_WIDTH - 345 },
        ];

        const sourceRows = verifiedSources.map((s) => [
          s.label,
          s.domain,
          lang === 'ar' ? 'موثوق' : 'Verified',
          s.url && s.url.length > 40 ? s.url.substring(0, 37) + '...' : s.url || '',
        ]);

        drawTable(doc, sourceColumns, sourceRows, state, countryName);
      }

      if (unverifiedSources.length > 0) {
        ensureSpace(doc, 60, state, countryName);
        const unverifiedLabel = lang === 'ar' ? `مصادر غير موثقة (${unverifiedSources.length})` : `Unverified Sources (${unverifiedSources.length})`;
        doc
          .fontSize(10)
          .fillColor(COLORS.red)
          .text(unverifiedLabel, MARGIN, doc.y, { width: CONTENT_WIDTH });
        doc.y += 8;

        const sourceColumns: TableColumn[] = [
          { header: 'Source', width: 160 },
          { header: 'Domain', width: 120 },
          { header: 'Status', width: 65, align: 'center' },
          { header: 'URL', width: CONTENT_WIDTH - 345 },
        ];

        const sourceRows = unverifiedSources.map((s) => [
          s.label,
          s.domain,
          lang === 'ar' ? 'غير موثوق' : 'Unverified',
          s.url && s.url.length > 40 ? s.url.substring(0, 37) + '...' : s.url || '',
        ]);

        drawTable(doc, sourceColumns, sourceRows, state, countryName);
      }
    } else {
      doc
        .fontSize(9)
        .fillColor(COLORS.mediumGray)
        .text(t('noData', lang), MARGIN, doc.y, { width: CONTENT_WIDTH });
      doc.y += 14;
    }

    // ── Now go back and fill in TOC ────────────────────────────────────────
    doc.switchToPage(1);
    doc.y = MARGIN;
    addHeader(doc, countryName, lang);

    const tocEntries = tocSections.map((title) => ({
      title,
      page: sectionPageMap.get(title) || 2,
    }));

    drawTableOfContents(doc, tocEntries, lang);

    // ── Add footers to all non-cover pages ──────────────────────────────────
    addFooters(doc, lang);

    // Finalize
    doc.end();
  });
}

// ─── API Route Handler ────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: ReportData = await request.json();

    // Validate required fields
    if (!body.role || !body.country) {
      return Response.json(
        { error: 'Missing required fields: role and country are required.' },
        { status: 400 }
      );
    }

    if (!ROLE_CONFIG[body.role]) {
      return Response.json(
        { error: `Invalid role: "${body.role}". Must be one of: ${Object.keys(ROLE_CONFIG).join(', ')}` },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfBuffer = await generatePDF(body);

    // Build filename
    const dateSlug = new Date(body.generated_at || Date.now())
      .toISOString()
      .split('T')[0];
    const filename = `MOEI-Report-${body.role}-${body.country}-${dateSlug}`;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error('[PDF Export] Error generating PDF:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({ error: 'Failed to generate PDF', details: msg }, { status: 500 });
  }
}
