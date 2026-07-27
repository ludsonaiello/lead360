-- CreateTable: webhook_event
-- Purpose: Log all incoming webhooks for debugging and audit
-- Migration: 20260118000006_create_webhook_event

CREATE TABLE webhook_event (
  id VARCHAR(36) PRIMARY KEY,
  provider_id VARCHAR(36) NOT NULL,
  communication_event_id VARCHAR(36),
  event_type VARCHAR(50) NOT NULL,
  provider_message_id VARCHAR(255),
  payload JSON NOT NULL COMMENT 'Full webhook payload for debugging',
  signature VARCHAR(500),
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  ip_address VARCHAR(45),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP NULL,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_webhook_provider
    FOREIGN KEY (provider_id) REFERENCES communication_provider(id),
  CONSTRAINT fk_webhook_comm_event
    FOREIGN KEY (communication_event_id) REFERENCES communication_event(id) ON DELETE SET NULL,

  INDEX idx_provider_created (provider_id, created_at DESC),
  INDEX idx_provider_message (provider_message_id),
  INDEX idx_processed_created (processed, created_at),
  INDEX idx_comm_event_id (communication_event_id),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
