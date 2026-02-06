-- CreateTable: twilio_usage_record
-- Stores usage data synced from Twilio API for billing and cost tracking
CREATE TABLE `twilio_usage_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `category` VARCHAR(50) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `usage_unit` VARCHAR(20) NOT NULL,
    `price` DECIMAL(10, 4) NOT NULL,
    `price_unit` VARCHAR(10) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `twilio_usage_record_tenant_id_start_date_idx`(`tenant_id`, `start_date` DESC),
    INDEX `twilio_usage_record_category_start_date_idx`(`category`, `start_date` DESC),
    INDEX `twilio_usage_record_tenant_id_category_start_date_idx`(`tenant_id`, `category`, `start_date` DESC),
    INDEX `twilio_usage_record_synced_at_idx`(`synced_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: system_health_check
-- Tracks system health checks for monitoring and alerting
CREATE TABLE `system_health_check` (
    `id` VARCHAR(36) NOT NULL,
    `check_type` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `response_time_ms` INTEGER NULL,
    `error_message` TEXT NULL,
    `details` JSON NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_health_check_check_type_checked_at_idx`(`check_type`, `checked_at` DESC),
    INDEX `system_health_check_status_checked_at_idx`(`status`, `checked_at` DESC),
    INDEX `system_health_check_check_type_status_checked_at_idx`(`check_type`, `status`, `checked_at` DESC),
    INDEX `system_health_check_checked_at_idx`(`checked_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: admin_alert
-- Stores system alerts for admin notification
CREATE TABLE `admin_alert` (
    `id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `details` JSON NULL,
    `acknowledged` BOOLEAN NOT NULL DEFAULT false,
    `acknowledged_by` VARCHAR(36) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_alert_severity_acknowledged_created_at_idx`(`severity`, `acknowledged`, `created_at` DESC),
    INDEX `admin_alert_type_severity_created_at_idx`(`type`, `severity`, `created_at` DESC),
    INDEX `admin_alert_acknowledged_created_at_idx`(`acknowledged`, `created_at` DESC),
    INDEX `admin_alert_created_at_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: twilio_usage_record -> tenant
ALTER TABLE `twilio_usage_record` ADD CONSTRAINT `twilio_usage_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: admin_alert -> user
ALTER TABLE `admin_alert` ADD CONSTRAINT `admin_alert_acknowledged_by_fkey` FOREIGN KEY (`acknowledged_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
