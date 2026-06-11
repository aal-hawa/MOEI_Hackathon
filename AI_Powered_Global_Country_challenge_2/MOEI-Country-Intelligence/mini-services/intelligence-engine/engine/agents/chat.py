"""Conversational AI Search — answers free-form strategic questions, grounded in
the verified Library first, with live web search for specifics. Always cited;
never contradicts the dossiers; says so when it lacks verified data."""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Dict, List, Optional

import httpx
import litellm

from ..connectors import resolve_country
from ..timeutils import today_iso
from ..library import Library
from ..llm.client import LLMClient


class ChatAgent:
    def __init__(self, llm: LLMClient):
        self.llm = llm
        try:
            self.search_model = llm.config.model_for("chat").model
        except Exception:
            self.search_model = "gpt-4o-mini-search-preview"
        self.api_base = llm.config.api_base

    async def _countries(self, question: str) -> List[str]:
        sys = ('Extract any country names mentioned in the question. '
               'Return JSON {"countries":[...]}. Empty list if none.')
        try:
            d = await self.llm.complete_json("orchestrator", sys, question)
            return [c for c in d.get("countries", []) if isinstance(c, str)][:4]
        except Exception:
            return []

    async def answer(self, question: str, library: Library, lang: str = "en",
                     country_iso: Optional[str] = None) -> Dict:
        from ..pipeline import build_dossier  # lazy
        names = await self._countries(question)
        resolved = []
        async with httpx.AsyncClient() as client:
            # If a specific country is selected in the UI, ensure its context is included
            if country_iso:
                try:
                    nm, _, iso3 = await resolve_country(country_iso, client)
                    resolved.append((nm, iso3))
                except Exception:
                    pass
            for c in names:
                try:
                    nm, _, iso3 = await resolve_country(c, client)
                    # Skip if already added via country_iso to avoid duplicates
                    if iso3 not in [existing_iso for _, existing_iso in resolved]:
                        resolved.append((nm, iso3))
                except Exception:
                    continue
        for nm, iso3 in resolved:
            if not library.get_dossier(iso3):
                try:
                    await build_dossier(nm, library, self.llm, with_analysis=False, lang=lang)
                except Exception:
                    pass

        ctx = []
        for nm, iso3 in resolved:
            for r in library.get_dossier(iso3):
                if r["value"] is not None:
                    ctx.append(f"{nm} · {r['field_name']}: {r['value']} "
                               f"({r['source_name']}, {r['as_of_date']})")
        context = "\n".join(ctx) if ctx else "(no stored verified facts for the referenced countries)"

        today = today_iso()
        lang_note = "Answer in Arabic." if lang == "ar" else "Answer in English."
        system = (
            f"You are the conversational intelligence assistant for a government country-intelligence "
            f"platform. TODAY IS {today}. {lang_note} Answer the question using FIRST the verified facts "
            f"provided below, then reputable/official web sources for anything missing. Cite every claim "
            f"(source, year) with a real link where possible. Prefer the most recent information. If you "
            f"cannot verify something, say so plainly — never invent. Keep it concise and decision-oriented. "
            f"Use proper markdown formatting: **bold** for key terms and labels, ## for section headers, "
            f"- for bullet points, numbered lists where appropriate, and cite sources in parentheses."
        )
        user = f"VERIFIED FACTS (from the platform's Library):\n{context}\n\nQUESTION: {question}"
        params = {"model": self.search_model,
                  "messages": [{"role": "system", "content": system},
                               {"role": "user", "content": user}]}
        if self.api_base:
            params["api_base"] = self.api_base
        try:
            resp = await litellm.acompletion(**params)
            answer = resp.choices[0].message.content or ""
        except Exception as e:
            answer = f"Sorry — the assistant could not complete the request ({e})."
        return {"answer": answer, "countries": [n for n, _ in resolved]}
