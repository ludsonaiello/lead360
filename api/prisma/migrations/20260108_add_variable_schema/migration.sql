-- Add variable_schema column to email_template table
-- This column stores detailed schema information for template variables including
-- type, description, examples, and category for each variable

ALTER TABLE `email_template`
ADD COLUMN `variable_schema` JSON DEFAULT NULL AFTER `variables`;

-- Update column comment for documentation
ALTER TABLE `email_template`
MODIFY COLUMN `variable_schema` JSON DEFAULT NULL COMMENT 'Schema for each variable: type, category, description, example, required';
