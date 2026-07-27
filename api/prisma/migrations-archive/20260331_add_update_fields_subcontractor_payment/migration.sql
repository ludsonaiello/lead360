-- Add updated_by_user_id and updated_at to subcontractor_payment_record
ALTER TABLE `subcontractor_payment_record`
  ADD COLUMN `updated_by_user_id` VARCHAR(36) NULL,
  ADD COLUMN `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- Add foreign key for updated_by_user_id
ALTER TABLE `subcontractor_payment_record`
  ADD CONSTRAINT `subcontractor_payment_record_updated_by_user_id_fkey`
  FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
