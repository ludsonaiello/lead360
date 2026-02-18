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

        sip_uri = None

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
            sip_uri=sip_uri if "sip_uri" in job_metadata else None,
        )

    except Exception as e:
        logger.exception("Error extracting call info: %s", e)
        return None
