YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A09 — Call Lifecycle (Start/End Hooks)

**Module**: Voice AI Python Agent  
**Sprint**: A09  
**Depends on**: A03, B07 (call start/end endpoints exist)

---

## Objective

Instrument every call with start and end events, logging to Lead360's call log system and triggering usage tracking.

---

## Pre-Coding Checklist

- [ ] A06 complete — voice pipeline runs
- [ ] B07 complete — `/internal/calls/start` and `/internal/calls/end` exist
- [ ] **HIT BOTH ENDPOINTS** to verify request/response shapes

**DO NOT USE PM2** — backend running

---

## Task 1: Call Lifecycle Service

`/agent/voice-ai/agent/lifecycle.py`:

```python
import logging
import asyncio
from typing import Optional, List
import httpx

from .config import config

logger = logging.getLogger(__name__)


async def on_call_start(
    tenant_id: str,
    call_sid: str,
    from_number: str,
    to_number: str,
    direction: str = "inbound",
) -> Optional[str]:
    """
    Register call start with Lead360. Returns call_log_id.
    On failure: logs error and returns None (call continues, unlogged).
    """
    url = f"{config.LEAD360_API_URL}/voice-ai/internal/calls/start"
    headers = {
        "X-Voice-Agent-Key": config.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "tenant_id": tenant_id,
        "call_sid": call_sid,
        "from_number": from_number,
        "to_number": to_number,
        "direction": direction,
    }
    
    try:
        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
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


async def on_call_end(
    call_log_id: Optional[str],
    duration_seconds: int,
    outcome: str,
    transcript_summary: Optional[str] = None,
    full_transcript: Optional[str] = None,
    actions_taken: Optional[List[str]] = None,
    lead_id: Optional[str] = None,
    is_overage: bool = False,
) -> None:
    """
    Finalize call log. Non-blocking — errors are logged but do not raise.
    """
    if not call_log_id:
        logger.warning("No call_log_id available, skipping call end logging")
        return
    
    url = f"{config.LEAD360_API_URL}/voice-ai/internal/calls/end"
    headers = {
        "X-Voice-Agent-Key": config.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "call_log_id": call_log_id,
        "duration_seconds": duration_seconds,
        "outcome": outcome,
        "is_overage": is_overage,
    }
    if transcript_summary:
        payload["transcript_summary"] = transcript_summary
    if full_transcript:
        payload["full_transcript"] = full_transcript
    if actions_taken:
        payload["actions_taken"] = actions_taken
    if lead_id:
        payload["lead_id"] = lead_id
    
    try:
        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info("Call ended: call_log_id=%s, outcome=%s, duration=%ds",
                       call_log_id, outcome, duration_seconds)
    except Exception as e:
        # Non-fatal: log error but do NOT re-raise
        logger.error("Failed to register call end (non-fatal): call_log_id=%s, error=%s",
                    call_log_id, e)
```

---

## Task 2: Wire into worker.py

Update `worker.py` to use lifecycle hooks:

```python
import time
from .lifecycle import on_call_start, on_call_end

async def entrypoint(ctx: JobContext):
    # ... context fetching ...
    
    # Register call start
    call_log_id = await on_call_start(
        tenant_id=call_info.tenant_id,
        call_sid=call_info.call_sid,
        from_number=call_info.from_number,
        to_number=call_info.to_number,
    )
    
    call_start_time = time.monotonic()
    outcome = "abandoned"
    lead_id_from_call = None
    actions_taken = []
    
    try:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        
        # ... build pipeline, run assistant ...
        
        outcome = "completed"
        
    except Exception as e:
        logger.exception("Error during call for tenant=%s: %s", call_info.tenant_id, e)
        outcome = "error"
    
    finally:
        duration = int(time.monotonic() - call_start_time)
        # Always call on_call_end, even if errors occurred
        await on_call_end(
            call_log_id=call_log_id,
            duration_seconds=duration,
            outcome=outcome,
            lead_id=lead_id_from_call,
            actions_taken=actions_taken,
            is_overage=context.quota.quota_exceeded if context else False,
        )
        await ctx.room.disconnect()
```

---

## Acceptance Criteria

- [ ] `on_call_start()` called at room join, returns `call_log_id`
- [ ] `on_call_end()` called in `finally` block — ALWAYS executed even on errors
- [ ] `on_call_end()` does not raise exceptions (errors logged only)
- [ ] Duration calculated correctly from wall clock
- [ ] Outcome set correctly: `completed`, `transferred`, `voicemail`, `abandoned`, `error`
- [ ] Lead ID passed to call end if created during the call
