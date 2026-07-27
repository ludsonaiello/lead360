-- Sprint 4: Remove tenant_id from user table
-- User is now a global identity table; tenant context via user_tenant_membership

-- Drop the foreign key constraint first
ALTER TABLE `user` DROP FOREIGN KEY `user_tenant_id_fkey`;

-- Drop the composite index on (tenant_id, is_active)
DROP INDEX `user_tenant_id_is_active_idx` ON `user`;

-- Drop the tenant_id column
ALTER TABLE `user` DROP COLUMN `tenant_id`;

-- Add standalone index on is_active
CREATE INDEX `user_is_active_idx` ON `user`(`is_active`);
