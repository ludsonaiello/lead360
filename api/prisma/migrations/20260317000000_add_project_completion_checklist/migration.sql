-- Sprint 26: Project Completion Checklist + Punch List

-- CreateEnum: punch_list_status
-- MySQL doesn't use separate enum types; they are inline in column definitions.

-- CreateTable: project_completion_checklist
CREATE TABLE `project_completion_checklist` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_completion_checklist_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    UNIQUE INDEX `project_completion_checklist_tenant_id_project_id_key`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: project_completion_checklist_item
CREATE TABLE `project_completion_checklist_item` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `checklist_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `is_required` BOOLEAN NOT NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `completed_by_user_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `template_item_id` VARCHAR(36) NULL,
    `order_index` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_completion_checklist_item_tenant_id_checklist_id_idx`(`tenant_id`, `checklist_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: punch_list_item
CREATE TABLE `punch_list_item` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `checklist_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
    `assigned_to_crew_id` VARCHAR(36) NULL,
    `resolved_at` DATETIME(3) NULL,
    `reported_by_user_id` VARCHAR(36) NULL,
    `resolved_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_list_item_tenant_id_checklist_id_idx`(`tenant_id`, `checklist_id`),
    INDEX `punch_list_item_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `punch_list_item_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: project_completion_checklist → tenant
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist → project
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist → completion_checklist_template
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `completion_checklist_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist → user (created_by)
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist_item → project_completion_checklist
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_checklist_id_fkey` FOREIGN KEY (`checklist_id`) REFERENCES `project_completion_checklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist_item → completion_checklist_template_item
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_template_item_id_fkey` FOREIGN KEY (`template_item_id`) REFERENCES `completion_checklist_template_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist_item → tenant
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_completion_checklist_item → user (completed_by)
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_completed_by_user_id_fkey` FOREIGN KEY (`completed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → tenant
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → project_completion_checklist
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_checklist_id_fkey` FOREIGN KEY (`checklist_id`) REFERENCES `project_completion_checklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → project
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → user (reported_by)
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_reported_by_user_id_fkey` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → user (resolved_by)
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_resolved_by_user_id_fkey` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: punch_list_item → crew_member (assigned_to)
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_assigned_to_crew_id_fkey` FOREIGN KEY (`assigned_to_crew_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
