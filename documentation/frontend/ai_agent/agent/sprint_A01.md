YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A01 — Project Structure + Provider-Agnostic Architecture

**Module**: Voice AI Python Agent
**Sprint**: A01
**Depends on**: Nothing (first sprint)

---

## Objective

Bootstrap the Python Voice AI agent with proper structure, provider-agnostic interface design, and environment setup. The architecture must support swapping STT/LLM/TTS providers from the admin panel WITHOUT changing Python code. Providers are selected at runtime from the context returned by NestJS.

---

## Pre-Coding Checklist

- [ ] Read `documentation/contracts/ai_agent/voice_ai_contract.md` — understand what the agent does
- [ ] Understand the two-layer config model: Lead360 controls providers/keys, tenants control behavior
- [ ] Understand that the Python agent is a SEPARATE process from NestJS
- [ ] Backend must be running: `http://localhost:8000` (for later integration testing)

**DO NOT USE PM2** — run agent with: `python -m agent.main`

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Project Location

Create the agent at: `/var/www/lead360.app/agent/voice-ai/`

---

## Task 1: Project Structure

Create this directory structure:

```
/var/www/lead360.app/agent/voice-ai/
├── agent/
│   ├── __init__.py
│   ├── main.py                    (Sprint A02)
│   ├── config.py                  (This sprint)
│   ├── context.py                 (Sprint A03)
│   ├── lifecycle.py               (Sprint A09)
│   ├── worker.py                  (Sprint A02)
│   ├── sip_handler.py             (Sprint A02)
│   ├── pipeline.py                (Sprint A06 - assembles full STT+LLM+TTS pipeline)
│   ├── providers/                 (This sprint - provider-agnostic architecture)
│   │   ├── __init__.py
│   │   ├── base.py                (Abstract interfaces for STT, LLM, TTS)
│   │   ├── registry.py            (Provider registry: maps provider_key → class)
│   │   ├── factory.py             (Factory: builds provider from context config)
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   └── deepgram.py        (Sprint A04)
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   └── openai.py          (Sprint A05)
│   │   └── tts/
│   │       ├── __init__.py
│   │       └── cartesia.py        (Sprint A06)
│   └── actions/
│       ├── __init__.py
│       ├── base.py                (Abstract action interface)
│       ├── create_lead.py         (Sprint A07)
│       ├── book_appointment.py    (Sprint A08)
│       └── transfer_call.py      (Sprint A07 - transfer_call LLM tool)
├── tests/
│   ├── __init__.py
│   ├── test_context.py            (Sprint A10)
│   ├── test_actions.py            (Sprint A10)
│   └── test_providers.py          (Sprint A10)
├── pyproject.toml
├── .env.example
├── .gitignore
└── README.md
```

---

## Task 2: pyproject.toml

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "lead360-voice-ai-agent"
version = "1.0.0"
description = "Lead360 Voice AI Agent using LiveKit Agents SDK"
requires-python = ">=3.11"
dependencies = [
    "livekit-agents>=0.8.0",
    "livekit-plugins-deepgram>=0.6.0",
    "livekit-plugins-openai>=0.8.0",
    "livekit-plugins-cartesia>=0.4.0",
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
    "structlog>=24.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "respx>=0.21.0",  # httpx mock library
]
```

---

## Task 3: config.py

`/agent/voice-ai/agent/config.py`:

```python
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class AgentConfig:
    # LiveKit
    LIVEKIT_URL: str
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str

    # Lead360 Internal API
    LEAD360_API_BASE_URL: str
    VOICE_AGENT_KEY: str

    # HTTP client settings
    HTTP_TIMEOUT: float = 10.0
    HTTP_MAX_RETRIES: int = 2

    # Context cache TTL in seconds
    CONTEXT_CACHE_TTL: int = 60

    # Log level
    LOG_LEVEL: str = "INFO"

def load_config() -> AgentConfig:
    """Load and validate all required environment variables."""
    required = {
        "LIVEKIT_URL": os.environ.get("LIVEKIT_URL"),
        "LIVEKIT_API_KEY": os.environ.get("LIVEKIT_API_KEY"),
        "LIVEKIT_API_SECRET": os.environ.get("LIVEKIT_API_SECRET"),
        "VOICE_AGENT_KEY": os.environ.get("VOICE_AGENT_KEY"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {', '.join(missing)}")

    return AgentConfig(
        LIVEKIT_URL=required["LIVEKIT_URL"],
        LIVEKIT_API_KEY=required["LIVEKIT_API_KEY"],
        LIVEKIT_API_SECRET=required["LIVEKIT_API_SECRET"],
        LEAD360_API_BASE_URL=os.getenv("LEAD360_API_BASE_URL", "http://localhost:8000"),
        VOICE_AGENT_KEY=required["VOICE_AGENT_KEY"],
        HTTP_TIMEOUT=float(os.getenv("HTTP_TIMEOUT", "10.0")),
        HTTP_MAX_RETRIES=int(os.getenv("HTTP_MAX_RETRIES", "2")),
        CONTEXT_CACHE_TTL=int(os.getenv("CONTEXT_CACHE_TTL", "60")),
        LOG_LEVEL=os.getenv("LOG_LEVEL", "INFO"),
    )

# Module-level singleton — call load_config() once at startup
config: AgentConfig | None = None

def get_config() -> AgentConfig:
    global config
    if config is None:
        config = load_config()
    return config
```

---

## Task 4: Provider-Agnostic Base Interfaces

`/agent/voice-ai/agent/providers/base.py`:

```python
"""
Abstract base interfaces for Voice AI providers.

The agent NEVER imports Deepgram/OpenAI/Cartesia directly.
It only works with these interfaces. Concrete implementations
are resolved at runtime by the ProviderFactory based on the
context returned from NestJS.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ProviderContext:
    """Runtime context for a specific provider, extracted from TenantContext."""
    provider_key: str           # e.g. 'deepgram', 'openai', 'cartesia'
    api_key: str                # decrypted API key from NestJS context
    config: dict[str, Any]     # merged: global_default_config + tenant_override_config


class BaseSTTProvider(ABC):
    """Abstract Speech-to-Text provider interface."""

    @abstractmethod
    def build(self, context: ProviderContext, language: str) -> Any:
        """
        Build and return a LiveKit-compatible STT plugin instance.
        Returns an object compatible with livekit_agents.stt.STT.
        """
        ...

    @property
    @abstractmethod
    def provider_key(self) -> str:
        """The provider_key this implementation handles (e.g. 'deepgram')."""
        ...


class BaseLLMProvider(ABC):
    """Abstract Language Model provider interface."""

    @abstractmethod
    def build(self, context: ProviderContext) -> Any:
        """
        Build and return a LiveKit-compatible LLM plugin instance.
        Returns an object compatible with livekit_agents.llm.LLM.
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
        """
        ...

    @property
    @abstractmethod
    def provider_key(self) -> str:
        ...
```

---

## Task 5: Provider Registry

`/agent/voice-ai/agent/providers/registry.py`:

```python
"""
Provider Registry — maps provider_key strings to implementation classes.

To add a new provider:
1. Create a new class in providers/stt/, providers/llm/, or providers/tts/
2. Import and register it here
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
            raise ValueError(f"No STT provider registered for key: '{key}'. "
                             f"Available: {list(self._stt.keys())}")
        return self._stt[key]

    def get_llm(self, key: str) -> type[BaseLLMProvider]:
        if key not in self._llm:
            raise ValueError(f"No LLM provider registered for key: '{key}'. "
                             f"Available: {list(self._llm.keys())}")
        return self._llm[key]

    def get_tts(self, key: str) -> type[BaseTTSProvider]:
        if key not in self._tts:
            raise ValueError(f"No TTS provider registered for key: '{key}'. "
                             f"Available: {list(self._tts.keys())}")
        return self._tts[key]


# Module-level singleton
_registry: ProviderRegistry | None = None

def get_registry() -> ProviderRegistry:
    global _registry
    if _registry is None:
        _registry = _create_default_registry()
    return _registry

def _create_default_registry() -> ProviderRegistry:
    """Registers all built-in providers. Add new providers here."""
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

## Task 6: Provider Factory

`/agent/voice-ai/agent/providers/factory.py`:

```python
"""
ProviderFactory — resolves the correct provider at runtime from TenantContext.

Takes a TenantContext (fetched from NestJS), extracts provider keys, API keys,
and configs, then uses the registry to build the correct provider instances.
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
        context: TenantContext (Pydantic model defined in Sprint A03)
        """
        self._context = context
        self._registry = get_registry()

    def build_stt(self) -> Any:
        """Build STT provider from context. Returns LiveKit STT instance."""
        stt_ctx = self._context.stt
        provider_ctx = ProviderContext(
            provider_key=stt_ctx.provider_key,
            api_key=stt_ctx.api_key,       # Already decrypted by NestJS
            config=stt_ctx.config or {},
        )
        cls = self._registry.get_stt(stt_ctx.provider_key)
        language = self._context.behavior.language or 'en'
        return cls().build(provider_ctx, language)

    def build_llm(self) -> Any:
        """Build LLM provider from context. Returns LiveKit LLM instance."""
        llm_ctx = self._context.llm
        provider_ctx = ProviderContext(
            provider_key=llm_ctx.provider_key,
            api_key=llm_ctx.api_key,
            config=llm_ctx.config or {},
        )
        cls = self._registry.get_llm(llm_ctx.provider_key)
        return cls().build(provider_ctx)

    def build_tts(self) -> Any:
        """Build TTS provider from context. Returns LiveKit TTS instance."""
        tts_ctx = self._context.tts
        voice_id = (
            self._context.behavior.voice_id_override
            or self._context.global_config.default_voice_id
        )
        provider_ctx = ProviderContext(
            provider_key=tts_ctx.provider_key,
            api_key=tts_ctx.api_key,
            config=tts_ctx.config or {},
        )
        cls = self._registry.get_tts(tts_ctx.provider_key)
        return cls().build(provider_ctx, voice_id)
```

---

## Task 7: .env.example

```env
# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Lead360 Internal API
LEAD360_API_BASE_URL=http://localhost:8000
VOICE_AGENT_KEY=your-voice-agent-api-key-from-admin-panel

# Tuning
HTTP_TIMEOUT=10.0
HTTP_MAX_RETRIES=2
CONTEXT_CACHE_TTL=60
LOG_LEVEL=INFO
```

---

## Task 8: main.py (Placeholder)

`/agent/voice-ai/agent/main.py`:

```python
"""Lead360 Voice AI Agent - Main Entry Point"""
import logging
from agent.config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def main():
    cfg = get_config()
    logger.info("Lead360 Voice AI Agent starting...")
    logger.info(f"API base: {cfg.LEAD360_API_BASE_URL}")
    logger.info(f"LiveKit URL: {cfg.LIVEKIT_URL}")
    # Provider registry is lazily initialized on first import
    from agent.providers.registry import get_registry
    registry = get_registry()
    logger.info("Provider registry initialized successfully")
    print("Agent bootstrap complete. Worker implemented in Sprint A02.")

if __name__ == "__main__":
    main()
```

---

## Task 9: .gitignore

```
.env
__pycache__/
*.pyc
*.pyo
env/
venv/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
.coverage
htmlcov/
```

---

## Acceptance Criteria

- [ ] Project directory structure created at `/agent/voice-ai/` with `providers/` subdirectory
- [ ] `providers/base.py` defines `BaseSTTProvider`, `BaseLLMProvider`, `BaseTTSProvider` abstract interfaces
- [ ] `providers/registry.py` implements `ProviderRegistry` with register/get methods
- [ ] `providers/factory.py` implements `ProviderFactory` that builds from `TenantContext`
- [ ] `providers/stt/`, `providers/llm/`, `providers/tts/` directories exist with `__init__.py`
- [ ] `config.py` loads all required environment variables with clear error on missing
- [ ] `.env.example` with all required variables documented
- [ ] `python -m agent.main` runs without import errors
- [ ] `README.md` includes setup instructions
