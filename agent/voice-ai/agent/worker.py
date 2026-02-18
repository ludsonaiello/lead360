import asyncio
import json
import logging
import time
from typing import Optional, List

from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, AgentSession
from livekit.plugins import silero

from .config import get_config
from .context import context_fetcher, TenantContext
from .sip_handler import extract_call_info
from .stt import build_stt
from .llm import build_llm
from .tts import build_tts
from .prompt_builder import build_system_prompt
from .voice_agent import VoiceAIAgent
from .lifecycle import on_call_start, on_call_complete, UsageRecord, calculate_cost

logger = logging.getLogger(__name__)


class CallUsageTracker:
    """
    Mutable usage counters updated by pipeline callbacks during a call.

    Each provider increments its counter as work is done:
      stt_seconds    — incremented by STT events (speech duration)
      llm_tokens     — incremented by LLM usage events (prompt + completion)
      tts_characters — incremented by TTS events (characters synthesised)
    """

    def __init__(self) -> None:
        self.stt_seconds: float = 0.0
        self.llm_tokens: int = 0
        self.tts_characters: int = 0


async def entrypoint(ctx: JobContext):
    """Main entrypoint for each call."""
    logger.info("New job received: room=%s", ctx.room.name)

    # Extract call information from job metadata
    metadata: dict = {}
    if ctx.job.metadata:
        try:
            metadata = json.loads(ctx.job.metadata)
        except json.JSONDecodeError:
            metadata = {"raw": ctx.job.metadata}

    call_info = extract_call_info(metadata)

    if not call_info:
        # No tenant can be resolved — can't log this call, just reject it
        logger.error("Cannot determine tenant for call, hanging up")
        await ctx.room.disconnect()
        return

    logger.info(
        "Processing call for tenant=%s, callSid=%s",
        call_info.tenant_id,
        call_info.call_sid,
    )

    # --- Fetch tenant context (non-fatal — call start/end still logged) ---
    context: Optional[TenantContext] = None
    try:
        context = await context_fetcher.fetch(call_info.tenant_id)
    except Exception as e:
        logger.exception(
            "Failed to fetch context for tenant=%s, call_sid=%s: %s",
            call_info.tenant_id,
            call_info.call_sid,
            e,
        )

    # --- Register call start immediately after context fetch (always) ---
    # Per sprint A09: on_call_start is called before any business logic checks
    # so that rejected and error calls are still logged in Lead360.
    call_log_id = await on_call_start(
        tenant_id=call_info.tenant_id,
        call_sid=call_info.call_sid,
        from_number=call_info.from_number,
        to_number=call_info.to_number,
        stt_provider_id=context.providers.stt.provider_id if context and context.providers.stt else None,
        llm_provider_id=context.providers.llm.provider_id if context and context.providers.llm else None,
        tts_provider_id=context.providers.tts.provider_id if context and context.providers.tts else None,
    )

    # Usage counters — updated by pipeline event callbacks during the call
    usage = CallUsageTracker()
    call_start_time = time.monotonic()
    outcome = "abandoned"
    actions_taken: List[str] = []

    try:
        # --- Business logic checks — return inside try so finally always runs ---

        if context is None:
            logger.error(
                "No context available for tenant=%s, call_sid=%s — rejecting call",
                call_info.tenant_id,
                call_info.call_sid,
            )
            outcome = "error"
            return  # finally runs on_call_complete

        if not context.behavior.is_enabled:
            logger.warning(
                "Voice AI disabled for tenant=%s, call_sid=%s",
                call_info.tenant_id,
                call_info.call_sid,
            )
            outcome = "abandoned"
            return  # finally runs on_call_complete

        if context_fetcher.is_quota_exceeded_hard(context):
            logger.warning(
                "Quota exceeded (no overage) for tenant=%s, call_sid=%s",
                call_info.tenant_id,
                call_info.call_sid,
            )
            outcome = "abandoned"
            return  # finally runs on_call_complete

        logger.info(
            "Context loaded for tenant=%s (%s), call_sid=%s, quota: %d/%d min",
            call_info.tenant_id,
            context.tenant.company_name,
            call_info.call_sid,
            context.quota.minutes_used,
            context.quota.minutes_included,
        )

        await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

        # Build pipeline components
        stt = build_stt(context)
        llm = build_llm(context)
        tts = build_tts(context)

        if not all([stt, llm, tts]):
            logger.error(
                "Failed to build pipeline for tenant=%s, call_sid=%s",
                call_info.tenant_id,
                call_info.call_sid,
            )
            outcome = "error"
            return  # finally runs on_call_complete

        # Build system prompt
        system_prompt = build_system_prompt(context)

        # Create agent session with pipeline components (livekit-agents 0.8.x / 1.x API)
        session = AgentSession(
            vad=silero.VAD.load(),
            stt=stt,
            llm=llm,
            tts=tts,
        )

        # --- Hook into session usage events ---
        # livekit-agents emits 'metrics_collected' with per-turn usage data.
        # We accumulate totals here so they're available in the finally block.
        @session.on("metrics_collected")
        def _on_metrics(metrics) -> None:
            try:
                # AgentMetrics / MultimodalMetrics objects expose usage attributes.
                # The exact attribute names depend on the livekit-agents minor version;
                # we access them defensively so new SDK versions don't crash the agent.
                llm_usage = getattr(metrics, "llm", None) or getattr(metrics, "llm_metrics", None)
                if llm_usage is not None:
                    tokens = getattr(llm_usage, "total_tokens", None) or (
                        (getattr(llm_usage, "prompt_tokens", 0) or 0)
                        + (getattr(llm_usage, "completion_tokens", 0) or 0)
                    )
                    usage.llm_tokens += int(tokens or 0)

                tts_usage = getattr(metrics, "tts", None) or getattr(metrics, "tts_metrics", None)
                if tts_usage is not None:
                    chars = getattr(tts_usage, "characters_count", None) or getattr(tts_usage, "char_count", None)
                    usage.tts_characters += int(chars or 0)

                stt_usage = getattr(metrics, "stt", None) or getattr(metrics, "stt_metrics", None)
                if stt_usage is not None:
                    secs = getattr(stt_usage, "audio_duration", None) or getattr(stt_usage, "duration", None)
                    usage.stt_seconds += float(secs or 0.0)
            except Exception as metric_err:
                logger.debug("metrics_collected parse error (non-fatal): %s", metric_err)

        # Agent with LLM function tools (create_lead, book_appointment)
        agent = VoiceAIAgent(
            instructions=system_prompt,
            tenant_id=call_info.tenant_id,
            call_sid=call_info.call_sid,
            call_log_id=call_log_id,
        )

        # Start the agent session in the room
        await session.start(agent, room=ctx.room)

        # Greet the caller (brief pause for SIP connection to stabilise)
        await asyncio.sleep(1)
        session.say(context.behavior.greeting, allow_interruptions=True)

        # Wait for max call duration, then disconnect
        await asyncio.sleep(context.behavior.max_call_duration_seconds)
        logger.info(
            "Max call duration reached for tenant=%s, call_sid=%s",
            call_info.tenant_id,
            call_info.call_sid,
        )
        outcome = "completed"

    except Exception as e:
        logger.exception(
            "Error during call for tenant=%s, call_sid=%s: %s",
            call_info.tenant_id,
            call_info.call_sid,
            e,
        )
        outcome = "error"

    finally:
        duration = int(time.monotonic() - call_start_time)

        # If session-level metrics gave us no STT data, fall back to call duration
        # (every second of the call had audio going through STT).
        if usage.stt_seconds == 0.0 and duration > 0:
            usage.stt_seconds = float(duration)

        # --- Build usage records with cost calculated from context pricing ---
        usage_records: List[UsageRecord] = []

        if context:
            stt_prov = context.providers.stt
            llm_prov = context.providers.llm
            tts_prov = context.providers.tts

            if stt_prov and usage.stt_seconds > 0:
                usage_records.append(UsageRecord(
                    provider_id=stt_prov.provider_id,
                    provider_type="STT",
                    usage_quantity=usage.stt_seconds,
                    usage_unit="seconds",
                    estimated_cost=calculate_cost(usage.stt_seconds, stt_prov),
                ))

            if llm_prov and usage.llm_tokens > 0:
                usage_records.append(UsageRecord(
                    provider_id=llm_prov.provider_id,
                    provider_type="LLM",
                    usage_quantity=float(usage.llm_tokens),
                    usage_unit="tokens",
                    estimated_cost=calculate_cost(float(usage.llm_tokens), llm_prov),
                ))

            if tts_prov and usage.tts_characters > 0:
                usage_records.append(UsageRecord(
                    provider_id=tts_prov.provider_id,
                    provider_type="TTS",
                    usage_quantity=float(usage.tts_characters),
                    usage_unit="characters",
                    estimated_cost=calculate_cost(float(usage.tts_characters), tts_prov),
                ))

        # --- Finalise call log (ALWAYS runs — even on pipeline errors) ---
        await on_call_complete(
            call_sid=call_info.call_sid,
            duration_seconds=duration,
            outcome=outcome,
            actions_taken=actions_taken if actions_taken else None,
            usage_records=usage_records if usage_records else None,
        )

        await ctx.room.disconnect()


def run() -> None:
    """Start the LiveKit worker."""
    cfg = get_config()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            api_key=cfg.LIVEKIT_API_KEY,
            api_secret=cfg.LIVEKIT_API_SECRET,
            ws_url=cfg.LIVEKIT_URL,
        )
    )
