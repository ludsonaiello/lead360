YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A09 — Call Lifecycle (Start/Complete Hooks)

**Module**: Voice AI Python Agent
**Sprint**: A09
**Depends on**: A03, B06 (call start/complete endpoints exist)

---

## Objective

Instrument every call with start and complete events, logging to Lead360's call log system and triggering usage tracking. The `/calls/:callSid/complete` endpoint (API-030) replaces the old `/calls/end` — it accepts the call_sid in the URL path and includes per-provider usage records in the body.

---

## Pre-Coding Checklist

- [ ] A06 complete — voice pipeline runs
- [ ] B06 complete — `/internal/voice-ai/calls/start` and `/calls/:callSid/complete` endpoints exist
- [ ] B07 complete — usage service creates per-call per-provider records
- [ ] **HIT BOTH ENDPOINTS** to verify request/response shapes:
  ```bash
  # Start call
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/start \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"T1","call_sid":"test-sid","from_number":"+15551234567","to_number":"+15559999999"}' | jq .
  # Returns: { "call_log_id": "uuid" }

  # Complete call
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/test-sid/complete \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_sid":"test-sid","duration_seconds":120,"outcome":"completed","usage_records":[]}' | jq .
  ```

**DO NOT USE PM2** — backend running

---

## Task 1: Types

`/agent/voice-ai/agent/lifecycle.py` — define dataclasses at top of file:

```python
from dataclasses import dataclass, field
from typing import Optional, List

@dataclass
class UsageRecord:
    """Per-provider usage for billing. Sent to /calls/:callSid/complete."""
    provider_id: str
    provider_type: str       # STT | LLM | TTS
    usage_quantity: float    # seconds (STT), tokens (LLM), characters (TTS)
    usage_unit: str          # 'seconds' | 'tokens' | 'characters'
    estimated_cost: Optional[float] = None
```

---

## Task 2: Call Lifecycle Functions

`/agent/voice-ai/agent/lifecycle.py`:

```python
import logging
import asyncio
from typing import Optional, List
import httpx

from .config import get_config

logger = logging.getLogger(__name__)


async def on_call_start(
    tenant_id: str,
    call_sid: str,
    from_number: str,
    to_number: str,
    direction: str = "inbound",
    stt_provider_id: Optional[str] = None,
    llm_provider_id: Optional[str] = None,
    tts_provider_id: Optional[str] = None,
) -> Optional[str]:
    """
    Register call start with Lead360. Returns call_log_id.
    On failure: logs error and returns None (call continues, unlogged).
    Non-fatal — do NOT raise exceptions.
    """
    cfg = get_config()
    # Path: POST /api/v1/internal/voice-ai/calls/start
    url = f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/calls/start"
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "tenant_id": tenant_id,
        "call_sid": call_sid,
        "from_number": from_number,
        "to_number": to_number,
        "direction": direction,
    }
    if stt_provider_id:
        payload["stt_provider_id"] = stt_provider_id
    if llm_provider_id:
        payload["llm_provider_id"] = llm_provider_id
    if tts_provider_id:
        payload["tts_provider_id"] = tts_provider_id

    try:
        async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            result = response.json()
            call_log_id = result.get("call_log_id")
            logger.info("Call started: tenant=%s, callSid=%s, call_log_id=%s",
                        tenant_id, call_sid, call_log_id)
            return call_log_id
    except Exception as e:
        logger.error("Failed to register call start (non-fatal): tenant=%s, callSid=%s, error=%s",
                     tenant_id, call_sid, e)
        return None


async def on_call_complete(
    call_sid: str,
    duration_seconds: int,
    outcome: str,
    transcript_summary: Optional[str] = None,
    full_transcript: Optional[str] = None,
    actions_taken: Optional[List[str]] = None,
    lead_id: Optional[str] = None,
    usage_records: Optional[List[UsageRecord]] = None,
) -> None:
    """
    Finalize call log with usage data. Non-blocking — errors are logged but do NOT raise.
    call_sid is used as path parameter (NOT in body).
    usage_records: per-provider usage for billing (STT seconds, LLM tokens, TTS chars).
    """
    cfg = get_config()
    # Path: POST /api/v1/internal/voice-ai/calls/{call_sid}/complete
    url = f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/calls/{call_sid}/complete"
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {
        "call_sid": call_sid,
        "duration_seconds": duration_seconds,
        "outcome": outcome,  # completed | transferred | voicemail | abandoned | error
    }
    if transcript_summary:
        payload["transcript_summary"] = transcript_summary
    if full_transcript:
        payload["full_transcript"] = full_transcript
    if actions_taken:
        payload["actions_taken"] = actions_taken
    if lead_id:
        payload["lead_id"] = lead_id
    if usage_records:
        payload["usage_records"] = [
            {
                "provider_id": r.provider_id,
                "provider_type": r.provider_type,
                "usage_quantity": r.usage_quantity,
                "usage_unit": r.usage_unit,
                **({"estimated_cost": r.estimated_cost} if r.estimated_cost is not None else {}),
            }
            for r in usage_records
        ]

    try:
        async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info("Call completed: callSid=%s, outcome=%s, duration=%ds",
                        call_sid, outcome, duration_seconds)
    except Exception as e:
        # Non-fatal: log error but do NOT re-raise — call already ended
        logger.error("Failed to register call complete (non-fatal): callSid=%s, error=%s",
                     call_sid, e)
```

---

## Task 3: Wire into worker.py

Update `worker.py` to use lifecycle hooks. `call_sid` must be passed through:

```python
import time
from .lifecycle import on_call_start, on_call_complete, UsageRecord

async def entrypoint(ctx: JobContext):
    call_info = sip_handler.extract_call_info(ctx)

    # Register call start (non-fatal if fails)
    # Pass provider IDs from the context that was resolved
    call_log_id = await on_call_start(
        tenant_id=call_info.tenant_id,
        call_sid=call_info.call_sid,
        from_number=call_info.from_number,
        to_number=call_info.to_number,
        stt_provider_id=context.providers.stt.provider_id if context and context.providers.stt else None,
        llm_provider_id=context.providers.llm.provider_id if context and context.providers.llm else None,
        tts_provider_id=context.providers.tts.provider_id if context and context.providers.tts else None,
    )

    call_start_time = time.monotonic()
    outcome = "abandoned"
    lead_id_from_call: str | None = None
    actions_taken: list[str] = []
    usage_records: list[UsageRecord] = []

    try:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        # ... build pipeline, run assistant ...
        # usage_records populated by pipeline during call
        outcome = "completed"

    except Exception as e:
        logger.exception("Error during call for tenant=%s: %s", call_info.tenant_id, e)
        outcome = "error"

    finally:
        duration = int(time.monotonic() - call_start_time)
        # ALWAYS call on_call_complete, even on errors
        await on_call_complete(
            call_sid=call_info.call_sid,     # path param
            duration_seconds=duration,
            outcome=outcome,
            lead_id=lead_id_from_call,
            actions_taken=actions_taken,
            usage_records=usage_records,     # per-provider usage for billing
        )
        await ctx.room.disconnect()
```

---

## Acceptance Criteria

- [ ] `on_call_start()` posts to `/api/v1/internal/voice-ai/calls/start` with correct payload
- [ ] `on_call_start()` returns `call_log_id` from response
- [ ] `on_call_complete()` posts to `/api/v1/internal/voice-ai/calls/{call_sid}/complete` (call_sid in URL path)
- [ ] `on_call_complete()` sends `usage_records` array with per-provider usage data
- [ ] Both functions are non-fatal: exceptions are logged, never re-raised
- [ ] `on_call_complete()` called in `finally` block — ALWAYS executes even on errors
- [ ] `UsageRecord` dataclass has all fields: `provider_id`, `provider_type`, `usage_quantity`, `usage_unit`, `estimated_cost`
- [ ] Duration calculated correctly from wall clock
- [ ] Outcome set correctly: `completed`, `transferred`, `voicemail`, `abandoned`, `error`
