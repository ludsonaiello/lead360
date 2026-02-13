-- Sprint 3: SMS Templates System
-- Manual Migration: Add sms_template table
-- Created: 2026-02-13
-- Author: AI Developer #3
--
-- Purpose: Enable tenants to save and reuse SMS messages with dynamic merge fields
--
-- IMPORTANT: Run this migration manually using:
--   mysql -u root -p lead360 < manual_add_sms_template_system.sql

-- Create sms_template table
CREATE TABLE `sms_template` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL COMMENT 'Template name (e.g., "Quote Follow-up")',
  `description` VARCHAR(255) NULL COMMENT 'Optional description of template purpose',
  `template_body` TEXT NOT NULL COMMENT 'Template text with {merge_fields} like {lead.first_name}',
  `category` VARCHAR(50) NULL COMMENT 'Template category (e.g., "quote", "appointment", "follow_up")',
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Whether template is active and available for use',
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether this is the default template for its category',
  `usage_count` INT NOT NULL DEFAULT 0 COMMENT 'Number of times template has been used',
  `created_by` VARCHAR(36) NOT NULL COMMENT 'User who created the template',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),

  -- Foreign keys
  CONSTRAINT `sms_template_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT `sms_template_created_by_fkey`
    FOREIGN KEY (`created_by`) REFERENCES `user`(`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,

  -- Indexes for performance
  INDEX `sms_template_tenant_id_is_active_idx` (`tenant_id`, `is_active`),
  INDEX `sms_template_tenant_id_category_idx` (`tenant_id`, `category`)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SMS templates for reusable messages with merge field support (Sprint 3)';

-- Verify table creation
SELECT
  TABLE_NAME,
  TABLE_COMMENT
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'lead360'
  AND TABLE_NAME = 'sms_template';

-- Verify columns
SELECT
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_DEFAULT,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lead360'
  AND TABLE_NAME = 'sms_template'
ORDER BY ORDINAL_POSITION;
