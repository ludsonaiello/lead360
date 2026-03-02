# System Prompt Updates

This document tracks all updates to the voice AI agent's default system prompt.

---

## 2026-02-28: Tool Usage Timing Instructions (Sprint 3)

**Issue**: Agent was saying "let me check" but not calling tools until the next interaction, causing awkward silences.

**Root Cause**: The LLM was generating text response first ("let me check"), then deciding to call a tool on the NEXT turn, not understanding that tool calls should happen DURING the response.

**Solution**: Added explicit instructions to call tools immediately when needed.

**Changes**:
- Added "CRITICAL TOOL USAGE INSTRUCTIONS" section to default system prompt
- Clarified that filler phrases are automatic (handled by [voice-agent.session.ts:598](../src/modules/voice-ai/agent/voice-agent.session.ts#L598))
- Provided WRONG vs. RIGHT examples showing immediate tool calling
- Emphasized same-turn tool calling

**Technical Details**:
- **Migration File**: `/api/prisma/migrations/manual_update_system_prompt_tool_timing.sql`
- **Prompt Length**: 1,666 characters (under 2,000 char limit)
- **Filler Phrase Logic**: Confirmed working in [voice-agent.session.ts:1633-1671](../src/modules/voice-ai/agent/voice-agent.session.ts#L1633-L1671)
  - Filler phrases are spoken BEFORE tool execution
  - Random phrase selected from `voice_ai_global_config.filler_phrases` JSON column
  - Streamed via TTS with 5-second timeout
  - Tool execution proceeds after filler completes

**Testing**: Test calls should now show immediate tool calling without delays. When the LLM realizes it needs information, it should:
1. Call the tool immediately in the same turn
2. The system automatically speaks a filler phrase (e.g., "Let me check that for you.")
3. Tool executes while filler is playing
4. Agent incorporates results naturally in final response

**Related Files**:
- Database schema: [prisma/schema.prisma](../prisma/schema.prisma) (line 1122: `default_system_prompt`)
- Service: [voice-ai-global-config.service.ts](../src/modules/voice-ai/services/voice-ai-global-config.service.ts)
- Agent session: [voice-agent.session.ts](../src/modules/voice-ai/agent/voice-agent.session.ts)

---

## 2026-02-27: End Call Instructions (Sprint 2)

**Issue**: Agent was not properly ending calls, waiting for caller to hang up.

**Solution**: Added instructions to call `end_call` tool when conversation is complete.

**Changes**:
- Added "ENDING THE CALL" section
- Listed scenarios when to call `end_call`
- Emphasized saying goodbye BEFORE calling the tool

**Migration File**: `/api/prisma/migrations/manual_update_system_prompt_end_call.sql`

---

## Format for Future Updates

When updating the system prompt, document:
1. Date and sprint ID
2. Issue being solved
3. Changes made
4. Migration file path
5. Testing instructions
6. Related code files
