# Voice AI HTTP API Bridge - Sprint Summary

## Overview

This document outlines the 6 sprints required to fix the Voice AI agent, which currently fails with "Agent service registry not initialized" because the agent runs in a separate child process and cannot access NestJS services.

**Root Cause**: LiveKit AgentServer spawns agents in child processes. The `agentServiceRegistry` is set in the main NestJS process but is `null` in the child process (different memory space).

**Solution**: Replace direct service access with HTTP API calls. The agent will call back to the Lead360 API to get data and perform actions.

---

## Sprint Sequence

| Sprint | Name | Effort | Description |
|--------|------|--------|-------------|
| VAB-01 | Tenant Lookup Endpoint | Small (1-2h) | Create endpoint to look up tenant by phone number |
| VAB-02 | Enhanced Context | Small (1-2h) | Add tenant address/email to context |
| VAB-03 | HTTP Client Utility | Medium (2-3h) | Create HTTP client for agent process |
| VAB-04 | Refactor Entrypoint | Large (3-4h) | Rewrite agent to use HTTP instead of registry |
| VAB-05 | Agent Tools via HTTP | Medium (2-3h) | Add HTTP-based tool execution |
| VAB-06 | Testing & Validation | Medium (2-3h) | End-to-end testing |

**Total Estimated Effort**: 12-17 hours

---

## Sprint Dependencies

```
VAB-01 (Tenant Lookup) ──┐
                         ├──> VAB-03 (HTTP Client) ──> VAB-04 (Refactor) ──> VAB-06 (Testing)
VAB-02 (Enhanced Context)┘                                   │
                                                             v
                                                      VAB-05 (Tools)
```

- VAB-01 and VAB-02 can run in parallel
- VAB-03 requires VAB-01 and VAB-02 to be complete
- VAB-04 requires VAB-03
- VAB-05 requires VAB-04
- VAB-06 requires all previous sprints

---

## Key Changes Summary

### New Files Created

| File | Sprint | Purpose |
|------|--------|---------|
| `dto/internal/lookup-tenant.dto.ts` | VAB-01 | Tenant lookup DTOs |
| `agent/utils/api-config.ts` | VAB-03 | HTTP client config |
| `agent/utils/api-client.ts` | VAB-03 | HTTP client with retry |
| `agent/utils/api-types.ts` | VAB-03 | TypeScript types |
| `agent/utils/agent-api.ts` | VAB-03 | High-level API functions |
| `agent/utils/sip-participant.ts` | VAB-04 | SIP attribute extraction |
| `agent/tools/tool-definitions.ts` | VAB-05 | LLM tool definitions |
| `agent/tools/tool-executor.ts` | VAB-05 | Tool execution logic |

### Modified Files

| File | Sprint | Changes |
|------|--------|---------|
| `services/voice-ai-internal.service.ts` | VAB-01 | Add lookupTenantByPhoneNumber |
| `controllers/internal/voice-ai-internal.controller.ts` | VAB-01 | Add lookup endpoint |
| `interfaces/voice-ai-context.interface.ts` | VAB-02 | Add email, primary_address |
| `services/voice-ai-context-builder.service.ts` | VAB-02 | Include new fields |
| `agent/voice-agent-entrypoint.ts` | VAB-04 | Complete rewrite to HTTP |
| `agent/voice-agent.service.ts` | VAB-04 | Remove setAgentServiceRegistry |

---

## New API Endpoint

### POST /api/v1/internal/voice-ai/lookup-tenant

**Purpose**: Look up tenant by Twilio phone number

**Request**:
```json
{
  "phone_number": "+19788787756"
}
```

**Response (found)**:
```json
{
  "found": true,
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "tenant_name": "Honey Do 4 You",
  "phone_number": "+19788787756"
}
```

**Response (not found)**:
```json
{
  "found": false,
  "phone_number": "+15559999999"
}
```

---

## Enhanced Context Fields

The `/context` endpoint will now include:

```json
{
  "tenant": {
    "id": "uuid",
    "company_name": "Honey Do 4 You",
    "phone": "+19788787756",
    "timezone": "America/New_York",
    "language": "en",
    "business_description": "Home services...",
    "email": "contact@honeydo4you.com",       // NEW
    "primary_address": {                       // NEW
      "street": "123 Main St",
      "city": "Fitchburg",
      "state": "MA",
      "zip": "01420"
    }
  },
  // ... rest unchanged
}
```

---

## Environment Variables Required

```bash
# Add to .env
LEAD360_API_URL=http://localhost:3000
VOICE_AGENT_API_KEY=your-secret-key
VOICE_AGENT_TIMEOUT_MS=10000
VOICE_AGENT_MAX_RETRIES=2
```

---

## New Agent Flow

```
1. LiveKit dispatches job to agent (child process)
2. Agent connects to LiveKit room
3. Agent waits for SIP participant
4. Agent extracts from SIP attributes:
   - sip.trunkPhoneNumber → Twilio number that was called
   - sip.twilio.callSid → Twilio call identifier
   - sip.phoneNumber → Caller's phone number
5. HTTP: POST /lookup-tenant → Get tenant_id from phone number
6. HTTP: GET /tenant/:id/access → Verify quota and enabled
7. HTTP: GET /tenant/:id/context → Load full context
8. HTTP: POST /calls/start → Create call log
9. Run conversation (STT → LLM → TTS)
10. HTTP: POST /calls/:callSid/complete → Finalize call log
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| HTTP latency adds delay | Medium | Low | Use localhost, connection pooling |
| API unreachable | Low | High | Retry logic, graceful failure |
| Wrong phone format | Low | Medium | Validation, normalization |
| Missing env vars | Low | High | Startup validation |

---

## Rollback Plan

If critical issues occur:
1. Revert `voice-agent-entrypoint.ts` to git HEAD~1
2. Revert `voice-agent.service.ts` to restore registry
3. Delete new utility files
4. Rebuild: `npm run build`
5. Restart server

Note: This returns to the broken state ("registry not initialized") but prevents any new issues.

---

## Success Criteria

The Voice AI module is considered **fixed** when:

- [ ] Inbound calls route to Voice AI agent
- [ ] Agent answers with correct business greeting
- [ ] Tenant is identified from phone number via HTTP
- [ ] Context is loaded via HTTP
- [ ] Call logs are created and completed
- [ ] No "registry not initialized" errors
- [ ] No crashes or unhandled errors
- [ ] Graceful handling of error scenarios

---

## Developer Instructions

Each sprint document includes:
- Developer mindset (calm, precise, no guessing)
- Pre-coding checklist
- Step-by-step implementation
- Code samples with comments
- Testing instructions
- Acceptance criteria

**IMPORTANT**: Complete sprints in order. Each sprint builds on the previous one.