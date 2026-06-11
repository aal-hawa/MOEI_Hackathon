"""UN Comtrade source client (Tier 1, official) — STRUCTURED bilateral trade.

Answers the questions a diplomat actually asks: *who* are the top export/import
partners, and *what* goods are traded. Numbers come from the UN's official trade
database — not an LLM — so they are deterministic and citable.

Design notes
------------
* The HTTP layer and the PARSER are separated. `summarize_trade()` is a pure
  function over already-fetched rows, so it is unit-testable offline (no network).
* Free by default via the public preview endpoint; if the user sets
  COMTRADE_API_KEY in .env we use the full endpoint (higher limits). Either way,
  a failure degrades gracefully — the pipeline falls back to the LLM trade fields
  and the no-hallucination rule is preserved (no data => NOT FOUND, never a guess).
* Reporter codes are UN M49 numeric. We keep a built-in ISO3->M49 map for common
  countries and fall back to REST Countries (`ccn3`) for anything else.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional, Tuple

try:                       # httpx only needed for live calls; keep parser importable offline
    import httpx
except Exception:          # pragma: no cover
    httpx = None

# Official endpoint needs a subscription key; the public preview does not.
_BASE_PUBLIC = "https://comtradeapi.un.org/public/v1/preview/C/A/HS"
_BASE_FULL = "https://comtradeapi.un.org/data/v1/get/C/A/HS"

# Friendly labels for the HS 2-digit chapters that matter most for energy /
# infrastructure / industrial-strategy conversations. Used to make "what goods"
# human-readable (e.g. chapter 87 -> "Vehicles & automotive").
HS2_LABELS: Dict[str, str] = {
    "27": "Mineral fuels & oil", "85": "Electrical machinery & electronics",
    "84": "Machinery & mechanical appliances", "87": "Vehicles & automotive",
    "88": "Aircraft & aerospace", "99": "Unclassified",
    "71": "Gems & precious metals", "72": "Iron & steel", "73": "Iron/steel articles",
    "39": "Plastics", "29": "Organic chemicals", "30": "Pharmaceuticals",
    "31": "Fertilizers", "25": "Salt, sulphur, cement", "26": "Ores & slag",
    "28": "Inorganic chemicals", "10": "Cereals", "08": "Edible fruit & nuts",
    "07": "Vegetables", "03": "Fish & seafood", "02": "Meat", "04": "Dairy",
    "62": "Apparel (non-knit)", "61": "Apparel (knit)", "64": "Footwear",
    "94": "Furniture & lighting", "90": "Optical/medical instruments",
    "76": "Aluminium", "74": "Copper", "40": "Rubber", "44": "Wood",
    "48": "Paper & paperboard", "52": "Cotton", "15": "Animal/vegetable fats",
    "23": "Animal feed", "17": "Sugars", "22": "Beverages & spirits",
    "12": "Oil seeds", "09": "Coffee, tea & spices", "38": "Misc. chemicals",
    "33": "Essential oils & cosmetics", "54": "Man-made filaments",
    "55": "Man-made staple fibres", "63": "Made-up textiles", "69": "Ceramics",
}

# Built-in ISO3 -> UN M49 numeric for common reporters (heroes + G20 + MENA).
ISO3_TO_M49: Dict[str, str] = {
    "MAR": "504", "ARE": "784", "DEU": "276", "FRA": "250", "BRA": "076",
    "JPN": "392", "SYR": "760", "USA": "842", "CHN": "156", "IND": "356",
    "GBR": "826", "ITA": "380", "ESP": "724", "NLD": "528", "TUR": "792",
    "SAU": "682", "EGY": "818", "QAT": "634", "KWT": "414", "OMN": "512",
    "BHR": "048", "JOR": "400", "DZA": "012", "TUN": "788", "LBY": "434",
    "RUS": "643", "KOR": "410", "CAN": "124", "MEX": "484", "AUS": "036",
    "IDN": "360", "ZAF": "710", "NGA": "566", "KEN": "404", "ETH": "231",
    "GHA": "288", "SEN": "686", "CIV": "384", "PRT": "620", "BEL": "056",
    "CHE": "756", "SWE": "752", "POL": "616", "AUT": "040", "NOR": "578",
    "DNK": "208", "FIN": "246", "IRL": "372", "GRC": "300", "PAK": "586",
    "BGD": "050", "VNM": "704", "THA": "764", "MYS": "458", "SGP": "702",
    "PHL": "608", "IRN": "364", "IRQ": "368", "ISR": "376", "LBN": "422",
    "ARG": "032", "CHL": "152", "COL": "170", "PER": "604", "ROU": "642",
}


async def _resolve_m49(iso3: str, client: httpx.AsyncClient) -> Optional[str]:
    iso3 = (iso3 or "").upper()
    if iso3 in ISO3_TO_M49:
        return ISO3_TO_M49[iso3]
    try:
        r = await client.get(f"https://restcountries.com/v3.1/alpha/{iso3}?fields=ccn3", timeout=12.0)
        r.raise_for_status()
        d = r.json()
        d = d[0] if isinstance(d, list) else d
        ccn3 = d.get("ccn3")
        return str(ccn3) if ccn3 else None
    except Exception:
        return None


def _key() -> Optional[str]:
    return os.getenv("COMTRADE_API_KEY") or None


async def _query(reporter_m49: str, flow: str, period: str, *, partner: str,
                 cmd: str, client: httpx.AsyncClient) -> List[dict]:
    """One Comtrade call. flow: 'X' (export) | 'M' (import). Returns raw rows."""
    params = {
        "reporterCode": reporter_m49, "flowCode": flow, "period": period,
        "partnerCode": partner, "cmdCode": cmd, "partner2Code": "0",
        "customsCode": "C00", "motCode": "0", "includeDesc": "true",
    }
    key = _key()
    base = _BASE_FULL if key else _BASE_PUBLIC
    headers = {"Ocp-Apim-Subscription-Key": key} if key else {}
    r = await client.get(base, params=params, headers=headers, timeout=25.0)
    r.raise_for_status()
    payload = r.json()
    data = payload.get("data") if isinstance(payload, dict) else None
    return data or []


# ── pure parsing (unit-testable, no network) ─────────────────────────────────

def _clean(rows: List[dict], *, by_partner: bool) -> List[dict]:
    """Drop aggregate/world rows; return [{name, value, code}] sorted desc."""
    out = []
    for r in rows or []:
        val = r.get("primaryValue")
        if not val or val <= 0:
            continue
        if by_partner:
            code = str(r.get("partnerCode") or "")
            name = (r.get("partnerDesc") or "").strip()
            # 0 = World aggregate; skip aggregates / unspecified
            if code in ("0", "") or name.lower() in ("world", "areas, nes", "other asia, nes"):
                continue
        else:
            code = str(r.get("cmdCode") or "")
            name = (r.get("cmdDesc") or "").strip()
            if code.upper() in ("TOTAL", "", "AG2") or not code.isdigit():
                continue
            # HS2 chapter -> friendly label when available
            name = HS2_LABELS.get(code.zfill(2), name)
        out.append({"name": name, "value": float(val), "code": code})
    out.sort(key=lambda x: x["value"], reverse=True)
    return out


def _topn(items: List[dict], n: int) -> List[dict]:
    total = sum(i["value"] for i in items) or 1.0
    top = items[:n]
    for i in top:
        i["share_pct"] = round(100.0 * i["value"] / total, 1)
    return top


def summarize_trade(year: int,
                    export_partners: List[dict], import_partners: List[dict],
                    export_goods: List[dict], import_goods: List[dict],
                    top_n: int = 5) -> Dict:
    """Pure: turn raw Comtrade rows into a structured, ranked trade map."""
    return {
        "year": year,
        "export_partners": _topn(_clean(export_partners, by_partner=True), top_n),
        "import_partners": _topn(_clean(import_partners, by_partner=True), top_n),
        "export_goods": _topn(_clean(export_goods, by_partner=False), top_n),
        "import_goods": _topn(_clean(import_goods, by_partner=False), top_n),
    }


def _fmt_usd(v: float) -> str:
    if v >= 1e9:
        return f"${v/1e9:.1f}B"
    if v >= 1e6:
        return f"${v/1e6:.0f}M"
    return f"${v:,.0f}"


def render_list(items: List[dict], *, with_value: bool = True) -> str:
    """Human-readable 'France (24.3%, $12.3B), Spain (21.1%, …)'."""
    parts = []
    for i in items:
        share = f"{i['share_pct']}%" if i.get("share_pct") is not None else ""
        val = _fmt_usd(i["value"]) if with_value else ""
        meta = ", ".join(x for x in (share, val) if x)
        parts.append(f"{i['name']} ({meta})" if meta else i["name"])
    return "; ".join(parts)


def trade_to_fields(summary: Dict, source_url: str, year) -> List:
    """Convert a trade summary into verified FieldValues (Tier-1, cited).
    schema is imported lazily so the pure parser stays importable without pydantic."""
    from ..schema import Confidence, ChangeType, Domain, FieldValue, Provenance

    def prov():
        return Provenance(source_name="UN Comtrade", url=source_url,
                          tier=1, as_of_date=str(year))

    out: List = []
    specs = [
        ("top_export_partners", summary.get("export_partners"), True),
        ("top_import_partners", summary.get("import_partners"), True),
        ("top_exports", summary.get("export_goods"), False),
        ("top_imports", summary.get("import_goods"), False),
    ]
    for name, items, is_partner in specs:
        if not items:
            continue
        text = render_list(items, with_value=True)
        out.append(FieldValue(
            name=name, domain=Domain.economy, value=text, provenance=prov(),
            confidence=Confidence.high, corroborated=True,
            change_type=ChangeType.api_refresh))
    return out


async def build_trade_fields(iso3: str, client: httpx.AsyncClient,
                             top_n: int = 5) -> Tuple[List, Optional[Dict]]:
    """Returns (FieldValues, structured summary|None). Safe: never raises."""
    try:
        summary = await fetch_trade(iso3, client, top_n=top_n)
    except Exception:
        summary = None
    if not summary:
        return [], None
    fields = trade_to_fields(summary, summary.get("source_url", ""), summary.get("year"))
    return fields, summary


async def fetch_trade(iso3: str, client: httpx.AsyncClient,
                      top_n: int = 5, max_years_back: int = 4) -> Optional[Dict]:
    """Full structured trade map for a country, most recent year with data.
    Returns the summary dict (with a `source_url` + `year`) or None on failure."""
    m49 = await _resolve_m49(iso3, client)
    if not m49:
        return None
    import datetime
    this_year = datetime.date.today().year
    for yr in range(this_year - 1, this_year - 1 - max_years_back, -1):
        period = str(yr)
        try:
            xp = await _query(m49, "X", period, partner="", cmd="TOTAL", client=client)
            mp = await _query(m49, "M", period, partner="", cmd="TOTAL", client=client)
            xg = await _query(m49, "X", period, partner="0", cmd="AG2", client=client)
            mg = await _query(m49, "M", period, partner="0", cmd="AG2", client=client)
        except Exception:
            continue
        summary = summarize_trade(yr, xp, mp, xg, mg, top_n=top_n)
        if any(summary[k] for k in ("export_partners", "import_partners",
                                    "export_goods", "import_goods")):
            summary["source_url"] = (
                f"https://comtradeplus.un.org/TradeFlow?Reporter={m49}&Period={yr}")
            return summary
    return None
