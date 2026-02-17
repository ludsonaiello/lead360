YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A04 — Deepgram STT Integration

**Module**: Voice AI Python Agent  
**Sprint**: A04  
**Depends on**: A03

---

## Objective

Integrate Deepgram Speech-to-Text using the LiveKit Agents SDK Deepgram plugin. The STT provider and API key come from the tenant context.

---

## Pre-Coding Checklist

- [ ] A03 complete — context fetcher works
- [ ] `livekit-plugins-deepgram` installed
- [ ] Understand that API keys come from context (decrypted by NestJS backend)

**DO NOT USE PM2** — `python -m agent.main`

---

## Task 1: STT Builder

`/agent/voice-ai/agent/stt.py`:

```python
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
        logger.warning("Non-Deepgram STT provider '%s' not supported yet, falling back to Deepgram",
                      context.providers.stt.provider_key)
    
    # Map language code
    lang_code = context.behavior.language
    deepgram_lang = LANGUAGE_MAP.get(lang_code, "en-US")
    logger.info("Building STT for tenant=%s, language=%s→%s", 
                context.tenant.id, lang_code, deepgram_lang)
    
    return deepgram.STT(
        api_key=context.providers.stt.api_key,
        language=deepgram_lang,
        punctuate=True,
        interim_results=True,
        utterance_end_ms=1000,
    )
```

---

## Acceptance Criteria

- [ ] `build_stt(context)` returns a `deepgram.STT` instance
- [ ] Language code mapped correctly from context to Deepgram format
- [ ] Returns None gracefully if no STT provider configured
- [ ] API key comes from context (never hardcoded)
- [ ] Logs show language mapping on startup
