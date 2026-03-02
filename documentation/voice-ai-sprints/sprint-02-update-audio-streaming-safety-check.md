# Sprint 02: Update Audio Streaming Safety Check

**Status**: Ready for Implementation (AFTER Sprint 01)
**Priority**: CRITICAL
**Estimated Time**: 15-20 minutes
**Risk Level**: Low
**Depends On**: Sprint 01 must be completed first

## Problem Statement

The `streamAudioChunkToLiveKit()` method checks `this.audioTrack.sid` to verify the track is ready before sending audio. However, this check is looking at the wrong object - it should check `this.audioPublication.sid` instead.

**Current Broken Check** (Line 1082-1085):
```typescript
if (!this.audioTrack?.sid || this.audioTrack.sid === 'TR_unknown') {
  this.logger.warn(`Audio track not ready (SID: ${this.audioTrack?.sid || 'null'}) - dropping chunk`);
  return;
}
```

This causes **all** audio chunks to be dropped even after Sprint 01 fixes the publication assignment.

## Why This Check Exists

According to comments in the code (lines 1079-1081):
> FIX BUG A (STEP 3): Safety check - verify track is ready before capturing frames
> If track SID is not assigned, captureFrame() will throw InvalidState error

This is a **valid safety check** - we must verify the track is ready before calling `audioSource.captureFrame()`. We're not removing the check, just fixing what it checks.

## Implementation

### File to Modify

[api/src/modules/voice-ai/agent/voice-agent.session.ts](../api/src/modules/voice-ai/agent/voice-agent.session.ts)

### Changes Required

#### Update streamAudioChunkToLiveKit Method (Lines 1072-1110)

**Current Code**:
```typescript
private streamAudioChunkToLiveKit(audioData: Buffer): void {
  if (!this.audioSource) {
    this.logger.warn('Audio source not initialized - dropping chunk');
    return;
  }

  // ====================================================================================
  // FIX BUG A (STEP 3): Safety check - verify track is ready before capturing frames
  // If track SID is not assigned, captureFrame() will throw InvalidState error
  // ====================================================================================
  if (!this.audioTrack?.sid || this.audioTrack.sid === 'TR_unknown') {
    this.logger.warn(`Audio track not ready (SID: ${this.audioTrack?.sid || 'null'}) - dropping chunk`);
    return;
  }

  try {
    // Convert Buffer to Int16Array (PCM s16le format)
    const int16Array = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2, // 2 bytes per Int16 sample
    );

    const sampleRate = 16000;
    const numChannels = 1;
    const samplesPerChannel = int16Array.length;

    // Create and send audio frame immediately
    const audioFrame = new AudioFrame(int16Array, sampleRate, numChannels, samplesPerChannel);

    // Send frame asynchronously (don't block WebSocket callback)
    this.audioSource.captureFrame(audioFrame).catch(error => {
      this.logger.error(`Failed to capture audio frame: ${error.message}`);
    });

  } catch (error) {
    this.logger.error(`Error streaming audio chunk to LiveKit: ${error.message}`);
  }
}
```

**Replace With**:
```typescript
private streamAudioChunkToLiveKit(audioData: Buffer): void {
  if (!this.audioSource) {
    this.logger.warn('Audio source not initialized - dropping chunk');
    return;
  }

  // ====================================================================================
  // Safety check: Verify publication exists and has valid SID before capturing frames
  // If track is not properly published, captureFrame() will throw InvalidState error
  // ====================================================================================
  if (!this.audioPublication || !this.audioPublication.sid || this.audioPublication.sid === 'TR_unknown') {
    this.logger.warn(`Audio publication not ready (SID: ${this.audioPublication?.sid || 'null'}) - dropping chunk`);
    return;
  }

  try {
    // Convert Buffer to Int16Array (PCM s16le format)
    const int16Array = new Int16Array(
      audioData.buffer,
      audioData.byteOffset,
      audioData.length / 2, // 2 bytes per Int16 sample
    );

    const sampleRate = 16000;
    const numChannels = 1;
    const samplesPerChannel = int16Array.length;

    // Create and send audio frame immediately
    const audioFrame = new AudioFrame(int16Array, sampleRate, numChannels, samplesPerChannel);

    // Send frame asynchronously (don't block WebSocket callback)
    this.audioSource.captureFrame(audioFrame).catch(error => {
      this.logger.error(`Failed to capture audio frame: ${error.message}`);
      this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
      this.logger.error(`  Audio source state: ${this.audioSource ? 'initialized' : 'null'}`);
    });

  } catch (error) {
    this.logger.error(`Error streaming audio chunk to LiveKit: ${error.message}`);
    this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
    this.logger.error(`  Buffer length: ${audioData.length} bytes`);
  }
}
```

### Key Changes

1. **Line 1082**: Check `this.audioPublication` instead of `this.audioTrack`
2. **Line 1083**: Log publication SID instead of track SID
3. **Lines 1103-1106**: Enhanced error logging with publication SID and audio source state
4. **Lines 1108-1111**: Enhanced error logging with publication SID and buffer details

## Masterclass Developer Rules

### Before Writing Code

1. **Read the entire streamAudioChunkToLiveKit method** (lines 1072-1110)
2. **Understand the flow** - audio chunks come from Cartesia → this method → LiveKit
3. **Review Sprint 01** - ensure audioPublication field was added correctly
4. **Verify the safety check is still needed** - yes, prevents InvalidState error
5. **Check if other methods reference this.audioTrack.sid** - update them too

### While Writing Code

1. **Preserve the safety check logic** - only change what object is checked
2. **Enhance error logging** - help debug future issues
3. **Don't change audio processing logic** - Int16Array conversion is correct
4. **Keep async error handling** - `.catch()` on captureFrame is correct
5. **No hardcoded values** - sample rate, channels are already correct
6. **Comments accurate** - update comment to say "publication" not "track SID"

### After Writing Code

1. **Verify compilation** - `npm run build` in /var/www/lead360.app/api
2. **Check references** - search for other uses of `this.audioTrack.sid`
3. **Review error paths** - ensure all errors are logged
4. **Prepare for testing** - restart service before test call

## Testing Checklist

### Pre-Testing

- [ ] Sprint 01 completed successfully
- [ ] Code compiles without errors
- [ ] No TypeScript warnings
- [ ] Git diff reviewed (all changes intentional)
- [ ] Service restarts cleanly

### During Test Call

Monitor logs for:
- [ ] ❌ NO "Audio publication not ready" warnings
- [ ] ✅ "🔊 Audio chunk: XXX bytes" logs (from Cartesia)
- [ ] ❌ NO "Failed to capture audio frame" errors
- [ ] ❌ NO "Error streaming audio chunk to LiveKit" errors

Manual verification:
- [ ] Caller hears greeting clearly
- [ ] Caller asks a question
- [ ] Caller hears agent response
- [ ] Test 3-5 conversation turns
- [ ] Audio is clear and not choppy
- [ ] No delays or pauses

### Post-Testing

- [ ] No errors in logs
- [ ] All audio chunks were processed successfully
- [ ] Call ended cleanly
- [ ] Ready for Sprint 03 (if needed)

## Success Criteria

✅ **Sprint 02 is complete when**:

1. Safety check uses `this.audioPublication.sid` (not `this.audioTrack.sid`)
2. Zero "dropping chunk" warnings during test call
3. Caller hears all agent responses clearly
4. No "Failed to capture audio frame" errors
5. Logs show successful audio streaming

❌ **Sprint 02 has failed if**:

1. Still seeing "dropping chunk" warnings
2. "Failed to capture audio frame" errors appear
3. Caller hears partial/choppy audio
4. New errors in logs
5. Service crashes during call

## Rollback Plan

If this sprint fails:

1. **Check Sprint 01** - is audioPublication properly assigned?
2. **Debug logging** - add temporary logs to see what's happening
3. **Verify LiveKit SDK** - is captureFrame() working correctly?
4. **Review audio format** - is Int16Array conversion correct?
5. **Revert if needed** - restore original code and investigate further

## Additional Checks

### Search for Other References to audioTrack.sid

Run this command to find all references:
```bash
grep -n "audioTrack\.sid" /var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts
```

**Expected Results**: Should find references only in:
- Line ~174-175 (subscriber check) - already fixed in Sprint 01
- Line ~244 (logging) - should update to use audioPublication.sid

**Action**: Update any remaining references to use `audioPublication.sid`.

### Verify Cleanup Method

Check the cleanup() method (lines 1121-1169) to ensure it properly cleans up the publication:

**Add to cleanup()** (after line 1152):
```typescript
// Clean up audio publication
if (this.audioPublication) {
  try {
    // Publication cleanup is handled by track cleanup
    // Just null out our reference
    this.audioPublication = null;
  } catch (e) {
    this.logger.warn(`Error cleaning up audio publication: ${e.message}`);
  }
}
```

## Next Sprint

After Sprint 02 completes successfully:
- **If audio works perfectly**: Mark issue as RESOLVED
- **If other issues appear**: Create Sprint 03 to address them

## Common Issues & Solutions

### Issue: "Failed to capture audio frame: InvalidState"

**Cause**: Track not fully ready despite publication having SID
**Solution**: Add small delay before first captureFrame call

### Issue: Audio is choppy or has gaps

**Cause**: Audio chunks arriving faster than they can be sent
**Solution**: Check if buffering is needed (unlikely with 16kHz audio)

### Issue: First few audio chunks still dropped

**Cause**: Race condition - chunks arrive before publication ready
**Solution**: Already handled by waitForSubscription() in Sprint 01

---

**Created**: 2026-02-27
**Developer**: Must be masterclass-level, follows all rules, no shortcuts
**Dependencies**: Sprint 01 (Fix Audio Track SID Assignment)
