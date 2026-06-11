# How It Works — MOEI Country Intelligence Platform

A plain-language map of the whole system: what each part does and how they link together. Pairs with the five foundation docs (`Trusted-Source-Registry`, `Country-Data-Schema`, `Agent-Workflow`, `System-Architecture`, `Brand-Guidelines`).

---

## 1. What it is, in one paragraph

You type a country. The platform dispatches a crew of AI agents that gather verified data from official sources, check every fact against its source, store it in a permanent versioned Library, and produce a decision-ready brief — executive summary, talking points, opportunities & risks, a forward-looking forecast, plus one-click exports (PowerPoint, Excel, PDF, infographic). It compares countries, answers strategic questions in chat, and monitors for changes. Every figure carries its source and date; nothing is invented. It's not a chatbot or a dashboard — it's a **digital strategic advisor for UAE leadership**.

---

## 2. The big picture (data flow)

```
            ┌──────────── Web UI (Country · Compare · Chat) ────────────┐
            │                     FastAPI + SSE                          │
            └───────────────────────────┬───────────────────────────────┘
                                         │
                            ORCHESTRATOR (plans the run)
                                         │
        ┌──────── memory-first: is it in the Library & fresh? ───────┐
        │ YES → serve instantly (≈1s)            NO/Refresh → research │
        └─────────────────────────────────────────┬──────────────────┘
                                                   │
        8 DOMAIN RESEARCH AGENTS  (run in parallel)
        identity · economy · energy · infrastructure ·
        sustainability · innovation · uae_relations · news
           │ structured-first (World Bank / IMF / REST Countries)
           │ + domain-fenced WEB RESEARCH (cited)
                                                   │
                              VERIFIER  (no-hallucination gate)
                       source-required · corroborate · NOT FOUND
                                                   │
                       LIBRARY  (versioned SQLite — store + audit)
                                                   │
        ┌──────────── derived layer (parallel) ─────────────┐
        │  ANALYST (opps/risks) · WRITER (summary + talking  │
        │  points) · PREDICTIVE (forecast) · MEDIA (infographic) │
        └────────────────────────────┬──────────────────────┘
                                      │
              OUTPUTS: dossier · comparison · chat · PPTX/Excel/PDF
                       · infographic · monitoring alerts
```

---

## 3. The agent crew (who does what)

| Agent | Job | LLM? |
|-------|-----|------|
| **Orchestrator** | Parses the request (country, topics, intent), plans & sequences, streams progress | yes (small) |
| **8 Domain Researchers** | One per schema domain, run in parallel; each pulls structured numbers + domain-fenced cited web research for its fields | yes (web part) |
| **Verifier** | The gate: enforces a source on every value, corroborates across sources, forces NOT FOUND on anything unsourced | deterministic |
| **Analyst** | Derived layer — opportunities & risks, grounded only in verified facts (labeled analysis) | yes |
| **Writer** | Executive summary **and** talking points (spoken minister bullets), synthesis-only, EN/AR | yes |
| **Predictive** | Forward outlook — emerging sectors, trajectory, future UAE opportunities, partnership moves (labeled projection) | yes |
| **Media Generator** | Picks featured fields + headline (AI), then a deterministic renderer draws the infographic — numbers come from data, never the model | yes (brain) + code (render) |
| **Monitor** | Re-checks volatile domains (events, leadership, UAE relations), diffs vs the Library, reports what changed | yes |

Separation of duties is what makes "no hallucination" enforceable: the gatherer, the verifier, and the writer are different agents.

---

## 4. The no-hallucination guarantee (how it's enforced, not promised)

1. **Structural sourcing.** Every gathered field is a Pydantic object (`engine/schema.py`); if it has a `value` it **must** have a `provenance` (source). A value without a source fails validation and cannot move through the system.
2. **NOT FOUND, never guessed.** If a fact can't be verified, the field stays `value = None` → shown as NOT FOUND. A confident wrong answer is treated as the worst failure.
3. **Cited & dated.** Each fact shows its source name, as-of date, and a click-through link (↗).
4. **Verified-only Library.** Nothing enters the Library without passing the Verifier.
5. **Versioned & audited.** Every change is snapshotted (old → new, who, when, source) in `field_versions` — a full audit trail and real numeric history.
6. **Human-in-the-loop.** Manual edits are their own audited source tier (`MANUAL — <user>, <date>`).

---

## 5. The Library (the compounding asset)

- **SQLite**, three temporal tables: `fields` (current value), `field_versions` (append-only history), `dossier_extras` (summary / analysis / talking points / predictive / media spec). Code: `engine/library/`.
- **Memory-first:** the pipeline checks the Library before researching. Fresh (< 7 days) → serve in ~1 second. Stale or **↻ Refresh** → re-research.
- **Self-enriching:** every verified fact is written back; a country is researched once, then reused forever.
- **UAE time:** all timestamps use Gulf Standard Time (UTC+4) via `engine/timeutils.py`.

---

## 6. Where the data comes from

| Tier | Source | Used for | Key? |
|------|--------|----------|------|
| 1 | World Bank Open Data | GDP, trade, energy, infra, innovation numbers | free |
| 1 | IMF (WEO) | current-year + forecast **estimates** | free |
| 1 | REST Countries | identity basics (capital, currency, languages, flag) | free |
| 2–4 | Domain-fenced web research | leadership, projects, targets, UAE relations, events — each cited | uses the AI model |

The free public APIs are the deterministic, un-fakeable numbers backbone. The web layer fills narrative/fresh fields and always returns a source URL (no URL → dropped).

All of this is governed by a live **Trusted Source Registry** (the *Sources* page). It seeds from this doc's tiered list, then **auto-populates** as dossiers are built — every domain actually cited is recorded with a *times-used* count. Leadership can **block** a domain (it is dropped in code from all future research, before verification) or **add** one. This turns "no hallucination" from prompt-dependent into code-enforced: blocked sources cannot enter the Library.

---

## 7. A request, end to end (the 7 stages)

1. **Resolve** the country (any name/language or ISO) → ISO codes.
2. **Library check (memory-first)** — fresh hit serves instantly and stops here.
3. **Orchestrator plan** — intent + topics (streamed live).
4. **Gather** — 8 domain agents fire in parallel; numbers from APIs, narrative from cited web research.
5. **Verify** — source-required, corroborate, NOT FOUND for the rest.
6. **Store** — verified dossier written to the versioned Library.
7. **Derive & deliver** — Analyst + Writer (summary + talking points) + Predictive + Media run in parallel; results stored and streamed to the UI. Exports generated on demand.

The UI shows each stage live over SSE — the "show your work" moment.

---

## 8. What it produces

- **Country dossier** — 8 domains, KPIs, every field sourced + dated.
- **Executive summary** and **talking points** (spoken minister bullets).
- **Opportunities & risks** (analysis) and a **predictive outlook** (projection).
- **Comparison** — 2–4 countries, same metric, leader highlighted, gaps shown.
- **Conversational chat** — strategic Q&A grounded in the Library + cited web.
- **Exports** — PPTX, Excel, PDF, and a data-grounded **infographic**.
- **Monitoring** — change alerts on leadership / events / UAE relations.

---

## 9. Pluggable & sovereign (config, not code)

- **LiteLLM** sits under every agent; the model per agent is set in `config/models.yaml` — swap OpenAI → Core42/Compass by editing one line. Default provider: OpenAI; sovereign target: **Core42 (one platform, one invoice, data stays in the UAE)**.
- **Tunable dials** in `config/models.yaml`: `web_batch_size` (research depth vs speed) and per-domain `freshness_days`.
- The whole no-hallucination spine (numbers + verification) runs with **no key at all** (`--no-llm`).

---

## 10. File / module map

```
intelligence-engine/
  config/models.yaml        per-agent model map + dials (the only thing you edit to retune)
  engine/
    config.py               loads env (.env) + models.yaml
    timeutils.py            UAE clock (UTC+4) used everywhere
    schema.py               Pydantic field model — the no-hallucination rule
    library/                versioned SQLite Library (fields, field_versions, extras) + tests
    connectors/             source clients: worldbank, imf, restcountries, web, registry(resolve)
    agents/                 orchestrator · domain(8) · verifier · analyst · writer · predictive · media
    pipeline.py             the 7-stage orchestration (streaming + collected)
    compare.py              comparison engine
    monitor.py              change monitoring (diff vs versioned Library)
    exports/                excel · slides(pptx) · pdf · infographic(svg)
  api/main.py               FastAPI: serves the UI + all endpoints (build, stream, compare, chat,
                            monitor, exports, field history, manual edit)
  web/                      the front-end (index.html + app.js), bilingual EN/AR
  scripts/                  build_country.py (CLI) · prewarm.py · monitor.py (scheduled)
```

---

## 11. API surface (what the UI calls)

| Method · Path | Purpose |
|---|---|
| `GET /` | the web app |
| `GET /dossier/{country}/stream?refresh=` | build (SSE live) — memory-first |
| `GET /dossier/{country}` | read cached dossier |
| `GET /dossier/{country}/field/{name}/history` | full audit history |
| `POST /dossier/{country}/field/{name}/edit` | manual edit (audited) |
| `GET /compare?countries=a,b,c` | comparison + insight |
| `POST /chat` | conversational AI search |
| `POST /monitor/{country}` | change check / alerts |
| `GET /dossier/{country}/export.{pptx,xlsx,pdf}` · `/infographic.svg` | exports |
| `GET /sources` · `POST /sources` · `POST /sources/status` | trusted-source registry: list · add · block/unblock |
| `GET /health` | status + whether the AI key is loaded |

---

## 12. Running it

```bash
pip install -r requirements.txt
cp .env.example .env          # add OPENAI_API_KEY
uvicorn api.main:app --reload # open http://127.0.0.1:8000
python -m scripts.prewarm Morocco Germany UAE   # build ahead → instant demo
python -m scripts.monitor  Morocco UAE          # scheduled change alerts
```

First build of a country is the slow part (live web research); every load after is instant from the Library.

---

## 13. How it maps to the challenge

Country Intelligence ✓ · Strategic Insights ✓ · Executive Briefing (summary, talking points, one-pager, slides) ✓ · AI Search & Conversation ✓ · Comparison Engine ✓ · Predictive Intelligence ✓ · Real-time Monitoring ✓ · Bilingual EN/AR ✓ · Sovereign single-vendor roadmap (Core42) ✓ — all on a no-hallucination, source-verified core.

*This is not a country-information platform. It is a digital strategic advisor for UAE leadership, powered by AI.*
