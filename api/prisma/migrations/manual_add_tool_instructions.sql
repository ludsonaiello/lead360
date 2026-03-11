-- Add tool_instructions column to voice_ai_global_config
-- Stores per-tool LLM instruction overrides as JSON
-- Sprint: Tool System Audit & Enhancement

ALTER TABLE `voice_ai_global_config`
ADD COLUMN `tool_instructions` LONGTEXT NULL;
