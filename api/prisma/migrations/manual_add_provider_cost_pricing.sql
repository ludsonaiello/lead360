-- Manual migration: Add cost pricing columns to voice_ai_provider
-- Sprint FSA08-fixing
-- Applied: 2026-02-18

ALTER TABLE `voice_ai_provider`
  ADD COLUMN `cost_per_unit` DECIMAL(12, 8) NULL AFTER `pricing_info`,
  ADD COLUMN `cost_unit` VARCHAR(20) NULL AFTER `cost_per_unit`;
