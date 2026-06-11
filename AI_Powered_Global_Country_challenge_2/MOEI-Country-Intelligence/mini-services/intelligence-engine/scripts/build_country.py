"""CLI runner.  Examples:
    python -m scripts.build_country Morocco
    python -m scripts.build_country Morocco --no-llm     # numbers only, no API key
    python -m scripts.build_country Morocco --lang ar
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from engine.config import load_config
from engine.library import Library
from engine.llm.client import LLMClient
from engine.pipeline import build_dossier_stream


async def run(country: str, use_llm: bool, lang: str) -> None:
    cfg = load_config()
    lib = Library(cfg.db_path)
    llm = LLMClient(cfg) if (use_llm and cfg.openai_api_key) else None
    if use_llm and not cfg.openai_api_key:
        print("  [no OPENAI_API_KEY found -> building numbers-only dossier]\n")

    final = {}
    async for ev in build_dossier_stream(country, lib, llm, lang=lang):
        if ev["stage"] != "done":
            print(f"  … {ev['msg']}")
        else:
            final = ev

    print("\n" + "=" * 70)
    print(f"  {final['country']} ({final['iso3']})   "
          f"coverage {final['coverage']*100:.0f}%  "
          f"({final['found']}/{final['expected']} fields)")
    print("=" * 70)
    for name, f in final["fields"].items():
        if f["found"]:
            unit = f" {f['unit']}" if f["unit"] else ""
            star = "*" if f["corroborated"] else " "
            print(f"  {star} {name:<34} {str(f['value'])[:22]:<22}{unit:<12}"
                  f" ({f['source']}, {f['as_of']})")
    if final["not_found"]:
        print("\n  NOT FOUND:", ", ".join(final["not_found"]))
    if final.get("summary"):
        print("\n  ── EXECUTIVE SUMMARY ──\n")
        print("  " + final["summary"].replace("\n", "\n  "))
    if final.get("analysis"):
        print("\n  ── OPPORTUNITIES & RISKS (analysis) ──\n")
        print("  " + final["analysis"].replace("\n", "\n  "))
    lib.close()


def main() -> None:
    ap = argparse.ArgumentParser(description="Build a verified country dossier.")
    ap.add_argument("country", help="country name or ISO code, e.g. Morocco / MAR")
    ap.add_argument("--no-llm", action="store_true", help="numbers only, no API key needed")
    ap.add_argument("--lang", default="en", choices=["en", "ar"])
    args = ap.parse_args()
    asyncio.run(run(args.country, use_llm=not args.no_llm, lang=args.lang))


if __name__ == "__main__":
    main()
