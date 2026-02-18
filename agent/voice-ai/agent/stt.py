import logging
from typing import Optional
from livekit.plugins import deepgram

from .context import TenantContext

logger = logging.getLogger(__name__)

# Language code mapping: Lead360 language codes → Deepgram language codes
LANGUAGE_MAP = {
    "en": "en-US",
    "es": "es",
    "pt": "pt-BR",
    "fr": "fr",
    "de": "de",
    "it": "it",
    "ja": "ja",
    "ko": "ko",
    "zh": "zh",
}


def build_stt(context: TenantContext) -> Optional[deepgram.STT]:
    """Build configured Deepgram STT plugin from tenant context."""
    if not context.providers.stt:
        logger.error("No STT provider configured for tenant=%s", context.tenant.id)
        return None

    if context.providers.stt.provider_key != "deepgram":
        logger.warning(
            "Non-Deepgram STT provider '%s' not supported yet, falling back to Deepgram",
            context.providers.stt.provider_key,
        )

    # Map language code
    lang_code = context.behavior.language
    deepgram_lang = LANGUAGE_MAP.get(lang_code, "en-US")
    logger.info(
        "Building STT for tenant=%s, language=%s→%s",
        context.tenant.id,
        lang_code,
        deepgram_lang,
    )

    # Resolve model from provider config (e.g. "nova-2"), fallback to nova-3
    model = context.providers.stt.config.get("model", "nova-3")

    return deepgram.STT(
        api_key=context.providers.stt.api_key,
        language=deepgram_lang,
        model=model,
        punctuate=True,
        interim_results=True,
        endpointing_ms=1000,  # SDK param (utterance_end_ms in older versions)
    )
