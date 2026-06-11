"""World Bank source client (Tier 1, free) — quantitative backbone, by field.
Hardened: retries + falls back from mrnev to a recent-range query, so reliable
indicators stop showing as NOT FOUND under load."""
from __future__ import annotations

import asyncio
from typing import List, Optional, Tuple

import httpx

from ..schema import Confidence, Domain, FieldValue, Provenance

BASE = "https://api.worldbank.org/v2"

WB_CATALOG = {
    "gdp_nominal_usd":                 (["NY.GDP.MKTP.CD"],     Domain.economy,        "USD"),
    "gdp_per_capita_usd":              (["NY.GDP.PCAP.CD"],     Domain.economy,        "USD"),
    "gdp_growth_pct":                  (["NY.GDP.MKTP.KD.ZG"],  Domain.economy,        "%"),
    "inflation_pct":                   (["FP.CPI.TOTL.ZG"],     Domain.economy,        "%"),
    "unemployment_pct":                (["SL.UEM.TOTL.ZS"],     Domain.economy,        "%"),
    "population":                      (["SP.POP.TOTL"],        Domain.economy,        "people"),
    "current_account_pct_gdp":         (["BN.CAB.XOKA.GD.ZS"],  Domain.economy,        "% of GDP"),
    "exports_usd":                     (["NE.EXP.GNFS.CD"],     Domain.economy,        "USD"),
    "imports_usd":                     (["NE.IMP.GNFS.CD"],     Domain.economy,        "USD"),
    "fdi_inflow_usd":                  (["BX.KLT.DINV.CD.WD"],  Domain.economy,        "USD"),
    "renewable_energy_consumption_pct":(["EG.FEC.RNEW.ZS"],     Domain.energy,         "%"),
    "renewable_electricity_output_pct":(["EG.ELC.RNEW.ZS"],     Domain.energy,         "%"),
    "electric_power_consumption_pc":   (["EG.USE.ELEC.KH.PC"],  Domain.energy,         "kWh/capita"),
    "co2_emissions_per_capita":        (["EN.GHG.CO2.PC.CE", "EN.ATM.CO2E.PC"],
                                                                Domain.sustainability, "tCO2/capita"),
    "logistics_performance_index":     (["LP.LPI.OVRL.XQ"],     Domain.infrastructure, "index 1-5"),
    "internet_users_pct":              (["IT.NET.USER.ZS"],     Domain.infrastructure, "%"),
    "rd_spend_pct_gdp":                (["GB.XPD.RSDV.GD.ZS"],  Domain.innovation,     "% of GDP"),
    "agriculture_pct_gdp":             (["NV.AGR.TOTL.ZS"],     Domain.economy,        "% of GDP"),
    "industry_pct_gdp":                (["NV.IND.TOTL.ZS"],     Domain.economy,        "% of GDP"),
    "services_pct_gdp":                (["NV.SRV.TOTL.ZS"],     Domain.economy,        "% of GDP"),
    "access_to_electricity_pct":       (["EG.ELC.ACCS.ZS"],     Domain.energy,         "%"),
    "mobile_subscriptions_per100":     (["IT.CEL.SETS.P2"],     Domain.infrastructure, "per 100"),
    "urban_population_pct":            (["SP.URB.TOTL.IN.ZS"],  Domain.infrastructure, "%"),
}


async def _latest(iso3: str, code: str, client: httpx.AsyncClient) -> Optional[dict]:
    """Return the most recent non-empty datapoint for an indicator, robustly."""
    # try 1: most-recent-non-empty; try 2: last 12 years, pick newest non-null
    urls = [f"{BASE}/country/{iso3}/indicator/{code}?format=json&mrnev=1",
            f"{BASE}/country/{iso3}/indicator/{code}?format=json&mrv=12"]
    for url in urls:
        for attempt in range(2):
            try:
                r = await client.get(url, timeout=12.0)
                r.raise_for_status()
                payload = r.json()
                if isinstance(payload, list) and len(payload) > 1 and payload[1]:
                    rows = [x for x in payload[1] if x.get("value") is not None]
                    if rows:
                        rows.sort(key=lambda x: int(x.get("date") or 0), reverse=True)
                        return rows[0]
                break  # valid response but no data -> try next url
            except Exception:
                if attempt < 2:
                    await asyncio.sleep(1.0 * (attempt + 1))
    return None


async def fetch_worldbank(iso3: str, fields: List[str], client: httpx.AsyncClient) -> List[FieldValue]:
    out: List[FieldValue] = []
    for f in fields:
        if f not in WB_CATALOG:
            continue
        codes, domain, unit = WB_CATALOG[f]
        row = None
        for code in codes:
            row = await _latest(iso3, code, client)
            if row is not None:
                break
        if row is None:
            out.append(FieldValue(name=f, domain=domain, value=None))
            continue
        v = row["value"]
        out.append(FieldValue(name=f, domain=domain, value=v, value_num=float(v), unit=unit,
                              provenance=Provenance(source_name="World Bank Open Data",
                                                    url=f"{BASE}/country/{iso3}/indicator/{codes[0]}",
                                                    tier=1, as_of_date=str(row.get("date"))),
                              confidence=Confidence.high))
    return out
