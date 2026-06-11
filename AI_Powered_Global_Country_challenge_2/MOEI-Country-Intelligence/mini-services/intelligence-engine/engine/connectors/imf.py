"""IMF WEO source client (Tier 1, free) — current-year + forecast ESTIMATES."""
from __future__ import annotations
from datetime import datetime
from typing import List
import httpx
from ..timeutils import now_uae
from ..schema import Confidence, Domain, FieldValue, Provenance

BASE = "https://www.imf.org/external/datamapper/api/v1"

# field -> (imf code, domain, unit, multiplier)
IMF_CATALOG = {
    "gdp_nominal_usd":    ("NGDPD",       Domain.economy, "USD",        1e9),
    "gdp_per_capita_usd": ("NGDPDPC",     Domain.economy, "USD",        1.0),
    "gdp_growth_pct":     ("NGDP_RPCH",   Domain.economy, "%",          1.0),
    "inflation_pct":      ("PCPIPCH",     Domain.economy, "%",          1.0),
    "unemployment_pct":   ("LUR",         Domain.economy, "%",          1.0),
    "population":         ("LP",          Domain.economy, "people",     1e6),
    "govt_debt_pct_gdp":  ("GGXWDG_NGDP", Domain.economy, "% of GDP",   1.0),
}


async def fetch_imf(iso3: str, fields: List[str], client: httpx.AsyncClient) -> List[FieldValue]:
    out: List[FieldValue] = []
    year = now_uae().year
    for f in fields:
        if f not in IMF_CATALOG:
            continue
        code, domain, unit, mult = IMF_CATALOG[f]
        try:
            r = await client.get(f"{BASE}/{code}/{iso3}", timeout=15.0)
            r.raise_for_status()
            payload = r.json()
        except Exception:
            continue
        series = (((payload.get("values") or {}).get(code) or {}).get(iso3)) or {}
        best = None
        for y, v in series.items():
            try:
                yi = int(y)
            except (ValueError, TypeError):
                continue
            if v is None or yi > year:
                continue
            if best is None or yi > best:
                best = yi
        if best is None:
            continue
        val = float(series[str(best)]) * mult
        label = "IMF (WEO)" + (" estimate" if best >= year else "")
        out.append(FieldValue(name=f, domain=domain, value=val, value_num=val, unit=unit,
                              provenance=Provenance(source_name=label,
                                                    url=f"https://www.imf.org/external/datamapper/{code}@WEO/{iso3}",
                                                    tier=1, as_of_date=str(best)),
                              confidence=Confidence.high))
    return out
