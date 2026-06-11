"""Dashboard schema — the contract between the Dashboard Intelligence Agent and
the frontend renderer.

Governance is enforced STRUCTURALLY, not by trust: the schema only ever carries
*references* to fields (source_field / source_fields), never raw numbers. The
renderer binds the actual values from the verified payload at draw time, so the
agent (LLM) physically cannot invent, infer, estimate, or supplement a number.

`build_dashboard_payload` shapes the verified dossier into the agent's input.
`build_dashboard_spec` is the deterministic schema builder — it is both the
no-LLM fallback AND the validator: any field an LLM references that is not in the
payload is dropped (Rule #1 / #4 / #8 -> NOT_AVAILABLE). All pure, offline-testable.
"""
from __future__ import annotations

import re
from typing import Dict, List, Optional

# Source-reference prefixes the renderer understands:
#   field:<name>   -> fields[name].value (+unit)         (KPI / panel)
#   trend:<name>   -> trends[name] spark/series          (line chart)
#   trade:<bucket> -> trade[bucket] [{name,value,share}] (bar / donut / sankey)
#   parse:<name>   -> parse "Label: X%" from a text field (donut)
#   text:<key>     -> executive_summary / analysis / predictive (panel)

HEADLINE_KPIS = ["gdp_nominal_usd", "gdp_per_capita_usd", "gdp_growth_pct",
                 "population", "inflation_pct", "unemployment_pct", "fdi_inflow_usd"]
TREND_SERIES = ["gdp_per_capita_usd", "gdp_growth_pct", "exports_usd", "imports_usd",
                "unemployment_pct", "inflation_pct", "co2_emissions_per_capita"]
DOMAIN_BUCKET = {
    "identity": "country_profile", "economy": "economy", "energy": "energy",
    "infrastructure": "infrastructure", "sustainability": "sustainability",
    "innovation": "innovation", "uae_relations": "uae_relationship", "news": "events",
}
SHARE_RE = re.compile(r"([A-Za-z؀-ۿ][A-Za-z ؀-ۿ/&-]*?)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*%")


def parse_shares(text: str) -> List[dict]:
    """Extract [{name, value}] from prose like 'Agriculture: 14.5%, Industry: 30.5%'.
    Returns [] if fewer than 2 clean shares are found (no fabrication)."""
    if not text:
        return []
    out, seen = [], set()
    for m in SHARE_RE.finditer(str(text)):
        name = m.group(1).strip(" -:·,").strip()
        try:
            val = float(m.group(2))
        except ValueError:
            continue
        if not name or name.lower() in seen or val <= 0 or val > 100:
            continue
        seen.add(name.lower())
        out.append({"name": name, "value": val})
    return out if len(out) >= 2 else []


def build_dashboard_payload(country: str, iso3: str, fields: Dict[str, dict],
                            trends: Optional[Dict] = None, trade: Optional[Dict] = None,
                            executive_summary: Optional[str] = None,
                            analysis: Optional[str] = None,
                            predictive: Optional[str] = None,
                            sources: Optional[List[str]] = None) -> Dict:
    """Shape the verified dossier into the Dashboard Agent's input payload."""
    buckets: Dict[str, Dict] = {v: {} for v in set(DOMAIN_BUCKET.values())}
    for name, f in (fields or {}).items():
        if not f or not f.get("found"):
            continue
        bucket = DOMAIN_BUCKET.get(f.get("domain"), "economy")
        buckets[bucket][name] = {"value": f.get("value"), "unit": f.get("unit"),
                                 "source": f.get("source"), "as_of": f.get("as_of")}
    return {
        "country": country, "iso3": iso3,
        "country_profile": buckets.get("country_profile", {}),
        "economy": buckets.get("economy", {}),
        "energy": buckets.get("energy", {}),
        "infrastructure": buckets.get("infrastructure", {}),
        "sustainability": buckets.get("sustainability", {}),
        "innovation": buckets.get("innovation", {}),
        "uae_relationship": buckets.get("uae_relationship", {}),
        "events": buckets.get("events", {}),
        "trade": trade or {},
        "trends": trends or {},
        "executive_summary": executive_summary or "",
        "analysis": analysis or "",
        "predictive": predictive or "",
        "sources": sources or [],
    }


# ── source-reference resolution check (the governance gate) ───────────────────

def _exists(ref: str, payload: Dict, fields: Dict[str, dict]) -> bool:
    if not ref:
        return False
    kind, _, key = ref.partition(":")
    if kind == "field" or ":" not in ref:
        nm = key or ref
        f = fields.get(nm)
        return bool(f and f.get("found") and f.get("value") is not None)
    if kind == "trend":
        return bool((payload.get("trends") or {}).get(key))
    if kind == "trade":
        return bool((payload.get("trade") or {}).get(key))
    if kind == "parse":
        f = fields.get(key)
        return bool(f and f.get("found") and parse_shares(f.get("value")))
    if kind == "text":
        return bool(payload.get(key))
    return False


def validate_spec(spec: Dict, payload: Dict, fields: Dict[str, dict]) -> Dict:
    """Drop any KPI/chart/panel whose referenced data is not in the payload.
    This is what guarantees an LLM cannot surface a fabricated metric."""
    def ok_one(ref):
        return _exists(ref, payload, fields)

    def ok_many(refs):
        return refs and all(ok_one(r) for r in refs)

    spec = dict(spec or {})
    spec["kpis"] = [k for k in spec.get("kpis", []) if ok_one(k.get("source_field"))]
    spec["charts"] = [c for c in spec.get("charts", []) if ok_many(c.get("source_fields"))]
    spec["maps"] = [m for m in spec.get("maps", []) if ok_many(m.get("source_fields"))]
    for panel in ("insight_panels", "risk_panels", "opportunity_panels"):
        spec[panel] = [p for p in spec.get(panel, []) if ok_one(p.get("source_field"))]
    spec["drilldowns"] = spec.get("drilldowns", []) or []
    return spec


# ── deterministic builder (fallback + default) ───────────────────────────────

def build_dashboard_spec(country: str, payload: Dict) -> Dict:
    """Build a complete, governance-safe schema from whatever data exists."""
    fields = {}
    for b in DOMAIN_BUCKET.values():
        for n, v in (payload.get(b) or {}).items():
            fields[n] = {"found": True, "value": v.get("value"), "unit": v.get("unit"),
                         "domain": b}
    trends = payload.get("trends") or {}
    trade = payload.get("trade") or {}

    kpis = [{"title": n, "value": "", "source_field": f"field:{n}"}
            for n in HEADLINE_KPIS if n in fields]

    charts: List[dict] = []
    # line charts for every available multi-year trend
    for n in TREND_SERIES:
        if n in trends and trends[n].get("spark"):
            charts.append({"title": n, "chart_type": "line", "source_fields": [f"trend:{n}"],
                           "purpose": "Show the multi-year trajectory.",
                           "interaction": "hover for year values"})
    # trade partner bars
    if trade.get("export_partners"):
        charts.append({"title": "top_export_partners", "chart_type": "bar",
                       "source_fields": ["trade:export_partners"],
                       "purpose": "Rank top export partners by share.", "interaction": "hover"})
    if trade.get("import_partners"):
        charts.append({"title": "top_import_partners", "chart_type": "bar",
                       "source_fields": ["trade:import_partners"],
                       "purpose": "Rank top import partners by share.", "interaction": "hover"})
    # export composition donut/treemap
    if trade.get("export_goods"):
        charts.append({"title": "export_composition", "chart_type": "donut",
                       "source_fields": ["trade:export_goods"],
                       "purpose": "Export composition by goods.", "interaction": "hover"})
    # sankey trade flows (partners -> country -> partners)
    if trade.get("export_partners") or trade.get("import_partners"):
        charts.append({"title": "trade_flows", "chart_type": "sankey",
                       "source_fields": ["trade:flows"],
                       "purpose": "Visualise import and export flows.", "interaction": "hover"})
    # sector mix donut parsed from text
    for n in ("gdp_by_sector", "electricity_mix"):
        if n in fields and parse_shares(fields[n]["value"]):
            charts.append({"title": n, "chart_type": "donut", "source_fields": [f"parse:{n}"],
                           "purpose": "Composition share.", "interaction": "hover"})

    maps: List[dict] = []   # we hold ports/airports as text (no coords) -> asset list panel
    insight_panels: List[dict] = []
    if payload.get("executive_summary"):
        insight_panels.append({"title": "Executive read", "content": "",
                               "source_field": "text:executive_summary"})
    for n in ("structural_shift", "momentum_sectors", "national_vision_strategy",
              "major_ports", "major_airports", "infrastructure_project_pipeline"):
        if n in fields:
            insight_panels.append({"title": n, "content": "", "source_field": f"field:{n}"})

    opportunity_panels = []
    if payload.get("analysis"):
        opportunity_panels.append({"title": "Opportunities & Risks (analysis)",
                                   "content": "", "source_field": "text:analysis"})
    risk_panels = []
    if payload.get("predictive"):
        risk_panels.append({"title": "Predictive outlook (projection)", "content": "",
                            "source_field": "text:predictive"})

    drilldowns = [{"name": "Full data & sources", "trigger": "button", "destination": "fulldata"}]
    if trade:
        drilldowns.append({"name": "Trade detail", "trigger": "chart:trade_flows",
                           "destination": "section:trade"})

    return {
        "dashboard_title": f"{country} — Executive Intelligence Dashboard",
        "country": country, "kpis": kpis, "charts": charts, "maps": maps,
        "insight_panels": insight_panels, "risk_panels": risk_panels,
        "opportunity_panels": opportunity_panels, "drilldowns": drilldowns,
    }
