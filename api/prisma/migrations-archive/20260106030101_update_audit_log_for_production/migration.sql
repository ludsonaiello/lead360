-- Update AuditLog table for production use
-- Add missing fields: actor_type, description, status, error_message
-- Rename 'action' to 'action_type'

-- Step 1: Add new columns with default values
ALTER TABLE `audit_log`
    ADD COLUMN `actor_type` ENUM('user', 'system', 'platform_admin', 'cron_job') NULL
        AFTER `actor_user_id`,
    ADD COLUMN `description` TEXT NOT NULL DEFAULT 'Action performed'
        AFTER `entity_id`,
    ADD COLUMN `status` ENUM('success', 'failure') NOT NULL DEFAULT 'success'
        AFTER `user_agent`,
    ADD COLUMN `error_message` TEXT NULL
        AFTER `status`;

-- Step 2: Rename 'action' to 'action_type' for clarity
ALTER TABLE `audit_log`
    CHANGE COLUMN `action` `action_type` VARCHAR(50) NOT NULL;

-- Step 3: Backfill actor_type for existing records based on actor_user_id
UPDATE `audit_log`
SET `actor_type` = CASE
    WHEN `actor_user_id` IS NULL THEN 'system'
    ELSE 'user'
END
WHERE `actor_type` IS NULL;

-- Step 4: Backfill description for existing records
UPDATE `audit_log`
SET `description` = CONCAT(
    UPPER(SUBSTRING(`action_type`, 1, 1)),
    SUBSTRING(`action_type`, 2),
    ' ',
    `entity_type`
)
WHERE `description` = 'Action performed';

-- Step 5: Make actor_type NOT NULL after backfill
ALTER TABLE `audit_log`
    MODIFY COLUMN `actor_type` ENUM('user', 'system', 'platform_admin', 'cron_job') NOT NULL;

-- Step 6: Remove default from description (was only for backfill)
ALTER TABLE `audit_log`
    MODIFY COLUMN `description` TEXT NOT NULL;

-- Step 7: Add new performance indexes
CREATE INDEX IF NOT EXISTS `audit_log_status_idx` ON `audit_log`(`status`);
CREATE INDEX IF NOT EXISTS `audit_log_actor_type_idx` ON `audit_log`(`actor_type`);
CREATE INDEX IF NOT EXISTS `audit_log_tenant_status_created_idx`
    ON `audit_log`(`tenant_id`, `status`, `created_at` DESC);
