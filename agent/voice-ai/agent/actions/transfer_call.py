from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import get_config

logger = logging.getLogger(__name__)


async def transfer_call(
    tenant_id: str,
    call_log_id: str,
    transfer_number_id: Optional[str] = None,
    lead_id: Optional[str] = None,
) -> dict:
    """
    Look up the phone number to transfer the call to.

    The backend returns the tenant's default transfer number (or a specific one
    if transfer_number_id is provided).

    Returns a dict:
        - success: bool
        - phone_number: str    — E.164 format (e.g. "+15551234567"), empty if not found
        - error: str           — only present on unexpected failure

    Never raises — all errors are caught and returned as error dicts so the agent
    can continue the call gracefully.
    """
    cfg = get_config()
    url = (
        f"{cfg.LEAD360_API_BASE_URL}/api/v1/internal/voice-ai/tenant/{tenant_id}/tools/transfer_call"
    )
    headers = {
        "X-Voice-Agent-Key": cfg.VOICE_AGENT_KEY,
        "Content-Type": "application/json",
    }
    payload: dict = {"call_log_id": call_log_id}
    if transfer_number_id is not None:
        payload["transfer_number_id"] = transfer_number_id
    if lead_id is not None:
        payload["lead_id"] = lead_id

    try:
        async with httpx.AsyncClient(timeout=cfg.HTTP_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
            logger.info(
                "transfer_call: tenant=%s, success=%s, phone=%s",
                tenant_id,
                data.get("success"),
                data.get("phone_number", ""),
            )
            return data

    except httpx.TimeoutException as e:
        logger.error(
            "transfer_call timed out for tenant=%s: %s",
            tenant_id,
            e,
        )
        return {"success": False, "phone_number": "", "error": "timeout"}

    except httpx.HTTPStatusError as e:
        logger.error(
            "transfer_call HTTP error: status=%d, tenant=%s",
            e.response.status_code,
            tenant_id,
        )
        return {"success": False, "phone_number": "", "error": f"HTTP {e.response.status_code}"}

    except Exception as e:
        logger.error(
            "transfer_call unexpected error: tenant=%s: %s",
            tenant_id,
            e,
        )
        return {"success": False, "phone_number": "", "error": str(e)}
