-- CreateTable
CREATE TABLE `portal_account` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `customer_slug` VARCHAR(200) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `reset_token` VARCHAR(200) NULL,
    `reset_token_expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `portal_account_tenant_id_lead_id_key`(`tenant_id`, `lead_id`),
    UNIQUE INDEX `portal_account_tenant_id_email_key`(`tenant_id`, `email`),
    UNIQUE INDEX `portal_account_tenant_id_customer_slug_key`(`tenant_id`, `customer_slug`),
    INDEX `portal_account_tenant_id_is_active_idx`(`tenant_id`, `is_active`),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `portal_account` ADD CONSTRAINT `portal_account_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portal_account` ADD CONSTRAINT `portal_account_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
