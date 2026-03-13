-- ============================================================
-- Migration: 20260313400000_add_receipt
-- Sprint 11 — Financial Gate 2
-- Adds receipt table with receipt_file_type and receipt_ocr_status enums
-- ============================================================

-- CreateTable
CREATE TABLE `receipt` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `financial_entry_id` VARCHAR(36) NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` ENUM('photo', 'pdf') NOT NULL,
    `file_size_bytes` INTEGER NULL,
    `vendor_name` VARCHAR(200) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `receipt_date` DATE NULL,
    `ocr_raw` TEXT NULL,
    `ocr_status` ENUM('not_processed', 'processing', 'complete', 'failed') NOT NULL DEFAULT 'not_processed',
    `ocr_vendor` VARCHAR(200) NULL,
    `ocr_amount` DECIMAL(12, 2) NULL,
    `ocr_date` DATE NULL,
    `is_categorized` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `receipt_tenant_id_financial_entry_id_idx`(`tenant_id`, `financial_entry_id`),
    INDEX `receipt_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `receipt_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `receipt_tenant_id_is_categorized_idx`(`tenant_id`, `is_categorized`),
    INDEX `receipt_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `receipt_file_id_fkey`(`file_id`),
    INDEX `receipt_uploaded_by_user_id_fkey`(`uploaded_by_user_id`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: receipt → tenant (CASCADE delete)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: receipt → financial_entry (SET NULL on delete)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_financial_entry_id_fkey`
    FOREIGN KEY (`financial_entry_id`) REFERENCES `financial_entry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: receipt → project (SET NULL on delete, nullable)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_project_id_fkey`
    FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: receipt → project_task (SET NULL on delete, nullable)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_task_id_fkey`
    FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: receipt → user via uploaded_by_user_id (RESTRICT — cannot delete user with receipts)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_uploaded_by_user_id_fkey`
    FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: receipt → file via file_id UUID (@unique in file table, RESTRICT delete)
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_file_id_fkey`
    FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
