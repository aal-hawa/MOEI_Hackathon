"""Single source of time for the platform — UAE time (Asia/Dubai, UTC+4, no DST).
Every timestamp (Library audit, freshness, 'today' for research, export dates)
uses this so the whole system runs on the UAE timeline."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

UAE_TZ = timezone(timedelta(hours=4), name="GST")  # Gulf Standard Time


def now_uae() -> datetime:
    return datetime.now(UAE_TZ)


def now_iso() -> str:
    return now_uae().isoformat(timespec="seconds")


def today_iso() -> str:
    return now_uae().date().isoformat()
