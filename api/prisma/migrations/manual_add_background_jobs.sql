-- Manual migration: Add background jobs tables
-- Created manually due to shadow database restrictions

-- job table
CREATE TABLE IF NOT EXISTS `job` (
  `id` VARCHAR(36) NOT NULL,
  `job_type` VARCHAR(100) NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `tenant_id` VARCHAR(36) NULL,
  `payload` JSON NULL,
  `result` JSON NULL,
  `error_message` TEXT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `max_retries` INT NOT NULL DEFAULT 3,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  `failed_at` DATETIME(3) NULL,
  `duration_ms` INT NULL,
  PRIMARY KEY (`id`),
  INDEX `job_tenant_id_status_created_at_idx`(`tenant_id`, `status`, `created_at`),
  INDEX `job_job_type_status_idx`(`job_type`, `status`),
  INDEX `job_status_created_at_idx`(`status`, `created_at`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- job_log table
CREATE TABLE IF NOT EXISTS `job_log` (
  `id` VARCHAR(36) NOT NULL,
  `job_id` VARCHAR(36) NOT NULL,
  `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `level` VARCHAR(20) NOT NULL,
  `message` TEXT NOT NULL,
  `metadata` JSON NULL,
  PRIMARY KEY (`id`),
  INDEX `job_log_job_id_timestamp_idx`(`job_id`, `timestamp`),
  CONSTRAINT `job_log_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- scheduled_job table
CREATE TABLE IF NOT EXISTS `scheduled_job` (
  `id` VARCHAR(36) NOT NULL,
  `job_type` VARCHAR(100) NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `description` TEXT NULL,
  `schedule` VARCHAR(100) NOT NULL,
  `timezone` VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
  `is_enabled` BOOLEAN NOT NULL DEFAULT true,
  `last_run_at` DATETIME(3) NULL,
  `next_run_at` DATETIME(3) NULL,
  `max_retries` INT NOT NULL DEFAULT 3,
  `timeout_seconds` INT NOT NULL DEFAULT 300,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `scheduled_job_job_type_key`(`job_type`),
  INDEX `scheduled_job_is_enabled_next_run_at_idx`(`is_enabled`, `next_run_at`),
  INDEX `scheduled_job_job_type_idx`(`job_type`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- platform_email_config table
CREATE TABLE IF NOT EXISTS `platform_email_config` (
  `id` VARCHAR(36) NOT NULL,
  `smtp_host` VARCHAR(255) NOT NULL,
  `smtp_port` INT NOT NULL,
  `smtp_encryption` VARCHAR(20) NOT NULL DEFAULT 'tls',
  `smtp_username` VARCHAR(255) NOT NULL,
  `smtp_password` TEXT NOT NULL,
  `from_email` VARCHAR(255) NOT NULL,
  `from_name` VARCHAR(255) NOT NULL,
  `is_verified` BOOLEAN NOT NULL DEFAULT false,
  `updated_at` DATETIME(3) NOT NULL,
  `updated_by_user_id` VARCHAR(36) NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- email_template table
CREATE TABLE IF NOT EXISTS `email_template` (
  `id` VARCHAR(36) NOT NULL,
  `template_key` VARCHAR(100) NOT NULL,
  `subject` VARCHAR(500) NOT NULL,
  `html_body` TEXT NOT NULL,
  `text_body` TEXT NULL,
  `variables` JSON NOT NULL,
  `description` TEXT NULL,
  `is_system` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_template_template_key_key`(`template_key`),
  INDEX `email_template_template_key_idx`(`template_key`),
  INDEX `email_template_is_system_idx`(`is_system`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- email_queue table
CREATE TABLE IF NOT EXISTS `email_queue` (
  `id` VARCHAR(36) NOT NULL,
  `job_id` VARCHAR(36) NOT NULL,
  `template_key` VARCHAR(100) NULL,
  `to_email` VARCHAR(255) NOT NULL,
  `cc_emails` JSON NULL,
  `bcc_emails` JSON NULL,
  `subject` VARCHAR(500) NOT NULL,
  `html_body` TEXT NOT NULL,
  `text_body` TEXT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
  `smtp_message_id` VARCHAR(255) NULL,
  `error_message` TEXT NULL,
  `sent_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_queue_job_id_key`(`job_id`),
  INDEX `email_queue_status_created_at_idx`(`status`, `created_at`),
  INDEX `email_queue_job_id_idx`(`job_id`),
  CONSTRAINT `email_queue_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
