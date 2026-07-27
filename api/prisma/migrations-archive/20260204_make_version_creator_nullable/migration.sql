-- Make created_by_user_id nullable in version table for platform templates
ALTER TABLE `quote_template_version` MODIFY COLUMN `created_by_user_id` VARCHAR(36) NULL;
