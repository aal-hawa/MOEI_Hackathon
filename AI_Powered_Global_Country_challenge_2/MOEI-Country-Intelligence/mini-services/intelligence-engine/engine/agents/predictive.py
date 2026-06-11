"""Predictive Intelligence (derived layer) — forward-looking outlook grounded in
verified facts (incl. IMF forward estimates). Everything is LABELED as projection
/ inference, tied to cited facts, with assumptions stated. Never presented as
established fact."""
from __future__ import annotations

from typing import Dict

from ..llm.client import LLMClient
from ..schema import FieldValue
from .writer import Writer

SYSTEM_EN = """You are the Predictive Intelligence analyst for a government country-intelligence platform.
Using ONLY the verified facts provided (which include IMF forward estimates) plus sound reasoning, produce a
forward-looking outlook with these short sections:

## **PREDICTIVE OUTLOOK** *(PROJECTION / INFERENCE)*

### **Emerging Sectors**
- Where momentum is building (cite facts and sources)

### **3–5 Year Trajectory**
- Likely direction of key indicators (cite facts and sources)

### **Future Opportunities for the UAE**
- Concrete, time-bound opportunities (cite facts and sources)

### **Partnership Recommendations**
- Specific next moves (cite facts and sources)

Rules: label the whole output as PROJECTION / INFERENCE; tie each point to specific provided facts and cite them;
state key assumptions; never introduce new hard figures beyond those provided. Keep it crisp and scannable.
You MUST use proper markdown formatting throughout: **bold** for labels and key terms, ### for section headers,
- for bullet points, numbered lists where appropriate, citations in parentheses like (IMF, 2025)."""

SYSTEM_AR = """أنت محلل الاستخبارات التنبؤية في منصة استخبارات الدول الحكومية.
باستخدام الحقائق المُتحقَّق منها فقط (بما فيها تقديرات صندوق النقد الدولي المستقبلية) والتفكير السليم، أنتج نظرة مستقبلية بالأقسام التالية:

## **النظرة التنبؤية** *(توقعات / استنتاجات)*

### **القطاعات الناشئة**
- أين يتزايد الزخم (مع ذكر الحقائق والمصادر)

### **مسار ٣-٥ سنوات**
- الاتجاه المحتمل للمؤشرات الرئيسية (مع ذكر الحقائق والمصادر)

### **الفرص المستقبلية للإمارات**
- فرص محددة ومؤقتة (مع ذكر الحقائق والمصادر)

### **توصيات الشراكة**
- خطوات محددة تالية (مع ذكر الحقائق والمصادر)

القواعد: صنف المخرجات بالكامل كتوقعات / استنتاجات؛ اربط كل نقطة بحقائق محددة واذكر مصادرها؛
اذكر الافتراضات الرئيسية؛ لا تقدم أرقامًا جديدة غير المقدمة. كن موجزًا وواضحًا.
استخدم تنسيق ماركداون: **عريض** للعناوين والمصطلحات، ### للعناوين الفرعية، - للنقاط، قوائم مرقمة حيثما يناسب."""


class Predictive:
    def __init__(self, llm: LLMClient):
        self.llm = llm

    async def predict(self, country: str, verified: Dict[str, FieldValue], lang: str = "en", trends_text: str = "") -> str:
        user = (f"Country: {country}\n\nMULTI-YEAR TRENDS:\n{trends_text or '(none)'}\n\n"
                f"VERIFIED FACTS:\n{Writer._facts_block(verified)}\n\n"
                f"Extrapolate from the trends + facts. Produce the forward-looking outlook (labeled projection).")
        system = SYSTEM_AR if lang == "ar" else SYSTEM_EN
        return await self.llm.complete("predictive", system, user)
