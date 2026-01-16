-- CreateTable
CREATE TABLE `feature_flag` (
    `id` VARCHAR(36) NOT NULL,
    `flag_key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    UNIQUE INDEX `feature_flag_flag_key_key`(`flag_key`),
    INDEX `feature_flag_flag_key_idx`(`flag_key`),
    INDEX `feature_flag_is_enabled_idx`(`is_enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_mode` (
    `id` VARCHAR(36) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    `mode` VARCHAR(20) NOT NULL DEFAULT 'immediate',
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `message` TEXT NULL,
    `allowed_ips` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notification` (
    `id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `link` TEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,

    INDEX `admin_notification_is_read_created_at_idx`(`is_read`, `created_at` DESC),
    INDEX `admin_notification_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `impersonation_session` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `impersonated_user_id` VARCHAR(36) NOT NULL,
    `impersonated_tenant_id` VARCHAR(36) NOT NULL,
    `session_token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `impersonation_session_session_token_key`(`session_token`),
    INDEX `impersonation_session_admin_user_id_idx`(`admin_user_id`),
    INDEX `impersonation_session_session_token_idx`(`session_token`),
    INDEX `impersonation_session_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting` (
    `id` VARCHAR(36) NOT NULL,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NOT NULL,
    `data_type` VARCHAR(20) NOT NULL,
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    UNIQUE INDEX `system_setting_setting_key_key`(`setting_key`),
    INDEX `system_setting_setting_key_idx`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_job` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `export_type` VARCHAR(50) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `filters` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `file_path` TEXT NULL,
    `row_count` INTEGER NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `export_job_admin_user_id_created_at_idx`(`admin_user_id`, `created_at` DESC),
    INDEX `export_job_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `feature_flag` ADD CONSTRAINT `feature_flag_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_mode` ADD CONSTRAINT `maintenance_mode_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_impersonated_user_id_fkey` FOREIGN KEY (`impersonated_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_impersonated_tenant_id_fkey` FOREIGN KEY (`impersonated_tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_setting` ADD CONSTRAINT `system_setting_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_job` ADD CONSTRAINT `export_job_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Insert seed data for feature flags
INSERT INTO `feature_flag` (`id`, `flag_key`, `name`, `description`, `is_enabled`, `updated_at`)
VALUES
  (UUID(), 'file_storage', 'File Storage', 'Allow tenants to upload files', true, NOW()),
  (UUID(), 'email_queue', 'Email Queue', 'Allow system to send emails', true, NOW()),
  (UUID(), 'background_jobs', 'Background Jobs', 'Allow job scheduling', true, NOW()),
  (UUID(), 'user_registration', 'User Registration', 'Allow new tenant signups', true, NOW()),
  (UUID(), 'api_access', 'API Access', 'Allow API requests', true, NOW());

-- Insert maintenance mode singleton
INSERT INTO `maintenance_mode` (`id`, `is_enabled`, `mode`, `message`, `updated_at`)
VALUES (UUID(), false, 'immediate', 'Lead360 is undergoing maintenance. We''ll be back shortly.', NOW());

-- Insert default system settings
INSERT INTO `system_setting` (`id`, `setting_key`, `setting_value`, `data_type`, `description`, `updated_at`)
VALUES
  (UUID(), 'max_file_upload_size_mb', '10', 'integer', 'Max file upload size in MB', NOW()),
  (UUID(), 'max_storage_per_tenant_gb', '500', 'integer', 'Max storage per tenant in GB', NOW()),
  (UUID(), 'session_timeout_minutes', '30', 'integer', 'Session timeout in minutes', NOW()),
  (UUID(), 'password_reset_token_expiry_hours', '24', 'integer', 'Password reset token expiry', NOW()),
  (UUID(), 'max_failed_login_attempts', '5', 'integer', 'Max failed login attempts before lockout', NOW()),
  (UUID(), 'account_lockout_duration_minutes', '15', 'integer', 'Account lockout duration', NOW()),
  (UUID(), 'job_retention_days', '30', 'integer', 'Job record retention in days', NOW()),
  (UUID(), 'audit_log_retention_days', '90', 'integer', 'Audit log retention in days', NOW());
