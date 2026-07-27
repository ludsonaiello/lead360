-- CreateTable: completion_checklist_template
-- CreateTable: completion_checklist_template_item
-- Sprint 25 — Completion Checklist Templates

-- Create the completion_checklist_template table
CREATE TABLE `completion_checklist_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `completion_checklist_template_tenant_id_name_key`(`tenant_id`, `name`),
    INDEX `completion_checklist_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create the completion_checklist_template_item table
CREATE TABLE `completion_checklist_template_item` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `completion_checklist_template_item_tenant_id_template_id_idx`(`tenant_id`, `template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys for completion_checklist_template
ALTER TABLE `completion_checklist_template` ADD CONSTRAINT `completion_checklist_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `completion_checklist_template` ADD CONSTRAINT `completion_checklist_template_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for completion_checklist_template_item
ALTER TABLE `completion_checklist_template_item` ADD CONSTRAINT `completion_checklist_template_item_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `completion_checklist_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `completion_checklist_template_item` ADD CONSTRAINT `completion_checklist_template_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
