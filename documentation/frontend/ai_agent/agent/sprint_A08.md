YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A08 — Appointment Booking Action (LLM Tool)

**Module**: Voice AI Python Agent  
**Sprint**: A08  
**Depends on**: A07, B06

---

## Objective

Implement the `book_appointment` function tool. The LLM calls this when the caller wants to schedule a service visit.

---

## Pre-Coding Checklist

- [ ] A07 complete
- [ ] B06 complete — `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment` endpoint exists
- [ ] **HIT THE ENDPOINT**: `curl -X POST http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/book_appointment -H "X-Voice-Agent-Key: KEY" -H "Content-Type: application/json" -d '{"call_log_id":"LOG_ID","service_type":"Plumbing"}' | jq .`

**DO NOT USE PM2** — backend running

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: Book Appointment Action

`/agent/voice-ai/agent/actions/book_appointment.py`:

```python
import logging
import asyncio
from typing import Optional
import httpx

from ..config import get_config

logger = logging.getLogger(__name__)


async def book_appointment(
    tenant_id: str,
    call_log_id: str,
    lead_id: Optional[str] = None,
    preferred_date: Optional[str] = None,  # ISO date string e.g. "2026-02-20"
    service_type: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """
    Book an appointment/service request for a caller.
    tenant_id is in the URL path — generic tool dispatch endpoint.
    Returns { appointment_id, status } or { error }
    """
    cfg = get_config()
    # Path: POST /api/v1/internal/voice-ai/tenant/{tenant_id}/tools/book_appointment
    url = f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/book_appointment"
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "call_log_id": call_log_id,
    }
    if lead_id:
        payload["lead_id"] = lead_id
    if preferred_date:
        payload["preferred_date"] = preferred_date
    if service_type:
        payload["service_type"] = service_type
    if notes:
        payload["notes"] = notes
    
    async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
        for attempt in range(cfg.HTTP_MAX_RETRIES + 1):
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()
                logger.info("Appointment booked for tenant=%s, lead=%s",
                           tenant_id, lead_id)
                return result
            
            except httpx.TimeoutException:
                if attempt < cfg.HTTP_MAX_RETRIES:
                    await asyncio.sleep(1)
                    continue
                logger.error("Timeout booking appointment for tenant=%s", tenant_id)
                return {"error": "timeout", "appointment_id": None}
            
            except Exception as e:
                logger.exception("Error booking appointment: %s", e)
                return {"error": str(e), "appointment_id": None}
    
    return {"error": "max_retries_exceeded", "appointment_id": None}
```

---

## Acceptance Criteria

- [ ] `book_appointment()` calls the correct internal API endpoint
- [ ] Handles timeout and network errors without crashing
- [ ] Returns appointment_id on success
- [ ] Returns error dict (not exception) on failure
- [ ] All failures logged with tenant_id
