-- Sprint 3: Fix "Let Me Check" Prompt Timing
-- Date: 2026-02-28
-- Run: mysql -u root -p lead360 < manual_update_system_prompt_tool_timing.sql
--
-- Issue: Agent says "let me check" but doesn't call tools until NEXT interaction
-- Solution: Add explicit instructions to call tools IMMEDIATELY when needed
-- Related: Filler phrases are automatically spoken before tool execution (voice-agent.session.ts:596)

USE lead360;

-- Update the default system prompt to include tool usage timing instructions
UPDATE voice_ai_global_config
SET default_system_prompt = CONCAT(
  default_system_prompt,
  '\n\n',
  '=== CRITICAL TOOL USAGE INSTRUCTIONS ===\n\n',
  'When you need information from a tool (check_service_area, find_lead, create_lead, etc.):\n',
  '1. Call the tool IMMEDIATELY in your response (same turn)\n',
  '2. DO NOT say "let me check" first without calling the tool\n',
  '3. A filler phrase will be automatically spoken while the tool executes\n',
  '4. After receiving results, incorporate them naturally in your response\n\n',
  'WRONG Example:\n',
  'User: "Is 01453 in your service area?"\n',
  'Assistant: "Let me check that for you."\n',
  '[waits - tool not called yet - BAD]\n\n',
  'RIGHT Example:\n',
  'User: "Is 01453 in your service area?"\n',
  'Assistant: [calls check_service_area immediately]\n',
  '[automatic filler: "Let me check that for you"]\n',
  'Assistant: "Yes, we serve Leominster! What service do you need?"\n\n',
  'REMEMBER:\n',
  '- Call tools in the SAME turn when you realize you need them\n',
  '- Do NOT promise to check something without calling the tool\n',
  '- Filler phrases are handled automatically - focus on the final response'
)
WHERE id = 'default';

-- Verify the update
SELECT
    id,
    LENGTH(default_system_prompt) as prompt_length,
    RIGHT(default_system_prompt, 100) as last_100_chars,
    updated_at
FROM voice_ai_global_config
WHERE id = 'default';
