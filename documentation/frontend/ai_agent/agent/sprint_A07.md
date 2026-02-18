YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A07 — Lead Creation Action (LLM Tool)

**Module**: Voice AI Python Agent  
**Sprint**: A07  
**Depends on**: A05, B06 (internal actions/lead endpoint exists)

---

## Objective

Implement the `create_lead` function tool that the LLM calls when it has collected caller information. Handles duplicate gracefully.

---

## Pre-Coding Checklist

- [ ] A05 complete
- [ ] B06 complete — `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead` endpoint works
- [ ] **HIT THE ENDPOINT**: `curl -X POST http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/create_lead -H "X-Voice-Agent-Key: KEY" -H "Content-Type: application/json" -d '{"call_log_id":"LOG_ID","phone_number":"+15551234567"}' | jq .`

**DO NOT USE PM2** — backend: `cd /var/www/lead360.app/api && npm run dev`

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: Create Lead Action

`/agent/voice-ai/agent/actions/create_lead.py`:

```python
import logging
from typing import Optional
import httpx

from ..config import get_config

logger = logging.getLogger(__name__)


async def create_lead_from_call(
    tenant_id: str,
    call_log_id: str,
    phone_number: str,
    first_name: Optional[str] = None,
    last_name: Optional[str] = None,
    notes: Optional[str] = None,
    service_type: Optional[str] = None,
) -> dict:
    """
    Create or find a lead in Lead360 CRM from call information.
    Returns { lead_id, created } where created=False if lead already existed.
    tenant_id is in the URL path (not body) — part of the generic tool dispatch endpoint.
    """
    cfg = get_config()
    # Path: POST /api/v1/internal/voice-ai/tenant/{tenant_id}/tools/create_lead
    url = f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/create_lead"
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "call_log_id": call_log_id,
        "phone_number": phone_number,
    }
    if first_name:
        payload["first_name"] = first_name
    if last_name:
        payload["last_name"] = last_name
    if notes:
        payload["notes"] = notes
    if service_type:
        payload["service_type"] = service_type
    
    async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
        for attempt in range(cfg.HTTP_MAX_RETRIES + 1):
            try:
                response = await client.post(url, json=payload, headers=headers)
                
                if response.status_code == 409:
                    # Lead already exists — this is fine, return existing ID
                    data = response.json()
                    logger.info("Lead already exists for phone=%s, tenant=%s: lead_id=%s",
                               phone_number, tenant_id, data.get("lead_id"))
                    return {"lead_id": data.get("lead_id"), "created": False}
                
                response.raise_for_status()
                result = response.json()
                logger.info("Lead %s for tenant=%s: lead_id=%s",
                           "created" if result.get("created") else "found",
                           tenant_id, result.get("lead_id"))
                return result
            
            except httpx.TimeoutException:
                if attempt < cfg.HTTP_MAX_RETRIES:
                    import asyncio
                    await asyncio.sleep(1)
                    continue
                logger.error("Timeout creating lead for tenant=%s after %d attempts",
                           tenant_id, attempt + 1)
                return {"lead_id": None, "created": False, "error": "timeout"}
            
            except Exception as e:
                logger.exception("Error creating lead for tenant=%s: %s", tenant_id, e)
                return {"lead_id": None, "created": False, "error": str(e)}
    
    return {"lead_id": None, "created": False}
```

---

## Task 2: Register as LLM Function Tool

Update `worker.py` to add the `create_lead` tool to the assistant:

```python
from livekit.agents import llm as agents_llm
from .actions.create_lead import create_lead_from_call

# In entrypoint, after building assistant, add tool callbacks:
@assistant.on("function_calls_collected")
async def handle_function_calls(fnc_ctx):
    for fnc_call in fnc_ctx.ai_callable.callable_collection:
        if fnc_call.name == "create_lead":
            result = await create_lead_from_call(
                tenant_id=call_info.tenant_id,
                call_log_id=call_log_id,  # Set in A09
                phone_number=fnc_call.arguments.get("phone_number", ""),
                first_name=fnc_call.arguments.get("first_name"),
                last_name=fnc_call.arguments.get("last_name"),
                notes=fnc_call.arguments.get("notes"),
                service_type=fnc_call.arguments.get("service_type"),
            )
```

Note: The exact LiveKit Agents SDK API for function tools may vary by version. Check installed version's documentation and adapt accordingly. The key requirement is: `create_lead_from_call` is called when the LLM decides to collect lead information.

---

## Acceptance Criteria

- [ ] `create_lead_from_call()` calls the correct internal API endpoint
- [ ] 409 response handled gracefully (returns existing lead ID, no error)
- [ ] Timeout and network errors handled without crashing agent
- [ ] All errors logged with tenant_id and call_log_id
- [ ] Returns `{ lead_id, created }` in both success and failure paths
