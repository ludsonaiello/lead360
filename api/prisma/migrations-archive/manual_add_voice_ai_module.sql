-- Manual Migration: Add Voice AI Module
-- Date: 2026-02-17
-- Description: Creates all tables for the Voice AI module (providers, credentials,
--              global config, tenant settings, transfer numbers, call logs, usage records)
--              and extends subscription_plan with voice AI billing fields.

-- ============================================================
-- Step 1: Create voice_ai_provider
-- ============================================================
CREATE TABLE IF NOT EXISTS `voice_ai_provider` (
  `id`                VARCHAR(36)  NOT NULL,
  `provider_key`      VARCHAR(50)  NOT NULL,
  `provider_type`     VARCHAR(10)  NOT NULL,
  `display_name`      VARCHAR(100) NOT NULL,
  `description`       TEXT         NULL,
  `logo_url`          VARCHAR(500) NULL,
  `documentation_url` VARCHAR(500) NULL,
  `capabilities`      TEXT         NULL,
  `config_schema`     LONGTEXT     NULL,
  `default_config`    TEXT         NULL,
  `pricing_info`      TEXT         NULL,
  `is_active`         BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voice_ai_provider_provider_key_key` (`provider_key`),
  INDEX `voice_ai_provider_provider_type_idx` (`provider_type`),
  INDEX `voice_ai_provider_is_active_idx` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 2: Create voice_ai_credentials
-- ============================================================
CREATE TABLE IF NOT EXISTS `voice_ai_credentials` (
  `id`                VARCHAR(36)  NOT NULL,
  `provider_id`       VARCHAR(36)  NOT NULL,
  `encrypted_api_key` LONGTEXT     NOT NULL,
  `masked_api_key`    VARCHAR(20)  NOT NULL,
  `created_at`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`        DATETIME(3)  NOT NULL,
  `updated_by`        VARCHAR(36)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voice_ai_credentials_provider_id_key` (`provider_id`),
  CONSTRAINT `voice_ai_credentials_provider_id_fkey`
    FOREIGN KEY (`provider_id`) REFERENCES `voice_ai_provider` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 3: Create voice_ai_global_config (singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS `voice_ai_global_config` (
  `id`                                VARCHAR(36)  NOT NULL,
  `default_stt_provider_id`           VARCHAR(36)  NULL,
  `default_llm_provider_id`           VARCHAR(36)  NULL,
  `default_tts_provider_id`           VARCHAR(36)  NULL,
  `default_stt_config`                TEXT         NULL,
  `default_llm_config`                TEXT         NULL,
  `default_tts_config`                TEXT         NULL,
  `default_voice_id`                  VARCHAR(100) NULL,
  `default_language`                  VARCHAR(10)  NOT NULL DEFAULT 'en',
  `default_languages`                 TEXT         NOT NULL DEFAULT '["en"]',
  `default_greeting_template`         TEXT         NOT NULL DEFAULT 'Hello, thank you for calling {business_name}! How can I help you today?',
  `default_system_prompt`             TEXT         NOT NULL DEFAULT 'You are a helpful phone assistant. Be concise, friendly, and professional.',
  `default_max_call_duration_seconds` INT          NOT NULL DEFAULT 600,
  `default_transfer_behavior`         VARCHAR(20)  NOT NULL DEFAULT 'end_call',
  `default_tools_enabled`             TEXT         NOT NULL DEFAULT '{"booking":true,"lead_creation":true,"call_transfer":true}',
  `livekit_sip_trunk_url`             VARCHAR(255) NULL,
  `livekit_api_key`                   TEXT         NULL,
  `livekit_api_secret`                TEXT         NULL,
  `agent_api_key_hash`                VARCHAR(128) NULL,
  `agent_api_key_preview`             VARCHAR(10)  NULL,
  `max_concurrent_calls`              INT          NOT NULL DEFAULT 100,
  `updated_at`                        DATETIME(3)  NOT NULL,
  `updated_by`                        VARCHAR(36)  NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `voice_ai_global_config_stt_provider_fkey`
    FOREIGN KEY (`default_stt_provider_id`) REFERENCES `voice_ai_provider` (`id`),
  CONSTRAINT `voice_ai_global_config_llm_provider_fkey`
    FOREIGN KEY (`default_llm_provider_id`) REFERENCES `voice_ai_provider` (`id`),
  CONSTRAINT `voice_ai_global_config_tts_provider_fkey`
    FOREIGN KEY (`default_tts_provider_id`) REFERENCES `voice_ai_provider` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 4: Create tenant_voice_ai_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS `tenant_voice_ai_settings` (
  `id`                        VARCHAR(36)  NOT NULL,
  `tenant_id`                 VARCHAR(36)  NOT NULL,
  `is_enabled`                BOOLEAN      NOT NULL DEFAULT FALSE,
  `default_language`          VARCHAR(10)  NOT NULL DEFAULT 'en',
  `enabled_languages`         TEXT         NOT NULL DEFAULT '["en"]',
  `custom_greeting`           TEXT         NULL,
  `custom_instructions`       TEXT         NULL,
  `after_hours_behavior`      VARCHAR(20)  NULL,
  `booking_enabled`           BOOLEAN      NULL,
  `lead_creation_enabled`     BOOLEAN      NULL,
  `transfer_enabled`          BOOLEAN      NULL,
  `default_transfer_number`   VARCHAR(20)  NULL,
  `max_call_duration_seconds` INT          NULL,
  `monthly_minutes_override`  INT          NULL,
  `admin_notes`               TEXT         NULL,
  `stt_provider_override_id`  VARCHAR(36)  NULL,
  `llm_provider_override_id`  VARCHAR(36)  NULL,
  `tts_provider_override_id`  VARCHAR(36)  NULL,
  `stt_config_override`       TEXT         NULL,
  `llm_config_override`       TEXT         NULL,
  `tts_config_override`       TEXT         NULL,
  `voice_id_override`         VARCHAR(100) NULL,
  `created_at`                DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`                DATETIME(3)  NOT NULL,
  `updated_by`                VARCHAR(36)  NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenant_voice_ai_settings_tenant_id_key` (`tenant_id`),
  INDEX `tenant_voice_ai_settings_tenant_id_idx` (`tenant_id`),
  CONSTRAINT `tenant_voice_ai_settings_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 5: Create tenant_voice_transfer_number
-- ============================================================
CREATE TABLE IF NOT EXISTS `tenant_voice_transfer_number` (
  `id`              VARCHAR(36)  NOT NULL,
  `tenant_id`       VARCHAR(36)  NOT NULL,
  `label`           VARCHAR(100) NOT NULL,
  `phone_number`    VARCHAR(20)  NOT NULL,
  `transfer_type`   VARCHAR(20)  NOT NULL DEFAULT 'primary',
  `description`     VARCHAR(255) NULL,
  `is_default`      BOOLEAN      NOT NULL DEFAULT FALSE,
  `display_order`   INT          NOT NULL DEFAULT 0,
  `available_hours` TEXT         NULL,
  `created_at`      DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`      DATETIME(3)  NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `tenant_voice_transfer_number_tenant_id_idx` (`tenant_id`),
  INDEX `tenant_voice_transfer_number_tenant_id_is_default_idx` (`tenant_id`, `is_default`),
  INDEX `tenant_voice_transfer_number_tenant_id_display_order_idx` (`tenant_id`, `display_order`),
  CONSTRAINT `tenant_voice_transfer_number_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 6: Create voice_call_log
-- ============================================================
CREATE TABLE IF NOT EXISTS `voice_call_log` (
  `id`                 VARCHAR(36)  NOT NULL,
  `tenant_id`          VARCHAR(36)  NOT NULL,
  `call_sid`           VARCHAR(100) NOT NULL,
  `from_number`        VARCHAR(20)  NOT NULL,
  `to_number`          VARCHAR(20)  NOT NULL,
  `direction`          VARCHAR(10)  NOT NULL DEFAULT 'inbound',
  `status`             VARCHAR(20)  NOT NULL DEFAULT 'in_progress',
  `outcome`            VARCHAR(50)  NULL,
  `is_overage`         BOOLEAN      NOT NULL DEFAULT FALSE,
  `duration_seconds`   INT          NULL,
  `transcript_summary` TEXT         NULL,
  `full_transcript`    LONGTEXT     NULL,
  `actions_taken`      TEXT         NULL,
  `lead_id`            VARCHAR(36)  NULL,
  `stt_provider_id`    VARCHAR(36)  NULL,
  `llm_provider_id`    VARCHAR(36)  NULL,
  `tts_provider_id`    VARCHAR(36)  NULL,
  `started_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ended_at`           DATETIME(3)  NULL,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `voice_call_log_call_sid_key` (`call_sid`),
  INDEX `voice_call_log_tenant_id_idx` (`tenant_id`),
  INDEX `voice_call_log_tenant_id_started_at_idx` (`tenant_id`, `started_at`),
  INDEX `voice_call_log_call_sid_idx` (`call_sid`),
  INDEX `voice_call_log_tenant_id_outcome_idx` (`tenant_id`, `outcome`),
  CONSTRAINT `voice_call_log_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 7: Create voice_usage_record
-- ============================================================
CREATE TABLE IF NOT EXISTS `voice_usage_record` (
  `id`             VARCHAR(36)    NOT NULL,
  `tenant_id`      VARCHAR(36)    NOT NULL,
  `call_log_id`    VARCHAR(36)    NOT NULL,
  `provider_id`    VARCHAR(36)    NOT NULL,
  `provider_type`  VARCHAR(10)    NOT NULL,
  `usage_quantity` DECIMAL(12, 4) NOT NULL,
  `usage_unit`     VARCHAR(20)    NOT NULL,
  `estimated_cost` DECIMAL(12, 6) NULL,
  `year`           INT            NOT NULL,
  `month`          INT            NOT NULL,
  `billed_at`      DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at`     DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `voice_usage_record_tenant_id_idx` (`tenant_id`),
  INDEX `voice_usage_record_tenant_id_year_month_idx` (`tenant_id`, `year`, `month`),
  INDEX `voice_usage_record_call_log_id_idx` (`call_log_id`),
  INDEX `voice_usage_record_provider_id_idx` (`provider_id`),
  CONSTRAINT `voice_usage_record_tenant_id_fkey`
    FOREIGN KEY (`tenant_id`) REFERENCES `tenant` (`id`),
  CONSTRAINT `voice_usage_record_call_log_id_fkey`
    FOREIGN KEY (`call_log_id`) REFERENCES `voice_call_log` (`id`),
  CONSTRAINT `voice_usage_record_provider_id_fkey`
    FOREIGN KEY (`provider_id`) REFERENCES `voice_ai_provider` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Step 8: Extend subscription_plan with Voice AI fields
-- ============================================================
ALTER TABLE `subscription_plan`
  ADD COLUMN IF NOT EXISTS `voice_ai_enabled`          BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS `voice_ai_minutes_included`  INT            NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `voice_ai_overage_rate`      DECIMAL(10, 4) NULL;

-- Migration complete
-- Tables created: voice_ai_provider, voice_ai_credentials, voice_ai_global_config,
--                 tenant_voice_ai_settings, tenant_voice_transfer_number,
--                 voice_call_log, voice_usage_record
-- Table modified: subscription_plan (3 new voice AI columns)
