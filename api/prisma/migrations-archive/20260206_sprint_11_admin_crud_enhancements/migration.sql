-- Sprint 11: Admin CRUD Enhancements
-- This migration adds:
-- 1. webhook_config table for webhook configuration management
-- 2. retry fields to webhook_event for failed webhook retry logic
-- 3. Alert workflow enhancement fields to admin_alert (comment, resolved, resolution)

-- ============================================================================
-- 1. Create webhook_config table
-- ============================================================================

CREATE TABLE `webhook_config` (
    `id` VARCHAR(36) NOT NULL,
    `base_url` VARCHAR(255) NOT NULL,
    `webhook_secret` TEXT NOT NULL,
    `signature_verification` BOOLEAN NOT NULL DEFAULT true,
    `last_rotated` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- 2. Add retry tracking fields to webhook_event
-- ============================================================================

ALTER TABLE `webhook_event`
    ADD COLUMN `retry_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `next_retry_at` DATETIME(3) NULL;

-- ============================================================================
-- 3. Add alert workflow enhancement fields to admin_alert
-- ============================================================================

ALTER TABLE `admin_alert`
    ADD COLUMN `comment` TEXT NULL,
    ADD COLUMN `resolved` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `resolved_by` VARCHAR(36) NULL,
    ADD COLUMN `resolved_at` DATETIME(3) NULL,
    ADD COLUMN `resolution` TEXT NULL;

-- ============================================================================
-- 4. Add foreign key constraint for resolved_by
-- ============================================================================

ALTER TABLE `admin_alert`
    ADD CONSTRAINT `admin_alert_resolved_by_fkey`
    FOREIGN KEY (`resolved_by`)
    REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 5. Add indexes for performance
-- ============================================================================

-- Index for resolved alerts filtering
CREATE INDEX `admin_alert_resolved_created_at_idx` ON `admin_alert`(`resolved`, `created_at` DESC);

-- Index for webhook event retry queries
CREATE INDEX `webhook_event_retry_count_next_retry_at_idx` ON `webhook_event`(`retry_count`, `next_retry_at`);
