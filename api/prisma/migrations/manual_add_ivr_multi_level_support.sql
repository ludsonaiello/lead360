-- Migration: Add multi-level IVR support
-- Date: 2026-02-25
-- Description: Adds max_depth column to ivr_configuration table to support nested menu structures

-- Add max_depth column for multi-level IVR support
ALTER TABLE `ivr_configuration`
ADD COLUMN `max_depth` INT NOT NULL DEFAULT 4
AFTER `max_retries`;

-- Update comment for menu_options column to clarify it supports nested structures
ALTER TABLE `ivr_configuration`
MODIFY COLUMN `menu_options` JSON COMMENT 'Menu options array - supports nested submenu structures for multi-level IVR';

-- Note: Existing single-level configurations remain valid without data migration
