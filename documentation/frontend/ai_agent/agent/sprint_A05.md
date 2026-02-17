YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A05 — OpenAI LLM + System Prompt Builder

**Module**: Voice AI Python Agent  
**Sprint**: A05  
**Depends on**: A03, A04

---

## Objective

Build the LLM integration using OpenAI via LiveKit Agents SDK, plus the dynamic system prompt builder that creates a rich context-aware prompt for each tenant.

---

## Pre-Coding Checklist

- [ ] A04 complete
- [ ] `livekit-plugins-openai` installed
- [ ] Read context model — understand all fields available for prompt building

**DO NOT USE PM2** — `python -m agent.main`

---

## Task 1: System Prompt Builder

`/agent/voice-ai/agent/prompt_builder.py`:

```python
from .context import TenantContext

def build_system_prompt(context: TenantContext) -> str:
    """Build a rich system prompt from tenant context."""
    
    c = context
    
    # Services list
    services_text = ""
    if c.services:
        services_list = "\n".join(f"- {s.name}: {s.description or ''}" for s in c.services)
        services_text = f"\n\nSERVICES YOU OFFER:\n{services_list}"
    
    # Service areas
    areas_text = ""
    if c.service_areas:
        areas = [f"{a.value}{', ' + a.state if a.state else ''}" for a in c.service_areas[:10]]
        areas_text = f"\n\nSERVICE AREAS:\n" + ", ".join(areas)
    
    # Transfer numbers
    transfer_text = ""
    if c.transfer_numbers and c.behavior.transfer_enabled:
        numbers = [f"{t.label}: {t.phone_number}" for t in c.transfer_numbers]
        transfer_text = f"\n\nTRANSFER NUMBERS:\n" + "\n".join(numbers)
    
    # Available actions
    actions = []
    if c.behavior.lead_creation_enabled:
        actions.append("- collect_lead_info: When a caller provides their name, phone, or service need")
    if c.behavior.booking_enabled:
        actions.append("- book_appointment: When a caller wants to schedule a service visit")
    if c.behavior.transfer_enabled and c.transfer_numbers:
        actions.append("- request_transfer: When caller needs to speak with a human")
    
    actions_text = ""
    if actions:
        actions_text = "\n\nYOU CAN:\n" + "\n".join(actions)
    
    # Custom instructions
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
```

---

## Task 2: LLM Builder

`/agent/voice-ai/agent/llm.py`:

```python
import logging
from typing import Optional
from livekit.plugins import openai

from .context import TenantContext

logger = logging.getLogger(__name__)

def build_llm(context: TenantContext) -> Optional[openai.LLM]:
    """Build configured OpenAI LLM plugin from tenant context."""
    if not context.providers.llm:
        logger.error("No LLM provider configured for tenant=%s", context.tenant.id)
        return None
    
    if context.providers.llm.provider_key != "openai":
        logger.warning("Non-OpenAI LLM provider '%s' not yet supported",
                      context.providers.llm.provider_key)
    
    logger.info("Building LLM for tenant=%s", context.tenant.id)
    
    return openai.LLM(
        model="gpt-4o-mini",  # Cost-optimized for voice calls
        api_key=context.providers.llm.api_key,
    )
```

---

## Task 3: Initial Chat Context

Also create a helper to build the initial chat context with the system prompt:

```python
# In llm.py, add:
from livekit.agents import llm as agents_llm

def build_initial_chat_context(system_prompt: str) -> agents_llm.ChatContext:
    """Build initial chat context with system prompt."""
    return agents_llm.ChatContext().append(
        role="system",
        text=system_prompt,
    )
```

---

## Acceptance Criteria

- [ ] `build_system_prompt(context)` returns complete prompt with services, areas, instructions
- [ ] `{business_name}` in greeting is already resolved (comes pre-resolved from API)
- [ ] `build_llm(context)` returns `openai.LLM` instance with tenant's API key
- [ ] Prompt includes available actions based on `booking_enabled` / `lead_creation_enabled`
- [ ] Custom instructions included when present
- [ ] No hardcoded API keys
