"""Scheduled monitoring — run periodically (cron / Task Scheduler) to detect and
alert on changes for watched countries.

    python -m scripts.monitor Morocco Germany UAE
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
from engine.monitor import monitor_country

DEFAULT = ["Morocco", "Germany", "UAE", "Brazil"]


async def run(countries, lang):
    cfg = load_config()
    lib = Library(cfg.db_path)
    llm = LLMClient(cfg) if cfg.openai_api_key else None
    for c in countries:
        try:
            res = await monitor_country(c, lib, llm, lang=lang)
            if res["change_count"]:
                print(f"\n🔔 {res['country']} — {res['change_count']} change(s) @ {res['checked_at']}")
                for ch in res["changes"]:
                    print(f"   • {ch['field']}: {str(ch['old'])[:40]} → {str(ch['new'])[:60]} ({ch['source']})")
            else:
                print(f"✓ {res['country']} — no changes ({res['checked_at']})")
        except Exception as e:
            print(f"✗ {c}: {e}")
    lib.close()


def main():
    ap = argparse.ArgumentParser(description="Monitor countries for changes (alerts).")
    ap.add_argument("countries", nargs="*")
    ap.add_argument("--lang", default="en")
    args = ap.parse_args()
    asyncio.run(run(args.countries or DEFAULT, args.lang))


if __name__ == "__main__":
    main()
