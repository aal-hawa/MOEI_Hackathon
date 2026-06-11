"""Localizer — makes the Arabic platform actually Arabic.

Numbers and labels are already language-neutral / translated in the UI. The gap is
the NARRATIVE field values (e.g. the electricity mix, the automotive story, UAE
cooperation areas) which are gathered as English prose. This agent translates those
prose values into fluent Modern Standard Arabic and caches them per-field, so the
Arabic view shows Arabic data — not English.

It never touches numeric fields, codes, or URLs, and it preserves proper nouns,
figures, and source references inside the prose so the no-hallucination guarantee
and citations survive translation.
"""
from __future__ import annotations

import json
import re
from typing import Dict, List, Optional

from ..llm.client import LLMClient

# Fields that are purely numeric / structural — never sent for translation.
_SKIP = {"flag", "timezone", "currency", "population", "gdp_nominal_usd",
         "gdp_per_capita_usd", "gdp_growth_pct", "inflation_pct", "unemployment_pct",
         "current_account_pct_gdp", "exports_usd", "imports_usd", "fdi_inflow_usd",
         "govt_debt_pct_gdp", "agriculture_pct_gdp", "industry_pct_gdp",
         "services_pct_gdp", "co2_emissions_per_capita", "rd_spend_pct_gdp",
         "internet_users_pct", "mobile_subscriptions_per100", "urban_population_pct",
         "logistics_performance_index", "renewable_energy_consumption_pct",
         "renewable_electricity_output_pct", "electric_power_consumption_pc",
         "access_to_electricity_pct"}

_URL_RE = re.compile(r"^https?://", re.I)
_AR_RE = re.compile(r"[؀-ۿ]")


def _needs_translation(value) -> bool:
    if value is None:
        return False
    s = str(value).strip()
    if not s or _URL_RE.match(s):
        return False
    if _AR_RE.search(s):           # already Arabic
        return False
    # has at least a couple of latin words worth translating
    return len(re.findall(r"[A-Za-z]{2,}", s)) >= 2


def _parse_json(text: str) -> dict:
    text = (text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", text).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        text = m.group(0)
    try:
        return json.loads(text)
    except Exception:
        return {}

_SYSTEM = """You are a professional EN->AR translator for a UAE government intelligence
platform. Translate each field's English value into clear, formal Modern Standard Arabic.
Rules:
- Translate the prose faithfully; do NOT add, drop, or change any facts or numbers.
- Keep all numbers, dates, percentages, currency figures and URLs exactly as-is.
- Keep widely-used organisation/company/project names recognisable (transliterate or
  keep the Latin name in brackets where natural).
- Return ONLY JSON: {"translations": {"<field_name>": "<arabic text>", ...}}."""


class Localizer:
    def __init__(self, llm: LLMClient, batch: int = 12):
        self.llm = llm
        self.batch = batch

    async def translate_texts(self, country: str, texts: Dict[str, str]) -> Dict[str, str]:
        """Generic EN->AR for any {key: english_text}. Skips empty/already-Arabic.
        Used for both data field values and narrative prose (summary/analysis/...)."""
        todo = {k: str(v) for k, v in texts.items() if _needs_translation(v)}
        if not todo:
            return {}
        items = list(todo.items())
        out: Dict[str, str] = {}
        for i in range(0, len(items), self.batch):
            chunk = dict(items[i:i + self.batch])
            payload = "\n\n".join(f"### {k}\n{v}" for k, v in chunk.items())
            user = (f"Country: {country}\nTranslate each section's text to Arabic. "
                    f"Use the exact section keys.\n\n{payload}")
            try:
                raw = await self.llm.complete("localizer", _SYSTEM, user, json_mode=True)
                data = _parse_json(raw)
                for k, v in (data.get("translations") or {}).items():
                    if k in chunk and v and str(v).strip():
                        out[k] = str(v).strip()
            except Exception:
                continue
        return out

    async def localize(self, country: str, fields: Dict[str, dict],
                       lang: str = "ar") -> Dict[str, str]:
        """fields = {name: {value, unit, found, ...}}. Returns {name: translated}."""
        if lang != "ar":
            return {}
        todo = {n: str(f.get("value")) for n, f in fields.items()
                if n not in _SKIP and f.get("found") and not f.get("unit")
                and _needs_translation(f.get("value"))}
        return await self.translate_texts(country, todo)
