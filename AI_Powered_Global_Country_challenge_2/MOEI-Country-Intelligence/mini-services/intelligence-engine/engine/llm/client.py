"""LiteLLM client — the pluggable AI module layer.

One interface over any provider. The model per agent comes from config/models.yaml,
so swapping OpenAI -> Core42/Compass (or any OpenAI-compatible gateway) is a config
change, never a code change. Keys are read from the environment by LiteLLM.
"""
from __future__ import annotations

import json
from typing import Any, Optional

import litellm

from ..config import Config, load_config


class LLMClient:
    def __init__(self, config: Optional[Config] = None):
        self.config = config or load_config()
        self._api_base = self.config.api_base  # optional gateway override

    async def complete(self, agent: str, system: str, user: str,
                       json_mode: bool = False, **kwargs: Any) -> str:
        m = self.config.model_for(agent)
        params: dict[str, Any] = dict(
            model=m.model,
            messages=[{"role": "system", "content": system},
                      {"role": "user", "content": user}],
            temperature=m.temperature,
        )
        if self._api_base:
            params["api_base"] = self._api_base
        if json_mode:
            params["response_format"] = {"type": "json_object"}
        params.update(kwargs)
        resp = await litellm.acompletion(**params)
        return resp.choices[0].message.content or ""

    async def complete_json(self, agent: str, system: str, user: str, **kwargs: Any) -> Any:
        raw = await self.complete(agent, system, user, json_mode=True, **kwargs)
        return json.loads(raw)
