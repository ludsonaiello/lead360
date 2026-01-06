-- Migration for RBAC Dynamic Permissions System
-- Handles partial migration state (role table already has is_active, created_by_user_id, deleted_at)

-- AlterTable `role` - Drop foreign key and tenant-specific indexes (if they exist)
ALTER TABLE `role`
    DROP FOREIGN KEY IF EXISTS `role_tenant_id_fkey`;

-- Drop indexes one at a time (some may not exist)
SET @s = (SELECT IF(
    (SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_NAME = 'role'
        AND INDEX_NAME = 'role_tenant_id_name_key'
        AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE `role` DROP INDEX `role_tenant_id_name_key`',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_NAME = 'role'
        AND INDEX_NAME = 'role_tenant_id_idx'
        AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE `role` DROP INDEX `role_tenant_id_idx`',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clean up duplicate roles before making name globally unique
-- Keep only roles that are actually assigned to users, or keep one of each name
DELETE r1 FROM `role` r1
LEFT JOIN `user_role` ur ON r1.id = ur.role_id
WHERE ur.id IS NULL  -- Not assigned to any user
AND r1.id NOT IN (
    SELECT * FROM (
        SELECT MIN(id) FROM `role` GROUP BY name
    ) AS temp
);

-- AlterTable `role` - Drop tenant_id column and make name globally unique
ALTER TABLE `role`
    DROP COLUMN IF EXISTS `tenant_id`,
    ADD UNIQUE INDEX IF NOT EXISTS `role_name_key`(`name`);

-- AlterTable `user_role` - Add new fields for multi-tenant support
ALTER TABLE `user_role`
    ADD COLUMN IF NOT EXISTS `tenant_id` VARCHAR(36) NULL, -- NULL temporarily to allow data migration
    ADD COLUMN IF NOT EXISTS `assigned_by_user_id` VARCHAR(36) NULL,
    ADD COLUMN IF NOT EXISTS `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3);

-- Migrate existing user_role data: populate tenant_id from user table
UPDATE `user_role` ur
INNER JOIN `user` u ON ur.user_id = u.id
SET ur.tenant_id = u.tenant_id
WHERE ur.tenant_id IS NULL AND u.tenant_id IS NOT NULL;

-- Now make tenant_id NOT NULL after data is migrated
ALTER TABLE `user_role`
    MODIFY COLUMN `tenant_id` VARCHAR(36) NOT NULL;

-- Drop old unique constraint if it exists
SET @s = (SELECT IF(
    (SELECT COUNT(*)
        FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_NAME = 'user_role'
        AND INDEX_NAME = 'user_role_unique'
        AND TABLE_SCHEMA = DATABASE()) > 0,
    'ALTER TABLE `user_role` DROP INDEX `user_role_unique`',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateTable `module`
CREATE TABLE IF NOT EXISTS `module` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `icon` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `module_name_key`(`name`),
    INDEX `module_is_active_idx`(`is_active`),
    INDEX `module_name_idx`(`name`),
    INDEX `module_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable `permission`
CREATE TABLE IF NOT EXISTS `permission` (
    `id` VARCHAR(36) NOT NULL,
    `module_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `permission_module_id_idx`(`module_id`),
    INDEX `permission_is_active_idx`(`is_active`),
    UNIQUE INDEX `module_action_unique`(`module_id`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable `role_permission`
CREATE TABLE IF NOT EXISTS `role_permission` (
    `id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `granted_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    INDEX `role_permission_role_id_idx`(`role_id`),
    INDEX `role_permission_permission_id_idx`(`permission_id`),
    UNIQUE INDEX `role_permission_unique`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable `role_template`
CREATE TABLE IF NOT EXISTS `role_template` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_system_template` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_template_name_key`(`name`),
    INDEX `role_template_is_system_template_idx`(`is_system_template`),
    INDEX `role_template_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable `role_template_permission`
CREATE TABLE IF NOT EXISTS `role_template_permission` (
    `id` VARCHAR(36) NOT NULL,
    `role_template_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_template_permission_role_template_id_idx`(`role_template_id`),
    INDEX `role_template_permission_permission_id_idx`(`permission_id`),
    UNIQUE INDEX `role_template_permission_unique`(`role_template_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey (MariaDB doesn't support IF NOT EXISTS for foreign keys - use conditional logic)
SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'user_role'
     AND CONSTRAINT_NAME = 'user_role_tenant_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `user_role` ADD CONSTRAINT `user_role_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'user_role'
     AND CONSTRAINT_NAME = 'user_role_assigned_by_user_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `user_role` ADD CONSTRAINT `user_role_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'permission'
     AND CONSTRAINT_NAME = 'permission_module_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `permission` ADD CONSTRAINT `permission_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'role_permission'
     AND CONSTRAINT_NAME = 'role_permission_role_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'role_permission'
     AND CONSTRAINT_NAME = 'role_permission_permission_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'role_template_permission'
     AND CONSTRAINT_NAME = 'role_template_permission_role_template_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `role_template_permission` ADD CONSTRAINT `role_template_permission_role_template_id_fkey` FOREIGN KEY (`role_template_id`) REFERENCES `role_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @s = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_NAME = 'role_template_permission'
     AND CONSTRAINT_NAME = 'role_template_permission_permission_id_fkey'
     AND TABLE_SCHEMA = DATABASE()) = 0,
    'ALTER TABLE `role_template_permission` ADD CONSTRAINT `role_template_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1'
));
PREPARE stmt FROM @s;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- CreateIndex (new unique index for user_role with tenant_id)
CREATE UNIQUE INDEX IF NOT EXISTS `user_role_tenant_unique` ON `user_role`(`user_id`, `role_id`, `tenant_id`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `user_role_user_id_tenant_id_idx` ON `user_role`(`user_id`, `tenant_id`);

-- CreateIndex
CREATE INDEX IF NOT EXISTS `user_role_tenant_id_idx` ON `user_role`(`tenant_id`);

-- CreateIndex (for role table - done at end after all alterations)
CREATE INDEX IF NOT EXISTS `role_name_idx` ON `role`(`name`);
CREATE INDEX IF NOT EXISTS `role_is_system_idx` ON `role`(`is_system`);
CREATE INDEX IF NOT EXISTS `role_is_active_idx` ON `role`(`is_active`);
