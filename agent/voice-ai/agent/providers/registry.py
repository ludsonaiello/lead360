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
