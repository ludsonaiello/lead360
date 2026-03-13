-- CreateTable
CREATE TABLE `financial_category` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` ENUM('labor', 'material', 'subcontractor', 'equipment', 'other') NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system_default` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_category_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `financial_category_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_entry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `entry_type` ENUM('expense', 'income') NOT NULL DEFAULT 'expense',
    `amount` DECIMAL(12, 2) NOT NULL,
    `entry_date` DATE NOT NULL,
    `vendor_name` VARCHAR(200) NULL,
    `crew_member_id` VARCHAR(36) NULL,
    `subcontractor_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `has_receipt` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_entry_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `financial_entry_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `financial_entry_tenant_id_project_id_category_id_idx`(`tenant_id`, `project_id`, `category_id`),
    INDEX `financial_entry_tenant_id_entry_date_idx`(`tenant_id`, `entry_date`),
    INDEX `financial_entry_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    INDEX `financial_entry_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `financial_category` ADD CONSTRAINT `financial_category_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category` ADD CONSTRAINT `financial_category_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
