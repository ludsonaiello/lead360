"""
System prompt builder for the Lead360 Voice AI agent.

Constructs a rich, context-aware system prompt from the TenantContext
returned by the Lead360 internal API.
"""
from .context import TenantContext


def build_system_prompt(context: TenantContext) -> str:
    """Build a rich system prompt from tenant context.

    Args:
        context: TenantContext fetched from Lead360 internal API.
            The greeting field is already pre-resolved (e.g. '{business_name}'
            is substituted by the NestJS context builder before delivery).

    Returns:
        A complete system prompt string ready to be injected as the
        'system' message in the LLM chat context.
    """
    c = context

    # Services list
    services_text = ""
    if c.services:
        services_list = "\n".join(
            f"- {s.name}: {s.description or ''}" for s in c.services
        )
        services_text = f"\n\nSERVICES YOU OFFER:\n{services_list}"

    # Service areas (cap at 10 to avoid prompt bloat)
    areas_text = ""
    if c.service_areas:
        areas = [
            f"{a.value}{', ' + a.state if a.state else ''}"
            for a in c.service_areas[:10]
        ]
        areas_text = "\n\nSERVICE AREAS:\n" + ", ".join(areas)

    # Transfer numbers — only include if transfer is enabled
    transfer_text = ""
    if c.transfer_numbers and c.behavior.transfer_enabled:
        numbers = [f"{t.label}: {t.phone_number}" for t in c.transfer_numbers]
        transfer_text = "\n\nTRANSFER NUMBERS:\n" + "\n".join(numbers)

    # Available actions — derived from behavior flags
    actions = []
    if c.behavior.lead_creation_enabled:
        actions.append(
            "- collect_lead_info: When a caller provides their name, phone, or service need"
        )
    if c.behavior.booking_enabled:
        actions.append(
            "- book_appointment: When a caller wants to schedule a service visit"
        )
    if c.behavior.transfer_enabled and c.transfer_numbers:
        actions.append(
            "- request_transfer: When caller needs to speak with a human"
        )

    actions_text = ""
    if actions:
        actions_text = "\n\nYOU CAN:\n" + "\n".join(actions)

    # Custom tenant instructions
    custom_text = ""
    if c.behavior.custom_instructions:
        custom_text = f"\n\nSPECIAL INSTRUCTIONS:\n{c.behavior.custom_instructions}"

    prompt = f"""You are a phone assistant for {c.tenant.company_name}.
Be friendly, professional, and concise. You are on a phone call — keep responses SHORT (1-3 sentences max per turn).
Do NOT use markdown, bullet points, or formatting in your speech.

Your greeting: "{c.behavior.greeting}"

{services_text}{areas_text}{transfer_text}{actions_text}{custom_text}

IMPORTANT RULES:
- ALWAYS confirm appointments before booking them
- If asked about pricing, say you can provide a free estimate and offer to book a visit
- If it is an emergency (e.g., flooding, gas leak), immediately offer to transfer to emergency line
- Maximum call duration: {c.behavior.max_call_duration_seconds // 60} minutes
- If unsure about something, say "I'll have our team follow up with you" rather than guessing
- Speak naturally — you are a phone assistant, not a chatbot

Language: Respond in {c.behavior.language.upper()}"""

    return prompt
