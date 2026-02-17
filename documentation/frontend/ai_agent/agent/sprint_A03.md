YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A03 — Context Fetcher

**Module**: Voice AI Python Agent  
**Sprint**: A03  
**Depends on**: A01, A02, B06 (internal context endpoint must exist)

---

## Objective

Build the context fetcher that retrieves and caches the tenant configuration from Lead360's internal API. This is the first thing the agent does after receiving a call.

---

## Pre-Coding Checklist

- [ ] A02 complete
- [ ] B06 complete — `GET /voice-ai/internal/context/:tenantId` endpoint exists
- [ ] Have a valid VOICE_AGENT_KEY configured in `.env`
- [ ] **HIT THE ENDPOINT**: `curl http://localhost:8000/api/v1/voice-ai/internal/context/TENANT_ID -H "X-Voice-Agent-Key: YOUR_KEY" | jq .`
- [ ] Study the response shape — match EVERY field in Pydantic models

**DO NOT USE PM2** — backend: `cd /var/www/lead360.app/api && npm run dev`

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: Pydantic Models

`/agent/voice-ai/agent/context.py`:

```python
from __future__ import annotations
import asyncio
import logging
import time
from typing import Optional, List
from pydantic import BaseModel
import httpx

from .config import config

logger = logging.getLogger(__name__)


class TenantInfo(BaseModel):
    id: str
    company_name: str
    phone: Optional[str] = None
    timezone: str
    language: Optional[str] = None


class QuotaInfo(BaseModel):
    minutes_included: int
    minutes_used: int
    minutes_remaining: int
    overage_rate: Optional[float] = None
    quota_exceeded: bool


class BehaviorConfig(BaseModel):
    is_enabled: bool
    language: str
    greeting: str
    custom_instructions: Optional[str] = None
    booking_enabled: bool
    lead_creation_enabled: bool
    transfer_enabled: bool
    max_call_duration_seconds: int


class ProviderConfig(BaseModel):
    provider_key: str
    api_key: str


class TtsProviderConfig(ProviderConfig):
    voice_id: Optional[str] = None


class ProvidersConfig(BaseModel):
    stt: Optional[ProviderConfig] = None
    llm: Optional[ProviderConfig] = None
    tts: Optional[TtsProviderConfig] = None


class ServiceInfo(BaseModel):
    name: str
    description: Optional[str] = None


class ServiceAreaInfo(BaseModel):
    type: str
    value: str
    state: Optional[str] = None


class TransferNumber(BaseModel):
    label: str
    phone_number: str
    is_default: bool


class TenantContext(BaseModel):
    tenant: TenantInfo
    quota: QuotaInfo
    behavior: BehaviorConfig
    providers: ProvidersConfig
    services: List[ServiceInfo]
    service_areas: List[ServiceAreaInfo]
    transfer_numbers: List[TransferNumber]
```

---

## Task 2: ContextFetcher Class

Continue in `context.py`:

```python
class ContextFetcher:
    """Fetches and caches tenant context from Lead360 API."""
    
    def __init__(self):
        self._cache: dict[str, tuple[TenantContext, float]] = {}
        self._lock = asyncio.Lock()
    
    def _is_cached(self, tenant_id: str) -> bool:
        if tenant_id not in self._cache:
            return False
        _, cached_at = self._cache[tenant_id]
        return (time.monotonic() - cached_at) < config.CONTEXT_CACHE_TTL
    
    async def fetch(self, tenant_id: str) -> TenantContext:
        """Fetch context, using cache if available."""
        async with self._lock:
            if self._is_cached(tenant_id):
                logger.debug("Context cache hit for tenant=%s", tenant_id)
                return self._cache[tenant_id][0]
        
        logger.info("Fetching context for tenant=%s", tenant_id)
        context = await self._fetch_from_api(tenant_id)
        
        async with self._lock:
            self._cache[tenant_id] = (context, time.monotonic())
        
        return context
    
    async def _fetch_from_api(self, tenant_id: str) -> TenantContext:
        url = f"{config.LEAD360_API_URL}/voice-ai/internal/context/{tenant_id}"
        headers = {"X-Voice-Agent-Key": config.VOICE_AGENT_KEY}
        
        async with httpx.AsyncClient(timeout=config.HTTP_TIMEOUT) as client:
            for attempt in range(config.HTTP_MAX_RETRIES + 1):
                try:
                    response = await client.get(url, headers=headers)
                    response.raise_for_status()
                    return TenantContext.model_validate(response.json())
                except httpx.TimeoutException:
                    if attempt < config.HTTP_MAX_RETRIES:
                        await asyncio.sleep(1)
                        continue
                    raise
                except httpx.HTTPStatusError as e:
                    logger.error("Context fetch failed: status=%d, tenant=%s", 
                                e.response.status_code, tenant_id)
                    raise
    
    def is_quota_exceeded_hard(self, context: TenantContext) -> bool:
        """Returns True if quota exceeded and no overage allowed (call should be rejected)."""
        return context.quota.quota_exceeded and context.quota.overage_rate is None


# Singleton instance
context_fetcher = ContextFetcher()
```

---

## Task 3: Update worker.py to Use Context

In `worker.py`, update `entrypoint` to fetch context and check quota:

```python
from .context import context_fetcher

async def entrypoint(ctx: JobContext):
    # ... extract call_info ...
    
    # Fetch tenant context
    try:
        context = await context_fetcher.fetch(call_info.tenant_id)
    except Exception as e:
        logger.exception("Failed to fetch context for tenant=%s: %s", 
                        call_info.tenant_id, e)
        await ctx.room.disconnect()
        return
    
    # Check voice AI enabled
    if not context.behavior.is_enabled:
        logger.warning("Voice AI disabled for tenant=%s", call_info.tenant_id)
        await ctx.room.disconnect()
        return
    
    # Check hard quota
    if context_fetcher.is_quota_exceeded_hard(context):
        logger.warning("Quota exceeded for tenant=%s, no overage allowed", 
                      call_info.tenant_id)
        # TODO in A06: Play "quota exceeded" TTS message before disconnecting
        await ctx.room.disconnect()
        return
    
    logger.info("Context loaded for tenant=%s (%s), quota: %d/%d min",
                call_info.tenant_id, context.tenant.company_name,
                context.quota.minutes_used, context.quota.minutes_included)
    
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    # Agent pipeline will be built in A04-A09
```

---

## Acceptance Criteria

- [ ] `TenantContext` Pydantic model matches real API response exactly
- [ ] `context_fetcher.fetch(tenant_id)` returns context from API
- [ ] Cache works: second call within 60s returns cached value without HTTP request
- [ ] Quota check: `is_quota_exceeded_hard()` returns True when `quota_exceeded=true` and `overage_rate=null`
- [ ] Worker uses context fetcher and disconnects if disabled or quota hard-exceeded
- [ ] All HTTP errors logged with tenant_id
