-- Add max_storage_gb field to subscription_plan table
ALTER TABLE `subscription_plan` ADD COLUMN `max_storage_gb` DECIMAL(10,2) NULL AFTER `max_users`;
