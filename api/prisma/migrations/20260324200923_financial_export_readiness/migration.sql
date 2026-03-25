-- Sprint F-10: Financial Export Readiness
-- Creates financial_export_log and financial_category_account_mapping tables

-- CreateTable: financial_export_log
CREATE TABLE `financial_export_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `export_type` ENUM('quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv') NOT NULL,
    `date_from` DATE NULL,
    `date_to` DATE NULL,
    `record_count` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `filters_applied` TEXT NULL,
    `exported_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fin_export_log_tenant_export_type_idx`(`tenant_id`, `export_type`),
    INDEX `fin_export_log_tenant_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `fin_export_log_tenant_user_idx`(`tenant_id`, `exported_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: financial_category_account_mapping
CREATE TABLE `financial_category_account_mapping` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `platform` ENUM('quickbooks', 'xero') NOT NULL,
    `account_name` VARCHAR(200) NOT NULL,
    `account_code` VARCHAR(50) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fin_cat_acct_map_tenant_platform_idx`(`tenant_id`, `platform`),
    UNIQUE INDEX `fin_cat_acct_map_tenant_cat_platform_key`(`tenant_id`, `category_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: financial_export_log → tenant
ALTER TABLE `financial_export_log` ADD CONSTRAINT `financial_export_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: financial_export_log → user
ALTER TABLE `financial_export_log` ADD CONSTRAINT `financial_export_log_user_id_fkey` FOREIGN KEY (`exported_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: financial_category_account_mapping → tenant
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `fin_cat_acct_map_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: financial_category_account_mapping → financial_category
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `fin_cat_acct_map_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: financial_category_account_mapping → user (created_by)
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `fin_cat_acct_map_created_by_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: financial_category_account_mapping → user (updated_by)
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `fin_cat_acct_map_updated_by_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
