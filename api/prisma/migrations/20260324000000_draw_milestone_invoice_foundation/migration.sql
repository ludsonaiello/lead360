-- Sprint F-08: Draw Milestone + Project Invoice + Invoice Payment Foundation
-- Creates 3 new tables for the Draw Schedule → Invoice Automation feature.
-- This migration is additive only — no existing tables, columns, or enums are modified.
--
-- NOTE: Circular FK between project_draw_milestone.invoice_id → project_invoice
--       and project_invoice.milestone_id → project_draw_milestone.
--       Resolution: Create project_draw_milestone first WITHOUT the invoice_id FK,
--       then create project_invoice with its milestone_id FK,
--       then ALTER TABLE to add the deferred invoice_id FK.

-- ============================================================================
-- TABLE 1: project_draw_milestone (without invoice_id FK — added later)
-- ============================================================================

CREATE TABLE `project_draw_milestone` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `project_id` VARCHAR(36) NOT NULL,
  `quote_draw_entry_id` VARCHAR(36) NULL,
  `draw_number` INTEGER NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `calculation_type` ENUM('percentage', 'fixed_amount') NOT NULL,
  `value` DECIMAL(10, 2) NOT NULL,
  `calculated_amount` DECIMAL(12, 2) NOT NULL,
  `status` ENUM('pending', 'invoiced', 'paid') NOT NULL DEFAULT 'pending',
  `invoice_id` VARCHAR(36) NULL,
  `invoiced_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `notes` TEXT NULL,
  `created_by_user_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `project_draw_milestone_project_id_draw_number_key` (`project_id`, `draw_number`),
  INDEX `project_draw_milestone_tenant_id_project_id_idx` (`tenant_id`, `project_id`),
  INDEX `project_draw_milestone_tenant_id_project_id_status_idx` (`tenant_id`, `project_id`, `status`),
  INDEX `project_draw_milestone_tenant_id_status_idx` (`tenant_id`, `status`),

  CONSTRAINT `project_draw_milestone_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_draw_milestone_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_draw_milestone_quote_draw_entry_id_fkey` FOREIGN KEY (`quote_draw_entry_id`) REFERENCES `draw_schedule_entry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `project_draw_milestone_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE 2: project_invoice (with milestone_id FK to project_draw_milestone)
-- ============================================================================

CREATE TABLE `project_invoice` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `project_id` VARCHAR(36) NOT NULL,
  `invoice_number` VARCHAR(50) NOT NULL,
  `milestone_id` VARCHAR(36) NULL,
  `description` VARCHAR(500) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `tax_amount` DECIMAL(10, 2) NULL,
  `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `amount_due` DECIMAL(12, 2) NOT NULL,
  `status` ENUM('draft', 'sent', 'partial', 'paid', 'voided') NOT NULL DEFAULT 'draft',
  `due_date` DATE NULL,
  `sent_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `voided_at` DATETIME(3) NULL,
  `voided_reason` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `created_by_user_id` VARCHAR(36) NOT NULL,
  `updated_by_user_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`),
  UNIQUE INDEX `project_invoice_tenant_id_invoice_number_key` (`tenant_id`, `invoice_number`),
  INDEX `project_invoice_tenant_id_project_id_idx` (`tenant_id`, `project_id`),
  INDEX `project_invoice_tenant_id_project_id_status_idx` (`tenant_id`, `project_id`, `status`),
  INDEX `project_invoice_tenant_id_status_idx` (`tenant_id`, `status`),
  INDEX `project_invoice_tenant_id_created_at_idx` (`tenant_id`, `created_at`),

  CONSTRAINT `project_invoice_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_milestone_id_fkey` FOREIGN KEY (`milestone_id`) REFERENCES `project_draw_milestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- DEFERRED FK: project_draw_milestone.invoice_id → project_invoice.id
-- (Could not be added during CREATE TABLE due to circular dependency)
-- ============================================================================

ALTER TABLE `project_draw_milestone`
  ADD CONSTRAINT `project_draw_milestone_invoice_id_fkey`
  FOREIGN KEY (`invoice_id`) REFERENCES `project_invoice`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- TABLE 3: project_invoice_payment
-- ============================================================================

CREATE TABLE `project_invoice_payment` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `invoice_id` VARCHAR(36) NOT NULL,
  `project_id` VARCHAR(36) NOT NULL,
  `amount` DECIMAL(12, 2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
  `payment_method_registry_id` VARCHAR(36) NULL,
  `reference_number` VARCHAR(200) NULL,
  `notes` TEXT NULL,
  `created_by_user_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`),
  INDEX `project_invoice_payment_tenant_id_invoice_id_idx` (`tenant_id`, `invoice_id`),
  INDEX `project_invoice_payment_tenant_id_project_id_idx` (`tenant_id`, `project_id`),
  INDEX `project_invoice_payment_tenant_id_payment_date_idx` (`tenant_id`, `payment_date`),

  CONSTRAINT `project_invoice_payment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_payment_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `project_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_payment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `project_invoice_payment_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
