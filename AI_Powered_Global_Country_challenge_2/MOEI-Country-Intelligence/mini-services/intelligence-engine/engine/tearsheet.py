"""Executive tear sheet — the sub-30-second fact sheet for a busy minister.

This is the answer to "don't just give me a page of raw data." It distils the
verified dossier into a single decision-ready view that explicitly answers the
questions a diplomat asks before a meeting:
  * where is the economy heading? (GDP/-capita trajectory, CAGR, direction)
  * who do they trade with, and in what goods? (structured Comtrade trade map)
  * which sectors are gaining attention? (momentum sectors, flagship, structural shift)
  * what's the UAE angle? (bilateral trade, agreements, JVs)

The structured builder is PURE (operates on plain dicts; no pydantic, no network)
so it works on already-built countries and is unit-testable offline. The LLM only
writes the narrative "read" ON TOP of this verified structure — it never sources
numbers itself.
"""
from __future__ import annotations

from typing import Dict, List, Optional


# Fields surfaced as the headline KPI strip (with trend where available).
HEADLINE_KEYS = [
    "gdp_nominal_usd", "gdp_per_capita_usd", "gdp_growth_pct",
    "inflation_pct", "unemployment_pct", "fdi_inflow_usd",
]
TRAJECTORY_KEYS = ["gdp_per_capita_usd", "gdp_growth_pct", "exports_usd",
                   "imports_usd", "unemployment_pct", "inflation_pct"]
SECTOR_KEYS = ["gdp_by_sector", "momentum_sectors", "structural_shift",
               "top_exports", "competitiveness_rank"]
ENERGY_KEYS = ["energy_renewable_target", "installed_renewable_capacity",
               "hydrogen_strategy", "major_energy_projects", "electricity_mix"]
SNAPSHOT_KEYS = ["official_name", "capital", "head_of_state", "head_of_government",
                 "population", "currency", "sovereign_credit_rating",
                 "national_vision_strategy", "region"]
UAE_KEYS = ["uae_bilateral_trade", "uae_bilateral_agreements", "uae_joint_ventures",
            "uae_cooperation_areas", "uae_companies_present", "uae_diplomatic_status"]


def _fmt_usd(n: float) -> str:
    n = float(n)
    if abs(n) >= 1e12:
        return f"${n/1e12:.2f}T"
    if abs(n) >= 1e9:
        return f"${n/1e9:.1f}B"
    if abs(n) >= 1e6:
        return f"${n/1e6:.1f}M"
    return f"${n:,.0f}"


def fmt_value(value, unit: Optional[str]) -> str:
    if value is None:
        return "—"
    try:
        n = float(value)
        if unit == "USD":
            return _fmt_usd(n)
        if unit == "%":
            return f"{n:.1f}%"
        if unit == "people":
            return f"{n:,.0f}"
        r = round(n, 2)
        return f"{r:,}".rstrip("0").rstrip(".") + (f" {unit}" if unit else "")
    except (ValueError, TypeError):
        return str(value)


def _field(fields: Dict[str, dict], key: str) -> Optional[dict]:
    f = fields.get(key)
    if f and f.get("found") and f.get("value") is not None:
        return f
    return None


def _kv(fields: Dict[str, dict], keys: List[str]) -> List[dict]:
    out = []
    for k in keys:
        f = _field(fields, k)
        if not f:
            continue
        out.append({
            "key": k, "value": f.get("value"), "unit": f.get("unit"),
            "display": fmt_value(f.get("value"), f.get("unit")),
            "source": f.get("source"), "source_url": f.get("source_url"),
            "as_of": f.get("as_of"),
        })
    return out


def _headline(fields: Dict[str, dict], trends: Dict) -> List[dict]:
    out = []
    for k in HEADLINE_KEYS:
        f = _field(fields, k)
        if not f:
            continue
        item = {
            "key": k, "display": fmt_value(f.get("value"), f.get("unit")),
            "unit": f.get("unit"), "as_of": f.get("as_of"), "source": f.get("source"),
        }
        tr = trends.get(k) if trends else None
        if tr:
            item["trend"] = {
                "direction": tr.get("direction"), "good_up": tr.get("good_up"),
                "span_years": tr.get("span_years"), "spark": tr.get("spark"),
                "delta_pp": tr.get("delta_pp"), "change_pct": tr.get("change_pct"),
                "cagr_pct": tr.get("cagr_pct"),
            }
        out.append(item)
    return out


def _trajectory(trends: Dict) -> List[dict]:
    out = []
    for k in TRAJECTORY_KEYS:
        tr = (trends or {}).get(k)
        if not tr:
            continue
        if tr.get("unit") == "%":
            move = f"{tr.get('delta_pp', 0):+} pp / {tr.get('span_years')}y"
        else:
            move = (f"{tr.get('cagr_pct', 0)}%/yr CAGR · "
                    f"{tr.get('change_pct', 0):+}% over {tr.get('span_years')}y")
        out.append({
            "key": k, "latest": tr.get("latest"), "latest_year": tr.get("latest_year"),
            "unit": tr.get("unit"), "direction": tr.get("direction"),
            "good_up": tr.get("good_up"), "spark": tr.get("spark"), "move": move,
            "display": fmt_value(tr.get("latest"),
                                 "USD" if tr.get("unit") == "USD" else tr.get("unit")),
        })
    return out


def build_tearsheet(country: str, iso3: str, fields: Dict[str, dict],
                    trends: Optional[Dict] = None,
                    trade: Optional[Dict] = None) -> Dict:
    """Pure: assemble the structured executive tear sheet from verified data."""
    trends = trends or {}
    fields = fields or {}
    ts: Dict = {
        "country": country, "iso3": iso3,
        "headline": _headline(fields, trends),
        "trajectory": _trajectory(trends),
        "snapshot": _kv(fields, SNAPSHOT_KEYS),
        "sectors": _kv(fields, SECTOR_KEYS),
        "energy": _kv(fields, ENERGY_KEYS),
        "uae": _kv(fields, UAE_KEYS),
        "trade": trade or None,
        "read": None,
    }
    # quick "what's the story" flags used by the read + UI emphasis
    gpc = trends.get("gdp_per_capita_usd")
    if gpc:
        ts["gdp_per_capita_trend"] = {
            "latest": gpc.get("latest"), "year": gpc.get("latest_year"),
            "cagr_pct": gpc.get("cagr_pct"), "change_pct": gpc.get("change_pct"),
            "direction": gpc.get("direction"), "spark": gpc.get("spark"),
            "span_years": gpc.get("span_years"),
            "display": _fmt_usd(gpc["latest"]) if gpc.get("latest") is not None else None,
        }
    return ts


def tearsheet_facts_text(ts: Dict) -> str:
    """Compact, citable brief of the structured tear sheet for the LLM 'read'."""
    L: List[str] = []
    g = ts.get("gdp_per_capita_trend")
    if g:
        L.append(f"GDP per capita: {g.get('display')} in {g.get('year')}, "
                 f"{g.get('cagr_pct')}%/yr CAGR over {g.get('span_years')}y "
                 f"(direction: {g.get('direction')}).")
    for item in ts.get("trajectory", []):
        L.append(f"{item['key']}: {item['display']} ({item['latest_year']}), {item['move']}.")
    tr = ts.get("trade")
    if tr:
        def names(rows):
            return ", ".join(f"{r['name']} ({r.get('share_pct')}%)" for r in (rows or [])[:5])
        if tr.get("export_partners"):
            L.append(f"Top export partners ({tr.get('year')}): {names(tr['export_partners'])}.")
        if tr.get("import_partners"):
            L.append(f"Top import partners ({tr.get('year')}): {names(tr['import_partners'])}.")
        if tr.get("export_goods"):
            L.append(f"Top exported goods: {names(tr['export_goods'])}.")
        if tr.get("import_goods"):
            L.append(f"Top imported goods: {names(tr['import_goods'])}.")
    for grp, label in (("sectors", "Sectors"), ("energy", "Energy"), ("uae", "UAE links"),
                       ("snapshot", "Profile")):
        for item in ts.get(grp, []):
            val = str(item.get("value"))
            if len(val) > 220:
                val = val[:220] + "…"
            L.append(f"[{label}] {item['key']}: {val}")
    return "\n".join(L) if L else "(no structured facts available)"


# ── the LLM 'read' on top of the verified structure ──────────────────────────

_SYS_EN = """You are the lead strategist briefing a UAE minister before an international
meeting. You are given a VERIFIED structured tear sheet (every number already sourced).
Write a tight, insight-led READ of about 140-180 words, in three short paragraphs with
proper markdown formatting:

## **EXECUTIVE READ**

**1. Trajectory** — where the economy is heading, citing the GDP/-capita CAGR and direction.

**2. Trade & Sectors** — name the actual top trade partners and goods, and the sector(s)
   gaining momentum (e.g. automotive, aerospace, renewables); say what is driving the shift.

**3. The UAE Angle** — the single most actionable cooperation or investment opportunity, plus
   one risk to watch.

Rules: use ONLY the provided facts; do NOT invent figures; be concrete and name names;
Use **bold** for labels and key terms; cite sources in parentheses like (World Bank, 2023);
executive tone with proper markdown structure."""

_SYS_AR = """أنت كبير الاستراتيجيين تُعدّ إحاطة لمعالي وزير إماراتي قبل اجتماع دولي.
لديك بطاقة معلومات منظَّمة ومُتحقَّق منها (كل رقم موثّق بمصدره).
اكتب «خلاصة تحليلية» موجزة ومركّزة (نحو 140–180 كلمة) في ثلاث فقرات قصيرة:

## **الخلاصة التنفيذية**

**١) المسار** — إلى أين يتجه الاقتصاد، مع ذكر معدّل نمو نصيب الفرد من الناتج واتجاهه.

**٢) التجارة والقطاعات** — اذكر بالاسم أهم الشركاء التجاريين والسلع، والقطاع(ات) الصاعدة
   (مثل السيارات، الطيران، الطاقة المتجددة)، وما الذي يقود هذا التحوّل.

**٣) زاوية الإمارات** — أهم فرصة تعاون أو استثمار قابلة للتنفيذ، مع مخاطرة واحدة يجب مراقبتها.

القواعد: استخدم فقط الحقائق المُعطاة؛ لا تختلق أي رقم؛ كن محدّدًا واذكر الأسماء؛
استخدم **عريض** للعناوين والمصطلحات المهمة؛ اذكر المصادر بين قوسين مثل (البنك الدولي، ٢٠٢٣)؛
أسلوب تنفيذي مع تنسيق ماركداون مناسب."""


async def write_read(llm, country: str, ts: Dict, lang: str = "en") -> str:
    """Generate the executive 'read'. llm is an LLMClient; safe to call only when present."""
    agent = "writer_ar" if lang == "ar" else "writer_en"
    sys = _SYS_AR if lang == "ar" else _SYS_EN
    user = (f"Country: {country}\n\nVERIFIED TEAR SHEET:\n{tearsheet_facts_text(ts)}\n\n"
            f"Write THE READ.")
    return await llm.complete(agent, sys, user)
