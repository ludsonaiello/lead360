-- Sprint 08: Project Task Entity Schema
-- Adds project_task table and project_task_status enum for task tracking within projects.

-- CreateTable: project_task
CREATE TABLE `project_task` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `quote_item_id` VARCHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('not_started', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'not_started',
    `estimated_duration_days` INTEGER NULL,
    `estimated_start_date` DATE NULL,
    `estimated_end_date` DATE NULL,
    `actual_start_date` DATE NULL,
    `actual_end_date` DATE NULL,
    `is_delayed` BOOLEAN NOT NULL DEFAULT false,
    `order_index` INTEGER NOT NULL,
    `category` ENUM('labor', 'material', 'subcontractor', 'equipment', 'other') NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_task_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `project_task_tenant_id_project_id_status_idx`(`tenant_id`, `project_id`, `status`),
    INDEX `project_task_tenant_id_project_id_order_index_idx`(`tenant_id`, `project_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: project_task → tenant
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_task → project
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_task → quote_item
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_quote_item_id_fkey` FOREIGN KEY (`quote_item_id`) REFERENCES `quote_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project_task → user (created_by)
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
