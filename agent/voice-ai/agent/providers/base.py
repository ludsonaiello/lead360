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
