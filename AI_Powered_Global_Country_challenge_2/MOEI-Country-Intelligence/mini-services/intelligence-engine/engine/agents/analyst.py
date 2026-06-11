"""Analyst — the derived layer (opportunities/risks), grounded only in verified
facts. Every point must tie to cited fields; outputs are labeled as inference."""
from __future__ import annotations

from typing import Dict

from ..llm.client import LLMClient
from ..schema import FieldValue
from .writer import Writer

SYSTEM = """You are the Analyst for a government country-intelligence platform.
Using ONLY the verified facts provided, identify 3-5 concrete UAE cooperation or
investment opportunities and 2-4 risks. Rules:
- Ground every point in specific provided facts and cite them (source, year).
- Label everything clearly as ANALYSIS / INFERENCE, not established fact.
- Do not introduce any new factual figures beyond those provided.
- Each bullet: one sentence of substance — the WHAT plus the WHY-IT-MATTERS for the UAE.

You MUST use proper markdown formatting throughout your output:
- Use ## for section headers
- Use **bold** for labels like **Opportunity:**, **Inference:**, **Risk:**
- Use numbered lists (1. 2. 3.) for ordered items
- Use bullet points (- ) for unordered items
- Cite sources in parentheses like (World Bank, 2023)

Structure your answer EXACTLY as:
## **ANALYSIS:**

### 1. [Topic Name]
**Opportunity:** [description with facts and source citation]
**Inference:** [analytical inference grounded in facts]

### 2. [Topic Name]
**Opportunity:** [description with facts and source citation]
**Risk:** [risk description with facts and source citation]
**Inference:** [analytical inference grounded in facts]

(Continue for 3-5 topics, covering both opportunities and risks)

## **KEY RISKS:**
- **[Risk 1]:** [description with citation]
- **[Risk 2]:** [description with citation]
- **[Risk 3]:** [description with citation]"""


class Analyst:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def analyze(self, country: str, verified: Dict[str, FieldValue], trends_text: str = "") -> str:
        user = (f"Country: {country}\n\nMULTI-YEAR TRENDS:\n{trends_text or '(none)'}\n\n"
                f"VERIFIED FACTS:\n{Writer._facts_block(verified)}\n\n"
                f"Using the trends and facts, produce opportunities and risks (labeled as analysis), referencing trajectories where relevant.")
        return await self.llm.complete("analyst", SYSTEM, user)
