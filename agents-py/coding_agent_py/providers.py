"""Model providers. Nemotron on Nebius Token Factory is the default; Meta and local Llama are opt-in."""
from __future__ import annotations

import os
from dataclasses import dataclass

from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.models.test import TestModel
from pydantic_ai.providers.openai import OpenAIProvider

NEBIUS_BASE_URL = "https://api.tokenfactory.nebius.com/v1"
NEMOTRON = {
    "nano": "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
    "super": "nvidia/nemotron-3-super-120b-a12b",
    "ultra": "nvidia/Nemotron-3-Ultra-550b-a55b",
}
META_BASE_URL = "https://api.meta.ai/v1"
META_MODELS = {"default": "muse-spark-1.3-contributor", "wonder": "muse-wonder-1.0"}
META_PRICE = {"input": 0.10, "output": 0.20}  # USD per 1M tokens (user-supplied)
LOCAL_LLAMA_BASE_URL = "http://127.0.0.1:8089/v1"
PROVIDERS = ("nebius", "meta", "local-llama", "test")
DEFAULT_PROVIDER = "nebius"


class ProviderError(RuntimeError):
    pass


@dataclass
class Resolved:
    provider: str
    model_name: str
    model: Model


def resolve(provider: str | None = None, tier: str = "super", env: dict[str, str] | None = None) -> Resolved:
    env = dict(os.environ) if env is None else env
    p = (provider or DEFAULT_PROVIDER).strip().lower()
    if p not in PROVIDERS:
        raise ProviderError(f"unknown provider {p!r}; choose one of {PROVIDERS}")
    if p == "test":
        return Resolved(p, "test", TestModel())
    if p == "nebius":
        key = env.get("NEBIUS_API_KEY")
        if not key:
            raise ProviderError("NEBIUS_API_KEY is not set")
        name = env.get(f"NEMOTRON_{tier.upper()}_MODEL") or NEMOTRON.get(tier, NEMOTRON["super"])
        base = env.get("NEBIUS_BASE_URL") or NEBIUS_BASE_URL
        return Resolved(p, name, OpenAIChatModel(name, provider=OpenAIProvider(base_url=base, api_key=key)))
    if p == "meta":
        key = env.get("META_LLAMA_API_KEY")
        if not key:
            raise ProviderError("META_LLAMA_API_KEY is not set")
        name = META_MODELS["wonder" if tier == "ultra" else "default"]
        base = env.get("META_BASE_URL") or META_BASE_URL
        return Resolved(p, name, OpenAIChatModel(name, provider=OpenAIProvider(base_url=base, api_key=key)))
    base = env.get("LOCAL_LLAMA_BASE_URL") or LOCAL_LLAMA_BASE_URL
    name = env.get("LOCAL_LLAMA_MODEL") or "local"
    return Resolved(p, name, OpenAIChatModel(name, provider=OpenAIProvider(base_url=base, api_key="local")))


class MetaSpendCap:
    """Hard per-process spend cap for the paid Meta API (default $1, META_SPEND_CAP_USD)."""

    def __init__(self, env: dict[str, str] | None = None):
        env = dict(os.environ) if env is None else env
        try:
            self.cap = float(env.get("META_SPEND_CAP_USD") or 1.0)
        except ValueError:
            self.cap = 1.0
        self.spent = 0.0

    @staticmethod
    def cost(input_tokens: int, output_tokens: int) -> float:
        return (input_tokens * META_PRICE["input"] + output_tokens * META_PRICE["output"]) / 1_000_000

    def check(self) -> None:
        if self.spent >= self.cap:
            raise ProviderError(f"Meta spend cap reached (${self.spent:.4f} of ${self.cap:.2f})")

    def record(self, input_tokens: int, output_tokens: int) -> float:
        c = self.cost(input_tokens, output_tokens)
        self.spent += c
        return c
