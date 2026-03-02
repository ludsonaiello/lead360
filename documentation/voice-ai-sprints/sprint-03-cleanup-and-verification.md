# Sprint 03: Cleanup and Verification

**Status**: Ready for Implementation (AFTER Sprint 01 & 02)
**Priority**: HIGH
**Estimated Time**: 20-30 minutes
**Risk Level**: Very Low
**Depends On**: Sprint 01 and Sprint 02 must be completed first

## Purpose

This sprint ensures all remaining references to `audioTrack.sid` are updated to use `audioPublication.sid`, adds proper cleanup for the publication object, and performs comprehensive end-to-end testing.

## Implementation

### File to Modify

[api/src/modules/voice-ai/agent/voice-agent.session.ts](../api/src/modules/voice-ai/agent/voice-agent.session.ts)

### Task 1: Find and Update Remaining References

Run this search to find all remaining references to `audioTrack.sid`:
```bash
grep -n "audioTrack\.sid" /var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts
```

**Expected Findings** (most should be fixed by Sprint 01 & 02):
- Lines already fixed in Sprint 01: subscriber check (line ~174-175)
- Lines already fixed in Sprint 02: safety check (line ~1082-1085)
- Potential remaining: logging statements

**Action**: Update any remaining references to use `audioPublication.sid`.

### Task 2: Update Cleanup Method

Add publication cleanup to the `cleanup()` method.

**Location**: Lines 1121-1169

**Current Code**:
```typescript
private async cleanup(): Promise<void> {
  this.logger.log('Cleaning up session resources');

  try {
    // Release audio stream reader
    if (this.audioStreamReader) {
      try {
        this.audioStreamReader.releaseLock();
        this.audioStreamReader = null;
      } catch (e) {
        // Reader may already be released
      }
    }

    // Close audio source and track
    if (this.audioSource) {
      try {
        await this.audioSource.close();
        this.audioSource = null;
      } catch (e) {
        this.logger.warn(`Error closing audio source: ${e.message}`);
      }
    }

    if (this.audioTrack) {
      try {
        await this.audioTrack.close(true); // Close and close source
        this.audioTrack = null;
      } catch (e) {
        this.logger.warn(`Error closing audio track: ${e.message}`);
      }
    }

    // Disconnect WebSocket TTS (Sprint BAS-TTS-02)
    if (this.streamingTtsProvider) {
      try {
        await this.streamingTtsProvider.disconnect();
        this.streamingTtsProvider = null;
      } catch (e) {
        this.logger.warn(`Error disconnecting streaming TTS: ${e.message}`);
      }
    }

    // ... rest of cleanup
  } catch (error) {
    // ... error handling
  }
}
```

**Add After audioTrack Cleanup** (after line ~1152):
```typescript
    // Clean up audio publication
    if (this.audioPublication) {
      try {
        // Note: Publication is automatically cleaned up when track is closed
        // We just need to null out our reference to allow garbage collection
        this.audioPublication = null;
        this.logger.log('✅ Audio publication reference cleared');
      } catch (e) {
        this.logger.warn(`Error cleaning up audio publication: ${e.message}`);
      }
    }
```

### Task 3: Add Publication State Logging

Add a method to log publication state for debugging.

**Add New Method** (before cleanup method, around line ~1070):
```typescript
/**
 * Log current state of audio publication for debugging.
 * Useful for troubleshooting audio issues.
 */
private logAudioPublicationState(): void {
  if (!this.audioPublication) {
    this.logger.debug('📊 Audio publication: null');
    return;
  }

  this.logger.debug(`📊 Audio Publication State:`);
  this.logger.debug(`  - SID: ${this.audioPublication.sid}`);
  this.logger.debug(`  - Name: ${this.audioPublication.name}`);
  this.logger.debug(`  - Kind: ${this.audioPublication.kind}`);
  this.logger.debug(`  - Muted: ${this.audioPublication.muted}`);
  this.logger.debug(`  - Track SID: ${this.audioTrack?.sid || 'null'}`);
  this.logger.debug(`  - Audio source initialized: ${this.audioSource !== null}`);
}
```

**Call This Method** in key locations:
1. After track is published (Sprint 01, line ~136)
2. Before first audio chunk is sent (Sprint 02, line ~1073)
3. If any audio errors occur (Sprint 02, line ~1103, ~1108)

### Task 4: Add Comment Documentation

Update comments to reflect the new publication-based approach.

**Location**: Near class properties (line ~44-51)

**Add Documentation Comment**:
```typescript
/**
 * Audio publication object returned by LiveKit when track is published.
 * Contains the actual track SID (not TR_unknown) and subscription status.
 * Used to verify track is ready before streaming audio chunks.
 *
 * CRITICAL: Always check this.audioPublication.sid (NOT this.audioTrack.sid)
 * when validating if audio can be streamed.
 */
private audioPublication: LocalTrackPublication | null = null;
```

### Task 5: Verify All Imports

Ensure `LocalTrackPublication` is imported.

**Location**: Line 8

**Should Look Like**:
```typescript
import {
  Room,
  RemoteTrack,
  RemoteAudioTrack,
  AudioStream,
  AudioSource,
  LocalAudioTrack,
  AudioFrame,
  TrackKind,
  TrackPublishOptions,
  LocalTrackPublication  // ← Ensure this is included
} from '@livekit/rtc-node';
```

## Testing Checklist

### Pre-Testing Preparation

- [ ] Sprint 01 completed and tested
- [ ] Sprint 02 completed and tested
- [ ] All code compiles without errors
- [ ] No TypeScript warnings or errors
- [ ] Service builds successfully (`npm run build`)
- [ ] Git diff reviewed - all changes intentional
- [ ] Service restarts cleanly without errors

### Test Scenario 1: Basic Call Flow

**Steps**:
1. Make a test call to the voice AI agent
2. Wait for greeting
3. Say "Hello"
4. Wait for agent response
5. Ask a question (e.g., "What services do you offer?")
6. Wait for agent response
7. End call

**Expected Results**:
- [ ] Call connects within 2 seconds
- [ ] Greeting plays clearly and completely
- [ ] Agent responds to "Hello" within 1-2 seconds
- [ ] Agent response is clear and audible
- [ ] Agent answers question appropriately
- [ ] Call ends cleanly without errors

**Log Verification**:
```bash
tail -100 /var/www/lead360.app/logs/npm-log.log | grep -E "(Published audio track with SID|SIP participant subscribed|Audio publication not ready|dropping chunk)"
```

**Expected**:
- ✅ "Published audio track with SID: TR_abc123..." (real SID, not TR_unknown)
- ✅ "SIP participant subscribed - ready to stream audio"
- ❌ NO "Audio publication not ready" warnings
- ❌ NO "dropping chunk" warnings

### Test Scenario 2: Barge-In (Interruption)

**Steps**:
1. Make a call
2. Wait for greeting to start
3. Interrupt by speaking while agent is talking
4. Verify agent stops and listens

**Expected Results**:
- [ ] Agent stops speaking when interrupted
- [ ] Agent listens to user's new input
- [ ] Agent responds to new input (not old greeting)
- [ ] No audio glitches or overlaps

**Log Verification**:
```bash
tail -200 /var/www/lead360.app/logs/npm-log.log | grep -E "(Barge-in detected|cancelled_context)"
```

**Expected**:
- ✅ "🛑 Barge-in detected: User interrupted with ..."
- ✅ Cancelled context logged
- ❌ NO audio errors during interruption

### Test Scenario 3: Long Conversation

**Steps**:
1. Make a call
2. Have a 5-turn conversation (10 messages total)
3. Include pauses, interruptions, and questions
4. End call

**Expected Results**:
- [ ] All 5 agent responses are heard clearly
- [ ] No degradation in audio quality over time
- [ ] No memory leaks (check logs for warnings)
- [ ] Call ends cleanly after 2+ minutes

**Log Verification**:
```bash
tail -500 /var/www/lead360.app/logs/npm-log.log | grep -E "(Audio chunk|captureFrame|memory)"
```

**Expected**:
- ✅ Consistent "🔊 Audio chunk" logs throughout call
- ❌ NO "Failed to capture audio frame" errors
- ❌ NO memory warnings

### Test Scenario 4: Concurrent Calls

**Steps**:
1. Make 2-3 simultaneous calls from different numbers
2. Verify each call has working audio independently
3. End all calls

**Expected Results**:
- [ ] Each call has its own audio track and publication
- [ ] No crosstalk between calls
- [ ] All callers hear their respective agents
- [ ] Service handles load without issues

**Log Verification**:
```bash
tail -1000 /var/www/lead360.app/logs/npm-log.log | grep "Published audio track with SID" | wc -l
```

**Expected**:
- ✅ Should see 2-3 different publications (one per call)
- ✅ Each with unique SID
- ❌ NO shared publications between calls

### Test Scenario 5: Error Handling

**Steps**:
1. Make a call
2. Force an error (e.g., kill Cartesia connection, network issue)
3. Verify graceful degradation

**Expected Results**:
- [ ] Error is logged clearly
- [ ] Call doesn't crash service
- [ ] Cleanup happens properly
- [ ] Next call works normally

## Final Verification Checklist

### Code Quality

- [ ] No TODOs or mock code
- [ ] No hardcoded URLs that shouldn't be there
- [ ] All error paths handled
- [ ] Logging is comprehensive but not excessive
- [ ] Variable names are descriptive
- [ ] Comments explain WHY not WHAT
- [ ] No breaking changes to existing API
- [ ] TypeScript types are correct (no unnecessary `any`)
- [ ] Memory leaks prevented (cleanup in finally blocks)

### Documentation

- [ ] Comments added for audioPublication field
- [ ] Sprint documentation is accurate
- [ ] Any deviations from original plan documented
- [ ] Known issues or limitations documented

### Performance

- [ ] No performance degradation
- [ ] Audio latency is acceptable (<500ms time-to-first-audio)
- [ ] Service handles concurrent calls
- [ ] Memory usage is stable

### Integration

- [ ] STT (speech-to-text) still works
- [ ] LLM (language model) still works
- [ ] TTS (text-to-speech) still works
- [ ] Barge-in still works
- [ ] Tool calling still works
- [ ] Call transfer still works (if applicable)
- [ ] Filler phrases still work (if applicable)
- [ ] Long-wait monitor still works (if applicable)

## Success Criteria

✅ **Sprint 03 is complete when**:

1. All references to `audioTrack.sid` are updated to use `audioPublication.sid`
2. Cleanup method properly releases publication reference
3. All 5 test scenarios pass
4. No "dropping chunk" warnings in any test
5. Caller hears all audio clearly and consistently
6. No new errors introduced
7. Code quality checklist 100% complete
8. Documentation is accurate and complete

❌ **Sprint 03 has failed if**:

1. Any test scenario fails
2. "Dropping chunk" warnings still appear
3. New errors introduced
4. Performance degradation observed
5. Memory leaks detected
6. Concurrent calls don't work
7. Code quality issues found

## Rollback Plan

If Sprint 03 reveals issues:

1. **Isolate the issue** - which test scenario failed?
2. **Check previous sprints** - are Sprints 01 and 02 stable?
3. **Review logs** - what's the exact error?
4. **Fix incrementally** - one issue at a time
5. **Retest** - verify fix doesn't break other scenarios
6. **Document** - update sprint notes with learnings

## Deployment Checklist

### Before Deploying to Production

- [ ] All sprints (01, 02, 03) completed successfully
- [ ] All tests pass in development environment
- [ ] Code review completed (if applicable)
- [ ] Git commits are clean with clear messages
- [ ] Backup of current production code taken
- [ ] Rollback plan is ready
- [ ] Monitoring is in place
- [ ] Alert thresholds configured

### During Deployment

- [ ] Deploy during low-traffic period
- [ ] Monitor logs in real-time
- [ ] Test one call immediately after deployment
- [ ] Verify no errors in first 5 minutes
- [ ] Check resource usage (CPU, memory)
- [ ] Monitor concurrent call handling

### After Deployment

- [ ] Test calls from different numbers
- [ ] Monitor error rates for 24 hours
- [ ] Check audio quality reports
- [ ] Verify no degradation in other features
- [ ] Document any issues or learnings
- [ ] Update sprint status to COMPLETED

## Common Issues & Solutions

### Issue: "Audio publication: null" in logs

**Cause**: Publication not assigned in Sprint 01
**Solution**: Review Sprint 01 implementation, ensure `this.audioPublication = await ...` is correct

### Issue: SID still showing TR_unknown after all sprints

**Cause**: LiveKit SDK version issue or incorrect SDK usage
**Solution**: Check SDK version, review LiveKit documentation, try alternative approach

### Issue: First audio chunk still dropped

**Cause**: Race condition - chunk arrives before waitForSubscription() completes
**Solution**: Add small buffer or delay before first chunk

### Issue: Memory usage increases over time

**Cause**: Publication or track references not cleaned up
**Solution**: Review cleanup() method, ensure all resources are nulled

## Next Steps

After Sprint 03 is complete:

1. **Mark issue as RESOLVED** in project tracking
2. **Update documentation** with final implementation notes
3. **Share learnings** with team
4. **Monitor production** for 1 week to ensure stability
5. **Plan future enhancements** (if any)

---

**Created**: 2026-02-27
**Developer**: Must be masterclass-level, follows all rules, no shortcuts
**Dependencies**: Sprint 01 (SID Assignment) + Sprint 02 (Safety Check)
**Final Sprint**: This completes the audio silence fix
