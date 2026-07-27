-- Sprint 21: Task Calendar Events

-- CreateEnum
-- calendar_sync_status: pending, synced, failed, local_only

-- CreateTable
CREATE TABLE `task_calendar_event` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `start_datetime` DATETIME(3) NOT NULL,
    `end_datetime` DATETIME(3) NOT NULL,
    `google_event_id` VARCHAR(300) NULL,
    `internal_calendar_id` VARCHAR(36) NULL,
    `sync_status` ENUM('pending', 'synced', 'failed', 'local_only') NOT NULL DEFAULT 'pending',
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_calendar_event_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `task_calendar_event_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `task_calendar_event_tenant_id_sync_status_idx`(`tenant_id`, `sync_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
