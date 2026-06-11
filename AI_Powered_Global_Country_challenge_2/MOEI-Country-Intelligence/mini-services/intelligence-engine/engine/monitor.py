"""Real-time monitoring — re-checks the VOLATILE domains (events, leadership, UAE
relations) and reports what CHANGED vs the versioned Library. Fast (3 agents),
and every change is written back with full audit history. Powers alerts."""
from __future__ import annotations

import asyncio
from typing import Dict, List, Optional

import httpx

from .agents.domain import DOMAIN_AGENTS
from .agents.verifier import Verifier
from .connectors import resolve_country
from .library import Library
from .llm.client import LLMClient
from .timeutils import now_iso

VOLATILE = {"news", "identity", "uae_relations"}


async def monitor_country(country: str, library: Library,
                          llm: Optional[LLMClient] = None, lang: str = "en") -> Dict:
    agents = [a for a in DOMAIN_AGENTS if a.domain.value in VOLATILE]
    async with httpx.AsyncClient(headers={"User-Agent": "MOEI-Intelligence/0.1"}) as client:
        name, iso2, iso3 = await resolve_country(country, client)
        before = {r["field_name"]: r["value"] for r in library.get_dossier(iso3)}
        results = await asyncio.gather(
            *[a.research(name, iso2, iso3, client, llm, lang=lang) for a in agents],
            return_exceptions=True)
    gathered = []
    for r in results:
        if isinstance(r, list):
            gathered.extend(r)
    verified = Verifier().verify(gathered)

    changes: List[Dict] = []
    for k, fv in verified.items():
        if not fv.found:
            continue
        old = before.get(k)
        if str(old) != str(fv.value):
            changes.append({"field": k, "old": old, "new": fv.value,
                            "source": fv.provenance.source_name if fv.provenance else None,
                            "as_of": fv.provenance.as_of_date if fv.provenance else None})
            library.upsert_field(iso3, fv.to_stored())  # versioned write-back
    return {"country": name, "iso3": iso3, "checked_at": now_iso(),
            "changes": changes, "change_count": len(changes)}
