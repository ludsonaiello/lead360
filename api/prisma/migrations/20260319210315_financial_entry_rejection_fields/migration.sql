-- AlterTable: Add rejection workflow fields to financial_entry (Sprint F-04)
ALTER TABLE `financial_entry`
    ADD COLUMN `rejection_reason` VARCHAR(500) NULL,
    ADD COLUMN `rejected_by_user_id` VARCHAR(36) NULL,
    ADD COLUMN `rejected_at` DATETIME(3) NULL;

-- AddForeignKey: rejected_by_user_id -> user(id) ON DELETE SET NULL
ALTER TABLE `financial_entry`
    ADD CONSTRAINT `financial_entry_rejected_by_user_id_fkey`
    FOREIGN KEY (`rejected_by_user_id`) REFERENCES `user`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex: tenant_id + rejected_at for rejection filtering
CREATE INDEX `financial_entry_tenant_id_rejected_at_idx` ON `financial_entry`(`tenant_id`, `rejected_at`);
