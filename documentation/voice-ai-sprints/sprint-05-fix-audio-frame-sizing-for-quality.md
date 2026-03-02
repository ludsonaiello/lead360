# Sprint 05: Fix Audio Frame Sizing for Quality

**Status**: Ready for Implementation (URGENT - CRITICAL BUG)
**Priority**: P0 - CRITICAL
**Estimated Time**: 20-30 minutes
**Risk Level**: Low
**Depends On**: Sprints 01-04 must be completed

---

## Problem Statement

**User Report:** "The voice is being heard, but it's too fast or cutting, looking like a really bad phone call. I couldn't understand quite nothing - she was always cutting herself."

**Technical Diagnosis:** The `streamAudioChunkToLiveKit()` method sends large audio frames (104ms) without proper frame splitting or pacing. This violates real-time audio streaming requirements and causes choppy, unintelligible audio.

**Impact:**
- ❌ Users cannot understand the agent
- ❌ Audio sounds like a bad phone call
- ❌ Choppy/cutting audio
- ❌ Voice AI is unusable

**Log Evidence:**
```
[7:16:45 PM] 🔊 Audio chunk: 3344 bytes, context: turn-1772219805014, done: false
[7:16:45 PM] 🔊 Audio chunk: 3344 bytes, context: turn-1772219805014, done: false
[7:16:45 PM] 🔊 Audio chunk: 3256 bytes, context: turn-1772219805014, done: false
... (dozens of chunks arriving rapidly)
```

**What's Happening:**
1. Cartesia sends audio chunks (~3344 bytes = 1672 samples = 104ms of audio)
2. Code creates ONE large AudioFrame from entire chunk
3. Sends frame to LiveKit immediately with `.catch()` (fire-and-forget, no pacing)
4. Multiple large frames arrive rapidly, overwhelming LiveKit's jitter buffer
5. Audio playback is choppy/unintelligible

---

## Root Cause

### Current Broken Code (Lines 1113-1140)

**Location:** `api/src/modules/voice-ai/agent/voice-agent.session.ts:1098-1140`

```typescript
private streamAudioChunkToLiveKit(audioData: Buffer): void {
  if (!this.audioSource) {
    this.logger.warn('Audio source not initialized - dropping chunk');
    return;
  }

  // Safety check: Verify publication exists
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

    // ❌ PROBLEM: Creates ONE large frame from entire chunk
    const audioFrame = new AudioFrame(int16Array, sampleRate, numChannels, samplesPerChannel);

    // ❌ PROBLEM: Fire-and-forget (no pacing)
    this.audioSource.captureFrame(audioFrame).catch(error => {
      this.logger.error(`Failed to capture audio frame: ${error.message}`);
    });

  } catch (error) {
    this.logger.error(`Error streaming audio chunk to LiveKit: ${error.message}`);
  }
}
```

**Problems:**
1. ❌ **Large frames:** 104ms+ of audio per frame (should be 10-20ms)
2. ❌ **No pacing:** `.catch()` is fire-and-forget, sends frames as fast as possible
3. ❌ **Violates real-time streaming:** LiveKit expects small, paced frames
4. ❌ **Jitter buffer overflow:** Too much audio arriving too fast

---

### Working Code Reference (Lines 856-913)

The old `speak()` method correctly splits audio into small frames:

```typescript
// Split audio into frames (10ms chunks = 160 samples at 16kHz)
const frameSizeMs = 10;
const samplesPerFrame = (sampleRate * frameSizeMs) / 1000;
const totalFrames = Math.ceil(samplesPerChannel / samplesPerFrame);

for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
  const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
  const frameData = int16Array.slice(i, i + frameLength);
  const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);

  try {
    // ✅ Sequential await provides natural pacing
    await this.audioSource.captureFrame(audioFrame);
    framesSent++;
  } catch (error) {
    // Handle error
  }
}
```

**Why This Works:**
1. ✅ **Small frames:** 10ms = 160 samples per frame
2. ✅ **Sequential delivery:** `await` provides natural pacing
3. ✅ **Real-time compliant:** Matches VoIP standards
4. ✅ **Smooth playback:** LiveKit can buffer and play correctly

---

## Implementation

### File to Modify

**[api/src/modules/voice-ai/agent/voice-agent.session.ts](../api/src/modules/voice-ai/agent/voice-agent.session.ts)**

### Changes Required

There are **TWO changes** needed in this file:

1. **Update method signature and implementation** (lines 1098-1140)
2. **Update caller to handle async** (line 352)

#### Current Code (DELETE):

```typescript
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
```

#### New Code (REPLACE WITH):

```typescript
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

    // ====================================================================================
    // FIX: Split audio into 10ms frames for proper real-time streaming
    // Large frames (100ms+) cause choppy audio - LiveKit expects small, paced frames.
    // This matches the working approach in speak() method (lines 856-913).
    // ====================================================================================
    const frameSizeMs = 10;
    const samplesPerFrame = (sampleRate * frameSizeMs) / 1000; // 160 samples at 16kHz

    // Process each 10ms frame sequentially
    for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
      const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
      const frameData = int16Array.slice(i, i + frameLength);

      // Create audio frame (10ms of audio)
      const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);

      // Send frame sequentially - await provides natural pacing for smooth playback
      try {
        await this.audioSource.captureFrame(audioFrame);
      } catch (error) {
        this.logger.error(`Failed to capture audio frame (offset ${i}/${samplesPerChannel} samples): ${error.message}`);
        this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
        this.logger.error(`  Frame samples: ${frameLength}`);
        this.logger.error(`  Total chunk samples: ${samplesPerChannel}`);
        throw error; // Stop processing on frame error
      }
    }

  } catch (error) {
    this.logger.error(`Error streaming audio chunk to LiveKit: ${error.message}`);
    this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
    this.logger.error(`  Buffer length: ${audioData.length} bytes`);
    this.logger.error(`  Samples: ${audioData.length / 2}`);
  }
```

---

## Key Changes Explained

### 1. Frame Splitting (Lines ~1127-1134)

**Old:**
```typescript
const audioFrame = new AudioFrame(int16Array, sampleRate, numChannels, samplesPerChannel);
// One large frame (100ms+ of audio)
```

**New:**
```typescript
const frameSizeMs = 10;
const samplesPerFrame = (sampleRate * frameSizeMs) / 1000; // 160 samples

for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
  const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
  const frameData = int16Array.slice(i, i + frameLength);
  const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);
  // Multiple small frames (10ms each)
}
```

**Why:** LiveKit expects small, paced frames for smooth real-time playback. 10ms is industry standard for VoIP.

### 2. Sequential Delivery (Line ~1137)

**Old:**
```typescript
this.audioSource.captureFrame(audioFrame).catch(error => {
  // Fire-and-forget, no pacing
});
```

**New:**
```typescript
await this.audioSource.captureFrame(audioFrame);
// Sequential, natural pacing from async/await
```

**Why:** `await` forces each frame to complete before sending the next, providing natural pacing that matches real-time playback.

### 3. Error Handling (Lines ~1138-1145)

**Old:**
```typescript
this.audioSource.captureFrame(audioFrame).catch(error => {
  this.logger.error(`Failed to capture audio frame: ${error.message}`);
  // Continues processing even if frame fails
});
```

**New:**
```typescript
try {
  await this.audioSource.captureFrame(audioFrame);
} catch (error) {
  this.logger.error(`Failed to capture audio frame (offset ${i}/${samplesPerChannel} samples): ${error.message}`);
  this.logger.error(`  Frame samples: ${frameLength}`);
  throw error; // Stop processing on frame error
}
```

**Why:** If a frame fails, we should stop processing to prevent partial/corrupted audio. Enhanced logging helps debugging.

### 4. Method Signature Change

**IMPORTANT:** The method must become `async`:

**Old:**
```typescript
private streamAudioChunkToLiveKit(audioData: Buffer): void {
```

**New:**
```typescript
private async streamAudioChunkToLiveKit(audioData: Buffer): Promise<void> {
```

**Why:** We're using `await` inside the method now.

---

## Change #2: Update Caller to Handle Async (Line 352)

### Current Code (Line 343-360):

```typescript
      this.streamingTtsProvider.onAudioChunk((contextId, audioData, isDone) => {
        // Sprint Voice-UX-01: Support background contexts (filler, longwait) in addition to main context
        // Sprint 04: Removed && this.isAgentSpeaking check - audio should play even if it arrives after timeout
        const isMainContext = contextId === this.currentTtsContextId;
        const isBackgroundContext = contextId.startsWith('longwait-') || contextId.startsWith('filler-');

        // Process audio for current main context OR background contexts
        // Audio will play even if it arrives after timeout (isAgentSpeaking = false)
        if ((isMainContext || isBackgroundContext) && audioData.length > 0) {
          this.streamAudioChunkToLiveKit(audioData);  // ❌ PROBLEM: Not handling Promise
        }

        // Only manage isAgentSpeaking flag for main context (not background contexts)
        if (isDone && contextId === this.currentTtsContextId) {
          this.isAgentSpeaking = false;
          this.logger.log(`✅ TTS complete for context: ${contextId}`);
        }
      });
```

### New Code (Line 343-360):

```typescript
      this.streamingTtsProvider.onAudioChunk((contextId, audioData, isDone) => {
        // Sprint Voice-UX-01: Support background contexts (filler, longwait) in addition to main context
        // Sprint 04: Removed && this.isAgentSpeaking check - audio should play even if it arrives after timeout
        const isMainContext = contextId === this.currentTtsContextId;
        const isBackgroundContext = contextId.startsWith('longwait-') || contextId.startsWith('filler-');

        // Process audio for current main context OR background contexts
        // Audio will play even if it arrives after timeout (isAgentSpeaking = false)
        if ((isMainContext || isBackgroundContext) && audioData.length > 0) {
          // Handle async streaming - don't await to avoid blocking callback
          this.streamAudioChunkToLiveKit(audioData).catch(error => {
            this.logger.error(`Error in audio streaming callback: ${error.message}`);
            this.logger.error(`  Context: ${contextId}`);
            this.logger.error(`  Buffer length: ${audioData.length} bytes`);
          });
        }

        // Only manage isAgentSpeaking flag for main context (not background contexts)
        if (isDone && contextId === this.currentTtsContextId) {
          this.isAgentSpeaking = false;
          this.logger.log(`✅ TTS complete for context: ${contextId}`);
        }
      });
```

### Why This Change is Needed

**Problem:** The callback is synchronous, but `streamAudioChunkToLiveKit` is now async. If we don't handle the Promise:
1. Unhandled Promise rejections if errors occur
2. No error logging (errors swallowed)
3. Potential crashes in production

**Solution:** Use `.catch()` to handle errors without blocking the callback.

**Why not `await`?**
- Callback is synchronous (can't make it async without breaking WebSocket handler)
- Don't want to block callback (Cartesia sends chunks rapidly)
- `.catch()` handles errors without blocking

---

## Performance Analysis

### Frame Calculation

**Cartesia Chunk:**
- Size: ~3344 bytes
- Samples: 1672 (3344 ÷ 2 bytes/sample)
- Duration: 104ms (1672 ÷ 16000 Hz)

**New Frame Size:**
- Duration: 10ms
- Samples: 160 (16000 Hz × 0.01s)
- Bytes: 320 (160 × 2 bytes/sample)

**Frames per Chunk:**
- 1672 samples ÷ 160 samples/frame = ~10.5 frames

### Latency Impact

**Old Approach:**
- Send 1 large frame immediately: ~1ms
- Audio is choppy/broken ❌

**New Approach:**
- Send 10 small frames sequentially: ~10-15ms
- Audio is clear and intelligible ✅

**Net Impact:**
- Adds 10-15ms per Cartesia chunk
- BUT audio quality goes from BROKEN to WORKING
- User experience: **VASTLY IMPROVED**

**Is this acceptable?**
- ✅ YES - 10-15ms is negligible for voice calls
- ✅ Industry standard VoIP latency: 150-300ms end-to-end
- ✅ Our addition: ~10-15ms (minimal)
- ✅ Benefit: Audio goes from unintelligible to clear

---

## Masterclass Developer Rules

### Before Writing Code

1. **Read the entire streamAudioChunkToLiveKit method** (lines 1098-1140)
2. **Read the working speak method** (lines 820-928) - understand how it splits frames
3. **Understand why large frames break audio** - jitter buffer overflow, timing violations
4. **Verify the frame size calculation** - 10ms = 160 samples at 16kHz
5. **Understand async/await pacing** - how `await` provides natural timing

### While Writing Code

1. **No rushing** - this is a critical fix, get it right
2. **Match the working pattern** - copy the frame splitting logic from `speak()`
3. **Preserve safety checks** - keep publication SID validation
4. **Add comprehensive logging** - offset, frame size, total samples
5. **Handle errors properly** - stop on first frame error (throw)
6. **Update method signature** - make it `async` for `await` support
7. **No hardcoded values** - use constants (sampleRate, frameSizeMs)
8. **Comments explain WHY** - not WHAT (code is self-documenting)

### After Writing Code

1. **Verify compilation** - `npm run build` in /var/www/lead360.app/api
2. **Review diff** - every line changed should have a reason
3. **Check caller of streamAudioChunkToLiveKit** - ensure it can handle async
4. **No breaking changes** - method signature compatible
5. **Prepare for testing** - restart service before test call

---

## Testing Checklist

### Pre-Testing

- [ ] Sprints 01-04 completed successfully
- [ ] Code compiles without errors
- [ ] No TypeScript warnings
- [ ] Method signature updated to `async`
- [ ] Git diff reviewed (all changes intentional)
- [ ] Service restarts cleanly

### Test Scenario 1: Audio Quality (CRITICAL)

**Steps:**
1. Make a test call
2. Listen to agent greeting carefully
3. Ask a question
4. Listen to agent response carefully

**Expected Results:**
- [ ] Audio is **clear** (no choppy sound)
- [ ] Audio is **intelligible** (can understand every word)
- [ ] No cutting or skipping
- [ ] Sounds like a **normal phone call**
- [ ] No "bad connection" feeling

### Test Scenario 2: Long Response

**Steps:**
1. Make a test call
2. Ask agent to explain services (triggers long response)
3. Listen carefully to entire response

**Expected Results:**
- [ ] Entire response is clear from start to finish
- [ ] No degradation over time
- [ ] Consistent quality throughout
- [ ] No accumulated latency

### Test Scenario 3: Multiple Turns

**Steps:**
1. Make a test call
2. Have a 5-turn conversation
3. Listen carefully to all agent responses

**Expected Results:**
- [ ] All 5 responses are clear
- [ ] No quality degradation over conversation
- [ ] No accumulated delays
- [ ] Call quality remains consistent

### Test Scenario 4: Log Verification

**Check logs for:**
```bash
tail -200 /var/www/lead360.app/logs/npm-log.log | grep -E "(Audio chunk|captureFrame|Failed to capture)"
```

**Expected:**
- [ ] Still seeing "🔊 Audio chunk: XXX bytes" from Cartesia (proves chunks arriving)
- [ ] NO "Failed to capture audio frame" errors
- [ ] NO "dropping chunk" warnings
- [ ] NO frame capture errors

### Test Scenario 5: Side-by-Side Comparison

**If possible:**
1. Have recording of old choppy audio
2. Make new call after fix
3. Compare audio quality

**Expected:**
- [ ] New audio is **dramatically better**
- [ ] New audio is intelligible
- [ ] Sounds like night-and-day difference

---

## Success Criteria

✅ **Sprint 05 is complete when:**

1. **Audio quality is PERFECT:**
   - Caller can understand **every word**
   - Audio sounds like a normal phone call
   - No choppy/cutting sound
   - No skipping or artifacts

2. **Technical verification:**
   - Audio frames split into 10ms chunks
   - Frames sent sequentially with `await`
   - No frame capture errors in logs

3. **User experience:**
   - Caller can have full conversation with agent
   - No complaints about audio quality
   - Voice AI is **usable**

4. **Code quality:**
   - No compilation errors
   - Method signature correct (`async`)
   - Error handling proper
   - Logging comprehensive

❌ **Sprint 05 has failed if:**

1. Audio still choppy/cutting
2. Caller cannot understand agent
3. Frame capture errors appear
4. Service crashes during call
5. New errors introduced

---

## Rollback Plan

If this sprint fails:

1. **Revert changes** to voice-agent.session.ts
2. **Document failure** - what was tried, what happened
3. **Try alternative frame size** - 20ms instead of 10ms
4. **Investigate LiveKit docs** - check for AudioStream API alternative
5. **Escalate** - file issue with LiveKit team if SDK behavior is unexpected

---

## Caller Location Analysis

**Where is streamAudioChunkToLiveKit called?**

Search for references:
```bash
grep -n "streamAudioChunkToLiveKit" /var/www/lead360.app/api/src/modules/voice-ai/agent/voice-agent.session.ts
```

**Expected caller:** Cartesia WebSocket TTS callback (registered in `connect()` or similar)

**Important:** Verify the caller can handle the method becoming `async`. If it's a callback, ensure it's not expecting synchronous behavior.

**Check in Cartesia provider:**
```bash
grep -n "streamAudioChunkToLiveKit\|audioCallback" /var/www/lead360.app/api/src/modules/voice-ai/agent/providers/cartesia-websocket-tts.provider.ts
```

**Action:** If callback expects `void`, wrap in async IIFE or handle Promise properly.

---

## Additional Verification

### Check Method Signature Compatibility

**Before changing to async:**

1. Find all callers of `streamAudioChunkToLiveKit`
2. Verify they can handle `Promise<void>` return type
3. If callback-based, ensure Promise is handled (don't block callback)

**Example fix if needed:**
```typescript
// If callback can't handle Promise:
this.streamAudioChunkToLiveKit(buffer).catch(error => {
  this.logger.error(`Async streaming error: ${error.message}`);
});
```

### Frame Size Validation

**Double-check math:**
- Sample rate: 16000 Hz
- Frame duration: 10ms = 0.01 seconds
- Samples per frame: 16000 × 0.01 = 160 samples
- Bytes per frame: 160 × 2 = 320 bytes

**Typical Cartesia chunk:**
- Bytes: 3344
- Samples: 1672
- Frames: 1672 ÷ 160 = 10.45 frames (some chunks will have 10, some 11)

✅ **Math is correct**

---

## Next Sprint

After Sprint 05 completes successfully:

**If audio works perfectly:**
- ✅ Mark audio issue as **RESOLVED**
- ✅ Update sprint documentation
- ✅ Move on to other features (Admin UI, etc.)

**If minor issues remain:**
- Create Sprint 06 to address them
- Document specific issues found
- Plan incremental improvements

---

## Common Issues & Solutions

### Issue: "Method signature incompatible"

**Cause:** Caller expects `void`, but method now returns `Promise<void>`

**Solution:**
```typescript
// Wrap call in async handler
this.streamAudioChunkToLiveKit(buffer).catch(error => {
  this.logger.error(`Streaming error: ${error.message}`);
});
```

### Issue: "Audio still choppy but less than before"

**Cause:** 10ms frames might still be too large for current network conditions

**Solution:** Try 5ms frames instead:
```typescript
const frameSizeMs = 5;
const samplesPerFrame = (sampleRate * frameSizeMs) / 1000; // 80 samples
```

### Issue: "Frames are being sent but audio is silent again"

**Cause:** Likely broke something in conversion or frame creation

**Solution:**
- Check `int16Array.slice()` returns correct data
- Verify `frameData` is not empty
- Add debug logging to see frame contents

### Issue: "Service performance degraded"

**Cause:** Awaiting each frame adds overhead

**Solution:**
- Profile to confirm this is actually the bottleneck
- If confirmed, try batching frames (send 2-3 at a time)
- Or use setImmediate() for pseudo-async pacing

---

## References

- [Working speak() method](../api/src/modules/voice-ai/agent/voice-agent.session.ts#L820-L928) - Reference implementation
- [LiveKit AudioFrame documentation](https://docs.livekit.io/) - Frame requirements
- [VoIP standards](https://tools.ietf.org/html/rfc3550) - RTP frame sizing (10-20ms typical)

---

## Changelog

| Date | Version | Changes | Developer |
|------|---------|---------|-----------|
| 2026-02-27 | 1.0 | Initial sprint created - fix audio frame sizing | System |

---

**Created**: 2026-02-27
**Developer**: Must be masterclass-level, follows all rules, no shortcuts, no rushing
**Dependencies**: Sprint 01 (SID Assignment) + Sprint 02 (Safety Check) + Sprint 03 (Cleanup)
**Critical Sprint**: This fixes the CRITICAL audio quality bug making Voice AI unusable

---

**End of Sprint 05 Documentation**
