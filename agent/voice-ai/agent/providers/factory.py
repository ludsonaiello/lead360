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
