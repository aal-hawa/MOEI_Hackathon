"""Media Generator renderer — draws the one-pager from VERIFIED data.

Optional `spec` (from the Media Generator's AI brain) chooses the headline,
caption, and which fields to feature — but every number is pulled from the
verified rows here, never from the AI. Premium MOEI bronze-gold SVG one-pager:
dark masthead, hero KPI, two-column highlight cards, UAE-angle band.
"""
from __future__ import annotations

from ..timeutils import now_uae
from typing import Dict, List, Optional, Tuple

GOLD, GOLD_L, GOLD_PALE, CREAM = "#9C7A2D", "#C8A84B", "#F3ECDC", "#F7F2E8"
INK, INK_SOFT, MUTED, TEAL, TEAL_PALE = "#2B2B2B", "#3A3A3A", "#6F6A60", "#2C7A6B", "#EAF4F1"
BORDER, WHITE, CREAM_TXT = "#E6DCC4", "#FFFFFF", "#EFE8D8"

HERO_KPI = "gdp_nominal_usd"
DEFAULT_KPIS = ["gdp_per_capita_usd", "gdp_growth_pct", "population",
                "inflation_pct", "renewable_energy_consumption_pct", "fdi_inflow_usd",
                "unemployment_pct"]
DEFAULT_HIGHLIGHTS = ["head_of_state", "national_vision_strategy", "major_energy_projects",
                      "net_zero_target", "energy_renewable_target", "smart_city_initiatives"]
UAE_KEYS = ["uae_investments", "uae_bilateral_trade", "uae_bilateral_agreements",
            "uae_cooperation_areas"]
ICONS = {"head_of_state": "👤", "head_of_government": "🏛", "national_vision_strategy": "🎯",
         "net_zero_target": "🌱", "energy_renewable_target": "☀", "major_energy_projects": "⚡",
         "smart_city_initiatives": "💡", "hydrogen_strategy": "🔋", "major_ports": "⚓",
         "infrastructure_project_pipeline": "🚆", "sovereign_credit_rating": "🏦"}
LABELS = {
    "gdp_nominal_usd": "GDP (nominal)", "gdp_per_capita_usd": "GDP / capita",
    "gdp_growth_pct": "GDP growth", "population": "Population", "inflation_pct": "Inflation",
    "renewable_energy_consumption_pct": "Renewable energy", "fdi_inflow_usd": "FDI inflow",
    "unemployment_pct": "Unemployment", "head_of_state": "Head of state",
    "head_of_government": "Head of government", "national_vision_strategy": "National vision",
    "net_zero_target": "Net-zero target", "energy_renewable_target": "Renewable target",
    "major_energy_projects": "Energy projects", "smart_city_initiatives": "Smart cities",
    "hydrogen_strategy": "Hydrogen strategy", "sovereign_credit_rating": "Credit rating",
    "uae_investments": "UAE investments", "uae_bilateral_trade": "Bilateral trade",
    "uae_bilateral_agreements": "Agreements / MoUs", "uae_cooperation_areas": "Cooperation areas",
}
LABELS_AR = {
    "gdp_nominal_usd": "الناتج المحلي", "gdp_per_capita_usd": "نصيب الفرد",
    "gdp_growth_pct": "نمو الناتج", "population": "عدد السكان", "inflation_pct": "التضخّم",
    "renewable_energy_consumption_pct": "الطاقة المتجددة", "fdi_inflow_usd": "الاستثمار الأجنبي",
    "unemployment_pct": "البطالة", "head_of_state": "رئيس الدولة",
    "head_of_government": "رئيس الحكومة", "national_vision_strategy": "الرؤية الوطنية",
    "net_zero_target": "هدف الحياد الكربوني", "energy_renewable_target": "هدف الطاقة المتجددة",
    "major_energy_projects": "مشاريع الطاقة", "smart_city_initiatives": "المدن الذكية",
    "hydrogen_strategy": "استراتيجية الهيدروجين", "sovereign_credit_rating": "التصنيف الائتماني",
    "uae_investments": "الاستثمارات الإماراتية", "uae_bilateral_trade": "التجارة الثنائية",
    "uae_bilateral_agreements": "الاتفاقيات", "uae_cooperation_areas": "مجالات التعاون",
}
UI = {
    "en": {"ministry": "MINISTRY OF ENERGY &amp; INFRASTRUCTURE",
           "tagline": "Country Intelligence — source-verified, no hallucination",
           "headline": "Country Intelligence Brief", "coverage": "data coverage",
           "highlights": "STRATEGIC HIGHLIGHTS", "uae": "THE UAE ANGLE",
           "sources": "Sources: World Bank · IMF · UN Comtrade · REST Countries · official sources — every figure carries its source and year.",
           "generated": "Generated", "platform": "MOEI Country Intelligence Platform",
           "verified": "verified facts"},
    "ar": {"ministry": "وزارة الطاقة والبنية التحتية",
           "tagline": "الذكاء القُطري — مُتحقَّق من المصادر، بلا هلوسة",
           "headline": "موجز الذكاء القُطري", "coverage": "تغطية البيانات",
           "highlights": "أبرز النقاط الاستراتيجية", "uae": "زاوية الإمارات",
           "sources": "المصادر: البنك الدولي · صندوق النقد · UN Comtrade · مصادر رسمية — كل رقم يحمل مصدره وسنته.",
           "generated": "أُنشئ في", "platform": "منصة الذكاء القُطري — وزارة الطاقة والبنية التحتية",
           "verified": "حقيقة مُتحقَّقة"},
}
AR_FONT = "'Noto Sans Arabic','Dubai','Tahoma','Segoe UI',sans-serif"


def _esc(s) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _label(f, lang="en") -> str:
    if lang == "ar" and f in LABELS_AR:
        return LABELS_AR[f]
    return LABELS.get(f, f.replace("_", " ").title())


def _fmt(value, unit) -> str:
    if value is None:
        return "—"
    try:
        n = float(value)
        if unit == "USD":
            if abs(n) >= 1e12: return f"${n/1e12:.2f}T"
            if abs(n) >= 1e9: return f"${n/1e9:.1f}B"
            if abs(n) >= 1e6: return f"${n/1e6:.1f}M"
            return f"${n:,.0f}"
        if unit == "%":
            return f"{n:.1f}%"
        if unit == "people":
            if n >= 1e6: return f"{n/1e6:.1f}M"
            return f"{n:,.0f}"
    except (ValueError, TypeError):
        pass
    return str(value)


def _wrap(s: str, width: int, maxlines: int) -> List[str]:
    words = str(s).split()
    lines: List[str] = []
    cur = ""
    for w in words:
        if len(cur) + len(w) + 1 <= width:
            cur = (cur + " " + w).strip()
        else:
            lines.append(cur)
            cur = w
            if len(lines) == maxlines:
                break
    if cur and len(lines) < maxlines:
        lines.append(cur)
    if len(lines) == maxlines and len(" ".join(words)) > sum(len(l) for l in lines) + maxlines:
        lines[-1] = lines[-1][:width - 1].rstrip() + "…"
    return lines


def build_infographic_svg(country: str, iso3: str, rows: List[Dict],
                          coverage: Optional[float] = None, spec: Optional[dict] = None,
                          lang: str = "en") -> str:
    ar = (lang == "ar")
    ui = UI["ar" if ar else "en"]
    by = {r["field_name"]: r for r in rows}
    spec = spec or {}
    found = sum(1 for r in rows if r.get("value") is not None)
    if coverage is None:
        coverage = found / max(len(rows), 1)
    pct = round(coverage * 100)

    # featured fields — the Visualizer agent's creative choices, verified-only
    hero_key = spec.get("hero_kpi") if (spec.get("hero_kpi") in by and
                                        by[spec["hero_kpi"]].get("value") is not None) else HERO_KPI
    kpis = [f for f in spec.get("featured_kpis", [])
            if f != hero_key and by.get(f) and by[f].get("value") is not None]
    kpis = (kpis or [f for f in DEFAULT_KPIS if f != hero_key and by.get(f)
                     and by[f].get("value") is not None])[:6]
    highs = [f for f in spec.get("highlight_fields", []) if by.get(f) and by[f].get("value") is not None]
    highs = (highs or [f for f in DEFAULT_HIGHLIGHTS if by.get(f) and by[f].get("value") is not None])[:6]
    notes = spec.get("highlight_notes") or {}
    uae = [(k, by[k]) for k in UAE_KEYS if by.get(k) and by[k].get("value") is not None][:2]
    hero = by.get(hero_key) if by.get(hero_key, {}).get("value") is not None else None
    headline = spec.get("headline") or ui["headline"]
    subtitle = spec.get("subtitle") or ""
    caption = spec.get("caption") or ""
    pull_quote = spec.get("pull_quote") or ""
    # theme: the agent picks the mood; we map it to brand-safe palettes
    theme = spec.get("theme") or "dark"
    MAST = {"dark": INK, "light": "#FFFFFF", "teal": "#1F574C"}.get(theme, INK)
    MAST_TXT = {"dark": WHITE, "light": INK, "teal": WHITE}.get(theme, WHITE)
    MAST_SUB = {"dark": CREAM_TXT, "light": MUTED, "teal": "#CFE6E0"}.get(theme, CREAM_TXT)
    MAST_DIM = {"dark": "#9B958A", "light": MUTED, "teal": "#9FC4BB"}.get(theme, "#9B958A")
    MAST_ACC = {"dark": INK_SOFT, "light": GOLD_PALE, "teal": "#28614F"}.get(theme, INK_SOFT)

    W = 900
    fam = AR_FONT if ar else "Segoe UI, Helvetica, Arial, sans-serif"
    ta = "end" if ar else "start"
    tx = (W - 48) if ar else 48
    s: List[str] = []

    # ── masthead (theme chosen by the Visualizer agent) ──
    HEAD_H = 276 if subtitle else 252
    body: List[str] = []
    body.append(f'<rect width="{W}" height="{HEAD_H}" fill="{MAST}"/>')
    body.append(f'<rect width="{W}" height="8" fill="{GOLD}"/>')
    if theme == "light":
        body.append(f'<rect y="{HEAD_H-2}" width="{W}" height="2" fill="{BORDER}"/>')
    # subtle hex accents
    ax = 60 if ar else W - 60
    body.append(f'<text x="{ax}" y="86" text-anchor="middle" font-size="64" fill="{MAST_ACC}">⬢</text>')
    body.append(f'<text x="{ax}" y="150" text-anchor="middle" font-size="40" fill="{MAST_ACC}">⬢</text>')
    cx = (W - 70) if ar else 70
    hx = (W - 104) if ar else 104
    body.append(f'<circle cx="{cx}" cy="58" r="20" fill="none" stroke="{GOLD}" stroke-width="1.6"/>')
    body.append(f'<text x="{cx}" y="65" text-anchor="middle" font-size="17" font-weight="800" fill="{GOLD}">⬢</text>')
    body.append(f'<text x="{hx}" y="52" text-anchor="{ta}" font-size="12.5" font-weight="800" letter-spacing="1.5" fill="{GOLD_L if theme != "light" else GOLD}">{ui["ministry"]}</text>')
    body.append(f'<text x="{hx}" y="71" text-anchor="{ta}" font-size="10.5" fill="{MAST_DIM}">{ui["tagline"]}</text>')
    body.append(f'<text x="{tx}" y="124" text-anchor="{ta}" font-size="12" font-weight="800" letter-spacing="2.5" fill="{GOLD_L if theme != "light" else GOLD}">{_esc(headline.upper() if not ar else headline)}</text>')
    body.append(f'<text x="{tx}" y="172" text-anchor="{ta}" font-size="48" font-weight="800" fill="{MAST_TXT}">{_esc(country)}</text>')
    suby = 198
    if subtitle:
        body.append(f'<text x="{tx}" y="{suby}" text-anchor="{ta}" font-size="15" font-weight="600" fill="{MAST_SUB}">{_esc(subtitle[:90])}</text>')
        suby += 20
    if caption:
        for i, ln in enumerate(_wrap(caption, 96, 2)):
            body.append(f'<text x="{tx}" y="{suby + i*16}" text-anchor="{ta}" font-size="12.5" fill="{MAST_SUB}">{_esc(ln)}</text>')
    # stat pills row inside masthead
    pill_y = HEAD_H - 30
    pills = [f"{iso3}", f"{pct}% {ui['coverage']}", f"{found} {ui['verified']}"]
    px = (W - 48) if ar else 48
    for p in pills:
        wpx = 9 * len(p) + 26
        rx = (px - wpx) if ar else px
        body.append(f'<rect x="{rx}" y="{pill_y - 16}" width="{wpx}" height="24" rx="12" fill="none" stroke="{GOLD}" stroke-width="1"/>')
        body.append(f'<text x="{rx + wpx/2}" y="{pill_y}" text-anchor="middle" font-size="11.5" font-weight="700" fill="{GOLD_L if theme != "light" else GOLD}">{_esc(p)}</text>')
        px = (px - wpx - 12) if ar else (px + wpx + 12)
    s += body

    y = HEAD_H + 34

    # ── hero KPI + KPI grid ──
    GX, GAP = 48, 14
    grid_w = W - 2 * GX
    if hero:
        hero_w = int(grid_w * 0.36)
        cell_w = (grid_w - hero_w - 2 * GAP) // 2
    else:
        hero_w = 0
        cell_w = (grid_w - 2 * GAP) // 3
    cell_h, rows_n = 104, (len(kpis) + (2 if hero else 3) - 1) // (2 if hero else 3)
    rows_n = max(rows_n, 1)
    block_h = rows_n * (cell_h + GAP) - GAP
    if hero:
        hx0 = (W - GX - hero_w) if ar else GX
        s.append(f'<rect x="{hx0}" y="{y}" width="{hero_w}" height="{block_h}" rx="14" fill="{INK}"/>')
        s.append(f'<rect x="{hx0}" y="{y}" width="{hero_w}" height="6" rx="3" fill="{GOLD}"/>')
        hr = hero
        s.append(f'<text x="{hx0 + hero_w/2}" y="{y + block_h/2 - 14}" text-anchor="middle" font-size="44" font-weight="800" fill="{GOLD_L}">{_esc(_fmt(hr.get("value"), hr.get("unit")))}</text>')
        s.append(f'<text x="{hx0 + hero_w/2}" y="{y + block_h/2 + 14}" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1" fill="{CREAM_TXT}">{_esc(_label(HERO_KPI, lang).upper() if not ar else _label(HERO_KPI, lang))}</text>')
        src = f'{hr.get("source_name","")}, {hr.get("as_of_date","")}'
        s.append(f'<text x="{hx0 + hero_w/2}" y="{y + block_h/2 + 36}" text-anchor="middle" font-size="9.5" fill="#9B958A">{_esc(src[:52])}</text>')
    per_row = 2 if hero else 3
    for i, key in enumerate(kpis[:per_row * rows_n]):
        r = by[key]
        col, rw = i % per_row, i // per_row
        if ar:
            x = W - GX - hero_w - (GAP + cell_w) * (col + 1) + 0 if hero else W - GX - (cell_w + GAP) * col - cell_w
            if hero:
                x = W - GX - hero_w - GAP - cell_w - col * (cell_w + GAP)
        else:
            x = GX + (hero_w + GAP if hero else 0) + col * (cell_w + GAP)
        yy = y + rw * (cell_h + GAP)
        s.append(f'<rect x="{x}" y="{yy}" width="{cell_w}" height="{cell_h}" rx="12" fill="{WHITE}" stroke="{BORDER}" stroke-width="1.2"/>')
        s.append(f'<rect x="{x}" y="{yy}" width="5" height="{cell_h}" rx="2.5" fill="{GOLD}"/>')
        s.append(f'<text x="{x+20}" y="{yy+42}" font-size="26" font-weight="800" fill="{INK}">{_esc(_fmt(r.get("value"), r.get("unit")))}</text>')
        s.append(f'<text x="{x+20}" y="{yy+64}" font-size="11.5" font-weight="700" fill="{MUTED}">{_esc(_label(key, lang))}</text>')
        src = f'{r.get("source_name","")}, {r.get("as_of_date","")}'
        s.append(f'<text x="{x+20}" y="{yy+86}" font-size="9" fill="{MUTED}">{_esc(src[:42])}</text>')
    y += block_h + 38

    # ── strategic highlights (2-column cards, wrapped text) ──
    if highs:
        s.append(f'<text x="{tx}" y="{y}" text-anchor="{ta}" font-size="14" font-weight="800" letter-spacing="2" fill="{GOLD}">{ui["highlights"]}</text>')
        s.append(f'<rect x="{GX}" y="{y+10}" width="{grid_w}" height="2" fill="{GOLD_PALE}"/>')
        y += 26
        col_w = (grid_w - GAP) // 2
        card_h = 96
        for i, key in enumerate(highs):
            r = by[key]
            col, rw = i % 2, i // 2
            x = (W - GX - col_w - col * (col_w + GAP)) if ar else (GX + col * (col_w + GAP))
            yy = y + rw * (card_h + GAP)
            s.append(f'<rect x="{x}" y="{yy}" width="{col_w}" height="{card_h}" rx="12" fill="{WHITE}" stroke="{BORDER}" stroke-width="1.2"/>')
            # icon chip
            icx = (x + col_w - 28) if ar else (x + 28)
            s.append(f'<circle cx="{icx}" cy="{yy+30}" r="15" fill="{GOLD_PALE}"/>')
            s.append(f'<text x="{icx}" y="{yy+35}" text-anchor="middle" font-size="14">{ICONS.get(key, "◆")}</text>')
            lx = (x + col_w - 52) if ar else (x + 52)
            la = "end" if ar else "start"
            s.append(f'<text x="{lx}" y="{yy+26}" text-anchor="{la}" font-size="11.5" font-weight="800" fill="{GOLD}">{_esc(_label(key, lang))}</text>')
            wrap_x = (x + col_w - 18) if ar else (x + 18)
            for j, ln in enumerate(_wrap(str(r.get("value")), 56, 2)):
                s.append(f'<text x="{wrap_x}" y="{yy + 50 + j*17}" text-anchor="{la}" font-size="12" fill="{INK}">{_esc(ln)}</text>')
            src = r.get("source_name") or ""
            if src:
                s.append(f'<text x="{wrap_x}" y="{yy + card_h - 9}" text-anchor="{la}" font-size="8.5" fill="{MUTED}">{_esc(src[:48])}{(" · " + str(r.get("as_of_date"))) if r.get("as_of_date") else ""}</text>')
        y += ((len(highs) + 1) // 2) * (card_h + GAP) + 24

    # ── UAE angle band ──
    if uae:
        band_h = 64 + 58 * len(uae)
        s.append(f'<rect x="{GX}" y="{y}" width="{grid_w}" height="{band_h}" rx="14" fill="{TEAL_PALE}" stroke="{TEAL}" stroke-width="1.2"/>')
        s.append(f'<rect x="{GX}" y="{y}" width="6" height="{band_h}" rx="3" fill="{TEAL}"/>')
        s.append(f'<text x="{(W - GX - 22) if ar else (GX + 22)}" y="{y+30}" text-anchor="{ta}" font-size="13" font-weight="800" letter-spacing="2" fill="{TEAL}">🇦🇪 {ui["uae"]}</text>')
        uy = y + 56
        ux = (W - GX - 22) if ar else (GX + 22)
        ua = "end" if ar else "start"
        for key, r in uae:
            s.append(f'<text x="{ux}" y="{uy}" text-anchor="{ua}" font-size="11.5" font-weight="800" fill="{TEAL}">{_esc(_label(key, lang))}</text>')
            for j, ln in enumerate(_wrap(str(r.get("value")), 108, 2)):
                s.append(f'<text x="{ux}" y="{uy + 17 + j*15}" text-anchor="{ua}" font-size="11.5" fill="{INK}">{_esc(ln)}</text>')
            uy += 58
        y += band_h + 26

    # ── footer band ──
    FOOT_H = 64
    H = y + FOOT_H
    s.append(f'<rect x="0" y="{y}" width="{W}" height="{FOOT_H}" fill="{INK}"/>')
    s.append(f'<rect x="0" y="{y}" width="{W}" height="3" fill="{GOLD}"/>')
    s.append(f'<text x="{tx}" y="{y+26}" text-anchor="{ta}" font-size="9.5" fill="#9B958A">{ui["sources"]}</text>')
    s.append(f'<text x="{tx}" y="{y+44}" text-anchor="{ta}" font-size="9.5" fill="{GOLD_L}">{ui["generated"]} {now_uae():%d %b %Y} · {ui["platform"]}</text>')

    head = (f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" '
            f'direction="{"rtl" if ar else "ltr"}" font-family="{fam}">'
            f'<rect width="{W}" height="{H}" fill="{CREAM}"/>')
    return head + "\n" + "\n".join(s) + "\n</svg>"
