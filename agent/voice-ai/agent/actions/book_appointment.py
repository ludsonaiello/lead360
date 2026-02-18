from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx

from ..config import get_config

logger = logging.getLogger(__name__)


async def book_appointment(
    tenant_id: str,
    call_log_id: str,
    slot_id: str,
    preferred_date: str,
    lead_id: Optional[str] = None,
    service_type: Optional[str] = None,
    service_description: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict:
    """
    Book an appointment tied to a call.

    The appointment is stored as a pending service request that tenant staff
    can review and confirm.

    Returns a dict:
        - appointment_id: str | None
        - status: str               ("pending" on success)
        - error: str                (only present on failure)

    Never raises — all errors are caught and returned as error dicts so the agent
    can continue the call gracefully.
    """
    cfg = get_config()
    url = (
        f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/book_appointment"
    )
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {
        "call_log_id": call_log_id,
        "slot_id": slot_id,
        "preferred_date": preferred_date,
    }
    if lead_id is not None:
        payload["lead_id"] = lead_id
    if service_type is not None:
        payload["service_type"] = service_type
    if service_description is not None:
        payload["service_description"] = service_description
    if notes is not None:
        payload["notes"] = notes

    async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
        for attempt in range(cfg.HTTP_MAX_RETRIES + 1):
            try:
                response = await client.post(url, json=payload, headers=headers)
                response.raise_for_status()
                result = response.json()
                logger.info(
                    "Appointment booked: appointment_id=%s, tenant=%s, lead=%s",
                    result.get("appointment_id"),
                    tenant_id,
                    lead_id,
                )
                return result

            except httpx.TimeoutException:
                if attempt < cfg.HTTP_MAX_RETRIES:
                    await asyncio.sleep(1)
                    continue
                logger.error(
                    "book_appointment timed out after %d attempts for tenant=%s",
                    cfg.HTTP_MAX_RETRIES + 1,
                    tenant_id,
                )
                return {"appointment_id": None, "status": "error", "error": "timeout"}

            except httpx.HTTPStatusError as e:
                logger.error(
                    "book_appointment HTTP error: status=%d, tenant=%s",
                    e.response.status_code,
                    tenant_id,
                )
                return {
                    "appointment_id": None,
                    "status": "error",
                    "error": f"HTTP {e.response.status_code}",
                }

            except Exception as e:
                logger.exception(
                    "book_appointment unexpected error for tenant=%s: %s", tenant_id, e
                )
                return {"appointment_id": None, "status": "error", "error": str(e)}

    return {"appointment_id": None, "status": "error", "error": "max_retries_exceeded"}
