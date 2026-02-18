import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from agent.actions.create_lead import create_lead_from_call
from agent.actions.book_appointment import book_appointment
from agent.actions.check_availability import check_availability
from agent.actions.transfer_call import transfer_call


# ===========================================================================
# create_lead_from_call tests
# ===========================================================================


@pytest.mark.asyncio
async def test_create_lead_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
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
async def test_create_lead_existing_returns_created_false():
    """Backend returns 200 with created=false when lead already exists for the phone number."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"lead_id": "lead-existing", "created": False}
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


@pytest.mark.asyncio
async def test_create_lead_with_email_sends_field():
    """Email field is included in payload when provided."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"lead_id": "lead-1", "created": True}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        post_mock = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value.post = post_mock
        await create_lead_from_call(
            tenant_id="t1",
            call_log_id="log-1",
            phone_number="+15551234567",
            email="test@example.com",
        )

    payload = post_mock.call_args.kwargs["json"]
    assert payload.get("email") == "test@example.com"


# ===========================================================================
# book_appointment tests
# ===========================================================================


@pytest.mark.asyncio
async def test_book_appointment_success():
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {
        "appointment_id": "appt-1",
        "status": "pending",
        "appointment_date": "2026-03-02",
        "appointment_time": "09:00",
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            return_value=mock_response
        )
        result = await book_appointment(
            tenant_id="t1",
            call_log_id="log-1",
            slot_id="slot_1",
            preferred_date="2026-03-02",
            service_type="Plumbing",
        )

    assert result["appointment_id"] == "appt-1"
    assert result["status"] == "pending"
    assert result["appointment_date"] == "2026-03-02"


@pytest.mark.asyncio
async def test_book_appointment_timeout_retries_and_returns_error():
    import httpx
    from agent.config import get_config

    max_retries = get_config().HTTP_MAX_RETRIES  # default 2 → 3 total attempts

    post_mock = AsyncMock(side_effect=httpx.TimeoutException("timed out"))

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = post_mock
        with patch("agent.actions.book_appointment.asyncio.sleep", new_callable=AsyncMock):
            result = await book_appointment(
                tenant_id="t1",
                call_log_id="log-1",
                slot_id="slot_1",
                preferred_date="2026-03-02",
            )

    assert result["appointment_id"] is None
    assert "error" in result
    # Verify all retry attempts were made
    assert post_mock.call_count == max_retries + 1


@pytest.mark.asyncio
async def test_book_appointment_http_error_returns_error_dict():
    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "server error", request=MagicMock(), response=mock_response
            )
        )
        result = await book_appointment(
            tenant_id="t1",
            call_log_id="log-1",
            slot_id="slot_1",
            preferred_date="2026-03-02",
        )

    assert result["appointment_id"] is None
    assert "error" in result
    assert "500" in result["error"]


@pytest.mark.asyncio
async def test_book_appointment_sends_slot_id_and_preferred_date():
    """slot_id and preferred_date must always be included in the payload."""
    mock_response = MagicMock()
    mock_response.status_code = 201
    mock_response.json.return_value = {
        "appointment_id": "appt-2",
        "status": "pending",
        "appointment_date": "2026-04-01",
        "appointment_time": "13:00",
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        post_mock = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value.post = post_mock
        await book_appointment(
            tenant_id="t1",
            call_log_id="log-1",
            slot_id="slot_2",
            preferred_date="2026-04-01",
            lead_id="lead-42",
            service_type="HVAC",
            service_description="AC unit not cooling",
            notes="Urgent repair needed",
        )

    payload = post_mock.call_args.kwargs["json"]

    assert payload.get("slot_id") == "slot_2"
    assert payload.get("preferred_date") == "2026-04-01"
    assert payload.get("lead_id") == "lead-42"
    assert payload.get("service_type") == "HVAC"
    assert payload.get("service_description") == "AC unit not cooling"
    assert payload.get("notes") == "Urgent repair needed"


# ===========================================================================
# check_availability tests
# ===========================================================================


@pytest.mark.asyncio
async def test_check_availability_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "slots": [
            {"slot_id": "slot_1", "date": "2026-03-02", "time": "09:00", "label": "Mon Mar 2, 9:00 AM"},
            {"slot_id": "slot_2", "date": "2026-03-03", "time": "13:00", "label": "Tue Mar 3, 1:00 PM"},
            {"slot_id": "slot_3", "date": "2026-03-04", "time": "16:00", "label": "Wed Mar 4, 4:00 PM"},
        ]
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        result = await check_availability(
            tenant_id="t1",
            call_log_id="log-1",
            service_type="Plumbing",
        )

    assert len(result["slots"]) == 3
    assert result["slots"][0]["slot_id"] == "slot_1"
    assert result["slots"][1]["slot_id"] == "slot_2"
    assert result["slots"][2]["slot_id"] == "slot_3"
    assert "error" not in result


@pytest.mark.asyncio
async def test_check_availability_timeout_returns_error():
    import httpx

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.TimeoutException("timeout")
        )
        result = await check_availability(
            tenant_id="t1",
            call_log_id="log-1",
        )

    assert result["slots"] == []
    assert "error" in result
    assert result["error"] == "timeout"


@pytest.mark.asyncio
async def test_check_availability_http_error():
    import httpx

    mock_response = MagicMock()
    mock_response.status_code = 500

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.HTTPStatusError(
                "server error", request=MagicMock(), response=mock_response
            )
        )
        result = await check_availability(
            tenant_id="t1",
            call_log_id="log-1",
        )

    assert result["slots"] == []
    assert "500" in result["error"]


@pytest.mark.asyncio
async def test_check_availability_sends_optional_fields():
    """preferred_date and service_type are included in payload when provided."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"slots": []}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        post_mock = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value.post = post_mock
        await check_availability(
            tenant_id="t1",
            call_log_id="log-1",
            service_type="Electrical",
            preferred_date="2026-05-01",
        )

    payload = post_mock.call_args.kwargs["json"]
    assert payload.get("service_type") == "Electrical"
    assert payload.get("preferred_date") == "2026-05-01"


# ===========================================================================
# transfer_call tests
# ===========================================================================


@pytest.mark.asyncio
async def test_transfer_call_success():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"success": True, "phone_number": "+15551234567"}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        result = await transfer_call(
            tenant_id="t1",
            call_log_id="log-1",
        )

    assert result["success"] is True
    assert result["phone_number"] == "+15551234567"
    assert "error" not in result


@pytest.mark.asyncio
async def test_transfer_call_no_number_configured():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"success": False, "phone_number": ""}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(return_value=mock_response)
        result = await transfer_call(
            tenant_id="t1",
            call_log_id="log-1",
        )

    assert result["success"] is False
    assert result["phone_number"] == ""


@pytest.mark.asyncio
async def test_transfer_call_timeout_returns_error():
    import httpx

    with patch("httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.post = AsyncMock(
            side_effect=httpx.TimeoutException("timeout")
        )
        result = await transfer_call(
            tenant_id="t1",
            call_log_id="log-1",
        )

    assert result["success"] is False
    assert result["phone_number"] == ""
    assert result["error"] == "timeout"


@pytest.mark.asyncio
async def test_transfer_call_with_specific_number_id():
    """transfer_number_id is included in payload when provided."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"success": True, "phone_number": "+15559876543"}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client:
        post_mock = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value.post = post_mock
        result = await transfer_call(
            tenant_id="t1",
            call_log_id="log-1",
            transfer_number_id="tn-uuid-123",
        )

    payload = post_mock.call_args.kwargs["json"]
    assert payload.get("transfer_number_id") == "tn-uuid-123"
    assert result["success"] is True
