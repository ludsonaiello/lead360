YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A09 — Call Lifecycle (Start/Complete Hooks + Cost Calculation)

**Module**: Voice AI Python Agent
**Sprint**: A09
**Depends on**: A03, A06, B06a, B06b, B07, FSA08-fixing (provider cost fields in context)

---

## Objective

Instrument every call with start and complete events, logging to Lead360's call log system and triggering accurate usage tracking. The `/calls/:callSid/complete` endpoint accepts per-provider usage records **including `estimated_cost`** — calculated from the provider's `cost_per_unit` and `cost_unit` fields that the context now provides (added in FSA08-fixing).

**Critical**: `estimated_cost` must be calculated from context pricing, NOT hardcoded. Lead360 staff update pricing in the admin UI when providers change rates — the agent must always use live values from the context.

---

## Pre-Coding Checklist

- [ ] A06 complete — full voice pipeline runs (STT → LLM → TTS)
- [ ] B06a complete — `VoiceAgentKeyGuard` exists
- [ ] B06b complete — `/internal/voice-ai/calls/start` and `/calls/:callSid/complete` endpoints exist
- [ ] B07 complete — `VoiceUsageService` creates per-call per-provider records
- [ ] **FSA08-fixing backend tasks complete** — `cost_per_unit` and `cost_unit` appear in the internal context endpoint response

- [ ] **HIT THE CONTEXT ENDPOINT** — verify `cost_per_unit` and `cost_unit` are present in the provider blocks:
  ```bash
  AGENT_KEY=$(grep VOICE_AGENT_KEY /var/www/lead360.app/api/.env | cut -d= -f2)
  TENANT_ID="your-tenant-uuid"

  curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '{
      stt: .providers.stt | {provider_key, cost_per_unit, cost_unit},
      llm: .providers.llm | {provider_key, cost_per_unit, cost_unit},
      tts: .providers.tts | {provider_key, cost_per_unit, cost_unit}
    }'
  # MUST return non-null cost_per_unit and cost_unit before starting implementation
  # If null → FSA08-fixing backend tasks not complete yet
  ```

- [ ] **HIT CALL START endpoint**:
  ```bash
  AGENT_KEY=$(grep VOICE_AGENT_KEY /var/www/lead360.app/api/.env | cut -d= -f2)

  curl -s -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/start \
    -H "X-Voice-Agent-Key: $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "tenant_id": "your-tenant-uuid",
      "call_sid": "test-sid-A09",
      "from_number": "+15551234567",
      "to_number": "+15559999999"
    }' | jq .
  # Expect: { "call_log_id": "uuid" }
  ```

- [ ] **HIT CALL COMPLETE endpoint** with a usage record including estimated_cost:
  ```bash
  curl -s -X POST "http://localhost:8000/api/v1/internal/voice-ai/calls/test-sid-A09/complete" \
    -H "X-Voice-Agent-Key: $AGENT_KEY" \
    -H "Content-Type: application/json" \
    -d '{
      "call_sid": "test-sid-A09",
      "duration_seconds": 90,
      "outcome": "completed",
      "usage_records": [
        {
          "provider_id": "deepgram-provider-uuid",
          "provider_type": "STT",
          "usage_quantity": 90.0,
          "usage_unit": "seconds",
          "estimated_cost": 0.006444
        },
        {
          "provider_id": "openai-provider-uuid",
          "provider_type": "LLM",
          "usage_quantity": 1200,
          "usage_unit": "tokens",
          "estimated_cost": 0.00018
        },
        {
          "provider_id": "cartesia-provider-uuid",
          "provider_type": "TTS",
          "usage_quantity": 850,
          "usage_unit": "characters",
          "estimated_cost": 0.0085
        }
      ]
    }' | jq .
  # Expect 200 OK
  ```
  Verify the `voice_usage_record` rows were created with the correct `estimated_cost` values.

**DO NOT USE PM2** — backend: `cd /var/www/lead360.app/api && npm run dev`

---

## Task 1: Update A03 `ProviderConfig` — Add Cost Fields

**Before implementing lifecycle.py**, update the context types in A03 to include the new cost fields. The `ProviderConfig` Pydantic model in `context_fetcher.py` must match the real API response after FSA08-fixing.

**File**: `/agent/voice-ai/agent/context_fetcher.py`

Update `ProviderConfig` (add after `config` field):

```python
class ProviderConfig(BaseModel):
    provider_id: str        # UUID of the voice_ai_provider row — used for usage tracking
    provider_key: str       # e.g. 'deepgram', 'openai', 'cartesia'
    api_key: str            # decrypted API key
    config: Dict[str, Any] = {}  # provider-specific config (model, temperature, etc.)
    cost_per_unit: Optional[float] = None   # ADD: USD cost per 1 usage unit (from FSA08-fixing)
    cost_unit: Optional[str] = None         # ADD: 'per_second' | 'per_token' | 'per_character'
```

**Verify this matches the real API response**:
```bash
curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '.providers.stt | keys'
# Must include "cost_per_unit" and "cost_unit"
```

---

## Task 2: Cost Calculator Utility

`/agent/voice-ai/agent/lifecycle.py` — add the cost calculation function at module level:

```python
from dataclasses import dataclass, field
from typing import Optional, List
import logging
import asyncio
import httpx

from .config import get_config
from .context_fetcher import ProviderConfig

logger = logging.getLogger(__name__)


@dataclass
class UsageRecord:
    """Per-provider usage for billing. Sent to /calls/:callSid/complete."""
    provider_id: str
    provider_type: str        # STT | LLM | TTS
    usage_quantity: float     # seconds (STT), tokens (LLM), characters (TTS)
    usage_unit: str           # 'seconds' | 'tokens' | 'characters'
    estimated_cost: Optional[float] = None  # USD — calculated from provider cost_per_unit


def calculate_cost(usage_quantity: float, provider: Optional[ProviderConfig]) -> Optional[float]:
    """
    Calculate estimated cost in USD for a provider usage quantity.

    Uses cost_per_unit and cost_unit from the provider's context (set by Lead360 admin via FSA08).
    Returns None if provider is missing or has no pricing configured.

    Examples:
        STT:  90 seconds  × $0.0000716/second  = $0.006444
        LLM:  1200 tokens × $0.00000015/token  = $0.00018
        TTS:  850 chars   × $0.00001/character = $0.0085

    NEVER hardcode rates here — rates come from the context so Lead360 admin can
    update them in the admin UI when providers change pricing.
    """
    if provider is None:
        return None
    if provider.cost_per_unit is None:
        logger.warning(
            "Provider %s (%s) has no cost_per_unit configured — estimated_cost will be null. "
            "Update pricing in Lead360 admin: Voice AI → Providers → Edit.",
            provider.provider_key, provider.provider_id
        )
        return None

    cost = round(usage_quantity * provider.cost_per_unit, 8)
    logger.debug(
        "Cost calc: %.4f %s × $%.8f/%s = $%.8f (%s)",
        usage_quantity,
        provider.cost_unit or "units",
        provider.cost_per_unit,
        provider.cost_unit or "unit",
        cost,
        provider.provider_key,
    )
    return cost
```

---

## Task 3: Call Lifecycle Functions

Continue in `/agent/voice-ai/agent/lifecycle.py`:

```python
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
    Non-fatal — on failure logs error and returns None (call continues, unlogged).
    """
    cfg = get_config()
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
            logger.info(
                "Call started: tenant=%s, callSid=%s, call_log_id=%s",
                tenant_id, call_sid, call_log_id,
            )
            return call_log_id
    except Exception as e:
        logger.error(
            "Failed to register call start (non-fatal): tenant=%s, callSid=%s, error=%s",
            tenant_id, call_sid, e,
        )
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
    Finalize call log with usage data. Non-fatal — errors logged, never re-raised.
    call_sid goes in URL path, NOT in body.
    usage_records: per-provider usage with estimated_cost calculated from context pricing.
    """
    cfg = get_config()
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
            logger.info(
                "Call completed: callSid=%s, outcome=%s, duration=%ds, records=%d",
                call_sid, outcome, duration_seconds, len(usage_records or []),
            )
    except Exception as e:
        logger.error(
            "Failed to register call complete (non-fatal): callSid=%s, error=%s",
            call_sid, e,
        )
```

---

## Task 4: Wire into `worker.py`

Update `worker.py` to:
1. Pass provider IDs from resolved context to `on_call_start`
2. Build `UsageRecord` objects with `estimated_cost` calculated from context pricing
3. Call `on_call_complete` in `finally` block — **always executes**, even on errors

```python
import time
from .lifecycle import on_call_start, on_call_complete, UsageRecord, calculate_cost
from .context_fetcher import TenantContext

async def entrypoint(ctx: JobContext):
    call_info = sip_handler.extract_call_info(ctx)
    context: Optional[TenantContext] = None

    # --- Fetch tenant context (providers + pricing live from API) ---
    try:
        context = await context_fetcher.fetch(call_info.tenant_id)
    except Exception as e:
        logger.error("Failed to fetch context for tenant=%s: %s", call_info.tenant_id, e)
        # Context fetch failure = can't run agent. Still log call start/end.

    # --- Register call start (non-fatal) ---
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
    lead_id_from_call: Optional[str] = None
    actions_taken: List[str] = []

    # Track raw usage counts during the call — pipeline updates these
    stt_seconds: float = 0.0      # updated by STT handler
    llm_tokens: int = 0            # updated by LLM handler
    tts_characters: int = 0        # updated by TTS handler

    try:
        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
        # ... build and run voice pipeline (A04/A05/A06) ...
        # Pipeline callbacks must update stt_seconds, llm_tokens, tts_characters
        outcome = "completed"

    except Exception as e:
        logger.exception("Error during call for tenant=%s: %s", call_info.tenant_id, e)
        outcome = "error"

    finally:
        duration = int(time.monotonic() - call_start_time)

        # --- Build usage records with cost calculated from context pricing ---
        usage_records: List[UsageRecord] = []

        if context:
            stt = context.providers.stt
            llm = context.providers.llm
            tts = context.providers.tts

            if stt and stt_seconds > 0:
                usage_records.append(UsageRecord(
                    provider_id=stt.provider_id,
                    provider_type="STT",
                    usage_quantity=stt_seconds,
                    usage_unit="seconds",
                    estimated_cost=calculate_cost(stt_seconds, stt),
                    # e.g. 90s × $0.0000716/s = $0.006444
                ))

            if llm and llm_tokens > 0:
                usage_records.append(UsageRecord(
                    provider_id=llm.provider_id,
                    provider_type="LLM",
                    usage_quantity=float(llm_tokens),
                    usage_unit="tokens",
                    estimated_cost=calculate_cost(float(llm_tokens), llm),
                    # e.g. 1200 tokens × $0.00000015/token = $0.00018
                ))

            if tts and tts_characters > 0:
                usage_records.append(UsageRecord(
                    provider_id=tts.provider_id,
                    provider_type="TTS",
                    usage_quantity=float(tts_characters),
                    usage_unit="characters",
                    estimated_cost=calculate_cost(float(tts_characters), tts),
                    # e.g. 850 chars × $0.00001/char = $0.0085
                ))

        # --- Finalize call (ALWAYS runs — even on errors) ---
        await on_call_complete(
            call_sid=call_info.call_sid,
            duration_seconds=duration,
            outcome=outcome,
            lead_id=lead_id_from_call,
            actions_taken=actions_taken,
            usage_records=usage_records,
        )

        await ctx.room.disconnect()
```

**Important**: The pipeline handlers (A04 STT, A05 LLM, A06 TTS) must increment `stt_seconds`, `llm_tokens`, and `tts_characters` as the call runs. Pass these as mutable containers or use a shared state object. The exact pattern depends on the LiveKit pipeline callback API used in those sprints.

---

## Task 5: Integration Test

After both backend and agent code are running, test a full call lifecycle with cost tracking:

```bash
AGENT_KEY=$(grep VOICE_AGENT_KEY /var/www/lead360.app/api/.env | cut -d= -f2)
TENANT_ID="get-from-db"

# 1. Get provider IDs
curl -s "http://localhost:8000/api/v1/internal/voice-ai/tenant/$TENANT_ID/context" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" | jq '.providers | {
    stt_id: .stt.provider_id,
    stt_cost_per_unit: .stt.cost_per_unit,
    llm_id: .llm.provider_id,
    tts_id: .tts.provider_id
  }'

# 2. Simulate a complete call lifecycle
TEST_SID="test-lifecycle-$(date +%s)"

curl -s -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/start \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_id\":\"$TENANT_ID\",\"call_sid\":\"$TEST_SID\",\"from_number\":\"+15551234567\",\"to_number\":\"+15559999999\"}" | jq .

# 3. Complete with real-looking usage (120s call, 800 tokens, 600 chars)
curl -s -X POST "http://localhost:8000/api/v1/internal/voice-ai/calls/$TEST_SID/complete" \
  -H "X-Voice-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"call_sid\": \"$TEST_SID\",
    \"duration_seconds\": 120,
    \"outcome\": \"completed\",
    \"usage_records\": [
      {\"provider_id\": \"STT_UUID\", \"provider_type\": \"STT\", \"usage_quantity\": 120.0, \"usage_unit\": \"seconds\", \"estimated_cost\": 0.008592},
      {\"provider_id\": \"LLM_UUID\", \"provider_type\": \"LLM\", \"usage_quantity\": 800.0, \"usage_unit\": \"tokens\", \"estimated_cost\": 0.00012},
      {\"provider_id\": \"TTS_UUID\", \"provider_type\": \"TTS\", \"usage_quantity\": 600.0, \"usage_unit\": \"characters\", \"estimated_cost\": 0.006}
    ]
  }" | jq .

# 4. Verify usage records in DB
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Should appear in admin call logs with estimated costs
curl -s "http://localhost:8000/api/v1/system/voice-ai/call-logs?search=$TEST_SID" \
  -H "Authorization: Bearer $TOKEN" | jq '.[0] | {call_sid, outcome, duration_seconds}'
```

---

## Acceptance Criteria

- [ ] `calculate_cost()` uses `provider.cost_per_unit` from context — NO hardcoded rates
- [ ] `calculate_cost()` returns `None` with a warning log when provider has no pricing configured
- [ ] `on_call_start()` posts to `/api/v1/internal/voice-ai/calls/start` with correct payload
- [ ] `on_call_start()` returns `call_log_id` from response
- [ ] `on_call_complete()` posts to `/api/v1/internal/voice-ai/calls/{call_sid}/complete` (call_sid in URL, not body)
- [ ] `on_call_complete()` sends all 3 usage records (STT + LLM + TTS) with `estimated_cost` calculated
- [ ] Both functions are non-fatal: exceptions logged, never re-raised
- [ ] `on_call_complete()` is called in `finally` block — **executes even on pipeline errors**
- [ ] `A03 ProviderConfig` has `cost_per_unit: Optional[float]` and `cost_unit: Optional[str]` fields
- [ ] Duration calculated from wall clock (`time.monotonic()`)
- [ ] Outcome values correct: `completed`, `transferred`, `voicemail`, `abandoned`, `error`
- [ ] Integration test: call complete endpoint returns 200 and usage records appear in DB with non-null `estimated_cost`