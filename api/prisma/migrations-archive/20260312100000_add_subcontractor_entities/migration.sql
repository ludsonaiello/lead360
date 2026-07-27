-- Sprint 03: Subcontractor + Contacts + Documents Schema
-- Three new tables: subcontractor, subcontractor_contact, subcontractor_document
-- Two new enums: subcontractor_compliance_status, subcontractor_document_type

-- ============================================================================
-- CreateTable: subcontractor
-- ============================================================================
CREATE TABLE `subcontractor` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `business_name` VARCHAR(200) NOT NULL,
    `trade_specialty` VARCHAR(200) NULL,
    `email` VARCHAR(255) NULL,
    `website` VARCHAR(500) NULL,
    `insurance_provider` VARCHAR(200) NULL,
    `insurance_policy_number` VARCHAR(100) NULL,
    `insurance_expiry_date` DATE NULL,
    `coi_on_file` BOOLEAN NOT NULL DEFAULT false,
    `compliance_status` ENUM('valid', 'expiring_soon', 'expired', 'unknown') NOT NULL DEFAULT 'unknown',
    `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle') NULL,
    `bank_name` VARCHAR(200) NULL,
    `bank_routing_encrypted` TEXT NULL,
    `bank_account_encrypted` TEXT NULL,
    `venmo_handle` VARCHAR(100) NULL,
    `zelle_contact` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subcontractor_tenant_id_compliance_status_idx`(`tenant_id`, `compliance_status`),
    INDEX `subcontractor_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `subcontractor_tenant_id_insurance_expiry_date_idx`(`tenant_id`, `insurance_expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- CreateTable: subcontractor_contact
-- ============================================================================
CREATE TABLE `subcontractor_contact` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `contact_name` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `role` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subcontractor_contact_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- CreateTable: subcontractor_document
-- ============================================================================
CREATE TABLE `subcontractor_document` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `document_type` ENUM('insurance', 'agreement', 'coi', 'contract', 'license', 'other') NOT NULL,
    `description` VARCHAR(500) NULL,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subcontractor_document_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================================================
-- AddForeignKey: subcontractor
-- ============================================================================
ALTER TABLE `subcontractor` ADD CONSTRAINT `subcontractor_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontractor` ADD CONSTRAINT `subcontractor_created_by_user_id_fkey`
    FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- AddForeignKey: subcontractor_contact
-- ============================================================================
ALTER TABLE `subcontractor_contact` ADD CONSTRAINT `subcontractor_contact_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontractor_contact` ADD CONSTRAINT `subcontractor_contact_subcontractor_id_fkey`
    FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- AddForeignKey: subcontractor_document
-- ============================================================================
ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_subcontractor_id_fkey`
    FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_file_id_fkey`
    FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_uploaded_by_user_id_fkey`
    FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
