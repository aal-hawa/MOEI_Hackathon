"""Arabic rendering helpers for exports — the fix for the 'encoding damage'.

The PDF export uses reportlab, whose built-in fonts (Helvetica) have NO Arabic
glyphs and do no shaping/bidi, so Arabic came out as boxes or disconnected,
left-to-right letters. This module:

  * finds an Arabic-capable TrueType font on the machine (Windows Arial/Tahoma/
    Dubai, Linux Noto/Amiri, or a font bundled under engine/exports/fonts/), and
    registers it with reportlab;
  * shapes + bidi-orders Arabic text (arabic_reshaper + python-bidi) so connected
    forms and right-to-left order are correct.

Everything degrades gracefully: if the libraries or a font are unavailable the
helpers return the original text and signal that the Arabic font is missing, so
the export still succeeds (just without perfect Arabic shaping) instead of crashing.
"""
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Optional

_AR_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")

# Candidate Arabic-capable TTFs, in priority order. The bundled path lets a team
# drop a font in to guarantee identical output across machines.
_FONT_CANDIDATES = [
    str(Path(__file__).resolve().parent / "fonts" / "NotoSansArabic-Regular.ttf"),
    str(Path(__file__).resolve().parent / "fonts" / "Amiri-Regular.ttf"),
    # Windows
    "C:/Windows/Fonts/tahoma.ttf", "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/Dubai-Regular.ttf", "C:/Windows/Fonts/segoeui.ttf",
    # macOS
    "/Library/Fonts/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf",
    # Linux (Noto / Amiri / DejaVu — install fonts-noto for best results)
    "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
    "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Regular.ttf",
    "/usr/share/fonts/truetype/amiri/amiri-regular.ttf",
    "/usr/share/fonts/truetype/kacst/KacstOne.ttf",
]

AR_FONT_NAME = "ArabicMOEI"
_REGISTERED: Optional[str] = None     # None = not yet tried; "" = unavailable

# SVG/PowerPoint can rely on the viewer's own Arabic fonts; this family lists good ones.
AR_FONT_FAMILY = "'Noto Sans Arabic','Dubai','Tahoma','Segoe UI',sans-serif"


def has_arabic(text) -> bool:
    return bool(text) and bool(_AR_RE.search(str(text)))


def shape(text) -> str:
    """Shape + bidi-order Arabic for renderers that don't do it themselves
    (reportlab). Safe no-op when libs are missing or text has no Arabic."""
    if not text:
        return "" if text is None else text
    s = str(text)
    if not has_arabic(s):
        return s
    try:
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(s))
    except Exception:
        return s


def register_pdf_font() -> Optional[str]:
    """Register an Arabic-capable TTF with reportlab. Returns the font name or None.
    Cached after the first attempt."""
    global _REGISTERED
    if _REGISTERED is not None:
        return _REGISTERED or None
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
    except Exception:
        _REGISTERED = ""
        return None
    extra = [p for p in (os.getenv("ARABIC_FONT_PATH"),) if p]
    for path in extra + _FONT_CANDIDATES:
        try:
            if path and Path(path).is_file():
                pdfmetrics.registerFont(TTFont(AR_FONT_NAME, path))
                _REGISTERED = AR_FONT_NAME
                return AR_FONT_NAME
        except Exception:
            continue
    _REGISTERED = ""
    return None
