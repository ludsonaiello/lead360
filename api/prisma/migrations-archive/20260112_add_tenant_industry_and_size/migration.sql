-- CreateTable
CREATE TABLE `industry` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `industry_name_key`(`name`),
    INDEX `industry_is_active_idx`(`is_active`),
    INDEX `industry_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `tenant`
    ADD COLUMN `industry_id` VARCHAR(36) NULL,
    ADD COLUMN `business_size` VARCHAR(20) NULL,
    ADD INDEX `tenant_industry_id_idx`(`industry_id`);

-- AddForeignKey
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_industry_id_fkey`
    FOREIGN KEY (`industry_id`) REFERENCES `industry`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert seed data
INSERT INTO `industry` (`id`, `name`, `description`, `is_active`, `created_at`, `updated_at`) VALUES
    (UUID(), 'Roofing', 'Residential and commercial roofing services', true, NOW(), NOW()),
    (UUID(), 'HVAC', 'Heating, ventilation, and air conditioning services', true, NOW(), NOW()),
    (UUID(), 'Plumbing', 'Plumbing installation and repair services', true, NOW(), NOW()),
    (UUID(), 'Electrical', 'Electrical installation and repair services', true, NOW(), NOW()),
    (UUID(), 'General Contracting', 'General construction and contracting services', true, NOW(), NOW()),
    (UUID(), 'Landscaping', 'Landscaping and lawn care services', true, NOW(), NOW()),
    (UUID(), 'Painting', 'Interior and exterior painting services', true, NOW(), NOW()),
    (UUID(), 'Flooring', 'Flooring installation and refinishing', true, NOW(), NOW()),
    (UUID(), 'Windows & Doors', 'Window and door installation and repair', true, NOW(), NOW()),
    (UUID(), 'Concrete & Masonry', 'Concrete, brick, and stone work', true, NOW(), NOW()),
    (UUID(), 'Pest Control', 'Pest control and extermination services', true, NOW(), NOW()),
    (UUID(), 'Cleaning Services', 'Residential and commercial cleaning', true, NOW(), NOW()),
    (UUID(), 'Other', 'Other service business types', true, NOW(), NOW());
