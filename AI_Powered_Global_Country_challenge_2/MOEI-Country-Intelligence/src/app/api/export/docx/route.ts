import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  PageBreak,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
} from "docx";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface TradeGoods {
  name: string;
  value: number;
  code: string;
  share_pct: number;
}

interface TradeData {
  year: number;
  export_partners: TradePartner[];
  import_partners: TradePartner[];
  export_goods: TradeGoods[];
  import_goods: TradeGoods[];
}

interface SectorItem {
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

interface CoverageData {
  found: number;
  total: number;
  pct: number;
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
  sectors: SectorItem[];
  energy: SectorItem[];
  uae: SectorItem[];
  read: string | null;
  analysis: string | null;
  insights: InsightItem[];
  risks: InsightItem[];
  opportunities: InsightItem[];
  coverage: CoverageData;
  sources?: SourceItem[];
  fields?: FieldItem[];
}

// ─── Color Palette ───────────────────────────────────────────────────────────

const COLORS = {
  primaryGold: "9C7A2D",
  teal: "2C7A6B",
  lightGold: "C9A84C",
  red: "A6492F",
  green: "3D9985",
  white: "FFFFFF",
  black: "000000",
  lightGray: "F2F2F2",
  mediumGray: "999999",
  darkGray: "333333",
  coverBg: "1A3C34",
  coverAccent: "9C7A2D",
  barBg: "E0E0E0",
} as const;

const CHART_COLORS = [
  COLORS.teal, COLORS.primaryGold, COLORS.lightGold, COLORS.red,
  COLORS.green, "64748B", "E8D5A0", "94A3B8",
];

// ─── Language / RTL Support ──────────────────────────────────────────────────

type Lang = "en" | "ar";

const SECTION_LABELS: Record<string, Record<Lang, string>> = {
  executiveSummary: { en: "Executive Summary", ar: "الملخص التنفيذي" },
  kpis: { en: "Key Performance Indicators", ar: "مؤشرات الأداء الرئيسية" },
  trajectory: { en: "Trajectory", ar: "الاتجاهات" },
  trade: { en: "Trade & Commerce", ar: "التجارة والاقتصاد" },
  exportPartners: { en: "Export Partners", ar: "شركاء التصدير" },
  importPartners: { en: "Import Partners", ar: "شركاء الاستيراد" },
  exportGoods: { en: "Export Goods", ar: "السلع المصدرة" },
  importGoods: { en: "Import Goods", ar: "السلع المستوردة" },
  sectors: { en: "Sectors", ar: "القطاعات" },
  energy: { en: "Energy", ar: "الطاقة" },
  uae: { en: "UAE Bilateral Relations", ar: "العلاقات مع الإمارات" },
  insights: { en: "Insights", ar: "الرؤى" },
  risks: { en: "Risk Assessment", ar: "تقييم المخاطر" },
  opportunities: { en: "Opportunities", ar: "الفرص" },
  analysis: { en: "Analysis", ar: "التحليل" },
  sources: { en: "Sources", ar: "المصادر" },
  coverage: { en: "Data Coverage", ar: "تغطية البيانات" },
  kpiChart: { en: "KPI Comparison Chart", ar: "مخطط مقارنة المؤشرات" },
  sectorChart: { en: "Sector Distribution", ar: "توزيع القطاعات" },
  energyChart: { en: "Energy Mix", ar: "مزيج الطاقة" },
  riskChart: { en: "Risk Severity", ar: "شدة المخاطر" },
  oppChart: { en: "Opportunity Impact", ar: "تأثير الفرص" },
  tradeChart: { en: "Trade Partner Shares", ar: "حصص شركاء التجارة" },
  noData: { en: "No data available.", ar: "لا تتوفر بيانات." },
};

function t(key: string, lang: Lang): string {
  return SECTION_LABELS[key]?.[lang] || SECTION_LABELS[key]?.en || key;
}

// ─── Role Configuration ──────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  string,
  { title: string; classification: string }
> = {
  minister: {
    title: "Ministerial Strategic Brief",
    classification: "CABINET-LEVEL",
  },
  deputy: {
    title: "Deputy Minister Operational Review",
    classification: "SENIOR OFFICIAL",
  },
  client: {
    title: "Investment Intelligence Brief",
    classification: "CONFIDENTIAL",
  },
  manager: {
    title: "Departmental Performance Report",
    classification: "INTERNAL",
  },
  team: {
    title: "Analytical Data Report",
    classification: "ANALYTICAL",
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .replace(/^[-*+]\s+/gm, "  \u2022 ")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/---+/g, "")
    .trim();
}

function getTrendIndicator(trend?: TrendData): {
  symbol: string;
  color: string;
} {
  if (!trend) return { symbol: "\u25CF", color: COLORS.mediumGray };
  if (trend.direction === "up") {
    return {
      symbol: "\u25B2",
      color: trend.good_up ? COLORS.green : COLORS.red,
    };
  }
  if (trend.direction === "down") {
    return {
      symbol: "\u25BC",
      color: trend.good_up ? COLORS.red : COLORS.green,
    };
  }
  return { symbol: "\u25CF", color: COLORS.mediumGray };
}

function formatTrendText(trend?: TrendData): string {
  if (!trend) return "";
  const parts: string[] = [];
  if (trend.change_pct !== undefined && trend.change_pct !== null) {
    parts.push(`Change: ${trend.change_pct > 0 ? "+" : ""}${trend.change_pct.toFixed(1)}%`);
  }
  if (trend.cagr_pct !== undefined && trend.cagr_pct !== null) {
    parts.push(`CAGR: ${trend.cagr_pct.toFixed(1)}%`);
  }
  return parts.length > 0 ? ` (${parts.join(" | ")})` : "";
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
};

function createHeaderCell(text: string, width?: number): TableCell {
  return new TableCell({
    width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: COLORS.teal, type: ShadingType.CLEAR },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.teal },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.teal },
      left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.teal },
      right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.teal },
    },
    children: [
      new Paragraph({
        spacing: { before: 50, after: 50 },
        children: [
          new TextRun({
            text,
            bold: true,
            color: COLORS.white,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function createDataCell(
  text: string,
  rowIndex: number,
  options?: {
    bold?: boolean;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  }
): TableCell {
  const fill = rowIndex % 2 === 0 ? COLORS.white : COLORS.lightGray;
  return new TableCell({
    shading: { fill, type: ShadingType.CLEAR },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
    children: [
      new Paragraph({
        alignment: options?.alignment ?? AlignmentType.LEFT,
        spacing: { before: 45, after: 45 },
        children: [
          new TextRun({
            text: text.length > 80 ? text.substring(0, 77) + "..." : text,
            bold: options?.bold ?? false,
            color: options?.color ?? COLORS.darkGray,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
    ],
  });
}

function createSectionHeading(text: string, lang: Lang = "en"): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 240 },
    bidirectional: lang === "ar" ? true : undefined,
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        color: COLORS.teal,
        size: 32,
        font: "Calibri",
      }),
    ],
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.primaryGold },
    },
  });
}

function createSubHeading(text: string, lang: Lang = "en"): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    bidirectional: lang === "ar" ? true : undefined,
    children: [
      new TextRun({
        text,
        bold: true,
        color: COLORS.teal,
        size: 26,
        font: "Calibri",
      }),
    ],
  });
}

function createBodyParagraph(text: string, lang: Lang = "en"): Paragraph {
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 340 },
    bidirectional: lang === "ar" ? true : undefined,
    alignment: lang === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    children: [
      new TextRun({
        text: stripMarkdown(text),
        size: 22,
        color: COLORS.darkGray,
        font: "Calibri",
      }),
    ],
  });
}

function createMultiLineParagraph(rawText: string, lang: Lang = "en"): Paragraph[] {
  const lines = stripMarkdown(rawText).split("\n").filter(Boolean);
  return lines.map(
    (line) =>
      new Paragraph({
        spacing: { before: 60, after: 60, line: 340 },
        bidirectional: lang === "ar" ? true : undefined,
        alignment: lang === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: [
          new TextRun({
            text: line.trim(),
            size: 22,
            color: COLORS.darkGray,
            font: "Calibri",
          }),
        ],
      })
  );
}

// ─── Bar Chart Table (visual chart using table cells) ────────────────────────

function createBarChartTable(
  items: Array<{ label: string; value: number; pct: number }>,
  title: string,
  barColor: string = COLORS.teal,
  maxPct: number = 100,
  lang: Lang = "en"
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSubHeading(title, lang));

  if (items.length === 0) return elements;

  items.forEach((item, idx) => {
    const barWidth = Math.round((item.pct / maxPct) * 60);
    const emptyWidth = 60 - barWidth;
    const fillColor = CHART_COLORS[idx % CHART_COLORS.length] || barColor;

    const row = new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            bidirectional: lang === "ar" ? true : undefined,
            alignment: lang === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
            children: [new TextRun({ text: item.label, size: 18, font: "Calibri", bold: true, color: COLORS.darkGray })],
          })],
        }),
        new TableCell({
          width: { size: 52, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: "\u2588".repeat(barWidth), size: 14, font: "Calibri", color: fillColor }),
              new TextRun({ text: "\u2591".repeat(emptyWidth), size: 14, font: "Calibri", color: COLORS.barBg }),
            ],
          })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: `${item.pct.toFixed(1)}%`, size: 18, font: "Calibri", bold: true, color: COLORS.darkGray })],
          })],
        }),
      ],
    });

    elements.push(new Table({
      rows: [row],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  });

  // Spacer
  elements.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }));

  return elements;
}

// ─── Donut-style Chart (using colored blocks as a legend-only visual) ────────

function createDonutLegendTable(
  items: Array<{ label: string; value: number }>,
  title: string,
  lang: Lang = "en"
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSubHeading(title, lang));

  if (items.length === 0) return elements;

  const total = items.reduce((s, d) => s + d.value, 0);
  if (total === 0) return elements;

  // Create a visual legend table with colored squares and percentages
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("", 8),
      createHeaderCell(lang === "ar" ? "القسم" : "Category", 42),
      createHeaderCell(lang === "ar" ? "القيمة" : "Value", 25),
      createHeaderCell(lang === "ar" ? "النسبة" : "Share", 25),
    ],
  });

  const dataRows = items.map((item, idx) => {
    const pct = ((item.value / total) * 100).toFixed(1);
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    return new TableRow({
      children: [
        // Color swatch cell
        new TableCell({
          width: { size: 8, type: WidthType.PERCENTAGE },
          shading: { fill: color, type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
          },
          children: [new Paragraph({
            spacing: { before: 45, after: 45 },
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: " ", size: 18, font: "Calibri" })],
          })],
        }),
        createDataCell(item.label, idx, { bold: true }),
        createDataCell(
          typeof item.value === "number" ? item.value.toLocaleString("en-US") : String(item.value),
          idx,
          { alignment: AlignmentType.RIGHT }
        ),
        createDataCell(`${pct}%`, idx, { alignment: AlignmentType.CENTER, color: COLORS.teal }),
      ],
    });
  });

  elements.push(new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  // Spacer
  elements.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }));

  return elements;
}

// ─── Risk/Opportunity Severity Bars ──────────────────────────────────────────

function createSeverityBarTable(
  items: InsightItem[],
  title: string,
  barColor: string = COLORS.red,
  lang: Lang = "en"
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSubHeading(title, lang));

  if (items.length === 0) return elements;

  items.forEach((item, idx) => {
    const severity = Math.min(item.content.length / 200, 1);
    const barWidth = Math.round(severity * 60);
    const emptyWidth = 60 - barWidth;
    const severityLabel = severity > 0.7
      ? (lang === "ar" ? "مرتفع" : "High")
      : severity > 0.4
        ? (lang === "ar" ? "متوسط" : "Medium")
        : (lang === "ar" ? "منخفض" : "Low");

    const row = new TableRow({
      children: [
        new TableCell({
          width: { size: 35, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: item.title, size: 18, font: "Calibri", bold: true, color: COLORS.darkGray })],
          })],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({ text: "\u2588".repeat(barWidth), size: 14, font: "Calibri", color: barColor }),
              new TextRun({ text: "\u2591".repeat(emptyWidth), size: 14, font: "Calibri", color: COLORS.barBg }),
            ],
          })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          shading: { fill: idx % 2 === 0 ? COLORS.white : COLORS.lightGray, type: ShadingType.CLEAR },
          borders: NO_BORDERS,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: severityLabel, size: 18, font: "Calibri", bold: true, color: barColor })],
          })],
        }),
      ],
    });

    elements.push(new Table({
      rows: [row],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }));
  });

  elements.push(new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }));

  return elements;
}

// ─── Cover Page Builder ──────────────────────────────────────────────────────

function buildCoverSection(data: ReportData, lang: Lang): object {
  const roleConfig = ROLE_CONFIG[data.role] || ROLE_CONFIG.team;
  const countryName = data.country_name || data.country;
  const dateStr = new Date(data.generated_at).toLocaleDateString(
    lang === "ar" ? "ar-AE" : "en-GB",
    { day: "numeric", month: "long", year: "numeric" }
  );

  const ministryText = lang === "ar" ? "وزارة الطاقة والبنية التحتية" : "MINISTRY OF ECONOMY & INDUSTRY";
  const platformText = lang === "ar" ? "منصة استخبارات الدول" : "Country Intelligence Platform";
  const dateLabel = lang === "ar" ? "التاريخ" : "Date";
  const codeLabel = lang === "ar" ? "رمز الدولة" : "Country Code";

  return {
    properties: {
      page: {
        margin: { top: 0, bottom: 0, left: 0, right: 0 },
        size: { width: 11906, height: 16838 },
      },
    },
    children: [
      // Top spacer
      ...Array(6).fill(
        new Paragraph({ spacing: { before: 200 }, children: [] })
      ),
      // MOEI branding line
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 100 },
        bidirectional: lang === "ar" ? true : undefined,
        children: [
          new TextRun({
            text: ministryText,
            bold: true,
            color: COLORS.primaryGold,
            size: 24,
            font: "Calibri",
            allCaps: lang === "ar" ? false : true,
          }),
        ],
      }),
      // Separator
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: "\u2500".repeat(30),
            color: COLORS.primaryGold,
            size: 20,
            font: "Calibri",
          }),
        ],
      }),
      // Platform name
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 200 },
        bidirectional: lang === "ar" ? true : undefined,
        children: [
          new TextRun({
            text: platformText,
            bold: true,
            color: COLORS.teal,
            size: 40,
            font: "Calibri",
          }),
        ],
      }),
      // Country name
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 300, after: 100 },
        children: [
          new TextRun({
            text: countryName.toUpperCase(),
            bold: true,
            color: COLORS.teal,
            size: 56,
            font: "Calibri",
          }),
        ],
      }),
      // Role-specific title
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 100 },
        bidirectional: lang === "ar" ? true : undefined,
        children: [
          new TextRun({
            text: roleConfig.title,
            color: COLORS.primaryGold,
            size: 28,
            font: "Calibri",
          }),
        ],
      }),
      // Classification badge
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 100 },
        border: {
          top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.red },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.red },
          left: { style: BorderStyle.SINGLE, size: 2, color: COLORS.red },
          right: { style: BorderStyle.SINGLE, size: 2, color: COLORS.red },
        },
        children: [
          new TextRun({
            text: `  ${roleConfig.classification}  `,
            bold: true,
            color: COLORS.red,
            size: 22,
            font: "Calibri",
          }),
        ],
      }),
      // Date
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 600, after: 100 },
        bidirectional: lang === "ar" ? true : undefined,
        children: [
          new TextRun({
            text: `${dateLabel}: ${dateStr}`,
            color: COLORS.darkGray,
            size: 22,
            font: "Calibri",
          }),
        ],
      }),
      // ISO code
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40 },
        bidirectional: lang === "ar" ? true : undefined,
        children: [
          new TextRun({
            text: `${codeLabel}: ${data.country}`,
            color: COLORS.mediumGray,
            size: 18,
            font: "Calibri",
          }),
        ],
      }),
    ],
  };
}

// ─── KPI Table ───────────────────────────────────────────────────────────────

function buildKPITable(headline: HeadlineItem[], lang: Lang): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(t("kpis", lang), lang));

  if (headline.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("Metric", 26),
      createHeaderCell("Value", 16),
      createHeaderCell("Unit", 10),
      createHeaderCell("Trend", 16),
      createHeaderCell("Source", 32),
    ],
  });

  const dataRows = headline.map(
    (item, idx) =>
      new TableRow({
        children: [
          createDataCell(item.key, idx, { bold: true }),
          createDataCell(item.display, idx, {
            alignment: AlignmentType.CENTER,
          }),
          createDataCell(item.unit, idx, { alignment: AlignmentType.CENTER }),
          (() => {
            const indicator = getTrendIndicator(item.trend);
            const trendText =
              indicator.symbol + formatTrendText(item.trend);
            return createDataCell(trendText, idx, {
              color: indicator.color,
              alignment: AlignmentType.CENTER,
            });
          })(),
          createDataCell(item.source, idx),
        ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  // ── KPI Bar Chart ──────────────────────────────────────────────────────
  const kpiChartData = headline.slice(0, 8).map(item => {
    const numVal = parseFloat(String(item.display).replace(/[^0-9.-]/g, ""));
    return {
      label: item.key || item.display,
      value: isNaN(numVal) ? 0 : Math.abs(numVal),
      pct: 0,
    };
  }).filter(d => d.value > 0);

  if (kpiChartData.length > 0) {
    const maxVal = Math.max(...kpiChartData.map(d => d.value), 1);
    kpiChartData.forEach(d => { d.pct = (d.value / maxVal) * 100; });
    elements.push(...createBarChartTable(kpiChartData, t("kpiChart", lang), COLORS.teal, 100, lang));
  }

  return elements;
}

// ─── Trade Section ───────────────────────────────────────────────────────────

function buildTradePartnerTable(
  partners: TradePartner[],
  title: string,
  lang: Lang
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSubHeading(title, lang));

  if (partners.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("Partner", 35),
      createHeaderCell("Value (USD)", 25),
      createHeaderCell("Code", 15),
      createHeaderCell("Share %", 25),
    ],
  });

  const dataRows = partners.map(
    (p, idx) =>
      new TableRow({
        children: [
          createDataCell(p.name, idx, { bold: true }),
          createDataCell(
            typeof p.value === "number"
              ? p.value.toLocaleString("en-US")
              : String(p.value),
            idx,
            { alignment: AlignmentType.RIGHT }
          ),
          createDataCell(p.code, idx, { alignment: AlignmentType.CENTER }),
          createDataCell(
            typeof p.share_pct === "number"
              ? `${p.share_pct.toFixed(1)}%`
              : String(p.share_pct),
            idx,
            { alignment: AlignmentType.CENTER }
          ),
        ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

function buildTradeGoodsTable(
  goods: TradeGoods[],
  title: string,
  lang: Lang
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSubHeading(title, lang));

  if (goods.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("Commodity", 35),
      createHeaderCell("Value (USD)", 25),
      createHeaderCell("Code", 15),
      createHeaderCell("Share %", 25),
    ],
  });

  const dataRows = goods.map(
    (g, idx) =>
      new TableRow({
        children: [
          createDataCell(g.name, idx, { bold: true }),
          createDataCell(
            typeof g.value === "number"
              ? g.value.toLocaleString("en-US")
              : String(g.value),
            idx,
            { alignment: AlignmentType.RIGHT }
          ),
          createDataCell(g.code, idx, { alignment: AlignmentType.CENTER }),
          createDataCell(
            typeof g.share_pct === "number"
              ? `${g.share_pct.toFixed(1)}%`
              : String(g.share_pct),
            idx,
            { alignment: AlignmentType.CENTER }
          ),
        ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

function buildTradeSection(trade: TradeData | null, lang: Lang): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(t("trade", lang), lang));

  if (!trade) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  elements.push(
    createBodyParagraph(`${lang === "ar" ? "سنة المرجع" : "Reference Year"}: ${trade.year}`, lang)
  );

  elements.push(...buildTradePartnerTable(trade.export_partners, t("exportPartners", lang), lang));

  // Export partners bar chart
  if (trade.export_partners.length > 0) {
    const maxPct = Math.max(...trade.export_partners.map(p => p.share_pct), 1);
    const exportChartData = trade.export_partners.slice(0, 6).map(p => ({
      label: p.name,
      value: p.share_pct,
      pct: p.share_pct,
    }));
    elements.push(...createBarChartTable(exportChartData, `${t("exportPartners", lang)} - ${lang === "ar" ? "حصص" : "Shares"}`, COLORS.primaryGold, maxPct, lang));
  }

  elements.push(...buildTradePartnerTable(trade.import_partners, t("importPartners", lang), lang));

  // Import partners bar chart
  if (trade.import_partners.length > 0) {
    const maxPct = Math.max(...trade.import_partners.map(p => p.share_pct), 1);
    const importChartData = trade.import_partners.slice(0, 6).map(p => ({
      label: p.name,
      value: p.share_pct,
      pct: p.share_pct,
    }));
    elements.push(...createBarChartTable(importChartData, `${t("importPartners", lang)} - ${lang === "ar" ? "حصص" : "Shares"}`, COLORS.teal, maxPct, lang));
  }

  elements.push(...buildTradeGoodsTable(trade.export_goods, t("exportGoods", lang), lang));
  elements.push(...buildTradeGoodsTable(trade.import_goods, t("importGoods", lang), lang));

  return elements;
}

// ─── Generic Data Table (Sectors, Energy, UAE) ──────────────────────────────

function buildGenericTable(
  items: SectorItem[],
  sectionTitle: string,
  showSource: boolean = false,
  lang: Lang = "en"
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(sectionTitle, lang));

  if (items.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  const headerChildren = showSource
    ? [
        createHeaderCell("Metric", 28),
        createHeaderCell("Value", 22),
        createHeaderCell("Unit", 15),
        createHeaderCell("Source", 35),
      ]
    : [
        createHeaderCell("Metric", 35),
        createHeaderCell("Value", 30),
        createHeaderCell("Unit", 35),
      ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerChildren,
  });

  const dataRows = items.map(
    (item, idx) =>
      new TableRow({
        children: showSource
          ? [
              createDataCell(item.key, idx, { bold: true }),
              createDataCell(item.display, idx, {
                alignment: AlignmentType.CENTER,
              }),
              createDataCell(item.unit || "\u2014", idx, {
                alignment: AlignmentType.CENTER,
              }),
              createDataCell(item.source || "\u2014", idx),
            ]
          : [
              createDataCell(item.key, idx, { bold: true }),
              createDataCell(item.display, idx, {
                alignment: AlignmentType.CENTER,
              }),
              createDataCell(item.unit || "\u2014", idx, {
                alignment: AlignmentType.CENTER,
              }),
            ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

// ─── Insights / Risks / Opportunities ───────────────────────────────────────

function buildInsightItems(
  items: InsightItem[],
  sectionTitle: string,
  borderColor?: string,
  lang: Lang = "en"
): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(sectionTitle, lang));

  if (items.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  items.forEach((item, idx) => {
    elements.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 100 },
        bidirectional: lang === "ar" ? true : undefined,
        alignment: lang === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
        ...(borderColor
          ? {
              border: {
                left: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: borderColor,
                },
              },
              indent: { left: 200 },
            }
          : {}),
        children: [
          new TextRun({
            text: `${idx + 1}. ${item.title}`,
            bold: true,
            color: COLORS.teal,
            size: 24,
            font: "Calibri",
          }),
        ],
      })
    );

    const contentLines = stripMarkdown(item.content)
      .split("\n")
      .filter(Boolean);
    contentLines.forEach((line) => {
      elements.push(
        new Paragraph({
          spacing: { before: 50, after: 50, line: 340 },
          bidirectional: lang === "ar" ? true : undefined,
          alignment: lang === "ar" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          ...(borderColor
            ? {
                border: {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: borderColor,
                  },
                },
                indent: { left: 200 },
              }
            : {}),
          children: [
            new TextRun({
              text: line.trim(),
              size: 22,
              color: COLORS.darkGray,
              font: "Calibri",
            }),
          ],
        })
      );
    });
  });

  return elements;
}

// ─── Analysis Section ────────────────────────────────────────────────────────

function buildAnalysisSection(analysis: string | null, lang: Lang): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(t("analysis", lang), lang));

  if (!analysis) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  elements.push(...createMultiLineParagraph(analysis, lang));
  return elements;
}

// ─── Sources Section ─────────────────────────────────────────────────────────

function buildSourcesSection(sources: SourceItem[] | undefined, lang: Lang): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(t("sources", lang), lang));

  if (!sources || sources.length === 0) {
    elements.push(createBodyParagraph(t("noData", lang), lang));
    return elements;
  }

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("Domain", 25),
      createHeaderCell("Label", 30),
      createHeaderCell("URL", 30),
      createHeaderCell("Verified", 15),
    ],
  });

  const dataRows = sources.map(
    (s, idx) =>
      new TableRow({
        children: [
          createDataCell(s.domain, idx, { bold: true }),
          createDataCell(s.label, idx),
          createDataCell(
            s.url.length > 60 ? s.url.substring(0, 57) + "..." : s.url,
            idx
          ),
          createDataCell(
            s.verified
              ? (lang === "ar" ? "\u2713 نعم" : "\u2713 Yes")
              : (lang === "ar" ? "\u2717 لا" : "\u2717 No"),
            idx,
            {
              color: s.verified ? COLORS.green : COLORS.red,
              alignment: AlignmentType.CENTER,
            }
          ),
        ],
      })
  );

  elements.push(
    new Table({
      rows: [headerRow, ...dataRows],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

// ─── Coverage Badge ─────────────────────────────────────────────────────────

function buildCoverageSection(coverage: CoverageData, lang: Lang): Paragraph[] {
  const elements: Paragraph[] = [];
  elements.push(createSectionHeading(t("coverage", lang), lang));

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createHeaderCell("Metric", 34),
      createHeaderCell("Value", 22),
      createHeaderCell("Metric", 22),
      createHeaderCell("Value", 22),
    ],
  });

  const dataRow = new TableRow({
    children: [
      createDataCell(lang === "ar" ? "المؤشرات الموجودة" : "Indicators Found", 0, { bold: true }),
      createDataCell(String(coverage.found), 0, {
        alignment: AlignmentType.CENTER,
      }),
      createDataCell(lang === "ar" ? "إجمالي المؤشرات" : "Total Indicators", 0, { bold: true }),
      createDataCell(String(coverage.total), 0, {
        alignment: AlignmentType.CENTER,
      }),
    ],
  });

  const pctRow = new TableRow({
    children: [
      createDataCell(lang === "ar" ? "نسبة التغطية" : "Coverage Percentage", 1, { bold: true }),
      createDataCell(`${coverage.pct.toFixed(1)}%`, 1, {
        bold: true,
        color:
          coverage.pct >= 80
            ? COLORS.green
            : coverage.pct >= 50
              ? COLORS.primaryGold
              : COLORS.red,
        alignment: AlignmentType.CENTER,
      }),
      createDataCell("", 1),
      createDataCell("", 1),
    ],
  });

  elements.push(
    new Table({
      rows: [headerRow, dataRow, pctRow],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  );

  return elements;
}

// ─── Main Document Builder ───────────────────────────────────────────────────

function buildDocument(data: ReportData): Document {
  const lang: Lang = data.lang === "ar" ? "ar" : "en";
  const coverSection = buildCoverSection(data, lang);

  // Build body content
  const bodyChildren: Paragraph[] = [];

  // Page break to start fresh after cover
  bodyChildren.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  // Table of Contents
  const tocTitle = lang === "ar" ? "جدول المحتويات" : "TABLE OF CONTENTS";
  bodyChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 200, after: 200 },
      bidirectional: lang === "ar" ? true : undefined,
      children: [
        new TextRun({
          text: tocTitle,
          bold: true,
          color: COLORS.teal,
          size: 32,
          font: "Calibri",
        }),
      ],
      border: {
        bottom: {
          style: BorderStyle.SINGLE,
          size: 2,
          color: COLORS.primaryGold,
        },
      },
    })
  );

  bodyChildren.push(
    new TableOfContents("Table of Contents", {
      hyperlink: true,
      headingStyleRange: "1-2",
    })
  );

  // Executive Summary
  bodyChildren.push(createSectionHeading(t("executiveSummary", lang), lang));
  if (data.read) {
    bodyChildren.push(...createMultiLineParagraph(data.read, lang));
  } else {
    bodyChildren.push(createBodyParagraph(t("noData", lang), lang));
  }

  // KPI
  bodyChildren.push(...buildKPITable(data.headline, lang));

  // Trajectory (if present)
  if (data.trajectory && data.trajectory.length > 0) {
    bodyChildren.push(createSectionHeading(t("trajectory", lang), lang));
    const tHeaderRow = new TableRow({
      tableHeader: true,
      children: [
        createHeaderCell("Indicator", 28),
        createHeaderCell("Latest", 15),
        createHeaderCell("Year", 12),
        createHeaderCell("Unit", 13),
        createHeaderCell("Direction", 15),
        createHeaderCell("Display", 17),
      ],
    });
    const tDataRows = data.trajectory.map(
      (t, idx) =>
        new TableRow({
          children: [
            createDataCell(t.key, idx, { bold: true }),
            createDataCell(
              typeof t.latest === "number"
                ? t.latest.toLocaleString("en-US")
                : String(t.latest),
              idx,
              { alignment: AlignmentType.RIGHT }
            ),
            createDataCell(String(t.latest_year), idx, {
              alignment: AlignmentType.CENTER,
            }),
            createDataCell(t.unit, idx, { alignment: AlignmentType.CENTER }),
            (() => {
              const isUp = t.direction === "up";
              const isGood =
                (t.good_up && isUp) || (!t.good_up && !isUp);
              return createDataCell(
                isUp ? "\u25B2 Up" : "\u25BC Down",
                idx,
                {
                  color: isGood ? COLORS.green : COLORS.red,
                  alignment: AlignmentType.CENTER,
                }
              );
            })(),
            createDataCell(t.display, idx),
          ],
        })
    );
    bodyChildren.push(
      new Table({
        rows: [tHeaderRow, ...tDataRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    );
  }

  // Trade
  bodyChildren.push(...buildTradeSection(data.trade, lang));

  // Sectors
  bodyChildren.push(...buildGenericTable(data.sectors, t("sectors", lang), true, lang));

  // Sector distribution chart
  if (data.sectors.length > 0) {
    const sectorChartData = data.sectors.map(s => {
      const numVal = typeof s.value === "number" ? s.value : parseFloat(String(s.value).replace(/[^0-9.-]/g, ""));
      return { label: s.key, value: isNaN(numVal) ? 0 : Math.abs(numVal) };
    }).filter(d => d.value > 0);
    bodyChildren.push(...createDonutLegendTable(sectorChartData, t("sectorChart", lang), lang));
  }

  // Energy
  bodyChildren.push(...buildGenericTable(data.energy, t("energy", lang), true, lang));

  // Energy mix chart
  if (data.energy.length > 0) {
    const energyChartData = data.energy.map(e => {
      const numVal = typeof e.value === "number" ? e.value : parseFloat(String(e.value).replace(/[^0-9.-]/g, ""));
      return { label: e.key, value: isNaN(numVal) ? 0 : Math.abs(numVal) };
    }).filter(d => d.value > 0);
    bodyChildren.push(...createDonutLegendTable(energyChartData, t("energyChart", lang), lang));
  }

  // UAE Relations
  bodyChildren.push(
    ...buildGenericTable(data.uae, t("uae", lang), true, lang)
  );

  // Insights
  bodyChildren.push(...buildInsightItems(data.insights, t("insights", lang), undefined, lang));

  // Risks (with red left border)
  bodyChildren.push(
    ...buildInsightItems(data.risks, t("risks", lang), COLORS.red, lang)
  );

  // Risk severity chart
  if (data.risks.length > 0) {
    bodyChildren.push(...createSeverityBarTable(data.risks, t("riskChart", lang), COLORS.red, lang));
  }

  // Opportunities (with green left border)
  bodyChildren.push(
    ...buildInsightItems(
      data.opportunities,
      t("opportunities", lang),
      COLORS.green,
      lang
    )
  );

  // Opportunity impact chart
  if (data.opportunities.length > 0) {
    bodyChildren.push(...createSeverityBarTable(data.opportunities, t("oppChart", lang), COLORS.green, lang));
  }

  // Analysis
  bodyChildren.push(...buildAnalysisSection(data.analysis, lang));

  // Sources
  bodyChildren.push(...buildSourcesSection(data.sources, lang));

  // Coverage
  bodyChildren.push(...buildCoverageSection(data.coverage, lang));

  // Disclaimer footer
  bodyChildren.push(
    new Paragraph({ spacing: { before: 600 }, children: [] })
  );

  const disclaimerText = lang === "ar"
    ? "تم إنشاء هذا المستند بواسطة منصة استخبارات الدول. البيانات مأخوذة من مجموعات بيانات متاحة للجمهور واستخبارات موثقة. ينطبق مستوى التصنيف على المستند بالكامل."
    : "This document is generated by the MOEI Country Intelligence Platform. Data is sourced from publicly available datasets and verified intelligence. Classification level applies to the entire document.";

  bodyChildren.push(
    new Paragraph({
      spacing: { before: 100, after: 40 },
      bidirectional: lang === "ar" ? true : undefined,
      border: {
        top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.primaryGold },
      },
      children: [
        new TextRun({
          text: disclaimerText,
          italics: true,
          color: COLORS.mediumGray,
          size: 16,
          font: "Calibri",
        }),
      ],
    })
  );

  const headerText = lang === "ar"
    ? "منصة استخبارات الدول"
    : "MOEI Country Intelligence Platform";

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22,
            color: COLORS.darkGray,
          },
          paragraph: {
            spacing: { line: 340 },
          },
        },
        heading1: {
          run: {
            font: "Calibri",
            size: 32,
            bold: true,
            color: COLORS.teal,
          },
          paragraph: {
            spacing: { before: 400, after: 240 },
          },
        },
        heading2: {
          run: {
            font: "Calibri",
            size: 26,
            bold: true,
            color: COLORS.teal,
          },
          paragraph: {
            spacing: { before: 280, after: 140 },
          },
        },
      },
    },
    sections: [
      coverSection as ReturnType<typeof Document.prototype.constructor> extends {
        sections: (infer S)[];
      }
        ? S
        : never,
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1200,
              right: 1200,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: lang === "ar" ? AlignmentType.LEFT : AlignmentType.RIGHT,
                bidirectional: lang === "ar" ? true : undefined,
                children: [
                  new TextRun({
                    text: headerText,
                    italics: true,
                    color: COLORS.primaryGold,
                    size: 16,
                    font: "Calibri",
                  }),
                  new TextRun({
                    text: `  |  ${
                      data.country_name || data.country
                    }`,
                    color: COLORS.mediumGray,
                    size: 16,
                    font: "Calibri",
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: lang === "ar" ? "صفحة " : "Page ",
                    color: COLORS.mediumGray,
                    size: 16,
                    font: "Calibri",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    color: COLORS.mediumGray,
                    size: 16,
                    font: "Calibri",
                  }),
                  new TextRun({
                    text: lang === "ar" ? " من " : " of ",
                    color: COLORS.mediumGray,
                    size: 16,
                    font: "Calibri",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    color: COLORS.mediumGray,
                    size: 16,
                    font: "Calibri",
                  }),
                ],
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 1,
                    color: COLORS.primaryGold,
                  },
                },
              }),
            ],
          }),
        },
        children: bodyChildren,
      },
    ],
  });

  return doc;
}

// ─── API Route Handler ───────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body: ReportData = await request.json();

    // Validate required fields
    if (!body.role || !body.country) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: role, country" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Build the document
    const doc = buildDocument(body);

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Generate filename
    const datePart = new Date(body.generated_at || Date.now())
      .toISOString()
      .split("T")[0];
    const filename = `MOEI-Report-${body.role}-${body.country}-${datePart}`;

    // Return as downloadable DOCX
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("DOCX export error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to generate DOCX report",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
