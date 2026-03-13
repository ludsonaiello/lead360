-- CreateTable
CREATE TABLE `project_activity` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `activity_type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_activity_tenant_id_project_id_created_at_idx`(`tenant_id`, `project_id`, `created_at` DESC),
    INDEX `project_activity_tenant_id_activity_type_idx`(`tenant_id`, `activity_type`),
    INDEX `project_activity_project_id_created_at_idx`(`project_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
