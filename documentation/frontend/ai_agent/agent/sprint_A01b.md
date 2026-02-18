YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A01b — Python Agent: Provider-Agnostic Architecture

**Module**: Voice AI Python Agent
**Sprint**: A01b
**Depends on**: A01a complete (project structure + config.py exist)

---

## Objective

Implement the provider-agnostic layer: abstract interfaces for STT/LLM/TTS, a runtime registry, and a factory that builds the correct provider from a `TenantContext`. This architecture means the agent **never imports Deepgram/OpenAI/Cartesia directly** — it only works with these interfaces. Swapping providers is done from the admin panel; no Python code changes required.

---

## Pre-Coding Checklist

- [ ] A01a is complete — verify: `python -m agent.main` exits cleanly
- [ ] Read `documentation/contracts/ai_agent/voice_ai_contract.md` — specifically the `FullVoiceAiContext` schema
- [ ] Read `documentation/frontend/ai_agent/agent/sprint_A03.md` — the `TenantContext` Pydantic model defines what `ProviderFactory` receives
- [ ] Understand `TenantContext.providers` structure from A03:
  - `context.providers.stt` → `ProviderConfig` (has `provider_id`, `provider_key`, `api_key`, `config`)
  - `context.providers.llm` → `ProviderConfig`
  - `context.providers.tts` → `TtsProviderConfig` (extends `ProviderConfig`, adds `voice_id: str | None`)
  - `context.behavior.language` → BCP-47 language code (e.g. `"en"`, `"es"`)
- [ ] Verify the backend context endpoint returns the correct shape:
  ```bash
  # Get JWT
  TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r .access_token)

  # Get tenant ID
  TENANT_ID=$(curl -s http://localhost:8000/api/v1/auth/me \
    -H "Authorization: Bearer $TOKEN" | jq -r .tenant_id)

  # Get agent key from admin
  ADMIN_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)
  AGENT_KEY=$(curl -s http://localhost:8000/api/v1/system/voice-ai/config \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r .agent_key_plain // "set-key-in-admin-panel")

  # Hit context endpoint — verify providers shape
  curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '.providers'
  # Expected: { "stt": { "provider_id": "...", "provider_key": "deepgram", "api_key": "...", "config": {...} }, ... }
  ```

**DO NOT USE PM2** — run agent with: `python -m agent.main`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: in `/var/www/lead360.app/api/.env` — never hardcode

---

## Project Location

All work in this sprint is at: `/var/www/lead360.app/agent/voice-ai/`

---

## Task 1: Provider Base Interfaces

`/var/www/lead360.app/agent/voice-ai/agent/providers/base.py`:

```python
"""
Abstract base interfaces for Voice AI providers.

The agent NEVER imports Deepgram/OpenAI/Cartesia directly anywhere
outside of the providers/ directory. It works exclusively with
these interfaces. Concrete implementations are resolved at runtime
by the ProviderFactory based on the TenantContext returned from NestJS.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ProviderContext:
    """Runtime context for a specific provider, extracted from TenantContext.providers.*"""
    provider_key: str           # e.g. 'deepgram', 'openai', 'cartesia'
    api_key: str                # decrypted API key — already decrypted by NestJS context builder
    config: dict[str, Any]     # provider-specific config (model, temperature, punctuate, etc.)


class BaseSTTProvider(ABC):
    """Abstract Speech-to-Text provider interface."""

    @abstractmethod
    def build(self, context: ProviderContext, language: str) -> Any:
        """
        Build and return a LiveKit-compatible STT plugin instance.
        Returns an object compatible with livekit_agents.stt.STT.

        Args:
            context: Provider context (keys, config) from TenantContext.providers.stt
            language: BCP-47 language code from TenantContext.behavior.language
        """
        ...

    @property
    @abstractmethod
    def provider_key(self) -> str:
        """The provider_key string this implementation handles (e.g. 'deepgram')."""
        ...


class BaseLLMProvider(ABC):
    """Abstract Language Model provider interface."""

    @abstractmethod
    def build(self, context: ProviderContext) -> Any:
        """
        Build and return a LiveKit-compatible LLM plugin instance.
        Returns an object compatible with livekit_agents.llm.LLM.

        Args:
            context: Provider context (keys, config) from TenantContext.providers.llm
        """
        ...

    @property
    @abstractmethod
    def provider_key(self) -> str:
        ...


class BaseTTSProvider(ABC):
    """Abstract Text-to-Speech provider interface."""

    @abstractmethod
    def build(self, context: ProviderContext, voice_id: str | None = None) -> Any:
        """
        Build and return a LiveKit-compatible TTS plugin instance.
        Returns an object compatible with livekit_agents.tts.TTS.

        Args:
            context: Provider context (keys, config) from TenantContext.providers.tts
            voice_id: Voice ID from TenantContext.providers.tts.voice_id (may be None)
        """
        ...

    @property
    @abstractmethod
    def provider_key(self) -> str:
        ...
```

---

## Task 2: Provider Registry

`/var/www/lead360.app/agent/voice-ai/agent/providers/registry.py`:

```python
"""
Provider Registry — maps provider_key strings to implementation classes.

To add a new provider:
1. Create a new class in providers/stt/, providers/llm/, or providers/tts/
   implementing the corresponding abstract interface from base.py
2. Import and register it in _create_default_registry() below
3. No changes needed anywhere else in the codebase
"""
from agent.providers.base import BaseSTTProvider, BaseLLMProvider, BaseTTSProvider


class ProviderRegistry:
    """Central registry for all available provider implementations."""

    def __init__(self) -> None:
        self._stt: dict[str, type[BaseSTTProvider]] = {}
        self._llm: dict[str, type[BaseLLMProvider]] = {}
        self._tts: dict[str, type[BaseTTSProvider]] = {}

    def register_stt(self, key: str, cls: type[BaseSTTProvider]) -> None:
        self._stt[key] = cls

    def register_llm(self, key: str, cls: type[BaseLLMProvider]) -> None:
        self._llm[key] = cls

    def register_tts(self, key: str, cls: type[BaseTTSProvider]) -> None:
        self._tts[key] = cls

    def get_stt(self, key: str) -> type[BaseSTTProvider]:
        if key not in self._stt:
            raise ValueError(
                f"No STT provider registered for key: '{key}'. "
                f"Available: {list(self._stt.keys())}"
            )
        return self._stt[key]

    def get_llm(self, key: str) -> type[BaseLLMProvider]:
        if key not in self._llm:
            raise ValueError(
                f"No LLM provider registered for key: '{key}'. "
                f"Available: {list(self._llm.keys())}"
            )
        return self._llm[key]

    def get_tts(self, key: str) -> type[BaseTTSProvider]:
        if key not in self._tts:
            raise ValueError(
                f"No TTS provider registered for key: '{key}'. "
                f"Available: {list(self._tts.keys())}"
            )
        return self._tts[key]


# Module-level singleton
_registry: ProviderRegistry | None = None


def get_registry() -> ProviderRegistry:
    global _registry
    if _registry is None:
        _registry = _create_default_registry()
    return _registry


def _create_default_registry() -> ProviderRegistry:
    """Register all built-in providers. Add new providers here."""
    registry = ProviderRegistry()

    # STT providers
    from agent.providers.stt.deepgram import DeepgramSTTProvider
    registry.register_stt('deepgram', DeepgramSTTProvider)

    # LLM providers
    from agent.providers.llm.openai import OpenAILLMProvider
    registry.register_llm('openai', OpenAILLMProvider)

    # TTS providers
    from agent.providers.tts.cartesia import CartesiaTTSProvider
    registry.register_tts('cartesia', CartesiaTTSProvider)

    return registry
```

---

## Task 3: Provider Factory

`/var/www/lead360.app/agent/voice-ai/agent/providers/factory.py`:

```python
"""
ProviderFactory — resolves the correct provider at runtime from TenantContext.

Takes a TenantContext (fetched from NestJS by ContextFetcher in A03),
extracts provider keys, API keys, and config, then uses the registry
to build the correct LiveKit-compatible provider instances.

Context field access:
    context.providers.stt   → ProviderConfig  (provider_key, api_key, config)
    context.providers.llm   → ProviderConfig
    context.providers.tts   → TtsProviderConfig  (extends ProviderConfig + voice_id)
    context.behavior.language → BCP-47 string (e.g. 'en', 'es')
"""
from typing import Any
from agent.providers.base import ProviderContext
from agent.providers.registry import get_registry


class ProviderFactory:
    """
    Builds LiveKit-compatible provider instances from a TenantContext.

    Usage:
        factory = ProviderFactory(tenant_context)
        stt = factory.build_stt()
        llm = factory.build_llm()
        tts = factory.build_tts()
    """

    def __init__(self, context: Any) -> None:
        """
        Args:
            context: TenantContext Pydantic model (defined in Sprint A03)
        """
        self._context = context
        self._registry = get_registry()

    def build_stt(self) -> Any:
        """Build STT provider from context. Returns LiveKit STT instance."""
        stt_cfg = self._context.providers.stt
        if stt_cfg is None:
            raise ValueError("No STT provider configured for this tenant")
        provider_ctx = ProviderContext(
            provider_key=stt_cfg.provider_key,
            api_key=stt_cfg.api_key,        # Already decrypted by NestJS
            config=stt_cfg.config or {},
        )
        cls = self._registry.get_stt(stt_cfg.provider_key)
        language = self._context.behavior.language or 'en'
        return cls().build(provider_ctx, language)

    def build_llm(self) -> Any:
        """Build LLM provider from context. Returns LiveKit LLM instance."""
        llm_cfg = self._context.providers.llm
        if llm_cfg is None:
            raise ValueError("No LLM provider configured for this tenant")
        provider_ctx = ProviderContext(
            provider_key=llm_cfg.provider_key,
            api_key=llm_cfg.api_key,
            config=llm_cfg.config or {},
        )
        cls = self._registry.get_llm(llm_cfg.provider_key)
        return cls().build(provider_ctx)

    def build_tts(self) -> Any:
        """Build TTS provider from context. Returns LiveKit TTS instance."""
        tts_cfg = self._context.providers.tts
        if tts_cfg is None:
            raise ValueError("No TTS provider configured for this tenant")
        # voice_id lives on TtsProviderConfig (TenantContext.providers.tts.voice_id)
        # NOT on behavior or global_config — those fields do not exist
        voice_id = tts_cfg.voice_id
        provider_ctx = ProviderContext(
            provider_key=tts_cfg.provider_key,
            api_key=tts_cfg.api_key,
            config=tts_cfg.config or {},
        )
        cls = self._registry.get_tts(tts_cfg.provider_key)
        return cls().build(provider_ctx, voice_id)
```

---

## Task 4: Provider Stub Implementations

The registry imports concrete provider classes. These don't exist yet (A04/A05/A06 implement them), so create stubs now so `get_registry()` doesn't raise `ImportError`. Sprints A04/A05/A06 will replace these stubs with real implementations.

**`/agent/voice-ai/agent/providers/stt/deepgram.py`** (replaces placeholder from A01a):

```python
"""Deepgram STT provider stub — full implementation in Sprint A04."""
from typing import Any
from agent.providers.base import BaseSTTProvider, ProviderContext


class DeepgramSTTProvider(BaseSTTProvider):
    @property
    def provider_key(self) -> str:
        return 'deepgram'

    def build(self, context: ProviderContext, language: str) -> Any:
        raise NotImplementedError(
            "DeepgramSTTProvider.build() not yet implemented — see Sprint A04"
        )
```

**`/agent/voice-ai/agent/providers/llm/openai.py`** (replaces placeholder from A01a):

```python
"""OpenAI LLM provider stub — full implementation in Sprint A05."""
from typing import Any
from agent.providers.base import BaseLLMProvider, ProviderContext


class OpenAILLMProvider(BaseLLMProvider):
    @property
    def provider_key(self) -> str:
        return 'openai'

    def build(self, context: ProviderContext) -> Any:
        raise NotImplementedError(
            "OpenAILLMProvider.build() not yet implemented — see Sprint A05"
        )
```

**`/agent/voice-ai/agent/providers/tts/cartesia.py`** (replaces placeholder from A01a):

```python
"""Cartesia TTS provider stub — full implementation in Sprint A06."""
from typing import Any
from agent.providers.base import BaseTTSProvider, ProviderContext


class CartesiaTTSProvider(BaseTTSProvider):
    @property
    def provider_key(self) -> str:
        return 'cartesia'

    def build(self, context: ProviderContext, voice_id: str | None = None) -> Any:
        raise NotImplementedError(
            "CartesiaTTSProvider.build() not yet implemented — see Sprint A06"
        )
```

---

## Task 5: Update main.py to Include Registry Check

Replace the placeholder `main.py` (from A01a) with this version that verifies the full import chain:

`/var/www/lead360.app/agent/voice-ai/agent/main.py`:

```python
"""Lead360 Voice AI Agent — Main Entry Point

Full LiveKit worker is implemented in Sprint A02.
"""
import logging
from agent.config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    cfg = get_config()
    logger.info("Lead360 Voice AI Agent starting...")
    logger.info(f"API base: {cfg.LEAD360_API_BASE_URL}")
    logger.info(f"LiveKit URL: {cfg.LIVEKIT_URL}")
    logger.info(f"Context cache TTL: {cfg.CONTEXT_CACHE_TTL}s")

    # Verify provider registry loads correctly
    from agent.providers.registry import get_registry
    registry = get_registry()
    logger.info("Provider registry initialized — registered providers:")
    logger.info(f"  STT: deepgram (stub until A04)")
    logger.info(f"  LLM: openai (stub until A05)")
    logger.info(f"  TTS: cartesia (stub until A06)")

    print("Agent bootstrap complete. LiveKit worker implemented in Sprint A02.")


if __name__ == "__main__":
    main()
```

---

## Verification

```bash
cd /var/www/lead360.app/agent/voice-ai

# Verify all imports work
python -c "from agent.providers.base import BaseSTTProvider, BaseLLMProvider, BaseTTSProvider, ProviderContext; print('base OK')"
python -c "from agent.providers.registry import get_registry; r = get_registry(); print('registry OK')"
python -c "from agent.providers.factory import ProviderFactory; print('factory OK')"

# Run the entry point — must exit cleanly
python -m agent.main
# Expected output:
# INFO:agent.main:Lead360 Voice AI Agent starting...
# INFO:agent.main:API base: http://localhost:8000
# INFO:agent.main:LiveKit URL: wss://...
# INFO:agent.main:Provider registry initialized...
# Agent bootstrap complete.

# Verify the import test from acceptance criteria
python -c "from agent import main; print('import OK')"
```

---

## Acceptance Criteria

- [ ] `providers/base.py` defines `ProviderContext` dataclass and `BaseSTTProvider`, `BaseLLMProvider`, `BaseTTSProvider` abstract classes
- [ ] `BaseSTTProvider.build(context, language)` signature — language param required
- [ ] `BaseTTSProvider.build(context, voice_id=None)` signature — voice_id is optional
- [ ] `providers/registry.py` implements `ProviderRegistry` with `register_stt/llm/tts` and `get_stt/llm/tts` methods
- [ ] `get_registry()` singleton works — second call returns same instance (no double-init)
- [ ] `providers/factory.py` implements `ProviderFactory` accessing `context.providers.stt/llm/tts` (NOT `context.stt`)
- [ ] `factory.build_tts()` uses `tts_cfg.voice_id` — NOT `context.behavior.voice_id_override` or `context.global_config.default_voice_id` (those fields do NOT exist)
- [ ] `factory.build_stt/llm/tts()` raises `ValueError` with clear message if provider is `None`
- [ ] Provider stubs exist in `stt/deepgram.py`, `llm/openai.py`, `tts/cartesia.py` — each implements the abstract interface and raises `NotImplementedError` on `build()`
- [ ] `python -m agent.main` runs without import errors and logs registry initialization
- [ ] `python -c "from agent import main"` succeeds without errors
