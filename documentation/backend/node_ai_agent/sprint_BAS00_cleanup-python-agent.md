# Sprint BAS00 — Cleanup: Remove Python LiveKit Agent

**Module**: Voice AI
**Sprint**: BAS00
**Depends on**: None — this is the FIRST sprint, must run before all others
**Estimated size**: 0 files created, shell commands only

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANYTHING you:
- Read every path before deleting or modifying it
- NEVER guess what is safe to remove — verify with `ls` and `cat`
- DO NOT remove core Python system packages or system-wide pip packages
- ONLY remove LiveKit-specific packages and the voice-ai agent folder
- Verify each step with confirmation commands before moving on

---

## Objective

Remove the Python-based LiveKit voice agent that runs as a separate process. The new architecture runs the voice agent **inside the NestJS API** (Node.js). This sprint clears the old Python implementation without touching Python itself, system packages, or any other Python-based services on this shared server.

**CRITICAL**: This is a SHARED SERVER. Python may be used by other services. Only remove LiveKit-related agent installations. DO NOT run `pip uninstall` for packages that are not explicitly LiveKit agent plugins.

---

## Pre-Coding Checklist

- [ ] Confirm the agent folder exists: `ls /var/www/lead360.app/agent/`
- [ ] Confirm no PM2 processes are running the Python agent (check before killing)
- [ ] Read the pyproject.toml to understand what packages are installed
- [ ] Verify Python system version with `python3 --version` (do not touch it)
- [ ] Confirm the NestJS API is running and healthy before making changes

**Dev server check**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `/var/www/lead360.app/agent/voice-ai/pyproject.toml` | Understand what packages are installed — read before removing anything |
| `/var/www/lead360.app/agent/voice-ai/.env` | Note which env vars exist — the NestJS module needs some of these values in `voice_ai_global_config` |
| `/var/www/lead360.app/agent/voice-ai/agent/main.py` | Understand entrypoint — verify what's being removed |

---

## Task 1: Stop the Python Agent Process (if running)

```bash
# Check if any Python/LiveKit agent is running under PM2
pm2 list

# If there is a voice-ai or livekit-agent process:
pm2 stop voice-ai-agent     # use the actual process name from pm2 list
pm2 delete voice-ai-agent   # remove from PM2 registry
pm2 save                     # persist the change

# Also check for raw Python processes
ps aux | grep "voice_ai\|livekit\|main.py" | grep -v grep
# Kill any matching processes:
# kill <PID>
```

---

## Task 2: Note Environment Variables for Migration

Before deleting anything, record the values from `/var/www/lead360.app/agent/voice-ai/.env` that the NestJS module needs stored in `voice_ai_global_config`:

```bash
cat /var/www/lead360.app/agent/voice-ai/.env
```

**Values to note** (will be stored in the database via the Admin UI or seed script in BAS07):
- `LIVEKIT_URL` → maps to `voice_ai_global_config.livekit_url` (column name in schema)
- `LIVEKIT_API_KEY` → maps to `voice_ai_global_config.livekit_api_key`
- `LIVEKIT_API_SECRET` → maps to `voice_ai_global_config.livekit_api_secret`
- `VOICE_AGENT_KEY` → maps to `voice_ai_global_config.agent_api_key_hash` (hashed)

Write these down — you will enter them in the database through the admin API in BAS08.

---

## Task 3: Remove the LiveKit Virtual Environment

The Python agent uses a virtual environment (`.venv`) inside the agent folder. Remove it:

```bash
# Verify the venv exists and belongs to the agent folder
ls /var/www/lead360.app/agent/voice-ai/.venv/

# Remove only the virtual environment (isolated — does NOT affect system Python)
rm -rf /var/www/lead360.app/agent/voice-ai/.venv

# Verify system Python is unaffected
python3 --version
pip3 --version
```

---

## Task 4: Remove the Agent Folder

```bash
# List contents one final time to confirm what you're removing
ls -la /var/www/lead360.app/agent/voice-ai/

# Remove the entire voice-ai agent folder
rm -rf /var/www/lead360.app/agent/voice-ai

# Verify the parent agent folder is now empty (or has other unrelated content)
ls /var/www/lead360.app/agent/
```

If `/var/www/lead360.app/agent/` is now empty, you may optionally remove it:

```bash
# Only if empty
rmdir /var/www/lead360.app/agent/ 2>/dev/null && echo "Removed empty agent dir" || echo "Agent dir not empty — leaving it"
```

---

## Task 5: Verify NestJS API Unaffected

The NestJS API has its own `voice-ai` module that communicates with the Python agent via HTTP. After removing the agent, the NestJS API should still start (it will just fail gracefully on internal agent calls until BAS19 replaces the agent with a NestJS worker).

```bash
cd /var/www/lead360.app/api
npm run build
```

**Expected**: Build passes with 0 errors. If there are import errors related to `voice-ai`, read the failing file and fix the missing dependency — do NOT guess.

---

## Task 6: Verify No System Python Packages Were Touched

```bash
# Confirm system-wide livekit packages are gone (they were in the venv, not system)
pip3 list 2>/dev/null | grep -i livekit || echo "No system livekit packages — GOOD"

# Confirm other Python tools still work
python3 -c "import json; print('Python OK')"
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| (none) | DELETE | `/var/www/lead360.app/agent/voice-ai/` — entire folder |
| (none) | STOP | PM2 process for Python voice agent |

No NestJS or Next.js files are touched in this sprint.

---

## Acceptance Criteria

- [ ] `/var/www/lead360.app/agent/voice-ai/` folder no longer exists
- [ ] No PM2 process named after the Python agent is running (`pm2 list` shows nothing voice-ai related)
- [ ] `python3 --version` still works — system Python untouched
- [ ] No system-wide `livekit-agents` package in `pip3 list`
- [ ] `cd /var/www/lead360.app/api && npm run build` passes with 0 errors
- [ ] LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET, VOICE_AGENT_KEY values recorded for BAS08

---

## Testing

```bash
# After cleanup, verify API still starts
cd /var/www/lead360.app/api && npm run start:dev

# Should see NestJS boot logs with no Python-agent errors
# VoiceAI module internal endpoints will return errors until BAS19 (expected)
```

---

## Notes for Next Sprint

The values you noted from `agent/voice-ai/.env` in Task 2 will be entered into the database via the admin API endpoint `PATCH /api/v1/system/voice-ai/config` in BAS08. Keep them in a secure notepad until then.
