-- CreateEnum
-- recurring_frequency: daily, weekly, monthly, quarterly, annual
-- recurring_rule_status: active, paused, completed, cancelled
-- (MySQL enums are inline on column definitions, not standalone)

-- CreateTable
CREATE TABLE `recurring_expense_rule` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(10, 2) NULL,
    `supplier_id` VARCHAR(36) NULL,
    `vendor_name` VARCHAR(200) NULL,
    `payment_method_registry_id` VARCHAR(36) NULL,
    `frequency` ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `day_of_month` TINYINT NULL,
    `day_of_week` TINYINT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `recurrence_count` INTEGER NULL,
    `occurrences_generated` INTEGER NOT NULL DEFAULT 0,
    `next_due_date` DATE NOT NULL,
    `auto_confirm` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `status` ENUM('active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    `last_generated_at` DATETIME(3) NULL,
    `last_generated_entry_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recurring_expense_rule_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `recurring_expense_rule_tenant_id_next_due_date_idx`(`tenant_id`, `next_due_date`),
    INDEX `recurring_expense_rule_tenant_id_status_next_due_date_idx`(`tenant_id`, `status`, `next_due_date`),
    INDEX `recurring_expense_rule_tenant_id_category_id_idx`(`tenant_id`, `category_id`),
    INDEX `recurring_expense_rule_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey: recurring_expense_rule -> tenant
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: recurring_expense_rule -> financial_category
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: recurring_expense_rule -> supplier
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: recurring_expense_rule -> payment_method_registry
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_payment_method_registry_id_fkey` FOREIGN KEY (`payment_method_registry_id`) REFERENCES `payment_method_registry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: recurring_expense_rule -> user (created_by)
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: recurring_expense_rule -> user (updated_by)
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: financial_entry -> recurring_expense_rule
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_recurring_rule_id_fkey` FOREIGN KEY (`recurring_rule_id`) REFERENCES `recurring_expense_rule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
