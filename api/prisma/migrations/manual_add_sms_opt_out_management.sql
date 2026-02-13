-- Sprint 1: SMS Opt-Out Management (TCPA Compliance)
-- Manual Migration: Add SMS opt-out fields to lead table
-- Created: 2026-02-13
-- Author: AI Developer
--
-- Purpose: Enable TCPA-compliant SMS opt-out/opt-in tracking per lead
--
-- IMPORTANT: Run this migration manually using:
--   mysql -u root -p lead360 < manual_add_sms_opt_out_management.sql

-- Add SMS opt-out management fields to lead table
ALTER TABLE `lead`
  ADD COLUMN `sms_opt_out` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether lead has opted out of SMS (TCPA compliance)',
  ADD COLUMN `sms_opt_out_at` DATETIME(3) NULL COMMENT 'Timestamp when lead opted out',
  ADD COLUMN `sms_opt_in_at` DATETIME(3) NULL COMMENT 'Timestamp when lead opted back in',
  ADD COLUMN `sms_opt_out_reason` VARCHAR(255) NULL COMMENT 'Reason for opt-out (e.g., User sent: STOP)';

-- Add index for efficient opt-out queries
CREATE INDEX `idx_lead_sms_opt_out` ON `lead`(`tenant_id`, `sms_opt_out`);

-- Verify changes
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lead360'
  AND TABLE_NAME = 'lead'
  AND COLUMN_NAME IN ('sms_opt_out', 'sms_opt_out_at', 'sms_opt_in_at', 'sms_opt_out_reason');
