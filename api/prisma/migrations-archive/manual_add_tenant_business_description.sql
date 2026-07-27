-- Manual Migration: Add business_description field to tenant table
-- Date: 2026-02-25
-- Purpose: Add "About Us" / company story field for AI agent context enhancement

ALTER TABLE `tenant`
ADD COLUMN `business_description` TEXT NULL COMMENT 'About Us / company story for AI agent context'
AFTER `default_language`;

-- Verify the column was added
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM
    INFORMATION_SCHEMA.COLUMNS
WHERE
    TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'tenant'
    AND COLUMN_NAME = 'business_description';
