"""Writer — executive summary, grounded ONLY in verified facts (synthesis-only).
Every figure cites its source; missing data is stated, never filled. Native EN/AR
(Arabic is generated directly, not translated)."""
from __future__ import annotations

from typing import Dict

from ..llm.client import LLMClient
from ..schema import FieldValue

SYSTEM_EN = """You are the lead analyst writing THE READ for a UAE minister before a meeting.
Using ONLY the verified facts and the multi-year TRENDS provided, write a concise, INSIGHT-LED brief
(not a list of numbers). Structure it as a short flowing read with proper markdown:

## **EXECUTIVE READ**

**1. Trajectory & Structural Story** — where the economy is heading, using the trend figures (direction, CAGR/pp).

**2. Key Drivers** — sectors gaining momentum, trade structure, recent shifts.

**3. UAE Bottom Line** — why it matters now.

Rules: use ONLY provided facts/trends; cite figures like (World Bank, 2023); never invent; be crisp and executive.
You MUST use proper markdown formatting: **bold** for labels and key terms, ## headers for sections, - bullets for lists, numbered lists where appropriate."""

SYSTEM_AR = """أنت كاتب التقارير في منصة استخبارات الدول الحكومية.
اكتب ملخصًا تنفيذيًا موجزًا لمعالي الوزير، مستخدمًا فقط الحقائق المُتحقَّق منها المُعطاة.
القواعد:
- لا تستخدم أي معلومة غير موجودة في القائمة. لا تخترع شيئًا.
- بعد كل رقم، اذكر المصدر بين قوسين، مثال: "(البنك الدولي، 2023)".
- إذا كان حقل مهم مفقودًا، فاذكر بوضوح أن البيانات المُتحقَّق منها غير متوفرة.
- اكتب بالعربية الفصحى مباشرةً، بأسلوب موجز وموجَّه لاتخاذ القرار.
- استخدم تنسيق ماركداون: **عريض** للعناوين والمصطلحات المهمة، ## للعناوين الرئيسية، - للنقاط، وقوائم مرقمة حيثما يناسب."""


class Writer:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    @staticmethod
    def _facts_block(verified: Dict[str, FieldValue]) -> str:
        lines = []
        for fv in verified.values():
            if not fv.found:
                continue
            p = fv.provenance
            src = p.source_name if p else "unknown"
            if p and p.as_of_date:
                src = f"{src}, {p.as_of_date}"
            unit = f" {fv.unit}" if fv.unit else ""
            lines.append(f"- {fv.name}: {fv.value}{unit}  [source: {src}]")
        return "\n".join(lines) if lines else "(no verified facts available)"

    async def write(self, country: str, verified: Dict[str, FieldValue], lang: str = "en",
                    trends_text: str = "") -> str:
        user = (f"Country: {country}\n\n"
                f"MULTI-YEAR TRENDS:\n{trends_text or '(none)'}\n\n"
                f"VERIFIED FACTS (use ONLY these):\n{self._facts_block(verified)}\n\n"
                f"Write THE READ.")
        agent = "writer_ar" if lang == "ar" else "writer_en"
        return await self.llm.complete(agent, (SYSTEM_AR if lang == "ar" else SYSTEM_EN), user)

    async def talking_points(self, country: str, verified, lang: str = "en") -> str:
        sys_en = ("You are preparing TALKING POINTS for a UAE minister about to meet " + country + ". "
                  "Using ONLY the verified facts provided, write 6-9 short bullet lines the minister can SAY "
                  "OUT LOUD. Each is ONE confident sentence pairing a key fact (cite source + year in parentheses) "
                  "with the UAE relevance or a concrete ask. Use proper markdown formatting: "
                  "**bold** for key figures and terms, - for bullet points, numbered list for ordered items. "
                  "Crisp and executive, with clear markdown structure.")
        sys_ar = sys_en + " Write in Arabic."
        user = (f"Country: {country}\n\nVERIFIED FACTS:\n{self._facts_block(verified)}\n\n"
                f"Write the talking points.")
        agent = "writer_ar" if lang == "ar" else "writer_en"
        return await self.llm.complete(agent, (sys_ar if lang == "ar" else sys_en), user)

