# Sprint 01: Fix Audio Track SID Assignment

**Status**: Ready for Implementation
**Priority**: CRITICAL
**Estimated Time**: 30-45 minutes
**Risk Level**: Low

## Problem Statement

The voice AI agent's audio track SID remains `TR_unknown` after publishing, causing all audio chunks to be silently dropped. This results in complete silence for the caller despite the agent generating responses.

**Log Evidence**:
```
[17:41:21] ✅ Published audio track to room
[17:41:24] Track SID: TR_unknown  ← PROBLEM
[17:42:00] Audio track not ready (SID: TR_unknown) - dropping chunk
[17:42:09] Audio track not ready (SID: TR_unknown) - dropping chunk
... (hundreds of these warnings)
```

## Root Cause

The `publishTrack()` method returns a `LocalTrackPublication` object containing the assigned SID, but this return value is currently being **ignored**. The code attempts to read `this.audioTrack.sid` instead, which never gets updated from its initial `TR_unknown` value.

## Implementation

### File to Modify

[api/src/modules/voice-ai/agent/voice-agent.session.ts](../api/src/modules/voice-ai/agent/voice-agent.session.ts)

### Changes Required

#### 1. Add Publication Field (Line ~44-51)

**Location**: Class properties section

**Current Code**:
```typescript
export class VoiceAgentSession {
  private readonly logger = new Logger(VoiceAgentSession.name);
  private conversationHistory: LlmMessage[] = [];
  private isActive = true;
  private transferRequested = false;
  private transferNumber: string | null = null;
  private transferReason: string | null = null;
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  // ...
```

**Add This Line**:
```typescript
  private audioPublication: LocalTrackPublication | null = null;
```

**Also Add Import** (at top of file, line 8):
```typescript
import { Room, RemoteTrack, RemoteAudioTrack, AudioStream, AudioSource, LocalAudioTrack, AudioFrame, TrackKind, TrackPublishOptions, LocalTrackPublication } from '@livekit/rtc-node';
```

#### 2. Capture Publication Return Value (Line 133)

**Current Code**:
```typescript
await this.room.localParticipant.publishTrack(this.audioTrack, new TrackPublishOptions());
this.logger.log('✅ Published audio track to room');
```

**Replace With**:
```typescript
this.audioPublication = await this.room.localParticipant.publishTrack(
  this.audioTrack,
  new TrackPublishOptions()
);
this.logger.log(`✅ Published audio track to room with SID: ${this.audioPublication.sid}`);
```

#### 3. Replace Polling Loop with waitForSubscription (Lines 136-149)

**Current Code** (DELETE THIS):
```typescript
// ====================================================================================
// FIX BUG A (STEP 1): Wait for track SID to be assigned
// The SID may be "TR_unknown" immediately after publishTrack() completes.
// We must wait for LiveKit SFU to assign a valid SID before streaming audio.
// ====================================================================================
const maxSidWaitMs = 3000;
const sidWaitStart = Date.now();
while (!this.audioTrack.sid || this.audioTrack.sid === 'TR_unknown') {
  if (Date.now() - sidWaitStart > maxSidWaitMs) {
    this.logger.warn('⚠️  Track SID not assigned after 3s - proceeding anyway');
    break;
  }
  await new Promise(r => setTimeout(r, 100));
}
```

**Replace With**:
```typescript
// ====================================================================================
// Wait for SIP participant to subscribe to our audio track
// This ensures they're ready to receive audio before we start speaking
// ====================================================================================
this.logger.log(`⏳ Waiting for SIP participant to subscribe to agent audio...`);

try {
  await Promise.race([
    this.audioPublication.waitForSubscription(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Subscription timeout')), 5000)
    )
  ]);
  this.logger.log(`✅ SIP participant subscribed - ready to stream audio`);
} catch (error) {
  this.logger.warn(`⚠️  Subscription wait timeout after 5s - proceeding anyway`);
}
```

#### 4. Update Diagnostic Logging (Lines 151-167)

**Current Code**:
```typescript
// Log audio track details
this.logger.log(`📊 Audio Track Details:`);
this.logger.log(`  - Track SID: ${this.audioTrack?.sid || 'unknown'}`);
this.logger.log(`  - Track name: ${this.audioTrack?.name || 'unknown'}`);
this.logger.log(`  - Track kind: ${this.audioTrack?.kind || 'unknown'}`);
this.logger.log(`  - Muted: ${this.audioTrack?.muted || 'unknown'}`);
this.logger.log(`  - Sample rate: 16000Hz`);
this.logger.log(`  - Channels: 1 (mono)`);

// VoiceAI structured logging
this.voiceLogger?.logSessionEvent('audio_track_published', {
  track_sid: this.audioTrack?.sid,
  track_name: this.audioTrack?.name,
  sample_rate: 16000,
  channels: 1,
  muted: this.audioTrack?.muted,
});
```

**Replace With**:
```typescript
// Log audio publication details (not just track)
this.logger.log(`📊 Audio Publication Details:`);
this.logger.log(`  - Publication SID: ${this.audioPublication.sid}`);
this.logger.log(`  - Track name: ${this.audioTrack.name}`);
this.logger.log(`  - Track kind: ${this.audioTrack.kind}`);
this.logger.log(`  - Muted: ${this.audioPublication.muted}`);
this.logger.log(`  - Sample rate: 16000Hz`);
this.logger.log(`  - Channels: 1 (mono)`);

// VoiceAI structured logging
this.voiceLogger?.logSessionEvent('audio_publication_ready', {
  publication_sid: this.audioPublication.sid,
  track_name: this.audioTrack.name,
  sample_rate: 16000,
  channels: 1,
  muted: this.audioPublication.muted,
});
```

#### 5. Update Subscriber Check (Lines 173-182)

**Current Code**:
```typescript
for (const participant of this.room.remoteParticipants.values()) {
  for (const publication of participant.trackPublications.values()) {
    if (publication.sid === this.audioTrack.sid) {
      subscriberCount++;
      subscribers.push(`${participant.identity} (${participant.kind})`);
      this.logger.log(`  📌 Subscriber detected: ${participant.identity} (kind: ${participant.kind})`);
    }
  }
}
```

**Replace With**:
```typescript
for (const participant of this.room.remoteParticipants.values()) {
  for (const publication of participant.trackPublications.values()) {
    if (publication.sid === this.audioPublication.sid) {
      subscriberCount++;
      subscribers.push(`${participant.identity} (${participant.kind})`);
      this.logger.log(`  📌 Subscriber detected: ${participant.identity} (kind: ${participant.kind})`);
    }
  }
}
```

## Masterclass Developer Rules

### Before Writing Code

1. **Read the entire start() method** (lines 75-499) - understand full context
2. **Check LiveKit SDK documentation** for LocalTrackPublication
3. **Review why previous fix failed** - polling was checking wrong object
4. **Understand the flow** - track creation → publish → subscribe → stream audio
5. **Verify imports** - ensure LocalTrackPublication is imported

### While Writing Code

1. **No rushing** - make one change at a time, verify compilation
2. **No guessing** - if uncertain about API behavior, search for examples
3. **Preserve existing safeguards** - don't remove error handling
4. **Add comprehensive logging** - every critical step logs success/failure
5. **Handle edge cases** - what if waitForSubscription() times out?
6. **No hardcoded values** - use existing config (sample rate, channels, etc.)
7. **TypeScript types correct** - no `any` unless necessary
8. **Comments explain WHY** - not WHAT (code is self-documenting)

### After Writing Code

1. **Verify compilation** - `npm run build` in /var/www/lead360.app/api
2. **Review diff** - every line changed should have a reason
3. **Test imports** - ensure no circular dependencies
4. **Check for regressions** - did we break anything else?
5. **Prepare for testing** - restart service before test call

## Testing Checklist

### Pre-Testing

- [ ] Code compiles without errors
- [ ] No TypeScript warnings
- [ ] Git diff reviewed (all changes intentional)
- [ ] Service restarts cleanly

### During Test Call

Monitor logs for:
- [ ] ✅ "Published audio track to room with SID: TR_xxxxx" (not TR_unknown)
- [ ] ✅ "SIP participant subscribed - ready to stream audio"
- [ ] ❌ NO "Audio track not ready (SID: TR_unknown) - dropping chunk" warnings
- [ ] ✅ "🔊 Audio chunk: XXX bytes" logs

Manual verification:
- [ ] Caller hears greeting within 2 seconds of call connecting
- [ ] Greeting is clear and complete (not cut off)
- [ ] Agent is ready to listen after greeting

### Post-Testing

- [ ] No errors in logs
- [ ] Call ended cleanly
- [ ] No memory leaks (check resource cleanup)
- [ ] Ready for Sprint 02

## Success Criteria

✅ **Sprint 01 is complete when**:

1. Publication object is stored in `this.audioPublication`
2. Logs show real SID (e.g., `TR_abc123def456`, NOT `TR_unknown`)
3. `waitForSubscription()` completes successfully
4. No compilation errors
5. Service restarts cleanly
6. Caller hears greeting (proves audio is flowing)

❌ **Sprint 01 has failed if**:

1. Publication SID is still `TR_unknown`
2. Compilation errors
3. Service crashes on startup
4. Caller doesn't hear greeting
5. New errors appear in logs

## Rollback Plan

If this sprint fails:

1. **Revert changes** to voice-agent.session.ts
2. **Document failure** - what was tried, what happened
3. **Investigate LiveKit SDK** - check if waitForSubscription() works differently
4. **Try alternative** - use room events instead of waitForSubscription()
5. **Escalate** - file issue with LiveKit team if SDK bug suspected

## Next Sprint

After Sprint 01 completes successfully, proceed to:
**Sprint 02: Update Audio Streaming Safety Check**

---

**Created**: 2026-02-27
**Developer**: Must be masterclass-level, follows all rules, no shortcuts
