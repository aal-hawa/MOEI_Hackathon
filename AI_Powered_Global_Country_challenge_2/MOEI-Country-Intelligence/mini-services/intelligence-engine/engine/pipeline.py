"""The pipeline:
  resolve -> Orchestrator plan -> 8 domain agents (parallel) -> Comtrade trade ->
  trends -> Verify -> store (versioned) -> tear sheet (deterministic) -> Writer /
  Analyst / Predictive / the executive READ -> Localizer (AR) -> store extras.
Streaming generator (SSE) + collector. Runs with or without an LLM."""
from __future__ import annotations

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, Optional

import httpx

from .agents.analyst import Analyst
from .agents.council import Council
from .agents.dashboard import DashboardAgent
from .agents.domain import DOMAIN_AGENTS, EXPECTED_FIELDS
from .agents.localizer import Localizer
from .agents.media import MediaGenerator
from .agents.orchestrator import Orchestrator
from .agents.predictive import Predictive
from .agents.verifier import Verifier
from .agents.writer import Writer
from .connectors import resolve_country
from .connectors.comtrade import build_trade_fields
from .library import Library
from .llm.client import LLMClient
from .schema import FieldValue
from .sources import host_of, is_blocked
from .dashboard import build_dashboard_payload
from .tearsheet import build_tearsheet, write_read
from .timeutils import now_uae
from .trends import build_trends, trends_to_text


STALE_DAYS = 7  # serve from Library if younger than this; else re-research


def _row_dict(r) -> Dict[str, Any]:
    return {"name": r["field_name"], "domain": r["domain"], "value": r["value"],
            "unit": r["unit"], "source": r["source_name"], "source_url": r["source_url"],
            "as_of": r["as_of_date"], "tier": r["tier"], "confidence": r["confidence"],
            "corroborated": bool(r["corroborated"]), "found": r["value"] is not None}


def _fv_dict(fv: FieldValue) -> Dict[str, Any]:
    p = fv.provenance
    return {
        "name": fv.name, "domain": fv.domain.value, "value": fv.value, "unit": fv.unit,
        "source": (p.source_name if p else None), "source_url": (p.url if p else None),
        "as_of": (p.as_of_date if p else None), "tier": (p.tier if p else None),
        "confidence": fv.confidence.value, "corroborated": fv.corroborated, "found": fv.found,
    }


def _apply_loc(fields: Dict[str, dict], loc: Dict[str, str]) -> Dict[str, dict]:
    """Overlay Arabic localized values onto the field payload (keeps numbers as-is)."""
    if not loc:
        return fields
    for name, val in loc.items():
        if name in fields and val:
            fields[name]["value"] = val
            fields[name]["localized"] = True
    return fields


def _loads(s):
    try:
        return json.loads(s) if s else None
    except Exception:
        return None


async def build_dossier_stream(
    country: str, library: Library, llm: Optional[LLMClient] = None,
    persist: bool = True, with_analysis: bool = True, lang: str = "en", refresh: bool = False,
) -> AsyncIterator[Dict[str, Any]]:
    run_id = f"{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:6]}"
    _iso3_box = [None]  # filled after resolve

    def _log(actor: str, action: str, detail: str = "", actor_type: str = "agent") -> None:
        """AI log: every agent step is audited (who did what, with reasoning)."""
        try:
            library.log_event(actor_type, actor, action, detail,
                              run_id=run_id, country_iso=_iso3_box[0])
        except Exception:
            pass

    def _remember(agent: str, note: str) -> None:
        """Per-agent working memory: what the agent noted to itself this run."""
        try:
            library.memory_write(run_id, agent, note, country_iso=_iso3_box[0])
        except Exception:
            pass

    try:
        yield {"stage": "start", "run_id": run_id, "msg": f"Run {run_id} started."}
        _log("orchestrator", "start", f"New briefing run for '{country}' (lang={lang}, refresh={refresh}).")
        yield {"stage": "resolve", "msg": f"Resolving '{country}'..."}
        async with httpx.AsyncClient(headers={"User-Agent": "MOEI-Intelligence/0.1"}) as client:
            try:
                name, iso2, iso3 = await resolve_country(country, client)
            except Exception as e:
                yield {"stage": "error",
                       "msg": f"Could not resolve country '{country}'. Try the English "
                              f"name or an ISO code (e.g. Morocco / MAR). [{e}]"}
                return
            _iso3_box[0] = iso3
            _log("orchestrator", "resolve", f"Resolved '{country}' to {name} ({iso3}).")
            yield {"stage": "resolve", "msg": f"Resolved: {name} ({iso3})"}

            # Stage 1.5 — memory-first: serve from Library if present & fresh
            if not refresh:
                rows = library.get_dossier(iso3)
                meta = library.get_dossier_row(iso3)
                if rows and meta and any(r["value"] is not None for r in rows):
                    try:
                        age = (now_uae() - datetime.fromisoformat(meta["updated_at"])).days
                    except Exception:
                        age = 0
                    if age <= STALE_DAYS:
                        if lang == "ar":
                            try:
                                from .localization import ensure_ar
                                await ensure_ar(library, llm, iso3, name)
                            except Exception:
                                pass
                        extras = library.get_extras(iso3)
                        lex = library.get_extras_lang(iso3, lang)
                        ctrends = _loads(extras.get("trends")) or {}
                        ctrade = _loads(extras.get("trade"))
                        fields_payload = {r["field_name"]: _row_dict(r) for r in rows}
                        if lang == "ar":
                            fields_payload = _apply_loc(
                                fields_payload, library.get_localizations(iso3, "ar"))
                        # tear sheet: prefer the cached per-lang one; else rebuild deterministically
                        ts = _loads(lex.get("tearsheet")) or build_tearsheet(
                            name, iso3, fields_payload, ctrends, ctrade)
                        dash = _loads(lex.get("dashboard"))
                        if dash is None:
                            from .dashboard import build_dashboard_spec
                            dp = build_dashboard_payload(
                                name, iso3, fields_payload, ctrends, ctrade,
                                executive_summary=(ts.get("read") if ts else None),
                                analysis=lex.get("analysis") or extras.get("analysis"),
                                predictive=lex.get("predictive") or extras.get("predictive"))
                            dash = build_dashboard_spec(name, dp)
                        found = sum(1 for r in rows if r["value"] is not None)
                        _log("orchestrator", "cache",
                             f"Served {name} from Library cache (age {age}d, {found} fields).")
                        yield {"stage": "cache",
                               "msg": f"Served from Library cache (built {age}d ago). "
                                      f"Hit Refresh to re-research."}
                        yield {
                            "stage": "done", "run_id": run_id,
                            "country": name, "iso2": iso2, "iso3": iso3,
                            "coverage": round(found / len(EXPECTED_FIELDS), 3) if EXPECTED_FIELDS else 0.0,
                            "found": found, "expected": len(EXPECTED_FIELDS),
                            "not_found": [r["field_name"] for r in rows if r["value"] is None],
                            "fields": fields_payload,
                            "summary": lex.get("summary") or extras.get("summary"),
                            "analysis": lex.get("analysis") or extras.get("analysis"),
                            "talking_points": lex.get("talking_points") or extras.get("talking_points"),
                            "predictive": lex.get("predictive") or extras.get("predictive"),
                            "council": lex.get("council") or extras.get("council"),
                            "trends": ctrends, "trade": ctrade, "tearsheet": ts,
                            "dashboard": dash,
                            "cached": True,
                        }
                        return

            # Orchestrator (planner) — interprets + plans (AI)
            if llm is not None:
                try:
                    plan = await Orchestrator(llm).parse(country)
                    topics = ", ".join(plan.get("topics", ["all"]))
                    _log("orchestrator", "plan",
                         f"Intent={plan.get('intent','profile')}; topics={topics}.")
                    _remember("orchestrator",
                              f"Planned run: intent={plan.get('intent','profile')}, topics={topics}. "
                              f"Dispatching all domain researchers in parallel.")
                    yield {"stage": "plan",
                           "msg": f"Orchestrator: intent={plan.get('intent','profile')} · topics={topics}"}
                except Exception:
                    pass

            labels = ", ".join(a.label for a in DOMAIN_AGENTS)
            _log("orchestrator", "dispatch", f"Dispatching {len(DOMAIN_AGENTS)} domain researchers: {labels}.")
            yield {"stage": "gather",
                   "msg": f"Dispatching {len(DOMAIN_AGENTS)} domain agents in parallel: {labels}"}
            results = await asyncio.gather(
                *[a.research(name, iso2, iso3, client, llm, lang=lang) for a in DOMAIN_AGENTS],
                return_exceptions=True,
            )
            yield {"stage": "trade", "msg": "Fetching structured bilateral trade (UN Comtrade)..."}
            try:
                trade_fields, trade_summary = await build_trade_fields(iso3, client)
            except Exception:
                trade_fields, trade_summary = [], None
            if trade_summary:
                yield {"stage": "trade",
                       "msg": f"Trade map: {len(trade_summary.get('export_partners', []))} export + "
                              f"{len(trade_summary.get('import_partners', []))} import partners "
                              f"({trade_summary.get('year')})."}
            yield {"stage": "trends", "msg": "Computing multi-year trends (World Bank series)..."}
            try:
                trends = await build_trends(iso3, client)
            except Exception:
                trends = {}

        gathered = []
        for agent, res in zip(DOMAIN_AGENTS, results):
            if isinstance(res, Exception):
                _log(agent.label, "error", str(res))
                yield {"stage": "warn", "msg": f"{agent.label} agent error: {res}"}
                continue
            gathered.extend(res)
            n_found = sum(1 for f in res if f.found)
            srcs = sorted({f.provenance.source_name for f in res
                           if f.found and f.provenance and f.provenance.source_name})[:4]
            _log(agent.label, "research",
                 f"Collected {n_found}/{len(agent.all_fields())} fields"
                 + (f" from {', '.join(srcs)}" if srcs else "") + ".")
            _remember(agent.label,
                      f"Researched {name}: found {n_found} of {len(agent.all_fields())} expected fields."
                      + (f" Primary sources: {', '.join(srcs)}." if srcs else "")
                      + ((" Missing: " + ", ".join(f.name for f in res if not f.found)[:300] + ".")
                         if n_found < len(res) else " Full coverage."))
            yield {"stage": "agent", "msg": f"{agent.label}: {n_found} fields"}
        gathered.extend(trade_fields)  # Tier-1 structured trade overrides LLM trade fields

        # ── source policy: drop blocked domains + auto-populate the registry ──
        blocked = set(library.blocked_domains())
        kept, dropped = [], 0
        for fv in gathered:
            prov = fv.provenance
            host = host_of(prov.url) if (fv.found and prov) else ""
            if host and is_blocked(host, blocked):
                dropped += 1
                continue
            if fv.found and host and persist:
                library.record_source(host, prov.source_name if prov else None,
                                      prov.tier if prov else None)
            kept.append(fv)
        gathered = kept
        if dropped:
            yield {"stage": "sources",
                   "msg": f"Source policy: dropped {dropped} field(s) from blocked domains."}

        yield {"stage": "verify", "msg": f"Verifying {len(gathered)} gathered fields..."}
        verified = Verifier().verify(gathered)
        found = sum(1 for f in verified.values() if f.found)
        n_corr = sum(1 for f in verified.values() if f.corroborated)
        _log("verifier", "verify",
             f"Verified {len(gathered)} candidates -> {found} accepted, {n_corr} corroborated by 2+ sources.")
        _remember("verifier",
                  f"Cross-checked {len(gathered)} candidate facts for {name}: accepted {found}, "
                  f"{n_corr} corroborated. Rule applied: structured Tier-1 beats web; "
                  f"conflicting values resolved by tier + recency; nothing invented.")
        coverage = round(found / len(EXPECTED_FIELDS), 3) if EXPECTED_FIELDS else 0.0
        if found == 0:
            yield {"stage": "warn", "msg": "No data returned — check this machine's internet connection."}

        if persist and found > 0:
            yield {"stage": "store", "msg": "Writing verified dossier to the Library (versioned)..."}
            library.upsert_dossier(iso3, name, iso2)
            for fv in verified.values():
                library.upsert_field(iso3, fv.to_stored())

        # ── deterministic tear sheet (works even with no LLM) ──
        fields_payload = {k: _fv_dict(v) for k, v in verified.items()}
        tearsheet = build_tearsheet(name, iso3, fields_payload, trends, trade_summary)

        summary = analysis = predictive = talking = read = council = None
        media_spec = None
        localized: Dict[str, str] = {}
        if llm is not None and with_analysis:
            try:
                yield {"stage": "write",
                       "msg": "Writing the executive read, summary, analysis, talking points & forecast..."}
                w = Writer(llm)
                ttext = trends_to_text(trends)
                summary, analysis, talking, predictive, read = await asyncio.gather(
                    w.write(name, verified, lang=lang, trends_text=ttext),
                    Analyst(llm).analyze(name, verified, trends_text=ttext),
                    w.talking_points(name, verified, lang=lang),
                    Predictive(llm).predict(name, verified, lang=lang, trends_text=ttext),
                    write_read(llm, name, tearsheet, lang=lang),
                )
                tearsheet["read"] = read
                _log("analyst", "analyze", "Drafted opportunities & risks from verified facts + trends.")
                _remember("analyst", f"Derived opportunities/risks for {name} strictly from verified "
                                     f"fields and multi-year trends; every point cites its facts.")
                _log("predictive", "forecast", "Drafted forward outlook (labeled as projection).")
                _remember("predictive", f"Projected {name}'s trajectory from trend CAGRs; "
                                        f"clearly labeled as projection, not fact.")
                _log("writer", "write", "Wrote executive read, summary and talking points (cited).")
                _remember("writer", f"Wrote the read + talking points for {name} using only verified "
                                    f"facts; each figure cited (source, year).")

                # ── COUNCIL: multi-perspective review of the drafts ──
                yield {"stage": "council",
                       "msg": "Council convening: Economist · Energy Strategist · "
                              "Geopolitical Advisor · Risk Officer reviewing the drafts..."}
                try:
                    council = await Council(llm).review(name, verified, analysis, predictive, lang=lang)
                    grade = ""
                    for ln in (council or "").splitlines():
                        if ln.strip().upper().startswith("CONFIDENCE"):
                            grade = ln.strip()[:90]
                            break
                    _log("council", "review", f"Issued verdict on the {name} brief. {grade}")
                    _remember("council", f"Debated analyst + predictive drafts for {name}; issued "
                                         f"consensus verdict with dissent preserved. {grade}")
                    yield {"stage": "council", "msg": f"Council verdict issued. {grade}"}
                except Exception as ce:
                    yield {"stage": "warn", "msg": f"Council step skipped: {ce}"}

                yield {"stage": "media", "msg": "Composing visual summary (verified data only)..."}
                media_spec = await MediaGenerator(llm).compose(name, verified, analysis or "", lang=lang)
                _log("visualizer", "compose", "Composed the visual-summary spec from verified data only.")
                if lang == "ar":
                    yield {"stage": "localize", "msg": "Localizing data values into Arabic..."}
                    localized = await Localizer(llm).localize(name, fields_payload, lang="ar")
            except Exception as e:
                yield {"stage": "warn", "msg": f"AI step skipped (check OPENAI_API_KEY / quota): {e}"}

        # ── Dashboard Intelligence Agent: layout/chart spec over verified data ──
        yield {"stage": "dashboard", "msg": "Designing the executive dashboard (verified data only)..."}
        dash_payload = build_dashboard_payload(
            name, iso3, fields_payload, trends, trade_summary,
            executive_summary=(tearsheet.get("read") or summary), analysis=analysis,
            predictive=predictive)
        try:
            dashboard = await DashboardAgent(llm).compose(name, dash_payload, lang=lang)
        except Exception:
            from .dashboard import build_dashboard_spec
            dashboard = build_dashboard_spec(name, dash_payload)

        if persist and found > 0:
            library.set_extras(iso3, summary, analysis,
                               json.dumps(media_spec) if media_spec else None, lang,
                               predictive=predictive, talking_points=talking,
                               trends=json.dumps(trends) if trends else None,
                               trade=json.dumps(trade_summary) if trade_summary else None,
                               council=council)
            library.set_extras_lang(iso3, lang, summary=summary, analysis=analysis,
                                    predictive=predictive, talking_points=talking,
                                    tearsheet=json.dumps(tearsheet),
                                    dashboard=json.dumps(dashboard),
                                    council=council)
            for fn, val in (localized or {}).items():
                library.set_localization(iso3, fn, "ar", val)
        _log("orchestrator", "done",
             f"Run complete for {name}: {found}/{len(EXPECTED_FIELDS)} fields "
             f"({round(coverage*100)}% coverage).")

        if lang == "ar" and localized:
            fields_payload = _apply_loc(fields_payload, localized)

        yield {
            "stage": "done", "run_id": run_id,
            "country": name, "iso2": iso2, "iso3": iso3,
            "coverage": coverage, "found": found, "expected": len(EXPECTED_FIELDS),
            "not_found": [k for k, v in verified.items() if not v.found],
            "fields": fields_payload,
            "summary": summary, "analysis": analysis,
            "talking_points": talking, "predictive": predictive, "council": council,
            "trends": trends, "trade": trade_summary, "tearsheet": tearsheet,
            "dashboard": dashboard,
        }
    except Exception as e:
        yield {"stage": "error", "msg": f"Build failed for '{country}': {e}"}


async def build_dossier(country: str, library: Library, llm: Optional[LLMClient] = None,
                        **kwargs: Any) -> Dict[str, Any]:
    final: Dict[str, Any] = {}
    async for ev in build_dossier_stream(country, library, llm, **kwargs):
        if ev.get("stage") == "done":
            final = ev
    return final
