"""Stdlib-only tests for the versioned Library (no pydantic/httpx needed)."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from engine.library.repository import Library
from engine.library.models import StoredField


def main() -> None:
    db = os.path.join(tempfile.mkdtemp(), "test.db")
    lib = Library(db)
    lib.upsert_dossier("MAR", "Morocco", "MA")

    # 1) create
    gdp = StoredField("gdp_nominal_usd", "economy", value="141000000000",
                      value_num=1.41e11, unit="USD", source_name="World Bank",
                      source_url="https://api.worldbank.org", as_of_date="2023",
                      tier=1, confidence="high", corroborated=True,
                      change_type="api_refresh")
    assert lib.upsert_field("MAR", gdp) == "created"

    # 2) re-ingest identical -> unchanged (no new version, freshness bumped)
    assert lib.upsert_field("MAR", gdp) == "unchanged"

    # 3) new figure -> updated, history retained (numeric history!)
    gdp2 = StoredField("gdp_nominal_usd", "economy", value="152000000000",
                       value_num=1.52e11, unit="USD", source_name="World Bank",
                       as_of_date="2024", tier=1, confidence="high",
                       corroborated=True, change_type="api_refresh")
    assert lib.upsert_field("MAR", gdp2) == "updated"
    hist = lib.get_history("MAR", "gdp_nominal_usd")
    assert len(hist) == 2, f"expected 2 versions, got {len(hist)}"
    assert [h["value"] for h in hist] == ["141000000000", "152000000000"]
    assert lib.get_field("MAR", "gdp_nominal_usd")["value"] == "152000000000"  # latest shown

    # 4) manual edit -> audited (who), MANUAL provenance, version added
    assert lib.manual_edit("MAR", "gdp_nominal_usd", "150000000000",
                           changed_by="ikrame",
                           note="corrected per ministry source") == "updated"
    cur = lib.get_field("MAR", "gdp_nominal_usd")
    assert cur["change_type"] == "manual"
    assert cur["changed_by"] == "ikrame"
    assert cur["source_name"].startswith("MANUAL")
    assert len(lib.get_history("MAR", "gdp_nominal_usd")) == 3

    # 5) manual edit without changed_by is rejected (audit guarantee)
    try:
        lib.manual_edit("MAR", "gdp_nominal_usd", "1", changed_by="")
        raise AssertionError("manual_edit should require changed_by")
    except ValueError:
        pass

    # 6) NOT FOUND (value=None) never counts toward coverage
    lib.upsert_field("MAR", StoredField("hydrogen_strategy_targets", "energy", value=None))
    expected = ["gdp_nominal_usd", "hydrogen_strategy_targets", "capital"]
    cov = lib.coverage("MAR", expected)
    assert cov == round(1 / 3, 3), f"coverage was {cov}"
    assert lib.not_found("MAR", expected) == ["hydrogen_strategy_targets", "capital"]

    # 7) freshness
    assert lib.is_stale("MAR", "capital", ttl_days=365) is True       # missing -> stale
    assert lib.is_stale("MAR", "gdp_nominal_usd", ttl_days=365) is False

    print("\n  ALL LIBRARY TESTS PASSED\n")
    print("  GDP version history (audit + numeric trail):")
    for h in lib.get_history("MAR", "gdp_nominal_usd"):
        print(f"   {h['recorded_at'][:19]}  {h['value']:>14}  "
              f"{h['change_type']:<11} by {h['changed_by'] or '-':<8} src={h['source_name']}")
    print(f"\n  coverage(1 of 3 expected fields) = {cov}")
    print(f"  not_found = {lib.not_found('MAR', expected)}")
    lib.close()


if __name__ == "__main__":
    main()
