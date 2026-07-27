-- Multi-Provider Support Migration
-- Allows tenants to configure multiple email providers and switch between them

-- Step 1: Remove UNIQUE constraint on tenant_id
-- This allows multiple provider configs per tenant
ALTER TABLE `tenant_email_config` DROP INDEX `tenant_id`;

-- Step 2: Add composite UNIQUE constraint (tenant_id + provider_id)
-- Prevents duplicate provider configurations for the same tenant
ALTER TABLE `tenant_email_config`
ADD UNIQUE INDEX `tenant_email_config_tenant_id_provider_id_key` (`tenant_id`, `provider_id`);

-- Note: We intentionally do NOT add a database-level constraint for "only one active provider per tenant"
-- This is enforced by application logic in the deactivateAllProviders() method.
-- Reason: MySQL partial indexes (WHERE clause) require MySQL 8.0.13+ and can be problematic.
-- The service layer ensures atomicity by deactivating all providers before activating a new one.
