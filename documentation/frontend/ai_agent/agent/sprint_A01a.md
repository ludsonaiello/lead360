YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint A01a — Python Agent: Project Setup

**Module**: Voice AI Python Agent
**Sprint**: A01a
**Depends on**: Nothing (first sprint)

---

## Objective

Bootstrap the Python Voice AI agent project: create the directory structure, package manifest, configuration loader, environment template, placeholder entry point, and gitignore. This sprint establishes the skeleton that every subsequent sprint builds on. No live code runs yet — only the scaffold and config loading are verified.

---

## Pre-Coding Checklist

- [ ] Read `documentation/contracts/ai_agent/voice_ai_contract.md` — understand what the agent does and the two-layer config model
- [ ] Understand that the Python agent is a SEPARATE process from NestJS — it communicates via the internal REST API only
- [ ] Verify the NestJS backend is running: `http://localhost:8000` (needed for integration testing in later sprints)
- [ ] Verify the agent key exists — get it from admin panel (or the `voice_ai_global_config` table):
  ```bash
  # Login and get JWT
  TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)

  # Fetch global config to confirm agent key is set
  curl -s http://localhost:8000/api/v1/system/voice-ai/config \
    -H "Authorization: Bearer $TOKEN" | jq '{has_agent_key: (.agent_key_last4 != null)}'
  ```

**DO NOT USE PM2** — run agent with: `python -m agent.main`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: in `/var/www/lead360.app/api/.env` — never hardcode

---

## Project Location

All work in this sprint is at: `/var/www/lead360.app/agent/voice-ai/`

---

## Task 1: Project Directory Structure

Create this full directory tree. Files marked `(Sprint AXX)` are **empty placeholders** — the file must exist but contains no logic yet:

```
/var/www/lead360.app/agent/voice-ai/
├── agent/
│   ├── __init__.py
│   ├── main.py                    ← Task 5 (placeholder entry point)
│   ├── config.py                  ← Task 3 (this sprint)
│   ├── context.py                 (Sprint A03 — leave empty)
│   ├── lifecycle.py               (Sprint A09 — leave empty)
│   ├── worker.py                  (Sprint A02 — leave empty)
│   ├── sip_handler.py             (Sprint A02 — leave empty)
│   ├── pipeline.py                (Sprint A06 — leave empty)
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                (Sprint A01b — leave empty)
│   │   ├── registry.py            (Sprint A01b — leave empty)
│   │   ├── factory.py             (Sprint A01b — leave empty)
│   │   ├── stt/
│   │   │   ├── __init__.py
│   │   │   └── deepgram.py        (Sprint A04 — leave empty)
│   │   ├── llm/
│   │   │   ├── __init__.py
│   │   │   └── openai.py          (Sprint A05 — leave empty)
│   │   └── tts/
│   │       ├── __init__.py
│   │       └── cartesia.py        (Sprint A06 — leave empty)
│   └── actions/
│       ├── __init__.py
│       ├── base.py                (Sprint A07 — leave empty)
│       ├── create_lead.py         (Sprint A07 — leave empty)
│       ├── book_appointment.py    (Sprint A08 — leave empty)
│       └── transfer_call.py      (Sprint A07 — leave empty)
├── tests/
│   ├── __init__.py
│   ├── test_context.py            (Sprint A10 — leave empty)
│   ├── test_actions.py            (Sprint A10 — leave empty)
│   └── test_providers.py          (Sprint A10 — leave empty)
├── pyproject.toml                 ← Task 2
├── .env.example                   ← Task 4
├── .gitignore                     ← Task 6
└── README.md                      (leave empty for now)
```

All "leave empty" files should contain exactly:
```python
# Implemented in Sprint AXX
```
(Replace AXX with the actual sprint number shown.)

---

## Task 2: pyproject.toml

`/var/www/lead360.app/agent/voice-ai/pyproject.toml`:

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "lead360-voice-ai-agent"
version = "1.0.0"
description = "Lead360 Voice AI Agent using LiveKit Agents SDK"
requires-python = ">=3.11"
dependencies = [
    "livekit-agents>=0.8.0",
    "livekit-plugins-deepgram>=0.6.0",
    "livekit-plugins-openai>=0.8.0",
    "livekit-plugins-cartesia>=0.4.0",
    "httpx>=0.27.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
    "structlog>=24.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "respx>=0.21.0",  # httpx mock library
]
```

Install with: `pip install -e ".[dev]"` from `/agent/voice-ai/`

---

## Task 3: config.py

`/var/www/lead360.app/agent/voice-ai/agent/config.py`:

```python
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
```

**Rules**:
- Import `get_config` everywhere, NEVER the module-level `_config` directly
- `LEAD360_API_BASE_URL` defaults to `http://localhost:8000` — never hardcode
- All other variables require explicit env var — agent fails fast with clear message if missing

---

## Task 4: .env.example

`/var/www/lead360.app/agent/voice-ai/.env.example`:

```env
# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Lead360 Internal API
LEAD360_API_BASE_URL=http://localhost:8000
VOICE_AGENT_KEY=your-voice-agent-api-key-from-admin-panel

# Tuning (optional — these are the defaults)
HTTP_TIMEOUT_SECONDS=10.0
HTTP_MAX_RETRIES=2
CONTEXT_CACHE_TTL=60
LOG_LEVEL=INFO
```

Copy to `.env` and fill in real values. The `.env` file is gitignored.

---

## Task 5: main.py Placeholder

`/var/www/lead360.app/agent/voice-ai/agent/main.py`:

```python
"""Lead360 Voice AI Agent — Main Entry Point

This file is the placeholder entry point for the agent.
Full LiveKit worker is implemented in Sprint A02.
"""
import logging
from agent.config import get_config

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    cfg = get_config()
    logger.info("Lead360 Voice AI Agent starting...")
    logger.info(f"API base: {cfg.LEAD360_API_BASE_URL}")
    logger.info(f"LiveKit URL: {cfg.LIVEKIT_URL}")
    logger.info(f"Context cache TTL: {cfg.CONTEXT_CACHE_TTL}s")
    print("Agent bootstrap complete.")
    print("Provider registry and LiveKit worker are implemented in Sprint A01b and A02.")


if __name__ == "__main__":
    main()
```

---

## Task 6: .gitignore

`/var/www/lead360.app/agent/voice-ai/.gitignore`:

```
.env
__pycache__/
*.pyc
*.pyo
env/
venv/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
.coverage
htmlcov/
```

---

## Verification

After completing all tasks:

```bash
cd /var/www/lead360.app/agent/voice-ai

# Install dependencies
pip install -e ".[dev]"

# Copy and fill env
cp .env.example .env
# Edit .env with real LIVEKIT_* and VOICE_AGENT_KEY values

# Run the placeholder — must exit cleanly with no import errors
python -m agent.main
# Expected output:
# INFO:agent.main:Lead360 Voice AI Agent starting...
# INFO:agent.main:API base: http://localhost:8000
# INFO:agent.main:LiveKit URL: wss://...
# Agent bootstrap complete.

# Verify import works
python -c "from agent.config import get_config; print('config OK')"
python -c "from agent import main; print('main OK')"
```

---

## Acceptance Criteria

- [ ] Project directory structure created at `/agent/voice-ai/` with all subdirectories and `__init__.py` files
- [ ] `providers/stt/`, `providers/llm/`, `providers/tts/` directories exist with `__init__.py`
- [ ] `actions/` directory exists with `__init__.py`
- [ ] `tests/` directory exists with `__init__.py`
- [ ] `pyproject.toml` defines all required dependencies including `livekit-agents`, `httpx`, `pydantic`, `python-dotenv`
- [ ] `config.py` implements `get_config()` singleton — fails fast with clear error if required env vars missing
- [ ] `LEAD360_API_BASE_URL` defaults to `http://localhost:8000` when not set
- [ ] No variable named `LEAD360_API_URL` anywhere — correct name is `LEAD360_API_BASE_URL`
- [ ] `.env.example` documents all 9 environment variables
- [ ] `python -m agent.main` runs without import errors and prints startup messages
- [ ] `.gitignore` excludes `.env`, `__pycache__`, venv directories
