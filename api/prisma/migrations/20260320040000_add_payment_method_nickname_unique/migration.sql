-- CreateIndex
CREATE UNIQUE INDEX `payment_method_registry_tenant_id_nickname_key` ON `payment_method_registry`(`tenant_id`, `nickname`);
