-- Migration: Platform Email Multi-Provider Support
-- Aligns platform_email_config with tenant_email_config structure

-- Step 1: Create backup of existing platform email config
CREATE TABLE IF NOT EXISTS platform_email_config_backup AS SELECT * FROM platform_email_config;

-- Step 2: Add new columns
ALTER TABLE `platform_email_config`
  ADD COLUMN `reply_to_email` VARCHAR(255) NULL AFTER `from_name`,
  ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT false AFTER `webhook_secret`,
  ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) AFTER `is_active`,
  MODIFY COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- Step 3: Remove old SMTP fields (now handled via credentials JSON)
ALTER TABLE `platform_email_config`
  DROP COLUMN IF EXISTS `smtp_host`,
  DROP COLUMN IF EXISTS `smtp_port`,
  DROP COLUMN IF EXISTS `smtp_encryption`,
  DROP COLUMN IF EXISTS `smtp_username`,
  DROP COLUMN IF EXISTS `smtp_password`,
  DROP COLUMN IF EXISTS `updated_by_user_id`;

-- Step 4: Make provider_id and credentials required (NOT NULL)
ALTER TABLE `platform_email_config`
  MODIFY COLUMN `provider_id` VARCHAR(36) NOT NULL,
  MODIFY COLUMN `credentials` JSON NOT NULL;

-- Step 5: Adjust from_name column size
ALTER TABLE `platform_email_config`
  MODIFY COLUMN `from_name` VARCHAR(100) NOT NULL;

-- Step 6: Add unique constraint on provider_id (one config per provider)
ALTER TABLE `platform_email_config`
  ADD UNIQUE INDEX `platform_email_config_provider_id_key` (`provider_id`);

-- Step 7: Add index on is_active for quick lookup
ALTER TABLE `platform_email_config`
  ADD INDEX `platform_email_config_is_active_idx` (`is_active`);

-- Step 8: If there's an existing config, set it as active
UPDATE `platform_email_config` SET `is_active` = true WHERE id = (SELECT id FROM platform_email_config LIMIT 1);
