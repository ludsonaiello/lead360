-- Sprint 07: Project Entity Schema
-- Adds project table, project_status enum, tenant project number counter,
-- quote deletion_locked flag, and financial_entry → project FK.

-- AlterTable: Add deletion_locked to quote
ALTER TABLE `quote` ADD COLUMN `deletion_locked` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add next_project_number to tenant
ALTER TABLE `tenant` ADD COLUMN `next_project_number` INTEGER NOT NULL DEFAULT 1;

-- CreateTable: project
CREATE TABLE `project` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NULL,
    `lead_id` VARCHAR(36) NULL,
    `project_number` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('planned', 'in_progress', 'on_hold', 'completed', 'canceled') NOT NULL DEFAULT 'planned',
    `start_date` DATE NULL,
    `target_completion_date` DATE NULL,
    `actual_completion_date` DATE NULL,
    `permit_required` BOOLEAN NOT NULL DEFAULT false,
    `assigned_pm_user_id` VARCHAR(36) NULL,
    `contract_value` DECIMAL(12, 2) NULL,
    `estimated_cost` DECIMAL(12, 2) NULL,
    `progress_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_standalone` BOOLEAN NOT NULL DEFAULT false,
    `portal_enabled` BOOLEAN NOT NULL DEFAULT true,
    `deletion_locked` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `project_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `project_tenant_id_lead_id_idx`(`tenant_id`, `lead_id`),
    INDEX `project_tenant_id_assigned_pm_user_id_idx`(`tenant_id`, `assigned_pm_user_id`),
    UNIQUE INDEX `project_tenant_id_project_number_key`(`tenant_id`, `project_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: financial_entry → project
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project → tenant
ALTER TABLE `project` ADD CONSTRAINT `project_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project → quote
ALTER TABLE `project` ADD CONSTRAINT `project_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project → lead
ALTER TABLE `project` ADD CONSTRAINT `project_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project → user (assigned PM)
ALTER TABLE `project` ADD CONSTRAINT `project_assigned_pm_user_id_fkey` FOREIGN KEY (`assigned_pm_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project → user (created by)
ALTER TABLE `project` ADD CONSTRAINT `project_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
