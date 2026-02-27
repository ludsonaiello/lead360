# Sprint VAB-06: End-to-End Testing and Validation

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-06  
**Depends on**: VAB-01 through VAB-05  
**Estimated Effort**: Medium (2-3 hours)

---

## Developer Mindset

```
YOU ARE A MASTERCLASS DEVELOPER.

You approach problems with CALM PRECISION.
You DO NOT guess. You DO NOT rush.
You REVIEW existing code patterns before writing new code.
You write PRODUCTION-READY code that follows existing conventions.
You VERIFY your work compiles and runs before marking complete.
You DO NOT forget to test. You DO NOT leave broken code.
Peace. Focus. Excellence.
```

---

## Objective

Perform comprehensive end-to-end testing of the Voice AI HTTP API Bridge to verify:
1. All HTTP endpoints work correctly
2. Agent starts and connects to LiveKit
3. SIP participant attributes are extracted
4. Tenant lookup via HTTP works
5. Context is loaded via HTTP
6. Call logging works
7. Full call flow completes without errors

---

## Pre-Testing Checklist

- [ ] VAB-01 through VAB-05 are complete
- [ ] Project is built: `npm run build`
- [ ] Environment variables are set (see below)
- [ ] LiveKit credentials are configured
- [ ] Twilio phone number is configured
- [ ] Test phone available to make calls

---

## Environment Variables Required

Verify these are set in `.env`:

```bash
# LiveKit Configuration
LIVEKIT_URL=wss://lead360-8owqtn2p.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret

# Voice Agent HTTP Client
LEAD360_API_URL=http://localhost:3000
VOICE_AGENT_API_KEY=your-agent-key
VOICE_AGENT_TIMEOUT_MS=10000
VOICE_AGENT_MAX_RETRIES=2

# Twilio (for reference)
# Configured per tenant in database
```

---

## Test 1: HTTP Endpoint Verification

### 1.1 Tenant Lookup Endpoint

```bash
# Test with configured phone number
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/lookup-tenant \
  -H "X-Voice-Agent-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+19788787756"}'

# Expected:
# {
#   "found": true,
#   "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
#   "tenant_name": "Honey Do 4 You",
#   "phone_number": "+19788787756"
# }

# Test with unknown number
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/lookup-tenant \
  -H "X-Voice-Agent-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+15559999999"}'

# Expected:
# {
#   "found": false,
#   "phone_number": "+15559999999"
# }
```

**Checkpoint**: ☐ Tenant lookup works

### 1.2 Access Check Endpoint

```bash
TENANT_ID="14a34ab2-6f6f-4e41-9bea-c444a304557e"

curl http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/access \
  -H "X-Voice-Agent-Key: YOUR_KEY"

# Expected:
# {
#   "has_access": true,
#   "minutes_remaining": XX,
#   "overage_rate": null
# }
```

**Checkpoint**: ☐ Access check works

### 1.3 Context Endpoint

```bash
TENANT_ID="14a34ab2-6f6f-4e41-9bea-c444a304557e"

curl http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/context \
  -H "X-Voice-Agent-Key: YOUR_KEY" | jq '.tenant'

# Expected: Full tenant object with:
# - company_name
# - phone
# - timezone
# - business_description
# - email (new field)
# - primary_address (new field)
```

**Checkpoint**: ☐ Context includes enhanced tenant data

### 1.4 Call Start Endpoint

```bash
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/calls/start \
  -H "X-Voice-Agent-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "call_sid": "TEST-123",
    "from_number": "+15551234567",
    "to_number": "+19788787756",
    "room_name": "test-room",
    "direction": "inbound"
  }'

# Expected:
# { "call_log_id": "uuid-here" }
```

**Checkpoint**: ☐ Call start works

### 1.5 Call Complete Endpoint

```bash
curl -X POST http://localhost:3000/api/v1/internal/voice-ai/calls/TEST-123/complete \
  -H "X-Voice-Agent-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "duration_seconds": 60,
    "outcome": "test"
  }'

# Expected: 200 OK (empty response or success object)
```

**Checkpoint**: ☐ Call complete works

---

## Test 2: Agent Startup

### 2.1 Start the Server

```bash
cd /var/www/lead360.app/api
npm run start:dev
```

### 2.2 Verify Agent Registration

Look for these log messages:

```
[VoiceAgentService] Starting LiveKit AgentServer: wss://lead360-8owqtn2p.livekit.cloud
[VoiceAgentService] Using voice agent entrypoint: /path/to/voice-agent-entrypoint.mjs
[VoiceAgentService] LiveKit AgentServer started and listening for jobs
```

**Checkpoint**: ☐ Agent starts without errors

### 2.3 Verify No Registry Errors

Confirm you do NOT see:

```
Error: Agent service registry not initialized
```

**Checkpoint**: ☐ No registry errors

---

## Test 3: Live Call Test

### 3.1 Make Test Call

1. Call the Twilio number: **+19788787756**
2. Listen for IVR greeting
3. Select Voice AI option (press 1 or say "AI")
4. Wait for agent to answer

### 3.2 Monitor Logs

Watch for this sequence:

```
====================================================================================================
  🆕 NEW CALL STARTING - Job ID: AJ_xxxxx
====================================================================================================

[VoiceAgent] Connecting to LiveKit room...
[VoiceAgent] Connected to room: _+19788968047_xxxx
[VoiceAgent] Waiting for SIP participant...
[SIP] Found SIP participant: sip-xxxx
[SIP] Extracted attributes: {"callSid":"CA...","trunkPhoneNumber":"+19788787756",...}
[VoiceAgent] SIP attributes:
  - Call SID: CAxxxxx
  - Trunk Phone: +19788787756
  - Caller Phone: +19788968047
[VoiceAgent] 🔍 Looking up tenant...
[Agent API] Looking up tenant for phone: +19788787756
[VoiceAgent] ✅ Tenant found: Honey Do 4 You (14a34ab2-...)
[VoiceAgent] 📊 Checking quota...
[VoiceAgent] ✅ Quota OK - XX minutes remaining
[VoiceAgent] 📋 Loading context...
[VoiceAgent] ✅ Context loaded for: Honey Do 4 You
[VoiceAgent] 📝 Starting call log...
[VoiceAgent] ✅ Call log started: uuid
[VoiceAgent] 🚀 Starting conversation pipeline...
```

**Checkpoint**: ☐ Full startup sequence completes

### 3.3 Verify Call Log Created

```sql
SELECT * FROM voice_call_log 
WHERE tenant_id = '14a34ab2-6f6f-4e41-9bea-c444a304557e'
ORDER BY created_at DESC 
LIMIT 1;
```

Should show a new call log entry.

**Checkpoint**: ☐ Call log created in database

### 3.4 End the Call

Hang up and verify completion logs:

```
[VoiceAgent] Room disconnected
====================================================================================================
  ✅ CALL COMPLETED - Duration: XXs
====================================================================================================
[VoiceAgent] ✅ Call log completed
```

**Checkpoint**: ☐ Call completes cleanly

### 3.5 Verify Call Log Updated

```sql
SELECT id, status, duration_seconds, outcome, ended_at 
FROM voice_call_log 
WHERE tenant_id = '14a34ab2-6f6f-4e41-9bea-c444a304557e'
ORDER BY created_at DESC 
LIMIT 1;
```

Should show:
- status = 'completed'
- duration_seconds = XX
- ended_at = timestamp

**Checkpoint**: ☐ Call log updated with completion data

---

## Test 4: Error Scenarios

### 4.1 Unknown Phone Number

Configure a test that calls a number not assigned to any tenant.

**Expected**: 
- Log shows "Tenant not found for phone: +1xxx"
- Call fails gracefully (no crash)

**Checkpoint**: ☐ Unknown number handled gracefully

### 4.2 API Timeout

Temporarily stop the API server during a call.

**Expected**:
- Timeout errors logged
- Retries attempted
- Call fails gracefully

**Checkpoint**: ☐ API timeout handled gracefully

### 4.3 Invalid API Key

Temporarily change VOICE_AGENT_API_KEY to wrong value.

**Expected**:
- 401 errors logged
- Call fails gracefully

**Checkpoint**: ☐ Auth error handled gracefully

---

## Test 5: Database Verification

### 5.1 Check Call Logs

```sql
SELECT 
  id,
  call_sid,
  from_number,
  to_number,
  status,
  duration_seconds,
  outcome,
  created_at,
  ended_at
FROM voice_call_log 
WHERE tenant_id = '14a34ab2-6f6f-4e41-9bea-c444a304557e'
ORDER BY created_at DESC 
LIMIT 5;
```

### 5.2 Check Usage Records (if implemented)

```sql
SELECT * FROM voice_usage_record 
WHERE tenant_id = '14a34ab2-6f6f-4e41-9bea-c444a304557e'
ORDER BY created_at DESC 
LIMIT 5;
```

---

## Final Checklist

### HTTP Endpoints
- [ ] Tenant lookup works
- [ ] Access check works
- [ ] Context returns enhanced data
- [ ] Call start works
- [ ] Call complete works

### Agent Startup
- [ ] Agent starts without errors
- [ ] No "registry not initialized" errors
- [ ] LiveKit connection successful

### Live Call Flow
- [ ] SIP participant detected
- [ ] SIP attributes extracted
- [ ] Tenant lookup via HTTP works
- [ ] Quota check via HTTP works
- [ ] Context load via HTTP works
- [ ] Call log created
- [ ] Call completes cleanly
- [ ] Call log updated

### Error Handling
- [ ] Unknown number handled
- [ ] API timeout handled
- [ ] Auth error handled

### Database
- [ ] Call logs created correctly
- [ ] Call logs updated on completion

---

## Common Issues and Solutions

### Issue: "Agent service registry not initialized"

**Cause**: Old code still references agentServiceRegistry  
**Solution**: Verify VAB-04 changes were applied correctly

### Issue: "Tenant not found" for valid number

**Cause**: Phone number format mismatch or wrong table queried  
**Solution**: Check tenant lookup query and phone number format

### Issue: Timeout errors

**Cause**: API too slow or unreachable  
**Solution**: Increase timeout, check API server is running

### Issue: 401 Unauthorized

**Cause**: Wrong API key  
**Solution**: Verify VOICE_AGENT_API_KEY matches configured key

### Issue: SIP participant not found

**Cause**: LiveKit SIP trunk misconfigured  
**Solution**: Check LiveKit dispatch rules and trunk settings

---

## Success Criteria

The Voice AI HTTP API Bridge is considered **COMPLETE** when:

1. ✅ All HTTP endpoints respond correctly
2. ✅ Agent starts and registers with LiveKit
3. ✅ Inbound calls are answered
4. ✅ Tenant is identified via HTTP lookup
5. ✅ Context is loaded via HTTP
6. ✅ Call logs are created and completed
7. ✅ No crashes or unhandled errors
8. ✅ Graceful handling of error scenarios