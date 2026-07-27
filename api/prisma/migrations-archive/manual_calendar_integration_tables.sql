-- Sprint 01B: Calendar Integration Tables
-- Created: 2026-03-02
-- Purpose: Add Google Calendar integration tables for OAuth, sync logging, and external time blocks

-- Table 1: calendar_provider_connection
-- Stores OAuth credentials and sync status for Google Calendar integration
CREATE TABLE IF NOT EXISTS `calendar_provider_connection` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `provider_type` varchar(30) NOT NULL,
  `access_token` text NOT NULL,
  `refresh_token` text NOT NULL,
  `token_expires_at` datetime(3) NOT NULL,
  `connected_calendar_id` varchar(255) NOT NULL,
  `connected_calendar_name` varchar(255) DEFAULT NULL,
  `webhook_channel_id` varchar(255) DEFAULT NULL,
  `webhook_resource_id` varchar(255) DEFAULT NULL,
  `webhook_channel_token` varchar(255) DEFAULT NULL,
  `webhook_expiration` datetime(3) DEFAULT NULL,
  `sync_status` varchar(20) NOT NULL DEFAULT 'active',
  `last_sync_at` datetime(3) DEFAULT NULL,
  `last_sync_token` text DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  `connected_by_user_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `calendar_provider_connection_tenant_id_key` (`tenant_id`),
  UNIQUE KEY `calendar_provider_connection_tenant_id_provider_type_key` (`tenant_id`,`provider_type`),
  KEY `calendar_provider_connection_tenant_id_is_active_idx` (`tenant_id`,`is_active`),
  KEY `calendar_provider_connection_sync_status_idx` (`sync_status`),
  KEY `calendar_provider_connection_webhook_expiration_idx` (`webhook_expiration`),
  KEY `calendar_provider_connection_connected_by_user_id_fkey` (`connected_by_user_id`),
  CONSTRAINT `calendar_provider_connection_connected_by_user_id_fkey` FOREIGN KEY (`connected_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `calendar_provider_connection_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 2: calendar_sync_log
-- Audit trail for all sync operations between Lead360 and Google Calendar
CREATE TABLE IF NOT EXISTS `calendar_sync_log` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `connection_id` varchar(36) NOT NULL,
  `direction` varchar(10) NOT NULL,
  `action` varchar(20) NOT NULL,
  `appointment_id` varchar(36) DEFAULT NULL,
  `external_event_id` varchar(255) DEFAULT NULL,
  `status` varchar(10) NOT NULL,
  `error_message` text DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  PRIMARY KEY (`id`),
  KEY `calendar_sync_log_tenant_id_created_at_idx` (`tenant_id`,`created_at` DESC),
  KEY `calendar_sync_log_tenant_id_status_idx` (`tenant_id`,`status`),
  KEY `calendar_sync_log_connection_id_idx` (`connection_id`),
  KEY `calendar_sync_log_appointment_id_idx` (`appointment_id`),
  CONSTRAINT `calendar_sync_log_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointment` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `calendar_sync_log_connection_id_fkey` FOREIGN KEY (`connection_id`) REFERENCES `calendar_provider_connection` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `calendar_sync_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table 3: calendar_external_block
-- Stores time blocks from external Google Calendar events (no personal data)
CREATE TABLE IF NOT EXISTS `calendar_external_block` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `connection_id` varchar(36) NOT NULL,
  `external_event_id` varchar(255) NOT NULL,
  `start_datetime_utc` datetime(3) NOT NULL,
  `end_datetime_utc` datetime(3) NOT NULL,
  `is_all_day` tinyint(1) NOT NULL DEFAULT 0,
  `source` varchar(30) NOT NULL,
  `created_at` datetime(3) NOT NULL DEFAULT current_timestamp(3),
  `updated_at` datetime(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `calendar_external_block_tenant_id_external_event_id_key` (`tenant_id`,`external_event_id`),
  KEY `calendar_external_block_tenant_id_start_datetime_utc_end_dat_idx` (`tenant_id`,`start_datetime_utc`,`end_datetime_utc`),
  KEY `calendar_external_block_connection_id_idx` (`connection_id`),
  CONSTRAINT `calendar_external_block_connection_id_fkey` FOREIGN KEY (`connection_id`) REFERENCES `calendar_provider_connection` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `calendar_external_block_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
