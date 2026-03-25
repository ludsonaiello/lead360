-- AlterTable
ALTER TABLE `financial_entry` ADD COLUMN `payment_method_registry_id` VARCHAR(36) NULL;

-- CreateTable
CREATE TABLE `payment_method_registry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `nickname` VARCHAR(100) NOT NULL,
    `type` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
    `bank_name` VARCHAR(100) NULL,
    `last_four` VARCHAR(4) NULL,
    `notes` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_method_registry_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `payment_method_registry_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `payment_method_registry_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    INDEX `payment_method_registry_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `financial_entry_tenant_id_payment_method_registry_id_idx` ON `financial_entry`(`tenant_id`, `payment_method_registry_id`);

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_payment_method_registry_id_fkey` FOREIGN KEY (`payment_method_registry_id`) REFERENCES `payment_method_registry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
