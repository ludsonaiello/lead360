"""
VoiceAIAgent — Agent subclass with LLM function tools.

Registered tools (livekit-agents 1.x @function_tool API):
  - save_lead:           collect caller info and find/create a CRM lead
  - check_availability:  get 3 appointment slots from the backend
  - book_appointment:    book the chosen slot (creates service_request)
  - transfer_call:       look up and execute a SIP call transfer
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

from livekit.agents import Agent, function_tool

from .actions.create_lead import create_lead_from_call
from .actions.check_availability import check_availability as _check_availability_action
from .actions.book_appointment import book_appointment as _book_appointment_action
from .actions.transfer_call import transfer_call as _transfer_call_action

logger = logging.getLogger(__name__)


class VoiceAIAgent(Agent):
    """
    Agent subclass that holds per-call context and exposes LLM function tools.

    tenant_id          — resolved at call start from SIP metadata
    call_log_id        — set by lifecycle.on_call_start() in Sprint A09; None until then
    _lead_id           — set after save_lead succeeds; used by book_appointment
    _available_slots   — set after check_availability; used to confirm slot selection
    """

    def __init__(
        self,
        *,
        instructions: str,
        tenant_id: str,
        call_sid: str,
        call_log_id: Optional[str] = None,
    ) -> None:
        super().__init__(instructions=instructions)
        self.tenant_id = tenant_id
        self.call_sid = call_sid
        # Set by lifecycle once /calls/start responds (Sprint A09).
        # Tools fall back gracefully when this is None.
        self.call_log_id: Optional[str] = call_log_id

        # Session state — updated as the call progresses
        self._lead_id: Optional[str] = None
        self._available_slots: Optional[list] = None
        self._transfer_phone_number: Optional[str] = None

    # ------------------------------------------------------------------
    # LLM function tools — auto-discovered by livekit-agents via
    # @function_tool on instance methods.
    # ------------------------------------------------------------------

    @function_tool
    async def save_lead(
        self,
        phone_number: Annotated[str, "Caller's phone number (E.164 format, e.g. +15551234567)"],
        first_name: Annotated[Optional[str], "Caller's first name"] = None,
        last_name: Annotated[Optional[str], "Caller's last name"] = None,
        email: Annotated[Optional[str], "Caller's email address"] = None,
        notes: Annotated[Optional[str], "Reason for the call or service needed"] = None,
        service_type: Annotated[Optional[str], "Type of service requested (e.g. Plumbing, HVAC)"] = None,
    ) -> str:
        """
        Save the caller's information to the CRM.

        Call this when you have collected the caller's phone number and optionally
        their name, email, the service they need, and any notes about the call.
        Always call this before book_appointment so the appointment is linked to the lead.

        Returns a confirmation message. The lead_id is stored internally for use
        by subsequent tools in this call.
        """
        call_log_id = self.call_log_id or self.call_sid

        logger.info(
            "save_lead tool called: tenant=%s, call_sid=%s, phone=%s",
            self.tenant_id,
            self.call_sid,
            phone_number,
        )

        result = await create_lead_from_call(
            tenant_id=self.tenant_id,
            call_log_id=call_log_id,
            phone_number=phone_number,
            first_name=first_name,
            last_name=last_name,
            email=email,
            notes=notes,
            service_type=service_type,
        )

        if result.get("error"):
            logger.error(
                "save_lead tool error: tenant=%s, call_sid=%s, error=%s",
                self.tenant_id,
                self.call_sid,
                result["error"],
            )
            return (
                "I'm sorry, I wasn't able to save your information right now. "
                "Our team will follow up with you shortly."
            )

        self._lead_id = result.get("lead_id")
        created = result.get("created", True)

        logger.info(
            "save_lead tool success: tenant=%s, call_sid=%s, lead_id=%s, created=%s",
            self.tenant_id,
            self.call_sid,
            self._lead_id,
            created,
        )

        if created:
            return "Your information has been saved. I now have your details on file."
        return "I found your existing account in our system."

    @function_tool
    async def check_availability(
        self,
        service_type: Annotated[Optional[str], "Type of service requested"] = None,
        preferred_date: Annotated[
            Optional[str], "Caller's preferred date in YYYY-MM-DD format"
        ] = None,
    ) -> str:
        """
        Check available appointment slots for the requested service.

        Call this when the caller wants to schedule an appointment and you need
        to offer them time options. Returns 3 available slots with day and time.
        After presenting the slots, ask the caller which one works best, then
        call book_appointment with the chosen slot_id and the preferred_date.
        """
        call_log_id = self.call_log_id or self.call_sid

        logger.info(
            "check_availability tool called: tenant=%s, call_sid=%s, service=%s, date=%s",
            self.tenant_id,
            self.call_sid,
            service_type,
            preferred_date,
        )

        result = await _check_availability_action(
            tenant_id=self.tenant_id,
            call_log_id=call_log_id,
            service_type=service_type,
            preferred_date=preferred_date,
        )

        if result.get("error") or not result.get("slots"):
            logger.error(
                "check_availability tool error: tenant=%s, call_sid=%s, error=%s",
                self.tenant_id,
                self.call_sid,
                result.get("error"),
            )
            return (
                "I'm sorry, I wasn't able to check availability right now. "
                "Our team will call you back to schedule a time."
            )

        self._available_slots = result["slots"]

        slots = result["slots"]
        lines = [
            f"  {i + 1}. {slot['label']} — option {slot['slot_id']}"
            for i, slot in enumerate(slots)
        ]

        logger.info(
            "check_availability tool success: tenant=%s, call_sid=%s, slots=%d",
            self.tenant_id,
            self.call_sid,
            len(slots),
        )

        return (
            "I have these times available:\n"
            + "\n".join(lines)
            + "\nWhich one works best for you?"
        )

    @function_tool
    async def book_appointment(
        self,
        slot_id: Annotated[
            str,
            "The slot ID chosen by the caller: slot_1 (first option), slot_2 (second option), or slot_3 (third option)",
        ],
        preferred_date: Annotated[
            str,
            "The base date used in check_availability, in YYYY-MM-DD format",
        ],
        service_description: Annotated[
            Optional[str], "Description of the service or problem"
        ] = None,
        service_type: Annotated[Optional[str], "Type of service requested"] = None,
        notes: Annotated[Optional[str], "Any additional notes"] = None,
    ) -> str:
        """
        Book the appointment slot chosen by the caller.

        Call this after check_availability, once the caller has confirmed which slot
        they want. Use the same preferred_date that was passed to check_availability.
        The lead_id is automatically used if save_lead was called earlier in this call.

        Returns a confirmation with the booked date and time.
        """
        call_log_id = self.call_log_id or self.call_sid

        logger.info(
            "book_appointment tool called: tenant=%s, call_sid=%s, slot=%s, date=%s",
            self.tenant_id,
            self.call_sid,
            slot_id,
            preferred_date,
        )

        result = await _book_appointment_action(
            tenant_id=self.tenant_id,
            call_log_id=call_log_id,
            slot_id=slot_id,
            preferred_date=preferred_date,
            lead_id=self._lead_id,
            service_type=service_type,
            service_description=service_description,
            notes=notes,
        )

        if result.get("error") or result.get("status") == "error":
            logger.error(
                "book_appointment tool error: tenant=%s, call_sid=%s, error=%s",
                self.tenant_id,
                self.call_sid,
                result.get("error"),
            )
            return (
                "I'm sorry, I wasn't able to confirm your appointment right now. "
                "Our team will follow up with you to arrange a suitable time."
            )

        appt_date = result.get("appointment_date", "")
        appt_time = result.get("appointment_time", "")

        logger.info(
            "book_appointment tool success: tenant=%s, call_sid=%s, appointment_id=%s, %s %s",
            self.tenant_id,
            self.call_sid,
            result.get("appointment_id"),
            appt_date,
            appt_time,
        )

        if appt_date and appt_time:
            return (
                f"Your appointment has been booked for {appt_date} at {appt_time}. "
                "You'll receive a confirmation from our team shortly."
            )
        return (
            "Your appointment request has been received. "
            "Someone from our team will confirm the details with you shortly."
        )

    @function_tool
    async def transfer_call(
        self,
        transfer_number_id: Annotated[
            Optional[str], "Specific transfer number ID if known; leave empty to use the default"
        ] = None,
    ) -> str:
        """
        Transfer the caller to a live team member.

        Call this when the caller explicitly asks to speak with a person, or when
        the conversation requires human intervention. The backend looks up the
        tenant's transfer phone number and the call is routed to that number.

        Returns a message to say to the caller while the transfer is initiated.
        """
        call_log_id = self.call_log_id or self.call_sid

        logger.info(
            "transfer_call tool called: tenant=%s, call_sid=%s, transfer_number_id=%s",
            self.tenant_id,
            self.call_sid,
            transfer_number_id,
        )

        result = await _transfer_call_action(
            tenant_id=self.tenant_id,
            call_log_id=call_log_id,
            transfer_number_id=transfer_number_id,
            lead_id=self._lead_id,
        )

        if not result.get("success"):
            logger.warning(
                "transfer_call: no transfer number available for tenant=%s, call_sid=%s",
                self.tenant_id,
                self.call_sid,
            )
            return (
                "I'm sorry, I'm unable to transfer your call at this time. "
                "Please call back during business hours and a team member will assist you."
            )

        phone_number = result.get("phone_number", "")
        self._transfer_phone_number = phone_number

        logger.info(
            "transfer_call tool success: tenant=%s, call_sid=%s, transferring to %s",
            self.tenant_id,
            self.call_sid,
            phone_number,
        )

        return "I'm transferring you to a team member now. Please hold for just a moment."
