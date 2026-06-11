"""The 8 domain research agents (Country-Data-Schema + Agent-Workflow).

One agent per gathering domain. Each owns its domain's fields, pulls from the
right structured sources (World Bank / IMF / REST Countries) AND domain-fenced
web research for narrative fields, and returns its FieldValues. They run in
PARALLEL into the verifier. Structured-first: numbers come from APIs; narrative
from cited web research."""
from __future__ import annotations

from typing import Dict, List, Optional, Tuple

import httpx

from ..connectors import (REST_FIELDS, fetch_imf, fetch_restcountries, fetch_worldbank)
from ..connectors.web import WebResearcher
from ..llm.client import LLMClient
from ..schema import Domain, FieldValue


class DomainResearcher:
    domain: Domain
    label: str = ""
    use_rest: bool = False
    wb_fields: List[str] = []
    imf_fields: List[str] = []
    web_tier: int = 2
    web_specs: Dict[str, str] = {}   # field -> hint

    async def research(self, country: str, iso2: str, iso3: str,
                       client: httpx.AsyncClient, llm: Optional[LLMClient],
                       lang: str = "en") -> List[FieldValue]:
        out: List[FieldValue] = []
        if self.use_rest:
            try:
                out += await fetch_restcountries(iso2, iso3, client)
            except Exception:
                pass
        if self.wb_fields:
            try:
                out += await fetch_worldbank(iso3, self.wb_fields, client)
            except Exception:
                pass
        if self.imf_fields:
            try:
                out += await fetch_imf(iso3, self.imf_fields, client)
            except Exception:
                pass
        if self.web_specs and llm is not None:
            specs: Dict[str, Tuple[object, int, str]] = {
                f: (self.domain, self.web_tier, hint) for f, hint in self.web_specs.items()}
            try:
                out += await WebResearcher(llm.config).research(country, specs, lang=lang)
            except Exception:
                pass
        return out

    def all_fields(self) -> List[str]:
        fields = list(self.wb_fields) + list(self.imf_fields) + list(self.web_specs.keys())
        if self.use_rest:
            fields = REST_FIELDS + fields
        # de-dup, preserve order
        seen, uniq = set(), []
        for f in fields:
            if f not in seen:
                seen.add(f); uniq.append(f)
        return uniq


class IdentityAgent(DomainResearcher):
    domain = Domain.identity
    label = "Identity & Governance"
    use_rest = True
    web_tier = 2
    web_specs = {
        "political_system": "the current form of government / political system as of today",
        "head_of_state": "the CURRENT head of state as of today (name + exact title); never a former or caretaker holder",
        "head_of_government": "the CURRENT head of government / prime minister as of today (name + exact title). If the post is vacant or has been abolished, state that explicitly. Do NOT return a former or caretaker official, and do NOT confuse a minister with the head of government.",
        "key_decision_makers": "the CURRENT ministers of energy, infrastructure/transport, and foreign affairs as of today (names + their exact current titles)",
        "sovereign_wealth_funds": "main sovereign wealth fund(s), if any",
        "national_vision_strategy": "the national long-term vision/strategy (official name)",
    }


class EconomyAgent(DomainResearcher):
    domain = Domain.economy
    label = "Economy & Trade"
    wb_fields = ["gdp_nominal_usd", "gdp_per_capita_usd", "gdp_growth_pct", "inflation_pct",
                 "unemployment_pct", "population", "current_account_pct_gdp",
                 "exports_usd", "imports_usd", "fdi_inflow_usd",
                 "agriculture_pct_gdp", "industry_pct_gdp", "services_pct_gdp"]
    imf_fields = ["gdp_nominal_usd", "gdp_per_capita_usd", "gdp_growth_pct", "inflation_pct",
                  "unemployment_pct", "population", "govt_debt_pct_gdp"]
    web_tier = 3
    web_specs = {
        "sovereign_credit_rating": "sovereign credit rating (S&P / Moody's / Fitch)",
        "competitiveness_rank": "global competitiveness ranking (IMD or WEF)",
        "trade_agreements": "key trade agreements / FTAs",
        "gdp_by_sector": "GDP breakdown by sector (agriculture / industry / services %)",
        "top_export_partners": "top 3-5 export partner countries (with % share if available)",
        "top_import_partners": "top 3-5 import partner countries (with % share if available)",
        "top_exports": "top export products / goods categories (e.g. cars, phosphates, textiles)",
        "top_imports": "top import products / goods categories",
        "momentum_sectors": "sectors gaining momentum or attracting FDI recently (name them, e.g. automotive, aerospace) and why",
        "structural_shift": "the main structural economic shift underway, in 1-2 sentences",
    }


class EnergyAgent(DomainResearcher):
    domain = Domain.energy
    label = "Energy"
    wb_fields = ["renewable_energy_consumption_pct", "renewable_electricity_output_pct",
                 "electric_power_consumption_pc", "access_to_electricity_pct"]
    web_tier = 2
    web_specs = {
        "electricity_mix": "electricity generation mix (renewable / fossil / nuclear %)",
        "installed_renewable_capacity": "installed renewable capacity (GW)",
        "oil_gas_reserves": "oil and gas reserves, if any",
        "energy_renewable_target": "renewable energy target (share % and target year)",
        "hydrogen_strategy": "hydrogen strategy targets, if any",
        "major_energy_projects": "1-3 major current energy projects (names)",
        "national_energy_players": "main national energy companies / utilities",
    }


class InfrastructureAgent(DomainResearcher):
    domain = Domain.infrastructure
    label = "Infrastructure & Transport"
    wb_fields = ["logistics_performance_index", "internet_users_pct",
                 "mobile_subscriptions_per100", "urban_population_pct"]
    web_tier = 2
    web_specs = {
        "major_ports": "main seaports and any smart-port initiatives",
        "major_airports": "main international airports",
        "infrastructure_project_pipeline": "1-3 major current infrastructure / transport projects",
        "rail_road_networks": "rail and road network highlights",
        "digital_infrastructure_5g": "5G / digital connectivity status",
        "ppp_landscape": "public-private partnership landscape",
    }


class SustainabilityAgent(DomainResearcher):
    domain = Domain.sustainability
    label = "Sustainability & Climate"
    wb_fields = ["co2_emissions_per_capita"]
    web_tier = 2
    web_specs = {
        "net_zero_target": "national net-zero / carbon-neutrality target year",
        "climate_commitments_ndc": "NDC / Paris commitments and COP role",
        "environmental_performance_index": "Environmental Performance Index rank or score",
        "green_finance_initiatives": "green finance initiatives",
    }


class InnovationAgent(DomainResearcher):
    domain = Domain.innovation
    label = "Innovation & Smart Cities"
    wb_fields = ["rd_spend_pct_gdp"]
    web_tier = 2
    web_specs = {
        "global_innovation_index_rank": "WIPO Global Innovation Index rank",
        "smart_city_initiatives": "major smart-city initiatives",
        "digital_government_maturity": "digital government maturity (UN e-gov rank)",
        "tech_ecosystem_highlights": "tech / startup ecosystem highlights",
    }


class UAERelationsAgent(DomainResearcher):
    domain = Domain.uae_relations
    label = "UAE Relationship"
    web_tier = 3
    web_specs = {
        "uae_bilateral_agreements": "agreements / MoUs with the United Arab Emirates",
        "uae_bilateral_trade": "non-oil bilateral trade with the UAE (value)",
        "uae_companies_present": "notable UAE companies present (or vice versa)",
        "uae_joint_ventures": "joint ventures or past deals with the UAE",
        "uae_cooperation_areas": "current cooperation areas with the UAE",
        "uae_diplomatic_status": "diplomatic relationship status with the UAE",
        "uae_ambassadors": "the CURRENT UAE ambassador to this country AND this country's "
                           "current ambassador to the UAE (names + since when, if known)",
        "uae_embassy_presence": "UAE embassy/consulate locations in this country and this "
                                "country's embassy in the UAE",
        "uae_investments": "major UAE investments in this country (investor company, sector, "
                           "value if known — e.g. Masdar, DP World, AD Ports, Mubadala, TAQA)",
        "uae_recent_visits": "recent high-level official visits between the UAE and this "
                             "country (last 24 months)",
    }


class EventsAgent(DomainResearcher):
    domain = Domain.news
    label = "Real-time / Events"
    web_tier = 4
    web_specs = {
        "recent_developments": "1-3 notable developments in the last 12 months",
        "upcoming_events": "upcoming elections / summits / major events",
        "recent_energy_infra_announcements": "recent energy / infrastructure announcements",
    }


DOMAIN_AGENTS: List[DomainResearcher] = [
    IdentityAgent(), EconomyAgent(), EnergyAgent(), InfrastructureAgent(),
    SustainabilityAgent(), InnovationAgent(), UAERelationsAgent(), EventsAgent(),
]

# Full schema checklist (union of every agent's fields) — drives coverage.
EXPECTED_FIELDS: List[str] = []
for _a in DOMAIN_AGENTS:
    for _f in _a.all_fields():
        if _f not in EXPECTED_FIELDS:
            EXPECTED_FIELDS.append(_f)
