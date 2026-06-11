"""REST Countries source client (Tier 1, free) — identity & governance basics."""
from __future__ import annotations
from typing import List
import httpx
from ..schema import Confidence, Domain, FieldValue, Provenance

BASE = "https://restcountries.com/v3.1"
REST_FIELDS = ["official_name", "capital", "region", "subregion",
               "languages", "currency", "timezone", "flag"]


async def fetch_restcountries(iso2: str, iso3: str, client: httpx.AsyncClient) -> List[FieldValue]:
    url = (f"{BASE}/alpha/{iso3}"
           "?fields=name,capital,region,subregion,languages,currencies,timezones,flags")
    r = await client.get(url, timeout=15.0, follow_redirects=True)
    r.raise_for_status()
    d = r.json()
    if isinstance(d, list):
        d = d[0]
    src = Provenance(source_name="REST Countries", url=url, tier=1)
    out: List[FieldValue] = []

    def add(name, value):
        ok = value not in (None, "", [])
        out.append(FieldValue(name=name, domain=Domain.identity,
                              value=value if ok else None,
                              provenance=src if ok else None,
                              confidence=Confidence.high))
    nm = d.get("name", {})
    add("official_name", nm.get("official"))
    cap = d.get("capital") or []
    add("capital", cap[0] if cap else None)
    add("region", d.get("region"))
    add("subregion", d.get("subregion"))
    add("languages", ", ".join((d.get("languages") or {}).values()) or None)
    curr = d.get("currencies") or {}
    add("currency", ", ".join(f"{c.get('name')} ({k})" for k, c in curr.items()) or None)
    add("timezone", ", ".join(d.get("timezones") or []) or None)
    add("flag", (d.get("flags") or {}).get("png"))
    return out
