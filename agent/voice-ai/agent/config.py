import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass
class AgentConfig:
    # LiveKit
    LIVEKIT_URL: str
    LIVEKIT_API_KEY: str
    LIVEKIT_API_SECRET: str

    # Lead360 Internal API
    LEAD360_API_BASE_URL: str
    VOICE_AGENT_KEY: str

    # HTTP client settings
    HTTP_TIMEOUT_SECONDS: float = 10.0
    HTTP_MAX_RETRIES: int = 2

    # Context cache TTL in seconds
    CONTEXT_CACHE_TTL: int = 60

    # Log level
    LOG_LEVEL: str = "INFO"


def load_config() -> AgentConfig:
    """Load and validate all required environment variables."""
    required = {
        "LIVEKIT_URL": os.environ.get("LIVEKIT_URL"),
        "LIVEKIT_API_KEY": os.environ.get("LIVEKIT_API_KEY"),
        "LIVEKIT_API_SECRET": os.environ.get("LIVEKIT_API_SECRET"),
        "VOICE_AGENT_KEY": os.environ.get("VOICE_AGENT_KEY"),
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    return AgentConfig(
        LIVEKIT_URL=required["LIVEKIT_URL"],
        LIVEKIT_API_KEY=required["LIVEKIT_API_KEY"],
        LIVEKIT_API_SECRET=required["LIVEKIT_API_SECRET"],
        LEAD360_API_BASE_URL=os.getenv("LEAD360_API_BASE_URL", "http://localhost:8000"),
        VOICE_AGENT_KEY=required["VOICE_AGENT_KEY"],
        HTTP_TIMEOUT_SECONDS=float(os.getenv("HTTP_TIMEOUT_SECONDS", "10.0")),
        HTTP_MAX_RETRIES=int(os.getenv("HTTP_MAX_RETRIES", "2")),
        CONTEXT_CACHE_TTL=int(os.getenv("CONTEXT_CACHE_TTL", "60")),
        LOG_LEVEL=os.getenv("LOG_LEVEL", "INFO"),
    )


# Module-level singleton — call get_config() anywhere in the codebase
_config: AgentConfig | None = None


def get_config() -> AgentConfig:
    global _config
    if _config is None:
        _config = load_config()
    return _config
