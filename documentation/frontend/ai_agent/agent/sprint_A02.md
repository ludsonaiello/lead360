YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A02 — LiveKit Integration + SIP Handler

**Module**: Voice AI Python Agent  
**Sprint**: A02  
**Depends on**: A01a, A01b

---

## Objective

Set up the LiveKit Agents worker that listens for incoming jobs (calls from the SIP trunk) and extracts tenant context from the SIP URI parameters.

---

## Pre-Coding Checklist

- [ ] A01 complete — project structure exists
- [ ] Install dependencies: `pip install -r requirements.txt`
- [ ] Familiarize with LiveKit Agents SDK: https://docs.livekit.io/agents/overview/
- [ ] Backend running at `http://localhost:8000`

**DO NOT USE PM2** — run with: `python -m agent.main`

---

## Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: in `/var/www/lead360.app/api/.env`

---

## Task 1: SIP Handler

`/agent/voice-ai/agent/sip_handler.py`:

```python
import logging
from urllib.parse import urlparse, parse_qs
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)

@dataclass
class SipCallInfo:
    tenant_id: str
    call_sid: str
    from_number: str
    to_number: str
    sip_uri: Optional[str] = None

def extract_call_info(job_metadata: dict) -> Optional[SipCallInfo]:
    """
    Extract tenant and call information from LiveKit job metadata.
    
    LiveKit SIP calls pass parameters via the room name or metadata.
    The SIP URI format is:
    sip:voice-ai@{livekit_sip_url}?tenantId={tenantId}&callSid={callSid}
    
    LiveKit passes this info in the job's metadata or participant attributes.
    """
    try:
        # Try to get from job metadata
        tenant_id = job_metadata.get("tenantId") or job_metadata.get("tenant_id")
        call_sid = job_metadata.get("callSid") or job_metadata.get("call_sid")
        from_number = job_metadata.get("from") or job_metadata.get("from_number", "unknown")
        to_number = job_metadata.get("to") or job_metadata.get("to_number", "unknown")
        
        if not tenant_id:
            # Try to parse from SIP URI if present
            sip_uri = job_metadata.get("sip_uri", "")
            if sip_uri:
                parsed = urlparse(sip_uri)
                params = parse_qs(parsed.query)
                tenant_id = params.get("tenantId", [None])[0]
                call_sid = params.get("callSid", [None])[0]
        
        if not tenant_id:
            logger.error("Cannot extract tenantId from job metadata: %s", job_metadata)
            return None
        
        if not call_sid:
            import uuid
            call_sid = f"synthetic-{uuid.uuid4().hex[:8]}"
            logger.warning("No callSid found, using synthetic: %s", call_sid)
        
        return SipCallInfo(
            tenant_id=tenant_id,
            call_sid=call_sid,
            from_number=from_number,
            to_number=to_number,
            sip_uri=sip_uri if 'sip_uri' in job_metadata else None,
        )
    
    except Exception as e:
        logger.exception("Error extracting call info: %s", e)
        return None
```

---

## Task 2: Worker

`/agent/voice-ai/agent/worker.py`:

```python
import logging
from livekit.agents import AutoSubscribe, JobContext, WorkerOptions, cli, llm
from livekit.agents.voice_assistant import VoiceAssistant

from .config import get_config
from .sip_handler import extract_call_info

logger = logging.getLogger(__name__)

async def entrypoint(ctx: JobContext):
    """Main entrypoint for each call."""
    logger.info("New job received: room=%s", ctx.room.name)

    # Extract call information from job metadata
    metadata = {}
    if ctx.job.metadata:
        import json
        try:
            metadata = json.loads(ctx.job.metadata)
        except json.JSONDecodeError:
            metadata = {"raw": ctx.job.metadata}

    call_info = extract_call_info(metadata)

    if not call_info:
        logger.error("Cannot determine tenant for call, hanging up")
        await ctx.room.disconnect()
        return

    logger.info("Processing call for tenant=%s, callSid=%s",
                call_info.tenant_id, call_info.call_sid)

    # Context loading, STT/LLM/TTS setup will be added in subsequent sprints (A03-A09)
    # For now, just log and disconnect
    logger.info("Call handler placeholder — implement in A03+")
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
    # Future: await run_voice_agent(ctx, call_info)
    await ctx.room.disconnect()


def run():
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
```

---

## Task 3: Update main.py

`/agent/voice-ai/agent/main.py`:

```python
"""Lead360 Voice AI Agent - Main Entry Point"""
import logging
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

def main():
    logger.info("Lead360 Voice AI Agent starting...")
    from .worker import run
    run()

if __name__ == "__main__":
    main()
```

---

## Acceptance Criteria

- [ ] `sip_handler.py` extracts tenantId and callSid from job metadata
- [ ] `sip_handler.py` handles missing callSid gracefully (synthetic ID)
- [ ] `worker.py` starts LiveKit worker with correct credentials
- [ ] `python -m agent.main` starts without errors (will wait for LiveKit connections)
- [ ] Logging shows startup message and job handling
