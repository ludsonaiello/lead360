-- CreateTable: tenant_email_config
-- Purpose: Per-tenant email provider configuration
-- Migration: 20260118000003_create_tenant_email_config

CREATE TABLE tenant_email_config (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) UNIQUE NOT NULL,
  provider_id VARCHAR(36) NOT NULL,
  credentials JSON NOT NULL COMMENT 'Encrypted provider credentials',
  provider_config JSON COMMENT 'Provider-specific configuration',
  from_email VARCHAR(255) NOT NULL,
  from_name VARCHAR(100) NOT NULL,
  reply_to_email VARCHAR(255),
  webhook_secret VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_tenant_email_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_email_provider
    FOREIGN KEY (provider_id) REFERENCES communication_provider(id),

  INDEX idx_tenant_provider (tenant_id, provider_id),
  INDEX idx_tenant_active (tenant_id, is_active),
  INDEX idx_provider_id (provider_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
