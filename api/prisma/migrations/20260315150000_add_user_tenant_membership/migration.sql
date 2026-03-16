-- DropIndex (remove composite unique on email+tenant_id, replaced by standalone unique on email)
DROP INDEX `user_email_tenant_id_key` ON `user`;

-- CreateTable
CREATE TABLE `user_tenant_membership` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'INVITED',
    `invite_token_hash` VARCHAR(255) NULL,
    `invite_token_expires_at` DATETIME(3) NULL,
    `invite_accepted_at` DATETIME(3) NULL,
    `invited_by_user_id` VARCHAR(36) NULL,
    `joined_at` DATETIME(3) NULL,
    `left_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_tenant_membership_invite_token_hash_key`(`invite_token_hash`),
    INDEX `user_tenant_membership_user_id_status_idx`(`user_id`, `status`),
    INDEX `user_tenant_membership_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `user_tenant_membership_tenant_id_role_id_idx`(`tenant_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex (standalone unique on email — BR-01: globally unique email)
CREATE UNIQUE INDEX `user_email_key` ON `user`(`email`);

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_invited_by_user_id_fkey` FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
