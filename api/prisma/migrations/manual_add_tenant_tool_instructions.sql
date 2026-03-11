-- Add tool_instructions column to tenant_voice_ai_settings
-- Stores per-tool LLM instruction overrides at the tenant level
-- Tenant overrides merge on top of global defaults (per-key)
-- Sprint: Tool System Audit & Enhancement

ALTER TABLE `tenant_voice_ai_settings`
ADD COLUMN `tool_instructions` LONGTEXT NULL;
