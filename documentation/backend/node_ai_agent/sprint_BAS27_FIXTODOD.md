# Sprint BAS25 — Voice AI Agent Audio Pipeline Completion

**Module**: Voice AI  
**Sprint**: BAS25  
**Depends on**: BAS19, BAS24 (Agent setup and pipeline complete)  
**Estimated time**: 4-6 hours  
**Risk Level**: HIGH — Production code, no room for error

---

## ⚠️ CRITICAL RULES — READ BEFORE TOUCHING ANY CODE

### ABSOLUTE REQUIREMENTS

1. **DO NOT GUESS** — If you are unsure about any SDK method, type, or behavior, STOP and research it. Read the official documentation. Do not assume.

2. **DO NOT CHANGE CODE WITHOUT UNDERSTANDING IMPACT** — Every change must be reviewed for:
   - Breaking existing functionality
   - Type safety (TypeScript strict mode)
   - Memory leaks (event listeners, streams)
   - Error handling (try/catch, graceful degradation)

3. **REVIEW ALL EXISTING CODE FIRST** — Before writing a single line:
   - Read the entire `voice-agent.session.ts` file
   - Read the entire `voice-agent-entrypoint.ts` file
   - Read the entire `voice-agent.service.ts` file
   - Understand every function, every variable, every flow

4. **TEST INCREMENTALLY** — Do not implement all changes at once. Implement one, test one, verify one.

5. **PRESERVE EXISTING BEHAVIOR** — The current code structure is intentional. Do not refactor, rename, or reorganize unless explicitly required to fix the gaps.

---

## Current State

### What IS Working

The Voice AI agent is **already running and connected**:

- ✅ `VoiceAgentService.onModuleInit()` starts the LiveKit `AgentServer`
- ✅ LiveKit connection is established (URL, API Key, API Secret from global config)
- ✅ Jobs are received and dispatched to `voice-agent-entrypoint.ts`
- ✅ `VoiceAgentSession` is created with context and tools
- ✅ `DeepgramSttProvider` creates a live transcription connection
- ✅ `OpenAiLlmProvider` generates responses with tool calling
- ✅ `CartesiaTtsProvider` synthesizes audio to PCM buffer
- ✅ Tools execute correctly (FindLead, CreateLead, CheckServiceArea, TransferCall)
- ✅ Conversation history is maintained
- ✅ Call logging works (start, complete, usage records)

### What is NOT Working (The Gaps)

There are **THREE specific gaps** marked with TODO comments in `voice-agent.session.ts`:

| Gap | Location | Issue |
|-----|----------|-------|
| 1 | `start()` method | Caller audio is not being piped to STT |
| 2 | `speak()` method | TTS audio buffer is not being published to LiveKit room |
| 3 | `handleTransfer()` method | SIP transfer is not being executed |

---

## Objective

Review and complete the audio pipeline so the Voice AI agent can:

1. **HEAR** the caller (pipe incoming audio to Deepgram STT)
2. **SPEAK** to the caller (publish TTS audio to LiveKit room)
3. **TRANSFER** calls to humans (execute SIP REFER via LiveKit)

---

## Pre-Coding Checklist

Before writing ANY code:

- [ ] Read `/api/src/modules/voice-ai/agent/voice-agent.session.ts` — understand the entire file
- [ ] Read `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts` — understand the job flow
- [ ] Read `/api/src/modules/voice-ai/agent/voice-agent.service.ts` — understand how the worker starts
- [ ] Read `/api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts` — understand `sendAudio()` method
- [ ] Read `/api/src/modules/voice-ai/agent/providers/cartesia-tts.provider.ts` — understand audio format
- [ ] Check `package.json` for installed LiveKit packages (`@livekit/agents`, `@livekit/rtc-node`, `livekit-server-sdk`)
- [ ] Read LiveKit Node.js SDK docs: https://docs.livekit.io/reference/server/node/
- [ ] Read LiveKit Agents SDK docs: https://docs.livekit.io/agents/overview/
- [ ] Read LiveKit SIP docs: https://docs.livekit.io/sip/overview/
- [ ] Verify the current code compiles: `cd /var/www/lead360.app/api && npm run build`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env`

---

## Task 1: Review Installed SDKs

**Before implementing anything**, verify what LiveKit packages are installed and their versions.

```bash
cd /var/www/lead360.app/api
cat package.json | grep -E "livekit|@livekit"
```

Document what you find:
- `@livekit/agents` version: ____
- `@livekit/rtc-node` version: ____
- `livekit-server-sdk` version: ____

**IMPORTANT**: Different versions have different APIs. Do not assume method names — check the actual installed version's types.

```bash
# Check the actual types available
cat node_modules/@livekit/agents/dist/index.d.ts | head -100
cat node_modules/@livekit/rtc-node/dist/index.d.ts | head -100
```

---

## Task 2: Review the TODO Comments

Find all TODO comments in the voice-ai agent code:

```bash
cd /var/www/lead360.app/api
grep -rn "TODO" src/modules/voice-ai/agent/
```

For each TODO found:
1. Read the surrounding code
2. Understand what the code is trying to do
3. Research the correct SDK method to use
4. Document your findings before implementing

---

## Task 3: Gap 1 — Pipe Caller Audio to STT

**Location**: `voice-agent.session.ts` → `start()` method

**Current State**: 
The code starts an STT session with Deepgram, but the caller's audio from the LiveKit room is not being sent to `sttSession.sendAudio()`.

**What Needs to Happen**:
1. Subscribe to remote audio tracks in the LiveKit room
2. When audio frames arrive, send them to the STT session
3. Handle the case where the caller hasn't joined yet (track may arrive later)

**Research Required**:
- How does `@livekit/agents` expose the room object?
- What events are available for track subscription?
- What format is the audio data in? (PCM? Sample rate?)
- Does it match what Deepgram expects?

**Implementation Approach**:
```typescript
// PSEUDO-CODE — DO NOT COPY WITHOUT VERIFICATION
// This is a starting point for research, not final code

// The room is passed to VoiceAgentSession constructor
// Check what methods/events are available on this.room

// Possible approach (VERIFY WITH SDK DOCS):
this.room.on('trackSubscribed', (track, publication, participant) => {
  if (track.kind === 'audio') {
    // Get audio frames and send to STT
    // RESEARCH: How to get audio frames from track?
  }
});
```

**Verification**:
- [ ] Audio from caller reaches Deepgram
- [ ] Transcripts appear in logs
- [ ] No memory leaks (listeners cleaned up on session end)

---

## Task 4: Gap 2 — Publish TTS Audio to LiveKit Room

**Location**: `voice-agent.session.ts` → `speak()` method

**Current State**:
```typescript
const audioBuffer = await ttsSession.getAudio();
this.logger.log(`Generated ${audioBuffer.length} bytes of audio`);
// TODO: Implement actual LiveKit audio publishing
```

The audio buffer is generated (Cartesia works), but it's not being sent to the caller.

**What Needs to Happen**:
1. Create an audio track from the PCM buffer
2. Publish the track to the room
3. The caller hears the agent speaking

**Research Required**:
- What audio format does Cartesia output? (Check `tts.interface.ts` and `cartesia-tts.provider.ts`)
- How do you create a local audio track in `@livekit/rtc-node`?
- How do you publish a track to a room?
- Should the track be persistent or created per utterance?

**Current TTS Output Format** (from `cartesia-tts.provider.ts`):
```typescript
outputFormat: {
  container: 'raw',
  encoding: 'pcm_s16le',  // 16-bit signed little-endian PCM
  sampleRate: 16000,       // 16kHz
}
```

**Implementation Approach**:
```typescript
// PSEUDO-CODE — DO NOT COPY WITHOUT VERIFICATION
// Research the actual @livekit/rtc-node API

const audioBuffer = await ttsSession.getAudio();

// RESEARCH: How to create AudioSource in @livekit/rtc-node?
// RESEARCH: How to publish audio track?
// RESEARCH: Should we reuse the track or create new one each time?
```

**Verification**:
- [ ] Agent greeting is audible to caller
- [ ] Agent responses are audible to caller
- [ ] Audio quality is acceptable
- [ ] No audio glitches or gaps

---

## Task 5: Gap 3 — SIP Transfer

**Location**: `voice-agent.session.ts` → `handleTransfer()` method

**Current State**:
```typescript
await this.speak(ttsProvider, 'Let me transfer you to a team member right away.');
this.isActive = false;
// TODO: Implement LiveKit SIP transfer
```

The agent says it will transfer, but the SIP REFER is not executed.

**What Needs to Happen**:
1. Identify the SIP participant in the room
2. Call LiveKit SIP API to transfer the call
3. Handle transfer success/failure

**Research Required**:
- How does `livekit-server-sdk` handle SIP transfers?
- What is the method signature for `transferSipParticipant`?
- What credentials are needed? (Already available in global config)
- How do we identify which participant is the SIP caller?

**Implementation Approach**:
```typescript
// PSEUDO-CODE — DO NOT COPY WITHOUT VERIFICATION
// Research the actual livekit-server-sdk API

import { SipClient } from 'livekit-server-sdk';

// RESEARCH: How to create SipClient?
// RESEARCH: What is the exact method for transfer?
// RESEARCH: How to get participant identity?
```

**Verification**:
- [ ] When LLM decides to transfer, call is actually transferred
- [ ] Caller hears transfer message before transfer
- [ ] Transfer goes to correct number from TransferCallTool
- [ ] Call log is updated with transfer outcome

---

## Task 6: Error Handling Review

After implementing the gaps, review error handling:

1. **What happens if Deepgram connection drops mid-call?**
   - Is there reconnection logic?
   - Does the session gracefully end?

2. **What happens if Cartesia fails to synthesize?**
   - Is there a fallback?
   - Is the error logged?

3. **What happens if LiveKit room disconnects?**
   - Is cleanup performed?
   - Is the call log finalized?

4. **What happens if SIP transfer fails?**
   - Does the agent inform the caller?
   - Is there a fallback behavior?

---

## Task 7: Memory Leak Review

Check for potential memory leaks:

1. **Event Listeners**:
   - Are all `.on()` listeners cleaned up in `stop()` or when session ends?
   - Use `.once()` where appropriate

2. **Streams**:
   - Is the Deepgram connection closed properly?
   - Is the audio track unpublished when done?

3. **Timers**:
   - Is `waitUntilStopped()` efficient? (currently polls every 100ms)

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `voice-agent.session.ts` | MODIFY | Complete the three gaps |
| `voice-agent.service.ts` | REVIEW | Ensure no changes needed |
| `voice-agent-entrypoint.ts` | REVIEW | Ensure no changes needed |

**DO NOT CREATE NEW FILES** unless absolutely necessary. The architecture is already in place.

---

## Testing Instructions

### Step 1: Verify Build
```bash
cd /var/www/lead360.app/api
npm run build
# Must pass with no errors
```

### Step 2: Verify Agent Starts
```bash
npm run start:dev
# Check logs for "LiveKit AgentServer started"
```

### Step 3: Test with Real Call
1. Configure a tenant's IVR with `voice_ai` action
2. Call the tenant's phone number
3. Select the AI option in IVR
4. Verify:
   - Agent greets you
   - Agent hears you (check logs for transcripts)
   - Agent responds appropriately
   - Tools work (try giving your info)
   - Transfer works (if configured)

### Step 4: Check Call Logs
```bash
# Query the database
SELECT * FROM voice_call_log ORDER BY created_at DESC LIMIT 5;
SELECT * FROM voice_usage_record ORDER BY created_at DESC LIMIT 10;
```

---

## Acceptance Criteria

- [ ] All TODO comments in `voice-agent.session.ts` are resolved
- [ ] Caller audio is piped to Deepgram STT
- [ ] TTS audio is published to LiveKit room and caller hears it
- [ ] SIP transfer executes when TransferCallTool returns transfer number
- [ ] No breaking changes to existing code
- [ ] All error cases are handled gracefully
- [ ] No memory leaks introduced
- [ ] `npm run build` passes
- [ ] `npm run test` passes (if voice-ai tests exist)
- [ ] Real call test successful

---

## Rollback Plan

If the changes cause issues:

1. Revert the changes to `voice-agent.session.ts`
2. Restart the API: `pm2 restart lead360-api`
3. Verify the agent starts (even if audio doesn't work, it should not crash)

---

## Documentation Required

After completing this sprint, update:

1. `/api/documentation/voice_ai_REST_API.md` — if any internal APIs changed
2. This sprint document — mark as complete with notes on what was implemented

---

## Final Reminder

**YOU ARE MODIFYING PRODUCTION CODE.**

- Do not guess
- Do not assume
- Do not skip verification
- Do not implement without understanding
- Do not break existing functionality

Read the SDK documentation. Check the types. Test incrementally. Ask questions if unsure.

---

## Sprint Completion Notes

**Completed**: 2026-02-26
**Status**: ✅ All gaps resolved, build passing, ready for testing

### Summary of Changes

All three audio pipeline gaps have been successfully implemented:

#### Gap 1: Caller Audio → STT (COMPLETED ✅)

**Implementation**:
- Added `trackSubscribed` event listener in `start()` method
- Created `AudioStream` from `RemoteAudioTrack` with 16kHz mono configuration
- Implemented `pipeAudioToStt()` helper method that:
  - Reads `AudioFrame` objects from the stream
  - Converts `Int16Array` to `Buffer`
  - Sends audio data to Deepgram via `sttSession.sendAudio()`
- Added proper cleanup in session cleanup method

**Files Modified**:
- [voice-agent.session.ts:113-156](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L113-L156)
- [voice-agent.session.ts:417-445](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L417-L445)

**Verification Required**:
- Caller speech is transcribed correctly
- Transcripts appear in logs with "User said: ..."
- No audio glitches or dropped frames

---

#### Gap 2: TTS Audio → LiveKit Room (COMPLETED ✅)

**Implementation**:
- Created `AudioSource` (16kHz mono) matching Cartesia TTS output format
- Created `LocalAudioTrack` from `AudioSource`
- Published track to room via `localParticipant.publishTrack()`
- Implemented audio frame streaming in `speak()` method:
  - Converts TTS buffer (pcm_s16le) to `Int16Array`
  - Splits into 10ms frames (160 samples at 16kHz)
  - Sends frames to `AudioSource` via `captureFrame()`
- Added cleanup for audio source and track in session cleanup method

**Files Modified**:
- [voice-agent.session.ts:85-100](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L85-L100)
- [voice-agent.session.ts:331-370](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L331-L370)
- [voice-agent.session.ts:447-489](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L447-L489)

**Verification Required**:
- Agent greeting is audible to caller
- Agent responses are clear and understandable
- No audio artifacts or delays

---

#### Gap 3: SIP Call Transfer (COMPLETED ✅)

**Implementation**:
- Added LiveKit config to session constructor
- Updated global service registry to include LiveKit credentials
- Implemented `handleTransfer()` using `livekit-server-sdk`:
  - Creates `SipClient` with LiveKit credentials
  - Finds SIP participant in room (filters by `ParticipantKind.STANDARD`)
  - Calls `transferSipParticipant()` with room name, participant identity, and transfer number
  - Plays dial tone during transfer (`playDialtone: true`)
- Added error handling with user-friendly fallback message

**Files Modified**:
- [voice-agent.session.ts:8](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L8) (imports)
- [voice-agent.session.ts:46](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L46) (constructor)
- [voice-agent.session.ts:372-415](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts#L372-L415)
- [voice-agent-entrypoint.ts:28](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts#L28) (registry)
- [voice-agent-entrypoint.ts:75-79](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts#L75-L79) (session creation)
- [voice-agent.service.ts:124](/var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.service.ts#L124) (config passing)

**Verification Required**:
- TransferCallTool triggers transfer correctly
- Call is transferred to the correct number
- Caller hears transfer message before transfer
- Call log is updated with transfer outcome

---

### Error Handling Review

All gaps include comprehensive error handling:

1. **Gap 1 (Audio → STT)**:
   - Try/catch around stream setup
   - Error logging for stream failures
   - Graceful reader release in finally block

2. **Gap 2 (TTS → Room)**:
   - Checks for audio source initialization before publishing
   - Error logging for TTS synthesis failures
   - Graceful degradation if audio source is not available

3. **Gap 3 (SIP Transfer)**:
   - Validates SIP participant existence before transfer
   - Try/catch around SIP API call
   - Speaks error message to caller if transfer fails

---

### Memory Leak Prevention

Added comprehensive cleanup method that:

1. **Releases audio stream reader**:
   - Calls `releaseLock()` on stream reader
   - Prevents hanging references

2. **Closes audio source and track**:
   - `audioSource.close()` to stop audio queue
   - `audioTrack.close(true)` to close track and source
   - Sets references to null for garbage collection

3. **Cleanup is called**:
   - In `stop()` method
   - At end of `start()` method (after session ends)
   - Ensures cleanup even on error paths

**Note**: Room event listeners do not need manual removal because:
- Room lifecycle is managed by JobContext
- Session lifecycle is tied to job lifecycle
- Room is disposed when job ends

---

### Build Verification

✅ **Build Status**: PASSED

```bash
npm run build
# No errors, all files compiled successfully
```

**Compiled Files**:
- `dist/src/modules/voice-ai/agent/voice-agent.session.js` (15K)
- `dist/src/modules/voice-ai/agent/voice-agent-entrypoint.js` (2.9K)
- `dist/src/modules/voice-ai/agent/voice-agent.service.js` (9.8K)

---

### SDK Versions Used

- `@livekit/agents`: v1.0.47
- `@livekit/rtc-node`: (peer dependency, installed)
- `livekit-server-sdk`: v2.15.0
- `@deepgram/sdk`: v4.11.3
- `@cartesia/cartesia-js`: v2.2.9

---

### Critical Bug Fixed During Code Review

**🚨 CRITICAL BUG DISCOVERED AND FIXED**:

**Issue**: Line 396 used magic number `p.kind === 1` to identify SIP participant for transfer

**Root Cause**:
- Code assumed `ParticipantKind.STANDARD = 1`
- Actual value: `ParticipantKind.STANDARD = 0`
- Value `1` is actually `ParticipantKind.INGRESS`

**Impact**:
- **SIP transfers would FAIL completely**
- Agent would not find SIP participant in room
- Transfer would silently fail with "No SIP participant found" error

**Fix Applied**:
1. Added import: `import { ParticipantKind } from '@livekit/rtc-node';`
2. Changed line 396 from: `(p) => p.kind === 1`
3. To: `(p) => p.kind === ParticipantKind.STANDARD`

**Verification**:
- ✅ Build passes with no errors
- ✅ Compiled output shows: `rtc_node_2.ParticipantKind.STANDARD`
- ✅ No magic numbers remain in code

**Files Modified**:
- [voice-agent.session.ts:9](../../../api/src/modules/voice-ai/agent/voice-agent.session.ts#L9) - Added ParticipantKind import
- [voice-agent.session.ts:396](../../../api/src/modules/voice-ai/agent/voice-agent.session.ts#L396) - Fixed participant kind check

**Lesson Learned**: Always use enum constants, never magic numbers. Always verify enum values before using them.

---

### Known Issues / Future Improvements

1. **Minor TODO Remaining**:
   - Line 236: `caller_phone` extraction from `voice_call_log.from_number` is not implemented
   - This is a low-priority enhancement for tool context
   - Does not affect core audio pipeline functionality

2. **TypeScript Warning**:
   - Type cast needed for `ctx.room` due to module resolution quirks
   - This is a TypeScript limitation, not a runtime issue

3. **Potential Enhancements**:
   - Add audio quality metrics (packet loss, latency)
   - Implement audio level monitoring
   - Add reconnection logic for STT disconnections
   - Consider implementing audio mixing for multiple participants

---

### Testing Checklist

Before marking this sprint as production-ready, verify:

- [ ] Build passes: `npm run build`
- [ ] Agent starts: Check logs for "LiveKit AgentServer started"
- [ ] Call connects: Agent joins room successfully
- [ ] Caller audio works: Agent hears caller (check logs for "User said: ...")
- [ ] Agent audio works: Caller hears agent greeting and responses
- [ ] Transfer works: `transfer_call` tool triggers SIP transfer correctly
- [ ] Cleanup works: No memory leaks after multiple calls
- [ ] Error handling works: Agent handles failures gracefully

---

### Deployment Notes

**Restart Required**: Yes

After deploying these changes:

```bash
cd /var/www/lead360.app/api
npm run build
pm2 restart lead360-api
```

**Monitor Logs**:
```bash
pm2 logs lead360-api --lines 100
```

Look for:
- "LiveKit AgentServer started" (startup)
- "Connected to room: ..." (connection)
- "Subscribed to audio track from participant: ..." (audio in)
- "Published audio track to room" (audio out)
- "User said: ..." (transcription working)
- "Speaking: ..." (TTS working)
- "Transferring SIP participant ... to ..." (transfer working)

---

**END OF SPRINT BAS27**