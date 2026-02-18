YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A10 — Tests + Deployment

**Module**: Voice AI Python Agent  
**Sprint**: A10  
**Depends on**: A01-A09 all complete

---

## Objective

Write unit tests for the critical agent components and create deployment artifacts (Dockerfile, docker-compose).

---

## Pre-Coding Checklist

- [ ] A01-A09 complete
- [ ] `pytest` and `pytest-asyncio` installed
- [ ] Backend running at `http://localhost:8000` for integration verification

**DO NOT USE PM2** — run tests with: `cd /agent/voice-ai && pytest`

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: Context Fetcher Tests

`/agent/voice-ai/tests/test_context.py`:

```python
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
    mock_response.json.return_value = MOCK_CONTEXT_RESPONSE
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
    mock_response.json.return_value = MOCK_CONTEXT_RESPONSE
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
```

---

## Task 2: Actions Tests

`/agent/voice-ai/tests/test_actions.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.actions.create_lead import create_lead_from_call
from agent.actions.book_appointment import book_appointment


@pytest.mark.asyncio
async def test_create_lead_success():
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {"lead_id": "lead-1", "created": True}
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        result = await create_lead_from_call(
            tenant_id="t1",
            call_log_id="log-1",
            phone_number="+15551234567",
            first_name="John",
        )
    
    assert result["lead_id"] == "lead-1"
    assert result["created"] is True


@pytest.mark.asyncio
async def test_create_lead_409_handled_gracefully():
    mock_response = MagicMock()
    mock_response.status_code = 409
    mock_response.json.return_value = {"lead_id": "lead-existing", "message": "Lead exists"}
    mock_response.raise_for_status = MagicMock()
    
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        result = await create_lead_from_call(
            tenant_id="t1",
            call_log_id="log-1",
            phone_number="+15551234567",
        )
    
    assert result["lead_id"] == "lead-existing"
    assert result["created"] is False


@pytest.mark.asyncio
async def test_create_lead_timeout_returns_error_dict():
    import httpx
    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.TimeoutException("timeout")
        )
        result = await create_lead_from_call(
            tenant_id="t1",
            call_log_id="log-1",
            phone_number="+15551234567",
        )
    
    assert result["lead_id"] is None
    assert "error" in result
    # Should NOT raise exception
```

---

## Task 3: Dockerfile

`/agent/voice-ai/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
COPY requirements.txt* .

RUN pip install --no-cache-dir -r requirements.txt 2>/dev/null || pip install --no-cache-dir .

COPY agent/ ./agent/

CMD ["python", "-m", "agent.main"]
```

---

## Task 4: docker-compose for Local Dev

`/agent/voice-ai/docker-compose.yml`:

```yaml
version: "3.8"
services:
  voice-ai-agent:
    build: .
    environment:
      - LIVEKIT_URL=${LIVEKIT_URL}
      - LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
      - LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
      - LEAD360_API_BASE_URL=http://host.docker.internal:8000
      - VOICE_AGENT_KEY=${VOICE_AGENT_KEY}
    network_mode: bridge
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
```

---

## Running Tests

```bash
cd /var/www/lead360.app/agent/voice-ai
pip install pytest pytest-asyncio
pytest tests/ -v
```

---

## Acceptance Criteria

- [ ] All 6 test cases in `test_context.py` pass
- [ ] All 3 test cases in `test_actions.py` pass
- [ ] 409 handling verified: no exception raised, lead_id returned
- [ ] Timeout handling verified: returns error dict, no exception
- [ ] `Dockerfile` builds without errors
- [ ] `docker-compose.yml` is valid
- [ ] `pytest` runs and all tests pass
