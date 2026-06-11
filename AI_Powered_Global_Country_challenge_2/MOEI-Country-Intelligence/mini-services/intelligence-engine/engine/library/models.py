"""Plain (stdlib) record the Library stores. No pydantic/httpx import here so the
Library layer is dependency-light and unit-testable on its own."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional


@dataclass
class StoredField:
    field_name: str
    domain: str
    value: Optional[str] = None          # None == NOT FOUND
    value_num: Optional[float] = None
    unit: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    as_of_date: Optional[str] = None
    tier: Optional[int] = None
    confidence: str = "low"
    corroborated: bool = False
    change_type: str = "api_refresh"
    changed_by: Optional[str] = None
    note: Optional[str] = None

    @property
    def found(self) -> bool:
        return self.value is not None
