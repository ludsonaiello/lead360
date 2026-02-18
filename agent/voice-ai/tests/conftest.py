"""
Test configuration for the voice-ai agent.

Sets up required environment variables before any agent modules are imported,
and resets the config singleton between tests so each test starts clean.
"""
import os

# Set required env vars BEFORE any agent module imports happen.
# Using setdefault so real env vars (e.g. on CI) are not overridden.
os.environ.setdefault("LIVEKIT_URL", "wss://test.livekit.cloud")
os.environ.setdefault("LIVEKIT_API_KEY", "APItest000000000")
os.environ.setdefault("LIVEKIT_API_SECRET", "test-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
os.environ.setdefault("VOICE_AGENT_KEY", "test-voice-agent-key-00000000")
os.environ.setdefault("LEAD360_API_BASE_URL", "http://localhost:8000")

import pytest
import agent.config as _agent_config


@pytest.fixture(autouse=True)
def reset_config_singleton():
    """Reset the config singleton before each test so env changes take effect."""
    _agent_config._config = None
    yield
    _agent_config._config = None
