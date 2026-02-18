"""
Tests for Sprint A09 — lifecycle.py

Covers:
  - calculate_cost() with and without pricing
  - on_call_start() success and failure paths
  - on_call_complete() success and failure paths
  - Non-fatal error behaviour (no re-raise)
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agent.lifecycle import (
    UsageRecord,
    calculate_cost,
    on_call_start,
    on_call_complete,
)
from agent.context import ProviderConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_provider(
    provider_key: str = "deepgram",
    provider_id: str = "prov-1",
    cost_per_unit: float | None = 0.0000716,
    cost_unit: str | None = "per_second",
) -> ProviderConfig:
    return ProviderConfig(
        provider_id=provider_id,
        provider_key=provider_key,
        api_key="test-key",
        config={},
        cost_per_unit=cost_per_unit,
        cost_unit=cost_unit,
    )


def make_mock_response(status_code: int = 200, body: dict | None = None):
    resp = AsyncMock()
    resp.status_code = status_code
    resp.json = MagicMock(return_value=body or {})
    # raise_for_status is called synchronously in httpx — use MagicMock, not AsyncMock
    if status_code >= 400:
        resp.raise_for_status = MagicMock(side_effect=Exception(f"HTTP {status_code}"))
    else:
        resp.raise_for_status = MagicMock()
    return resp


# ---------------------------------------------------------------------------
# calculate_cost tests
# ---------------------------------------------------------------------------

class TestCalculateCost:
    def test_stt_cost_calculation(self):
        """90 seconds × $0.0000716/s = $0.006444"""
        provider = make_provider(cost_per_unit=0.0000716, cost_unit="per_second")
        result = calculate_cost(90.0, provider)
        assert result is not None
        assert abs(result - 0.006444) < 1e-7

    def test_llm_cost_calculation(self):
        """1200 tokens × $0.00000015/token = $0.00018"""
        provider = make_provider(
            provider_key="openai",
            cost_per_unit=0.00000015,
            cost_unit="per_token",
        )
        result = calculate_cost(1200.0, provider)
        assert result is not None
        assert abs(result - 0.00018) < 1e-9

    def test_tts_cost_calculation(self):
        """850 chars × $0.00001/char = $0.0085"""
        provider = make_provider(
            provider_key="cartesia",
            cost_per_unit=0.00001,
            cost_unit="per_character",
        )
        result = calculate_cost(850.0, provider)
        assert result is not None
        assert abs(result - 0.0085) < 1e-9

    def test_returns_none_when_provider_is_none(self):
        result = calculate_cost(100.0, None)
        assert result is None

    def test_returns_none_when_cost_per_unit_is_none(self):
        provider = make_provider(cost_per_unit=None)
        result = calculate_cost(100.0, provider)
        assert result is None

    def test_zero_usage_returns_zero_cost(self):
        provider = make_provider(cost_per_unit=0.0000716)
        result = calculate_cost(0.0, provider)
        assert result == 0.0

    def test_cost_rounded_to_8_decimal_places(self):
        """Verify precision — cost is rounded to 8 decimal places."""
        provider = make_provider(cost_per_unit=0.0000716)
        result = calculate_cost(1.0, provider)
        # round(1.0 * 0.0000716, 8) = 0.0000716
        assert result == round(1.0 * 0.0000716, 8)


# ---------------------------------------------------------------------------
# on_call_start tests
# ---------------------------------------------------------------------------

class TestOnCallStart:
    @pytest.mark.asyncio
    async def test_success_returns_call_log_id(self):
        mock_resp = make_mock_response(200, {"call_log_id": "log-uuid-123"})
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)

            result = await on_call_start(
                tenant_id="tenant-1",
                call_sid="call-sid-1",
                from_number="+15551234567",
                to_number="+15559999999",
            )

        assert result == "log-uuid-123"

    @pytest.mark.asyncio
    async def test_sends_provider_ids_when_provided(self):
        mock_resp = make_mock_response(200, {"call_log_id": "log-abc"})
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            post_mock = AsyncMock(return_value=mock_resp)
            mock_client.return_value.__aenter__.return_value.post = post_mock

            await on_call_start(
                tenant_id="tenant-1",
                call_sid="call-sid-1",
                from_number="+15551234567",
                to_number="+15559999999",
                stt_provider_id="stt-uuid",
                llm_provider_id="llm-uuid",
                tts_provider_id="tts-uuid",
            )

        _, kwargs = post_mock.call_args
        body = kwargs["json"]
        assert body["stt_provider_id"] == "stt-uuid"
        assert body["llm_provider_id"] == "llm-uuid"
        assert body["tts_provider_id"] == "tts-uuid"

    @pytest.mark.asyncio
    async def test_non_fatal_on_http_error(self):
        """HTTP error must return None, not raise."""
        mock_resp = make_mock_response(500)
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)

            result = await on_call_start(
                tenant_id="tenant-1",
                call_sid="call-sid-1",
                from_number="+15551234567",
                to_number="+15559999999",
            )

        assert result is None

    @pytest.mark.asyncio
    async def test_non_fatal_on_network_error(self):
        """Network exception must return None, not propagate."""
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=Exception("Connection refused")
            )

            result = await on_call_start(
                tenant_id="tenant-1",
                call_sid="call-sid-1",
                from_number="+15551234567",
                to_number="+15559999999",
            )

        assert result is None


# ---------------------------------------------------------------------------
# on_call_complete tests
# ---------------------------------------------------------------------------

class TestOnCallComplete:
    @pytest.mark.asyncio
    async def test_success_with_usage_records(self):
        mock_resp = make_mock_response(200, {})
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            post_mock = AsyncMock(return_value=mock_resp)
            mock_client.return_value.__aenter__.return_value.post = post_mock

            records = [
                UsageRecord("stt-id", "STT", 90.0, "seconds", 0.006444),
                UsageRecord("llm-id", "LLM", 1200.0, "tokens", 0.00018),
                UsageRecord("tts-id", "TTS", 850.0, "characters", 0.0085),
            ]
            await on_call_complete(
                call_sid="call-sid-1",
                duration_seconds=90,
                outcome="completed",
                usage_records=records,
            )

        _, kwargs = post_mock.call_args
        body = kwargs["json"]
        assert body["call_sid"] == "call-sid-1"
        assert body["duration_seconds"] == 90
        assert body["outcome"] == "completed"
        assert len(body["usage_records"]) == 3
        assert body["usage_records"][0]["estimated_cost"] == 0.006444

    @pytest.mark.asyncio
    async def test_call_sid_in_url_path_and_body(self):
        """call_sid must appear in the URL path (authoritative) AND in the body (confirmation)."""
        mock_resp = make_mock_response(200, {})
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            post_mock = AsyncMock(return_value=mock_resp)
            mock_client.return_value.__aenter__.return_value.post = post_mock

            await on_call_complete(
                call_sid="my-call-sid",
                duration_seconds=30,
                outcome="completed",
            )

        url = post_mock.call_args[0][0]
        body = post_mock.call_args[1]["json"]
        assert "my-call-sid" in url          # path param is authoritative
        assert body["call_sid"] == "my-call-sid"  # body confirmation per contract

    @pytest.mark.asyncio
    async def test_omits_none_estimated_cost(self):
        """Records without estimated_cost must not send null — the key is omitted."""
        mock_resp = make_mock_response(200, {})
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            post_mock = AsyncMock(return_value=mock_resp)
            mock_client.return_value.__aenter__.return_value.post = post_mock

            records = [UsageRecord("stt-id", "STT", 60.0, "seconds", estimated_cost=None)]
            await on_call_complete(
                call_sid="call-sid-1",
                duration_seconds=60,
                outcome="completed",
                usage_records=records,
            )

        body = post_mock.call_args[1]["json"]
        assert "estimated_cost" not in body["usage_records"][0]

    @pytest.mark.asyncio
    async def test_non_fatal_on_http_error(self):
        """HTTP error must not raise — teardown must always complete."""
        mock_resp = make_mock_response(500)
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_resp)

            # Must not raise
            await on_call_complete(
                call_sid="call-sid-1",
                duration_seconds=30,
                outcome="error",
            )

    @pytest.mark.asyncio
    async def test_non_fatal_on_network_error(self):
        """Network exception must not propagate from on_call_complete."""
        with patch("agent.lifecycle.get_config") as mock_cfg, \
             patch("httpx.AsyncClient") as mock_client:
            mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
            mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
            mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
            mock_client.return_value.__aenter__.return_value.post = AsyncMock(
                side_effect=Exception("Connection refused")
            )

            # Must not raise
            await on_call_complete(
                call_sid="call-sid-1",
                duration_seconds=30,
                outcome="abandoned",
            )

    @pytest.mark.asyncio
    async def test_valid_outcome_values(self):
        """All contract-defined outcome values are accepted."""
        valid_outcomes = ["completed", "transferred", "voicemail", "abandoned", "error"]
        mock_resp = make_mock_response(200, {})

        for outcome in valid_outcomes:
            with patch("agent.lifecycle.get_config") as mock_cfg, \
                 patch("httpx.AsyncClient") as mock_client:
                mock_cfg.return_value.LEAD360_API_BASE_URL = "http://localhost:8000"
                mock_cfg.return_value.VOICE_AGENT_KEY = "test-key"
                mock_cfg.return_value.HTTP_TIMEOUT_SECONDS = 10.0
                post_mock = AsyncMock(return_value=mock_resp)
                mock_client.return_value.__aenter__.return_value.post = post_mock

                await on_call_complete(
                    call_sid=f"call-{outcome}",
                    duration_seconds=10,
                    outcome=outcome,
                )

                body = post_mock.call_args[1]["json"]
                assert body["outcome"] == outcome
