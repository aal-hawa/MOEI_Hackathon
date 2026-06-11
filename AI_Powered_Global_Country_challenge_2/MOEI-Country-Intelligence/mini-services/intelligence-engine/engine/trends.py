"""Trends engine — turns point-in-time numbers into TRAJECTORIES.
Pulls ~12 years of history from the World Bank for key indicators and computes
latest, 5-year CAGR (levels) or pp-change (rates), direction, and a sparkline.
All real datapoints — verifiable, no hallucination."""
from __future__ import annotations

from typing import Dict

import httpx

BASE = "https://api.worldbank.org/v2"

# field -> (indicator code, unit, good_when_up)
WB_SERIES = {
    "gdp_per_capita_usd": ("NY.GDP.PCAP.CD",    "USD",  True),
    "gdp_nominal_usd":    ("NY.GDP.MKTP.CD",    "USD",  True),
    "gdp_growth_pct":     ("NY.GDP.MKTP.KD.ZG", "%",    True),
    "inflation_pct":      ("FP.CPI.TOTL.ZG",    "%",    False),
    "unemployment_pct":   ("SL.UEM.TOTL.ZS",    "%",    False),
    "exports_usd":        ("NE.EXP.GNFS.CD",    "USD",  True),
    "imports_usd":        ("NE.IMP.GNFS.CD",    "USD",  True),
    "co2_emissions_per_capita": ("EN.GHG.CO2.PC.CE", "tCO2", False),
}


def _cagr(old, new, n):
    if old and old > 0 and new > 0 and n > 0:
        return (new / old) ** (1 / n) - 1
    return None


async def build_trends(iso3: str, client: httpx.AsyncClient, years: int = 12) -> Dict:
    out: Dict[str, dict] = {}
    for field, (code, unit, good_up) in WB_SERIES.items():
        url = f"{BASE}/country/{iso3}/indicator/{code}?format=json&mrv={years}&per_page=100"
        try:
            r = await client.get(url, timeout=15.0)
            r.raise_for_status()
            payload = r.json()
        except Exception:
            continue
        if not (isinstance(payload, list) and len(payload) > 1 and payload[1]):
            continue
        pts = []
        for row in payload[1]:
            v = row.get("value")
            if v is None:
                continue
            try:
                pts.append((int(row["date"]), float(v)))
            except (ValueError, TypeError):
                pass
        if len(pts) < 2:
            continue
        pts.sort()
        vals = [v for _, v in pts]
        latest_y, latest_v = pts[-1]
        base = min(pts, key=lambda p: abs(p[0] - (latest_y - 5)))
        n = (latest_y - base[0]) or 1
        entry = {"unit": unit, "latest": latest_v, "latest_year": latest_y,
                 "base_year": base[0], "span_years": n, "good_up": good_up,
                 "spark": vals[-10:],
                 "direction": "up" if latest_v > base[1] else ("down" if latest_v < base[1] else "flat"),
                 "source": "World Bank Open Data", "url": url}
        if unit == "%":
            entry["delta_pp"] = round(latest_v - base[1], 2)
        else:
            c = _cagr(base[1], latest_v, n)
            entry["cagr_pct"] = round(c * 100, 1) if c is not None else None
            entry["change_pct"] = round((latest_v / base[1] - 1) * 100, 1) if base[1] else None
        out[field] = entry
    return out


def trends_to_text(trends: Dict) -> str:
    """Compact, citable trend lines for the analyst/writer prompts."""
    if not trends:
        return "(no trend data)"
    lines = []
    for f, t in trends.items():
        if t["unit"] == "%":
            move = f"{t.get('delta_pp', 0):+} pp over {t['span_years']}y"
        else:
            move = f"{t.get('cagr_pct', 0)}%/yr CAGR over {t['span_years']}y ({t.get('change_pct', 0):+}% total)"
        lines.append(f"- {f}: {round(t['latest'],2)} {t['unit']} in {t['latest_year']}, {move}")
    return "\n".join(lines)
