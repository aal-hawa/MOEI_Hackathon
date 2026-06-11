"""The Library: versioned, audited, freshness-aware store.

upsert_field appends a new version on every real change (new figure or manual
edit) and keeps `fields` pointing at the latest. Nothing is ever overwritten —
so you get a full audit trail and real numeric history."""
from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from ..timeutils import now_iso
from ..sources import SEED_SOURCES
from .db import connect, init_db
from .models import StoredField


def _now() -> str:
    return now_iso()


class Library:
    def __init__(self, db_path: str):
        self.conn = connect(db_path)
        init_db(self.conn)
        self._seed_sources()

    def close(self) -> None:
        self.conn.close()

    # ── dossier header ───────────────────────────────────────────────────────
    def upsert_dossier(self, iso3: str, name: str, iso2: str = "") -> None:
        now = _now()
        self.conn.execute(
            """INSERT INTO dossiers (country_iso, name, iso2, created_at, updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(country_iso) DO UPDATE SET
                   name=excluded.name, iso2=excluded.iso2, updated_at=excluded.updated_at""",
            (iso3, name, iso2, now, now),
        )
        self.conn.commit()

    # ── field reads ──────────────────────────────────────────────────────────
    def get_field(self, iso3: str, field_name: str) -> Optional[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM fields WHERE country_iso=? AND field_name=?",
            (iso3, field_name),
        ).fetchone()

    def list_dossiers(self) -> list:
        rows = self.conn.execute("""
            SELECT d.country_iso, d.name, d.iso2, d.updated_at,
                   SUM(CASE WHEN f.value IS NOT NULL THEN 1 ELSE 0 END) AS found,
                   COUNT(f.field_name) AS total
            FROM dossiers d LEFT JOIN fields f ON f.country_iso = d.country_iso
            GROUP BY d.country_iso ORDER BY d.updated_at DESC
        """).fetchall()
        return [dict(r) for r in rows]

    def get_dossier_row(self, iso3: str):
        r = self.conn.execute("SELECT * FROM dossiers WHERE country_iso=?", (iso3,)).fetchone()
        return dict(r) if r else None

    def get_dossier(self, iso3: str) -> List[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM fields WHERE country_iso=? ORDER BY domain, field_name",
            (iso3,),
        ).fetchall()

    def get_history(self, iso3: str, field_name: str) -> List[sqlite3.Row]:
        return self.conn.execute(
            "SELECT * FROM field_versions WHERE country_iso=? AND field_name=? "
            "ORDER BY recorded_at ASC, id ASC",
            (iso3, field_name),
        ).fetchall()

    # ── write with versioning ────────────────────────────────────────────────
    @staticmethod
    def _changed(cur: sqlite3.Row, f: StoredField) -> bool:
        return (
            str(cur["value"]) != str(f.value)
            or (cur["source_name"] or "") != (f.source_name or "")
            or (cur["as_of_date"] or "") != (f.as_of_date or "")
        )

    def upsert_field(self, iso3: str, f: StoredField) -> str:
        """Returns 'created' | 'updated' | 'unchanged'."""
        now = _now()
        cur = self.get_field(iso3, f.field_name)
        if cur is None:
            self._write_current(iso3, f, now)
            self._append_version(iso3, f, now)
            self.conn.commit()
            return "created"
        if self._changed(cur, f):
            self._write_current(iso3, f, now)
            self._append_version(iso3, f, now)
            self.conn.commit()
            return "updated"
        self.conn.execute(
            "UPDATE fields SET last_checked_at=? WHERE country_iso=? AND field_name=?",
            (now, iso3, f.field_name),
        )
        self.conn.commit()
        return "unchanged"

    def manual_edit(self, iso3: str, field_name: str, value, changed_by: str,
                    note: Optional[str] = None, value_num: Optional[float] = None,
                    unit: Optional[str] = None) -> str:
        """Human-in-the-loop override. Recorded as its own MANUAL provenance tier,
        fully audited (who + when). Requires changed_by."""
        if not changed_by:
            raise ValueError("manual_edit requires changed_by (audit).")
        cur = self.get_field(iso3, field_name)
        domain = cur["domain"] if cur else "manual"
        f = StoredField(
            field_name=field_name, domain=domain,
            value=None if value is None else str(value), value_num=value_num, unit=unit,
            source_name=f"MANUAL — {changed_by}",
            as_of_date=datetime.now(timezone.utc).date().isoformat(),
            tier=5, confidence="high", corroborated=False,
            change_type="manual", changed_by=changed_by, note=note,
        )
        return self.upsert_field(iso3, f)

    def _write_current(self, iso3: str, f: StoredField, now: str) -> None:
        self.conn.execute(
            """INSERT INTO fields (country_iso, field_name, domain, value, value_num,
                   unit, source_name, source_url, as_of_date, tier, confidence,
                   corroborated, change_type, changed_by, note, updated_at, last_checked_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(country_iso, field_name) DO UPDATE SET
                   domain=excluded.domain, value=excluded.value, value_num=excluded.value_num,
                   unit=excluded.unit, source_name=excluded.source_name,
                   source_url=excluded.source_url, as_of_date=excluded.as_of_date,
                   tier=excluded.tier, confidence=excluded.confidence,
                   corroborated=excluded.corroborated, change_type=excluded.change_type,
                   changed_by=excluded.changed_by, note=excluded.note,
                   updated_at=excluded.updated_at, last_checked_at=excluded.last_checked_at""",
            (iso3, f.field_name, f.domain,
             None if f.value is None else str(f.value), f.value_num, f.unit,
             f.source_name, f.source_url, f.as_of_date, f.tier, f.confidence,
             int(f.corroborated), f.change_type, f.changed_by, f.note, now, now),
        )

    def _append_version(self, iso3: str, f: StoredField, now: str) -> None:
        self.conn.execute(
            """INSERT INTO field_versions (country_iso, field_name, domain, value,
                   value_num, unit, source_name, source_url, as_of_date, tier,
                   confidence, corroborated, change_type, changed_by, note, recorded_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (iso3, f.field_name, f.domain,
             None if f.value is None else str(f.value), f.value_num, f.unit,
             f.source_name, f.source_url, f.as_of_date, f.tier, f.confidence,
             int(f.corroborated), f.change_type, f.changed_by, f.note, now),
        )

    # ── coverage + freshness ─────────────────────────────────────────────────
    def coverage(self, iso3: str, expected: List[str]) -> float:
        if not expected:
            return 0.0
        rows = {r["field_name"]: r for r in self.get_dossier(iso3)}
        found = sum(1 for n in expected if n in rows and rows[n]["value"] is not None)
        return round(found / len(expected), 3)

    def not_found(self, iso3: str, expected: List[str]) -> List[str]:
        rows = {r["field_name"]: r for r in self.get_dossier(iso3)}
        return [n for n in expected if n not in rows or rows[n]["value"] is None]

    def is_stale(self, iso3: str, field_name: str, ttl_days: int) -> bool:
        r = self.get_field(iso3, field_name)
        if r is None:
            return True
        checked = datetime.fromisoformat(r["last_checked_at"])
        return datetime.now(timezone.utc) - checked > timedelta(days=ttl_days)

    # ── generated extras (summary / analysis / media spec) ───────────────────
    def set_extras(self, iso3: str, summary=None, analysis=None, media_spec=None,
                   lang: str = "en", predictive=None, talking_points=None, trends=None,
                   trade=None, council=None) -> None:
        now = _now()
        self.conn.execute(
            """INSERT INTO dossier_extras (country_iso, summary, analysis, media_spec,
                   predictive, talking_points, trends, trade, council, lang, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(country_iso) DO UPDATE SET
                   summary=excluded.summary, analysis=excluded.analysis,
                   media_spec=excluded.media_spec, predictive=excluded.predictive,
                   talking_points=excluded.talking_points, trends=excluded.trends,
                   trade=COALESCE(excluded.trade, dossier_extras.trade),
                   council=COALESCE(excluded.council, dossier_extras.council),
                   lang=excluded.lang, updated_at=excluded.updated_at""",
            (iso3, summary, analysis, media_spec, predictive, talking_points, trends,
             trade, council, lang, now))
        self.conn.commit()

    def get_extras(self, iso3: str) -> dict:
        r = self.conn.execute("SELECT * FROM dossier_extras WHERE country_iso=?", (iso3,)).fetchone()
        return dict(r) if r else {}

    # ── per-language narrative (EN and AR coexist) ───────────────────────────
    def set_extras_lang(self, iso3: str, lang: str, summary=None, analysis=None,
                        predictive=None, talking_points=None, tearsheet=None,
                        dashboard=None, council=None) -> None:
        now = _now()
        self.conn.execute(
            """INSERT INTO dossier_extras_lang (country_iso, lang, summary, analysis,
                   predictive, talking_points, tearsheet, dashboard, council, updated_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(country_iso, lang) DO UPDATE SET
                   summary=excluded.summary, analysis=excluded.analysis,
                   predictive=excluded.predictive, talking_points=excluded.talking_points,
                   tearsheet=excluded.tearsheet,
                   dashboard=COALESCE(excluded.dashboard, dossier_extras_lang.dashboard),
                   council=COALESCE(excluded.council, dossier_extras_lang.council),
                   updated_at=excluded.updated_at""",
            (iso3, lang, summary, analysis, predictive, talking_points, tearsheet,
             dashboard, council, now))
        self.conn.commit()

    def get_extras_lang(self, iso3: str, lang: str) -> dict:
        r = self.conn.execute(
            "SELECT * FROM dossier_extras_lang WHERE country_iso=? AND lang=?",
            (iso3, lang)).fetchone()
        return dict(r) if r else {}

    # ── per-language field-value localizations ───────────────────────────────
    def set_localization(self, iso3: str, field_name: str, lang: str, value: str) -> None:
        now = _now()
        self.conn.execute(
            """INSERT INTO field_localizations (country_iso, field_name, lang, value, updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(country_iso, field_name, lang) DO UPDATE SET
                   value=excluded.value, updated_at=excluded.updated_at""",
            (iso3, field_name, lang, value, now))
        self.conn.commit()

    def get_localizations(self, iso3: str, lang: str) -> dict:
        rows = self.conn.execute(
            "SELECT field_name, value FROM field_localizations WHERE country_iso=? AND lang=?",
            (iso3, lang)).fetchall()
        return {r["field_name"]: r["value"] for r in rows}

    # ── activity log (AI log + user log) ─────────────────────────────────────
    def log_event(self, actor_type: str, actor: str, action: str, detail: str = "",
                  run_id: Optional[str] = None, country_iso: Optional[str] = None) -> None:
        self.conn.execute(
            """INSERT INTO activity_log (run_id, actor_type, actor, action, detail,
                   country_iso, created_at) VALUES (?,?,?,?,?,?,?)""",
            (run_id, actor_type, actor, action, detail, country_iso, _now()))
        self.conn.commit()

    def get_log(self, actor_type: Optional[str] = None, run_id: Optional[str] = None,
                country_iso: Optional[str] = None, limit: int = 200) -> list:
        q, args = "SELECT * FROM activity_log WHERE 1=1", []
        if actor_type:
            q += " AND actor_type=?"; args.append(actor_type)
        if run_id:
            q += " AND run_id=?"; args.append(run_id)
        if country_iso:
            q += " AND country_iso=?"; args.append(country_iso)
        q += " ORDER BY id DESC LIMIT ?"; args.append(limit)
        return [dict(r) for r in self.conn.execute(q, args).fetchall()]

    def list_runs(self, country_iso: Optional[str] = None, limit: int = 20) -> list:
        q = """SELECT run_id, country_iso, MIN(created_at) AS started,
                      MAX(created_at) AS ended, COUNT(*) AS events
               FROM activity_log WHERE run_id IS NOT NULL"""
        args: list = []
        if country_iso:
            q += " AND country_iso=?"; args.append(country_iso)
        q += " GROUP BY run_id ORDER BY started DESC LIMIT ?"; args.append(limit)
        return [dict(r) for r in self.conn.execute(q, args).fetchall()]

    # ── per-agent working memory ─────────────────────────────────────────────
    def memory_write(self, run_id: str, agent: str, note: str,
                     country_iso: Optional[str] = None) -> None:
        self.conn.execute(
            "INSERT INTO agent_memory (run_id, agent, country_iso, note, created_at) "
            "VALUES (?,?,?,?,?)", (run_id, agent, country_iso, note, _now()))
        self.conn.commit()

    def memory_read(self, run_id: Optional[str] = None, agent: Optional[str] = None,
                    country_iso: Optional[str] = None, limit: int = 300) -> list:
        q, args = "SELECT * FROM agent_memory WHERE 1=1", []
        if run_id:
            q += " AND run_id=?"; args.append(run_id)
        if agent:
            q += " AND agent=?"; args.append(agent)
        if country_iso:
            q += " AND country_iso=?"; args.append(country_iso)
        q += " ORDER BY id ASC LIMIT ?"; args.append(limit)
        return [dict(r) for r in self.conn.execute(q, args).fetchall()]

    # ── paid / private source API keys ───────────────────────────────────────
    def set_api_key(self, provider: str, key_value: str, added_by: str = "user") -> None:
        self.conn.execute(
            """INSERT INTO api_keys (provider, key_value, added_by, status, updated_at)
               VALUES (?,?,?, 'active', ?)
               ON CONFLICT(provider) DO UPDATE SET key_value=excluded.key_value,
                   added_by=excluded.added_by, status='active', updated_at=excluded.updated_at""",
            (provider.strip().lower(), key_value, added_by, _now()))
        self.conn.commit()

    def list_api_keys(self) -> list:
        rows = self.conn.execute("SELECT * FROM api_keys ORDER BY provider").fetchall()
        out = []
        for r in rows:
            d = dict(r)
            k = d.pop("key_value", "") or ""
            d["key_masked"] = (k[:4] + "•" * max(4, len(k) - 8) + k[-4:]) if len(k) > 8 else "•" * 8
            out.append(d)
        return out

    def delete_api_key(self, provider: str) -> None:
        self.conn.execute("DELETE FROM api_keys WHERE provider=?", (provider.strip().lower(),))
        self.conn.commit()

    # ── internal datasets (hard isolation — never leave this machine) ────────
    def add_internal_dataset(self, name: str, content: str, filename: Optional[str] = None,
                             n_rows: Optional[int] = None, uploaded_by: str = "user") -> int:
        cur = self.conn.execute(
            """INSERT INTO internal_datasets (name, filename, content, n_rows, isolation,
                   uploaded_by, created_at) VALUES (?,?,?,?, 'internal', ?, ?)""",
            (name, filename, content, n_rows, uploaded_by, _now()))
        self.conn.commit()
        return cur.lastrowid

    def list_internal_datasets(self) -> list:
        rows = self.conn.execute(
            """SELECT id, name, filename, n_rows, isolation, uploaded_by, created_at
               FROM internal_datasets ORDER BY id DESC""").fetchall()
        return [dict(r) for r in rows]

    def get_internal_dataset(self, ds_id: int) -> Optional[dict]:
        r = self.conn.execute("SELECT * FROM internal_datasets WHERE id=?", (ds_id,)).fetchone()
        return dict(r) if r else None

    def delete_internal_dataset(self, ds_id: int) -> None:
        self.conn.execute("DELETE FROM internal_datasets WHERE id=?", (ds_id,))
        self.conn.commit()

    # ── trusted-source registry ──────────────────────────────────────────────
    def _seed_sources(self) -> None:
        n = self.conn.execute("SELECT COUNT(*) AS c FROM sources").fetchone()["c"]
        if n:
            return
        now = _now()
        self.conn.executemany(
            """INSERT OR IGNORE INTO sources
               (domain, name, tier, category, status, origin, times_seen, updated_at)
               VALUES (?,?,?,?, 'trusted', 'seed', 0, ?)""",
            [(d, name, tier, cat, now) for (d, name, tier, cat) in SEED_SOURCES])
        self.conn.commit()

    def list_sources(self) -> list:
        rows = self.conn.execute(
            """SELECT * FROM sources
               ORDER BY (status='blocked') ASC, COALESCE(tier,9) ASC,
                        times_seen DESC, domain ASC""").fetchall()
        return [dict(r) for r in rows]

    def blocked_domains(self) -> list:
        rows = self.conn.execute(
            "SELECT domain FROM sources WHERE status='blocked'").fetchall()
        return [r["domain"] for r in rows]

    def record_source(self, domain: str, name: Optional[str] = None,
                      tier: Optional[int] = None) -> None:
        """Auto-populate the registry as dossiers are built. Increments times_seen
        and fills missing name/tier; never downgrades a manual/seed entry's status."""
        if not domain:
            return
        now = _now()
        cur = self.conn.execute("SELECT * FROM sources WHERE domain=?", (domain,)).fetchone()
        if cur is None:
            self.conn.execute(
                """INSERT INTO sources (domain, name, tier, category, status, origin,
                       times_seen, first_seen, last_seen, updated_at)
                   VALUES (?,?,?,?, 'trusted', 'auto', 1, ?, ?, ?)""",
                (domain, name, tier, None, now, now, now))
        else:
            new_name = cur["name"] or name
            new_tier = cur["tier"] if cur["tier"] is not None else tier
            self.conn.execute(
                """UPDATE sources SET times_seen=times_seen+1, last_seen=?,
                       name=?, tier=?, first_seen=COALESCE(first_seen,?), updated_at=?
                   WHERE domain=?""",
                (now, new_name, new_tier, now, now, domain))
        self.conn.commit()

    def add_source(self, domain: str, name: Optional[str] = None, tier: Optional[int] = None,
                   category: Optional[str] = None, changed_by: str = "user",
                   note: Optional[str] = None) -> str:
        if not domain:
            raise ValueError("domain required")
        now = _now()
        self.conn.execute(
            """INSERT INTO sources (domain, name, tier, category, status, origin,
                   times_seen, first_seen, last_seen, changed_by, note, updated_at)
               VALUES (?,?,?,?, 'trusted', 'manual', 0, ?, ?, ?, ?, ?)
               ON CONFLICT(domain) DO UPDATE SET
                   name=COALESCE(excluded.name, sources.name),
                   tier=COALESCE(excluded.tier, sources.tier),
                   category=COALESCE(excluded.category, sources.category),
                   status='trusted', changed_by=excluded.changed_by,
                   note=excluded.note, updated_at=excluded.updated_at""",
            (domain, name, tier, category, now, now, changed_by, note, now))
        self.conn.commit()
        return "added"

    def set_source_status(self, domain: str, status: str, changed_by: str = "user") -> str:
        if status not in ("trusted", "blocked"):
            raise ValueError("status must be trusted|blocked")
        now = _now()
        cur = self.conn.execute("SELECT 1 FROM sources WHERE domain=?", (domain,)).fetchone()
        if cur is None:
            # allow pre-blocking a domain never seen yet
            self.conn.execute(
                """INSERT INTO sources (domain, status, origin, times_seen, changed_by, updated_at)
                   VALUES (?,?, 'manual', 0, ?, ?)""", (domain, status, changed_by, now))
        else:
            self.conn.execute(
                "UPDATE sources SET status=?, changed_by=?, updated_at=? WHERE domain=?",
                (status, changed_by, now, domain))
        self.conn.commit()
        return status

