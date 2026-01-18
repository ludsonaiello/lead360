-- CreateTable: communication_provider
-- Purpose: Provider registry with JSON Schema validation
-- Migration: 20260118000001_create_communication_provider

CREATE TABLE communication_provider (
  id VARCHAR(36) PRIMARY KEY,
  provider_key VARCHAR(50) UNIQUE NOT NULL,
  provider_name VARCHAR(100) NOT NULL,
  provider_type ENUM('email', 'sms', 'call', 'whatsapp') NOT NULL,
  credentials_schema JSON NOT NULL COMMENT 'JSON Schema for credentials validation',
  config_schema JSON COMMENT 'JSON Schema for configuration validation',
  default_config JSON COMMENT 'Default configuration values',
  supports_webhooks BOOLEAN NOT NULL DEFAULT false,
  webhook_events JSON COMMENT 'Array of supported webhook events',
  webhook_verification_method VARCHAR(50) COMMENT 'signature, token, ip_whitelist',
  documentation_url VARCHAR(500),
  logo_url VARCHAR(500),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_provider_type_active (provider_type, is_active),
  INDEX idx_provider_key (provider_key),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
