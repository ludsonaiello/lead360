-- CreateEnum
-- project_task_category enum is handled natively in MySQL via the column type

-- CreateTable
CREATE TABLE `project_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `industry_type` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `project_template_tenant_id_industry_type_idx`(`tenant_id`, `industry_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_template_task` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `estimated_duration_days` INTEGER NULL,
    `category` ENUM('labor', 'material', 'subcontractor', 'equipment', 'other') NULL,
    `order_index` INTEGER NOT NULL,
    `depends_on_order_index` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_template_task_tenant_id_template_id_idx`(`tenant_id`, `template_id`),
    INDEX `project_template_task_template_id_order_index_idx`(`template_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_template` ADD CONSTRAINT `project_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template` ADD CONSTRAINT `project_template_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template_task` ADD CONSTRAINT `project_template_task_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `project_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template_task` ADD CONSTRAINT `project_template_task_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
