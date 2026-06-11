"""Comparison engine (derived layer) — normalized side-by-side of 2-4 countries.
Same field across all; each cell keeps its own source + year; gaps shown, never
filled. Plus an AI comparative insight grounded ONLY in the compared numbers."""
from __future__ import annotations

from typing import Dict, List, Optional

import httpx

from .connectors import resolve_country
from .library import Library
from .llm.client import LLMClient

# field -> (label, unit, better_direction)
COMPARE_FIELDS = [
    ("gdp_nominal_usd", "GDP (nominal)", "USD", "desc"),
    ("gdp_per_capita_usd", "GDP per capita", "USD", "desc"),
    ("gdp_growth_pct", "GDP growth", "%", "desc"),
    ("inflation_pct", "Inflation", "%", "asc"),
    ("unemployment_pct", "Unemployment", "%", "asc"),
    ("population", "Population", "people", "desc"),
    ("govt_debt_pct_gdp", "Govt debt (% GDP)", "% of GDP", "asc"),
    ("co2_emissions_per_capita", "CO2 per capita", "tCO2", "asc"),
    ("logistics_performance_index", "Logistics (LPI)", "index", "desc"),
    ("rd_spend_pct_gdp", "R&D (% GDP)", "% of GDP", "desc"),
    ("renewable_energy_consumption_pct", "Renewable energy", "%", "desc"),
]


async def build_comparison(countries: List[str], library: Library,
                           llm: Optional[LLMClient] = None, lang: str = "en") -> Dict:
    from .pipeline import build_dossier  # lazy to avoid import cycle
    resolved = []
    async with httpx.AsyncClient() as client:
        for c in countries:
            try:
                name, iso2, iso3 = await resolve_country(c, client)
                resolved.append((name, iso3))
            except Exception:
                continue
    # ensure each dossier exists (build numbers-fast if missing)
    for name, iso3 in resolved:
        if not library.get_dossier(iso3):
            try:
                await build_dossier(name, library, llm, with_analysis=False, lang=lang)
            except Exception:
                pass
    data = {iso3: {r["field_name"]: r for r in library.get_dossier(iso3)} for _, iso3 in resolved}

    metrics = []
    for field, label, unit, better in COMPARE_FIELDS:
        cells = {}
        nums = {}
        for _, iso3 in resolved:
            r = data.get(iso3, {}).get(field)
            val = r["value"] if r and r["value"] is not None else None
            cells[iso3] = {"value": val, "num": (r["value_num"] if r else None),
                           "as_of": (r["as_of_date"] if r else None),
                           "source": (r["source_name"] if r else None)}
            if r and r["value_num"] is not None:
                nums[iso3] = r["value_num"]
        leader = None
        if nums:
            leader = (max if better == "desc" else min)(nums, key=nums.get)
        metrics.append({"field": field, "label": label, "unit": unit, "better": better,
                        "cells": cells, "leader": leader,
                        "max": (max(nums.values()) if nums else None),
                        "min": (min(nums.values()) if nums else None)})

    insight = None
    if llm is not None and resolved:
        lines = []
        for m in metrics:
            parts = [f"{iso3}={m['cells'][iso3]['value']}" for _, iso3 in resolved
                     if m["cells"][iso3]["value"] is not None]
            if parts:
                lines.append(f"{m['label']}: " + "; ".join(parts))
        names = ", ".join(n for n, _ in resolved)
        sys = ("You are the Analyst comparing countries for a government platform. Using ONLY the "
               "numbers provided, write 3-5 short bullet points: who leads on what and notable gaps. "
               "Label as ANALYSIS. Cite the metric. Never invent numbers.")
        if lang == "ar":
            sys += " Write in Arabic."
        try:
            insight = await llm.complete("analyst", sys,
                                         f"Countries: {names}\n\n" + "\n".join(lines))
        except Exception:
            insight = None

    return {"countries": [{"name": n, "iso3": i} for n, i in resolved],
            "metrics": metrics, "insight": insight}
