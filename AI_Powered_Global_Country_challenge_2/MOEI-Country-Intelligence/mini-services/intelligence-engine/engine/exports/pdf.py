"""PDF one-pager export (reportlab) — verified dossier + summary + analysis.

Arabic-aware: when lang='ar' it registers an Arabic-capable font, shapes + bidi-
orders the text, and lays the document out right-to-left. Falls back gracefully to
Latin fonts if no Arabic font is available (so it never crashes)."""
from __future__ import annotations

import re
from datetime import datetime
from ..timeutils import now_uae
from io import BytesIO
from typing import Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

from .arabic import register_pdf_font, shape

GOLD = colors.HexColor("#9C7A2D")
INK = colors.HexColor("#2B2B2B")
MUTED = colors.HexColor("#6F6A60")
CREAM = colors.HexColor("#F7F2E8")
WHITE = colors.white

DOMAIN_LABELS = {
    "en": {
        "identity": "Identity & Governance", "economy": "Economy & Trade", "energy": "Energy",
        "infrastructure": "Infrastructure", "sustainability": "Sustainability",
        "innovation": "Innovation & Smart Cities", "uae_relations": "UAE Relationship",
        "news": "Real-time",
    },
    "ar": {
        "identity": "الهوية والحوكمة", "economy": "الاقتصاد والتجارة", "energy": "الطاقة",
        "infrastructure": "البنية التحتية", "sustainability": "الاستدامة",
        "innovation": "الابتكار والمدن الذكية", "uae_relations": "العلاقة مع الإمارات",
        "news": "الزمن الحقيقي",
    },
}

UI = {
    "en": {"eyebrow": "MINISTRY OF ENERGY & INFRASTRUCTURE — COUNTRY INTELLIGENCE",
           "generated": "Generated", "verified": "every figure source-verified",
           "field": "Field", "value": "Value", "source": "Source · Year",
           "summary": "Executive Summary", "talking": "Talking Points",
           "analysis": "Opportunities & Risks (analysis)", "predictive": "Predictive Outlook (projection)",
           "council": "The Council — Verdict", "kpis": "Key Indicators",
           "appendix": "Verified Data Appendix", "platform": "MOEI Country Intelligence Platform"},
    "ar": {"eyebrow": "وزارة الطاقة والبنية التحتية — الذكاء القُطري",
           "generated": "أُنشئ في", "verified": "كل رقم مُتحقَّق من مصدره",
           "field": "الحقل", "value": "القيمة", "source": "المصدر · السنة",
           "summary": "الملخص التنفيذي", "talking": "نقاط الحديث",
           "analysis": "الفرص والمخاطر (تحليل)", "predictive": "التوقعات المستقبلية (إسقاط)",
           "council": "المجلس — الحكم", "kpis": "المؤشرات الرئيسية",
           "appendix": "ملحق البيانات المُتحقَّقة", "platform": "منصة الذكاء القُطري"},
}

KPI_FIELDS = [("gdp_nominal_usd", "GDP (nominal)"), ("gdp_per_capita_usd", "GDP / capita"),
              ("gdp_growth_pct", "GDP growth"), ("population", "Population"),
              ("inflation_pct", "Inflation"), ("fdi_inflow_usd", "FDI inflow")]

# field_name -> Arabic label (mirrors the web LABELS.ar)
FIELD_AR = {
    "official_name": "الاسم الرسمي", "capital": "العاصمة", "region": "المنطقة",
    "languages": "اللغات", "currency": "العملة", "timezone": "المنطقة الزمنية", "flag": "العلم",
    "political_system": "النظام السياسي", "head_of_state": "رئيس الدولة",
    "head_of_government": "رئيس الحكومة", "key_decision_makers": "صنّاع القرار",
    "sovereign_wealth_funds": "صناديق الثروة السيادية", "national_vision_strategy": "الرؤية الوطنية",
    "gdp_nominal_usd": "الناتج المحلي الإجمالي", "gdp_per_capita_usd": "نصيب الفرد من الناتج",
    "gdp_growth_pct": "نمو الناتج", "inflation_pct": "التضخّم", "unemployment_pct": "البطالة",
    "population": "عدد السكان", "exports_usd": "الصادرات", "imports_usd": "الواردات",
    "fdi_inflow_usd": "الاستثمار الأجنبي", "sovereign_credit_rating": "التصنيف الائتماني",
    "top_export_partners": "أهم شركاء التصدير", "top_import_partners": "أهم شركاء الاستيراد",
    "top_exports": "أهم الصادرات", "top_imports": "أهم الواردات",
    "momentum_sectors": "القطاعات الصاعدة", "structural_shift": "التحوّل الهيكلي",
    "gdp_by_sector": "الناتج حسب القطاع", "electricity_mix": "مزيج الكهرباء",
    "energy_renewable_target": "هدف الطاقة المتجددة", "hydrogen_strategy": "استراتيجية الهيدروجين",
    "major_energy_projects": "مشاريع الطاقة الكبرى", "uae_bilateral_trade": "التجارة مع الإمارات",
    "uae_bilateral_agreements": "اتفاقيات مع الإمارات", "uae_joint_ventures": "مشاريع مشتركة مع الإمارات",
}


def _field_label(name: str, lang: str) -> str:
    if lang == "ar" and name in FIELD_AR:
        return FIELD_AR[name]
    return name.replace("_", " ")


def _fmt(value, unit) -> str:
    if value is None:
        return "—"
    try:
        n = float(value)
        if unit == "USD":
            return f"${n/1e9:.1f}B" if abs(n) >= 1e9 else (f"${n/1e6:.1f}M" if abs(n) >= 1e6 else f"${n:,.0f}")
        if unit == "%":
            return f"{n:.1f}%"
        if unit == "people":
            return f"{n:,.0f}"
    except (ValueError, TypeError):
        pass
    return str(value)


def build_pdf(country: str, iso3: str, rows: List[Dict],
              summary: Optional[str] = None, analysis: Optional[str] = None,
              talking_points: Optional[str] = None, predictive: Optional[str] = None,
              lang: str = "en", council: Optional[str] = None) -> bytes:
    ar = (lang == "ar")
    font = register_pdf_font() if ar else None
    base_font = font or "Helvetica"
    bold_font = font or "Helvetica-Bold"     # the Arabic TTF carries its own weight
    align = TA_RIGHT if ar else TA_LEFT
    ui = UI["ar" if ar else "en"]

    def tx(s: str) -> str:
        """Prepare a string for the PDF: shape Arabic when needed."""
        return shape(s) if ar else (s or "")

    def md(text: str) -> str:
        t = (text or "")
        # strip citation-link artifacts before escaping
        t = re.sub(r"\(\s*\[[^\]]*\]\([^)]*\)\s*\)", "", t)
        t = re.sub(r"\[([^\]]*)\]\((?:https?:)[^)]*\)", r"\1", t)
        t = re.sub(r"\(\s*https?://[^)]*\)", "", t)
        t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
        t = re.sub(r"^#{1,4}\s*", "", t, flags=re.M)
        # bullets: "- x" -> "• x"
        t = re.sub(r"(?:^|\n)\s*[-•]\s+", "\n•  ", t)
        if ar:
            t = "<br/>".join(shape(line) for line in t.split("\n"))
        else:
            t = t.replace("\n", "<br/>")
        return t

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=14 * mm, bottomMargin=14 * mm, title=f"{country} brief")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=INK, fontSize=22, spaceAfter=2,
                        fontName=bold_font, alignment=align)
    eyebrow = ParagraphStyle("eb", parent=ss["Normal"], textColor=GOLD, fontSize=10, spaceAfter=8,
                             fontName=base_font, alignment=align)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=GOLD, fontSize=13, spaceBefore=10,
                        spaceAfter=4, fontName=bold_font, alignment=align)
    body = ParagraphStyle("body", parent=ss["Normal"], textColor=INK, fontSize=9.5, leading=15,
                          fontName=base_font, alignment=align, wordWrap=("RTL" if ar else None))
    cell = ParagraphStyle("cell", parent=ss["Normal"], textColor=INK, fontSize=8.5, leading=12,
                          fontName=base_font, alignment=align, wordWrap=("RTL" if ar else None))
    src = ParagraphStyle("src", parent=ss["Normal"], textColor=MUTED, fontSize=7.5, leading=10,
                         fontName=base_font, alignment=align)

    kpi_v = ParagraphStyle("kpiv", parent=ss["Normal"], textColor=INK, fontSize=15,
                           leading=18, fontName=bold_font, alignment=1)
    kpi_l = ParagraphStyle("kpil", parent=ss["Normal"], textColor=MUTED, fontSize=7.5,
                           leading=10, fontName=base_font, alignment=1)

    title_line = f"{tx(country)} <font color='#6F6A60' size=12>({iso3})</font>"
    story = [Paragraph(tx(ui["eyebrow"]), eyebrow),
             Paragraph(title_line, h1),
             Paragraph(f"{tx(ui['generated'])} {now_uae():%d %b %Y} · {tx(ui['verified'])}", src),
             Spacer(1, 8)]

    by = {r["field_name"]: r for r in rows}

    # ── KPI strip (6 cards) ──
    kcells = []
    for k, lbl in KPI_FIELDS:
        r = by.get(k)
        if not r or r.get("value") is None:
            continue
        lab = (FIELD_AR.get(k, lbl) if ar else lbl)
        kcells.append([Paragraph(tx(_fmt(r["value"], r.get("unit"))), kpi_v),
                       Paragraph(tx(lab), kpi_l)])
    if kcells:
        kcells = kcells[:6]
        kt = Table([[Table(c, colWidths=[29 * mm]) for c in kcells]],
                   colWidths=[30 * mm] * len(kcells))
        kt.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), CREAM),
            ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
            ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E6DCC4")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story += [kt, Spacer(1, 10)]

    # ── narrative first: the report a minister actually reads ──
    def _narrative_block(text, label, accent=GOLD, bg=WHITE):
        if not text:
            return
        story.append(Paragraph(tx(label), h2))
        p = Paragraph(md(text), body)
        boxed = Table([[p]], colWidths=[178 * mm])
        boxed.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), bg),
            ("LINEBEFORE" if not ar else "LINEAFTER", (0, 0), (0, -1), 2.2, accent),
            ("LEFTPADDING", (0, 0), (-1, -1), 10), ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]))
        story.append(boxed)

    TEAL = colors.HexColor("#2C7A6B")
    BRICK = colors.HexColor("#A6492F")
    _narrative_block(summary, ui["summary"], GOLD, CREAM)
    _narrative_block(talking_points, ui["talking"], GOLD, WHITE)
    _narrative_block(analysis, ui["analysis"], TEAL, colors.HexColor("#F4FAF8"))
    _narrative_block(predictive, ui["predictive"], BRICK, colors.HexColor("#FBF4F1"))
    _narrative_block(council, ui["council"], GOLD, colors.HexColor("#F3ECDC"))

    # ── verified data appendix ──
    by_domain: Dict[str, List[Dict]] = {}
    for r in rows:
        by_domain.setdefault(r.get("domain") or "other", []).append(r)

    story.append(Spacer(1, 8))
    story.append(Paragraph(tx(ui["appendix"]), h2))

    dom_labels = DOMAIN_LABELS["ar" if ar else "en"]
    for dom in ["identity", "economy", "energy", "infrastructure", "sustainability",
                "innovation", "uae_relations", "news"]:
        items = [r for r in by_domain.get(dom, []) if r.get("value") is not None]
        if not items:
            continue
        story.append(Paragraph(tx(dom_labels.get(dom, dom.title())), h2))
        head = [Paragraph(f"<b>{tx(ui['field'])}</b>", cell),
                Paragraph(f"<b>{tx(ui['value'])}</b>", cell),
                Paragraph(f"<b>{tx(ui['source'])}</b>", cell)]
        tdata = [head[::-1] if ar else head]
        for r in items:
            val = _fmt(r["value"], r.get("unit"))
            row_cells = [
                Paragraph(tx(_field_label(r["field_name"], lang)), cell),
                Paragraph(md(val)[:600], cell),
                Paragraph(f"{r.get('source_name','')} · {r.get('as_of_date','')}", src),
            ]
            tdata.append(row_cells[::-1] if ar else row_cells)
        widths = [42 * mm, 78 * mm, 58 * mm]
        t = Table(tdata, colWidths=(widths[::-1] if ar else widths))
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), GOLD),
            ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#E6DCC4")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, CREAM]),
            ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(t)

    # ── branded footer with page numbers ──
    plat = ui["platform"]

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setStrokeColor(GOLD); canvas.setLineWidth(1.2)
        canvas.line(16 * mm, 11 * mm, A4[0] - 16 * mm, 11 * mm)
        canvas.setFont("Helvetica", 7); canvas.setFillColor(MUTED)
        canvas.drawString(16 * mm, 7.5 * mm, f"{country} ({iso3})  ·  {plat if not ar else 'MOEI Country Intelligence Platform'}")
        canvas.drawRightString(A4[0] - 16 * mm, 7.5 * mm, str(canvas.getPageNumber()))
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buf.getvalue()
