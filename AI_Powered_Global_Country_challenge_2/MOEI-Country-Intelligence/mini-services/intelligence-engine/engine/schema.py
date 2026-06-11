"""Domain schema + the structural no-hallucination rule.

A FieldValue with a present `value` MUST carry `provenance`; otherwise it is
invalid and cannot move through the system. A missing fact is represented as
`value=None` (NOT FOUND) — never a guess. This turns the no-hallucination rule
from a prompt instruction into a validation guarantee (Pydantic).
"""
from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field as PField, model_validator

from .library.models import StoredField


class Domain(str, Enum):
    identity = "identity"
    economy = "economy"
    energy = "energy"
    infrastructure = "infrastructure"
    sustainability = "sustainability"
    innovation = "innovation"
    uae_relations = "uae_relations"
    news = "news"


class Confidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class ChangeType(str, Enum):
    initial = "initial"
    api_refresh = "api_refresh"
    web_research = "web_research"
    manual = "manual"


class Provenance(BaseModel):
    source_name: str
    url: Optional[str] = None
    as_of_date: Optional[str] = None      # ISO date or year string
    tier: int = PField(ge=1, le=5)


class FieldValue(BaseModel):
    name: str
    domain: Domain
    value: Optional[Any] = None           # None == NOT FOUND
    value_num: Optional[float] = None
    unit: Optional[str] = None
    provenance: Optional[Provenance] = None
    confidence: Confidence = Confidence.low
    corroborated: bool = False
    change_type: ChangeType = ChangeType.api_refresh
    changed_by: Optional[str] = None

    @model_validator(mode="after")
    def _enforce_no_hallucination(self):
        if self.value is not None and self.provenance is None:
            raise ValueError(
                f"Field '{self.name}': value present without provenance — forbidden "
                f"by the no-hallucination rule. Provide a source or mark NOT FOUND."
            )
        if self.change_type == ChangeType.manual and not self.changed_by:
            raise ValueError(f"Field '{self.name}': manual change requires 'changed_by'.")
        return self

    @property
    def found(self) -> bool:
        return self.value is not None

    def to_stored(self) -> StoredField:
        p = self.provenance
        return StoredField(
            field_name=self.name,
            domain=self.domain.value,
            value=None if self.value is None else str(self.value),
            value_num=self.value_num,
            unit=self.unit,
            source_name=(p.source_name if p else None),
            source_url=(p.url if p else None),
            as_of_date=(p.as_of_date if p else None),
            tier=(p.tier if p else None),
            confidence=self.confidence.value,
            corroborated=self.corroborated,
            change_type=self.change_type.value,
            changed_by=self.changed_by,
        )


class Dossier(BaseModel):
    country: str
    iso2: str
    iso3: str
    fields: dict[str, FieldValue] = PField(default_factory=dict)

    def add(self, fv: FieldValue) -> None:
        self.fields[fv.name] = fv

    def coverage(self, expected: list[str]) -> float:
        if not expected:
            return 0.0
        found = sum(1 for n in expected if n in self.fields and self.fields[n].found)
        return round(found / len(expected), 3)

    def not_found(self, expected: list[str]) -> list[str]:
        return [n for n in expected if n not in self.fields or not self.fields[n].found]
