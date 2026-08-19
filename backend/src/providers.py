"""AI Provider Layer — abstract interface, pluggable implementations, factory with
manual fallback chain. No auto-configuration: the chain is read from settings only."""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass

from core import settings


@dataclass
class ProviderResponse:
    text: str
    tokens_in: int
    tokens_out: int
    model: str
    provider: str
    latency_ms: int
    cost_usd: float = 0.0


# cost per 1M tokens: (input, output) — USD
COST_TABLE: dict[str, tuple[float, float]] = {
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4.1": (2.00, 8.00),
    "claude-sonnet-4": (3.00, 15.00),
    "claude-haiku-4": (0.80, 4.00),
    "gemini-2.0-flash": (0.10, 0.40),
    "deepseek-chat": (0.27, 1.10),
    "text-embedding-3-small": (0.02, 0.0),
}


def _cost(model: str, tin: int, tout: int) -> float:
    cin, cout = COST_TABLE.get(model, (1.0, 3.0))
    return round((tin / 1_000_000) * cin + (tout / 1_000_000) * cout, 6)


class AIProvider(ABC):
    name: str = "base"

    @abstractmethod
    async def complete(self, messages: list[dict], *, model: str, temperature: float = 0.7,
                       max_tokens: int = 1024) -> ProviderResponse: ...

    @abstractmethod
    async def embed(self, texts: list[str], *, model: str) -> list[list[float]]: ...

    async def healthy(self) -> bool:
        return True


class OpenAIProvider(AIProvider):
    name = "openai"

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.c = AsyncOpenAI(api_key=api_key)

    async def complete(self, messages, *, model, temperature=0.7, max_tokens=1024):
        t0 = time.perf_counter()
        r = await self.c.chat.completions.create(
            model=model, messages=messages, temperature=temperature, max_tokens=max_tokens)
        ms = int((time.perf_counter() - t0) * 1000)
        u = r.usage
        return ProviderResponse(r.choices[0].message.content or "", u.prompt_tokens,
                                u.completion_tokens, model, self.name, ms,
                                _cost(model, u.prompt_tokens, u.completion_tokens))

    async def embed(self, texts, *, model):
        r = await self.c.embeddings.create(model=model, input=texts)
        return [d.embedding for d in r.data]


class DeepSeekProvider(OpenAIProvider):
    """DeepSeek exposes an OpenAI-compatible endpoint."""
    name = "deepseek"

    def __init__(self, api_key: str):
        from openai import AsyncOpenAI
        self.c = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")


class GeminiProvider(AIProvider):
    name = "gemini"

    def __init__(self, api_key: str):
        from google import genai
        self.c = genai.Client(api_key=api_key)

    async def complete(self, messages, *, model, temperature=0.7, max_tokens=1024):
        t0 = time.perf_counter()
        system = next((m["content"] for m in messages if m["role"] == "system"), None)
        contents = [m["content"] for m in messages if m["role"] != "system"]
        r = await self.c.aio.models.generate_content(
            model=model, contents=contents,
            config={"temperature": temperature, "max_output_tokens": max_tokens,
                    "system_instruction": system})
        ms = int((time.perf_counter() - t0) * 1000)
        u = r.usage_metadata or {}
        tin, tout = u.get("prompt_token_count", 0), u.get("candidates_token_count", 0)
        return ProviderResponse(r.text or "", tin, tout, model, self.name, ms, _cost(model, tin, tout))

    async def embed(self, texts, *, model):
        r = await self.c.aio.models.embed_content(model=model, contents=texts)
        return [e.values for e in r.embeddings]


class ClaudeProvider(AIProvider):
    name = "claude"

    def __init__(self, api_key: str):
        from anthropic import AsyncAnthropic
        self.c = AsyncAnthropic(api_key=api_key)

    async def complete(self, messages, *, model, temperature=0.7, max_tokens=1024):
        t0 = time.perf_counter()
        system = next((m["content"] for m in messages if m["role"] == "system"), None)
        turns = [m for m in messages if m["role"] in ("user", "assistant")]
        r = await self.c.messages.create(
            model=model, system=system or "", messages=turns,
            temperature=temperature, max_tokens=max_tokens)
        ms = int((time.perf_counter() - t0) * 1000)
        text = "".join(b.text for b in r.content if getattr(b, "type", "") == "text")
        return ProviderResponse(text, r.usage.input_tokens, r.usage.output_tokens,
                                model, self.name, ms,
                                _cost(model, r.usage.input_tokens, r.usage.output_tokens))

    async def embed(self, texts, *, model):
        # Claude has no embeddings API — delegate to the configured embedding provider.
        raise NotImplementedError("claude: use the embedding provider from the chain")


class ProviderFactory:
    """Builds providers on demand and walks the *manually configured* fallback chain."""

    def __init__(self, env: dict[str, str] | None = None):
        import os
        env = env or dict(os.environ)
        self._keys: dict[str, str] = {
            "openai": env.get("OPENAI_API_KEY", ""),
            "gemini": env.get("GEMINI_API_KEY", ""),
            "claude": env.get("ANTHROPIC_API_KEY", ""),
            "deepseek": env.get("DEEPSEEK_API_KEY", ""),
        }
        self._builders: dict[str, Callable[[], AIProvider]] = {
            "openai": lambda: OpenAIProvider(self._keys["openai"]),
            "gemini": lambda: GeminiProvider(self._keys["gemini"]),
            "claude": lambda: ClaudeProvider(self._keys["claude"]),
            "deepseek": lambda: DeepSeekProvider(self._keys["deepseek"]),
        }
        self._cache: dict[str, AIProvider] = {}
        self.chain: list[str] = [p for p in settings.FALLBACK_CHAIN if p in self._builders]
        self.embedding_provider = env.get("EMBEDDING_PROVIDER", "openai")
        self.embedding_model = env.get("EMBEDDING_MODEL", "text-embedding-3-small")

    def get(self, name: str) -> AIProvider:
        if name not in self._cache:
            self._cache[name] = self._builders[name]()
        return self._cache[name]

    async def complete_with_fallback(self, messages: list[dict], *, model_map: dict[str, str],
                                     temperature: float = 0.7, max_tokens: int = 1024) -> ProviderResponse:
        errors: list[str] = []
        for name in self.chain:
            try:
                return await self.get(name).complete(
                    messages, model=model_map.get(name, "gpt-4o-mini"),
                    temperature=temperature, max_tokens=max_tokens)
            except Exception as exc:  # provider outage / quota — walk the chain
                errors.append(f"{name}: {exc}")
        raise RuntimeError(f"Provider chain exhausted: {'; '.join(errors)}")

    async def embed(self, texts: list[str]) -> list[list[float]]:
        provider = self.get(self.embedding_provider if self.embedding_provider in self._builders else "openai")
        return await provider.embed(texts, model=self.embedding_model)

    def configured(self) -> dict[str, bool]:
        """Which providers currently have an API key (used by /health)."""
        return {name: bool(key) for name, key in self._keys.items()}


factory = ProviderFactory()
