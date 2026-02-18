from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import get_config

logger = logging.getLogger(__name__)


async def check_availability(
    tenant_id: str,
    call_log_id: str,
    service_type: Optional[str] = None,
    preferred_date: Optional[str] = None,
) -> dict:
    """
    Fetch 3 mocked appointment slots from the backend.

    The backend generates slots based on preferred_date (or tomorrow if not provided):
      - slot_1: base date at 09:00
      - slot_2: next business day at 13:00
      - slot_3: business day after that at 16:00

    Returns a dict:
        - slots: list[dict]  — each has slot_id, date, time, label
        - error: str         — only present on failure

    Never raises — all errors are caught and returned as error dicts so the agent
    can continue the call gracefully.
    """
    cfg = get_config()
    url = (
        f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/check_availability"
    )
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {"call_log_id": call_log_id}
    if service_type is not None:
        payload["service_type"] = service_type
    if preferred_date is not None:
        payload["preferred_date"] = preferred_date

    try:
        async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(
                "check_availability: tenant=%s, slots=%d",
                tenant_id,
                len(data.get("slots", [])),
            )
            return data

    except httpx.TimeoutException as e:
        logger.error(
            "check_availability timed out for tenant=%s: %s",
            tenant_id,
            e,
        )
        return {"slots": [], "error": "timeout"}

    except httpx.HTTPStatusError as e:
        logger.error(
            "check_availability HTTP error: status=%d, tenant=%s",
            e.response.status_code,
            tenant_id,
        )
        return {"slots": [], "error": f"HTTP {e.response.status_code}"}

    except Exception as e:
        logger.error(
            "check_availability unexpected error: tenant=%s: %s",
            tenant_id,
            e,
        )
        return {"slots": [], "error": str(e)}
