-- AlterTable: Add tenant_id to quote_jobsite_address
-- This migration adds tenant isolation to the quote_jobsite_address table

-- Step 1: Add tenant_id column (nullable initially)
ALTER TABLE `quote_jobsite_address` ADD COLUMN `tenant_id` VARCHAR(36) NULL;

-- Step 2: Populate tenant_id from existing quotes
-- Find tenant_id from quotes that reference each jobsite address
UPDATE `quote_jobsite_address` qja
INNER JOIN `quote` q ON q.jobsite_address_id = qja.id
SET qja.tenant_id = q.tenant_id
WHERE qja.tenant_id IS NULL;

-- Step 3: Make tenant_id NOT NULL
ALTER TABLE `quote_jobsite_address` MODIFY COLUMN `tenant_id` VARCHAR(36) NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE `quote_jobsite_address`
  ADD CONSTRAINT `quote_jobsite_address_tenant_id_fkey`
  FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Drop old index and create new composite index
ALTER TABLE `quote_jobsite_address` DROP INDEX `quote_jobsite_address_latitude_longitude_idx`;
ALTER TABLE `quote_jobsite_address` ADD INDEX `quote_jobsite_address_tenant_id_latitude_longitude_idx` (`tenant_id`, `latitude`, `longitude`);
