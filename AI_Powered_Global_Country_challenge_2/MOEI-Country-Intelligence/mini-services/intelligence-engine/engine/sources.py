"""Trusted-source registry helpers: the curated seed list, plus host parsing
and blocklist matching used by the Library and the pipeline.

The registry is the platform's live allowed/blocked map. Seeds come from
Trusted-Source-Registry.md. As dossiers are built, every domain actually cited
is recorded (origin='auto'); leadership can block or add domains from the UI,
and blocked domains are dropped in code before verification."""
from __future__ import annotations

from typing import Iterable, Optional
from urllib.parse import urlparse

# (domain, name, tier, category)
SEED_SOURCES = [
    # Tier 1 — official structured data
    ("data.worldbank.org", "World Bank Open Data", 1, "Multilateral data"),
    ("worldbank.org", "World Bank", 1, "Multilateral data"),
    ("imf.org", "IMF", 1, "Multilateral data"),
    ("data.imf.org", "IMF Data", 1, "Multilateral data"),
    ("comtrade.un.org", "UN Comtrade", 1, "Trade"),
    ("un.org", "United Nations", 1, "Multilateral"),
    ("iea.org", "IEA", 1, "Energy"),
    ("irena.org", "IRENA", 1, "Energy"),
    ("ember-energy.org", "Ember", 1, "Energy"),
    ("oecd.org", "OECD", 1, "Multilateral data"),
    ("data.oecd.org", "OECD Data", 1, "Multilateral data"),
    ("wto.org", "WTO", 1, "Trade"),
    ("unctad.org", "UNCTAD", 1, "Trade"),
    ("weforum.org", "World Economic Forum", 1, "Competitiveness"),
    ("imd.org", "IMD World Competitiveness", 1, "Competitiveness"),
    ("wipo.int", "WIPO", 1, "Innovation"),
    ("restcountries.com", "REST Countries", 1, "Reference data"),
    # Tier 2 — government primary sources
    ("mofa.gov.ae", "UAE Ministry of Foreign Affairs", 2, "UAE government"),
    ("moei.gov.ae", "UAE Ministry of Energy & Infrastructure", 2, "UAE government"),
    ("moec.gov.ae", "UAE Ministry of Economy", 2, "UAE government"),
    ("u.ae", "UAE Government Portal", 2, "UAE government"),
    ("gov.ae", "UAE Government", 2, "UAE government"),
    # Tier 3 — reputable analysis & reports
    ("csis.org", "CSIS", 3, "Analysis"),
    ("chathamhouse.org", "Chatham House", 3, "Analysis"),
    ("brookings.edu", "Brookings", 3, "Analysis"),
    ("about.bnef.com", "BloombergNEF", 3, "Analysis"),
    # Tier 4 — news / real-time
    ("reuters.com", "Reuters", 4, "News"),
    ("bloomberg.com", "Bloomberg", 4, "News"),
    ("ft.com", "Financial Times", 4, "News"),
    ("agbi.com", "AGBI", 4, "News"),
    ("thenationalnews.com", "The National", 4, "News"),
    ("apnews.com", "Associated Press", 4, "News"),
]


def host_of(url: Optional[str]) -> str:
    """Registrable host of a URL, lower-cased, leading 'www.' stripped."""
    if not url:
        return ""
    u = str(url).strip()
    if "://" not in u:
        u = "http://" + u
    try:
        host = (urlparse(u).hostname or "").lower()
    except Exception:
        return ""
    return host[4:] if host.startswith("www.") else host


def is_blocked(host: str, blocked: Iterable[str]) -> bool:
    """True if host equals or is a subdomain of any blocked base domain."""
    if not host:
        return False
    for d in blocked:
        d = (d or "").lower()
        if d and (host == d or host.endswith("." + d)):
            return True
    return False
