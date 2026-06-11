"""Verifier — the no-hallucination gate (deterministic for v1).

Merges fields gathered from all connectors:
  * higher source tier wins;
  * on a tier tie, the MORE RECENT figure wins (so a current-year IMF estimate
    beats a 2-year-old actual) — recency without ever inventing a date;
  * agreement across >=2 sources sets corroborated=True;
  * genuine conflicts lower confidence.
Unsourced values can't reach here (schema rejects them); no data stays NOT FOUND."""
from __future__ import annotations

from typing import Dict, List

from ..schema import Confidence, FieldValue


def _year(fv: FieldValue) -> int:
    p = fv.provenance
    if not p or not p.as_of_date:
        return -1
    try:
        return int(str(p.as_of_date)[:4])
    except (ValueError, TypeError):
        return -1


class Verifier:
    NUM_TOLERANCE = 0.05  # 5% — treat near-equal numbers as agreement

    def verify(self, gathered: List[FieldValue]) -> Dict[str, FieldValue]:
        groups: Dict[str, List[FieldValue]] = {}
        for fv in gathered:
            groups.setdefault(fv.name, []).append(fv)

        verified: Dict[str, FieldValue] = {}
        for name, items in groups.items():
            valued = [i for i in items if i.found]
            if not valued:
                verified[name] = items[0]  # NOT FOUND preserved
                continue
            # tier ascending (1 best), then most-recent year first
            valued.sort(key=lambda i: (i.provenance.tier if i.provenance else 9, -_year(i)))
            best = valued[0]
            best_tier = best.provenance.tier if best.provenance else 9
            corroborated = False
            conflict = False
            for other in valued[1:]:
                if self._agree(best, other):
                    corroborated = True
                elif (other.provenance.tier if other.provenance else 9) == best_tier:
                    # Only a SAME-TIER disagreement is a real conflict. A weaker
                    # (lower-tier) source must not downgrade an authoritative one
                    # — e.g. LLM web text must not undermine a Tier-1 Comtrade fact.
                    conflict = True
            best.corroborated = best.corroborated or corroborated
            if conflict and not corroborated:
                best.confidence = Confidence.medium
            verified[name] = best
        return verified

    def _agree(self, a: FieldValue, b: FieldValue) -> bool:
        if a.value_num is not None and b.value_num is not None:
            if a.value_num == 0:
                return b.value_num == 0
            return abs(a.value_num - b.value_num) / abs(a.value_num) <= self.NUM_TOLERANCE
        return str(a.value).strip().lower() == str(b.value).strip().lower()
