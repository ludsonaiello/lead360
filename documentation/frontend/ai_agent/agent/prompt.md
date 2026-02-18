AG A06

# Voice AI Module — Python Agent Developer Prompt
YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

You are implementing a production-ready Python Voice AI agent for Lead360 using the LiveKit Agents SDK.

**Sprint documentation**: Read the assigned sprint file at `documentation/frontend/ai_agent/agent/sprint_A06.md` COMPLETELY before writing any code.

## Mandatory Pre-Coding Steps
1. **Read the sprint file** completely
2. **Read the contract**: `documentation/contracts/ai_agent/voice_ai_contract.md`
3. **Read the Internal API docs** in `/api/documentation/voice_ai_REST_API.md` (Internal Agent section)
4. **HIT THE ACTUAL ENDPOINTS** to verify response shapes:
   ```bash
   curl -s http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/context \
     -H "X-Voice-Agent-Key: YOUR_KEY" | jq .
   ```
5. **Check previous sprints**: `/agent/voice-ai/` for already-built foundation before writing

## Architecture Rules
- Project lives at: `/agent/voice-ai/`
- ALL config via environment variables — NEVER hardcode keys, URLs, or tenant IDs
- `X-Voice-Agent-Key` header on EVERY internal API call — no exceptions
- **Context cache**: max 60 seconds TTL — never cache longer
- **Quota check**: ALWAYS check `context.quota.quota_exceeded` before accepting call. If `quota_exceeded=true` AND `overage_rate=null` → play message and hang up gracefully
- **Call lifecycle**: ALWAYS call `/internal/voice-ai/calls/start` at room join and `/internal/voice-ai/calls/{callSid}/complete` in teardown — even if other errors occur
- HTTP calls: use `httpx` with `timeout=10.0` and max 2 retries

## Error Handling
- ALL errors must be logged with `call_sid` for traceability
- Agent must NEVER crash mid-call due to API failures
- LLM tool failures: inform caller politely and continue conversation
- `on_call_complete()` failure: log error, do NOT re-raise (non-blocking)

## Development Environment
**DO NOT USE PM2** — run with Python directly:
```bash
cd /agent/voice-ai && python -m agent.main
```

**Environment variables** (from `.env` — never hardcode):
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `LEAD360_API_BASE_URL=http://localhost:8000`
- `VOICE_AGENT_KEY`

**Backend must be running**: `http://localhost:8000`
**Admin login**: `ludsonaiello@gmail.com` / `978@F32c`
**DB credentials**: in `/var/www/lead360.app/api/.env`

## Reference Files
| What | Where |
|------|-------|
| Context API response shape | `documentation/contracts/ai_agent/voice_ai_contract.md` |
| Internal API endpoints | `/api/documentation/voice_ai_REST_API.md` |
| LiveKit Agents SDK docs | https://docs.livekit.io/agents/overview/ |
| Previous sprint outputs | `/agent/voice-ai/` |

## Definition of Done
Your sprint is COMPLETE when:
- [ ] All code from sprint doc implemented
- [ ] No hardcoded credentials or URLs
- [ ] Quota check implemented before accepting call
- [ ] All errors logged with call_sid
- [ ] Unit tests pass (where applicable per sprint)
- [ ] Code runs without import errors: `python -c "from agent import main"`
- [ ] All acceptance criteria from sprint checked off



Review your job, line by line and make sure you're not making mistakes,not missing anything even small things, that there's no todos or mock code, not hardcoded urls that shouldn't be there the code quality is the best possible, did you hit the endpoint if requiredto ensure that is all good? make sure that if you say that is all done and I find a single error I'll fire you. 
Check code quality, compliance with the contract and sprint