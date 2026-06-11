"""FastAPI surface for the engine — serves the web UI and the engine API."""
from __future__ import annotations

# Fix SSL for litellm/httpx — must be set before any SSL-dependent imports
import os as _os
_os.environ.setdefault("SSL_CERT_FILE", "/etc/ssl/certs/ca-certificates.crt")
_os.environ.setdefault("CURL_CA_BUNDLE", "/etc/ssl/certs/ca-certificates.crt")

import json
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from engine.config import load_config
from engine.connectors import resolve_country
from engine.library import Library
from engine.llm.client import LLMClient
from engine.pipeline import build_dossier, build_dossier_stream

app = FastAPI(title="MOEI Country Intelligence Engine", version="0.2.0")
_cfg = load_config()
_lib = Library(_cfg.db_path)

WEB_DIR = Path(__file__).resolve().parent.parent / "web"
app.mount("/static", StaticFiles(directory=str(WEB_DIR)), name="static")


@app.get("/", include_in_schema=False)
def index():
    return FileResponse(str(WEB_DIR / "index.html"))


def _llm() -> Optional[LLMClient]:
    return LLMClient(_cfg) if _cfg.openai_api_key else None


async def _iso3(country: str) -> str:
    """Resolve a country identifier to ISO3.
    Checks the local library first (fast, no network), then falls back
    to the REST Countries API with redirect following."""
    raw = country.strip().upper()
    # Fast path: check local library (dossiers table has country_iso)
    dossiers = _lib.list_dossiers()
    for d in dossiers:
        if d["country_iso"] == raw or d.get("iso2", "").upper() == raw:
            return d["country_iso"]
        if d.get("name", "").lower() == country.strip().lower():
            return d["country_iso"]
    # Fallback: resolve via external API (with redirect support)
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            _, _, iso3 = await resolve_country(country, client)
        return iso3
    except Exception:
        # Last resort: if it looks like an ISO3 code, just return it
        if len(raw) == 3 and raw.isalpha():
            return raw
        raise


def _rows(iso3: str, lang: str = "en") -> List[dict]:
    rows = [dict(r) for r in _lib.get_dossier(iso3)]
    if lang == "ar":
        loc = _lib.get_localizations(iso3, "ar")
        for r in rows:
            v = loc.get(r["field_name"])
            if v:
                r["value"] = v
    return rows


async def _ensure_ar(country: str, iso3: str, lang: str) -> None:
    """For Arabic requests, lazily translate+cache so Arabic never shows English data."""
    if lang != "ar":
        return
    from engine.localization import ensure_ar
    try:
        await ensure_ar(_lib, _llm(), iso3, country)
    except Exception:
        pass


def _extras(iso3: str, lang: str = "en") -> dict:
    """Language-neutral extras (trends/trade/media) merged with per-lang narrative."""
    base = dict(_lib.get_extras(iso3) or {})
    lex = _lib.get_extras_lang(iso3, lang) or {}
    for k, v in lex.items():
        if v:
            base[k] = v
    return base


class EditBody(BaseModel):
    value: str
    changed_by: str
    note: Optional[str] = None


class ChatBody(BaseModel):
    question: str
    lang: str = "en"
    country_iso: Optional[str] = None


class SourceBody(BaseModel):
    domain: str
    name: Optional[str] = None
    tier: Optional[int] = None
    category: Optional[str] = None
    note: Optional[str] = None
    changed_by: str = "user"


class SourceStatusBody(BaseModel):
    domain: str
    status: str            # trusted | blocked
    changed_by: str = "user"


class UserLogBody(BaseModel):
    actor: str = "admin"
    action: str
    detail: str = ""
    country_iso: Optional[str] = None


class ModelUpdateBody(BaseModel):
    agent: str
    model: str
    temperature: Optional[float] = None
    changed_by: str = "user"


class ApiKeyBody(BaseModel):
    provider: str          # e.g. bloomberg
    key: str
    added_by: str = "user"


class InternalDataBody(BaseModel):
    name: str
    content: str           # CSV / JSON / text payload
    filename: Optional[str] = None
    uploaded_by: str = "user"


@app.get("/library")
def library_list():
    return {"countries": _lib.list_dossiers()}


@app.get("/sources")
def sources_list():
    return {"sources": _lib.list_sources()}


@app.post("/sources")
def sources_add(body: SourceBody):
    _lib.add_source(body.domain.strip().lower(), body.name, body.tier,
                    body.category, body.changed_by, body.note)
    return {"result": "added", "sources": _lib.list_sources()}


@app.post("/sources/status")
def sources_status(body: SourceStatusBody):
    try:
        _lib.set_source_status(body.domain.strip().lower(), body.status, body.changed_by)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"result": body.status, "sources": _lib.list_sources()}


@app.get("/health")
def health():
    return {"status": "ok", "provider": _cfg.default_provider,
            "llm_ready": bool(_cfg.openai_api_key)}


@app.post("/dossier/{country}")
async def build(country: str, lang: str = "en", refresh: bool = False):
    return await build_dossier(country, _lib, _llm(), lang=lang, refresh=refresh)


@app.get("/dossier/{country}/stream")
async def stream(country: str, lang: str = "en", refresh: bool = False):
    async def gen():
        async for ev in build_dossier_stream(country, _lib, _llm(), lang=lang, refresh=refresh):
            yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
    return StreamingResponse(gen(), media_type="text/event-stream")


@app.get("/dossier/{country}")
async def read(country: str):
    iso3 = await _iso3(country)
    rows = _rows(iso3)
    if not rows:
        raise HTTPException(404, f"No dossier for {country}. Build it first.")
    return {"iso3": iso3, "fields": rows}


@app.get("/dossier/{country}/full")
async def full(country: str, lang: str = "en"):
    """Everything the briefing workspace needs in one call (cached data only)."""
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, f"No dossier for {country}. Build it first.")
    meta = _lib.get_dossier_row(iso3) or {}
    ex = _extras(iso3, lang)
    fields = {r["field_name"]: {"name": r["field_name"], "domain": r["domain"],
                                "value": r["value"], "unit": r["unit"],
                                "found": r["value"] is not None,
                                "source": r["source_name"], "source_url": r["source_url"],
                                "as_of": r["as_of_date"], "tier": r["tier"],
                                "confidence": r["confidence"],
                                "corroborated": bool(r["corroborated"])} for r in rows}
    trends = json.loads(ex["trends"]) if ex.get("trends") else {}
    trade = json.loads(ex["trade"]) if ex.get("trade") else None
    ts = json.loads(ex["tearsheet"]) if ex.get("tearsheet") else None
    dash = json.loads(ex["dashboard"]) if ex.get("dashboard") else None
    found = sum(1 for r in rows if r["value"] is not None)
    return {"stage": "done", "cached": True,
            "country": meta.get("name", country), "iso2": meta.get("iso2", ""), "iso3": iso3,
            "coverage": round(found / len(rows), 3) if rows else 0.0,
            "found": found, "expected": len(rows),
            "not_found": [r["field_name"] for r in rows if r["value"] is None],
            "fields": fields, "summary": ex.get("summary"), "analysis": ex.get("analysis"),
            "talking_points": ex.get("talking_points"), "predictive": ex.get("predictive"),
            "council": ex.get("council"), "trends": trends, "trade": trade,
            "tearsheet": ts, "dashboard": dash, "updated_at": meta.get("updated_at")}


@app.get("/dossier/{country}/tearsheet")
async def tearsheet(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, f"No dossier for {country}. Build it first.")
    ex = _extras(iso3, lang)
    ts = None
    if ex.get("tearsheet"):
        try:
            ts = json.loads(ex["tearsheet"])
        except Exception:
            ts = None
    if ts is None:
        from engine.tearsheet import build_tearsheet
        fields = {r["field_name"]: {"value": r["value"], "unit": r["unit"],
                                    "found": r["value"] is not None,
                                    "source": r["source_name"], "source_url": r["source_url"],
                                    "as_of": r["as_of_date"]} for r in rows}
        trends = json.loads(ex["trends"]) if ex.get("trends") else {}
        trade = json.loads(ex["trade"]) if ex.get("trade") else None
        ts = build_tearsheet(country, iso3, fields, trends, trade)
    return {"iso3": iso3, "tearsheet": ts}


@app.get("/dossier/{country}/dashboard")
async def dashboard(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, f"No dossier for {country}. Build it first.")
    ex = _extras(iso3, lang)
    fields = {r["field_name"]: {"value": r["value"], "unit": r["unit"],
                                "found": r["value"] is not None, "domain": r["domain"],
                                "source": r["source_name"], "source_url": r["source_url"],
                                "as_of": r["as_of_date"]} for r in rows}
    trends = json.loads(ex["trends"]) if ex.get("trends") else {}
    trade = json.loads(ex["trade"]) if ex.get("trade") else None
    ts = json.loads(ex["tearsheet"]) if ex.get("tearsheet") else {}
    spec = json.loads(ex["dashboard"]) if ex.get("dashboard") else None
    if spec is None:
        from engine.dashboard import build_dashboard_payload, build_dashboard_spec
        dp = build_dashboard_payload(country, iso3, fields, trends, trade,
                                     executive_summary=(ts.get("read") if ts else None),
                                     analysis=ex.get("analysis"), predictive=ex.get("predictive"))
        spec = build_dashboard_spec(country, dp)
    return {"iso3": iso3, "dashboard": spec,
            "data": {"fields": fields, "trends": trends, "trade": trade,
                     "executive_summary": (ts.get("read") if ts else ex.get("summary")),
                     "analysis": ex.get("analysis"), "predictive": ex.get("predictive")}}


@app.get("/dossier/{country}/field/{name}/history")
async def history(country: str, name: str):
    iso3 = await _iso3(country)
    return {"field": name, "versions": [dict(r) for r in _lib.get_history(iso3, name)]}


@app.post("/dossier/{country}/field/{name}/edit")
async def edit(country: str, name: str, body: EditBody):
    iso3 = await _iso3(country)
    result = _lib.manual_edit(iso3, name, body.value, body.changed_by, body.note)
    return {"result": result, "field": dict(_lib.get_field(iso3, name))}


@app.get("/dossier/{country}/export.xlsx")
async def export_xlsx(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, "Build the dossier first.")
    from engine.exports.excel import build_excel
    data = build_excel(country, iso3, rows)
    return Response(content=data,
                    media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{iso3}_dossier.xlsx"'})


@app.get("/dossier/{country}/export.pptx")
async def export_pptx(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, "Build the dossier first.")
    from engine.exports.slides import build_pptx
    ex = _extras(iso3, lang)
    trends = json.loads(ex["trends"]) if ex.get("trends") else {}
    trade = json.loads(ex["trade"]) if ex.get("trade") else {}
    ts = json.loads(ex["tearsheet"]) if ex.get("tearsheet") else {}
    summary = (ts.get("read") if ts else None) or ex.get("summary")
    found = sum(1 for r in rows if r.get("value") is not None)
    data = build_pptx(country, iso3, rows, trends=trends, trade=trade, summary=summary, lang=lang,
                      analysis=ex.get("analysis"), talking_points=ex.get("talking_points"),
                      predictive=ex.get("predictive"), council=ex.get("council"),
                      coverage=(found / len(rows)) if rows else None)
    return Response(content=data,
                    media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
                    headers={"Content-Disposition": f'attachment; filename="{iso3}_brief.pptx"'})


@app.get("/dossier/{country}/infographic.svg")
async def infographic(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, "Build the dossier first.")
    from engine.exports.infographic import build_infographic_svg
    found = sum(1 for r in rows if r.get("value") is not None)
    cov = found / len(rows) if rows else 0.0
    extras = _lib.get_extras(iso3)
    spec = None
    if extras.get("media_spec"):
        try:
            spec = json.loads(extras["media_spec"])
        except Exception:
            spec = None
    svg = build_infographic_svg(country, iso3, rows, cov, spec, lang=lang)
    return Response(content=svg, media_type="image/svg+xml")


@app.get("/compare")
async def compare(countries: str, lang: str = "en"):
    names = [c.strip() for c in countries.split(",") if c.strip()][:4]
    if len(names) < 2:
        raise HTTPException(400, "Provide at least 2 countries (comma-separated).")
    from engine.compare import build_comparison
    return await build_comparison(names, _lib, _llm(), lang=lang)


@app.post("/chat")
async def chat(body: ChatBody):
    llm = _llm()
    if llm is None:
        raise HTTPException(400, "Chat needs an OpenAI key (set OPENAI_API_KEY in .env).")
    from engine.agents.chat import ChatAgent
    return await ChatAgent(llm).answer(body.question, _lib, lang=body.lang, country_iso=body.country_iso)


@app.get("/dossier/{country}/export.pdf")
async def export_pdf(country: str, lang: str = "en"):
    iso3 = await _iso3(country)
    await _ensure_ar(country, iso3, lang)
    rows = _rows(iso3, lang)
    if not rows:
        raise HTTPException(404, "Build the dossier first.")
    from engine.exports.pdf import build_pdf
    extras = _extras(iso3, lang)
    data = build_pdf(country, iso3, rows, extras.get("summary"), extras.get("analysis"),
                     extras.get("talking_points"), extras.get("predictive"), lang=lang,
                     council=extras.get("council"))
    return Response(content=data, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{iso3}_brief.pdf"'})


@app.post("/monitor/{country}")
async def monitor(country: str, lang: str = "en"):
    from engine.monitor import monitor_country
    return await monitor_country(country, _lib, _llm(), lang=lang)


# ═════════ Activity log (AI log + user log) & per-agent memory ═════════

@app.get("/logs")
def logs(actor_type: Optional[str] = None, run_id: Optional[str] = None,
         country: Optional[str] = None, limit: int = 200):
    return {"events": _lib.get_log(actor_type, run_id, country, limit)}


@app.post("/logs/user")
def log_user(body: UserLogBody):
    _lib.log_event("user", body.actor, body.action, body.detail,
                   country_iso=body.country_iso)
    return {"result": "logged"}


@app.get("/runs")
def runs(country: Optional[str] = None, limit: int = 20):
    return {"runs": _lib.list_runs(country, limit)}


@app.get("/memory")
def memory(run_id: Optional[str] = None, agent: Optional[str] = None,
           country: Optional[str] = None):
    return {"notes": _lib.memory_read(run_id, agent, country)}


# ═════════ Parameters: per-agent model configuration ═════════

_MODEL_OPTIONS = [
    "gpt-5.5", "gpt-5.4",
    "gpt-4o", "gpt-4o-mini", "gpt-4o-mini-search-preview", "gpt-4.1", "gpt-4.1-mini",
    "o3-mini",
    # Core42 Compass sovereign targets (OpenAI-compatible gateway):
    "claude-sonnet-4", "k2-think", "jais-70b", "jais-30b", "llama-3.3-70b",
    # Z SDK WEB proxy (default — works in all regions):
    "z-sdk-default",
]


@app.get("/config/models")
def get_models():
    from engine.config import load_config as _load
    cfg = _load()
    api_base = cfg.api_base or ""
    active_provider = "z-sdk-web" if "3040" in api_base else "openai"
    return {"default_provider": cfg.default_provider,
            "active_provider": active_provider,
            "providers": ["z-sdk-web", "openai"],
            "options": _MODEL_OPTIONS,
            "agents": {n: {"model": m.model, "temperature": m.temperature}
                       for n, m in cfg.agents.items()}}


@app.post("/config/models")
def set_model(body: ModelUpdateBody):
    """Update one agent's model/temperature in config/models.yaml (comments preserved)."""
    from engine.config import _CONFIG_PATH
    path = Path(_CONFIG_PATH)
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    out, i, found = [], 0, False
    while i < len(lines):
        line = lines[i]
        out.append(line)
        if line.rstrip("\n").split("#")[0].strip() == f"{body.agent}:" and line.startswith("  "):
            found = True
            j = i + 1
            while j < len(lines) and (lines[j].startswith("    ") or not lines[j].strip()):
                s = lines[j].lstrip()
                if s.startswith("model:"):
                    comment = lines[j].split("#", 1)
                    tail = ("  # " + comment[1].strip() + "\n") if len(comment) > 1 else "\n"
                    out.append(f"    model: {body.model}{tail}")
                elif s.startswith("temperature:") and body.temperature is not None:
                    out.append(f"    temperature: {body.temperature}\n")
                else:
                    out.append(lines[j])
                j += 1
            i = j
            continue
        i += 1
    if not found:
        raise HTTPException(404, f"Agent '{body.agent}' not found in models.yaml")
    path.write_text("".join(out), encoding="utf-8")
    # hot-reload the global config so the change applies without a restart
    global _cfg
    from engine.config import load_config as _load
    _cfg = _load()
    _lib.log_event("user", body.changed_by, "config",
                   f"Set {body.agent} model to {body.model}"
                   + (f", temp {body.temperature}" if body.temperature is not None else ""))
    return {"result": "updated", **get_models()}


# ═════════ Home-page news: Central Asia × UAE ═════════

_NEWS_FALLBACK = [
    {"title": "UAE and Kazakhstan deepen energy partnership — Masdar advances 1 GW wind project",
     "link": "https://masdar.ae", "source": "fallback", "published": ""},
    {"title": "AD Ports Group expands logistics footprint along the Trans-Caspian corridor",
     "link": "https://adports.ae", "source": "fallback", "published": ""},
    {"title": "UAE–Uzbekistan investment platform targets renewable energy and agritech",
     "link": "https://mofa.gov.ae", "source": "fallback", "published": ""},
]


@app.get("/news")
async def news(q: str = "UAE Central Asia energy infrastructure", limit: int = 10):
    """Live headlines via Google News RSS; graceful fallback when offline."""
    import re as _re
    url = ("https://news.google.com/rss/search?q="
           + q.replace(" ", "+") + "&hl=en&gl=AE&ceid=AE:en")
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(url, headers={"User-Agent": "MOEI-Intelligence/0.2"})
            r.raise_for_status()
        items = []
        for m in _re.finditer(r"<item>(.*?)</item>", r.text, _re.S):
            blk = m.group(1)
            def _tag(t):
                mm = _re.search(rf"<{t}>(.*?)</{t}>", blk, _re.S)
                return (mm.group(1) if mm else "").replace("<![CDATA[", "").replace("]]>", "").strip()
            title = _tag("title")
            src = _re.search(r"<source[^>]*>(.*?)</source>", blk)
            items.append({"title": title, "link": _tag("link"),
                          "published": _tag("pubDate"),
                          "source": (src.group(1) if src else "")})
            if len(items) >= limit:
                break
        if items:
            return {"items": items, "live": True}
    except Exception:
        pass
    return {"items": _NEWS_FALLBACK, "live": False}


# ═════════ Paid / private source API keys (Bloomberg-style) ═════════

@app.get("/keys")
def keys_list():
    return {"keys": _lib.list_api_keys()}


@app.post("/keys")
def keys_add(body: ApiKeyBody):
    if not body.provider.strip() or not body.key.strip():
        raise HTTPException(400, "provider and key are required")
    _lib.set_api_key(body.provider, body.key.strip(), body.added_by)
    _lib.log_event("user", body.added_by, "api_key",
                   f"Added/updated API key for paid source '{body.provider}'.")
    return {"result": "saved", "keys": _lib.list_api_keys()}


@app.delete("/keys/{provider}")
def keys_delete(provider: str):
    _lib.delete_api_key(provider)
    _lib.log_event("user", "user", "api_key", f"Removed API key for '{provider}'.")
    return {"result": "deleted", "keys": _lib.list_api_keys()}


# ═════════ Internal database (hard isolation — never leaves this machine) ═════════

@app.get("/internal")
def internal_list():
    return {"datasets": _lib.list_internal_datasets(),
            "isolation_policy": "Internal data is stored locally only. It is never sent "
                                "to the web, to external models, or mixed into agent "
                                "research context."}


@app.post("/internal")
def internal_add(body: InternalDataBody):
    n_rows = body.content.count("\n")
    ds_id = _lib.add_internal_dataset(body.name, body.content, body.filename,
                                      n_rows, body.uploaded_by)
    _lib.log_event("user", body.uploaded_by, "internal_data",
                   f"Linked internal dataset '{body.name}' ({n_rows} rows). "
                   f"Isolation: internal-only.")
    return {"result": "linked", "id": ds_id, "datasets": _lib.list_internal_datasets()}


@app.get("/internal/{ds_id}")
def internal_get(ds_id: int):
    ds = _lib.get_internal_dataset(ds_id)
    if not ds:
        raise HTTPException(404, "dataset not found")
    return ds


@app.delete("/internal/{ds_id}")
def internal_delete(ds_id: int):
    _lib.delete_internal_dataset(ds_id)
    _lib.log_event("user", "user", "internal_data", f"Removed internal dataset #{ds_id}.")
    return {"result": "deleted", "datasets": _lib.list_internal_datasets()}
