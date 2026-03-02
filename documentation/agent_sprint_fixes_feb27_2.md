# Sprint 2: Implement Tool-Based Call Termination

**Sprint ID**: `agent_sprint_fixes_feb27_2`
**Priority**: 🔴 HIGH - Critical (Cost Savings)
**Estimated Effort**: 3-4 hours
**Dependencies**: Sprint 1 (call status must update correctly)

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

**Issue**: When the Voice AI agent says goodbye to the caller, the call continues indefinitely if the caller doesn't hang up.

**Business Impact**:
- **Huge cost risk**: Calls can run for hours if caller forgets to hang up
- Each minute costs money (STT, LLM, TTS usage)
- Wastes tenant quota/minutes

**Current Behavior**:
```
Agent: "Thank you for calling! Have a great day!"
[Call continues... waiting for user to hang up]
[If user walks away, call runs for hours $$$$]
```

**Why Goodbye Phrase Detection is Bad**:
- Multi-language support requires phrases in every language
- Pattern matching is unreliable
- Different cultural goodbye conventions
- Maintenance nightmare

---

## Objective

Create an `end_call` tool that the LLM can invoke when the conversation is complete. This is language-agnostic and more reliable.

**After this sprint**:
```
Agent: "Thank you for calling! Have a great day!"
[Agent calls end_call tool]
[Call terminates within 1-2 seconds]
```

---

## Files to Read (Before Starting)

**CRITICAL**: Read these files to understand the tools architecture:

1. `/api/src/modules/voice-ai/agent/tools/tool.interface.ts`
   - Understand the `AgentTool` interface
   - See what properties/methods are required

2. `/api/src/modules/voice-ai/agent/tools/http-tools.ts`
   - Study how existing tools are implemented:
     - `HttpFindLeadTool`
     - `HttpCreateLeadTool`
     - `HttpCheckServiceAreaTool`
     - `HttpTransferCallTool`
   - Understand the pattern for HTTP-based tools

3. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`
   - Lines 234-241 - See how tools are registered
   - Understand how tools array is passed to session

4. `/api/src/modules/voice-ai/agent/voice-agent.session.ts`
   - Find where tools are executed
   - Search for "executeTool" or "tool execution" logic
   - Understand how tool responses are handled

5. `/api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`
   - Look for `VoiceAiContext` structure
   - Understand what data is available to tools

---

## Implementation Steps

### Step 1: Create HttpEndCallTool Class

**File**: `/api/src/modules/voice-ai/agent/tools/http-tools.ts`

**Task**: Add a new tool class following the existing pattern.

**Tool Specifications**:
- **Name**: `'end_call'`
- **Description**: `"End the call when the conversation is complete and you have said goodbye to the caller. Use this tool after you've provided all necessary information and concluded the conversation."`
- **Parameters**:
  ```typescript
  {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Why the call is ending',
        enum: ['lead_created', 'transferred', 'not_interested', 'information_provided', 'service_unavailable', 'other']
      },
      notes: {
        type: 'string',
        description: 'Optional brief notes about the call outcome (max 200 chars)'
      }
    },
    required: ['reason']
  }
  ```

**What to Implement**:
1. Study the structure of `HttpFindLeadTool` - it's the simplest example
2. Create `export class HttpEndCallTool implements AgentTool`
3. Add the `name`, `description`, and `parameters` properties
4. Implement `async execute(args, context)` method
5. The execute method should:
   - Log the call termination request
   - Return a success response
   - The actual session stop will be handled in Step 3

**Important Notes**:
- Do NOT make an HTTP call (this tool executes locally)
- Do NOT import `VoiceAgentSession` (creates circular dependency)
- Keep it simple - just validate args and return success

---

### Step 2: Register end_call Tool in Entrypoint

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: Add the new tool to the tools array.

**Where to Add** (around line 236):
```typescript
const tools: AgentTool[] = [
  new HttpFindLeadTool(),
  new HttpCreateLeadTool(),
  new HttpCheckServiceAreaTool(),
  new HttpTransferCallTool(),
  // ADD THIS:
  new HttpEndCallTool(),
];
```

**What to Do**:
1. Find the tools array initialization
2. Add `new HttpEndCallTool()` to the array
3. Make sure the import is added at the top of the file
4. Verify no syntax errors

---

### Step 3: Handle end_call Execution in Session

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts`

**Task**: Detect when `end_call` tool is invoked and terminate the session.

**Where to Look**:
1. Find where tools are executed (search for "tool execution" or "executeTool")
2. Look for the loop that processes tool calls
3. Find where tool results are collected

**What to Add**:
After a tool is executed, check if it's the `end_call` tool:

```typescript
// After tool execution completes
if (toolCall.name === 'end_call') {
  // Extract reason from args
  const reason = toolResult.args?.reason || 'other';

  // Log the termination
  this.logger.log(`🔚 end_call tool invoked: ${reason}`);
  this.voiceLogger?.logSessionEvent('call_ended_by_agent', {
    reason,
    notes: toolResult.args?.notes || null,
  });

  // Set call outcome (will be used when completing call log)
  this.callOutcome = reason;

  // Mark session as ending
  this.isActive = false;

  // Stop the session (triggers cleanup)
  this.stop();

  // Don't continue processing - call is ending
  break;
}
```

**What to Find First**:
1. Where is `this.stop()` defined? Read that method to understand cleanup
2. Is there a `this.callOutcome` property? If not, add it to the class
3. Where are tool results logged? Add end_call logging there

---

### Step 4: Pass Call Outcome to completeCallLog

**File**: `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts`

**Task**: Use the outcome from the `end_call` tool when completing the call log.

**Current Code** (line 175):
```typescript
outcome: 'abandoned', // Default to abandoned
```

**What to Change**:
1. Get the outcome from the session: `session.getCallOutcome()`
2. Use that instead of hardcoded 'abandoned'
3. Fallback to 'abandoned' if no outcome was set

**New Code**:
```typescript
outcome: session.getCallOutcome() || 'abandoned',
```

**Additional Changes Needed**:
1. Add `getCallOutcome()` method to VoiceAgentSession class
2. Add `private callOutcome: string | null = null` property to session
3. Add `setCallOutcome(outcome: string)` method to session

---

### Step 5: Update System Prompt to Use end_call Tool

**File**: Find where the default system prompt is stored (likely in global config)

**Search for**: "default_system_prompt" or the system prompt text

**What to Add**: Add this section to the system prompt:

```
ENDING THE CALL:

When the conversation is complete, you MUST call the end_call tool. Do NOT wait for the caller to hang up.

Call end_call when:
1. You have answered all of the caller's questions
2. You have created a lead and confirmed next steps
3. You have transferred the call
4. The caller is not interested in your services
5. You cannot help the caller (out of service area, etc.)

IMPORTANT: Always say goodbye BEFORE calling end_call.

Example:
User: "Thank you for the information!"
Assistant: "You're welcome! We'll email you a quote shortly. Have a great day!"
[calls end_call with reason="lead_created"]
```

**Where to Update**:
- If it's in the database (voice_ai_global_config table), you'll need to update via a script or manually
- If it's in code (DTO or config file), update the file

---

### Step 6: Add Call Outcome Options to Interface

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts` (class properties)

**Task**: Define the valid call outcomes.

**What to Add**:
```typescript
// At the top of the class
private callOutcome: 'lead_created' | 'transferred' | 'not_interested' | 'information_provided' | 'service_unavailable' | 'abandoned' | 'other' | null = null;

public setCallOutcome(outcome: string): void {
  this.callOutcome = outcome;
}

public getCallOutcome(): string | null {
  return this.callOutcome;
}
```

---

### Step 7: Add Logging and Metrics

**File**: `/api/src/modules/voice-ai/agent/voice-agent.session.ts`

**Task**: Log when call termination is triggered.

**What to Add**:
1. Log when `end_call` tool is called
2. Log the reason and notes
3. Log the total call duration at termination
4. Add structured logging via VoiceAILogger if available

**Example**:
```typescript
this.voiceLogger?.logSessionEvent('call_ended_by_agent', {
  reason: args.reason,
  notes: args.notes || null,
  duration_seconds: Math.floor((Date.now() - this.startTime) / 1000),
});
```

**Note**: Check if `this.startTime` exists. If not, add it to the constructor.

---

## Testing Checklist

After implementation, perform these tests:

### Test 1: Normal Call with Lead Creation
1. ✅ Make a test call
2. ✅ Provide information (name, phone, service needed)
3. ✅ Wait for agent to say goodbye
4. ✅ Check logs - should see "🔚 end_call tool invoked: lead_created"
5. ✅ Call should end within 1-2 seconds
6. ✅ Don't hang up - verify call ends automatically
7. ✅ Check database: `voice_call_log.outcome` should be 'lead_created'

### Test 2: Caller Not Interested
1. ✅ Make a test call
2. ✅ Tell agent you're not interested
3. ✅ Agent should say goodbye and call end_call
4. ✅ Check logs - should see "reason: not_interested"
5. ✅ Call should end automatically

### Test 3: Information Provided
1. ✅ Make a test call
2. ✅ Ask a question (e.g., "Do you serve my area?")
3. ✅ Agent answers and says goodbye
4. ✅ end_call should be called with "information_provided"
5. ✅ Call should end automatically

### Test 4: Verify Old Behavior Still Works
1. ✅ If caller hangs up BEFORE agent calls end_call, call should still complete normally
2. ✅ outcome should be 'abandoned' (fallback)

---

## Acceptance Criteria

**This sprint is COMPLETE when**:

- [ ] `HttpEndCallTool` class is created and follows existing tool pattern
- [ ] Tool is registered in tools array
- [ ] Session detects end_call execution and calls `this.stop()`
- [ ] Call outcome is captured and passed to `completeCallLog()`
- [ ] System prompt includes end_call usage instructions
- [ ] `getCallOutcome()` and `setCallOutcome()` methods exist
- [ ] Comprehensive logging is added
- [ ] All 4 tests pass
- [ ] No existing features are broken
- [ ] You have reviewed your code 2x before marking complete

---

## Files Modified (Summary)

Expected changes (for your review before completing):

1. `/api/src/modules/voice-ai/agent/tools/http-tools.ts` - New HttpEndCallTool class
2. `/api/src/modules/voice-ai/agent/voice-agent-entrypoint.ts` - Register tool, use outcome
3. `/api/src/modules/voice-ai/agent/voice-agent.session.ts` - Handle end_call, add outcome methods
4. System prompt location (database or config file) - Update instructions

**Total Expected Changes**: 4 files

---

## Common Pitfalls to Avoid

1. ❌ Don't create circular dependencies between tools and session
2. ❌ Don't forget to break out of tool execution loop after calling end_call
3. ❌ Don't assume the LLM will always call end_call (have fallback)
4. ❌ Don't change the tool interface without understanding impact
5. ❌ Don't skip testing the "caller hangs up first" scenario
6. ❌ Don't forget to import new classes

---

## Success Message

When this sprint is complete, say:

**"✅ Sprint 2 Complete: Calls now terminate automatically when agent finishes conversation. Cost savings implemented."**

Then provide a summary of:
- Files modified
- Test results
- Example log output from a test call

---

**Remember**: You are being paid $500/hour. Take your time. Read the code. Understand the flow. Don't rush.
