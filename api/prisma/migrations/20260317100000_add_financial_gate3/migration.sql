-- Financial Gate 3 (Sprint 27): Crew Payments, Hour Logs, Subcontractor Payments, Task Invoices

-- CreateTable
CREATE TABLE `crew_payment_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle') NOT NULL,
    `reference_number` VARCHAR(200) NULL,
    `period_start_date` DATE NULL,
    `period_end_date` DATE NULL,
    `hours_paid` DECIMAL(6, 2) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crew_payment_record_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    INDEX `crew_payment_record_tenant_id_crew_member_id_payment_date_idx`(`tenant_id`, `crew_member_id`, `payment_date`),
    INDEX `crew_payment_record_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crew_hour_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NULL,
    `log_date` DATE NOT NULL,
    `hours_regular` DECIMAL(5, 2) NOT NULL,
    `hours_overtime` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `source` ENUM('manual', 'clockin_system') NOT NULL DEFAULT 'manual',
    `clockin_event_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `crew_hour_log_tenant_id_crew_member_id_log_date_idx`(`tenant_id`, `crew_member_id`, `log_date`),
    INDEX `crew_hour_log_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `crew_hour_log_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_payment_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle') NOT NULL,
    `reference_number` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_pay_idx`(`tenant_id`, `subcontractor_id`, `payment_date`),
    INDEX `subcontractor_payment_record_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_task_invoice` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `invoice_number` VARCHAR(100) NULL,
    `invoice_date` DATE NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `file_id` VARCHAR(36) NULL,
    `file_url` VARCHAR(500) NULL,
    `file_name` VARCHAR(255) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `subcontractor_task_invoice_tenant_id_invoice_number_key`(`tenant_id`, `invoice_number`),
    INDEX `subcontractor_task_invoice_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    INDEX `subcontractor_task_invoice_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `subcontractor_task_invoice_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `subcontractor_task_invoice_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
