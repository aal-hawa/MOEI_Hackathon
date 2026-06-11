"""Orchestrator — parses the request into {country, topics, intent}. It plans and
sequences; it never gathers facts itself. Intent decides what to SHOW first, not
what to gather (the dossier is always built whole)."""
from __future__ import annotations

from typing import Any

from ..llm.client import LLMClient

SYSTEM = """You are the Orchestrator of a country-intelligence platform for government leaders.
Read the user's request and return ONLY a JSON object with these keys:
- "country": the country name or ISO code mentioned (string)
- "topics": array drawn from [identity, economy, energy, infrastructure, sustainability, innovation, uae_relations, news]; use ["all"] if unspecified
- "intent": one of "profile" | "opportunity" | "comparison" | "prediction" | "chat"
Return the JSON object and nothing else."""


class Orchestrator:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def parse(self, request: str) -> dict[str, Any]:
        return await self.llm.complete_json("orchestrator", SYSTEM, request)
