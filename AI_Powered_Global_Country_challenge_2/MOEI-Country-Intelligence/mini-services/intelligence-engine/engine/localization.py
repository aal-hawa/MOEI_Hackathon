"""Lazy Arabic localization — 'Arabic always renders Arabic'.

When an Arabic view or export is requested for a country that was only ever built
in English, we translate the data values and the narrative on demand, cache them
(so it is instant next time), and serve Arabic. This means dossiers built before
the localization layer existed self-heal on first Arabic open — no full rebuild.

Requires an LLM key. With no key it is a safe no-op and the caller falls back to
English (and should tell the user a key is needed for Arabic translation).
"""
from __future__ import annotations

import json
from typing import Optional

from .agents.localizer import Localizer
from .dashboard import build_dashboard_payload, build_dashboard_spec
from .tearsheet import build_tearsheet

_NARRATIVE_KEYS = ("summary", "analysis", "predictive", "talking_points")


def _loads(s):
    try:
        return json.loads(s) if s else None
    except Exception:
        return None


def ar_is_ready(library, iso3: str) -> bool:
    """True if Arabic data values + narrative are already cached."""
    loc = library.get_localizations(iso3, "ar")
    lex = library.get_extras_lang(iso3, "ar")
    return bool(loc) and bool(lex.get("summary") or lex.get("tearsheet"))


async def ensure_ar(library, llm, iso3: str, country: str) -> bool:
    """Make sure Arabic values + narrative + tear sheet are cached. Returns True if
    Arabic is available afterwards. No-op (returns existing state) without an LLM."""
    if ar_is_ready(library, iso3):
        return True
    if llm is None:
        return False
    rows = library.get_dossier(iso3)
    if not rows:
        return False

    loc_agent = Localizer(llm)
    base = library.get_extras(iso3) or {}
    en = library.get_extras_lang(iso3, "en") or {}
    trends = _loads(base.get("trends")) or {}
    trade = _loads(base.get("trade"))

    # 1) data field values
    have_loc = library.get_localizations(iso3, "ar")
    if not have_loc:
        fields = {r["field_name"]: {"value": r["value"], "unit": r["unit"],
                                    "found": r["value"] is not None} for r in rows}
        try:
            loc = await loc_agent.localize(country, fields, "ar")
        except Exception:
            loc = {}
        for fn, val in loc.items():
            library.set_localization(iso3, fn, "ar", val)
        have_loc = library.get_localizations(iso3, "ar")

    # 2) narrative prose + the executive read (translate the EN versions)
    lex_ar = library.get_extras_lang(iso3, "ar") or {}
    src = {**base, **en}
    texts = {k: src.get(k) for k in _NARRATIVE_KEYS if src.get(k)}
    en_ts = _loads(en.get("tearsheet")) or {}
    if en_ts.get("read"):
        texts["read"] = en_ts["read"]
    translated = {}
    if texts and not lex_ar.get("summary"):
        try:
            translated = await loc_agent.translate_texts(country, texts)
        except Exception:
            translated = {}

    # 3) AR tear sheet: rebuild structured part from AR-localized rows + AR read
    ar_fields = {}
    for r in rows:
        val = have_loc.get(r["field_name"], r["value"])
        ar_fields[r["field_name"]] = {
            "value": val, "unit": r["unit"], "found": r["value"] is not None,
            "source": r["source_name"], "source_url": r["source_url"], "as_of": r["as_of_date"]}
    ar_ts = build_tearsheet(country, iso3, ar_fields, trends, trade)
    ar_ts["read"] = translated.get("read") or en_ts.get("read")

    # AR dashboard (deterministic, governance-safe; titles localize in the UI)
    ar_dp = build_dashboard_payload(
        country, iso3, ar_fields, trends, trade,
        executive_summary=ar_ts.get("read"),
        analysis=translated.get("analysis") or src.get("analysis"),
        predictive=translated.get("predictive") or src.get("predictive"))
    ar_dash = build_dashboard_spec(country, ar_dp)

    library.set_extras_lang(
        iso3, "ar",
        summary=translated.get("summary") or src.get("summary"),
        analysis=translated.get("analysis") or src.get("analysis"),
        predictive=translated.get("predictive") or src.get("predictive"),
        talking_points=translated.get("talking_points") or src.get("talking_points"),
        tearsheet=json.dumps(ar_ts), dashboard=json.dumps(ar_dash))
    return True
