-- Sprint 1.1: Financial Foundation Migration
-- Enums, Model Fields, Indexes, and Data Seed

-- AlterTable: Expand payment_method enum on all tables that use it
ALTER TABLE `crew_member` MODIFY `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL;

ALTER TABLE `crew_payment_record` MODIFY `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL;

ALTER TABLE `subcontractor` MODIFY `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL;

ALTER TABLE `subcontractor_payment_record` MODIFY `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL;

-- AlterTable: Add classification field and expand type enum on financial_category
ALTER TABLE `financial_category` ADD COLUMN `classification` ENUM('cost_of_goods_sold', 'operating_expense') NOT NULL DEFAULT 'cost_of_goods_sold',
    MODIFY `type` ENUM('labor', 'material', 'subcontractor', 'equipment', 'insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools', 'other') NOT NULL;

-- AlterTable: Make project_id nullable and add 9 new fields on financial_entry
ALTER TABLE `financial_entry` ADD COLUMN `entry_time` TIME(0) NULL,
    ADD COLUMN `is_recurring_instance` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL,
    ADD COLUMN `purchased_by_crew_member_id` VARCHAR(36) NULL,
    ADD COLUMN `purchased_by_user_id` VARCHAR(36) NULL,
    ADD COLUMN `recurring_rule_id` VARCHAR(36) NULL,
    ADD COLUMN `submission_status` ENUM('pending_review', 'confirmed') NOT NULL DEFAULT 'confirmed',
    ADD COLUMN `supplier_id` VARCHAR(36) NULL,
    ADD COLUMN `tax_amount` DECIMAL(10, 2) NULL,
    MODIFY `project_id` VARCHAR(36) NULL;

-- CreateIndex: classification index on financial_category
CREATE INDEX `financial_category_tenant_id_classification_idx` ON `financial_category`(`tenant_id`, `classification`);

-- AddForeignKey: purchased_by_user relation
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_purchased_by_user_id_fkey` FOREIGN KEY (`purchased_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: purchased_by_crew_member relation
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_purchased_by_crew_member_id_fkey` FOREIGN KEY (`purchased_by_crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Schema drift fixes (align database with Prisma schema)
ALTER TABLE `platform_email_config` ALTER COLUMN `updated_at` DROP DEFAULT;

ALTER TABLE `sms_template` ALTER COLUMN `updated_at` DROP DEFAULT;

ALTER TABLE `voice_monthly_usage` ALTER COLUMN `updated_at` DROP DEFAULT;

ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_paym_idx` ON `subcontractor_payment_record`(`tenant_id`, `subcontractor_id`, `payment_date`);
DROP INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_pay_idx` ON `subcontractor_payment_record`;

-- ============================================================================
-- DATA MIGRATION: Seed system-default overhead categories for every tenant
-- ============================================================================

-- For each existing tenant, insert 7 overhead categories if they don't already exist.
-- Uses UUID() for id generation (MariaDB built-in).

INSERT INTO financial_category (id, tenant_id, name, type, classification, description, is_active, is_system_default, created_by_user_id, created_at, updated_at)
SELECT UUID(), t.id, cat.name, cat.type, 'operating_expense', NULL, 1, 1, NULL, NOW(), NOW()
FROM tenant t
CROSS JOIN (
  SELECT 'Insurance' AS name, 'insurance' AS type
  UNION ALL SELECT 'Fuel & Vehicle', 'fuel'
  UNION ALL SELECT 'Utilities', 'utilities'
  UNION ALL SELECT 'Office & Admin', 'office'
  UNION ALL SELECT 'Marketing & Advertising', 'marketing'
  UNION ALL SELECT 'Taxes & Licenses', 'taxes'
  UNION ALL SELECT 'Tools & Equipment Purchase', 'tools'
) AS cat
WHERE NOT EXISTS (
  SELECT 1 FROM financial_category fc
  WHERE fc.tenant_id = t.id
    AND fc.is_system_default = 1
    AND fc.type = cat.type
);

-- Update existing system-default COGS categories to explicitly set classification
-- (The @default already sets this, but be explicit for clarity)
UPDATE financial_category
SET classification = 'cost_of_goods_sold'
WHERE is_system_default = 1
  AND type IN ('labor', 'material', 'subcontractor', 'equipment', 'other');
