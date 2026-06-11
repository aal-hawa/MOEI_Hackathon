# MOEI Country Intelligence Engine

The verified, no-hallucination **brain** behind the AI-Powered Country Intelligence Platform.
It builds a complete, source-grounded country dossier, stores it in a versioned Library,
and produces a cited executive summary — in English or Arabic.

This is the engine (the hard part). It is provider-pluggable via **LiteLLM**: OpenAI today,
**Core42 / Compass** (sovereign) later, by editing one config file — no code change, one invoice.

---

## Core principles (enforced in code, not just docs)

- **No hallucination, structurally.** A field with a value *must* carry a source, or Pydantic
  rejects it (`engine/schema.py`). Missing data is `NOT FOUND`, never a guess.
- **Structured-first.** Hard numbers come from official APIs (World Bank, REST Countries) —
  deterministic and citable. The LLM only writes and reasons over already-verified facts.
- **Versioned Library.** Latest value is shown; every change is snapshotted (audit + numeric
  history). Manual edits are stamped with who + when (`engine/library/`).

---

## Setup

```bash
cd intelligence-engine
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env          # then put your key in .env:
#   OPENAI_API_KEY=sk-...
```

To switch the AI provider later (e.g. to Core42/Compass or an OpenAI-compatible gateway),
edit `config/models.yaml` (per-agent model map) and set `OPENAI_API_BASE` in `.env`.
No code changes.

---

## Run the platform (web UI) — easiest

```bash
uvicorn api.main:app --reload
# then open http://127.0.0.1:8000  in your browser
```

You get the full on-brand platform: search a country, watch the agents work live
(SSE), then explore the verified dossier — KPIs, every field with its source, the
cited executive brief, version history per field, manual editing, and an EN/AR toggle.

## Run it on Morocco (command line)

```bash
# full run (gathers data, verifies, stores, writes a cited summary)
python -m scripts.build_country Morocco

# numbers only — no API key needed (proves the grounded data spine)
python -m scripts.build_country Morocco --no-llm

# native Arabic executive summary
python -m scripts.build_country Morocco --lang ar
```

**As an API:**

```bash
uvicorn api.main:app --reload
```

| Method & path | What it does |
|---|---|
| `GET  /health` | status + whether the LLM key is loaded |
| `POST /dossier/{country}` | build a verified dossier (e.g. `/dossier/Morocco`) |
| `GET  /dossier/{country}/stream` | **SSE** live agent progress (resolve → gather → verify → store → write) |
| `GET  /dossier/{country}` | read the stored dossier |
| `GET  /dossier/{country}/field/{name}/history` | full version history (audit trail) |
| `POST /dossier/{country}/field/{name}/edit` | manual edit (requires `changed_by`, fully audited) |

---

## How it works (the pipeline)

```
country → resolve ISO → gather (World Bank + REST Countries, in parallel)
        → verify (tier priority, corroboration, conflicts; unsourced → NOT FOUND)
        → store in Library (versioned, audited)
        → Writer (cited summary, EN/AR) + Analyst (opportunities, labeled inference)
```

Run with no LLM and you get the grounded numbers dossier. Add a key and the Writer/Analyst
layer turns it into a leadership-ready brief — every claim traceable to a source.

---

## Project layout

```
intelligence-engine/
  config/models.yaml        per-agent model map (pluggable; OpenAI now, Core42 targets noted)
  engine/
    config.py               env + model-map loader
    schema.py               Pydantic field model — the no-hallucination rule, structurally
    library/                versioned SQLite Library (fields + field_versions) + tests
    connectors/             World Bank, REST Countries, registry (free Tier-1 sources)
    llm/client.py           LiteLLM wrapper (any provider)
    agents/                 orchestrator · verifier · writer · analyst
    pipeline.py             the end-to-end build (streaming + collected)
  api/main.py               FastAPI + SSE
  scripts/build_country.py  CLI runner
  tests/test_library.py     Library tests (run: python tests/test_library.py)
```

---

## Status

Built and tested: schema, versioned Library (all tests pass), connectors, agents, pipeline,
API, CLI. Live data + LLM calls run on your machine (needs network + `OPENAI_API_KEY`).

Next: more connectors (UN Comtrade, IEA/IRENA, gov sources), domain-fenced web research for
narrative fields, the Media Generator (visual summaries + video), and wiring the existing
Next.js UI to these endpoints.
