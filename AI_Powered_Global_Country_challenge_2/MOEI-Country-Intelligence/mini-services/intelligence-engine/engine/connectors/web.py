"""Web-research source client (Tier 2-4) — domain-fenced, cited, recency-first.

BATCHED mode: ONE search per domain (all that domain's fields at once) — far fewer
calls than per-field, so it's fast. Today's date is injected live so the model
anchors on 'now'. No source URL or a non-answer -> dropped (NOT FOUND)."""
from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import litellm

from ..config import Config
from ..timeutils import today_iso
from ..schema import ChangeType, Confidence, FieldValue, Provenance

TRUSTED = ("official government and ministry sites, national statistics offices, central "
           "banks, sovereign wealth funds, IEA, IRENA, World Bank, IMF, UN, WIPO, and "
           "reputable outlets (Reuters, Bloomberg, Financial Times, The National)")

_JUNK = ("no information", "not available", "not specified", "not publicly available",
         "no specific information", "no data", "none found", "not found", "unknown",
         "n/a", "na", "not disclosed", "no info")

_SEM: Optional[asyncio.Semaphore] = None


def _sem() -> asyncio.Semaphore:
    global _SEM
    if _SEM is None:
        _SEM = asyncio.Semaphore(8)
    return _SEM


def _is_junk(value, url) -> bool:
    if not value or not url:
        return True
    if not str(url).lower().startswith("http"):
        return True
    v = str(value).strip().lower()
    if len(v) < 2:
        return True
    return any(v == j or v.startswith(j) for j in _JUNK)


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


class WebResearcher:
    def __init__(self, config: Config, model: Optional[str] = None):
        self.config = config
        try:
            self.model = model or config.model_for("researcher_web").model
        except Exception:
            self.model = "gpt-4o-mini-search-preview"
        self.api_base = config.api_base
        self.batch = max(1, getattr(config, 'web_batch_size', 4))

    async def research(self, country: str,
                       specs: Dict[str, Tuple[object, int, str]],
                       lang: str = "en") -> List[FieldValue]:
        """specs = { field_name: (Domain, tier, hint) }. Split into batches of
        `web_batch_size` fields, each its own search, run concurrently."""
        if not specs:
            return []
        items = list(specs.items())
        chunks = [dict(items[i:i + self.batch]) for i in range(0, len(items), self.batch)]
        results = await asyncio.gather(*[self._search_chunk(country, c, lang) for c in chunks],
                                       return_exceptions=True)
        out: List[FieldValue] = []
        for r in results:
            if isinstance(r, list):
                out.extend(r)
        return out

    async def _search_chunk(self, country: str,
                            specs: Dict[str, Tuple[object, int, str]],
                            lang: str = "en") -> List[FieldValue]:
        if not specs:
            return []
        today = today_iso()
        ask = "\n".join(f"- {f}: {hint}" for f, (_, _, hint) in specs.items())
        lang_note = "Write values in Arabic." if lang == "ar" else "Write values in English."
        system = (
            f"You are a Web-Research agent for a government country-intelligence platform. "
            f"TODAY'S DATE IS {today}. Report the MOST RECENT verified value as of today; for "
            f"leadership/government/events check for any recent change and give the current state. "
            f"Use ONLY {TRUSTED}. {lang_note} For every field give the fact, source name, a REAL "
            f"source URL, and the date/year. Never invent; omit any field you cannot verify. "
            'Reply ONLY as JSON: {"results":[{"field":"","value":"","source_name":"","url":"","as_of":""}]}'
        )
        user = f"Country: {country}\nFields to find:\n{ask}"
        params = {"model": self.model,
                  "messages": [{"role": "system", "content": system},
                               {"role": "user", "content": user}]}
        if self.api_base:
            params["api_base"] = self.api_base

        data = None
        for attempt in range(2):
            try:
                async with _sem():
                    resp = await litellm.acompletion(**params)
                data = _parse_json(resp.choices[0].message.content or "")
                break
            except Exception:
                if attempt == 1:
                    return []
                await asyncio.sleep(1.5)

        out: List[FieldValue] = []
        for r in (data or {}).get("results", []):
            f = r.get("field")
            val = r.get("value")
            url = r.get("url")
            if f not in specs or _is_junk(val, url):
                continue
            domain, tier, _ = specs[f]
            out.append(FieldValue(
                name=f, domain=domain, value=val,
                provenance=Provenance(source_name=r.get("source_name") or "web source",
                                      url=url, tier=tier, as_of_date=str(r.get("as_of") or "")),
                confidence=Confidence.medium, change_type=ChangeType.web_research))
        return out
