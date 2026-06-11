"""SQLite schema for the Library. `fields` = current value (latest shown);
`field_versions` = append-only history (audit + numeric history);
`dossier_extras` = generated summary/analysis/media spec per country."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS dossiers (
    country_iso TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    iso2        TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS fields (
    country_iso TEXT NOT NULL, field_name TEXT NOT NULL, domain TEXT NOT NULL,
    value TEXT, value_num REAL, unit TEXT, source_name TEXT, source_url TEXT,
    as_of_date TEXT, tier INTEGER, confidence TEXT, corroborated INTEGER DEFAULT 0,
    change_type TEXT, changed_by TEXT, note TEXT,
    updated_at TEXT NOT NULL, last_checked_at TEXT NOT NULL,
    PRIMARY KEY (country_iso, field_name)
);
CREATE TABLE IF NOT EXISTS field_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    country_iso TEXT NOT NULL, field_name TEXT NOT NULL, domain TEXT NOT NULL,
    value TEXT, value_num REAL, unit TEXT, source_name TEXT, source_url TEXT,
    as_of_date TEXT, tier INTEGER, confidence TEXT, corroborated INTEGER DEFAULT 0,
    change_type TEXT, changed_by TEXT, note TEXT, recorded_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_versions_field
    ON field_versions (country_iso, field_name, recorded_at);
CREATE TABLE IF NOT EXISTS dossier_extras (
    country_iso TEXT PRIMARY KEY,
    summary TEXT, analysis TEXT, media_spec TEXT, predictive TEXT, talking_points TEXT, trends TEXT,
    lang TEXT, updated_at TEXT NOT NULL
);
-- Per-language generated narrative (so EN and AR coexist; building one no longer
-- overwrites the other). tearsheet holds the structured executive fact sheet JSON.
CREATE TABLE IF NOT EXISTS dossier_extras_lang (
    country_iso TEXT NOT NULL, lang TEXT NOT NULL,
    summary TEXT, analysis TEXT, predictive TEXT, talking_points TEXT, tearsheet TEXT,
    dashboard TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (country_iso, lang)
);
-- Per-language localized values for narrative fields (numbers are language-neutral).
CREATE TABLE IF NOT EXISTS field_localizations (
    country_iso TEXT NOT NULL, field_name TEXT NOT NULL, lang TEXT NOT NULL,
    value TEXT, updated_at TEXT NOT NULL,
    PRIMARY KEY (country_iso, field_name, lang)
);
-- Unified audit trail: every agent action (AI log) and user action (user log).
CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      TEXT,                 -- groups one briefing build
    actor_type  TEXT NOT NULL,        -- 'agent' | 'user' | 'system'
    actor       TEXT NOT NULL,        -- agent name or username
    action      TEXT NOT NULL,        -- stage / verb (plan, research, verify, export…)
    detail      TEXT,                 -- human-readable reasoning / message
    country_iso TEXT,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_log_run ON activity_log (run_id, id);
CREATE INDEX IF NOT EXISTS idx_log_actor ON activity_log (actor_type, created_at);
-- Per-agent working memory: what each agent noted to itself during a run.
CREATE TABLE IF NOT EXISTS agent_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      TEXT NOT NULL,
    agent       TEXT NOT NULL,
    country_iso TEXT,
    note        TEXT NOT NULL,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mem_run ON agent_memory (run_id, agent, id);
-- Paid / private source API keys (e.g. Bloomberg). Stored locally, masked in UI.
CREATE TABLE IF NOT EXISTS api_keys (
    provider    TEXT PRIMARY KEY,
    key_value   TEXT NOT NULL,
    added_by    TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    updated_at  TEXT NOT NULL
);
-- Internal datasets: isolation='internal' rows are NEVER sent to web or external models.
CREATE TABLE IF NOT EXISTS internal_datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    filename    TEXT,
    content     TEXT NOT NULL,
    n_rows      INTEGER,
    isolation   TEXT NOT NULL DEFAULT 'internal',
    uploaded_by TEXT,
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
    domain      TEXT PRIMARY KEY,
    name        TEXT,
    tier        INTEGER,
    category    TEXT,
    status      TEXT NOT NULL DEFAULT 'trusted',
    origin      TEXT NOT NULL DEFAULT 'auto',
    times_seen  INTEGER NOT NULL DEFAULT 0,
    first_seen  TEXT,
    last_seen   TEXT,
    changed_by  TEXT,
    note        TEXT,
    updated_at  TEXT NOT NULL
);
"""


def connect(db_path: str) -> sqlite3.Connection:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    # check_same_thread=False: FastAPI serves requests from worker threads,
    # so the connection must be usable outside the thread that created it.
    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


# Schema is idempotent (IF NOT EXISTS) and migrations are additive.
def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)
    for col in ("predictive", "talking_points", "trends", "trade"):
        try:
            conn.execute(f"ALTER TABLE dossier_extras ADD COLUMN {col} TEXT")
        except Exception:
            pass
    for table, col in (("dossier_extras_lang", "dashboard"),
                       ("dossier_extras_lang", "council"),
                       ("dossier_extras", "council")):
        try:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} TEXT")
        except Exception:
            pass
    conn.commit()
