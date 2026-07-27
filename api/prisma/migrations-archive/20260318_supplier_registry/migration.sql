-- CreateTable
CREATE TABLE `supplier_category` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_category_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `supplier_category_tenant_id_name_idx`(`tenant_id`, `name`),
    UNIQUE INDEX `supplier_category_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_category_assignment` (
    `id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `supplier_category_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_category_assignment_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_category_assignment_tenant_id_supplier_category_id_idx`(`tenant_id`, `supplier_category_id`),
    UNIQUE INDEX `supplier_category_assignment_supplier_id_supplier_category_i_key`(`supplier_id`, `supplier_category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `legal_name` VARCHAR(200) NULL,
    `website` VARCHAR(500) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `contact_name` VARCHAR(150) NULL,
    `address_line1` VARCHAR(255) NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(2) NULL,
    `zip_code` VARCHAR(10) NULL,
    `country` VARCHAR(2) NOT NULL DEFAULT 'US',
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `google_place_id` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_preferred` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `total_spend` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `last_purchase_date` DATE NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `supplier_tenant_id_is_preferred_idx`(`tenant_id`, `is_preferred`),
    INDEX `supplier_tenant_id_name_idx`(`tenant_id`, `name`),
    INDEX `supplier_tenant_id_last_purchase_date_idx`(`tenant_id`, `last_purchase_date`),
    INDEX `supplier_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_product` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `unit_of_measure` VARCHAR(50) NOT NULL,
    `unit_price` DECIMAL(12, 4) NULL,
    `price_last_updated_at` DATE NULL,
    `price_last_updated_by_user_id` VARCHAR(36) NULL,
    `sku` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_product_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_product_tenant_id_supplier_id_is_active_idx`(`tenant_id`, `supplier_id`, `is_active`),
    INDEX `supplier_product_supplier_id_name_idx`(`supplier_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_product_price_history` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `supplier_product_id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `previous_price` DECIMAL(12, 4) NULL,
    `new_price` DECIMAL(12, 4) NOT NULL,
    `changed_by_user_id` VARCHAR(36) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(500) NULL,

    INDEX `supplier_product_price_history_tenant_id_supplier_product_id_idx`(`tenant_id`, `supplier_product_id`),
    INDEX `supplier_product_price_history_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_product_price_history_supplier_product_id_changed_a_idx`(`supplier_product_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `financial_entry_tenant_id_supplier_id_idx` ON `financial_entry`(`tenant_id`, `supplier_id`);

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category` ADD CONSTRAINT `supplier_category_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category` ADD CONSTRAINT `supplier_category_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_supplier_category_id_fkey` FOREIGN KEY (`supplier_category_id`) REFERENCES `supplier_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_price_last_updated_by_user_id_fkey` FOREIGN KEY (`price_last_updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_supplier_product_id_fkey` FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
