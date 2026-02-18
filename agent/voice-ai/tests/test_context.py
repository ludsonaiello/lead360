import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from agent.context import ContextFetcher, TenantContext

MOCK_CONTEXT_RESPONSE = {
    "tenant": {"id": "t1", "company_name": "Acme Plumbing", "phone": "+15551234567", "timezone": "America/New_York", "language": "en"},
    "quota": {"minutes_included": 500, "minutes_used": 100, "minutes_remaining": 400, "overage_rate": None, "quota_exceeded": False},
    "behavior": {"is_enabled": True, "language": "en", "greeting": "Hello from Acme!", "custom_instructions": None, "booking_enabled": True, "lead_creation_enabled": True, "transfer_enabled": True, "max_call_duration_seconds": 600},
    "providers": {
        "stt": {"provider_id": "prov-stt-1", "provider_key": "deepgram", "api_key": "dg-key", "config": {"model": "nova-2"}},
        "llm": {"provider_id": "prov-llm-1", "provider_key": "openai", "api_key": "sk-key", "config": {"model": "gpt-4o-mini"}},
        "tts": {"provider_id": "prov-tts-1", "provider_key": "cartesia", "api_key": "ca-key", "config": {}, "voice_id": "voice-1"},
    },
    "services": [{"name": "Plumbing", "description": "All plumbing services"}],
    "service_areas": [{"type": "city", "value": "Miami", "state": "FL"}],
    "transfer_numbers": [{"label": "Main", "phone_number": "+15559999999", "transfer_type": "primary", "is_default": True, "available_hours": None}],
}


@pytest.mark.asyncio
async def test_fetch_context_success():
    fetcher = ContextFetcher()
    mock_response = AsyncMock()
    mock_response.status_code = 200
    # json() is synchronous in httpx — override the AsyncMock child with MagicMock
    mock_response.json = MagicMock(return_value=MOCK_CONTEXT_RESPONSE)
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        context = await fetcher.fetch("tenant-1")

    assert context.tenant.company_name == "Acme Plumbing"
    assert context.quota.minutes_remaining == 400
    assert context.behavior.is_enabled is True


@pytest.mark.asyncio
async def test_context_cache():
    fetcher = ContextFetcher()
    mock_response = AsyncMock()
    mock_response.status_code = 200
    # json() is synchronous in httpx — override the AsyncMock child with MagicMock
    mock_response.json = MagicMock(return_value=MOCK_CONTEXT_RESPONSE)
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)
        # First call: hits API
        context1 = await fetcher.fetch("tenant-1")
        # Second call: should use cache
        context2 = await fetcher.fetch("tenant-1")

    # API should only be called once
    assert mock_client.return_value.__aenter__.return_value.get.call_count == 1
    assert context1.tenant.id == context2.tenant.id


def test_quota_exceeded_hard_no_overage():
    fetcher = ContextFetcher()
    context = TenantContext.model_validate({
        **MOCK_CONTEXT_RESPONSE,
        "quota": {**MOCK_CONTEXT_RESPONSE["quota"], "quota_exceeded": True, "overage_rate": None}
    })
    assert fetcher.is_quota_exceeded_hard(context) is True


def test_quota_exceeded_with_overage_not_hard():
    fetcher = ContextFetcher()
    context = TenantContext.model_validate({
        **MOCK_CONTEXT_RESPONSE,
        "quota": {**MOCK_CONTEXT_RESPONSE["quota"], "quota_exceeded": True, "overage_rate": 0.02}
    })
    assert fetcher.is_quota_exceeded_hard(context) is False
