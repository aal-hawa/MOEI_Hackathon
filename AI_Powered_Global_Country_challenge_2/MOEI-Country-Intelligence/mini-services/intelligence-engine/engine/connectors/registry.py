"""Country resolution (EN/AR/any language or ISO code) via REST Countries index."""
from __future__ import annotations
from typing import Dict, Optional, Tuple
import httpx

_ISO = {
    "morocco": ("MA", "MAR"), "المغرب": ("MA", "MAR"),
    "germany": ("DE", "DEU"), "ألمانيا": ("DE", "DEU"),
    "brazil": ("BR", "BRA"), "البرازيل": ("BR", "BRA"),
    "uae": ("AE", "ARE"), "الإمارات": ("AE", "ARE"),
    "japan": ("JP", "JPN"), "اليابان": ("JP", "JPN"),
}
_INDEX: Optional[Dict[str, Tuple[str, str, str]]] = None


async def _load_index(client: httpx.AsyncClient) -> Dict[str, Tuple[str, str, str]]:
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    r = await client.get("https://restcountries.com/v3.1/all"
                         "?fields=name,cca2,cca3,translations,altSpellings",
                         timeout=30.0, follow_redirects=True)
    r.raise_for_status()
    idx: Dict[str, Tuple[str, str, str]] = {}
    for c in r.json():
        iso2, iso3 = c.get("cca2"), c.get("cca3")
        if not iso3:
            continue
        common = c.get("name", {}).get("common", iso3)
        keys = {common.lower(), (c.get("name", {}).get("official") or "").lower(),
                (iso2 or "").lower(), iso3.lower()}
        for t in (c.get("translations") or {}).values():
            if t.get("common"):
                keys.add(t["common"].lower())
            if t.get("official"):
                keys.add(t["official"].lower())
        for alt in c.get("altSpellings") or []:
            keys.add(alt.lower())
        for k in keys:
            if k:
                idx[k] = (common, iso2, iso3)
    _INDEX = idx
    return idx


async def resolve_country(name: str, client: Optional[httpx.AsyncClient] = None) -> Tuple[str, str, str]:
    typed = name.strip()
    key = typed.lower()
    if key in _ISO:
        iso2, iso3 = _ISO[key]
        return typed, iso2, iso3
    raw = typed.upper()
    if len(raw) in (2, 3) and raw.isascii() and raw.isalpha() and client is not None:
        r = await client.get(f"https://restcountries.com/v3.1/alpha/{raw}?fields=name,cca2,cca3",
                             timeout=15.0, follow_redirects=True)
        r.raise_for_status()
        d = r.json()
        d = d[0] if isinstance(d, list) else d
        return d["name"]["common"], d["cca2"], d["cca3"]
    if client is not None:
        idx = await _load_index(client)
        hit = idx.get(key)
        if hit:
            common, iso2, iso3 = hit
            return (typed if not typed.isascii() else common), iso2, iso3
    raise ValueError(f"Cannot resolve country '{name}'.")
