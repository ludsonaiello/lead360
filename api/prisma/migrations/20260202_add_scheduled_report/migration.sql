-- CreateTable
CREATE TABLE `scheduled_report` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `report_type` VARCHAR(50) NOT NULL,
    `schedule` VARCHAR(20) NOT NULL,
    `parameters` JSON NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `recipients` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `next_run_at` DATETIME(3) NOT NULL,
    `last_run_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scheduled_report_admin_user_id_idx`(`admin_user_id`),
    INDEX `scheduled_report_is_active_next_run_at_idx`(`is_active`, `next_run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scheduled_report` ADD CONSTRAINT `scheduled_report_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
