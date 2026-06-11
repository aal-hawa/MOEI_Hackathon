/* ───────────────────────────────────────────────────────────────
   MOEI Country Intelligence Platform – Export Utilities v2
   Premium export system with inline SVG charts, markdown rendering,
   source links with whitelist/blacklist blocks, and format-specific
   designs for PDF, HTML, Print, and JSON.
   Full Arabic RTL support.
   ─────────────────────────────────────────────────────────────── */

import type { Language } from './types';

// ── Dynamic imports (client-only) ──────────────────────────────

async function loadHtml2Canvas() {
  const mod = await import('html2canvas');
  return mod.default;
}

async function loadJsPDF() {
  const mod = await import('jspdf');
  return mod.default;
}

// ── Helpers ────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-.]/g, '_').replace(/_+/g, '_');
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Report Data Type ──────────────────────────────────────────

interface SourceLink {
  label: string;
  url: string;
  domain: string;
  verified: boolean;
}

interface ReportData {
  role: string;
  country: string;
  country_name?: string;
  generated_at: string;
  headline: Array<{
    key: string;
    display: string;
    unit: string;
    as_of: string;
    source: string;
    trend?: {
      direction: string;
      good_up: boolean;
      change_pct?: number;
      cagr_pct?: number;
    };
  }>;
  trajectory: Array<{
    key: string;
    latest: number;
    latest_year: number;
    unit: string;
    direction: string;
    good_up: boolean;
    display: string;
    spark?: number[];
  }>;
  trade: {
    year: number;
    export_partners: Array<{ name: string; value: number; code: string; share_pct: number }>;
    import_partners: Array<{ name: string; value: number; code: string; share_pct: number }>;
    export_goods: Array<{ name: string; value: number; code: string; share_pct: number }>;
    import_goods: Array<{ name: string; value: number; code: string; share_pct: number }>;
  } | null;
  sectors: Array<{ key: string; value: string | number; unit?: string; display: string; source?: string }>;
  energy: Array<{ key: string; value: string | number; unit?: string; display: string; source?: string }>;
  uae: Array<{ key: string; value: string | number; unit?: string; display: string; source?: string }>;
  read: string | null;
  analysis: string | null;
  insights: Array<{ title: string; content: string }>;
  risks: Array<{ title: string; content: string }>;
  opportunities: Array<{ title: string; content: string }>;
  coverage: { found: number; total: number; pct: number };
  sources?: SourceLink[];
  fields?: Array<{
    field_name: string;
    domain: string;
    value: string | null;
    source_url: string | null;
    confidence: string;
    corroborated: number;
  }>;
}

// ── Role Display Names & Classifications ──────────────────────

const roleLabels: Record<string, { en: string; ar: string }> = {
  minister: { en: 'Ministerial Strategic Brief', ar: 'النشرة الاستراتيجية الوزارية' },
  deputy: { en: 'Deputy Minister Operational Review', ar: 'تقرير المراجعة التشغيلية لنائب الوزير' },
  client: { en: 'Investment Intelligence Brief', ar: 'نشرة الاستخبارات الاستثمارية' },
  manager: { en: 'Departmental Performance Report', ar: 'تقرير أداء القسم' },
  team: { en: 'Analytical Data Report', ar: 'التقرير التحليلي للبيانات' },
};

const roleClassifications: Record<string, { en: string; ar: string }> = {
  minister: { en: 'CABINET-LEVEL', ar: 'مستوى مجلس الوزراء' },
  deputy: { en: 'SENIOR OFFICIAL', ar: 'مسؤول أول' },
  client: { en: 'CONFIDENTIAL', ar: 'سري' },
  manager: { en: 'INTERNAL', ar: 'داخلي' },
  team: { en: 'ANALYTICAL', ar: 'تحليلي' },
};

// ══════════════════════════════════════════════════════════════
// SVG CHART GENERATORS (inline, no external deps)
// ══════════════════════════════════════════════════════════════

/** Generate an inline SVG horizontal bar chart */
function svgBarChart(
  items: Array<{ name: string; value: number; share_pct: number }>,
  options: {
    width?: number;
    barHeight?: number;
    gap?: number;
    color?: string;
    maxItems?: number;
    showValues?: boolean;
    isRTL?: boolean;
  } = {}
): string {
  const {
    width = 380,
    barHeight = 22,
    gap = 6,
    color = '#9C7A2D',
    maxItems = 6,
    showValues = true,
    isRTL = false,
  } = options;

  const data = items.slice(0, maxItems);
  if (data.length === 0) return '';

  const maxVal = Math.max(...data.map(d => d.value || d.share_pct));
  const labelWidth = 100;
  const valueWidth = showValues ? 60 : 0;
  const chartWidth = width - labelWidth - valueWidth - 20;
  const totalHeight = data.length * (barHeight + gap) + 10;

  const bars = data.map((d, i) => {
    const pct = maxVal > 0 ? (d.value || d.share_pct) / maxVal : 0;
    const barW = Math.max(pct * chartWidth, 2);
    const y = i * (barHeight + gap) + 5;
    const x = isRTL ? valueWidth + chartWidth - barW + 10 : labelWidth;
    const labelX = isRTL ? width - 8 : 8;
    const valueX = isRTL ? labelWidth - 5 : width - valueWidth + 5;
    const textAnchor = isRTL ? 'end' : 'start';

    // Truncate long labels for SVG rendering
    const maxLabelLen = 14;
    const truncatedName = d.name.length > maxLabelLen ? d.name.slice(0, maxLabelLen) + '…' : d.name;

    return `
      <text x="${labelX}" y="${y + barHeight / 2 + 4}" font-size="11" fill="#334155" font-family="Inter,-apple-system,sans-serif" text-anchor="${textAnchor}">${esc(truncatedName)}</text>
      <rect x="${isRTL ? x : labelWidth}" y="${y}" width="${barW}" height="${barHeight}" rx="3" fill="${color}" opacity="0.85"/>
      <rect x="${isRTL ? x : labelWidth}" y="${y}" width="${barW}" height="${barHeight / 2}" rx="3" fill="white" opacity="0.12"/>
      ${showValues ? `<text x="${valueX}" y="${y + barHeight / 2 + 4}" font-size="10" fill="#64748b" font-family="Inter,-apple-system,sans-serif" font-weight="600" text-anchor="${isRTL ? 'end' : 'start'}">${d.share_pct.toFixed(1)}%</text>` : ''}
    `;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">${bars}</svg>`;
}

/** Generate an inline SVG donut/pie chart */
function svgDonutChart(
  items: Array<{ name: string; value: string | number; color?: string }>,
  options: {
    size?: number;
    strokeWidth?: number;
    isRTL?: boolean;
  } = {}
): string {
  const { size = 160, strokeWidth = 28, isRTL = false } = options;

  const colors = ['#9C7A2D', '#2C7A6B', '#C9A84C', '#A6492F', '#3D9985', '#64748b', '#E8D5A0', '#94a3b8'];
  const data = items.slice(0, 8);
  if (data.length === 0) return '';

  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (total === 0) return '';

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const segments = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const pct = val / total;
    const dashLen = pct * circumference;
    const dashGap = circumference - dashLen;
    const c = d.color || colors[i % colors.length];
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="${strokeWidth}" stroke-dasharray="${dashLen} ${dashGap}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" opacity="0.9"/>`;
    offset += dashLen;
    return seg;
  }).join('');

  const legend = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
    const c = d.color || colors[i % colors.length];
    const y = i * 20 + 14;
    // Truncate long legend names to prevent overflow
    const maxLegendLen = 18;
    const truncatedName = d.name.length > maxLegendLen ? d.name.slice(0, maxLegendLen) + '…' : d.name;
    return `
      <rect x="0" y="${y - 8}" width="10" height="10" rx="2" fill="${c}"/>
      <text x="14" y="${y}" font-size="10" fill="#334155" font-family="Inter,-apple-system,sans-serif">${esc(truncatedName)}</text>
      <text x="170" y="${y}" font-size="10" fill="#64748b" font-family="Inter,-apple-system,sans-serif" font-weight="600" text-anchor="${isRTL ? 'start' : 'end'}">${pct}%</text>
    `;
  }).join('');

  const legendH = data.length * 20 + 10;
  const totalW = size + 200;
  const totalH = Math.max(size, legendH);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
    <g transform="translate(${size / 2}, ${totalH / 2})">${segments}</g>
    <text x="${size / 2}" y="${totalH / 2 + 4}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a" font-family="Inter,-apple-system,sans-serif">${data.length}</text>
    <g transform="translate(${size + 16}, ${(totalH - legendH) / 2})">${legend}</g>
  </svg>`;
}

/** Generate an inline SVG sparkline (mini trend line) */
function svgSparkline(
  data: number[],
  options: {
    width?: number;
    height?: number;
    color?: string;
    direction?: string;
  } = {}
): string {
  const { width = 80, height = 28, color = '#2C7A6B', direction = 'up' } = options;
  if (!data || data.length < 2) return '';

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * step;
    const y = height - 4 - ((v - min) / range) * (height - 8);
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const lineColor = direction === 'down' ? '#A6492F' : color;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <polygon points="${areaPoints}" fill="${lineColor}" opacity="0.12"/>
    <polyline points="${points}" fill="none" stroke="${lineColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/** Generate an inline SVG comparison bar (two bars side by side) */
function svgComparisonBar(
  left: { name: string; value: number },
  right: { name: string; value: number },
  options: {
    width?: number;
    barHeight?: number;
    leftColor?: string;
    rightColor?: string;
    leftLabel?: string;
    rightLabel?: string;
  } = {}
): string {
  const {
    width = 380,
    barHeight = 28,
    leftColor = '#9C7A2D',
    rightColor = '#2C7A6B',
    leftLabel = '',
    rightLabel = '',
  } = options;

  const maxVal = Math.max(left.value, right.value) || 1;
  const halfW = (width - 20) / 2;
  const leftW = Math.max((left.value / maxVal) * halfW, 2);
  const rightW = Math.max((right.value / maxVal) * halfW, 2);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${barHeight + 30}" viewBox="0 0 ${width} ${barHeight + 30}">
    ${leftLabel ? `<text x="0" y="10" font-size="9" fill="#64748b" font-family="Inter,-apple-system,sans-serif" font-weight="600">${esc(leftLabel)}</text>` : ''}
    ${rightLabel ? `<text x="${width}" y="10" font-size="9" fill="#64748b" font-family="Inter,-apple-system,sans-serif" font-weight="600" text-anchor="end">${esc(rightLabel)}</text>` : ''}
    <rect x="${halfW - leftW + 10}" y="16" width="${leftW}" height="${barHeight}" rx="3" fill="${leftColor}" opacity="0.85"/>
    <text x="${halfW - leftW + 14}" y="${16 + barHeight / 2 + 4}" font-size="10" fill="white" font-family="Inter,-apple-system,sans-serif" font-weight="600">${left.value >= 1000000 ? `$${(left.value / 1000000).toFixed(1)}M` : left.value.toLocaleString()}</text>
    <rect x="${halfW + 10}" y="16" width="${rightW}" height="${barHeight}" rx="3" fill="${rightColor}" opacity="0.85"/>
    <text x="${halfW + 14}" y="${16 + barHeight / 2 + 4}" font-size="10" fill="white" font-family="Inter,-apple-system,sans-serif" font-weight="600">${right.value >= 1000000 ? `$${(right.value / 1000000).toFixed(1)}M` : right.value.toLocaleString()}</text>
  </svg>`;
}


// ══════════════════════════════════════════════════════════════
// MARKDOWN PARSER (lightweight, for export templates)
// ══════════════════════════════════════════════════════════════

function parseMarkdown(md: string): string {
  if (!md) return '';
  let html = esc(md);

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:#0f172a;margin:12px 0 6px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 style="font-size:16px;font-weight:700;color:#0f172a;margin:14px 0 8px;">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 style="font-size:20px;font-weight:800;color:#0f172a;margin:16px 0 10px;">$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:#0f172a;">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:11px;color:#9C7A2D;">$1</code>');

  // Links [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#2C7A6B;text-decoration:underline;" target="_blank">$1</a>');

  // Unordered lists
  html = html.replace(/^[\-\*] (.+)$/gm, '<li style="margin-left:16px;margin-bottom:4px;color:#334155;">$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;margin-bottom:4px;color:#334155;list-style-type:decimal;">$1</li>');

  // Wrap consecutive li in ul
  html = html.replace(/((<li[^>]*>.*?<\/li>\s*)+)/g, '<ul style="margin:6px 0;padding-left:8px;">$1</ul>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote style="border-left:3px solid #C9A84C;padding-left:12px;margin:8px 0;color:#64748b;font-style:italic;">$1</blockquote>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #E8D5A0;margin:16px 0;"/>');

  // Line breaks → paragraphs (double newline)
  html = html.replace(/\n\n/g, '</p><p style="margin:8px 0;line-height:1.7;">');
  // Single newlines
  html = html.replace(/\n/g, '<br/>');

  return `<p style="margin:8px 0;line-height:1.7;word-break:break-word;overflow-wrap:break-word;">${html}</p>`;
}


// ══════════════════════════════════════════════════════════════
// SOURCE LINKS BUILDER (whitelist/blacklist blocks)
// ══════════════════════════════════════════════════════════════

function buildSourceLinksSection(
  data: ReportData,
  lang: Language,
): string {
  const isRTL = lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';

  // Collect all unique sources
  const sourceMap = new Map<string, SourceLink>();

  // From headline sources
  data.headline.forEach(h => {
    if (h.source) {
      const domain = h.source.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
      sourceMap.set(h.source, {
        label: h.source,
        url: h.source.startsWith('http') ? h.source : `https://${h.source}`,
        domain,
        verified: true,
      });
    }
  });

  // From fields source_url
  if (data.fields) {
    data.fields.forEach(f => {
      if (f.source_url) {
        const domain = f.source_url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
        sourceMap.set(f.source_url, {
          label: f.source_url,
          url: f.source_url,
          domain,
          verified: f.corroborated >= 2 || f.confidence === 'high',
        });
      }
    });
  }

  // From explicit sources
  if (data.sources) {
    data.sources.forEach(s => {
      sourceMap.set(s.url, s);
    });
  }

  if (sourceMap.size === 0) return '';

  const sources = Array.from(sourceMap.values());
  const verified = sources.filter(s => s.verified);
  const unverified = sources.filter(s => !s.verified);

  const labels = lang === 'ar' ? {
    title: 'المصادر والروابط',
    verified: 'مصادر موثوقة',
    unverified: 'مصادر غير موثقة',
    verifiedDesc: 'مصادر تم التحقق منها عبر مصادر متعددة',
    unverifiedDesc: 'مصادر تحتاج إلى تحقق إضافي',
    check: '✓',
    cross: '✗',
    viewLink: 'عرض',
  } : {
    title: 'Sources & Links',
    verified: 'Verified Sources',
    unverified: 'Unverified Sources',
    verifiedDesc: 'Sources corroborated across multiple data points',
    unverifiedDesc: 'Sources requiring additional verification',
    check: '✓',
    cross: '✗',
    viewLink: 'View',
  };

  const buildSourceItem = (s: SourceLink, isVerified: boolean) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:8px;background:${isVerified ? '#f0fdf4' : '#fef2f2'};border:1px solid ${isVerified ? '#bbf7d0' : '#fecaca'};margin-bottom:6px;direction:${dir};">
      <div style="width:24px;height:24px;border-radius:6px;background:${isVerified ? '#22c55e' : '#ef4444'};color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">
        ${isVerified ? labels.check : labels.cross}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:12px;font-weight:600;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.domain)}</div>
        <div style="font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(s.url)}</div>
      </div>
      <a href="${esc(s.url)}" target="_blank" style="font-size:10px;font-weight:600;color:${isVerified ? '#2C7A6B' : '#A6492F'};text-decoration:none;padding:3px 8px;border-radius:4px;border:1px solid ${isVerified ? '#2C7A6B40' : '#A6492F40'};white-space:nowrap;">${labels.viewLink}</a>
    </div>
  `;

  const verifiedHtml = verified.length > 0 ? `
    <div style="margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></div>
        <span style="font-size:13px;font-weight:700;color:#166534;">${labels.verified}</span>
        <span style="font-size:10px;color:#64748b;margin-${isRTL ? 'right' : 'left'}:4px;">(${verified.length})</span>
      </div>
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;padding-${isRTL ? 'right' : 'left'}:16px;">${labels.verifiedDesc}</div>
      ${verified.map(s => buildSourceItem(s, true)).join('')}
    </div>
  ` : '';

  const unverifiedHtml = unverified.length > 0 ? `
    <div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></div>
        <span style="font-size:13px;font-weight:700;color:#991b1b;">${labels.unverified}</span>
        <span style="font-size:10px;color:#64748b;margin-${isRTL ? 'right' : 'left'}:4px;">(${unverified.length})</span>
      </div>
      <div style="font-size:10px;color:#64748b;margin-bottom:8px;padding-${isRTL ? 'right' : 'left'}:16px;">${labels.unverifiedDesc}</div>
      ${unverified.map(s => buildSourceItem(s, false)).join('')}
    </div>
  ` : '';

  return `
    <div class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${labels.title}</h2>
      ${verifiedHtml}
      ${unverifiedHtml}
    </div>
  `;
}


// ══════════════════════════════════════════════════════════════
// HTML REPORT TEMPLATE BUILDER (v2 – Modern, Chart-Enhanced)
// ══════════════════════════════════════════════════════════════

function buildHTMLReport(
  data: ReportData,
  title: string,
  lang: Language,
  format: 'html' | 'pdf' | 'print' = 'html',
): string {
  const isRTL = lang === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';
  const roleLabel = roleLabels[data.role]?.[lang] ?? roleLabels[data.role]?.en ?? data.role;
  const classification = roleClassifications[data.role]?.[lang] ?? roleClassifications[data.role]?.en ?? 'OFFICIAL';
  const generatedDate = new Date(data.generated_at).toLocaleDateString(
    lang === 'ar' ? 'ar-AE' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );
  const generatedTime = new Date(data.generated_at).toLocaleTimeString(
    lang === 'ar' ? 'ar-AE' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  );

  // Section labels
  const L = lang === 'ar' ? {
    executiveSummary: 'الملخص التنفيذي',
    keyIndicators: 'مؤشرات الأداء الرئيسية',
    tradeAndCommerce: 'التجارة والاقتصاد',
    exportPartners: 'أهم شركاء التصدير',
    importPartners: 'أهم شركاء الاستيراد',
    exportGoods: 'أهم السلع المصدرة',
    importGoods: 'أهم السلع المستوردة',
    sectors: 'القطاعات',
    energy: 'الطاقة',
    uaeRelations: 'العلاقات مع الإمارات',
    analysis: 'التحليل',
    risks: 'تقييم المخاطر',
    opportunities: 'الفرص',
    insights: 'الرؤى',
    coverage: 'التغطية',
    share: 'النسبة',
    trend: 'الاتجاه',
    up: 'ارتفاع',
    down: 'انخفاض',
    stable: 'استقرار',
    tradeYear: 'سنة التجارة',
    country: 'الدولة',
    classification: 'التصنيف',
    date: 'التاريخ',
    page: 'صفحة',
    of: 'من',
    found: 'حقول موجودة',
    total: 'إجمالي الحقول',
    noData: 'لا تتوفر بيانات',
    sources: 'المصادر والروابط',
    tableOfContents: 'جدول المحتويات',
    trajectory: 'الاتجاهات',
  } : {
    executiveSummary: 'Executive Summary',
    keyIndicators: 'Key Performance Indicators',
    tradeAndCommerce: 'Trade & Commerce',
    exportPartners: 'Top Export Partners',
    importPartners: 'Top Import Partners',
    exportGoods: 'Top Export Commodities',
    importGoods: 'Top Import Commodities',
    sectors: 'Sectors',
    energy: 'Energy',
    uaeRelations: 'UAE Relations',
    analysis: 'Analysis',
    risks: 'Risk Assessment',
    opportunities: 'Opportunities',
    insights: 'Insights',
    coverage: 'Coverage',
    share: 'Share',
    trend: 'Trend',
    up: '▲ Up',
    down: '▼ Down',
    stable: '● Stable',
    tradeYear: 'Trade Year',
    country: 'Country',
    classification: 'Classification',
    date: 'Date',
    page: 'Page',
    of: 'of',
    found: 'Fields Found',
    total: 'Total Fields',
    noData: 'No data available',
    sources: 'Sources & Links',
    tableOfContents: 'Table of Contents',
    trajectory: 'Trajectories',
  };

  // ── Table of Contents ──────────────────────────────────────
  const tocItems: Array<{ id: string; label: string }> = [];
  if (data.read) tocItems.push({ id: 'exec-summary', label: L.executiveSummary });
  if (data.headline.length > 0) tocItems.push({ id: 'kpis', label: L.keyIndicators });
  if (data.trajectory.length > 0) tocItems.push({ id: 'trajectory', label: L.trajectory });
  if (data.trade) tocItems.push({ id: 'trade', label: L.tradeAndCommerce });
  if (data.sectors.length > 0) tocItems.push({ id: 'sectors', label: L.sectors });
  if (data.energy.length > 0) tocItems.push({ id: 'energy', label: L.energy });
  if (data.uae.length > 0) tocItems.push({ id: 'uae', label: L.uaeRelations });
  if (data.analysis) tocItems.push({ id: 'analysis', label: L.analysis });
  if (data.insights.length > 0) tocItems.push({ id: 'insights', label: L.insights });
  if (data.risks.length > 0 || data.opportunities.length > 0) tocItems.push({ id: 'risk-opp', label: `${L.risks} & ${L.opportunities}` });
  tocItems.push({ id: 'sources', label: L.sources });

  const tocHtml = format === 'pdf' ? '' : `
    <div id="toc" class="section" style="page-break-inside:avoid;margin-bottom:24px;">
      <h2 style="font-size:14px;color:#9C7A2D;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #E8D5A0;">${L.tableOfContents}</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px;">
        ${tocItems.map((item, i) => `
          <a href="#${item.id}" style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;text-decoration:none;color:#334155;font-size:12px;transition:background 0.15s;" onmouseover="this.style.background='#F7F2E8'" onmouseout="this.style.background='transparent'">
            <span style="width:20px;height:20px;border-radius:5px;background:#9C7A2D15;color:#9C7A2D;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${i + 1}</span>
            ${esc(item.label)}
          </a>
        `).join('')}
      </div>
    </div>
  `;

  // ── KPI Cards ─────────────────────────────────────────────
  const kpiCardsHtml = data.headline.slice(0, 8).map((h, idx) => {
    const trendDir = h.trend?.direction ?? 'flat';
    const trendGood = h.trend?.good_up ?? true;
    const isGood = trendDir === 'up' ? trendGood : trendDir === 'down' ? !trendGood : true;
    const trendColor = trendDir === 'flat' ? '#64748b' : isGood ? '#2C7A6B' : '#A6492F';
    const trendBg = trendDir === 'flat' ? '#f1f5f9' : isGood ? '#f0fdf4' : '#fef2f2';
    const trendIcon = trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : '●';
    const trendLabel = trendDir === 'up' ? L.up : trendDir === 'down' ? L.down : L.stable;
    const changePct = h.trend?.change_pct;
    const cagrPct = h.trend?.cagr_pct;

    // Sparkline data not available in ReportData type, skip
    const sparkSvg = '';

    const accentColors = ['#9C7A2D', '#2C7A6B', '#C9A84C', '#3D9985', '#A6492F', '#64748b', '#9C7A2D', '#2C7A6B'];
    const accent = accentColors[idx % accentColors.length];

    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid ${accent};border-radius:10px;padding:14px 16px;page-break-inside:avoid;position:relative;overflow:hidden;">
        <div style="position:absolute;top:-12px;${isRTL ? 'left' : 'right'}:-12px;width:40px;height:40px;border-radius:50%;background:${accent}08;"></div>
        <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.display)}</div>
        <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.key)}</div>
        ${h.unit ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px;min-height:20px;">${esc(h.unit)}</div>` : ''}
        ${h.trend ? `
          <div style="margin-top:6px;display:inline-flex;align-items:center;gap:5px;background:${trendBg};padding:3px 8px;border-radius:6px;">
            <span style="color:${trendColor};font-size:11px;font-weight:700;">${trendIcon}</span>
            <span style="color:${trendColor};font-size:11px;font-weight:600;">${trendLabel}</span>
            ${changePct != null ? `<span style="color:${trendColor};font-size:10px;font-weight:500;">${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%</span>` : ''}
            ${cagrPct != null ? `<span style="color:#94a3b8;font-size:9px;margin-left:2px;">CAGR ${cagrPct.toFixed(1)}%</span>` : ''}
          </div>
        ` : ''}
        <div style="margin-top:5px;font-size:9px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.source)} ${h.as_of ? `· ${esc(h.as_of)}` : ''}</div>
      </div>
    `;
  }).join('\n');

  // ── Trade Section with SVG Charts ─────────────────────────
  const tradeSectionHtml = data.trade ? `
    <div id="trade" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:4px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.tradeAndCommerce}</h2>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:16px;">${L.tradeYear}: ${data.trade.year}</div>

      <!-- Export Partners Chart -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:3px;height:14px;background:#9C7A2D;border-radius:2px;"></span>
          ${L.exportPartners}
        </h3>
        ${svgBarChart(data.trade.export_partners, { color: '#9C7A2D', width: 400, maxItems: 6, isRTL })}
        ${data.trade.export_goods.length > 0 ? `
          <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin:16px 0 12px;display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:3px;height:14px;background:#C9A84C;border-radius:2px;"></span>
            ${L.exportGoods}
          </h3>
          ${svgBarChart(data.trade.export_goods, { color: '#C9A84C', width: 400, maxItems: 5, isRTL })}
        ` : ''}
      </div>

      <!-- Import Partners Chart -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <h3 style="font-size:13px;color:#2C7A6B;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
          <span style="display:inline-block;width:3px;height:14px;background:#2C7A6B;border-radius:2px;"></span>
          ${L.importPartners}
        </h3>
        ${svgBarChart(data.trade.import_partners, { color: '#2C7A6B', width: 400, maxItems: 6, isRTL })}
        ${data.trade.import_goods.length > 0 ? `
          <h3 style="font-size:13px;color:#2C7A6B;font-weight:700;margin:16px 0 12px;display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:3px;height:14px;background:#3D9985;border-radius:2px;"></span>
            ${L.importGoods}
          </h3>
          ${svgBarChart(data.trade.import_goods, { color: '#3D9985', width: 400, maxItems: 5, isRTL })}
        ` : ''}
      </div>
    </div>
  ` : '';

  // ── Sectors with Donut Chart ───────────────────────────────
  const sectorsHtml = data.sectors.length > 0 ? `
    <div id="sectors" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.sectors}</h2>
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:280px;">
          ${svgDonutChart(
            data.sectors.map(s => ({ name: s.display || s.key, value: Number(s.value) || 0 })),
            { isRTL }
          )}
        </div>
        <div style="flex:1;min-width:220px;display:grid;grid-template-columns:1fr;gap:8px;">
          ${data.sectors.map((s) => `
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:500;">${esc(s.key)}</div>
              <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${esc(String(s.value ?? '—'))}${s.unit ? ` <span style="font-size:11px;color:#94a3b8;font-weight:400;">${esc(s.unit)}</span>` : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';

  // ── Energy with Donut Chart ────────────────────────────────
  const energyHtml = data.energy.length > 0 ? `
    <div id="energy" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.energy}</h2>
      <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
        <div style="flex:1;min-width:280px;">
          ${svgDonutChart(
            data.energy.map(e => ({ name: e.display || e.key, value: Number(e.value) || 0 })),
            { isRTL }
          )}
        </div>
        <div style="flex:1;min-width:220px;display:grid;grid-template-columns:1fr;gap:8px;">
          ${data.energy.map((e) => `
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:3px solid #2C7A6B;border-radius:8px;padding:10px 14px;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:500;">${esc(e.key)}</div>
              <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">${esc(String(e.value ?? '—'))}${e.unit ? ` <span style="font-size:11px;color:#94a3b8;font-weight:400;">${esc(e.unit)}</span>` : ''}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  ` : '';

  // ── UAE Relations ──────────────────────────────────────────
  const uaeHtml = data.uae.length > 0 ? `
    <div id="uae" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.uaeRelations}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
        ${data.uae.map((u) => `
          <div style="background:linear-gradient(135deg,#ffffff 0%,#F7F2E8 100%);border:1px solid #E8D5A0;border-radius:10px;padding:14px 16px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:-8px;${isRTL ? 'left' : 'right'}:-8px;width:28px;height:28px;border-radius:50%;background:#9C7A2D08;"></div>
            <div style="font-size:10px;color:#9C7A2D;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">${esc(u.key)}</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:3px;">${esc(String(u.value ?? '—'))}${u.unit ? ` <span style="font-size:11px;color:#94a3b8;font-weight:400;">${esc(u.unit)}</span>` : ''}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // ── Risks & Opportunities ──────────────────────────────────
  const risksHtml = data.risks.length > 0 ? `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#A6492F;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #A6492F40;">${L.risks}</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${data.risks.map((r) => `
          <div style="background:#ffffff;border:1px solid #fecaca;border-left:4px solid #A6492F;border-radius:10px;padding:14px 18px;">
            <div style="font-size:13px;font-weight:700;color:#A6492F;margin-bottom:4px;">${esc(r.title)}</div>
            <div style="font-size:12px;color:#475569;line-height:1.7;word-break:break-word;overflow-wrap:break-word;">${parseMarkdown(r.content)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const opportunitiesHtml = data.opportunities.length > 0 ? `
    <div style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #2C7A6B40;">${L.opportunities}</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${data.opportunities.map((o) => `
          <div style="background:#ffffff;border:1px solid #bbf7d0;border-left:4px solid #2C7A6B;border-radius:10px;padding:14px 18px;">
            <div style="font-size:13px;font-weight:700;color:#2C7A6B;margin-bottom:4px;">${esc(o.title)}</div>
            <div style="font-size:12px;color:#475569;line-height:1.7;word-break:break-word;overflow-wrap:break-word;">${parseMarkdown(o.content)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // ── Risk vs Opportunity Overview Chart ────────────────────
  const riskOppChartHtml = (data.risks.length > 0 || data.opportunities.length > 0) ? `
  <div style="page-break-inside:avoid;margin-bottom:16px;">
    <h3 style="font-size:14px;color:#0f172a;font-weight:700;margin-bottom:8px;">${lang === 'ar' ? 'مقارنة المخاطر والفرص' : 'Risk vs Opportunity Overview'}</h3>
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="60" viewBox="0 0 300 60">
      <text x="10" y="18" font-size="10" fill="#A6492F" font-family="Inter,-apple-system,sans-serif" font-weight="600">${lang === 'ar' ? 'المخاطر' : 'Risks'}</text>
      <rect x="10" y="24" width="${Math.max(data.risks.length * 30, 10)}" height="24" rx="4" fill="#A6492F" opacity="0.85"/>
      <text x="${Math.max(data.risks.length * 30, 10) + 16}" y="41" font-size="11" fill="#0f172a" font-family="Inter,-apple-system,sans-serif" font-weight="700">${data.risks.length}</text>
      <text x="160" y="18" font-size="10" fill="#2C7A6B" font-family="Inter,-apple-system,sans-serif" font-weight="600">${lang === 'ar' ? 'الفرص' : 'Opportunities'}</text>
      <rect x="160" y="24" width="${Math.max(data.opportunities.length * 30, 10)}" height="24" rx="4" fill="#2C7A6B" opacity="0.85"/>
      <text x="${160 + Math.max(data.opportunities.length * 30, 10) + 6}" y="41" font-size="11" fill="#0f172a" font-family="Inter,-apple-system,sans-serif" font-weight="700">${data.opportunities.length}</text>
    </svg>
  </div>
` : '';

  // ── Insights ───────────────────────────────────────────────
  const insightsHtml = data.insights.length > 0 ? `
    <div id="insights" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#9C7A2D;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.insights}</h2>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${data.insights.map((ins) => `
          <div style="background:linear-gradient(135deg,#F7F2E8 0%,#ffffff 100%);border:1px solid #E8D5A0;border-radius:10px;padding:14px 18px;">
            <div style="font-size:13px;font-weight:700;color:#9C7A2D;margin-bottom:4px;">${esc(ins.title)}</div>
            <div style="font-size:12px;color:#475569;line-height:1.7;word-break:break-word;overflow-wrap:break-word;">${parseMarkdown(ins.content)}</div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  // ── Analysis with Markdown ─────────────────────────────────
  const analysisHtml = data.analysis ? `
    <div id="analysis" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.analysis}</h2>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-left:4px solid #2C7A6B;border-radius:10px;padding:18px 22px;word-break:break-word;overflow-wrap:break-word;">
        ${parseMarkdown(data.analysis)}
      </div>
    </div>
  ` : '';

  // ── Executive Summary with Markdown ────────────────────────
  const readHtml = data.read ? `
    <div id="exec-summary" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.executiveSummary}</h2>
      <div style="background:linear-gradient(135deg,#F7F2E8 0%,#FBF8F1 100%);border:1px solid #E8D5A0;border-radius:12px;padding:22px 26px;position:relative;overflow:hidden;word-break:break-word;overflow-wrap:break-word;">
        <div style="position:absolute;top:-20px;${isRTL ? 'left' : 'right'}:-20px;width:60px;height:60px;border-radius:50%;background:#9C7A2D06;"></div>
        ${parseMarkdown(data.read)}
      </div>
    </div>
  ` : '';

  // ── Trajectory Section with Sparklines ─────────────────────
  const trajectoryHtml = data.trajectory.length > 0 ? `
    <div id="trajectory" class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.trajectory}</h2>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;">
        ${data.trajectory.map((t) => {
          const dirColor = t.direction === 'up' ? '#2C7A6B' : t.direction === 'down' ? '#A6492F' : '#64748b';
          const dirBg = t.direction === 'up' ? '#f0fdf4' : t.direction === 'down' ? '#fef2f2' : '#f1f5f9';
          const dirIcon = t.direction === 'up' ? '▲' : t.direction === 'down' ? '▼' : '●';
          // Render sparkline if spark data available
          const sparkSvg = t.spark && t.spark.length >= 2 ? svgSparkline(t.spark, { width: 100, height: 28, color: dirColor, direction: t.direction }) : '';
          return `
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;page-break-inside:avoid;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.04em;font-weight:500;margin-bottom:2px;">${esc(t.display)}</div>
              <div style="display:flex;align-items:baseline;gap:6px;">
                <span style="font-size:18px;font-weight:800;color:#0f172a;">${esc(t.key)}</span>
                <span style="font-size:10px;color:#94a3b8;">${esc(t.unit)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
                <div style="display:inline-flex;align-items:center;gap:4px;background:${dirBg};padding:2px 6px;border-radius:4px;">
                  <span style="color:${dirColor};font-size:10px;font-weight:700;">${dirIcon}</span>
                  <span style="color:${dirColor};font-size:10px;font-weight:600;">${t.latest_year}</span>
                </div>
                ${sparkSvg}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  ` : '';

  // ── Source Links Section ────────────────────────────────────
  const sourcesHtml = buildSourceLinksSection(data, lang);

  // ── Coverage badge ─────────────────────────────────────────
  const coveragePct = data.coverage.pct;
  const coverageColor = coveragePct >= 80 ? '#2C7A6B' : coveragePct >= 50 ? '#9C7A2D' : '#A6492F';
  const coverageBg = coveragePct >= 80 ? '#f0fdf4' : coveragePct >= 50 ? '#F7F2E8' : '#fef2f2';

  const coverageHtml = `
    <div style="display:inline-flex;align-items:center;gap:8px;background:${coverageBg};border:1px solid ${coverageColor}30;border-radius:20px;padding:5px 14px;font-size:11px;color:${coverageColor};font-weight:600;">
      <div style="width:48px;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden;">
        <div style="width:${coveragePct}%;height:100%;background:${coverageColor};border-radius:3px;"></div>
      </div>
      ${L.coverage}: ${data.coverage.pct}% (${data.coverage.found}/${data.coverage.total})
    </div>
  `;

  // ── Role-specific KPI section helper ───────────────────────
  const buildKpiSectionHtml = (maxCount: number) => {
    const kpis = data.headline.slice(0, maxCount);
    if (kpis.length === 0) return '';
    const cards = kpis.map((h, idx) => {
      const trendDir = h.trend?.direction ?? 'flat';
      const trendGood = h.trend?.good_up ?? true;
      const isGood = trendDir === 'up' ? trendGood : trendDir === 'down' ? !trendGood : true;
      const trendColor = trendDir === 'flat' ? '#64748b' : isGood ? '#2C7A6B' : '#A6492F';
      const trendBg = trendDir === 'flat' ? '#f1f5f9' : isGood ? '#f0fdf4' : '#fef2f2';
      const trendIcon = trendDir === 'up' ? '▲' : trendDir === 'down' ? '▼' : '●';
      const trendLabel = trendDir === 'up' ? L.up : trendDir === 'down' ? L.down : L.stable;
      const changePct = h.trend?.change_pct;
      const cagrPct = h.trend?.cagr_pct;
      const accentColors = ['#9C7A2D', '#2C7A6B', '#C9A84C', '#3D9985', '#A6492F', '#64748b', '#9C7A2D', '#2C7A6B'];
      const accent = accentColors[idx % accentColors.length];
      return `
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-top:3px solid ${accent};border-radius:10px;padding:14px 16px;page-break-inside:avoid;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-12px;${isRTL ? 'left' : 'right'}:-12px;width:40px;height:40px;border-radius:50%;background:${accent}08;"></div>
          <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;font-weight:600;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.display)}</div>
          <div style="font-size:20px;font-weight:800;color:#0f172a;letter-spacing:-0.03em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.key)}</div>
          ${h.unit ? `<div style="font-size:10px;color:#94a3b8;margin-top:1px;min-height:20px;">${esc(h.unit)}</div>` : ''}
          ${h.trend ? `
            <div style="margin-top:6px;display:inline-flex;align-items:center;gap:5px;background:${trendBg};padding:3px 8px;border-radius:6px;">
              <span style="color:${trendColor};font-size:11px;font-weight:700;">${trendIcon}</span>
              <span style="color:${trendColor};font-size:11px;font-weight:600;">${trendLabel}</span>
              ${changePct != null ? `<span style="color:${trendColor};font-size:10px;font-weight:500;">${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%</span>` : ''}
              ${cagrPct != null ? `<span style="color:#94a3b8;font-size:9px;margin-left:2px;">CAGR ${cagrPct.toFixed(1)}%</span>` : ''}
            </div>
          ` : ''}
          <div style="margin-top:5px;font-size:9px;color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:90%;">${esc(h.source)} ${h.as_of ? `· ${esc(h.as_of)}` : ''}</div>
        </div>
      `;
    }).join('\n');
    return `
      <div id="kpis" class="section" style="page-break-inside:avoid;">
        <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.keyIndicators}</h2>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:12px;">
          ${cards}
        </div>
      </div>
    `;
  };

  // ── UAE Pie Chart (for client role) ────────────────────────
  const uaePieHtml = data.uae.length > 0 ? `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;">${lang === 'ar' ? 'توزيع العلاقات مع الإمارات' : 'UAE Relations Distribution'}</h3>
      ${svgDonutChart(
        data.uae.map(u => ({ name: u.display || u.key, value: Number(u.value) || 0 })),
        { isRTL }
      )}
    </div>
  ` : '';

  // ── KPI Summary Bar Chart (for manager role) ───────────────
  const kpiBarChartHtml = data.headline.length > 0 ? `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;">${lang === 'ar' ? 'ملخص المؤشرات الرئيسية' : 'KPI Overview'}</h3>
      ${svgBarChart(
        data.headline.slice(0, 8).map(h => ({ name: h.display || h.key, value: h.trend?.change_pct ?? 0, share_pct: Math.abs(h.trend?.change_pct ?? 0) || (1 / data.headline.length * 100) })),
        { color: '#9C7A2D', width: 400, maxItems: 8, isRTL }
      )}
    </div>
  ` : '';

  // ── Coverage Pie Chart (for team role) ─────────────────────
  const coveragePieHtml = `
    <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
      <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;">${lang === 'ar' ? 'تغطية البيانات' : 'Data Coverage'}</h3>
      ${svgDonutChart(
        [
          { name: lang === 'ar' ? 'موجود' : 'Found', value: data.coverage.found, color: '#2C7A6B' },
          { name: lang === 'ar' ? 'مفقود' : 'Missing', value: Math.max(data.coverage.total - data.coverage.found, 0), color: '#e2e8f0' },
        ],
        { isRTL }
      )}
    </div>
  `;

  // ── Domain Distribution Bar Chart (for team role) ──────────
  const domainBarHtml = data.fields && data.fields.length > 0 ? (() => {
    const domainMap = new Map<string, number>();
    data.fields.forEach(f => {
      const d = f.domain || 'other';
      domainMap.set(d, (domainMap.get(d) || 0) + 1);
    });
    const domainItems = Array.from(domainMap.entries()).map(([name, value]) => ({
      name,
      value,
      share_pct: (value / data.fields!.length) * 100,
    }));
    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;">${lang === 'ar' ? 'توزيع المجالات' : 'Domain Distribution'}</h3>
        ${svgBarChart(domainItems, { color: '#2C7A6B', width: 400, maxItems: 8, isRTL })}
      </div>
    `;
  })() : '';

  // ── Confidence Pie Chart (for team role) ───────────────────
  const confidencePieHtml = data.fields && data.fields.length > 0 ? (() => {
    const confMap = new Map<string, number>();
    data.fields.forEach(f => {
      const c = f.confidence || 'unknown';
      confMap.set(c, (confMap.get(c) || 0) + 1);
    });
    const confColors: Record<string, string> = { high: '#2C7A6B', medium: '#9C7A2D', low: '#A6492F', unknown: '#94a3b8' };
    const confItems = Array.from(confMap.entries()).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: confColors[name] || '#64748b',
    }));
    return `
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;margin-bottom:16px;">
        <h3 style="font-size:13px;color:#9C7A2D;font-weight:700;margin-bottom:12px;">${lang === 'ar' ? 'توزيع الثقة' : 'Confidence Distribution'}</h3>
        ${svgDonutChart(confItems, { isRTL })}
      </div>
    `;
  })() : '';

  // ── Full Data Table (for team role) ────────────────────────
  const dataTableHtml = data.fields && data.fields.length > 0 ? `
    <div class="section" style="page-break-inside:avoid;">
      <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${lang === 'ar' ? 'جدول البيانات الكامل' : 'Full Data Table'}</h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead>
            <tr style="background:#F7F2E8;">
              <th style="padding:8px 10px;text-align:${isRTL ? 'right' : 'left'};font-weight:600;color:#9C7A2D;border-bottom:2px solid #C9A84C;">${lang === 'ar' ? 'الحقل' : 'Field'}</th>
              <th style="padding:8px 10px;text-align:${isRTL ? 'right' : 'left'};font-weight:600;color:#9C7A2D;border-bottom:2px solid #C9A84C;">${lang === 'ar' ? 'المجال' : 'Domain'}</th>
              <th style="padding:8px 10px;text-align:${isRTL ? 'right' : 'left'};font-weight:600;color:#9C7A2D;border-bottom:2px solid #C9A84C;">${lang === 'ar' ? 'القيمة' : 'Value'}</th>
              <th style="padding:8px 10px;text-align:${isRTL ? 'right' : 'left'};font-weight:600;color:#9C7A2D;border-bottom:2px solid #C9A84C;">${lang === 'ar' ? 'الثقة' : 'Confidence'}</th>
            </tr>
          </thead>
          <tbody>
            ${data.fields.map((f, i) => `
              <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};border-bottom:1px solid #e2e8f0;">
                <td style="padding:6px 10px;color:#0f172a;">${esc(f.field_name)}</td>
                <td style="padding:6px 10px;color:#64748b;">${esc(f.domain)}</td>
                <td style="padding:6px 10px;color:#0f172a;font-weight:500;">${esc(f.value ?? '—')}</td>
                <td style="padding:6px 10px;"><span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:${f.confidence === 'high' ? '#f0fdf4' : f.confidence === 'medium' ? '#F7F2E8' : '#fef2f2'};color:${f.confidence === 'high' ? '#2C7A6B' : f.confidence === 'medium' ? '#9C7A2D' : '#A6492F'};">${esc(f.confidence)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  ` : '';

  // ── Role-based section assembly ────────────────────────────
  const riskOppSectionHtml = data.risks.length > 0 || data.opportunities.length > 0 ? `
    <div id="risk-opp" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px;">
      ${risksHtml}
      ${opportunitiesHtml}
    </div>
  ` : '';

  let sectionsHtml = '';
  switch (data.role) {
    case 'minister':
      sectionsHtml = `
        ${readHtml}
        ${buildKpiSectionHtml(4)}
        ${insightsHtml}
        ${data.sectors.length > 0 ? `
          <div id="sectors" class="section" style="page-break-inside:avoid;">
            <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.sectors}</h2>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
              ${svgDonutChart(
                data.sectors.map(s => ({ name: s.display || s.key, value: Number(s.value) || 0 })),
                { isRTL }
              )}
            </div>
          </div>
        ` : ''}
        ${data.trade ? `
          <div id="trade" class="section" style="page-break-inside:avoid;">
            <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:4px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.exportPartners}</h2>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
              ${svgBarChart(data.trade.export_partners, { color: '#9C7A2D', width: 400, maxItems: 6, isRTL })}
            </div>
          </div>
        ` : ''}
      `;
      break;
    case 'deputy':
      sectionsHtml = `
        ${buildKpiSectionHtml(8)}
        ${trajectoryHtml}
        ${riskOppChartHtml}
        ${analysisHtml}
        ${riskOppSectionHtml}
      `;
      break;
    case 'client':
      sectionsHtml = `
        ${buildKpiSectionHtml(6)}
        ${tradeSectionHtml}
        ${uaePieHtml}
        ${uaeHtml}
      `;
      break;
    case 'manager':
      sectionsHtml = `
        ${buildKpiSectionHtml(data.headline.length)}
        ${kpiBarChartHtml}
        ${data.energy.length > 0 ? `
          <div class="section" style="page-break-inside:avoid;">
            <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.energy}</h2>
            <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
              ${svgDonutChart(
                data.energy.map(e => ({ name: e.display || e.key, value: Number(e.value) || 0 })),
                { isRTL }
              )}
            </div>
          </div>
        ` : ''}
        ${tradeSectionHtml}
        ${analysisHtml}
        ${riskOppChartHtml}
        ${riskOppSectionHtml}
      `;
      break;
    case 'team':
      sectionsHtml = `
        <div class="section" style="page-break-inside:avoid;">
          <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.coverage}</h2>
          ${coverageHtml}
          ${coveragePieHtml}
        </div>
        ${domainBarHtml}
        ${confidencePieHtml}
        ${dataTableHtml}
      `;
      break;
    default:
      // Default: show all sections (original behavior)
      sectionsHtml = `
        ${readHtml}
        ${data.headline.length > 0 ? `
          <div id="kpis" class="section" style="page-break-inside:avoid;">
            <h2 style="font-size:16px;color:#2C7A6B;font-weight:700;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #C9A84C;">${L.keyIndicators}</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:12px;">
              ${kpiCardsHtml}
            </div>
          </div>
        ` : ''}
        ${trajectoryHtml}
        ${tradeSectionHtml}
        ${sectorsHtml}
        ${energyHtml}
        ${uaeHtml}
        ${analysisHtml}
        ${insightsHtml}
        ${riskOppSectionHtml}
      `;
      break;
  }

  // ── Format-specific CSS additions ──────────────────────────
  const printCSS = format === 'print' ? `
    @media print {
      body { background: #ffffff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .report-container { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; }
      .section { page-break-inside: avoid; }
      .no-print { display: none !important; }
      .gold-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      a { color: #2C7A6B !important; text-decoration: underline !important; }
      a[href]::after { content: " (" attr(href) ")"; font-size: 9px; color: #64748b !important; }
    }
  ` : format === 'pdf' ? `
    .report-container { padding-bottom: 0; }
  ` : '';

  // ── Embed mode CSS (for HTML export used externally) ───────
  const embedCSS = format === 'html' ? `
    /* Embed mode: add ?embed=true to URL to hide chrome */
    .embed-mode .report-chrome { display: none !important; }
    .embed-mode .report-container { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; border-radius: 0 !important; }
  ` : '';

  // ── Complete HTML ──────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: ${format === 'print' ? '#ffffff' : '#f8fafc'};
      color: #0f172a;
      line-height: 1.6;
      direction: ${dir};
      text-align: ${textAlign};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    .report-container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      min-height: 100vh;
      box-shadow: 0 0 60px rgba(0,0,0,0.05);
      position: relative;
    }
    .section { margin-bottom: 28px; }
    ${printCSS}
    ${embedCSS}

    /* Smooth scroll for ToC */
    html { scroll-behavior: smooth; }

    /* Responsive */
    @media (max-width: 640px) {
      .report-container { margin: 0; box-shadow: none; }
      .report-header { padding: 20px !important; }
      .report-content { padding: 16px 20px !important; }
    }
  </style>
  <script>
    // Embed mode detection
    if (window.location.search.includes('embed=true')) {
      document.documentElement.classList.add('embed-mode');
    }
  </script>
</head>
<body>
  <div class="report-container">
    <!-- ═══ Decorative Top Bar ═══ -->
    <div class="gold-bar" style="height:5px;background:linear-gradient(90deg,#9C7A2D 0%,#C9A84C 25%,#E8D5A0 50%,#C9A84C 75%,#9C7A2D 100%);"></div>

    <!-- ═══ Header ═══ -->
    <div class="report-chrome report-header" style="padding:28px 40px 24px;background:linear-gradient(180deg,#ffffff 0%,#FBF8F1 100%);position:relative;overflow:hidden;">
      <!-- Decorative circles -->
      <div style="position:absolute;top:-30px;${isRTL ? 'left' : 'right'}:-30px;width:120px;height:120px;border-radius:50%;background:radial-gradient(circle,#9C7A2D08,transparent);"></div>
      <div style="position:absolute;bottom:-20px;${isRTL ? 'right' : 'left'}:-20px;width:80px;height:80px;border-radius:50%;background:radial-gradient(circle,#2C7A6B06,transparent);"></div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;position:relative;z-index:1;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:46px;height:46px;background:linear-gradient(135deg,#9C7A2D,#C9A84C);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.02em;box-shadow:0 2px 8px #9C7A2D30;">M</div>
          <div>
            <div style="font-size:17px;font-weight:800;color:#9C7A2D;letter-spacing:0.02em;">MOEI</div>
            <div style="font-size:10px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:0.06em;">${lang === 'ar' ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'}</div>
          </div>
        </div>
        <div style="text-align:${isRTL ? 'left' : 'right'};">
          <div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;margin-bottom:3px;">${L.classification}</div>
          <div style="background:linear-gradient(135deg,#9C7A2D,#C9A84C);color:#ffffff;font-size:10px;font-weight:700;padding:4px 12px;border-radius:6px;letter-spacing:0.06em;display:inline-block;box-shadow:0 1px 4px #9C7A2D30;">${classification}</div>
        </div>
      </div>

      <!-- Separator -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#E8D5A0,transparent);margin-bottom:16px;"></div>

      <!-- Report title -->
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.02em;margin-bottom:6px;position:relative;z-index:1;">${esc(roleLabel)}</h1>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:13px;color:#64748b;position:relative;z-index:1;">
        <span style="font-weight:700;color:#9C7A2D;">${esc(data.country_name || data.country)}</span>
        <span style="color:#cbd5e1;">·</span>
        <span>${generatedDate}</span>
        <span style="color:#cbd5e1;">·</span>
        <span>${generatedTime}</span>
      </div>
      <div style="margin-top:10px;position:relative;z-index:1;">
        ${coverageHtml}
      </div>
    </div>

    <!-- ═══ Color Divider ═══ -->
    <div style="height:3px;background:linear-gradient(90deg,#9C7A2D,#C9A84C,#2C7A6B,#C9A84C,#9C7A2D);"></div>

    <!-- ═══ Content ═══ -->
    <div class="report-content" style="padding:24px 40px 20px;">
      ${tocHtml}
      ${sectionsHtml}

      <!-- ═══ Sources ═══ -->
      <div id="sources">
        ${sourcesHtml}
      </div>
    </div>

    <!-- ═══ Footer ═══ -->
    <div class="report-chrome" style="background:linear-gradient(180deg,#FBF8F1 0%,#F7F2E8 100%);padding:20px 40px;border-top:1px solid #E8D5A0;">
      <div style="text-align:center;">
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">
          <div style="width:24px;height:24px;background:linear-gradient(135deg,#9C7A2D,#C9A84C);border-radius:6px;display:flex;align-items:center;justify-content:center;color:#ffffff;font-size:12px;font-weight:800;">M</div>
          <div style="font-size:12px;font-weight:700;color:#9C7A2D;letter-spacing:0.04em;">
            ${lang === 'ar' ? 'منصة استخبارات الدول - وزارة الطاقة والبنية التحتية' : 'MOEI Country Intelligence Platform'}
          </div>
        </div>
        <div style="font-size:10px;color:#94a3b8;letter-spacing:0.04em;margin-bottom:2px;">
          ${lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي · موثق المصادر · بدون هلوسة' : 'AI-powered · Source-verified · Zero hallucination'}
        </div>
        <div style="font-size:9px;color:#cbd5e1;">
          &copy; ${new Date().getFullYear()} ${lang === 'ar' ? 'وزارة الطاقة والبنية التحتية' : 'Ministry of Energy & Infrastructure'} · ${generatedDate} ${generatedTime}
        </div>
      </div>
    </div>

    <!-- ═══ Bottom Gold Bar ═══ -->
    <div class="gold-bar" style="height:4px;background:linear-gradient(90deg,#9C7A2D 0%,#C9A84C 25%,#E8D5A0 50%,#C9A84C 75%,#9C7A2D 100%);"></div>
  </div>
</body>
</html>`;

  return html;
}


// ══════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ══════════════════════════════════════════════════════════════

// ── 1. JSON Export (Enhanced with metadata) ──────────────────

export function exportAsJSON(
  data: unknown,
  filename: string,
): void {
  const reportData = data as ReportData;

  // Build enhanced JSON with metadata
  const enhanced = {
    meta: {
      platform: 'MOEI Country Intelligence Platform',
      version: '2.0',
      generated_at: reportData.generated_at ?? new Date().toISOString(),
      role: reportData.role,
      country: reportData.country,
      classification: roleClassifications[reportData.role]?.en ?? 'OFFICIAL',
      coverage: reportData.coverage,
    },
    executive_summary: reportData.read ?? null,
    headline: reportData.headline,
    trajectory: reportData.trajectory,
    trade: reportData.trade,
    sectors: reportData.sectors,
    energy: reportData.energy,
    uae_relations: reportData.uae,
    analysis: reportData.analysis ?? null,
    insights: reportData.insights,
    risks: reportData.risks,
    opportunities: reportData.opportunities,
    sources: reportData.sources ?? [],
    fields: reportData.fields ?? [],
  };

  const json = JSON.stringify(enhanced, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${safeName(filename)}.json`);
}


// ── 2. HTML Export (Standalone Beautiful Report) ─────────────

export function exportAsHTML(
  data: unknown,
  filename: string,
  title: string,
  lang: Language = 'en',
): void {
  const reportData = data as ReportData;
  const html = buildHTMLReport(reportData, title, lang, 'html');
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${safeName(filename)}.html`);
}


// ── 3. PDF Export (Professional Multi-Page Document) ─────────

export async function exportAsPDF(
  data: unknown,
  filename: string,
  title: string,
  lang: Language = 'en',
): Promise<void> {
  const reportData = data as ReportData;
  const isRTL = lang === 'ar';

  // 1. Build the HTML report optimized for PDF
  const htmlContent = buildHTMLReport(reportData, title, lang, 'pdf');

  // 2. Create a hidden iframe to render the report
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:900px;height:0;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Failed to create iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  // 3. Wait for content + fonts to render
  await new Promise<void>((resolve) => {
    iframe.onload = () => resolve();
    setTimeout(() => resolve(), 1500);
  });

  const reportEl = iframeDoc.querySelector('.report-container') as HTMLElement;
  if (!reportEl) {
    document.body.removeChild(iframe);
    throw new Error('Report element not found in iframe');
  }

  // 4. Render with html2canvas at high quality
  const html2canvas = await loadHtml2Canvas();
  const jsPDF = await loadJsPDF();

  const canvas = await html2canvas(reportEl, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    width: 900,
    windowWidth: 900,
  });

  // 5. Calculate A4 PDF dimensions
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2 - 24; // extra for footer

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;
  const ratio = usableWidth / imgWidth;
  const scaledWidth = usableWidth;
  const scaledHeight = imgHeight * ratio;

  // 6. Create PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Helper: add page footer with MOEI branding
  const addPageFooter = (pageNum: number, totalPages: number) => {
    // Gold line
    doc.setDrawColor(156, 122, 45);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);

    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    const footerLeft = isRTL ? 'منصة استخبارات الدول - وزارة الطاقة والبنية التحتية' : 'MOEI Country Intelligence Platform';
    const footerRight = isRTL ? `${totalPages} / ${pageNum}  صفحة` : `Page ${pageNum} of ${totalPages}`;
    doc.text(footerLeft, margin, pageHeight - 16);
    doc.text(footerRight, pageWidth - margin - 60, pageHeight - 16);

    // Gold accent dot
    doc.setFillColor(156, 122, 45);
    doc.circle(pageWidth / 2, pageHeight - 18, 1.5, 'F');
  };

  if (scaledHeight <= usableHeight) {
    // Single page
    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', margin, margin, scaledWidth, scaledHeight);
    addPageFooter(1, 1);
  } else {
    // Multi-page: split the image
    let remainingHeight = scaledHeight;
    let sourceY = 0;
    const pageContentHeight = usableHeight;
    let pageNum = 0;

    while (remainingHeight > 0) {
      if (pageNum > 0) {
        doc.addPage();
      }

      const sliceHeight = Math.min(pageContentHeight, remainingHeight);
      const sourceSliceHeight = (sliceHeight / scaledHeight) * imgHeight;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = imgWidth;
      sliceCanvas.height = sourceSliceHeight;
      const ctx = sliceCanvas.getContext('2d');
      if (!ctx) break;

      ctx.drawImage(
        canvas,
        0, sourceY, imgWidth, sourceSliceHeight,
        0, 0, imgWidth, sourceSliceHeight,
      );

      const sliceData = sliceCanvas.toDataURL('image/png');
      doc.addImage(sliceData, 'PNG', margin, margin, scaledWidth, sliceHeight);

      sourceY += sourceSliceHeight;
      remainingHeight -= pageContentHeight;
      pageNum++;
    }

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addPageFooter(i, totalPages);
    }
  }

  // 7. Save and cleanup
  doc.save(`${safeName(filename)}.pdf`);
  document.body.removeChild(iframe);
}


// ── 4. Print Export (Professional Print Layout) ──────────────

export function exportForPrint(
  data: unknown,
  title: string,
  lang: Language = 'en',
): void {
  const reportData = data as ReportData;
  const htmlContent = buildHTMLReport(reportData, title, lang, 'print');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 800);
  };
}


// ── 5. PNG Export (Chart / Element Capture) ───────────────────

export async function exportChartAsImage(
  elementId: string,
  filename: string,
): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found`);
  }

  const html2canvas = await loadHtml2Canvas();

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
  });

  canvas.toBlob(
    (blob) => {
      if (blob) {
        downloadBlob(blob, `${safeName(filename)}.png`);
      }
    },
    'image/png',
    1.0,
  );
}


// ── 6. CSV Export (utility) ───────────────────────────────────

export function exportAsCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns?: string[],
): void {
  if (data.length === 0) return;

  const cols = columns ?? Object.keys(data[0]);
  const header = cols.join(',');
  const rows = data.map((row) =>
    cols
      .map((col) => {
        const val = row[col];
        const str = val === null || val === undefined ? '' : String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(','),
  );

  const bom = '\uFEFF';
  const csv = bom + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${safeName(filename)}.csv`);
}

// ══════════════════════════════════════════════════════════════
// SERVER-SIDE EXPORTS (call Next.js API routes)
// ══════════════════════════════════════════════════════════════

/** Export PDF via server-side API route (pdfkit) */
export async function exportServerPDF(
  data: unknown,
  filenamePrefix: string,
): Promise<void> {
  const reportData = data as ReportData;
  const response = await fetch('/api/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`PDF export failed: ${response.status} - ${errorText}`);
  }

  const blob = await response.blob();
  downloadBlob(blob, `${safeName(filenamePrefix)}.pdf`);
}

/** Export DOCX via server-side API route (docx library) */
export async function exportServerDOCX(
  data: unknown,
  filenamePrefix: string,
): Promise<void> {
  const reportData = data as ReportData;
  const response = await fetch('/api/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reportData),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`DOCX export failed: ${response.status} - ${errorText}`);
  }

  const blob = await response.blob();
  downloadBlob(blob, `${safeName(filenamePrefix)}.docx`);
}

/** Export ZIP via server-side API route (report.json + report.md + CSVs) */
export async function exportServerZIP(
  data: unknown,
  filenamePrefix: string,
): Promise<void> {
  const reportData = data as ReportData;
  const response = await fetch('/api/export/zip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: reportData, filename: safeName(filenamePrefix) }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`ZIP export failed: ${response.status} - ${errorText}`);
  }

  const blob = await response.blob();
  downloadBlob(blob, `${safeName(filenamePrefix)}.zip`);
}
