YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A06 — Cartesia TTS Integration

**Module**: Voice AI Python Agent  
**Sprint**: A06  
**Depends on**: A03, A04, A05

---

## Objective

Build the TTS integration using Cartesia via LiveKit Agents SDK, and wire STT + LLM + TTS into the VoiceAssistant pipeline so the agent can actually have a conversation.

---

## Pre-Coding Checklist

- [ ] A05 complete
- [ ] `livekit-plugins-cartesia` installed
- [ ] Full pipeline: STT → LLM → TTS will be assembled here

**DO NOT USE PM2** — `python -m agent.main`

---

## Task 1: TTS Builder

`/agent/voice-ai/agent/tts.py`:

```python
import logging
from typing import Optional
from livekit.plugins import cartesia

from .context import TenantContext

logger = logging.getLogger(__name__)

# Default voice ID if none specified
DEFAULT_VOICE_ID = "a0e99841-438c-4a64-b679-ae501e7d6091"  # Cartesia default voice

def build_tts(context: TenantContext) -> Optional[cartesia.TTS]:
    """Build configured Cartesia TTS plugin from tenant context."""
    if not context.providers.tts:
        logger.error("No TTS provider configured for tenant=%s", context.tenant.id)
        return None
    
    if context.providers.tts.provider_key != "cartesia":
        logger.warning("Non-Cartesia TTS provider '%s' not yet supported",
                      context.providers.tts.provider_key)
    
    voice_id = context.providers.tts.voice_id or DEFAULT_VOICE_ID
    
    logger.info("Building TTS for tenant=%s, voice=%s", context.tenant.id, voice_id)
    
    return cartesia.TTS(
        api_key=context.providers.tts.api_key,
        voice_id=voice_id,
        model="sonic-english",
        speed=1.0,
    )
```

---

## Task 2: Assemble Voice Pipeline in worker.py

Update `worker.py` to build the full voice assistant:

```python
from livekit.agents.voice_assistant import VoiceAssistant
from .stt import build_stt
from .llm import build_llm, build_initial_chat_context
from .tts import build_tts
from .prompt_builder import build_system_prompt

async def entrypoint(ctx: JobContext):
    # ... context fetching and quota check (from A03) ...
    
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    
    # Build pipeline components
    stt = build_stt(context)
    llm = build_llm(context)
    tts = build_tts(context)
    
    if not all([stt, llm, tts]):
        logger.error("Failed to build pipeline for tenant=%s", call_info.tenant_id)
        await ctx.room.disconnect()
        return
    
    # Build system prompt
    system_prompt = build_system_prompt(context)
    initial_ctx = build_initial_chat_context(system_prompt)
    
    # Create voice assistant
    assistant = VoiceAssistant(
        vad=silero.VAD.load(),  # Voice Activity Detection
        stt=stt,
        llm=llm,
        tts=tts,
        chat_ctx=initial_ctx,
    )
    
    # Start the assistant in the room
    assistant.start(ctx.room)
    
    # Greet the caller
    await asyncio.sleep(1)  # Brief pause for SIP connection to stabilize
    await assistant.say(context.behavior.greeting, allow_interruptions=True)
    
    # Wait for call to end
    await asyncio.sleep(context.behavior.max_call_duration_seconds)
    logger.info("Max call duration reached for tenant=%s", call_info.tenant_id)
    await ctx.room.disconnect()
```

Add required imports at top of worker.py:
```python
import asyncio
from livekit.plugins import silero
```

---

## Acceptance Criteria

- [ ] `build_tts(context)` returns `cartesia.TTS` instance with tenant's API key
- [ ] Voice pipeline assembled: VAD + STT + LLM + TTS
- [ ] Agent greets caller with configured greeting on call start
- [ ] Max call duration enforced via asyncio.sleep
- [ ] All components use tenant's provider API keys (not hardcoded)
