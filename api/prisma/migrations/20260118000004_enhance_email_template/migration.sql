-- AlterTable: email_template
-- Purpose: Add multi-tenant support and categorization to email templates
-- Migration: 20260118000004_enhance_email_template

ALTER TABLE email_template
  ADD COLUMN tenant_id VARCHAR(36) AFTER id,
  ADD COLUMN category ENUM('system', 'transactional', 'marketing', 'notification')
    NOT NULL DEFAULT 'transactional' AFTER variable_schema,
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true AFTER category;

-- Drop old unique index
ALTER TABLE email_template DROP INDEX template_key;

-- Add new unique index for tenant + template_key combination
ALTER TABLE email_template
  ADD UNIQUE INDEX unique_tenant_template_key (tenant_id, template_key);

-- Add indexes for filtering
ALTER TABLE email_template
  ADD INDEX idx_tenant_active (tenant_id, is_active),
  ADD INDEX idx_tenant_category (tenant_id, category),
  ADD INDEX idx_is_system (is_system);

-- Add foreign key constraint
ALTER TABLE email_template
  ADD CONSTRAINT fk_email_template_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE;

-- Migrate existing system templates to admin templates (tenant_id = NULL)
UPDATE email_template SET tenant_id = NULL WHERE is_system = true;
