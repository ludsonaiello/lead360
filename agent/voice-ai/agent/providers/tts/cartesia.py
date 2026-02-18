"""Cartesia TTS provider — implemented in Sprint A06."""
import logging
from typing import Any

from livekit.plugins import cartesia

from agent.providers.base import BaseTTSProvider, ProviderContext

logger = logging.getLogger(__name__)

# Default voice ID used when the tenant has not configured one
DEFAULT_VOICE_ID = "a0e99841-438c-4a64-b679-ae501e7d6091"


class CartesiaTTSProvider(BaseTTSProvider):
    """Cartesia Text-to-Speech provider.

    Builds a livekit-plugins-cartesia TTS instance using the API key,
    voice ID, and model configuration resolved from TenantContext.providers.tts.
    """

    @property
    def provider_key(self) -> str:
        return "cartesia"

    def build(self, context: ProviderContext, voice_id: str | None = None) -> Any:
        """Build a LiveKit-compatible Cartesia TTS instance.

        Args:
            context: Provider context (api_key, config) from TenantContext.providers.tts.
                     The api_key has already been decrypted by NestJS before delivery.
            voice_id: Voice ID from TenantContext.providers.tts.voice_id (may be None).

        Returns:
            A cartesia.TTS instance compatible with livekit_agents.tts.TTS.
        """
        resolved_voice_id = voice_id or DEFAULT_VOICE_ID
        model = context.config.get("model", "sonic-2")
        speed = context.config.get("speed")

        logger.info(
            "Building Cartesia TTS: provider_key=%s, voice=%s, model=%s",
            self.provider_key,
            resolved_voice_id,
            model,
        )

        return cartesia.TTS(
            api_key=context.api_key,
            voice=resolved_voice_id,
            model=model,
            speed=speed,
        )
