-- AlterTable: platform_email_config
-- Purpose: Add provider registry support to existing platform email config
-- Migration: 20260118000002_enhance_platform_email_config

ALTER TABLE platform_email_config
  ADD COLUMN provider_id VARCHAR(36) AFTER id,
  ADD COLUMN credentials JSON COMMENT 'Encrypted provider credentials',
  ADD COLUMN provider_config JSON COMMENT 'Provider-specific configuration',
  ADD COLUMN webhook_secret VARCHAR(255),
  MODIFY smtp_host VARCHAR(255) NULL,
  MODIFY smtp_port INT NULL,
  MODIFY smtp_username VARCHAR(255) NULL,
  MODIFY smtp_password TEXT NULL;

-- Add foreign key constraint
ALTER TABLE platform_email_config
  ADD CONSTRAINT fk_platform_email_provider
  FOREIGN KEY (provider_id) REFERENCES communication_provider(id);

-- Add index
ALTER TABLE platform_email_config
  ADD INDEX idx_provider_id (provider_id);
