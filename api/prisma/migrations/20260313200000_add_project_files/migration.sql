-- CreateEnum: project_document_type
-- Note: MySQL does not have standalone ENUMs; the ENUM is defined inline on the column.

-- CreateTable: project_document
CREATE TABLE `project_document` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `document_type` ENUM('contract', 'permit', 'blueprint', 'agreement', 'photo', 'other') NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_document_tenant_id_project_id_document_type_idx`(`tenant_id`, `project_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: project_photo
CREATE TABLE `project_photo` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NULL,
    `log_id` VARCHAR(36) NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `caption` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `taken_at` DATE NULL,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_photo_tenant_id_project_id_is_public_idx`(`tenant_id`, `project_id`, `is_public`),
    INDEX `project_photo_tenant_id_project_id_task_id_idx`(`tenant_id`, `project_id`, `task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: project_document → tenant
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_document → project
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_document → user (uploaded_by)
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_document → file
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_photo → tenant
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: project_photo → project
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_photo → project_task
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: project_photo → user (uploaded_by)
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: project_photo → file
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
