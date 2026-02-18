"""
LLM builder for the Lead360 Voice AI agent.

Provides:
  - build_llm(): creates a configured OpenAI LLM instance from TenantContext
"""
import logging
from typing import Optional

from livekit.plugins import openai

from .context import TenantContext

logger = logging.getLogger(__name__)


def build_llm(context: TenantContext) -> Optional[openai.LLM]:
    """Build a configured OpenAI LLM plugin from tenant context.

    Args:
        context: TenantContext from Lead360 internal API.

    Returns:
        A configured openai.LLM instance, or None if no LLM provider
        is configured for this tenant.
    """
    if not context.providers.llm:
        logger.error(
            "No LLM provider configured for tenant=%s", context.tenant.id
        )
        return None

    llm_cfg = context.providers.llm

    if llm_cfg.provider_key != "openai":
        logger.warning(
            "Non-OpenAI LLM provider '%s' not yet supported, falling back to OpenAI",
            llm_cfg.provider_key,
        )

    # Prefer model from provider config, fall back to cost-optimised default
    model = llm_cfg.config.get("model", "gpt-4o-mini")
    temperature = llm_cfg.config.get("temperature", 0.7)
    max_tokens = llm_cfg.config.get("max_tokens", 500)

    logger.info(
        "Building LLM for tenant=%s model=%s",
        context.tenant.id,
        model,
    )

    return openai.LLM(
        model=model,
        api_key=llm_cfg.api_key,
        temperature=temperature,
        max_completion_tokens=max_tokens,
    )
