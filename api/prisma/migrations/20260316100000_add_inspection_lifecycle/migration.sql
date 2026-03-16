-- CreateEnum: inspection_result
-- CreateTable: inspection
-- Sprint 23 — Inspection Lifecycle

-- Create the inspection table
CREATE TABLE `inspection` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `permit_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `inspection_type` VARCHAR(200) NOT NULL,
    `scheduled_date` DATE NULL,
    `inspector_name` VARCHAR(200) NULL,
    `result` ENUM('pass', 'fail', 'conditional', 'pending') NULL,
    `reinspection_required` BOOLEAN NOT NULL DEFAULT false,
    `reinspection_date` DATE NULL,
    `notes` TEXT NULL,
    `inspected_by_user_id` VARCHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inspection_tenant_id_permit_id_idx`(`tenant_id`, `permit_id`),
    INDEX `inspection_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_permit_id_fkey` FOREIGN KEY (`permit_id`) REFERENCES `permit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_inspected_by_user_id_fkey` FOREIGN KEY (`inspected_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
