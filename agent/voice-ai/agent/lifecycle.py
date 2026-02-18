"""
Sprint A09 — Call Lifecycle (Start/Complete Hooks + Cost Calculation)

Provides:
  - UsageRecord:       per-provider billing record sent to /calls/:callSid/complete
  - calculate_cost():  computes estimated_cost from context provider pricing
  - on_call_start():   registers call start with Lead360; returns call_log_id
  - on_call_complete(): finalises call log with usage data (always non-fatal)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional, List

import httpx

from .config import get_config
from .context import ProviderConfig

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class UsageRecord:
    """Per-provider usage for billing. Sent to /calls/:callSid/complete."""
    provider_id: str
    provider_type: str        # STT | LLM | TTS
    usage_quantity: float     # seconds (STT), tokens (LLM), characters (TTS)
    usage_unit: str           # 'seconds' | 'tokens' | 'characters'
    estimated_cost: Optional[float] = None  # USD — calculated from provider cost_per_unit


# ---------------------------------------------------------------------------
# Cost calculator — uses live rates from context, NEVER hardcoded
# ---------------------------------------------------------------------------

def calculate_cost(
    usage_quantity: float,
    provider: Optional[ProviderConfig],
) -> Optional[float]:
    """
    Calculate estimated cost in USD for a provider usage quantity.

    Uses cost_per_unit and cost_unit from the provider's context (set by
    Lead360 admin via the Admin UI → Voice AI → Providers → Edit).
    Returns None if provider is missing or has no pricing configured.

    Examples (from context, not hardcoded here):
        STT:  90 seconds  × $0.0000716/second  = $0.006444
        LLM:  1200 tokens × $0.00000015/token  = $0.00018
        TTS:  850 chars   × $0.00001/character = $0.0085

    NEVER add hardcoded rates here — Lead360 admin updates pricing in the UI
    when providers change their rates, and the agent must always use live values.
    """
    if provider is None:
        return None

    if provider.cost_per_unit is None:
        logger.warning(
            "Provider %s (%s) has no cost_per_unit configured — "
            "estimated_cost will be null. "
            "Update pricing in Lead360 admin: Voice AI → Providers → Edit.",
            provider.provider_key,
            provider.provider_id,
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


# ---------------------------------------------------------------------------
# Call lifecycle functions
# ---------------------------------------------------------------------------

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
    Register call start with Lead360. Returns call_log_id (UUID string).

    Non-fatal: on any failure, logs the error and returns None.
    The call continues normally — it just won't be logged.
    """
    cfg = get_config()
    url = f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/calls/start"
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {
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
            call_log_id: Optional[str] = result.get("call_log_id")
            logger.info(
                "Call started: tenant=%s, callSid=%s, call_log_id=%s",
                tenant_id,
                call_sid,
                call_log_id,
            )
            return call_log_id
    except Exception as e:
        logger.error(
            "Failed to register call start (non-fatal): tenant=%s, callSid=%s, error=%s",
            tenant_id,
            call_sid,
            e,
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
    Finalise call log with usage data.

    Non-fatal: exceptions are logged and never re-raised so the
    finally block in worker.py always completes cleanly.

    call_sid goes in the URL path AND the request body per the API contract.
    usage_records must include estimated_cost calculated from context pricing.

    Valid outcome values: completed | transferred | voicemail | abandoned | error
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
        "outcome": outcome,
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
                call_sid,
                outcome,
                duration_seconds,
                len(usage_records or []),
            )
    except Exception as e:
        logger.error(
            "Failed to register call complete (non-fatal): callSid=%s, error=%s",
            call_sid,
            e,
        )
        # Intentionally not re-raising — this function must never block teardown
