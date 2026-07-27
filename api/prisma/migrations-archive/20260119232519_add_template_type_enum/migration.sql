-- AlterTable: Add template_type ENUM column
-- This migration adds a 3-tier template system: platform, shared, tenant

-- Step 1: Add new enum column (nullable initially)
ALTER TABLE `email_template`
ADD COLUMN `template_type` ENUM('platform', 'shared', 'tenant') NULL;

-- Step 2: Migrate existing data
-- Platform templates: password-reset, account-activation, license-expiry-warning, test-email
-- Shared templates: Other system templates (for tenant use)
-- Tenant templates: Templates with tenant_id set
UPDATE `email_template`
SET `template_type` = CASE
  WHEN `is_system` = 1 AND `template_key` IN (
    'password-reset',
    'account-activation',
    'license-expiry-warning',
    'test-email'
  ) THEN 'platform'
  WHEN `is_system` = 1 THEN 'shared'
  ELSE 'tenant'
END;

-- Step 3: Make column NOT NULL with default
ALTER TABLE `email_template`
MODIFY COLUMN `template_type` ENUM('platform', 'shared', 'tenant') NOT NULL DEFAULT 'tenant';

-- Step 4: Add index for performance (template_type + tenant_id queries)
CREATE INDEX `idx_email_template_type_tenant` ON `email_template`(`template_type`, `tenant_id`);

-- Note: Keeping is_system column for backward compatibility
-- Can be dropped in a future migration after confirming stability
