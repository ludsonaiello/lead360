-- STEP 1: Create tenant_industry junction table
CREATE TABLE `tenant_industry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `industry_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tenant_industry_tenant_id_industry_id_key`(`tenant_id`, `industry_id`),
    INDEX `tenant_industry_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_industry_industry_id_idx`(`industry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- STEP 2: Migrate existing tenant.industry_id data to junction table
INSERT INTO `tenant_industry` (`id`, `tenant_id`, `industry_id`, `created_at`)
SELECT
    UUID() as id,
    t.id as tenant_id,
    t.industry_id as industry_id,
    NOW() as created_at
FROM `tenant` t
WHERE t.industry_id IS NOT NULL;

-- STEP 3: Add foreign key constraints to junction table
ALTER TABLE `tenant_industry`
    ADD CONSTRAINT `tenant_industry_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tenant_industry`
    ADD CONSTRAINT `tenant_industry_industry_id_fkey`
    FOREIGN KEY (`industry_id`) REFERENCES `industry`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 4: Drop foreign key constraint from tenant table
ALTER TABLE `tenant` DROP FOREIGN KEY `tenant_industry_id_fkey`;

-- STEP 5: Drop index on tenant.industry_id
DROP INDEX `tenant_industry_id_idx` ON `tenant`;

-- STEP 6: Drop industry_id column from tenant table
ALTER TABLE `tenant` DROP COLUMN `industry_id`;
