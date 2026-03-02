# Sprint 5: Implement STT Configuration from Database

**Sprint ID**: `agent_sprint_fixes_feb27_5`
**Priority**: 🟡 MEDIUM (Configuration & UX)
**Estimated Effort**: 2-3 hours
**Dependencies**: None

---

## Developer Guidelines ⚠️

**You are a masterclass developer that makes Google, Amazon, and Apple developers jealous.**

**CRITICAL RULES**:
1. ✅ **ALWAYS read the codebase** - Do NOT rely on documentation (may be outdated)
2. ✅ **Understand the context** - Read related files to understand data flow
3. ✅ **Do NOT guess** - Never assume property names, variable names, class names, or function signatures
4. ✅ **Read before modifying** - Use the Read tool to view files before making changes
5. ✅ **Breathe and analyze** - Think through the impact of each change
6. ✅ **Protect existing features** - Do not break dependencies or production-ready code
7. ✅ **Review your work** - Double-check every change before marking complete
8. ❌ **Single mistake = fired** - Take this seriously

**If uncertain about ANYTHING**:
- Read more files
- Search for similar patterns in the codebase
- Ask the human for clarification

---

## Problem Statement

**Issue**: The agent interrupts the caller while they're still talking.

**Root Cause**: STT (Speech-to-Text) endpointing settings are too aggressive.

**Current Hardcoded Values** (deepgram-stt.provider.ts):
```typescript
endpointing: config.endpointing ?? 500,        // 500ms = too short
utterance_end_ms: config.utterance_end_ms ?? 1500,  // 1500ms = too short
vad_events: config.vad_events ?? true,
```

**Problem**:
- 500ms endpointing means the STT finalizes after only 0.5 seconds of silence
- Normal pauses in speech (thinking, breathing) exceed this
- Agent thinks user stopped talking when they're just pausing

**Example**:
```
User: "I would like... [pause 600ms] ...to schedule a service"
STT: Finalizes after "I would like" (500ms silence detected)
Agent: "I didn't catch that, could you repeat?"
User: [frustrated] "I WAS STILL TALKING"
```

**Desired Values**:
- endpointing: 800-1000ms (allow natural pauses)
- utterance_end_ms: 2000-2500ms (wait longer before finalizing)
- These should come from database settings, not hardcoded

---

## Objective

Make STT configuration values (endpointing, utterance_end_ms, vad_events) configurable via:
1. Global defaults in `voice_ai_global_config` table
2. Tenant overrides in `tenant_voice_ai_settings` table
3. Fallback to safe defaults if not configured

---

## Files to Read (Before Starting)

1. `/api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts`
   - Lines 12-26: Current STT configuration
   - Understand how config is passed to Deepgram

2. `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
   - Lines 205-214: How STT config is currently merged
   - Understand the global → tenant override pattern

3. `/api/src/modules/voice-ai/dto/global-config-response.dto.ts`
   - Find the `default_stt_config` field
   - Understand the structure

4. `/api/src/modules/voice-ai/dto/update-global-config.dto.ts`
   - Check if STT config can be updated
   - Understand validation rules

5. `/api/prisma/schema.prisma`
   - Find `voice_ai_global_config` model
   - Find `tenant_voice_ai_settings` model
   - Check `default_stt_config` and `stt_config_override` field types

---

## Implementation Steps

### Step 1: Verify Database Schema

**File**: `/api/prisma/schema.prisma`

**Task**: Check if the STT config fields exist.

**What to Look For**:
```prisma
model voice_ai_global_config {
  // ... other fields ...
  default_stt_config String? @db.Text  // JSON string
}

model tenant_voice_ai_settings {
  // ... other fields ...
  stt_config_override String? @db.Text  // JSON string
}
```

**If Fields Exist**:
- Great! Move to Step 2

**If Fields Don't Exist**:
- You'll need to create a migration (see Step 1b)

---

### Step 1b: Create Migration (If Needed)

**Only if STT config fields are missing**

**Task**: Add the fields to store STT configuration.

**Migration SQL**:
```sql
-- Already exists in most cases, but verify
ALTER TABLE voice_ai_global_config
MODIFY COLUMN default_stt_config TEXT NULL;

ALTER TABLE tenant_voice_ai_settings
MODIFY COLUMN stt_config_override TEXT NULL;
```

**Then Update Defaults**:
```sql
UPDATE voice_ai_global_config
SET default_stt_config = JSON_SET(
  COALESCE(default_stt_config, '{}'),
  '$.endpointing', 800,
  '$.utterance_end_ms', 2000,
  '$.vad_events', true,
  '$.interim_results', true,
  '$.punctuate', true,
  '$.smart_format', true
);
```

---

### Step 2: Update Context Builder to Include STT Settings

**File**: `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`

**Task**: Ensure STT config is properly merged (global → tenant override).

**Current Code** (line 206-214):
```typescript
// Parse provider configs — tenant override takes precedence over global default
const sttConfig = this.parseJsonConfig(
  tenantSettings?.stt_config_override ?? globalConfig.default_stt_config,
);
```

**What to Verify**:
1. Is this code already there? (It should be)
2. Does `parseJsonConfig()` return a proper object?
3. Are endpointing and utterance_end_ms included?

**What to Add** (if needed):
```typescript
// Add fallback defaults if not in config
const sttConfig = {
  endpointing: 800,           // Fallback default
  utterance_end_ms: 2000,     // Fallback default
  vad_events: true,           // Fallback default
  ...this.parseJsonConfig(
    tenantSettings?.stt_config_override ?? globalConfig.default_stt_config,
  ),
};
```

**This ensures**:
- If config is missing, use safe defaults
- If config exists, it overrides defaults
- Tenant overrides global

---

### Step 3: Update Deepgram Provider to Use Config

**File**: `/api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts`

**Task**: Read endpointing and utterance_end_ms from config with fallbacks.

**Current Code** (lines 20-25):
```typescript
punctuate: config.punctuate ?? true,
interim_results: config.interim_results ?? true,
endpointing: config.endpointing ?? 500,
utterance_end_ms: config.utterance_end_ms ?? 1500,
vad_events: config.vad_events ?? true,
```

**What to Change**:
```typescript
punctuate: config.punctuate ?? true,
interim_results: config.interim_results ?? true,
endpointing: config.endpointing ?? 800,           // Changed from 500 → 800
utterance_end_ms: config.utterance_end_ms ?? 2000, // Changed from 1500 → 2000
vad_events: config.vad_events ?? true,
```

**Explanation**:
- The `??` operator provides fallback if config value is null/undefined
- Fallback values changed to more natural settings
- Config values come from database (if set) or use these fallbacks

---

### Step 4: Verify Config is Passed to Provider

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts`

**Task**: Ensure STT config from context is passed to the provider.

**What to Check**:
1. Find where `createSttProvider()` is called (line ~117)
2. Verify the config is passed correctly
3. Ensure it includes the provider config from context

**Current Code** (should look like this):
```typescript
const sttProvider = createSttProvider(this.context.providers.stt.provider_key);
```

**Then Later** (when starting transcription):
```typescript
this.sttSession = await sttProvider.startTranscription({
  apiKey: this.context.providers.stt.api_key,
  language: this.context.behavior.language,
  model: this.context.providers.stt.config?.model || 'nova-2-phonecall',
  sampleRate: 16000,
  // VERIFY THESE ARE PASSED:
  endpointing: this.context.providers.stt.config?.endpointing,
  utterance_end_ms: this.context.providers.stt.config?.utterance_end_ms,
  vad_events: this.context.providers.stt.config?.vad_events,
  // ... other configs
});
```

**What to Do**:
1. Find where `startTranscription()` is called
2. Verify config values are being passed
3. If not, add them

---

### Step 5: Update DTOs to Support STT Config

**File**: `/api/src/modules/voice-ai/dto/global-config-response.dto.ts`

**Task**: Ensure the DTO properly exposes STT config.

**What to Check**:
```typescript
@ApiProperty({
  description: 'Default STT configuration (JSON string)',
  example: '{"model":"nova-2-phonecall","endpointing":800,"utterance_end_ms":2000}',
})
default_stt_config: string;
```

**What to Verify**:
- Field exists
- Description mentions endpointing and utterance_end_ms
- Example shows the new default values

---

### Step 6: Update Admin UI Documentation

**File**: `/api/documentation/voice_ai_REST_API.md` (or similar)

**Task**: Document the STT config fields.

**What to Add**:
```markdown
### STT Configuration

The `default_stt_config` field controls Speech-to-Text behavior:

**Recommended Settings**:
```json
{
  "model": "nova-2-phonecall",
  "endpointing": 800,          // Milliseconds of silence before ending speech
  "utterance_end_ms": 2000,    // Milliseconds before finalizing transcript
  "vad_events": true,          // Enable voice activity detection
  "interim_results": true,     // Send partial results
  "punctuate": true,          // Add punctuation
  "smart_format": true        // Format numbers, dates, etc.
}
```

**Key Parameters**:
- `endpointing` (default: 800ms): How long to wait for silence before assuming user stopped speaking
  - Too low (500ms): Agent interrupts during normal pauses
  - Too high (1500ms): Slow response time
  - Recommended: 800-1000ms

- `utterance_end_ms` (default: 2000ms): How long before finalizing the transcript
  - Too low: Premature finalization, incomplete sentences
  - Too high: Delayed responses
  - Recommended: 2000-2500ms

- `vad_events` (boolean): Voice Activity Detection
  - true: Better silence detection
  - false: Simpler processing
```

---

### Step 7: Add Logging

**File**: `/api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts`

**Task**: Log the STT configuration being used.

**What to Add** (at the start of `startTranscription()`):
```typescript
async startTranscription(config: SttConfig): Promise<SttSession> {
  // Log the config for debugging
  console.log('[DeepgramSTT] Starting transcription with config:', {
    model: config.model || 'nova-2-phonecall',
    language: config.language,
    endpointing: config.endpointing ?? 800,
    utterance_end_ms: config.utterance_end_ms ?? 2000,
    vad_events: config.vad_events ?? true,
  });

  const deepgram = createClient(config.apiKey);
  // ... rest of code
}
```

**Why**:
- Helps debug interruption issues
- Confirms settings are being applied
- Tracks changes when testing different values

---

## Testing Checklist

After implementation, perform these tests:

### Test 1: Natural Speech Pauses
1. ✅ Update global STT config to use endpointing=800, utterance_end_ms=2000
2. ✅ Make a test call
3. ✅ Speak with natural pauses: "I would like... um... to schedule a service"
4. ✅ Agent should NOT interrupt during pauses
5. ✅ Check logs - verify config values are being used

### Test 2: Tenant Override
1. ✅ Set tenant override: `{ "endpointing": 1000 }`
2. ✅ Make a call to that tenant
3. ✅ Verify logs show endpointing=1000 (override)
4. ✅ Make a call to a different tenant (no override)
5. ✅ Verify logs show endpointing=800 (global default)

### Test 3: Fallback to Defaults
1. ✅ Clear the global STT config (set to null or {})
2. ✅ Make a test call
3. ✅ Verify logs show fallback values (800, 2000)
4. ✅ Call should still work normally

### Test 4: VAD Events Toggle
1. ✅ Set vad_events to false in config
2. ✅ Make a test call
3. ✅ Verify behavior changes (simpler VAD)
4. ✅ Set back to true
5. ✅ Verify improved silence detection

---

## Acceptance Criteria

**This sprint is COMPLETE when**:

- [ ] Database schema includes `default_stt_config` and `stt_config_override` fields
- [ ] Context builder merges global → tenant STT configs
- [ ] Deepgram provider uses config values with fallbacks (800, 2000, true)
- [ ] Config is passed from context → session → provider
- [ ] DTOs properly expose STT config
- [ ] Documentation explains the settings
- [ ] Logging shows active STT config
- [ ] Test 1 passes: Natural pauses don't cause interruptions
- [ ] Test 2 passes: Tenant override works
- [ ] Test 3 passes: Fallback defaults work
- [ ] Test 4 passes: VAD toggle works
- [ ] You have reviewed your code 2x before marking complete

---

## Files Modified (Summary)

Expected changes (for your review before completing):

1. `/api/prisma/migrations/[timestamp]_update_stt_defaults/migration.sql` - Update defaults (if needed)
2. `/api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` - Ensure proper merging
3. `/api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts` - Update fallback values, add logging
4. `/api/src/modules/voice-ai/dto/global-config-response.dto.ts` - Update documentation
5. `/api/documentation/voice_ai_REST_API.md` - Document STT settings

**Total Expected Changes**: 4-5 files

---

## Common Pitfalls to Avoid

1. ❌ Don't forget the `??` operator for fallbacks
2. ❌ Don't set endpointing too high (> 1500ms = slow responses)
3. ❌ Don't set utterance_end_ms too low (< 1500ms = incomplete sentences)
4. ❌ Don't skip testing with tenant overrides
5. ❌ Don't assume the config will always be present
6. ❌ Don't remove other STT settings (interim_results, punctuate, etc.)
7. ❌ Don't forget to update the documentation

---

## Success Message

When this sprint is complete, say:

**"✅ Sprint 5 Complete: STT configuration now loads from database with proper fallbacks. Interruptions reduced."**

Then provide:
- Files modified
- Test results showing natural pauses working
- Example config values from logs
- Comparison: Before (500ms) vs After (800ms) behavior

---

## Recommended Next Steps (After Testing)

1. **Monitor Production Calls**:
   - Track interruption rates
   - Measure average pause duration
   - Fine-tune endpointing based on real data

2. **A/B Testing** (Optional):
   - Test endpointing=800 vs 1000 vs 1200
   - Measure user satisfaction and call quality
   - Pick the optimal value

3. **Per-Language Tuning** (Future):
   - Some languages have different pause patterns
   - Spanish: shorter pauses
   - Japanese: longer pauses
   - Allow language-specific STT configs

---

**Remember**: You are being paid $500/hour. Take your time. Read the code. Understand the flow. Don't rush.

**Testing is Critical**: Small changes to endpointing dramatically affect UX. Test thoroughly.
