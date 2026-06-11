"""Pre-warm the Library — build dossiers ahead of time so demo loads are instant.

    python -m scripts.prewarm                      # default hero list
    python -m scripts.prewarm Morocco Germany UAE  # specific countries
    python -m scripts.prewarm --lang ar Morocco
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.config import load_config
from engine.library import Library
from engine.llm.client import LLMClient
from engine.pipeline import build_dossier

DEFAULT = ["Morocco", "Germany", "Brazil", "Japan", "UAE", "Egypt", "France", "India"]


async def run(countries, lang):
    cfg = load_config()
    lib = Library(cfg.db_path)
    llm = LLMClient(cfg) if cfg.openai_api_key else None
    if llm is None:
        print("  [no OPENAI_API_KEY — building numbers only]")
    print(f"Pre-warming {len(countries)} countries (this is the slow part — once)...\n")
    for c in countries:
        t = time.time()
        print(f"… {c}")
        try:
            res = await build_dossier(c, lib, llm, refresh=True, lang=lang)
            print(f"  done: {res.get('country')} — {round(res.get('coverage',0)*100)}% "
                  f"({res.get('found')}/{res.get('expected')}) in {time.time()-t:.0f}s")
        except Exception as e:
            print(f"  FAILED {c}: {e}")
    lib.close()
    print("\nAll cached. Every load in the app is now instant (until Refresh or 7-day expiry).")


def main():
    ap = argparse.ArgumentParser(description="Pre-build country dossiers into the Library.")
    ap.add_argument("countries", nargs="*", help="country names (default: hero list)")
    ap.add_argument("--lang", default="en", choices=["en", "ar"])
    args = ap.parse_args()
    asyncio.run(run(args.countries or DEFAULT, args.lang))


if __name__ == "__main__":
    main()
