"""Dashboard Intelligence Agent.

ONE responsibility: transform already-verified intelligence into an executive-grade
dashboard SPECIFICATION (layout + chart choices + field references). It is NOT a
researcher, analyst, forecaster, or fact generator. It never creates, infers,
estimates, or supplements data — it only references fields that exist in the input.

Hard guarantee (beyond the prompt): whatever the model returns is passed through
`validate_spec`, which drops every reference that is not present in the verified
payload. Missing data -> the element is removed (NOT_AVAILABLE), never fabricated.
The renderer then binds real values from the payload, so the agent never emits a
single raw number itself.
"""
from __future__ import annotations

import json
import re
from typing import Dict, Optional

from ..dashboard import build_dashboard_spec, validate_spec
from ..llm.client import LLMClient

SYSTEM = """You are Dashboard Intelligence Agent. Your ONLY job is to transform verified
country intelligence into an executive dashboard SPECIFICATION for ministers.

You are NOT a researcher, analyst, forecaster, data collector, or fact generator.
You NEVER create, infer, estimate, supplement, or assume facts. You use ONLY the
exact information in the input payload, and you never use world/prior knowledge.

DATA GOVERNANCE (absolute):
- Every element you output must reference data that EXISTS in the input.
- You output REFERENCES to fields, never raw numbers or copied figures.
- If data for a visualization does not exist, do NOT create that visualization.
- Never invent rankings, scores, risk levels, opportunities, trends, or relationships
  that are not already present in the input.

HOW TO REFERENCE DATA (use these exact prefixes in source_field / source_fields):
- "field:<name>"   a verified field value (KPI or panel) e.g. "field:gdp_nominal_usd"
- "trend:<name>"   a multi-year series for a LINE chart   e.g. "trend:gdp_per_capita_usd"
- "trade:export_partners" | "trade:import_partners" | "trade:export_goods" |
  "trade:import_goods" | "trade:flows"   structured trade (BAR / DONUT / SANKEY)
- "parse:<name>"   a text field containing "Label: X%" shares, for a DONUT
- "text:executive_summary" | "text:analysis" | "text:predictive"   narrative panels

VISUALIZATION RULES:
- KPI cards: GDP, population, trade volume, percentages, rankings, scores.
- Line charts: time series / historical (use trend: refs).
- Bar charts: country/sector/trade-partner comparisons.
- Donut charts: energy mix, sector shares, export composition.
- Sankey: trade flows (trade:flows). Treemap: export composition.
- Maps: only for geographic assets that include locations (usually NOT available).

Optimise for executive readability, minimal cognitive load, rapid understanding.
Answer: what matters, what changed, what leadership should notice, opportunities, risks
— ONLY where the data exists.

Return VALID JSON ONLY in this exact shape (no prose, no markdown):
{"dashboard_title":"","country":"",
 "kpis":[{"title":"","value":"","source_field":""}],
 "charts":[{"title":"","chart_type":"","source_fields":[],"purpose":"","interaction":""}],
 "maps":[{"title":"","type":"","source_fields":[]}],
 "insight_panels":[{"title":"","content":"","source_field":""}],
 "risk_panels":[{"title":"","content":"","source_field":""}],
 "opportunity_panels":[{"title":"","content":"","source_field":""}],
 "drilldowns":[{"name":"","trigger":"","destination":""}]}
Leave "value"/"content" empty — the renderer fills real values from the input."""


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


def _available(payload: Dict) -> str:
    """Compact description of what data EXISTS, so the agent references only those."""
    fields = []
    for b in ("country_profile", "economy", "energy", "infrastructure",
              "sustainability", "innovation", "uae_relationship", "events"):
        for n in (payload.get(b) or {}):
            fields.append(n)
    trends = list((payload.get("trends") or {}).keys())
    trade = [k for k in ("export_partners", "import_partners", "export_goods",
                         "import_goods") if (payload.get("trade") or {}).get(k)]
    texts = [k for k in ("executive_summary", "analysis", "predictive") if payload.get(k)]
    return (f"VERIFIED FIELDS (field:<name>): {', '.join(fields) or 'none'}\n"
            f"TREND SERIES (trend:<name>): {', '.join(trends) or 'none'}\n"
            f"TRADE buckets (trade:<bucket>): {', '.join(trade) or 'none'}\n"
            f"NARRATIVE (text:<key>): {', '.join(texts) or 'none'}")


class DashboardAgent:
    def __init__(self, llm: Optional[LLMClient]):
        self.llm = llm

    async def compose(self, country: str, payload: Dict, lang: str = "en") -> Dict:
        """Return a validated dashboard spec. Falls back to the deterministic
        builder if there is no LLM or the model output is unusable."""
        # the deterministic spec is the safety net AND the floor for coverage
        base = build_dashboard_spec(country, payload)
        if self.llm is None:
            return base
        fields = _fields_view(payload)
        lang_note = "Write all titles/labels in Arabic." if lang == "ar" else "Write titles in English."
        user = (f"{lang_note}\nCountry: {country}\n\n{_available(payload)}\n\n"
                f"Build the executive dashboard specification. Reference ONLY the data listed above.")
        try:
            raw = await self.llm.complete("dashboard", SYSTEM, user, json_mode=True)
            spec = _parse_json(raw)
        except Exception:
            spec = {}
        if not spec or not spec.get("kpis") and not spec.get("charts"):
            return base
        spec = validate_spec(spec, payload, fields)
        # if validation gutted it (model hallucinated refs), use the safe builder
        if not spec.get("kpis") and not spec.get("charts"):
            return base
        spec.setdefault("dashboard_title", base["dashboard_title"])
        spec.setdefault("country", country)
        for key in ("maps", "insight_panels", "risk_panels", "opportunity_panels", "drilldowns"):
            spec.setdefault(key, base.get(key, []))
        return spec


def _fields_view(payload: Dict) -> Dict[str, dict]:
    fields: Dict[str, dict] = {}
    for b in ("country_profile", "economy", "energy", "infrastructure",
              "sustainability", "innovation", "uae_relationship", "events"):
        for n, v in (payload.get(b) or {}).items():
            fields[n] = {"found": True, "value": v.get("value"), "unit": v.get("unit")}
    return fields
