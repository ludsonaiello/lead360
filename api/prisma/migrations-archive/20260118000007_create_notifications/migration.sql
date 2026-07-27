-- CreateTable: notification & notification_rule
-- Purpose: In-app notifications system with auto-notification rules
-- Migration: 20260118000007_create_notifications

-- Notification table (in-app notifications)
CREATE TABLE notification (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) COMMENT 'NULL = broadcast to all users in tenant',
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500),
  related_entity_type VARCHAR(50),
  related_entity_id VARCHAR(36),
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_notification_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,
  CONSTRAINT fk_notification_user
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,

  INDEX idx_tenant_user_read_created (tenant_id, user_id, is_read, created_at DESC),
  INDEX idx_tenant_read_created (tenant_id, is_read, created_at DESC),
  INDEX idx_user_read_created (user_id, is_read, created_at DESC),
  INDEX idx_expires_at (expires_at),
  INDEX idx_tenant_type (tenant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notification rule table (auto-trigger rules)
CREATE TABLE notification_rule (
  id VARCHAR(36) PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  notify_in_app BOOLEAN NOT NULL DEFAULT true,
  notify_email BOOLEAN NOT NULL DEFAULT false,
  email_template_key VARCHAR(100),
  recipient_type ENUM('owner', 'assigned_user', 'specific_users', 'all_users') NOT NULL DEFAULT 'owner',
  specific_user_ids JSON COMMENT 'Array of user IDs when recipient_type = specific_users',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_notif_rule_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenant(id) ON DELETE CASCADE,

  INDEX idx_tenant_event_active (tenant_id, event_type, is_active),
  INDEX idx_tenant_active (tenant_id, is_active),
  INDEX idx_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
