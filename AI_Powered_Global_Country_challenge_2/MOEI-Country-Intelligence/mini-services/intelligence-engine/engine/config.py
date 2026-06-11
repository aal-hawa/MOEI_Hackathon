"""Configuration loader: env (.env) + per-agent model map (config/models.yaml).

The model map is the 'pluggable AI module' layer — change a provider/model by
editing config/models.yaml, never the code. Default provider is OpenAI; the same
strings can point at Core42 Compass or any OpenAI-compatible gateway later.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict

import yaml

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # dotenv optional at runtime
    pass

_ROOT = Path(__file__).resolve().parent.parent
_CONFIG_PATH = _ROOT / "config" / "models.yaml"


@dataclass(frozen=True)
class AgentModel:
    name: str
    model: str
    temperature: float = 0.0


@dataclass
class Config:
    default_provider: str
    agents: Dict[str, AgentModel] = field(default_factory=dict)
    freshness_days: Dict[str, int] = field(default_factory=dict)
    web_batch_size: int = 4

    # ── model routing ────────────────────────────────────────────────────────
    def model_for(self, agent: str) -> AgentModel:
        if agent not in self.agents:
            raise KeyError(f"No model configured for agent '{agent}'. "
                           f"Known: {list(self.agents)}")
        return self.agents[agent]

    def freshness_for(self, domain: str) -> int:
        return self.freshness_days.get(domain, 180)

    # ── secrets / runtime ────────────────────────────────────────────────────
    @property
    def db_path(self) -> str:
        return os.getenv("LIBRARY_DB_PATH", str(_ROOT / "data" / "library.db"))

    @property
    def openai_api_key(self) -> str | None:
        return os.getenv("OPENAI_API_KEY")

    @property
    def api_base(self) -> str | None:
        return os.getenv("OPENAI_API_BASE")


def load_config(path: Path | str = _CONFIG_PATH) -> Config:
    data: Dict[str, Any] = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    agents = {
        name: AgentModel(name=name, model=spec["model"],
                         temperature=float(spec.get("temperature", 0.0)))
        for name, spec in data.get("agents", {}).items()
    }
    return Config(
        default_provider=data.get("default_provider", "openai"),
        agents=agents,
        freshness_days=data.get("freshness_days", {}),
        web_batch_size=int(data.get("web_batch_size", 4)),
    )
