-- CreateEnum: permit_status
-- CreateTable: permit

-- Sprint 22 — Permit Tracking

CREATE TABLE `permit` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `permit_number` VARCHAR(100) NULL,
    `permit_type` VARCHAR(200) NOT NULL,
    `status` ENUM('not_required', 'pending_application', 'submitted', 'approved', 'active', 'failed', 'closed') NOT NULL DEFAULT 'pending_application',
    `submitted_date` DATE NULL,
    `approved_date` DATE NULL,
    `expiry_date` DATE NULL,
    `issuing_authority` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Indexes
CREATE INDEX `permit_tenant_id_project_id_idx` ON `permit`(`tenant_id`, `project_id`);
CREATE INDEX `permit_tenant_id_status_idx` ON `permit`(`tenant_id`, `status`);

-- Foreign Keys
ALTER TABLE `permit` ADD CONSTRAINT `permit_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `permit` ADD CONSTRAINT `permit_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `permit` ADD CONSTRAINT `permit_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
