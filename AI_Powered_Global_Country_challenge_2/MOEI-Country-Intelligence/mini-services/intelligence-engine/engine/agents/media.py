"""Visualizer — the AI visual director with CREATIVE FREEDOM inside hard data governance.

The agent decides the STORY: headline, angle, theme, which metric is the hero,
which facts deserve the spotlight, what one-line takeaway sits under each, and a
pull-quote. It can be as creative as it wants about narrative and emphasis.
The one thing it cannot do is invent data: every reference is validated against
the verified dossier, every number is drawn by the deterministic renderer from
stored values, and any reference that doesn't exist is silently dropped."""
from __future__ import annotations

import json
from typing import Dict

from ..llm.client import LLMClient
from ..schema import FieldValue
from .writer import Writer

SYSTEM_EN = """You are the Visualizer — the creative visual director of a government
country-intelligence platform. You design the country one-pager that a minister sees.

CREATIVE FREEDOM (yours):
- Find the most compelling STORY in the verified facts: a transition, a tension,
  an opportunity, a trajectory. Don't be generic — be specific to THIS country.
- Write a sharp headline (<= 8 words) and a subtitle (<= 14 words) that carry the story.
- Pick the theme that fits the story mood: "dark" (authoritative, default),
  "light" (open, optimistic), or "teal" (sustainability/green-led story).
- Choose the HERO metric — the single number that anchors the story (any verified field).
- Choose up to 6 supporting KPIs and up to 6 highlight facts that build the story arc.
- For each highlight, write a "note": one short punchy takeaway line (<= 12 words)
  that tells the minister why this fact matters. Label-style, insightful, concrete.
- Write a pull_quote: ONE sentence (<= 22 words) — the single thing to remember.

DATA GOVERNANCE (absolute, non-negotiable):
- Reference fields ONLY from the provided allowed list. Anything else is dropped.
- NEVER write a number, date, or statistic in any text you produce — the renderer
  injects exact verified values. Your words carry meaning, the data carries figures.
- Notes and the pull_quote must be supported by the provided facts/analysis only.

Reply ONLY as JSON:
{"headline":"","subtitle":"","caption":"","theme":"dark|light|teal",
 "hero_kpi":"field","featured_kpis":["field"],"highlight_fields":["field"],
 "highlight_notes":{"field":"note"},"pull_quote":""}"""

SYSTEM_AR = SYSTEM_EN + "\nWrite headline, subtitle, caption, notes and pull_quote in Arabic."


class MediaGenerator:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def compose(self, country: str, verified: Dict[str, FieldValue],
                      analysis: str = "", lang: str = "en") -> dict:
        names = [k for k, v in verified.items() if v.found]
        if not names:
            return {}
        user = (f"Country: {country}\n"
                f"Allowed field names (choose only from these): {', '.join(names)}\n\n"
                f"VERIFIED FACTS:\n{Writer._facts_block(verified)}\n\n"
                f"ANALYST INSIGHTS:\n{analysis or '(none)'}\n\n"
                f"Find the story. Design the one-pager. Return the JSON spec.")
        system = SYSTEM_AR if lang == "ar" else SYSTEM_EN
        try:
            raw = await self.llm.complete("media", system, user, json_mode=True)
            spec = json.loads(raw)
        except Exception:
            return {}
        # ── hard validation: creativity ends where the data ends ──
        spec["featured_kpis"] = [f for f in spec.get("featured_kpis", []) if f in names][:6]
        spec["highlight_fields"] = [f for f in spec.get("highlight_fields", []) if f in names][:6]
        if spec.get("hero_kpi") not in names:
            spec.pop("hero_kpi", None)
        notes = spec.get("highlight_notes") or {}
        spec["highlight_notes"] = {k: str(v)[:90] for k, v in notes.items()
                                   if k in spec["highlight_fields"] and v}
        if spec.get("theme") not in ("dark", "light", "teal"):
            spec["theme"] = "dark"
        for key in ("headline", "subtitle", "caption", "pull_quote"):
            if spec.get(key):
                spec[key] = str(spec[key])[:160]
        return spec
