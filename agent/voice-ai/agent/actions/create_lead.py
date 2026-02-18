from __future__ import annotations

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
    email: Optional[str] = None,
    notes: Optional[str] = None,
    service_type: Optional[str] = None,
) -> dict:
    """
    Create a lead from a call, or find the existing lead if one already exists for
    the caller's phone number.

    Returns a dict:
        - lead_id: str | None
        - created: bool         (False if lead existed or on error)
        - error: str            (only present on failure)

    Never raises — all errors are caught and returned as error dicts so the agent
    can continue the call gracefully.
    """
    cfg = get_config()
    url = (
        f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/create_lead"
    )
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {
        "call_log_id": call_log_id,
        "phone_number": phone_number,
    }
    if first_name is not None:
        payload["first_name"] = first_name
    if last_name is not None:
        payload["last_name"] = last_name
    if email is not None:
        payload["email"] = email
    if notes is not None:
        payload["notes"] = notes
    if service_type is not None:
        payload["service_type"] = service_type

    try:
        async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(
                "create_lead: lead_id=%s, created=%s, tenant=%s",
                data.get("lead_id"),
                data.get("created"),
                tenant_id,
            )
            return data

    except httpx.TimeoutException as e:
        logger.error(
            "create_lead timed out for tenant=%s, phone=%s: %s",
            tenant_id,
            phone_number,
            e,
        )
        return {"lead_id": None, "error": str(e)}

    except httpx.HTTPStatusError as e:
        logger.error(
            "create_lead HTTP error: status=%d, tenant=%s, phone=%s",
            e.response.status_code,
            tenant_id,
            phone_number,
        )
        return {"lead_id": None, "error": f"HTTP {e.response.status_code}"}

    except Exception as e:
        logger.error(
            "create_lead unexpected error: tenant=%s, phone=%s: %s",
            tenant_id,
            phone_number,
            e,
        )
        return {"lead_id": None, "error": str(e)}
