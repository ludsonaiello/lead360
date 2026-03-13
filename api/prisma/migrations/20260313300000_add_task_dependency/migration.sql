-- CreateTable
CREATE TABLE `task_dependency` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `depends_on_task_id` VARCHAR(36) NOT NULL,
    `dependency_type` VARCHAR(20) NOT NULL DEFAULT 'finish_to_start',
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_dependency_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `task_dependency_tenant_id_depends_on_task_id_idx`(`tenant_id`, `depends_on_task_id`),
    UNIQUE INDEX `task_dependency_task_id_depends_on_task_id_key`(`task_id`, `depends_on_task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_depends_on_task_id_fkey` FOREIGN KEY (`depends_on_task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
