-- CreateEnum
-- payment_method enum (canonical for entire platform)

-- CreateTable
CREATE TABLE `crew_member` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `address_line1` VARCHAR(200) NULL,
    `address_line2` VARCHAR(100) NULL,
    `address_city` VARCHAR(100) NULL,
    `address_state` VARCHAR(2) NULL,
    `address_zip` VARCHAR(10) NULL,
    `date_of_birth` DATE NULL,
    `ssn_encrypted` TEXT NULL,
    `itin_encrypted` TEXT NULL,
    `has_drivers_license` BOOLEAN NULL,
    `drivers_license_number_encrypted` TEXT NULL,
    `default_hourly_rate` DECIMAL(8, 2) NULL,
    `weekly_hours_schedule` INTEGER NULL,
    `overtime_enabled` BOOLEAN NOT NULL DEFAULT false,
    `overtime_rate_multiplier` DECIMAL(4, 2) NULL,
    `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle') NULL,
    `bank_name` VARCHAR(200) NULL,
    `bank_routing_encrypted` TEXT NULL,
    `bank_account_encrypted` TEXT NULL,
    `venmo_handle` VARCHAR(100) NULL,
    `zelle_contact` VARCHAR(100) NULL,
    `profile_photo_file_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `crew_member_user_id_key`(`user_id`),
    INDEX `crew_member_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `crew_member_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    INDEX `crew_member_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `crew_member_tenant_id_default_hourly_rate_idx`(`tenant_id`, `default_hourly_rate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_profile_photo_file_id_fkey` FOREIGN KEY (`profile_photo_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;
