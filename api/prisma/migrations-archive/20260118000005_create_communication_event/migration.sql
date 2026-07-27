-- CreateTable: communication_event
-- Purpose: Track all communication events (email, SMS, WhatsApp) with webhook status
-- Migration: 20260118000005_create_communication_event

CREATE TABLE communication_event (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36),
  channel ENUM('email', 'sms', 'whatsapp') NOT NULL,
  direction ENUM('outbound', 'inbound') NOT NULL DEFAULT 'outbound',
  provider_id VARCHAR(36) NOT NULL,
  status ENUM('pending', 'sent', 'delivered', 'failed', 'bounced') NOT NULL DEFAULT 'pending',

  -- Contact details
  to_email VARCHAR(255),
  to_phone VARCHAR(20),
  cc_emails JSON,
  bcc_emails JSON,
  from_email VARCHAR(255),
  from_name VARCHAR(100),

  -- Content
  subject VARCHAR(500),
  html_body LONGTEXT,
  text_body LONGTEXT,

  -- Template tracking
  template_key VARCHAR(100),
  template_variables JSON,

  -- Attachments
  attachments JSON COMMENT 'Array of {file_id, filename, size, mime_type}',

  -- Provider response (CRITICAL for webhook matching)
  provider_message_id VARCHAR(255) UNIQUE COMMENT 'Provider message ID for webhook matching',
  provider_metadata JSON,

  -- Webhook data
  webhook_signature VARCHAR(255),
  error_message TEXT,
  sent_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  opened_at TIMESTAMP NULL,
  clicked_at TIMESTAMP NULL,
  bounced_at TIMESTAMP NULL,
  bounce_type VARCHAR(50),

  -- Entity association
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(36),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id VARCHAR(36),

  CONSTRAINT fk_comm_event_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  CONSTRAINT fk_comm_event_provider
    FOREIGN KEY (provider_id) REFERENCES communication_provider(id),
  CONSTRAINT fk_comm_event_user
    FOREIGN KEY (created_by_user_id) REFERENCES user(id) ON DELETE SET NULL,

  INDEX idx_provider_message_id (provider_message_id),
  INDEX idx_tenant_created (tenant_id, created_at DESC),
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_channel (tenant_id, channel),
  INDEX idx_tenant_channel_created (tenant_id, channel, created_at DESC),
  INDEX idx_related_entity (related_entity_type, related_entity_id),
  INDEX idx_to_email (to_email),
  INDEX idx_to_phone (to_phone),
  INDEX idx_provider_status (provider_id, status),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
