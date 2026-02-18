import logging
from typing import Any
from livekit.plugins import deepgram

from agent.providers.base import BaseSTTProvider, ProviderContext
from agent.stt import LANGUAGE_MAP

logger = logging.getLogger(__name__)


class DeepgramSTTProvider(BaseSTTProvider):
    """Deepgram Speech-to-Text provider — implemented in Sprint A04."""

    @property
    def provider_key(self) -> str:
        return "deepgram"

    def build(self, context: ProviderContext, language: str) -> Any:
        """
        Build a LiveKit-compatible Deepgram STT instance.

        Args:
            context: Provider context (api_key, config) from TenantContext.providers.stt
            language: BCP-47 language code from TenantContext.behavior.language (e.g. 'en', 'es')
        """
        deepgram_lang = LANGUAGE_MAP.get(language, "en-US")
        model = context.config.get("model", "nova-3")

        logger.info(
            "Building Deepgram STT: provider_key=%s, language=%s→%s, model=%s",
            self.provider_key,
            language,
            deepgram_lang,
            model,
        )

        return deepgram.STT(
            api_key=context.api_key,
            language=deepgram_lang,
            model=model,
            punctuate=True,
            interim_results=True,
            endpointing_ms=1000,  # SDK param (utterance_end_ms in older docs)
        )
