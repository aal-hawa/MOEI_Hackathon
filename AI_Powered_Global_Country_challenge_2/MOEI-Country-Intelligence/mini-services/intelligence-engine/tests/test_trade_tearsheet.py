"""Offline tests for the new depth + localization pieces (no network, no pydantic).

Covers:
  * the UN Comtrade PARSER (summarize_trade): aggregate-row filtering, ranking,
    share computation, HS2 -> friendly label, readable rendering;
  * the tear-sheet builder (build_tearsheet): trajectory, headline, trade wiring;
  * the per-language Library storage (localizations + per-lang extras).
Run: python tests/test_trade_tearsheet.py
"""
import importlib.util
import os
import sys
import tempfile

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)


def _load(name, relpath):
    """Load a single module file directly, bypassing package __init__ (which pulls
    in httpx/litellm that aren't installed in this offline test sandbox)."""
    spec = importlib.util.spec_from_file_location(name, os.path.join(_ROOT, relpath))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_comtrade = _load("comtrade_mod", "engine/connectors/comtrade.py")
summarize_trade = _comtrade.summarize_trade
render_list = _comtrade.render_list
HS2_LABELS = _comtrade.HS2_LABELS

from engine.tearsheet import build_tearsheet, tearsheet_facts_text  # noqa: E402


def _approx(a, b, tol=0.1):
    return abs(a - b) <= tol


def test_comtrade_parser():
    # Morocco-like fixture: France + Spain dominate exports; vehicles top good.
    export_partners = [
        {"partnerCode": "0", "partnerDesc": "World", "primaryValue": 100.0},      # aggregate, dropped
        {"partnerCode": "251", "partnerDesc": "France", "primaryValue": 24.0},
        {"partnerCode": "724", "partnerDesc": "Spain", "primaryValue": 21.0},
        {"partnerCode": "380", "partnerDesc": "Italy", "primaryValue": 5.0},
        {"partnerCode": "842", "partnerDesc": "USA", "primaryValue": 0.0},          # zero, dropped
    ]
    import_partners = [
        {"partnerCode": "724", "partnerDesc": "Spain", "primaryValue": 30.0},
        {"partnerCode": "156", "partnerDesc": "China", "primaryValue": 20.0},
    ]
    export_goods = [
        {"cmdCode": "TOTAL", "cmdDesc": "All Commodities", "primaryValue": 99.0},  # dropped
        {"cmdCode": "87", "cmdDesc": "Vehicles", "primaryValue": 12.0},
        {"cmdCode": "31", "cmdDesc": "Fertilizers", "primaryValue": 8.0},
    ]
    import_goods = [
        {"cmdCode": "27", "cmdDesc": "Mineral fuels", "primaryValue": 15.0},
    ]
    s = summarize_trade(2023, export_partners, import_partners, export_goods, import_goods, top_n=5)

    assert s["year"] == 2023
    names = [p["name"] for p in s["export_partners"]]
    assert names == ["France", "Spain", "Italy"], names          # World + zero filtered, sorted desc
    # shares computed over the kept total (24+21+5 = 50)
    assert _approx(s["export_partners"][0]["share_pct"], 48.0), s["export_partners"][0]
    # HS2 friendly labels applied + TOTAL filtered
    g = [x["name"] for x in s["export_goods"]]
    assert g == ["Vehicles & automotive", "Fertilizers"], g
    assert HS2_LABELS["87"] == "Vehicles & automotive"
    assert s["import_partners"][0]["name"] == "Spain"
    # render is human-readable with share + value
    rendered = render_list(s["export_partners"])
    assert "France" in rendered and "%" in rendered
    print("OK comtrade parser:", rendered)


def test_tearsheet_builder():
    fields = {
        "gdp_per_capita_usd": {"value": 5107, "unit": "USD", "found": True,
                               "source": "World Bank", "as_of": "2024"},
        "gdp_nominal_usd": {"value": 1.5e11, "unit": "USD", "found": True,
                            "source": "World Bank", "as_of": "2024"},
        "unemployment_pct": {"value": 12.2, "unit": "%", "found": True,
                             "source": "World Bank", "as_of": "2024"},
        "momentum_sectors": {"value": "Automotive manufacturing, aerospace, renewables",
                             "found": True, "source": "Reuters", "as_of": "2025"},
        "co2_emissions_per_capita": {"value": None, "found": False},  # NOT FOUND ignored
    }
    trends = {
        "gdp_per_capita_usd": {"unit": "USD", "latest": 5107, "latest_year": 2024,
                               "span_years": 5, "cagr_pct": 3.4, "change_pct": 18.0,
                               "direction": "up", "good_up": True, "spark": [3800, 4200, 5107]},
        "unemployment_pct": {"unit": "%", "latest": 12.2, "latest_year": 2024,
                             "span_years": 5, "delta_pp": -1.1, "direction": "down",
                             "good_up": False, "spark": [13.3, 12.8, 12.2]},
    }
    trade = {"year": 2023,
             "export_partners": [{"name": "France", "value": 24e9, "share_pct": 48.0}],
             "import_partners": [], "export_goods": [], "import_goods": []}

    ts = build_tearsheet("Morocco", "MAR", fields, trends, trade)
    assert ts["country"] == "Morocco"
    assert ts["gdp_per_capita_trend"]["cagr_pct"] == 3.4
    assert ts["gdp_per_capita_trend"]["display"] == "$5,107"
    # headline picks up GDP, GDP/capita, unemployment (found ones)
    hk = [h["key"] for h in ts["headline"]]
    assert "gdp_per_capita_usd" in hk and "unemployment_pct" in hk
    # trajectory carries the move text
    traj_keys = [x["key"] for x in ts["trajectory"]]
    assert "gdp_per_capita_usd" in traj_keys
    # trade passed through; sectors include the automotive story
    assert ts["trade"]["export_partners"][0]["name"] == "France"
    sect_keys = [x["key"] for x in ts["sectors"]]
    assert "momentum_sectors" in sect_keys
    txt = tearsheet_facts_text(ts)
    assert "France" in txt and "GDP per capita" in txt and "Automotive" in txt
    print("OK tearsheet builder")


def test_library_localization():
    from engine.library import Library
    ar_sectors = "السيارات"   # "cars" in Arabic
    ar_summary = "ملخص عربي"   # "Arabic summary"
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    lib = Library(path)
    lib.upsert_dossier("MAR", "Morocco", "MA")
    # per-language field value
    lib.set_localization("MAR", "momentum_sectors", "ar", ar_sectors)
    loc = lib.get_localizations("MAR", "ar")
    assert loc["momentum_sectors"] == ar_sectors, loc
    assert lib.get_localizations("MAR", "en") == {}
    # per-language narrative coexists (EN and AR both stored, no overwrite)
    lib.set_extras_lang("MAR", "en", summary="English summary", tearsheet='{"read":"EN"}')
    lib.set_extras_lang("MAR", "ar", summary=ar_summary, tearsheet='{"read":"AR"}')
    assert lib.get_extras_lang("MAR", "en")["summary"] == "English summary"
    assert lib.get_extras_lang("MAR", "ar")["summary"] == ar_summary
    # trade survives a COALESCE upsert that omits it
    lib.set_extras("MAR", summary="x", lang="en", trade='{"year":2023}')
    lib.set_extras("MAR", summary="y", lang="en")  # no trade passed
    assert lib.get_extras("MAR")["trade"] == '{"year":2023}'
    lib.close()
    os.remove(path)
    print("OK library localization + per-lang extras")


if __name__ == "__main__":
    test_comtrade_parser()
    test_tearsheet_builder()
    test_library_localization()
    print("\nALL OFFLINE TESTS PASSED")
