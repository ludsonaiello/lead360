# Sprint VAB-04: Refactor Agent Entrypoint to Use HTTP

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-04  
**Depends on**: VAB-01, VAB-02, VAB-03 (all previous sprints)  
**Estimated Effort**: Large (3-4 hours)

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

Refactor the voice agent entrypoint to:
1. Remove all usage of `agentServiceRegistry` (it doesn't work in child processes)
2. Use the HTTP API functions created in VAB-03
3. Extract tenant info from SIP participant attributes
4. Make HTTP calls to get context, start/complete call logs, etc.

This is the CRITICAL sprint that makes the agent actually work.

---

## Background

Current problem:
```
Error: Agent service registry not initialized
```

Why: LiveKit spawns the agent in a separate Node.js process. The `agentServiceRegistry` is set in the main NestJS process but doesn't exist in the child process.

Solution: Instead of using shared memory (which doesn't work), use HTTP calls to the Lead360 API.

---

## Pre-Coding Checklist

- [ ] Read current entrypoint: `voice-agent-entrypoint.ts`
- [ ] Understand the current flow (what it tries to do)
- [ ] Verify VAB-01, VAB-02, VAB-03 are complete and working
- [ ] Test HTTP client functions manually
- [ ] Understand LiveKit JobContext API

**DO NOT START CODING UNTIL ALL BOXES ARE CHECKED**

---

## Task 1: Understand Current Entrypoint Flow

Review the current entrypoint and identify what needs to change:

**Current Flow (Broken)**:
```
1. Receive JobContext from LiveKit
2. Try to get services from agentServiceRegistry → FAILS (null)
3. Crash with "Agent service registry not initialized"
```

**New Flow (HTTP-based)**:
```
1. Receive JobContext from LiveKit
2. Connect to LiveKit room
3. Wait for SIP participant to join
4. Extract from SIP attributes:
   - sip.trunkPhoneNumber (Twilio number → identifies tenant)
   - sip.twilio.callSid (call identifier)
   - sip.phoneNumber (caller's number)
5. HTTP: lookupTenant(trunkPhoneNumber) → get tenant_id
6. HTTP: checkAccess(tenantId) → verify quota/enabled
7. HTTP: getContext(tenantId) → get full context
8. HTTP: startCallLog(...) → create call log
9. Start agent session (STT → LLM → TTS)
10. On call end: HTTP: completeCallLog(...) → finalize
```

---

## Task 2: Create SIP Participant Helper

**File**: `api/src/modules/voice-ai/agent/utils/sip-participant.ts`

```typescript
/**
 * Helper functions for working with LiveKit SIP participants
 */

import { Room, RemoteParticipant, ParticipantKind } from '@livekit/rtc-node';

/**
 * SIP Participant attributes provided by LiveKit
 */
export interface SipAttributes {
  callSid: string | null;           // sip.twilio.callSid
  trunkPhoneNumber: string | null;  // sip.trunkPhoneNumber (Twilio number)
  callerPhoneNumber: string | null; // sip.phoneNumber (caller's number)
  callStatus: string | null;        // sip.callStatus
  trunkId: string | null;           // sip.trunkID
}

/**
 * Wait for a SIP participant to join the room
 * 
 * @param room LiveKit Room instance
 * @param timeoutMs Maximum time to wait (default 30s)
 * @returns SIP participant or null if timeout
 */
export async function waitForSipParticipant(
  room: Room,
  timeoutMs: number = 30000
): Promise<RemoteParticipant | null> {
  const startTime = Date.now();
  
  console.log('[SIP] Waiting for SIP participant to join...');

  while (Date.now() - startTime < timeoutMs) {
    // Check existing participants
    for (const participant of room.remoteParticipants.values()) {
      if (participant.kind === ParticipantKind.SIP) {
        console.log(`[SIP] Found SIP participant: ${participant.identity}`);
        return participant;
      }
    }

    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.error('[SIP] Timeout waiting for SIP participant');
  return null;
}

/**
 * Extract SIP attributes from participant
 */
export function extractSipAttributes(participant: RemoteParticipant): SipAttributes {
  const attrs = participant.attributes || {};
  
  const sipAttrs: SipAttributes = {
    callSid: attrs['sip.twilio.callSid'] || attrs['sip.callID'] || null,
    trunkPhoneNumber: attrs['sip.trunkPhoneNumber'] || null,
    callerPhoneNumber: attrs['sip.phoneNumber'] || null,
    callStatus: attrs['sip.callStatus'] || null,
    trunkId: attrs['sip.trunkID'] || null,
  };

  console.log('[SIP] Extracted attributes:', JSON.stringify(sipAttrs));
  
  return sipAttrs;
}
```

---

## Task 3: Refactor Entrypoint - Part 1 (Imports and Setup)

**File**: `api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

Replace the top section (imports and registry) with:

```typescript
/**
 * Voice Agent Entrypoint
 * 
 * This function is called by LiveKit AgentServer for each incoming call.
 * It runs in a SEPARATE CHILD PROCESS - NestJS services are NOT available.
 * 
 * All data is fetched via HTTP calls to the Lead360 API.
 * 
 * Flow:
 * 1. Connect to LiveKit room
 * 2. Wait for SIP participant
 * 3. Extract SIP attributes (phone numbers, call SID)
 * 4. Look up tenant by phone number (HTTP)
 * 5. Check access/quota (HTTP)
 * 6. Load full context (HTTP)
 * 7. Start call log (HTTP)
 * 8. Run agent session (STT → LLM → TTS)
 * 9. Complete call log (HTTP)
 */

import { JobContext, defineAgent } from '@livekit/agents';
import { 
  lookupTenant, 
  checkAccess, 
  getContext, 
  startCallLog, 
  completeCallLog 
} from './utils/agent-api';
import { waitForSipParticipant, extractSipAttributes } from './utils/sip-participant';
import { VoiceAiContext } from './utils/api-types';

// Remove or comment out the old registry
// export let agentServiceRegistry = null;
// export function setAgentServiceRegistry() {}

/**
 * Log separator for visual clarity in logs
 */
function logSeparator(message: string): void {
  console.log('');
  console.log('='.repeat(100));
  console.log(`  ${message}`);
  console.log('='.repeat(100));
  console.log('');
}
```

---

## Task 4: Refactor Entrypoint - Part 2 (Main Function)

**File**: `api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

Replace the main entrypoint function:

```typescript
/**
 * Agent entrypoint function
 * 
 * Called by @livekit/agents AgentServer for each job.
 * Runs in a child process - no NestJS services available.
 */
async function voiceAgentEntrypoint(ctx: JobContext): Promise<void> {
  const startTime = Date.now();
  let tenantId: string | null = null;
  let callSid: string | null = null;
  let callLogId: string | null = null;

  try {
    logSeparator(`🆕 NEW CALL STARTING - Job ID: ${ctx.job.id}`);

    // Step 1: Connect to LiveKit room
    console.log('[VoiceAgent] Connecting to LiveKit room...');
    await ctx.connect();
    console.log(`[VoiceAgent] Connected to room: ${ctx.room.name}`);

    // Step 2: Wait for SIP participant
    console.log('[VoiceAgent] Waiting for SIP participant...');
    const sipParticipant = await waitForSipParticipant(ctx.room);
    
    if (!sipParticipant) {
      console.error('[VoiceAgent] ❌ No SIP participant joined within timeout');
      logSeparator('❌ CALL FAILED - No SIP participant');
      return;
    }

    // Step 3: Extract SIP attributes
    const sipAttrs = extractSipAttributes(sipParticipant);
    callSid = sipAttrs.callSid;
    
    console.log(`[VoiceAgent] SIP attributes:`);
    console.log(`  - Call SID: ${sipAttrs.callSid}`);
    console.log(`  - Trunk Phone: ${sipAttrs.trunkPhoneNumber}`);
    console.log(`  - Caller Phone: ${sipAttrs.callerPhoneNumber}`);

    if (!sipAttrs.trunkPhoneNumber) {
      console.error('[VoiceAgent] ❌ Missing trunk phone number in SIP attributes');
      logSeparator('❌ CALL FAILED - Missing trunk phone number');
      return;
    }

    // Step 4: Look up tenant by phone number
    console.log('[VoiceAgent] 🔍 Looking up tenant...');
    const lookupResult = await lookupTenant(sipAttrs.trunkPhoneNumber);
    
    if (!lookupResult.success || !lookupResult.data?.found) {
      console.error(`[VoiceAgent] ❌ Tenant not found for phone: ${sipAttrs.trunkPhoneNumber}`);
      // TODO: Play "number not configured" message to caller
      logSeparator('❌ CALL FAILED - Tenant not found');
      return;
    }

    tenantId = lookupResult.data.tenant_id!;
    console.log(`[VoiceAgent] ✅ Tenant found: ${lookupResult.data.tenant_name} (${tenantId})`);

    // Step 5: Check access/quota
    console.log('[VoiceAgent] 📊 Checking quota...');
    const accessResult = await checkAccess(tenantId);
    
    if (!accessResult.success || !accessResult.data?.has_access) {
      const reason = accessResult.data?.reason || 'unknown';
      console.error(`[VoiceAgent] ❌ Access denied: ${reason}`);
      // TODO: Play "service unavailable" message to caller
      logSeparator(`❌ CALL FAILED - Access denied: ${reason}`);
      return;
    }

    console.log(`[VoiceAgent] ✅ Quota OK - ${accessResult.data.minutes_remaining} minutes remaining`);

    // Step 6: Load full context
    console.log('[VoiceAgent] 📋 Loading context...');
    const contextResult = await getContext(tenantId);
    
    if (!contextResult.success || !contextResult.data) {
      console.error('[VoiceAgent] ❌ Failed to load context');
      logSeparator('❌ CALL FAILED - Context load failed');
      return;
    }

    const context = contextResult.data;
    console.log(`[VoiceAgent] ✅ Context loaded for: ${context.tenant.company_name}`);

    // Step 7: Start call log
    console.log('[VoiceAgent] 📝 Starting call log...');
    const startResult = await startCallLog({
      tenant_id: tenantId,
      call_sid: callSid || `job-${ctx.job.id}`,
      from_number: sipAttrs.callerPhoneNumber || 'unknown',
      to_number: sipAttrs.trunkPhoneNumber,
      room_name: ctx.room.name,
      direction: 'inbound',
    });

    if (startResult.success && startResult.data) {
      callLogId = startResult.data.call_log_id;
      console.log(`[VoiceAgent] ✅ Call log started: ${callLogId}`);
    } else {
      console.warn('[VoiceAgent] ⚠️ Failed to start call log, continuing anyway');
    }

    // Step 8: Run agent session
    console.log('[VoiceAgent] 🚀 Starting conversation pipeline...');
    await runAgentSession(ctx, context, sipAttrs);

    // Step 9: Complete call log
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    logSeparator(`✅ CALL COMPLETED - Duration: ${durationSeconds}s`);

    if (callLogId && callSid) {
      await completeCallLog(callSid, {
        status: 'completed',
        duration_seconds: durationSeconds,
        outcome: 'completed',
        // transcript_summary: will be added when transcription is implemented
        // full_transcript: will be added when transcription is implemented
      });
      console.log('[VoiceAgent] ✅ Call log completed');
    }

  } catch (error: any) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error(`[VoiceAgent] ❌ Error: ${error.message}`, error.stack);
    logSeparator(`❌ CALL FAILED - Duration: ${durationSeconds}s`);

    // Try to complete call log with error
    if (callSid) {
      try {
        await completeCallLog(callSid, {
          status: 'error',
          duration_seconds: durationSeconds,
          outcome: 'error',
          error_message: error.message,
        });
      } catch (e) {
        console.error('[VoiceAgent] Failed to complete call log on error');
      }
    }
  }
}

/**
 * Run the actual agent session (STT → LLM → TTS)
 * 
 * This is a placeholder - implement the actual conversation logic here.
 * For now, it just waits for the call to end.
 */
async function runAgentSession(
  ctx: JobContext,
  context: VoiceAiContext,
  sipAttrs: { callerPhoneNumber: string | null }
): Promise<void> {
  console.log(`[VoiceAgent] Greeting: ${context.behavior.greeting}`);
  console.log(`[VoiceAgent] Services: ${context.services.map(s => s.name).join(', ')}`);
  console.log(`[VoiceAgent] Service areas: ${context.service_areas.length} configured`);
  
  // TODO: Implement actual STT → LLM → TTS pipeline
  // For now, just keep the session alive
  
  // Wait for the room to close (caller hangs up)
  await new Promise<void>((resolve) => {
    ctx.room.on('disconnected', () => {
      console.log('[VoiceAgent] Room disconnected');
      resolve();
    });
    
    // Also resolve after max duration
    const maxDuration = context.behavior.max_call_duration_seconds * 1000;
    setTimeout(() => {
      console.log('[VoiceAgent] Max duration reached');
      resolve();
    }, maxDuration);
  });
}

// Export as Agent object for LiveKit
export default defineAgent({
  entry: voiceAgentEntrypoint,
});
```

---

## Task 5: Remove Service Registry from VoiceAgentService

**File**: `api/src/modules/voice-ai/agent/voice-agent.service.ts`

Find and remove (or comment out) the `setAgentServiceRegistry` call:

```typescript
// REMOVE OR COMMENT OUT THIS BLOCK:
// setAgentServiceRegistry({
//   contextBuilder: this.contextBuilder,
//   callLogService: this.callLogService,
//   usageService: this.usageService,
//   buildTools: () => this.buildTools(),
//   livekitConfig: config,
//   waitForSipParticipant: (ctx: any) => this.waitForSipParticipantFromContext(ctx),
//   lookupTenantByPhoneNumber: (phoneNumber: string) => this.lookupTenantByPhoneNumber(phoneNumber),
// });
```

The service still starts the AgentServer, but no longer tries to pass services to the child process.

---

## Task 6: Test the Refactored Agent

1. **Rebuild the project**:
```bash
cd /var/www/lead360.app/api
npm run build
```

2. **Start the server**:
```bash
npm run start:dev
```

3. **Make a test call**:
- Call the Twilio number
- Select Voice AI from IVR
- Watch the logs

**Expected log output**:
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
  - Call SID: CA123...
  - Trunk Phone: +19788787756
  - Caller Phone: +19788968047
[VoiceAgent] 🔍 Looking up tenant...
[Agent API] Looking up tenant for phone: +19788787756
[VoiceAgent] ✅ Tenant found: Honey Do 4 You (14a34ab2-...)
[VoiceAgent] 📊 Checking quota...
[Agent API] Checking access for tenant: 14a34ab2-...
[VoiceAgent] ✅ Quota OK - 85 minutes remaining
[VoiceAgent] 📋 Loading context...
[Agent API] Loading context for tenant: 14a34ab2-...
[VoiceAgent] ✅ Context loaded for: Honey Do 4 You
[VoiceAgent] 📝 Starting call log...
[Agent API] Starting call log for call: CA123...
[VoiceAgent] ✅ Call log started: uuid-here
[VoiceAgent] 🚀 Starting conversation pipeline...
[VoiceAgent] Greeting: Hello, thank you for calling Honey Do 4 You!
[VoiceAgent] Services: Handyman, Painting
[VoiceAgent] Service areas: 5 configured
```

---

## Acceptance Criteria

- [ ] Agent no longer references `agentServiceRegistry`
- [ ] Agent uses HTTP calls for all data fetching
- [ ] SIP attributes are correctly extracted
- [ ] Tenant lookup works via HTTP
- [ ] Quota check works via HTTP
- [ ] Context is loaded via HTTP
- [ ] Call log is started and completed via HTTP
- [ ] Graceful error handling for all failure cases
- [ ] Clear, actionable log messages

---

## Files Modified

| File | Action | Description |
|------|--------|-------------|
| `agent/utils/sip-participant.ts` | CREATE | SIP participant helper |
| `agent/voice-agent-entrypoint.ts` | MODIFY | Refactor to use HTTP |
| `agent/voice-agent.service.ts` | MODIFY | Remove setAgentServiceRegistry |

---

## Rollback

If issues occur:
1. Revert `voice-agent-entrypoint.ts` to previous version
2. Revert `voice-agent.service.ts` to restore registry setup
3. Rebuild and restart

Note: The old version was broken anyway ("registry not initialized"), so rollback just returns to the broken state.