"""Council — a multi-perspective review board over the Analyst's and Predictive
agent's drafts. Four standing seats (Economist, Energy & Infrastructure
Strategist, Geopolitical Advisor, Risk Officer) debate the drafts against the
verified facts, then issue a consensus verdict with any dissent preserved.

It never adds new facts — it can only endorse, challenge, or reframe what the
upstream agents derived from verified data."""
from __future__ import annotations

from typing import Dict, Optional

from ..llm.client import LLMClient
from ..schema import FieldValue
from .writer import Writer

SYSTEM_EN = """You are THE COUNCIL of a government country-intelligence platform:
four senior reviewers who challenge the draft analysis before it reaches a UAE minister.
Seats: (1) Chief Economist, (2) Energy & Infrastructure Strategist,
(3) Geopolitical Advisor, (4) Risk Officer.

You receive VERIFIED FACTS plus the Analyst's draft (opportunities/risks) and the
Predictive agent's outlook. Run a short structured debate:
- Each seat gives a 1-2 sentence position (agree / challenge / add nuance), grounded
  ONLY in the provided facts and drafts. No new figures, ever.
- Then issue THE COUNCIL VERDICT: 3-5 lines of consensus guidance for the minister,
  a confidence grade (HIGH / MEDIUM / LOW) with one-line justification,
  and any DISSENT worth preserving (or "none").

Format with proper markdown — every label MUST be **bold** and followed by a colon:
## **COUNCIL REVIEW**

**ECONOMIST:** …

**ENERGY & INFRA STRATEGIST:** …

**GEOPOLITICAL ADVISOR:** …

**RISK OFFICER:** …

---

### **VERDICT:**
…

### **CONFIDENCE:** HIGH|MEDIUM|LOW — reason

### **DISSENT:**
… (or "none")"""

SYSTEM_AR = """أنت المجلس في منصة استخبارات الدول الحكومية:
أربعة مراجعين كبار يتحدون مسودة التحليل قبل أن تصل إلى وزير إماراتي.
المقاعد: (1) كبير الاقتصاديين، (2) استراتيجي الطاقة والبنية التحتية،
(3) المستشار الجيوسياسي، (4) مسؤول المخاطر.

تتلقى حقائق مُتحقَّق منها بالإضافة إلى مسودة المحلل (الفرص/المخاطر) ونظرة المحلل التنبؤي.
أجرِ نقاشًا منظمًا موجزًا:
- كل مقعد يعطي موقفًا من 1-2 جملة (موافقة / تحدٍ / إضافة تفصيل)، مستندًا فقط إلى الحقائق والمسودات المقدمة. لا أرقام جديدة أبدًا.
- ثم أصدر حكم المجلس: 3-5 أسطر من التوجيهات التوافقية للوزير،
  ودرجة الثقة (HIGH / MEDIUM / LOW) مع مبرر من سطر واحد،
  وأي اعتراض يستحق الحفاظ عليه (أو "none").

استخدم تنسيق ماركداون مع العناوين الإنجليزية كما هي (يتم تحليلها آليًا):
## **COUNCIL REVIEW**

**ECONOMIST:** [المحتوى بالعربية]

**ENERGY & INFRA STRATEGIST:** [المحتوى بالعربية]

**GEOPOLITICAL ADVISOR:** [المحتوى بالعربية]

**RISK OFFICER:** [المحتوى بالعربية]

---

### **VERDICT:**
[المحتوى بالعربية]

### **CONFIDENCE:** HIGH|MEDIUM|LOW — [السبب بالعربية]

### **DISSENT:**
[المحتوى بالعربية أو "none"]
"""


class Council:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def review(self, country: str, verified: Dict[str, FieldValue],
                     analysis: Optional[str], predictive: Optional[str],
                     lang: str = "en") -> str:
        user = (f"Country: {country}\n\n"
                f"VERIFIED FACTS:\n{Writer._facts_block(verified)}\n\n"
                f"ANALYST DRAFT (opportunities & risks):\n{analysis or '(not available)'}\n\n"
                f"PREDICTIVE OUTLOOK DRAFT:\n{predictive or '(not available)'}\n\n"
                f"Convene the council and issue the verdict.")
        system = SYSTEM_AR if lang == "ar" else SYSTEM_EN
        return await self.llm.complete("council", system, user)
