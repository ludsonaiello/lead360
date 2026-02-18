"""OpenAI LLM provider — implemented in Sprint A05."""
import logging
from typing import Any

from livekit.plugins import openai

from agent.providers.base import BaseLLMProvider, ProviderContext

logger = logging.getLogger(__name__)


class OpenAILLMProvider(BaseLLMProvider):
    """OpenAI Language Model provider.

    Builds a livekit-plugins-openai LLM instance using the API key and
    model configuration resolved from TenantContext.providers.llm.
    """

    @property
    def provider_key(self) -> str:
        return "openai"

    def build(self, context: ProviderContext) -> Any:
        """Build a LiveKit-compatible OpenAI LLM instance.

        Args:
            context: Provider context (api_key, config) from
                TenantContext.providers.llm.  The api_key has already
                been decrypted by NestJS before delivery.

        Returns:
            An openai.LLM instance compatible with livekit_agents.llm.LLM.
        """
        model = context.config.get("model", "gpt-4o-mini")
        temperature = context.config.get("temperature", 0.7)
        max_tokens = context.config.get("max_tokens", 500)

        logger.info(
            "Building OpenAI LLM: provider_key=%s model=%s",
            self.provider_key,
            model,
        )

        return openai.LLM(
            model=model,
            api_key=context.api_key,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )
