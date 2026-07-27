-- Migration: Add Time Clock Module
-- Sprint 1 — clockin_backend
-- Adds 12 enums (via CREATE TABLE column ENUMs), 10 tables, 33 foreign keys,
-- and makes crew_hour_log.project_id nullable.

-- AlterTable — make crew_hour_log.project_id optional (existing writers always set it)
ALTER TABLE `crew_hour_log` MODIFY `project_id` VARCHAR(36) NULL;

-- CreateTable: time_clock_settings
CREATE TABLE `time_clock_settings` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_in_mode` ENUM('anywhere', 'specific_addresses', 'active_job_sites') NOT NULL DEFAULT 'anywhere',
    `geofence_violation_action` ENUM('block', 'warn_only') NOT NULL DEFAULT 'warn_only',
    `gps_required` BOOLEAN NOT NULL DEFAULT true,
    `gps_unavailable_action` ENUM('block', 'allow_flagged') NOT NULL DEFAULT 'allow_flagged',
    `require_job_tag` BOOLEAN NOT NULL DEFAULT false,
    `require_task_tag` BOOLEAN NOT NULL DEFAULT false,
    `overtime_enabled` BOOLEAN NOT NULL DEFAULT true,
    `overtime_daily_threshold_hours` DECIMAL(4, 2) NULL DEFAULT 8.00,
    `overtime_weekly_threshold_hours` DECIMAL(5, 2) NULL DEFAULT 40.00,
    `overtime_multiplier` DECIMAL(3, 2) NULL DEFAULT 1.50,
    `pay_period_type` ENUM('weekly', 'biweekly', 'semimonthly', 'monthly') NOT NULL DEFAULT 'biweekly',
    `pay_period_start_day` INTEGER NULL,
    `pay_period_anchor_date` DATE NULL,
    `kiosk_mode_enabled` BOOLEAN NOT NULL DEFAULT false,
    `kiosk_token_hash` VARCHAR(255) NULL,
    `shift_reminder_minutes` INTEGER NOT NULL DEFAULT 30,
    `missed_shift_threshold_minutes` INTEGER NOT NULL DEFAULT 30,
    `native_app_features_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `time_clock_settings_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: employee_profile
CREATE TABLE `employee_profile` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NULL,
    `hourly_rate` DECIMAL(10, 2) NULL,
    `overtime_rule_override` BOOLEAN NOT NULL DEFAULT false,
    `overtime_daily_threshold_hours` DECIMAL(4, 2) NULL,
    `overtime_weekly_threshold_hours` DECIMAL(5, 2) NULL,
    `kiosk_pin_hash` VARCHAR(255) NULL,
    `kiosk_pin_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `kiosk_pin_locked_until` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `push_subscription_json` TEXT NULL,
    `push_token_native` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_profile_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `employee_profile_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    UNIQUE INDEX `employee_profile_tenant_id_user_id_key`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: clockin_address
CREATE TABLE `clockin_address` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `label` VARCHAR(100) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `radius_meters` INTEGER NOT NULL DEFAULT 100,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `source` ENUM('manual', 'imported_from_quote', 'imported_from_lead') NOT NULL DEFAULT 'manual',
    `source_address_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clockin_address_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `clockin_address_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: employee_project_assignment
CREATE TABLE `employee_project_assignment` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `assigned_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_project_assignment_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    UNIQUE INDEX `employee_project_assignment_tenant_id_employee_profile_id_pr_key`(`tenant_id`, `employee_profile_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: work_shift
CREATE TABLE `work_shift` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `scheduled_start` DATETIME(3) NOT NULL,
    `scheduled_end` DATETIME(3) NOT NULL,
    `title` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `status` ENUM('scheduled', 'in_progress', 'completed', 'missed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `reminder_sent_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `work_shift_tenant_id_employee_profile_id_scheduled_start_idx`(`tenant_id`, `employee_profile_id`, `scheduled_start`),
    INDEX `work_shift_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `work_shift_tenant_id_scheduled_start_idx`(`tenant_id`, `scheduled_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: clock_session
CREATE TABLE `clock_session` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `work_shift_id` VARCHAR(36) NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `clockin_address_id` VARCHAR(36) NULL,
    `status` ENUM('active', 'on_break', 'completed') NOT NULL DEFAULT 'active',
    `clock_in_at` DATETIME(3) NOT NULL,
    `clock_out_at` DATETIME(3) NULL,
    `clock_in_latitude` DECIMAL(10, 8) NULL,
    `clock_in_longitude` DECIMAL(11, 8) NULL,
    `clock_in_location_source` ENUM('browser_gps', 'native_gps', 'kiosk', 'manual') NOT NULL DEFAULT 'browser_gps',
    `clock_in_geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL DEFAULT 'not_enforced',
    `clock_out_latitude` DECIMAL(10, 8) NULL,
    `clock_out_longitude` DECIMAL(11, 8) NULL,
    `clock_out_location_source` ENUM('browser_gps', 'native_gps', 'kiosk', 'manual') NOT NULL DEFAULT 'browser_gps',
    `clock_out_geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL DEFAULT 'not_enforced',
    `total_worked_minutes` INTEGER NULL,
    `regular_minutes` INTEGER NULL,
    `overtime_minutes` INTEGER NULL,
    `is_manual_edit` BOOLEAN NOT NULL DEFAULT false,
    `is_flagged` BOOLEAN NOT NULL DEFAULT false,
    `flag_reason` VARCHAR(255) NULL,
    `labor_cost_posted` BOOLEAN NOT NULL DEFAULT false,
    `labor_cost_entry_id` VARCHAR(36) NULL,
    `labor_cost_reconciliation_needed` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clock_session_tenant_id_employee_profile_id_clock_in_at_idx`(`tenant_id`, `employee_profile_id`, `clock_in_at`),
    INDEX `clock_session_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `clock_session_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `clock_session_tenant_id_is_flagged_idx`(`tenant_id`, `is_flagged`),
    INDEX `clock_session_tenant_id_clock_in_at_idx`(`tenant_id`, `clock_in_at`),
    INDEX `clock_session_tenant_id_labor_cost_posted_idx`(`tenant_id`, `labor_cost_posted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: break_entry
CREATE TABLE `break_entry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `break_type` ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
    `break_label` VARCHAR(50) NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `duration_minutes` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `break_entry_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: clock_session_edit_log (immutable — no updated_at)
CREATE TABLE `clock_session_edit_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `edited_by_user_id` VARCHAR(36) NOT NULL,
    `field_changed` VARCHAR(100) NOT NULL,
    `original_value` TEXT NULL,
    `new_value` TEXT NULL,
    `reason` TEXT NOT NULL,
    `edited_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `clock_session_edit_log_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: time_dispute
CREATE TABLE `time_dispute` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `submitted_by_user_id` VARCHAR(36) NOT NULL,
    `dispute_type` ENUM('flag_only', 'correction_request') NOT NULL,
    `description` TEXT NOT NULL,
    `proposed_clock_in_at` DATETIME(3) NULL,
    `proposed_clock_out_at` DATETIME(3) NULL,
    `proposed_project_id` VARCHAR(36) NULL,
    `proposed_task_id` VARCHAR(36) NULL,
    `proposed_notes` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'pending',
    `reviewed_by_user_id` VARCHAR(36) NULL,
    `review_notes` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `time_dispute_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    INDEX `time_dispute_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: clock_session_location_log (Phase 2 placeholder — no timestamps)
CREATE TABLE `clock_session_location_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `accuracy_meters` DECIMAL(6, 2) NULL,
    `geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL,

    INDEX `clock_session_location_log_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- Foreign Keys (33 total)
-- ============================================================================

-- time_clock_settings (1)
ALTER TABLE `time_clock_settings` ADD CONSTRAINT `time_clock_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- employee_profile (3)
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- clockin_address (3)
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- employee_project_assignment (4)
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- work_shift (5)
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- clock_session (6)
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_work_shift_id_fkey` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_clockin_address_id_fkey` FOREIGN KEY (`clockin_address_id`) REFERENCES `clockin_address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- break_entry (2)
ALTER TABLE `break_entry` ADD CONSTRAINT `break_entry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `break_entry` ADD CONSTRAINT `break_entry_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- clock_session_edit_log (3)
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_edited_by_user_id_fkey` FOREIGN KEY (`edited_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- time_dispute (4)
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_submitted_by_user_id_fkey` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_reviewed_by_user_id_fkey` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- clock_session_location_log (2)
ALTER TABLE `clock_session_location_log` ADD CONSTRAINT `clock_session_location_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `clock_session_location_log` ADD CONSTRAINT `clock_session_location_log_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
