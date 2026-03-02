# Sprint 3: Fix "Let Me Check" Prompt Timing

**Sprint ID**: `agent_sprint_fixes_feb27_3`
**Priority**: 🟠 HIGH (UX Quality)
**Estimated Effort**: 1-2 hours
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

**Issue**: The agent says "Let me check..." but doesn't actually call the tool until the NEXT interaction.

**Example from Logs**:
```
User: "Is 01453 in your service area?"
Agent: "Thank you for holding! I can confirm that your area is within our service area."
[20 seconds of awkward silence]
User: "Hello?"
Agent: "Let me check that for you."
[NOW calls check_service_area tool]
```

**Root Cause**: This is a **prompt engineering issue**, not a code issue.

**Why it Happens**:
1. The LLM generates text response first
2. Then decides to call a tool (maybe)
3. Doesn't understand that tool calls happen DURING the response, not after

**Business Impact**:
- Poor user experience (awkward silences)
- Caller thinks the agent is broken
- Decreased trust in AI quality

---

## Objective

Update the system prompt to clearly instruct the LLM to:
1. Call tools IMMEDIATELY when needed (not on next turn)
2. Understand that filler phrases are automatic
3. Never say "let me check" without calling the tool

---

## Files to Read (Before Starting)

1. `/api/src/modules/voice-ai/dto/update-global-config.dto.ts`
   - Look for the default system prompt field
   - Understand how it's structured

2. `/api/src/modules/voice-ai/dto/global-config-response.dto.ts`
   - Find the `default_system_prompt` field
   - Check if there's a character limit

3. `/api/src/modules/voice-ai/services/voice-ai-global-config.service.ts`
   - Find the `updateConfig()` method
   - Understand how the system prompt is updated

4. `/api/prisma/schema.prisma`
   - Find the `voice_ai_global_config` model
   - Check the `default_system_prompt` field type (TEXT or VARCHAR)

5. `/api/src/modules/voice-ai/agent/voice-agent.session.ts`
   - Find where filler phrases are spoken (search for "filler")
   - Understand the filler phrase mechanism

---

## Implementation Steps

### Step 1: Locate the Current System Prompt

**Task**: Find where the default system prompt is stored and how to update it.

**Options to Check**:
1. Database table: `voice_ai_global_config.default_system_prompt`
2. DTO file: `update-global-config.dto.ts`
3. Seed file: Database migration or seed script

**What to Do**:
- Read the `voice_ai_global_config` table structure
- Find the current default prompt text
- Determine the best way to update it (code change vs. database update)

---

### Step 2: Read the Current System Prompt

**File**: Check the database or DTO default value

**Task**: Understand what the current prompt says.

**What to Look For**:
- Instructions about tool usage
- Any mention of "let me check" or filler phrases
- How tools are currently described

---

### Step 3: Draft the Updated Prompt Section

**Task**: Add a new section to the system prompt with clear instructions.

**Prompt Section to Add**:
```
=== CRITICAL TOOL USAGE INSTRUCTIONS ===

When you need information from a tool (check_service_area, find_lead, etc.):
1. Call the tool IMMEDIATELY in your response
2. DO NOT say "let me check" first
3. A filler phrase will be automatically spoken while the tool executes
4. After receiving results, incorporate them naturally in your response

WRONG Example:
User: "Is 01453 in your service area?"
Assistant: "Let me check that for you."
[waits - tool not called yet - BAD]

RIGHT Example:
User: "Is 01453 in your service area?"
Assistant: [calls check_service_area immediately]
[automatic filler: "Let me check that for you"]
Assistant: "Yes, we serve Leominster! What service do you need?"

REMEMBER:
- Call tools in the SAME turn when you realize you need them
- Do NOT promise to check something without calling the tool
- Filler phrases are handled automatically - focus on the final response
```

**Where to Add**:
- Near the top of the system prompt (high priority instruction)
- After the role definition
- Before the service/area information

---

### Step 4: Update the System Prompt

**Method 1: If it's in the database**

**File**: Create a database migration script

**Task**:
- Create a script: `/api/prisma/migrations/[timestamp]_update_system_prompt_tool_instructions/migration.sql`
- Update the `default_system_prompt` field
- Run the migration

**SQL Example**:
```sql
UPDATE voice_ai_global_config
SET default_system_prompt = CONCAT(
  default_system_prompt,
  '\n\n',
  '=== CRITICAL TOOL USAGE INSTRUCTIONS ===

  When you need information from a tool (check_service_area, find_lead, etc.):
  1. Call the tool IMMEDIATELY in your response
  2. DO NOT say "let me check" first
  3. A filler phrase will be automatically spoken while the tool executes
  4. After receiving results, incorporate them naturally in your response

  WRONG Example:
  User: "Is 01453 in your service area?"
  Assistant: "Let me check that for you."
  [waits - tool not called yet - BAD]

  RIGHT Example:
  User: "Is 01453 in your service area?"
  Assistant: [calls check_service_area immediately]
  [automatic filler: "Let me check that for you"]
  Assistant: "Yes, we serve Leominster! What service do you need?"

  REMEMBER:
  - Call tools in the SAME turn when you realize you need them
  - Do NOT promise to check something without calling the tool
  - Filler phrases are handled automatically - focus on the final response'
);
```

**Method 2: If it's in a DTO or config file**

**File**: `/api/src/modules/voice-ai/dto/update-global-config.dto.ts`

**Task**: Update the default value string

---

### Step 5: Verify Filler Phrase Logic

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts`

**Task**: Confirm that filler phrases are indeed automatically spoken when tools are called.

**What to Check**:
1. Search for "filler" in the file
2. Find where filler phrases are selected
3. Verify they play BEFORE tool execution
4. Confirm this happens automatically (not dependent on LLM)

**If Filler Logic is Missing**:
- Add a note to the human that this feature may not exist yet
- Suggest implementing it (but that's a separate sprint)

---

### Step 6: Test the Updated Prompt

**Task**: Create a test scenario to verify the fix.

**Test Script**:
1. Make a test call
2. Ask: "Do you serve my area code 01453?"
3. Observe the agent's behavior
4. Check logs for tool call timing

**Expected Behavior**:
- Agent should call `check_service_area` IMMEDIATELY
- Filler phrase should play (if implemented)
- Agent should respond with results
- No "let me check" without tool call

**Metrics to Track**:
- Time between user utterance and tool call
- Should be < 1 second (immediate)

---

### Step 7: Document the Change

**File**: Create `/api/documentation/system_prompt_updates.md`

**Task**: Document what was changed and why.

**Content**:
```markdown
# System Prompt Updates

## 2026-02-27: Tool Usage Timing Instructions

**Issue**: Agent was saying "let me check" but not calling tools until the next interaction.

**Solution**: Added explicit instructions to call tools immediately when needed.

**Changes**:
- Added "CRITICAL TOOL USAGE INSTRUCTIONS" section
- Clarified that filler phrases are automatic
- Provided WRONG vs. RIGHT examples
- Emphasized same-turn tool calling

**Testing**: Test calls should now show immediate tool calling without delays.
```

---

## Testing Checklist

After implementation, perform these tests:

### Test 1: Service Area Check
1. ✅ Make a test call
2. ✅ Ask: "Do you serve my area?"
3. ✅ Provide zip code when asked
4. ✅ Agent should call `check_service_area` IMMEDIATELY
5. ✅ No "let me check" without tool call
6. ✅ Response should be natural and quick

### Test 2: Lead Lookup
1. ✅ Make a test call from a known number
2. ✅ Agent should call `find_lead` early in conversation
3. ✅ Should NOT say "let me look up your information" first

### Test 3: Multiple Tool Calls
1. ✅ Make a call that requires multiple tools
2. ✅ Each tool should be called when needed
3. ✅ No promises without execution

### Test 4: Verify Existing Behavior
1. ✅ Agent should still ask clarifying questions when needed
2. ✅ Agent should not call tools unnecessarily
3. ✅ Natural conversation flow should be maintained

---

## Acceptance Criteria

**This sprint is COMPLETE when**:

- [ ] System prompt includes tool usage timing instructions
- [ ] Instructions are clear with examples
- [ ] Prompt has been updated (database or code)
- [ ] Filler phrase logic has been verified (or noted if missing)
- [ ] Documentation created
- [ ] Test 1 passes: Immediate tool calling
- [ ] Test 2 passes: Early lead lookup
- [ ] Test 3 passes: Multiple tools handled correctly
- [ ] Test 4 passes: Existing behavior preserved
- [ ] You have reviewed your changes 2x before marking complete

---

## Files Modified (Summary)

Expected changes (for your review before completing):

1. Database migration OR `/api/src/modules/voice-ai/dto/update-global-config.dto.ts` - Updated system prompt
2. `/api/documentation/system_prompt_updates.md` - Documentation

**Total Expected Changes**: 1-2 files

---

## Common Pitfalls to Avoid

1. ❌ Don't make the prompt too long (token limits exist)
2. ❌ Don't remove existing important instructions
3. ❌ Don't assume the LLM will follow instructions perfectly (test it)
4. ❌ Don't forget to preserve line breaks and formatting
5. ❌ Don't update production database without testing
6. ❌ Don't skip the verification step

---

## Success Message

When this sprint is complete, say:

**"✅ Sprint 3 Complete: Agent now calls tools immediately when needed. No more 'let me check' delays."**

Then provide:
- Where the prompt was updated
- Test results showing improved timing
- Example log showing immediate tool calls

---

**Remember**: You are being paid $500/hour. Take your time. Read the code. Understand the flow. Don't rush.
