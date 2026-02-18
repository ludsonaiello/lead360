import logging
from typing import Optional
from livekit.plugins import cartesia

from .context import TenantContext

logger = logging.getLogger(__name__)

# Default voice ID if none configured for tenant
DEFAULT_VOICE_ID = "a0e99841-438c-4a64-b679-ae501e7d6091"  # Cartesia "Helpful Woman" voice


def build_tts(context: TenantContext) -> Optional[cartesia.TTS]:
    """Build configured Cartesia TTS plugin from tenant context."""
    if not context.providers.tts:
        logger.error("No TTS provider configured for tenant=%s", context.tenant.id)
        return None

    if context.providers.tts.provider_key != "cartesia":
        logger.warning(
            "Non-Cartesia TTS provider '%s' not yet supported",
            context.providers.tts.provider_key,
        )

    voice_id = context.providers.tts.voice_id or DEFAULT_VOICE_ID
    model = context.providers.tts.config.get("model", "sonic-2")
    speed = context.providers.tts.config.get("speed")
    # Pass tenant language so multilingual models (sonic-multilingual) speak correctly.
    # Cartesia accepts ISO 639-1 codes ("en", "pt", "es", "fr", etc.) which match
    # the Lead360 behavior.language field directly.
    language = context.behavior.language or "en"

    logger.info(
        "Building TTS for tenant=%s, voice=%s, model=%s, language=%s",
        context.tenant.id,
        voice_id,
        model,
        language,
    )

    return cartesia.TTS(
        api_key=context.providers.tts.api_key,
        voice=voice_id,
        model=model,
        speed=speed,
        language=language,
    )
