-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `actor_user_id` VARCHAR(36) NULL,
    `actor_type` ENUM('user', 'system', 'platform_admin', 'cron_job') NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(36) NOT NULL,
    `description` TEXT NOT NULL,
    `action_type` VARCHAR(50) NOT NULL,
    `before_json` LONGTEXT NULL,
    `after_json` LONGTEXT NULL,
    `metadata_json` LONGTEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `status` ENUM('success', 'failure') NOT NULL DEFAULT 'success',
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_action_idx`(`action_type`),
    INDEX `audit_log_actor_type_idx`(`actor_type`),
    INDEX `audit_log_actor_user_id_idx`(`actor_user_id`),
    INDEX `audit_log_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_log_status_idx`(`status`),
    INDEX `audit_log_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `audit_log_tenant_status_created_idx`(`tenant_id`, `status`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `original_size_bytes` INTEGER NULL,
    `category` VARCHAR(50) NOT NULL,
    `storage_path` VARCHAR(500) NOT NULL,
    `storage_provider` VARCHAR(20) NOT NULL DEFAULT 'local',
    `s3_bucket` VARCHAR(100) NULL,
    `s3_key` VARCHAR(500) NULL,
    `s3_region` VARCHAR(50) NULL,
    `uploaded_by` VARCHAR(36) NOT NULL,
    `entity_type` VARCHAR(50) NULL,
    `entity_id` VARCHAR(36) NULL,
    `is_orphan` BOOLEAN NOT NULL DEFAULT false,
    `orphaned_at` DATETIME(3) NULL,
    `is_trashed` BOOLEAN NOT NULL DEFAULT false,
    `trashed_at` DATETIME(3) NULL,
    `has_thumbnail` BOOLEAN NOT NULL DEFAULT false,
    `thumbnail_path` VARCHAR(500) NULL,
    `thumbnail_s3_key` VARCHAR(500) NULL,
    `is_optimized` BOOLEAN NOT NULL DEFAULT false,
    `optimization_quality` TINYINT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `page_count` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `file_file_id_key`(`file_id`),
    INDEX `file_file_id_idx`(`file_id`),
    INDEX `file_tenant_id_category_idx`(`tenant_id`, `category`),
    INDEX `file_tenant_id_is_orphan_idx`(`tenant_id`, `is_orphan`),
    INDEX `file_tenant_id_is_trashed_idx`(`tenant_id`, `is_trashed`),
    INDEX `file_storage_provider_idx`(`storage_provider`),
    INDEX `file_has_thumbnail_idx`(`has_thumbnail`),
    INDEX `file_is_optimized_idx`(`is_optimized`),
    INDEX `file_uploaded_by_fkey`(`uploaded_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `license_type` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `license_type_name_key`(`name`),
    INDEX `license_type_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `industry` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `industry_name_key`(`name`),
    INDEX `industry_is_active_idx`(`is_active`),
    INDEX `industry_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_industry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `industry_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_industry_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_industry_industry_id_idx`(`industry_id`),
    UNIQUE INDEX `tenant_industry_tenant_id_industry_id_key`(`tenant_id`, `industry_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `module` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `icon` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `module_name_key`(`name`),
    INDEX `module_is_active_idx`(`is_active`),
    INDEX `module_name_idx`(`name`),
    INDEX `module_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permission` (
    `id` VARCHAR(36) NOT NULL,
    `module_id` VARCHAR(36) NOT NULL,
    `action` VARCHAR(50) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `permission_is_active_idx`(`is_active`),
    INDEX `permission_module_id_idx`(`module_id`),
    UNIQUE INDEX `module_action_unique`(`module_id`, `action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `device_name` VARCHAR(255) NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(500) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `revoked_at` DATETIME(3) NULL,

    INDEX `refresh_token_token_hash_idx`(`token_hash`),
    INDEX `refresh_token_user_id_expires_at_idx`(`user_id`, `expires_at`),
    INDEX `refresh_token_user_id_revoked_at_idx`(`user_id`, `revoked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `role_name_key`(`name`),
    INDEX `is_system`(`is_system`),
    INDEX `name`(`name`),
    INDEX `role_is_active_idx`(`is_active`),
    INDEX `role_is_system_idx`(`is_system`),
    INDEX `role_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permission` (
    `id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    `granted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `granted_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permission_permission_id_idx`(`permission_id`),
    INDEX `role_permission_role_id_idx`(`role_id`),
    UNIQUE INDEX `role_permission_unique`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_template` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_system_template` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `role_template_name_key`(`name`),
    INDEX `role_template_is_active_idx`(`is_active`),
    INDEX `role_template_is_system_template_idx`(`is_system_template`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_template_permission` (
    `id` VARCHAR(36) NOT NULL,
    `role_template_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_template_permission_permission_id_idx`(`permission_id`),
    INDEX `role_template_permission_role_template_id_idx`(`role_template_id`),
    UNIQUE INDEX `role_template_permission_unique`(`role_template_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `service_name_key`(`name`),
    UNIQUE INDEX `service_slug_key`(`slug`),
    INDEX `service_is_active_idx`(`is_active`),
    INDEX `service_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subscription_plan` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `monthly_price` DECIMAL(10, 2) NOT NULL,
    `annual_price` DECIMAL(10, 2) NOT NULL,
    `max_users` INTEGER NOT NULL,
    `max_storage_gb` DECIMAL(10, 2) NULL,
    `offers_trial` BOOLEAN NOT NULL DEFAULT false,
    `trial_days` INTEGER NULL,
    `feature_flags` LONGTEXT NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `voice_ai_enabled` BOOLEAN NOT NULL DEFAULT false,
    `voice_ai_minutes_included` INTEGER NOT NULL DEFAULT 0,
    `voice_ai_overage_rate` DECIMAL(10, 4) NULL,
    `voice_ai_max_agent_profiles` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `subscription_plan_name_key`(`name`),
    INDEX `subscription_plan_is_active_idx`(`is_active`),
    INDEX `subscription_plan_is_default_idx`(`is_default`),
    INDEX `subscription_plan_offers_trial_idx`(`offers_trial`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant` (
    `id` VARCHAR(36) NOT NULL,
    `subdomain` VARCHAR(63) NOT NULL,
    `company_name` VARCHAR(200) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `legal_business_name` VARCHAR(200) NOT NULL,
    `dba_name` VARCHAR(200) NULL,
    `business_entity_type` VARCHAR(50) NOT NULL,
    `state_of_registration` VARCHAR(2) NOT NULL,
    `date_of_incorporation` DATETIME(3) NULL,
    `ein` VARCHAR(10) NOT NULL,
    `state_tax_id` VARCHAR(50) NULL,
    `sales_tax_permit` VARCHAR(50) NULL,
    `primary_contact_phone` VARCHAR(20) NOT NULL,
    `secondary_phone` VARCHAR(20) NULL,
    `primary_contact_email` VARCHAR(255) NOT NULL,
    `support_email` VARCHAR(255) NULL,
    `billing_email` VARCHAR(255) NULL,
    `website_url` VARCHAR(255) NULL,
    `instagram_url` VARCHAR(255) NULL,
    `facebook_url` VARCHAR(255) NULL,
    `tiktok_url` VARCHAR(255) NULL,
    `youtube_url` VARCHAR(255) NULL,
    `bank_name` VARCHAR(100) NULL,
    `routing_number` VARCHAR(9) NULL,
    `account_number` VARCHAR(50) NULL,
    `account_type` VARCHAR(20) NULL,
    `venmo_username` VARCHAR(50) NULL,
    `venmo_qr_code_file_id` VARCHAR(36) NULL,
    `logo_file_id` VARCHAR(36) NULL,
    `primary_brand_color` VARCHAR(7) NULL,
    `secondary_brand_color` VARCHAR(7) NULL,
    `accent_color` VARCHAR(7) NULL,
    `invoice_prefix` VARCHAR(10) NOT NULL DEFAULT 'INV',
    `next_invoice_number` INTEGER NOT NULL DEFAULT 1,
    `quote_prefix` VARCHAR(10) NOT NULL DEFAULT 'Q-',
    `next_quote_number` INTEGER NOT NULL DEFAULT 1,
    `next_project_number` INTEGER NOT NULL DEFAULT 1,
    `default_quote_validity_days` INTEGER NOT NULL DEFAULT 30,
    `default_quote_terms` TEXT NULL,
    `default_quote_footer` TEXT NULL,
    `default_invoice_footer` TEXT NULL,
    `default_payment_instructions` TEXT NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    `default_language` VARCHAR(10) NULL,
    `business_description` TEXT NULL,
    `subscription_plan_id` VARCHAR(36) NULL,
    `subscription_status` VARCHAR(20) NOT NULL DEFAULT 'trial',
    `trial_end_date` DATETIME(3) NULL,
    `billing_cycle` VARCHAR(20) NULL,
    `next_billing_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `default_contingency_rate` DECIMAL(5, 2) NULL,
    `default_overhead_rate` DECIMAL(5, 2) NULL,
    `default_profit_margin` DECIMAL(5, 2) NULL,
    `sales_tax_rate` DECIMAL(5, 3) NULL,
    `approval_thresholds` JSON NULL,
    `profitability_thresholds` JSON NULL,
    `business_size` VARCHAR(20) NULL,
    `active_quote_template_id` VARCHAR(36) NULL,
    `show_line_items_by_default` BOOLEAN NOT NULL DEFAULT true,
    `show_cost_breakdown_by_default` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `tenant_subdomain_key`(`subdomain`),
    UNIQUE INDEX `tenant_ein_key`(`ein`),
    INDEX `tenant_ein_idx`(`ein`),
    INDEX `tenant_is_active_idx`(`is_active`),
    INDEX `tenant_logo_file_id_fkey`(`logo_file_id`),
    INDEX `tenant_subdomain_idx`(`subdomain`),
    INDEX `tenant_subscription_plan_id_idx`(`subscription_plan_id`),
    INDEX `tenant_subscription_status_idx`(`subscription_status`),
    INDEX `tenant_trial_end_date_idx`(`trial_end_date`),
    INDEX `tenant_venmo_qr_code_file_id_fkey`(`venmo_qr_code_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_address` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `address_type` VARCHAR(20) NOT NULL,
    `line1` VARCHAR(255) NOT NULL,
    `line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `country` VARCHAR(3) NOT NULL DEFAULT 'USA',
    `lat` DECIMAL(10, 8) NULL,
    `long` DECIMAL(11, 8) NULL,
    `is_po_box` BOOLEAN NOT NULL DEFAULT false,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_address_tenant_id_address_type_idx`(`tenant_id`, `address_type`),
    INDEX `tenant_address_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_business_hours` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `monday_closed` BOOLEAN NOT NULL DEFAULT false,
    `monday_open1` VARCHAR(5) NULL,
    `monday_close1` VARCHAR(5) NULL,
    `monday_open2` VARCHAR(5) NULL,
    `monday_close2` VARCHAR(5) NULL,
    `tuesday_closed` BOOLEAN NOT NULL DEFAULT false,
    `tuesday_open1` VARCHAR(5) NULL,
    `tuesday_close1` VARCHAR(5) NULL,
    `tuesday_open2` VARCHAR(5) NULL,
    `tuesday_close2` VARCHAR(5) NULL,
    `wednesday_closed` BOOLEAN NOT NULL DEFAULT false,
    `wednesday_open1` VARCHAR(5) NULL,
    `wednesday_close1` VARCHAR(5) NULL,
    `wednesday_open2` VARCHAR(5) NULL,
    `wednesday_close2` VARCHAR(5) NULL,
    `thursday_closed` BOOLEAN NOT NULL DEFAULT false,
    `thursday_open1` VARCHAR(5) NULL,
    `thursday_close1` VARCHAR(5) NULL,
    `thursday_open2` VARCHAR(5) NULL,
    `thursday_close2` VARCHAR(5) NULL,
    `friday_closed` BOOLEAN NOT NULL DEFAULT false,
    `friday_open1` VARCHAR(5) NULL,
    `friday_close1` VARCHAR(5) NULL,
    `friday_open2` VARCHAR(5) NULL,
    `friday_close2` VARCHAR(5) NULL,
    `saturday_closed` BOOLEAN NOT NULL DEFAULT true,
    `saturday_open1` VARCHAR(5) NULL,
    `saturday_close1` VARCHAR(5) NULL,
    `saturday_open2` VARCHAR(5) NULL,
    `saturday_close2` VARCHAR(5) NULL,
    `sunday_closed` BOOLEAN NOT NULL DEFAULT true,
    `sunday_open1` VARCHAR(5) NULL,
    `sunday_close1` VARCHAR(5) NULL,
    `sunday_open2` VARCHAR(5) NULL,
    `sunday_close2` VARCHAR(5) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_business_hours_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_custom_hours` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `date` DATE NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `closed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `close_time1` VARCHAR(5) NULL,
    `close_time2` VARCHAR(5) NULL,
    `open_time1` VARCHAR(5) NULL,
    `open_time2` VARCHAR(5) NULL,

    INDEX `tenant_custom_hours_tenant_id_date_idx`(`tenant_id`, `date`),
    UNIQUE INDEX `tenant_custom_hours_tenant_id_date_key`(`tenant_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_insurance` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `gl_insurance_provider` VARCHAR(100) NULL,
    `gl_policy_number` VARCHAR(100) NULL,
    `gl_coverage_amount` DECIMAL(12, 2) NULL,
    `gl_effective_date` DATETIME(3) NULL,
    `gl_expiry_date` DATETIME(3) NULL,
    `gl_document_file_id` VARCHAR(36) NULL,
    `wc_insurance_provider` VARCHAR(100) NULL,
    `wc_policy_number` VARCHAR(100) NULL,
    `wc_coverage_amount` DECIMAL(12, 2) NULL,
    `wc_effective_date` DATETIME(3) NULL,
    `wc_expiry_date` DATETIME(3) NULL,
    `wc_document_file_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_insurance_tenant_id_key`(`tenant_id`),
    INDEX `tenant_insurance_gl_document_file_id_fkey`(`gl_document_file_id`),
    INDEX `tenant_insurance_gl_expiry_date_idx`(`gl_expiry_date`),
    INDEX `tenant_insurance_wc_document_file_id_fkey`(`wc_document_file_id`),
    INDEX `tenant_insurance_wc_expiry_date_idx`(`wc_expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_license` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `license_type_id` VARCHAR(36) NULL,
    `custom_license_type` VARCHAR(100) NULL,
    `license_number` VARCHAR(100) NOT NULL,
    `issuing_state` VARCHAR(2) NOT NULL,
    `issue_date` DATETIME(3) NULL,
    `expiry_date` DATETIME(3) NOT NULL,
    `document_file_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_license_document_file_id_fkey`(`document_file_id`),
    INDEX `tenant_license_expiry_date_idx`(`expiry_date`),
    INDEX `tenant_license_license_type_id_fkey`(`license_type_id`),
    INDEX `tenant_license_tenant_id_expiry_date_idx`(`tenant_id`, `expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_payment_terms` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `terms_json` LONGTEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tenant_payment_terms_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_service` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `service_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tenant_service_service_id_idx`(`service_id`),
    INDEX `tenant_service_tenant_id_idx`(`tenant_id`),
    UNIQUE INDEX `tenant_service_tenant_id_service_id_key`(`tenant_id`, `service_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_service_area` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `value` VARCHAR(100) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `radius_miles` DECIMAL(5, 2) NULL,
    `state` VARCHAR(2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `city_name` VARCHAR(100) NULL,
    `entire_state` BOOLEAN NOT NULL DEFAULT false,
    `zipcode` VARCHAR(10) NULL,

    INDEX `tenant_service_area_latitude_longitude_idx`(`latitude`, `longitude`),
    INDEX `tenant_service_area_tenant_id_type_idx`(`tenant_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_platform_admin` BOOLEAN NOT NULL DEFAULT false,
    `email_verified` BOOLEAN NOT NULL DEFAULT false,
    `email_verified_at` DATETIME(3) NULL,
    `activation_token` VARCHAR(255) NULL,
    `activation_token_expires` DATETIME(3) NULL,
    `password_reset_token` VARCHAR(255) NULL,
    `password_reset_expires` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `mfa_enabled` BOOLEAN NOT NULL DEFAULT false,
    `mfa_secret` VARCHAR(255) NULL,
    `oauth_provider` VARCHAR(50) NULL,
    `oauth_provider_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    INDEX `user_activation_token_idx`(`activation_token`),
    INDEX `user_email_idx`(`email`),
    INDEX `user_oauth_provider_oauth_provider_id_idx`(`oauth_provider`, `oauth_provider_id`),
    INDEX `user_password_reset_token_idx`(`password_reset_token`),
    INDEX `user_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_role` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tenant_id` VARCHAR(36) NOT NULL,
    `assigned_by_user_id` VARCHAR(36) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_role_assigned_by_user_id_fkey`(`assigned_by_user_id`),
    INDEX `user_role_role_id_idx`(`role_id`),
    INDEX `user_role_tenant_id_idx`(`tenant_id`),
    INDEX `user_role_user_id_idx`(`user_id`),
    INDEX `user_role_user_id_tenant_id_idx`(`user_id`, `tenant_id`),
    UNIQUE INDEX `user_role_tenant_unique`(`user_id`, `role_id`, `tenant_id`),
    UNIQUE INDEX `user_role_user_id_role_id_key`(`user_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_tenant_membership` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    `status` ENUM('INVITED', 'ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'INVITED',
    `invite_token_hash` VARCHAR(255) NULL,
    `invite_token_expires_at` DATETIME(3) NULL,
    `invite_accepted_at` DATETIME(3) NULL,
    `invited_by_user_id` VARCHAR(36) NULL,
    `joined_at` DATETIME(3) NULL,
    `left_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_tenant_membership_invite_token_hash_key`(`invite_token_hash`),
    INDEX `user_tenant_membership_user_id_status_idx`(`user_id`, `status`),
    INDEX `user_tenant_membership_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `user_tenant_membership_tenant_id_role_id_idx`(`tenant_id`, `role_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_signature` (
    `id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `signature_file_id` VARCHAR(36) NOT NULL,
    `signature_name` VARCHAR(100) NOT NULL,
    `signature_title` VARCHAR(100) NULL,
    `signature_phone` VARCHAR(20) NULL,
    `signature_email` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `user_signature_user_id_key`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `file_share_link` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `share_token` VARCHAR(64) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `expires_at` DATETIME(3) NULL,
    `max_downloads` INTEGER NULL,
    `download_count` INTEGER NOT NULL DEFAULT 0,
    `view_count` INTEGER NOT NULL DEFAULT 0,
    `created_by` VARCHAR(36) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_accessed_at` DATETIME(3) NULL,

    UNIQUE INDEX `file_share_link_share_token_key`(`share_token`),
    INDEX `file_share_link_tenant_id_idx`(`tenant_id`),
    INDEX `file_share_link_file_id_idx`(`file_id`),
    INDEX `file_share_link_created_by_idx`(`created_by`),
    INDEX `file_share_link_expires_at_idx`(`expires_at`),
    INDEX `file_share_link_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `storage_config` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `storage_provider` VARCHAR(20) NOT NULL DEFAULT 'local',
    `s3_endpoint` VARCHAR(255) NULL,
    `s3_region` VARCHAR(50) NULL,
    `s3_bucket` VARCHAR(100) NULL,
    `s3_access_key_id` VARCHAR(255) NULL,
    `s3_secret_key` VARCHAR(500) NULL,
    `s3_use_ssl` BOOLEAN NOT NULL DEFAULT true,
    `s3_force_path_style` BOOLEAN NOT NULL DEFAULT false,
    `enable_webp_conversion` BOOLEAN NOT NULL DEFAULT true,
    `webp_quality` TINYINT NOT NULL DEFAULT 85,
    `enable_thumbnails` BOOLEAN NOT NULL DEFAULT true,
    `thumbnail_width` INTEGER NOT NULL DEFAULT 200,
    `thumbnail_height` INTEGER NOT NULL DEFAULT 200,
    `strip_exif` BOOLEAN NOT NULL DEFAULT true,
    `enable_pdf_thumbnails` BOOLEAN NOT NULL DEFAULT true,
    `pdf_thumbnail_quality` TINYINT NOT NULL DEFAULT 80,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `storage_config_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flag` (
    `id` VARCHAR(36) NOT NULL,
    `flag_key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    UNIQUE INDEX `feature_flag_flag_key_key`(`flag_key`),
    INDEX `feature_flag_flag_key_idx`(`flag_key`),
    INDEX `feature_flag_is_enabled_idx`(`is_enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `maintenance_mode` (
    `id` VARCHAR(36) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    `mode` VARCHAR(20) NOT NULL DEFAULT 'immediate',
    `start_time` DATETIME(3) NULL,
    `end_time` DATETIME(3) NULL,
    `message` TEXT NULL,
    `allowed_ips` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notification` (
    `id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `link` TEXT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,

    INDEX `admin_notification_is_read_created_at_idx`(`is_read`, `created_at` DESC),
    INDEX `admin_notification_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `impersonation_session` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `impersonated_user_id` VARCHAR(36) NOT NULL,
    `impersonated_tenant_id` VARCHAR(36) NOT NULL,
    `session_token` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `impersonation_session_session_token_key`(`session_token`),
    INDEX `impersonation_session_admin_user_id_idx`(`admin_user_id`),
    INDEX `impersonation_session_session_token_idx`(`session_token`),
    INDEX `impersonation_session_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_setting` (
    `id` VARCHAR(36) NOT NULL,
    `setting_key` VARCHAR(100) NOT NULL,
    `setting_value` TEXT NOT NULL,
    `data_type` VARCHAR(20) NOT NULL,
    `description` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,

    UNIQUE INDEX `system_setting_setting_key_key`(`setting_key`),
    INDEX `system_setting_setting_key_idx`(`setting_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_job` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `export_type` VARCHAR(50) NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `filters` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `file_path` TEXT NULL,
    `row_count` INTEGER NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `export_job_admin_user_id_created_at_idx`(`admin_user_id`, `created_at` DESC),
    INDEX `export_job_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_report` (
    `id` VARCHAR(36) NOT NULL,
    `admin_user_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `report_type` VARCHAR(50) NOT NULL,
    `schedule` VARCHAR(20) NOT NULL,
    `parameters` JSON NOT NULL,
    `format` VARCHAR(10) NOT NULL,
    `recipients` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `next_run_at` DATETIME(3) NOT NULL,
    `last_run_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scheduled_report_admin_user_id_idx`(`admin_user_id`),
    INDEX `scheduled_report_is_active_next_run_at_idx`(`is_active`, `next_run_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_sms_config` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `credentials` TEXT NOT NULL,
    `from_phone` VARCHAR(20) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `webhook_secret` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_sms_config_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_sms_config_provider_id_idx`(`provider_id`),
    UNIQUE INDEX `tenant_sms_config_tenant_id_provider_id_key`(`tenant_id`, `provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_whatsapp_config` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `credentials` TEXT NOT NULL,
    `from_phone` VARCHAR(30) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `webhook_secret` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_whatsapp_config_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_whatsapp_config_provider_id_idx`(`provider_id`),
    UNIQUE INDEX `tenant_whatsapp_config_tenant_id_provider_id_key`(`tenant_id`, `provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `lead_id` VARCHAR(36) NULL,
    `twilio_config_id` VARCHAR(36) NULL,
    `twilio_call_sid` VARCHAR(100) NOT NULL,
    `direction` VARCHAR(20) NOT NULL,
    `from_number` VARCHAR(20) NOT NULL,
    `to_number` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `call_type` VARCHAR(30) NOT NULL,
    `handled_by` VARCHAR(20) NOT NULL DEFAULT 'direct',
    `voice_call_log_id` VARCHAR(36) NULL,
    `initiated_by` VARCHAR(36) NULL,
    `call_reason` TEXT NULL,
    `outcome` VARCHAR(50) NULL,
    `duration_seconds` INTEGER NULL,
    `recording_url` VARCHAR(500) NULL,
    `recording_duration_seconds` INTEGER NULL,
    `recording_status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `ivr_action_taken` JSON NULL,
    `consent_message_played` BOOLEAN NOT NULL DEFAULT false,
    `cost` DECIMAL(10, 4) NULL,
    `started_at` DATETIME(3) NULL,
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `call_record_twilio_call_sid_key`(`twilio_call_sid`),
    UNIQUE INDEX `call_record_voice_call_log_id_key`(`voice_call_log_id`),
    INDEX `call_record_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `call_record_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `call_record_tenant_id_lead_id_idx`(`tenant_id`, `lead_id`),
    INDEX `call_record_tenant_id_outcome_idx`(`tenant_id`, `outcome`),
    INDEX `call_record_tenant_id_handled_by_idx`(`tenant_id`, `handled_by`),
    INDEX `call_record_twilio_call_sid_idx`(`twilio_call_sid`),
    INDEX `call_record_from_number_idx`(`from_number`),
    INDEX `call_record_to_number_idx`(`to_number`),
    INDEX `call_record_recording_status_idx`(`recording_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ivr_configuration` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `twilio_config_id` VARCHAR(36) NULL,
    `ivr_enabled` BOOLEAN NOT NULL DEFAULT false,
    `greeting_message` TEXT NOT NULL,
    `menu_options` JSON NOT NULL,
    `default_action` JSON NOT NULL,
    `timeout_seconds` INTEGER NOT NULL DEFAULT 10,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `max_depth` INTEGER NOT NULL DEFAULT 4,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ivr_configuration_tenant_id_key`(`tenant_id`),
    INDEX `ivr_configuration_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `office_number_whitelist` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `office_number_whitelist_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `office_number_whitelist_phone_number_idx`(`phone_number`),
    UNIQUE INDEX `office_number_whitelist_tenant_id_phone_number_key`(`tenant_id`, `phone_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `call_transcription` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `call_record_id` VARCHAR(36) NOT NULL,
    `transcription_provider` VARCHAR(50) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'queued',
    `transcription_text` TEXT NULL,
    `channel_count` TINYINT NULL,
    `speaker_1_transcription` TEXT NULL,
    `speaker_2_transcription` TEXT NULL,
    `speaker_1_label` VARCHAR(50) NULL,
    `speaker_2_label` VARCHAR(50) NULL,
    `language_requested` VARCHAR(10) NULL,
    `language_detected` VARCHAR(10) NULL,
    `confidence_score` DECIMAL(3, 2) NULL,
    `processing_duration_seconds` INTEGER NULL,
    `cost` DECIMAL(10, 4) NULL,
    `error_message` TEXT NULL,
    `is_current` BOOLEAN NOT NULL DEFAULT true,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `previous_transcription_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completed_at` DATETIME(3) NULL,

    INDEX `call_transcription_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `call_transcription_call_record_id_idx`(`call_record_id`),
    INDEX `call_transcription_call_record_id_is_current_idx`(`call_record_id`, `is_current`),
    FULLTEXT INDEX `call_transcription_transcription_text_idx`(`transcription_text`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transcription_provider_configuration` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `provider_name` VARCHAR(50) NOT NULL,
    `is_system_default` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `configuration_json` TEXT NOT NULL,
    `usage_limit` INTEGER NULL,
    `usage_current` INTEGER NOT NULL DEFAULT 0,
    `cost_per_minute` DECIMAL(10, 4) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `transcription_provider_configuration_tenant_id_idx`(`tenant_id`),
    INDEX `transcription_provider_configuration_provider_name_idx`(`provider_name`),
    INDEX `transcription_provider_configuration_is_system_default_statu_idx`(`is_system_default`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_ai_provider` (
    `id` VARCHAR(36) NOT NULL,
    `provider_key` VARCHAR(50) NOT NULL,
    `provider_type` VARCHAR(10) NOT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `logo_url` VARCHAR(500) NULL,
    `documentation_url` VARCHAR(500) NULL,
    `capabilities` TEXT NULL,
    `config_schema` LONGTEXT NULL,
    `default_config` TEXT NULL,
    `pricing_info` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `voice_ai_provider_provider_key_key`(`provider_key`),
    INDEX `voice_ai_provider_provider_type_idx`(`provider_type`),
    INDEX `voice_ai_provider_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_ai_credentials` (
    `id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `encrypted_api_key` LONGTEXT NOT NULL,
    `masked_api_key` VARCHAR(20) NOT NULL,
    `additional_config` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    UNIQUE INDEX `voice_ai_credentials_provider_id_key`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_ai_global_config` (
    `id` VARCHAR(36) NOT NULL DEFAULT 'default',
    `agent_enabled` BOOLEAN NOT NULL DEFAULT false,
    `default_stt_provider_id` VARCHAR(36) NULL,
    `default_llm_provider_id` VARCHAR(36) NULL,
    `default_tts_provider_id` VARCHAR(36) NULL,
    `default_stt_config` TEXT NULL,
    `default_llm_config` TEXT NULL,
    `default_tts_config` TEXT NULL,
    `default_voice_id` VARCHAR(100) NULL,
    `default_language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `default_languages` TEXT NOT NULL DEFAULT '["en"]',
    `default_greeting_template` TEXT NOT NULL DEFAULT 'Hello, thank you for calling {business_name}! How can I help you today?',
    `default_system_prompt` LONGTEXT NOT NULL DEFAULT 'You are a helpful phone assistant. Be concise, friendly, and professional.',
    `default_max_call_duration_seconds` INTEGER NOT NULL DEFAULT 600,
    `default_max_call_seconds` INTEGER NOT NULL DEFAULT 300,
    `default_transfer_behavior` VARCHAR(20) NOT NULL DEFAULT 'end_call',
    `default_tools_enabled` TEXT NOT NULL DEFAULT '{"booking":true,"lead_creation":true,"call_transfer":true}',
    `livekit_url` VARCHAR(255) NULL,
    `livekit_sip_trunk_url` VARCHAR(255) NULL,
    `livekit_api_key_encrypted` LONGTEXT NULL,
    `livekit_api_secret_encrypted` LONGTEXT NULL,
    `livekit_api_key` TEXT NULL,
    `livekit_api_secret` TEXT NULL,
    `agent_api_key_hash` VARCHAR(128) NULL,
    `agent_api_key_preview` VARCHAR(10) NULL,
    `max_concurrent_calls` INTEGER NOT NULL DEFAULT 10,
    `recovery_messages` JSON NULL,
    `filler_phrases` JSON NULL,
    `long_wait_messages` JSON NULL,
    `system_error_messages` JSON NULL,
    `tool_instructions` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_voice_ai_settings` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT false,
    `default_language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `enabled_languages` TEXT NOT NULL DEFAULT '["en"]',
    `custom_greeting` TEXT NULL,
    `custom_instructions` LONGTEXT NULL,
    `after_hours_behavior` VARCHAR(20) NULL,
    `booking_enabled` BOOLEAN NOT NULL DEFAULT true,
    `lead_creation_enabled` BOOLEAN NOT NULL DEFAULT true,
    `transfer_enabled` BOOLEAN NOT NULL DEFAULT true,
    `default_transfer_number` VARCHAR(20) NULL,
    `default_transfer_number_id` VARCHAR(36) NULL,
    `max_call_duration_seconds` INTEGER NULL,
    `monthly_minutes_override` INTEGER NULL,
    `admin_notes` TEXT NULL,
    `stt_provider_override_id` VARCHAR(36) NULL,
    `llm_provider_override_id` VARCHAR(36) NULL,
    `tts_provider_override_id` VARCHAR(36) NULL,
    `stt_config_override` TEXT NULL,
    `llm_config_override` TEXT NULL,
    `tts_config_override` TEXT NULL,
    `voice_id_override` VARCHAR(100) NULL,
    `tool_instructions` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    UNIQUE INDEX `tenant_voice_ai_settings_tenant_id_key`(`tenant_id`),
    INDEX `tenant_voice_ai_settings_tenant_id_idx`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_voice_transfer_number` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `label` VARCHAR(100) NOT NULL,
    `phone_number` VARCHAR(20) NOT NULL,
    `transfer_type` VARCHAR(20) NOT NULL DEFAULT 'primary',
    `description` VARCHAR(255) NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `available_hours` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_voice_transfer_number_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_voice_transfer_number_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_voice_transfer_number_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    INDEX `tenant_voice_transfer_number_tenant_id_display_order_idx`(`tenant_id`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_ai_agent_profile` (
    `id` VARCHAR(36) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `language_name` VARCHAR(100) NOT NULL,
    `voice_id` VARCHAR(200) NOT NULL,
    `voice_provider_type` VARCHAR(20) NOT NULL DEFAULT 'tts',
    `default_greeting` TEXT NULL,
    `default_instructions` LONGTEXT NULL,
    `display_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    UNIQUE INDEX `voice_ai_agent_profile_display_name_key`(`display_name`),
    INDEX `voice_ai_agent_profile_language_code_idx`(`language_code`),
    INDEX `voice_ai_agent_profile_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_voice_agent_profile_override` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `agent_profile_id` VARCHAR(36) NOT NULL,
    `custom_greeting` TEXT NULL,
    `custom_instructions` LONGTEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    INDEX `tenant_voice_agent_profile_override_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_voice_agent_profile_override_tenant_id_agent_profile__idx`(`tenant_id`, `agent_profile_id`),
    INDEX `tenant_voice_agent_profile_override_agent_profile_id_idx`(`agent_profile_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_call_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `call_sid` VARCHAR(100) NOT NULL,
    `parent_call_sid` VARCHAR(100) NULL,
    `room_name` VARCHAR(100) NULL,
    `from_number` VARCHAR(20) NOT NULL,
    `to_number` VARCHAR(20) NOT NULL,
    `direction` VARCHAR(10) NOT NULL DEFAULT 'inbound',
    `language_used` VARCHAR(10) NULL,
    `intent` VARCHAR(50) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    `outcome` VARCHAR(50) NULL,
    `is_overage` BOOLEAN NOT NULL DEFAULT false,
    `duration_seconds` INTEGER NULL,
    `transcript_summary` TEXT NULL,
    `full_transcript` LONGTEXT NULL,
    `actions_taken` TEXT NULL,
    `lead_id` VARCHAR(36) NULL,
    `transferred_to` VARCHAR(20) NULL,
    `stt_provider_id` VARCHAR(36) NULL,
    `llm_provider_id` VARCHAR(36) NULL,
    `tts_provider_id` VARCHAR(36) NULL,
    `error_message` TEXT NULL,
    `recording_url` VARCHAR(500) NULL,
    `recording_duration_seconds` INTEGER NULL,
    `recording_status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `transcription_status` VARCHAR(30) NOT NULL DEFAULT 'pending',
    `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ended_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `voice_call_log_call_sid_key`(`call_sid`),
    INDEX `voice_call_log_tenant_id_idx`(`tenant_id`),
    INDEX `voice_call_log_tenant_id_started_at_idx`(`tenant_id`, `started_at`),
    INDEX `voice_call_log_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `voice_call_log_call_sid_idx`(`call_sid`),
    INDEX `voice_call_log_parent_call_sid_idx`(`parent_call_sid`),
    INDEX `voice_call_log_tenant_id_outcome_idx`(`tenant_id`, `outcome`),
    INDEX `voice_call_log_recording_status_idx`(`recording_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_usage_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `call_log_id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `provider_type` VARCHAR(10) NOT NULL,
    `usage_quantity` DECIMAL(12, 4) NOT NULL,
    `usage_unit` VARCHAR(20) NOT NULL,
    `estimated_cost` DECIMAL(12, 6) NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `billed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `voice_usage_record_tenant_id_idx`(`tenant_id`),
    INDEX `voice_usage_record_tenant_id_year_month_idx`(`tenant_id`, `year`, `month`),
    INDEX `voice_usage_record_call_log_id_idx`(`call_log_id`),
    INDEX `voice_usage_record_provider_id_idx`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `voice_monthly_usage` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL,
    `minutes_used` INTEGER NOT NULL DEFAULT 0,
    `overage_minutes` INTEGER NOT NULL DEFAULT 0,
    `estimated_overage_cost` DECIMAL(10, 4) NULL,
    `total_calls` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `voice_monthly_usage_tenant_id_year_month_key`(`tenant_id`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crew_member` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(20) NULL,
    `address_line1` VARCHAR(200) NULL,
    `address_line2` VARCHAR(100) NULL,
    `address_city` VARCHAR(100) NULL,
    `address_state` VARCHAR(2) NULL,
    `address_zip` VARCHAR(10) NULL,
    `date_of_birth` DATE NULL,
    `ssn_encrypted` TEXT NULL,
    `itin_encrypted` TEXT NULL,
    `has_drivers_license` BOOLEAN NULL,
    `drivers_license_number_encrypted` TEXT NULL,
    `default_hourly_rate` DECIMAL(8, 2) NULL,
    `weekly_hours_schedule` INTEGER NULL,
    `overtime_enabled` BOOLEAN NOT NULL DEFAULT false,
    `overtime_rate_multiplier` DECIMAL(4, 2) NULL,
    `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL,
    `bank_name` VARCHAR(200) NULL,
    `bank_routing_encrypted` TEXT NULL,
    `bank_account_encrypted` TEXT NULL,
    `venmo_handle` VARCHAR(100) NULL,
    `zelle_contact` VARCHAR(100) NULL,
    `profile_photo_file_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `crew_member_user_id_key`(`user_id`),
    INDEX `crew_member_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `crew_member_tenant_id_user_id_idx`(`tenant_id`, `user_id`),
    INDEX `crew_member_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `crew_member_tenant_id_default_hourly_rate_idx`(`tenant_id`, `default_hourly_rate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job` (
    `id` VARCHAR(36) NOT NULL,
    `job_type` VARCHAR(100) NOT NULL,
    `status` VARCHAR(50) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `payload` JSON NULL,
    `result` JSON NULL,
    `error_message` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `started_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `failed_at` DATETIME(3) NULL,
    `duration_ms` INTEGER NULL,

    INDEX `job_tenant_id_status_created_at_idx`(`tenant_id`, `status`, `created_at`),
    INDEX `job_job_type_status_idx`(`job_type`, `status`),
    INDEX `job_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_log` (
    `id` VARCHAR(36) NOT NULL,
    `job_id` VARCHAR(36) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `level` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `metadata` JSON NULL,

    INDEX `job_log_job_id_timestamp_idx`(`job_id`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_job` (
    `id` VARCHAR(36) NOT NULL,
    `job_type` VARCHAR(100) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `schedule` VARCHAR(100) NOT NULL,
    `timezone` VARCHAR(100) NOT NULL DEFAULT 'America/New_York',
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_run_at` DATETIME(3) NULL,
    `next_run_at` DATETIME(3) NULL,
    `max_retries` INTEGER NOT NULL DEFAULT 3,
    `timeout_seconds` INTEGER NOT NULL DEFAULT 300,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `scheduled_job_job_type_key`(`job_type`),
    INDEX `scheduled_job_is_enabled_next_run_at_idx`(`is_enabled`, `next_run_at`),
    INDEX `scheduled_job_job_type_idx`(`job_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_queue` (
    `id` VARCHAR(36) NOT NULL,
    `job_id` VARCHAR(36) NOT NULL,
    `template_key` VARCHAR(100) NULL,
    `to_email` VARCHAR(255) NOT NULL,
    `cc_emails` JSON NULL,
    `bcc_emails` JSON NULL,
    `subject` VARCHAR(500) NOT NULL,
    `html_body` TEXT NOT NULL,
    `text_body` TEXT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'pending',
    `smtp_message_id` VARCHAR(255) NULL,
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `email_queue_job_id_key`(`job_id`),
    INDEX `email_queue_status_created_at_idx`(`status`, `created_at`),
    INDEX `email_queue_job_id_idx`(`job_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `first_name` VARCHAR(100) NOT NULL,
    `last_name` VARCHAR(100) NOT NULL,
    `language_spoken` VARCHAR(10) NOT NULL DEFAULT 'EN',
    `accept_sms` BOOLEAN NOT NULL DEFAULT false,
    `preferred_communication` VARCHAR(20) NOT NULL DEFAULT 'email',
    `status` VARCHAR(20) NOT NULL DEFAULT 'lead',
    `source` VARCHAR(20) NOT NULL,
    `external_source_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_user_id` VARCHAR(36) NULL,
    `lost_reason` TEXT NULL,
    `lost_at` DATETIME(3) NULL,
    `sms_opt_out` BOOLEAN NOT NULL DEFAULT false,
    `sms_opt_out_at` DATETIME(3) NULL,
    `sms_opt_in_at` DATETIME(3) NULL,
    `sms_opt_out_reason` VARCHAR(255) NULL,

    INDEX `lead_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `lead_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `lead_tenant_id_external_source_id_idx`(`tenant_id`, `external_source_id`),
    INDEX `lead_tenant_id_updated_at_idx`(`tenant_id`, `updated_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_email` (
    `id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_email_lead_id_idx`(`lead_id`),
    INDEX `lead_email_lead_id_is_primary_idx`(`lead_id`, `is_primary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_phone` (
    `id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `phone_type` VARCHAR(20) NOT NULL DEFAULT 'mobile',
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_phone_lead_id_idx`(`lead_id`),
    INDEX `lead_phone_lead_id_is_primary_idx`(`lead_id`, `is_primary`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_address` (
    `id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `country` VARCHAR(2) NOT NULL DEFAULT 'US',
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `google_place_id` VARCHAR(255) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `address_type` VARCHAR(20) NOT NULL DEFAULT 'service',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_address_lead_id_idx`(`lead_id`),
    INDEX `lead_address_lead_id_is_primary_idx`(`lead_id`, `is_primary`),
    INDEX `lead_address_lead_id_address_type_idx`(`lead_id`, `address_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_request` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `lead_address_id` VARCHAR(36) NULL,
    `service_name` VARCHAR(100) NOT NULL,
    `service_type` VARCHAR(100) NULL,
    `time_demand` VARCHAR(20) NOT NULL DEFAULT 'flexible',
    `description` TEXT NULL,
    `extra_data` JSON NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'new',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `service_request_tenant_id_lead_id_idx`(`tenant_id`, `lead_id`),
    INDEX `service_request_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `service_request_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_note` (
    `id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `note_text` TEXT NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lead_note_lead_id_created_at_idx`(`lead_id`, `created_at` DESC),
    INDEX `lead_note_lead_id_is_pinned_created_at_idx`(`lead_id`, `is_pinned` DESC, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_activity` (
    `id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `activity_type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_activity_lead_id_created_at_idx`(`lead_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_api_key` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `key_name` VARCHAR(100) NOT NULL,
    `api_key` VARCHAR(64) NOT NULL,
    `api_secret` VARCHAR(128) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `allowed_sources` JSON NULL,
    `rate_limit` INTEGER NOT NULL DEFAULT 100,
    `last_used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_user_id` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `webhook_api_key_api_key_key`(`api_key`),
    INDEX `webhook_api_key_api_key_idx`(`api_key`),
    INDEX `webhook_api_key_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_type` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NULL,
    `slot_duration_minutes` INTEGER NOT NULL DEFAULT 60,
    `max_lookahead_weeks` INTEGER NOT NULL DEFAULT 8,
    `reminder_24h_enabled` BOOLEAN NOT NULL DEFAULT true,
    `reminder_1h_enabled` BOOLEAN NOT NULL DEFAULT true,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_user_id` VARCHAR(36) NULL,

    INDEX `appointment_type_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `appointment_type_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    INDEX `appointment_type_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment_type_schedule` (
    `id` VARCHAR(36) NOT NULL,
    `appointment_type_id` VARCHAR(36) NOT NULL,
    `day_of_week` INTEGER NOT NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT false,
    `window1_start` VARCHAR(5) NULL,
    `window1_end` VARCHAR(5) NULL,
    `window2_start` VARCHAR(5) NULL,
    `window2_end` VARCHAR(5) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `appointment_type_schedule_appointment_type_id_idx`(`appointment_type_id`),
    UNIQUE INDEX `appointment_type_schedule_appointment_type_id_day_of_week_key`(`appointment_type_id`, `day_of_week`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `appointment` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `appointment_type_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `service_request_id` VARCHAR(36) NULL,
    `scheduled_date` VARCHAR(10) NOT NULL,
    `start_time` VARCHAR(5) NOT NULL,
    `end_time` VARCHAR(5) NOT NULL,
    `start_datetime_utc` DATETIME(3) NOT NULL,
    `end_datetime_utc` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    `cancellation_reason` VARCHAR(30) NULL,
    `cancellation_notes` TEXT NULL,
    `notes` TEXT NULL,
    `source` VARCHAR(20) NOT NULL DEFAULT 'manual',
    `external_calendar_event_id` VARCHAR(255) NULL,
    `rescheduled_from_id` VARCHAR(36) NULL,
    `assigned_user_id` VARCHAR(36) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by_user_id` VARCHAR(36) NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancelled_by_user_id` VARCHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,

    INDEX `appointment_tenant_id_scheduled_date_status_idx`(`tenant_id`, `scheduled_date`, `status`),
    INDEX `appointment_tenant_id_status_start_datetime_utc_idx`(`tenant_id`, `status`, `start_datetime_utc`),
    INDEX `appointment_tenant_id_lead_id_status_idx`(`tenant_id`, `lead_id`, `status`),
    INDEX `appointment_tenant_id_appointment_type_id_scheduled_date_idx`(`tenant_id`, `appointment_type_id`, `scheduled_date`),
    INDEX `appointment_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `appointment_external_calendar_event_id_idx`(`external_calendar_event_id`),
    INDEX `appointment_rescheduled_from_id_idx`(`rescheduled_from_id`),
    INDEX `appointment_acknowledged_at_idx`(`acknowledged_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_provider_connection` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `provider_type` VARCHAR(30) NOT NULL,
    `access_token` TEXT NOT NULL,
    `refresh_token` TEXT NOT NULL,
    `token_expires_at` DATETIME(3) NOT NULL,
    `connected_calendar_id` VARCHAR(255) NOT NULL,
    `connected_calendar_name` VARCHAR(255) NULL,
    `webhook_channel_id` VARCHAR(255) NULL,
    `webhook_resource_id` VARCHAR(255) NULL,
    `webhook_channel_token` VARCHAR(255) NULL,
    `webhook_expiration` DATETIME(3) NULL,
    `sync_status` VARCHAR(20) NOT NULL DEFAULT 'active',
    `last_sync_at` DATETIME(3) NULL,
    `last_sync_token` TEXT NULL,
    `error_message` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `connected_by_user_id` VARCHAR(36) NULL,

    UNIQUE INDEX `calendar_provider_connection_tenant_id_key`(`tenant_id`),
    INDEX `calendar_provider_connection_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `calendar_provider_connection_sync_status_idx`(`sync_status`),
    INDEX `calendar_provider_connection_webhook_expiration_idx`(`webhook_expiration`),
    UNIQUE INDEX `calendar_provider_connection_tenant_id_provider_type_key`(`tenant_id`, `provider_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_sync_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `connection_id` VARCHAR(36) NOT NULL,
    `direction` VARCHAR(10) NOT NULL,
    `action` VARCHAR(20) NOT NULL,
    `appointment_id` VARCHAR(36) NULL,
    `external_event_id` VARCHAR(255) NULL,
    `status` VARCHAR(10) NOT NULL,
    `error_message` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `calendar_sync_log_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `calendar_sync_log_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `calendar_sync_log_connection_id_idx`(`connection_id`),
    INDEX `calendar_sync_log_appointment_id_idx`(`appointment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `calendar_external_block` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `connection_id` VARCHAR(36) NOT NULL,
    `external_event_id` VARCHAR(255) NOT NULL,
    `start_datetime_utc` DATETIME(3) NOT NULL,
    `end_datetime_utc` DATETIME(3) NOT NULL,
    `is_all_day` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(30) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `calendar_external_block_tenant_id_start_datetime_utc_end_dat_idx`(`tenant_id`, `start_datetime_utc`, `end_datetime_utc`),
    INDEX `calendar_external_block_connection_id_idx`(`connection_id`),
    UNIQUE INDEX `calendar_external_block_tenant_id_external_event_id_key`(`tenant_id`, `external_event_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `communication_provider` (
    `id` VARCHAR(36) NOT NULL,
    `provider_key` VARCHAR(50) NOT NULL,
    `provider_name` VARCHAR(100) NOT NULL,
    `provider_type` ENUM('email', 'sms', 'call', 'whatsapp') NOT NULL,
    `credentials_schema` JSON NOT NULL,
    `config_schema` JSON NULL,
    `default_config` JSON NULL,
    `supports_webhooks` BOOLEAN NOT NULL DEFAULT false,
    `webhook_events` JSON NULL,
    `webhook_verification_method` VARCHAR(50) NULL,
    `documentation_url` VARCHAR(500) NULL,
    `logo_url` VARCHAR(500) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `communication_provider_provider_key_key`(`provider_key`),
    INDEX `communication_provider_provider_type_is_active_idx`(`provider_type`, `is_active`),
    INDEX `communication_provider_provider_key_idx`(`provider_key`),
    INDEX `communication_provider_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `platform_email_config` (
    `id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `credentials` JSON NOT NULL,
    `provider_config` JSON NULL,
    `from_email` VARCHAR(255) NOT NULL,
    `from_name` VARCHAR(100) NOT NULL,
    `reply_to_email` VARCHAR(255) NULL,
    `webhook_secret` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `platform_email_config_is_active_idx`(`is_active`),
    INDEX `platform_email_config_provider_id_idx`(`provider_id`),
    UNIQUE INDEX `platform_email_config_provider_id_key`(`provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tenant_email_config` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `credentials` JSON NOT NULL,
    `provider_config` JSON NULL,
    `from_email` VARCHAR(255) NOT NULL,
    `from_name` VARCHAR(100) NOT NULL,
    `reply_to_email` VARCHAR(255) NULL,
    `webhook_secret` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `tenant_email_config_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_email_config_provider_id_idx`(`provider_id`),
    UNIQUE INDEX `tenant_email_config_tenant_id_provider_id_key`(`tenant_id`, `provider_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `template_key` VARCHAR(100) NOT NULL,
    `category` ENUM('system', 'transactional', 'marketing', 'notification') NOT NULL DEFAULT 'transactional',
    `template_type` ENUM('platform', 'shared', 'tenant') NOT NULL DEFAULT 'tenant',
    `subject` VARCHAR(500) NOT NULL,
    `html_body` TEXT NOT NULL,
    `text_body` TEXT NULL,
    `variables` JSON NOT NULL,
    `variable_schema` JSON NULL,
    `description` TEXT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `email_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `email_template_tenant_id_category_idx`(`tenant_id`, `category`),
    INDEX `email_template_is_system_idx`(`is_system`),
    INDEX `idx_email_template_type_tenant`(`template_type`, `tenant_id`),
    UNIQUE INDEX `unique_tenant_template_key`(`tenant_id`, `template_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `communication_event` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `channel` ENUM('email', 'sms', 'whatsapp') NOT NULL,
    `direction` ENUM('outbound', 'inbound') NOT NULL DEFAULT 'outbound',
    `provider_id` VARCHAR(36) NOT NULL,
    `status` ENUM('pending', 'scheduled', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'cancelled') NOT NULL DEFAULT 'pending',
    `to_email` VARCHAR(255) NULL,
    `to_phone` VARCHAR(20) NULL,
    `cc_emails` JSON NULL,
    `bcc_emails` JSON NULL,
    `from_email` VARCHAR(255) NULL,
    `from_name` VARCHAR(100) NULL,
    `subject` VARCHAR(500) NULL,
    `html_body` LONGTEXT NULL,
    `text_body` LONGTEXT NULL,
    `template_key` VARCHAR(100) NULL,
    `template_variables` JSON NULL,
    `attachments` JSON NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `provider_metadata` JSON NULL,
    `webhook_signature` VARCHAR(255) NULL,
    `error_message` TEXT NULL,
    `sent_at` DATETIME(3) NULL,
    `delivered_at` DATETIME(3) NULL,
    `opened_at` DATETIME(3) NULL,
    `clicked_at` DATETIME(3) NULL,
    `bounced_at` DATETIME(3) NULL,
    `bounce_type` VARCHAR(50) NULL,
    `related_entity_type` VARCHAR(50) NULL,
    `related_entity_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by_user_id` VARCHAR(36) NULL,
    `scheduled_at` DATETIME(3) NULL,
    `scheduled_by` VARCHAR(36) NULL,

    UNIQUE INDEX `communication_event_provider_message_id_key`(`provider_message_id`),
    INDEX `communication_event_provider_message_id_idx`(`provider_message_id`),
    INDEX `communication_event_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `communication_event_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `communication_event_tenant_id_channel_idx`(`tenant_id`, `channel`),
    INDEX `communication_event_tenant_id_channel_created_at_idx`(`tenant_id`, `channel`, `created_at` DESC),
    INDEX `communication_event_tenant_id_status_scheduled_at_idx`(`tenant_id`, `status`, `scheduled_at`),
    INDEX `communication_event_related_entity_type_related_entity_id_idx`(`related_entity_type`, `related_entity_id`),
    INDEX `communication_event_to_email_idx`(`to_email`),
    INDEX `communication_event_to_phone_idx`(`to_phone`),
    INDEX `communication_event_provider_id_status_idx`(`provider_id`, `status`),
    INDEX `communication_event_created_at_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_event` (
    `id` VARCHAR(36) NOT NULL,
    `provider_id` VARCHAR(36) NOT NULL,
    `communication_event_id` VARCHAR(36) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `provider_message_id` VARCHAR(255) NULL,
    `payload` JSON NOT NULL,
    `signature` VARCHAR(500) NULL,
    `signature_verified` BOOLEAN NOT NULL DEFAULT false,
    `ip_address` VARCHAR(45) NULL,
    `processed` BOOLEAN NOT NULL DEFAULT false,
    `processed_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `retry_count` INTEGER NOT NULL DEFAULT 0,
    `next_retry_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `webhook_event_provider_id_created_at_idx`(`provider_id`, `created_at` DESC),
    INDEX `webhook_event_provider_message_id_idx`(`provider_message_id`),
    INDEX `webhook_event_processed_created_at_idx`(`processed`, `created_at`),
    INDEX `webhook_event_communication_event_id_idx`(`communication_event_id`),
    INDEX `webhook_event_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_config` (
    `id` VARCHAR(36) NOT NULL,
    `base_url` VARCHAR(255) NOT NULL,
    `webhook_secret` TEXT NOT NULL,
    `signature_verification` BOOLEAN NOT NULL DEFAULT true,
    `last_rotated` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `type` VARCHAR(50) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `action_url` VARCHAR(500) NULL,
    `related_entity_type` VARCHAR(50) NULL,
    `related_entity_id` VARCHAR(36) NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_tenant_id_user_id_is_read_created_at_idx`(`tenant_id`, `user_id`, `is_read`, `created_at` DESC),
    INDEX `notification_tenant_id_is_read_created_at_idx`(`tenant_id`, `is_read`, `created_at` DESC),
    INDEX `notification_user_id_is_read_created_at_idx`(`user_id`, `is_read`, `created_at` DESC),
    INDEX `notification_expires_at_idx`(`expires_at`),
    INDEX `notification_tenant_id_type_idx`(`tenant_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification_rule` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `event_type` VARCHAR(100) NOT NULL,
    `notify_in_app` BOOLEAN NOT NULL DEFAULT true,
    `notify_email` BOOLEAN NOT NULL DEFAULT false,
    `email_template_key` VARCHAR(100) NULL,
    `recipient_type` ENUM('owner', 'assigned_user', 'specific_users', 'all_users') NOT NULL DEFAULT 'owner',
    `specific_user_ids` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `notification_rule_tenant_id_event_type_is_active_idx`(`tenant_id`, `event_type`, `is_active`),
    INDEX `notification_rule_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `notification_rule_event_type_idx`(`event_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `twilio_usage_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `category` VARCHAR(50) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,
    `usage_unit` VARCHAR(20) NOT NULL,
    `price` DECIMAL(10, 4) NOT NULL,
    `price_unit` VARCHAR(10) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `synced_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `twilio_usage_record_tenant_id_start_date_idx`(`tenant_id`, `start_date` DESC),
    INDEX `twilio_usage_record_category_start_date_idx`(`category`, `start_date` DESC),
    INDEX `twilio_usage_record_tenant_id_category_start_date_idx`(`tenant_id`, `category`, `start_date` DESC),
    INDEX `twilio_usage_record_synced_at_idx`(`synced_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_health_check` (
    `id` VARCHAR(36) NOT NULL,
    `check_type` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `response_time_ms` INTEGER NULL,
    `error_message` TEXT NULL,
    `details` JSON NULL,
    `checked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_health_check_check_type_checked_at_idx`(`check_type`, `checked_at` DESC),
    INDEX `system_health_check_status_checked_at_idx`(`status`, `checked_at` DESC),
    INDEX `system_health_check_check_type_status_checked_at_idx`(`check_type`, `status`, `checked_at` DESC),
    INDEX `system_health_check_checked_at_idx`(`checked_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_alert` (
    `id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `severity` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `details` JSON NULL,
    `acknowledged` BOOLEAN NOT NULL DEFAULT false,
    `acknowledged_by` VARCHAR(36) NULL,
    `acknowledged_at` DATETIME(3) NULL,
    `comment` TEXT NULL,
    `resolved` BOOLEAN NOT NULL DEFAULT false,
    `resolved_by` VARCHAR(36) NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolution` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_alert_severity_acknowledged_created_at_idx`(`severity`, `acknowledged`, `created_at` DESC),
    INDEX `admin_alert_type_severity_created_at_idx`(`type`, `severity`, `created_at` DESC),
    INDEX `admin_alert_acknowledged_created_at_idx`(`acknowledged`, `created_at` DESC),
    INDEX `admin_alert_created_at_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_measurement` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `abbreviation` VARCHAR(20) NOT NULL,
    `is_global` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `unit_measurement_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `unit_measurement_is_global_is_active_idx`(`is_global`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `template_type` VARCHAR(20) NOT NULL DEFAULT 'code',
    `visual_structure` JSON NULL,
    `html_content` LONGTEXT NULL,
    `css_content` LONGTEXT NULL,
    `category_id` VARCHAR(36) NULL,
    `tags` JSON NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `is_prebuilt` BOOLEAN NOT NULL DEFAULT false,
    `source_template_id` VARCHAR(36) NULL,
    `is_global` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_template_tenant_id_idx`(`tenant_id`),
    INDEX `quote_template_category_id_idx`(`category_id`),
    INDEX `quote_template_is_global_is_active_idx`(`is_global`, `is_active`),
    INDEX `quote_template_is_default_idx`(`is_default`),
    INDEX `quote_template_template_type_idx`(`template_type`),
    INDEX `quote_template_is_prebuilt_idx`(`is_prebuilt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_template_version` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `template_type` VARCHAR(20) NOT NULL,
    `visual_structure` JSON NULL,
    `html_content` LONGTEXT NULL,
    `css_content` LONGTEXT NULL,
    `changes_summary` VARCHAR(500) NULL,
    `render_time_ms` INTEGER NULL,
    `pdf_size_kb` INTEGER NULL,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_template_version_template_id_version_number_idx`(`template_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_category` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon_name` VARCHAR(50) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `template_category_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_component` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `component_type` VARCHAR(50) NOT NULL,
    `structure` JSON NOT NULL,
    `default_props` JSON NULL,
    `html_template` LONGTEXT NOT NULL,
    `css_template` LONGTEXT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `preview_html` LONGTEXT NULL,
    `usage_notes` TEXT NULL,
    `category` VARCHAR(50) NOT NULL,
    `tags` JSON NULL,
    `is_global` BOOLEAN NOT NULL DEFAULT true,
    `tenant_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `template_component_component_type_idx`(`component_type`),
    INDEX `template_component_category_idx`(`category`),
    INDEX `template_component_tenant_id_idx`(`tenant_id`),
    INDEX `template_component_is_global_is_active_idx`(`is_global`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `template_usage_log` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `render_time_ms` INTEGER NULL,
    `pdf_generation_time_ms` INTEGER NULL,
    `pdf_size_kb` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `template_usage_log_template_id_created_at_idx`(`template_id`, `created_at`),
    INDEX `template_usage_log_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `template_usage_log_event_type_created_at_idx`(`event_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vendor` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `google_place_id` VARCHAR(255) NULL,
    `signature_file_id` VARCHAR(36) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `vendor_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `vendor_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    UNIQUE INDEX `vendor_tenant_id_email_key`(`tenant_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_tag` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(7) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_tag_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    UNIQUE INDEX `quote_tag_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_warranty_tier` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `tier_name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `price_type` ENUM('fixed', 'percentage') NOT NULL,
    `price_value` DECIMAL(10, 2) NOT NULL,
    `duration_months` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_warranty_tier_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_jobsite_address` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `google_place_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_jobsite_address_tenant_id_latitude_longitude_idx`(`tenant_id`, `latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `quote_number` VARCHAR(50) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `status` ENUM('draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost', 'email_failed') NOT NULL DEFAULT 'draft',
    `lead_id` VARCHAR(36) NULL,
    `vendor_id` VARCHAR(36) NULL,
    `jobsite_address_id` VARCHAR(36) NOT NULL,
    `po_number` VARCHAR(100) NULL,
    `private_notes` TEXT NULL,
    `use_default_settings` BOOLEAN NOT NULL DEFAULT true,
    `custom_profit_percent` DECIMAL(5, 2) NULL,
    `custom_overhead_percent` DECIMAL(5, 2) NULL,
    `custom_contingency_percent` DECIMAL(5, 2) NULL,
    `custom_tax_rate` DECIMAL(5, 2) NULL,
    `custom_terms` TEXT NULL,
    `custom_payment_instructions` TEXT NULL,
    `expiration_days` INTEGER NULL,
    `expires_at` DATETIME(3) NULL,
    `active_version_number` DECIMAL(4, 2) NOT NULL DEFAULT 1.0,
    `subtotal` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `tax_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `active_template_id` VARCHAR(36) NULL,
    `is_archived` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `latest_pdf_file_id` VARCHAR(36) NULL,
    `parent_quote_id` VARCHAR(36) NULL,
    `pdf_content_hash` VARCHAR(64) NULL,
    `pdf_last_generated_at` DATETIME(3) NULL,
    `pdf_generation_params` JSON NULL,
    `deletion_locked` BOOLEAN NOT NULL DEFAULT false,

    INDEX `quote_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `quote_tenant_id_vendor_id_idx`(`tenant_id`, `vendor_id`),
    INDEX `quote_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    INDEX `quote_tenant_id_lead_id_idx`(`tenant_id`, `lead_id`),
    INDEX `quote_tenant_id_expires_at_idx`(`tenant_id`, `expires_at`),
    INDEX `quote_tenant_id_is_archived_idx`(`tenant_id`, `is_archived`),
    INDEX `quote_tenant_id_parent_quote_id_idx`(`tenant_id`, `parent_quote_id`),
    INDEX `quote_status_idx`(`status`),
    INDEX `quote_latest_pdf_file_id_idx`(`latest_pdf_file_id`),
    UNIQUE INDEX `quote_tenant_id_quote_number_key`(`tenant_id`, `quote_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_note` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `note_text` TEXT NOT NULL,
    `is_pinned` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_note_quote_id_created_at_idx`(`quote_id`, `created_at` DESC),
    INDEX `quote_note_quote_id_is_pinned_created_at_idx`(`quote_id`, `is_pinned` DESC, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_version` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `version_number` DECIMAL(4, 2) NOT NULL,
    `snapshot_data` LONGTEXT NOT NULL,
    `change_summary` TEXT NULL,
    `changed_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_version_quote_id_created_at_idx`(`quote_id`, `created_at` DESC),
    UNIQUE INDEX `quote_version_quote_id_version_number_key`(`quote_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_group` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_group_quote_id_order_index_idx`(`quote_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_item` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `quote_group_id` VARCHAR(36) NULL,
    `item_library_id` VARCHAR(36) NULL,
    `quote_bundle_id` VARCHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit_measurement_id` VARCHAR(36) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `material_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `labor_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `equipment_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `subcontract_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `other_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_cost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `custom_profit_percent` DECIMAL(5, 2) NULL,
    `custom_overhead_percent` DECIMAL(5, 2) NULL,
    `custom_contingency_percent` DECIMAL(5, 2) NULL,
    `custom_discount_percentage` DECIMAL(5, 2) NULL,
    `custom_discount_amount` DECIMAL(10, 2) NULL,
    `private_notes` TEXT NULL,
    `save_to_library` BOOLEAN NOT NULL DEFAULT false,
    `warranty_tier_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_item_quote_id_order_index_idx`(`quote_id`, `order_index`),
    INDEX `quote_item_quote_id_quote_group_id_idx`(`quote_id`, `quote_group_id`),
    INDEX `quote_item_item_library_id_idx`(`item_library_id`),
    INDEX `quote_item_quote_bundle_id_idx`(`quote_bundle_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_approval` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `workflow_id` VARCHAR(36) NOT NULL,
    `approval_level` INTEGER NOT NULL,
    `approver_user_id` VARCHAR(36) NOT NULL,
    `status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
    `comments` TEXT NULL,
    `decided_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_approval_quote_id_workflow_id_idx`(`quote_id`, `workflow_id`),
    INDEX `quote_approval_workflow_id_idx`(`workflow_id`),
    INDEX `quote_approval_quote_id_approval_level_idx`(`quote_id`, `approval_level`),
    INDEX `quote_approval_approver_user_id_status_idx`(`approver_user_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_discount_rule` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `rule_type` ENUM('percentage', 'fixed_amount') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `apply_to` ENUM('subtotal', 'total') NOT NULL DEFAULT 'subtotal',
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_discount_rule_quote_id_order_index_idx`(`quote_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_tag_assignment` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `quote_tag_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_tag_assignment_quote_id_idx`(`quote_id`),
    INDEX `quote_tag_assignment_quote_tag_id_idx`(`quote_tag_id`),
    UNIQUE INDEX `quote_tag_assignment_quote_id_quote_tag_id_key`(`quote_id`, `quote_tag_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_attachment` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `attachment_type` ENUM('cover_photo', 'full_page_photo', 'grid_photo', 'url_attachment') NOT NULL,
    `file_id` VARCHAR(36) NULL,
    `url` VARCHAR(500) NULL,
    `title` VARCHAR(200) NULL,
    `qr_code_file_id` VARCHAR(36) NULL,
    `grid_layout` ENUM('grid_2', 'grid_4', 'grid_6') NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_attachment_quote_id_attachment_type_order_index_idx`(`quote_id`, `attachment_type`, `order_index`),
    INDEX `quote_attachment_file_id_idx`(`file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_view_log` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `public_token` VARCHAR(32) NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(45) NULL,
    `view_duration_seconds` INTEGER NULL,
    `device_type` ENUM('desktop', 'mobile', 'tablet', 'unknown') NULL,
    `referrer_url` VARCHAR(500) NULL,

    INDEX `quote_view_log_quote_id_viewed_at_idx`(`quote_id`, `viewed_at`),
    INDEX `quote_view_log_public_token_idx`(`public_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_download_log` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `public_token` VARCHAR(32) NOT NULL,
    `downloaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ip_address` VARCHAR(45) NULL,
    `device_type` ENUM('desktop', 'mobile', 'tablet', 'unknown') NULL,
    `file_id` VARCHAR(36) NULL,
    `download_type` VARCHAR(20) NOT NULL DEFAULT 'pdf',

    INDEX `quote_download_log_quote_id_downloaded_at_idx`(`quote_id`, `downloaded_at`),
    INDEX `quote_download_log_public_token_idx`(`public_token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `draw_schedule_entry` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `draw_number` INTEGER NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `calculation_type` ENUM('percentage', 'fixed_amount') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `draw_schedule_entry_quote_id_order_index_idx`(`quote_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_public_access` (
    `id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NOT NULL,
    `access_token` VARCHAR(32) NOT NULL,
    `password_hash` VARCHAR(255) NULL,
    `password_hint` VARCHAR(255) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,

    UNIQUE INDEX `quote_public_access_access_token_key`(`access_token`),
    INDEX `quote_public_access_quote_id_idx`(`quote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item_library` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `default_quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unit_measurement_id` VARCHAR(36) NOT NULL,
    `material_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `labor_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `equipment_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `subcontract_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `other_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `last_used_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `item_library_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `item_library_tenant_id_title_idx`(`tenant_id`, `title`),
    INDEX `item_library_tenant_id_last_used_at_idx`(`tenant_id`, `last_used_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_bundle` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `discount_type` ENUM('percentage', 'fixed_amount') NULL,
    `discount_value` DECIMAL(10, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `quote_bundle_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `quote_bundle_tenant_id_name_idx`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_bundle_item` (
    `id` VARCHAR(36) NOT NULL,
    `quote_bundle_id` VARCHAR(36) NOT NULL,
    `item_library_id` VARCHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit_measurement_id` VARCHAR(36) NOT NULL,
    `material_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `labor_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `equipment_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `subcontract_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `other_cost_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_bundle_item_quote_bundle_id_order_index_idx`(`quote_bundle_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `template_body` TEXT NOT NULL,
    `category` VARCHAR(50) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `usage_count` INTEGER NOT NULL DEFAULT 0,
    `created_by` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sms_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `sms_template_tenant_id_category_idx`(`tenant_id`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `business_name` VARCHAR(200) NOT NULL,
    `trade_specialty` VARCHAR(200) NULL,
    `email` VARCHAR(255) NULL,
    `website` VARCHAR(500) NULL,
    `insurance_provider` VARCHAR(200) NULL,
    `insurance_policy_number` VARCHAR(100) NULL,
    `insurance_expiry_date` DATE NULL,
    `coi_on_file` BOOLEAN NOT NULL DEFAULT false,
    `compliance_status` ENUM('valid', 'expiring_soon', 'expired', 'unknown') NOT NULL DEFAULT 'unknown',
    `default_payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL,
    `bank_name` VARCHAR(200) NULL,
    `bank_routing_encrypted` TEXT NULL,
    `bank_account_encrypted` TEXT NULL,
    `venmo_handle` VARCHAR(100) NULL,
    `zelle_contact` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subcontractor_tenant_id_compliance_status_idx`(`tenant_id`, `compliance_status`),
    INDEX `subcontractor_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `subcontractor_tenant_id_insurance_expiry_date_idx`(`tenant_id`, `insurance_expiry_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_contact` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `contact_name` VARCHAR(200) NOT NULL,
    `phone` VARCHAR(20) NOT NULL,
    `role` VARCHAR(100) NULL,
    `email` VARCHAR(255) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subcontractor_contact_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_document` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `document_type` ENUM('insurance', 'agreement', 'coi', 'contract', 'license', 'other') NOT NULL,
    `description` VARCHAR(500) NULL,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `subcontractor_document_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `industry_type` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `project_template_tenant_id_industry_type_idx`(`tenant_id`, `industry_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_template_task` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `estimated_duration_days` INTEGER NULL,
    `category` ENUM('labor', 'material', 'subcontractor', 'equipment', 'other') NULL,
    `order_index` INTEGER NOT NULL,
    `depends_on_order_index` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_template_task_tenant_id_template_id_idx`(`tenant_id`, `template_id`),
    INDEX `project_template_task_template_id_order_index_idx`(`template_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_category` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `type` ENUM('labor', 'material', 'subcontractor', 'equipment', 'insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools', 'other') NOT NULL,
    `classification` ENUM('cost_of_goods_sold', 'operating_expense') NOT NULL DEFAULT 'cost_of_goods_sold',
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_system_default` BOOLEAN NOT NULL DEFAULT false,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_category_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `financial_category_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `financial_category_tenant_id_classification_idx`(`tenant_id`, `classification`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_entry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `entry_type` ENUM('expense', 'income') NOT NULL DEFAULT 'expense',
    `amount` DECIMAL(12, 2) NOT NULL,
    `entry_date` DATE NOT NULL,
    `vendor_name` VARCHAR(200) NULL,
    `crew_member_id` VARCHAR(36) NULL,
    `subcontractor_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `has_receipt` BOOLEAN NOT NULL DEFAULT false,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NULL,
    `payment_method_registry_id` VARCHAR(36) NULL,
    `supplier_id` VARCHAR(36) NULL,
    `purchased_by_user_id` VARCHAR(36) NULL,
    `purchased_by_crew_member_id` VARCHAR(36) NULL,
    `entry_time` TIME(0) NULL,
    `tax_amount` DECIMAL(10, 2) NULL,
    `discount` DECIMAL(10, 2) NULL,
    `submission_status` ENUM('pending_review', 'confirmed', 'denied') NOT NULL DEFAULT 'confirmed',
    `rejection_reason` VARCHAR(500) NULL,
    `rejected_by_user_id` VARCHAR(36) NULL,
    `rejected_at` DATETIME(3) NULL,
    `is_recurring_instance` BOOLEAN NOT NULL DEFAULT false,
    `recurring_rule_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_entry_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `financial_entry_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `financial_entry_tenant_id_project_id_category_id_idx`(`tenant_id`, `project_id`, `category_id`),
    INDEX `financial_entry_tenant_id_entry_date_idx`(`tenant_id`, `entry_date`),
    INDEX `financial_entry_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    INDEX `financial_entry_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    INDEX `financial_entry_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `financial_entry_tenant_id_payment_method_registry_id_idx`(`tenant_id`, `payment_method_registry_id`),
    INDEX `financial_entry_tenant_id_rejected_at_idx`(`tenant_id`, `rejected_at`),
    INDEX `financial_entry_tenant_id_submission_status_idx`(`tenant_id`, `submission_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_entry_line_item` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `financial_entry_id` VARCHAR(36) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL,
    `unit_price` DECIMAL(12, 4) NOT NULL,
    `total` DECIMAL(12, 2) NOT NULL,
    `unit_of_measure` VARCHAR(50) NULL,
    `supplier_product_id` VARCHAR(36) NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `financial_entry_line_item_tenant_id_financial_entry_id_idx`(`tenant_id`, `financial_entry_id`),
    INDEX `financial_entry_line_item_financial_entry_id_order_index_idx`(`financial_entry_id`, `order_index`),
    INDEX `financial_entry_line_item_supplier_product_id_idx`(`supplier_product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recurring_expense_rule` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(10, 2) NULL,
    `supplier_id` VARCHAR(36) NULL,
    `vendor_name` VARCHAR(200) NULL,
    `payment_method_registry_id` VARCHAR(36) NULL,
    `frequency` ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `day_of_month` TINYINT NULL,
    `day_of_week` TINYINT NULL,
    `start_date` DATE NOT NULL,
    `end_date` DATE NULL,
    `recurrence_count` INTEGER NULL,
    `occurrences_generated` INTEGER NOT NULL DEFAULT 0,
    `next_due_date` DATE NOT NULL,
    `auto_confirm` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `status` ENUM('active', 'paused', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
    `last_generated_at` DATETIME(3) NULL,
    `last_generated_entry_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `recurring_expense_rule_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `recurring_expense_rule_tenant_id_next_due_date_idx`(`tenant_id`, `next_due_date`),
    INDEX `recurring_expense_rule_tenant_id_status_next_due_date_idx`(`tenant_id`, `status`, `next_due_date`),
    INDEX `recurring_expense_rule_tenant_id_category_id_idx`(`tenant_id`, `category_id`),
    INDEX `recurring_expense_rule_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_method_registry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `nickname` VARCHAR(100) NOT NULL,
    `type` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
    `bank_name` VARCHAR(100) NULL,
    `last_four` VARCHAR(4) NULL,
    `notes` TEXT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_method_registry_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `payment_method_registry_tenant_id_type_idx`(`tenant_id`, `type`),
    INDEX `payment_method_registry_tenant_id_is_default_idx`(`tenant_id`, `is_default`),
    INDEX `payment_method_registry_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    UNIQUE INDEX `payment_method_registry_tenant_id_nickname_key`(`tenant_id`, `nickname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `receipt` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `financial_entry_id` VARCHAR(36) NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` ENUM('photo', 'pdf') NOT NULL,
    `file_size_bytes` INTEGER NULL,
    `vendor_name` VARCHAR(200) NULL,
    `amount` DECIMAL(12, 2) NULL,
    `receipt_date` DATE NULL,
    `ocr_raw` LONGTEXT NULL,
    `ocr_status` ENUM('not_processed', 'processing', 'complete', 'failed') NOT NULL DEFAULT 'not_processed',
    `ocr_vendor` VARCHAR(200) NULL,
    `ocr_amount` DECIMAL(12, 2) NULL,
    `ocr_date` DATE NULL,
    `ocr_tax` DECIMAL(10, 2) NULL,
    `ocr_discount` DECIMAL(10, 2) NULL,
    `ocr_subtotal` DECIMAL(12, 2) NULL,
    `ocr_time` VARCHAR(8) NULL,
    `ocr_entry_type` VARCHAR(20) NULL,
    `ocr_line_items` LONGTEXT NULL,
    `ocr_notes` TEXT NULL,
    `is_categorized` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `receipt_tenant_id_financial_entry_id_idx`(`tenant_id`, `financial_entry_id`),
    INDEX `receipt_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `receipt_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `receipt_tenant_id_is_categorized_idx`(`tenant_id`, `is_categorized`),
    INDEX `receipt_tenant_id_created_at_idx`(`tenant_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NULL,
    `lead_id` VARCHAR(36) NULL,
    `project_number` VARCHAR(50) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('planned', 'in_progress', 'on_hold', 'completed', 'canceled') NOT NULL DEFAULT 'planned',
    `start_date` DATE NULL,
    `target_completion_date` DATE NULL,
    `actual_completion_date` DATE NULL,
    `permit_required` BOOLEAN NOT NULL DEFAULT false,
    `assigned_pm_user_id` VARCHAR(36) NULL,
    `contract_value` DECIMAL(12, 2) NULL,
    `estimated_cost` DECIMAL(12, 2) NULL,
    `progress_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `is_standalone` BOOLEAN NOT NULL DEFAULT false,
    `portal_enabled` BOOLEAN NOT NULL DEFAULT true,
    `deletion_locked` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `project_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `project_tenant_id_lead_id_idx`(`tenant_id`, `lead_id`),
    INDEX `project_tenant_id_assigned_pm_user_id_idx`(`tenant_id`, `assigned_pm_user_id`),
    UNIQUE INDEX `project_tenant_id_project_number_key`(`tenant_id`, `project_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_task` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `quote_item_id` VARCHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('not_started', 'in_progress', 'blocked', 'done') NOT NULL DEFAULT 'not_started',
    `estimated_duration_days` INTEGER NULL,
    `estimated_start_date` DATE NULL,
    `estimated_end_date` DATE NULL,
    `actual_start_date` DATE NULL,
    `actual_end_date` DATE NULL,
    `is_delayed` BOOLEAN NOT NULL DEFAULT false,
    `order_index` INTEGER NOT NULL,
    `category` ENUM('labor', 'material', 'subcontractor', 'equipment', 'other') NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_task_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `project_task_tenant_id_project_id_status_idx`(`tenant_id`, `project_id`, `status`),
    INDEX `project_task_tenant_id_project_id_order_index_idx`(`tenant_id`, `project_id`, `order_index`),
    INDEX `project_task_tenant_id_is_delayed_idx`(`tenant_id`, `is_delayed`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_dependency` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `depends_on_task_id` VARCHAR(36) NOT NULL,
    `dependency_type` ENUM('finish_to_start', 'start_to_start', 'finish_to_finish') NOT NULL DEFAULT 'finish_to_start',
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `task_dependency_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `task_dependency_tenant_id_depends_on_task_id_idx`(`tenant_id`, `depends_on_task_id`),
    UNIQUE INDEX `task_dependency_task_id_depends_on_task_id_key`(`task_id`, `depends_on_task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_assignee` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `assignee_type` ENUM('crew_member', 'subcontractor', 'user') NOT NULL,
    `crew_member_id` VARCHAR(36) NULL,
    `subcontractor_id` VARCHAR(36) NULL,
    `user_id` VARCHAR(36) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assigned_by_user_id` VARCHAR(36) NOT NULL,

    INDEX `task_assignee_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `task_assignee_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    INDEX `task_assignee_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_activity` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NULL,
    `activity_type` VARCHAR(50) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_activity_tenant_id_project_id_created_at_idx`(`tenant_id`, `project_id`, `created_at` DESC),
    INDEX `project_activity_tenant_id_activity_type_idx`(`tenant_id`, `activity_type`),
    INDEX `project_activity_project_id_created_at_idx`(`project_id`, `created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_document` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `document_type` ENUM('contract', 'permit', 'blueprint', 'agreement', 'photo', 'other') NOT NULL,
    `description` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_document_tenant_id_project_id_document_type_idx`(`tenant_id`, `project_id`, `document_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_photo` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NULL,
    `log_id` VARCHAR(36) NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `caption` VARCHAR(500) NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `taken_at` DATE NULL,
    `uploaded_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_photo_tenant_id_project_id_is_public_idx`(`tenant_id`, `project_id`, `is_public`),
    INDEX `project_photo_tenant_id_project_id_task_id_idx`(`tenant_id`, `project_id`, `task_id`),
    INDEX `project_photo_tenant_id_project_id_created_at_idx`(`tenant_id`, `project_id`, `created_at` DESC),
    INDEX `project_photo_tenant_id_log_id_idx`(`tenant_id`, `log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NULL,
    `author_user_id` VARCHAR(36) NOT NULL,
    `log_date` DATE NOT NULL,
    `content` TEXT NOT NULL,
    `is_public` BOOLEAN NOT NULL DEFAULT false,
    `weather_delay` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_log_tenant_id_project_id_created_at_idx`(`tenant_id`, `project_id`, `created_at`),
    INDEX `project_log_tenant_id_project_id_is_public_idx`(`tenant_id`, `project_id`, `is_public`),
    INDEX `project_log_tenant_id_author_user_id_idx`(`tenant_id`, `author_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_log_attachment` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `log_id` VARCHAR(36) NOT NULL,
    `file_id` VARCHAR(36) NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `file_type` ENUM('photo', 'pdf', 'document') NOT NULL,
    `file_size_bytes` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_log_attachment_tenant_id_log_id_idx`(`tenant_id`, `log_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `task_calendar_event` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `start_datetime` DATETIME(3) NOT NULL,
    `end_datetime` DATETIME(3) NOT NULL,
    `google_event_id` VARCHAR(300) NULL,
    `internal_calendar_id` VARCHAR(36) NULL,
    `sync_status` ENUM('pending', 'synced', 'failed', 'local_only') NOT NULL DEFAULT 'pending',
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `task_calendar_event_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `task_calendar_event_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `task_calendar_event_tenant_id_sync_status_idx`(`tenant_id`, `sync_status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permit` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `permit_number` VARCHAR(100) NULL,
    `permit_type` VARCHAR(200) NOT NULL,
    `status` ENUM('not_required', 'pending_application', 'submitted', 'approved', 'active', 'failed', 'closed') NOT NULL DEFAULT 'pending_application',
    `submitted_date` DATE NULL,
    `approved_date` DATE NULL,
    `expiry_date` DATE NULL,
    `issuing_authority` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `permit_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `permit_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inspection` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `permit_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `inspection_type` VARCHAR(200) NOT NULL,
    `scheduled_date` DATE NULL,
    `inspector_name` VARCHAR(200) NULL,
    `result` ENUM('pass', 'fail', 'conditional', 'pending') NULL,
    `reinspection_required` BOOLEAN NOT NULL DEFAULT false,
    `reinspection_date` DATE NULL,
    `notes` TEXT NULL,
    `inspected_by_user_id` VARCHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inspection_tenant_id_permit_id_idx`(`tenant_id`, `permit_id`),
    INDEX `inspection_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `completion_checklist_template` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `completion_checklist_template_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    UNIQUE INDEX `completion_checklist_template_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `completion_checklist_template_item` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `order_index` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `completion_checklist_template_item_tenant_id_template_id_idx`(`tenant_id`, `template_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_completion_checklist` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NULL,
    `completed_at` DATETIME(3) NULL,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `project_completion_checklist_tenant_id_project_id_key`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_completion_checklist_item` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `checklist_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `is_required` BOOLEAN NOT NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `completed_by_user_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `template_item_id` VARCHAR(36) NULL,
    `order_index` INTEGER NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_completion_checklist_item_tenant_id_checklist_id_idx`(`tenant_id`, `checklist_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `punch_list_item` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `checklist_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('open', 'in_progress', 'resolved') NOT NULL DEFAULT 'open',
    `assigned_to_crew_id` VARCHAR(36) NULL,
    `resolved_at` DATETIME(3) NULL,
    `reported_by_user_id` VARCHAR(36) NULL,
    `resolved_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `punch_list_item_tenant_id_checklist_id_idx`(`tenant_id`, `checklist_id`),
    INDEX `punch_list_item_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `punch_list_item_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crew_payment_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
    `reference_number` VARCHAR(200) NULL,
    `period_start_date` DATE NULL,
    `period_end_date` DATE NULL,
    `hours_paid` DECIMAL(6, 2) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `crew_payment_record_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    INDEX `crew_payment_record_tenant_id_crew_member_id_payment_date_idx`(`tenant_id`, `crew_member_id`, `payment_date`),
    INDEX `crew_payment_record_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `crew_hour_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `log_date` DATE NOT NULL,
    `hours_regular` DECIMAL(5, 2) NOT NULL,
    `hours_overtime` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `source` ENUM('manual', 'clockin_system') NOT NULL DEFAULT 'manual',
    `clockin_event_id` VARCHAR(36) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `crew_hour_log_tenant_id_crew_member_id_log_date_idx`(`tenant_id`, `crew_member_id`, `log_date`),
    INDEX `crew_hour_log_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `crew_hour_log_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_payment_record` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
    `reference_number` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    INDEX `subcontractor_payment_record_tenant_id_subcontractor_id_paym_idx`(`tenant_id`, `subcontractor_id`, `payment_date`),
    INDEX `subcontractor_payment_record_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `subcontractor_task_invoice` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `subcontractor_id` VARCHAR(36) NOT NULL,
    `task_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `invoice_number` VARCHAR(100) NULL,
    `invoice_date` DATE NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'approved', 'paid') NOT NULL DEFAULT 'pending',
    `notes` TEXT NULL,
    `file_id` VARCHAR(36) NULL,
    `file_url` VARCHAR(500) NULL,
    `file_name` VARCHAR(255) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `subcontractor_task_invoice_tenant_id_subcontractor_id_idx`(`tenant_id`, `subcontractor_id`),
    INDEX `subcontractor_task_invoice_tenant_id_task_id_idx`(`tenant_id`, `task_id`),
    INDEX `subcontractor_task_invoice_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `subcontractor_task_invoice_tenant_id_status_idx`(`tenant_id`, `status`),
    UNIQUE INDEX `subcontractor_task_invoice_tenant_id_invoice_number_key`(`tenant_id`, `invoice_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `portal_account` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `customer_slug` VARCHAR(200) NOT NULL,
    `password_hash` TEXT NOT NULL,
    `must_change_password` BOOLEAN NOT NULL DEFAULT true,
    `last_login_at` DATETIME(3) NULL,
    `reset_token` VARCHAR(200) NULL,
    `reset_token_expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `portal_account_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    UNIQUE INDEX `portal_account_tenant_id_lead_id_key`(`tenant_id`, `lead_id`),
    UNIQUE INDEX `portal_account_tenant_id_email_key`(`tenant_id`, `email`),
    UNIQUE INDEX `portal_account_tenant_id_customer_slug_key`(`tenant_id`, `customer_slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_category` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `color` VARCHAR(7) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_category_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `supplier_category_tenant_id_name_idx`(`tenant_id`, `name`),
    UNIQUE INDEX `supplier_category_tenant_id_name_key`(`tenant_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_category_assignment` (
    `id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `supplier_category_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_category_assignment_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_category_assignment_tenant_id_supplier_category_id_idx`(`tenant_id`, `supplier_category_id`),
    UNIQUE INDEX `supplier_category_assignment_supplier_id_supplier_category_i_key`(`supplier_id`, `supplier_category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `legal_name` VARCHAR(200) NULL,
    `website` VARCHAR(500) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(255) NULL,
    `contact_name` VARCHAR(150) NULL,
    `address_line1` VARCHAR(255) NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NULL,
    `state` VARCHAR(2) NULL,
    `zip_code` VARCHAR(10) NULL,
    `country` VARCHAR(2) NOT NULL DEFAULT 'US',
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `google_place_id` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_preferred` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `total_spend` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `last_purchase_date` DATE NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `supplier_tenant_id_is_preferred_idx`(`tenant_id`, `is_preferred`),
    INDEX `supplier_tenant_id_name_idx`(`tenant_id`, `name`),
    INDEX `supplier_tenant_id_last_purchase_date_idx`(`tenant_id`, `last_purchase_date`),
    INDEX `supplier_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_product` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `unit_of_measure` VARCHAR(50) NOT NULL,
    `unit_price` DECIMAL(12, 4) NULL,
    `price_last_updated_at` DATE NULL,
    `price_last_updated_by_user_id` VARCHAR(36) NULL,
    `sku` VARCHAR(100) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `supplier_product_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_product_tenant_id_supplier_id_is_active_idx`(`tenant_id`, `supplier_id`, `is_active`),
    INDEX `supplier_product_supplier_id_name_idx`(`supplier_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_product_price_history` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `supplier_product_id` VARCHAR(36) NOT NULL,
    `supplier_id` VARCHAR(36) NOT NULL,
    `previous_price` DECIMAL(12, 4) NULL,
    `new_price` DECIMAL(12, 4) NOT NULL,
    `changed_by_user_id` VARCHAR(36) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(500) NULL,

    INDEX `supplier_product_price_history_tenant_id_supplier_product_id_idx`(`tenant_id`, `supplier_product_id`),
    INDEX `supplier_product_price_history_tenant_id_supplier_id_idx`(`tenant_id`, `supplier_id`),
    INDEX `supplier_product_price_history_supplier_product_id_changed_a_idx`(`supplier_product_id`, `changed_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_draw_milestone` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `quote_draw_entry_id` VARCHAR(36) NULL,
    `draw_number` INTEGER NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `calculation_type` ENUM('percentage', 'fixed_amount') NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `calculated_amount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('pending', 'invoiced', 'paid') NOT NULL DEFAULT 'pending',
    `invoice_id` VARCHAR(36) NULL,
    `invoiced_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_draw_milestone_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `project_draw_milestone_tenant_id_project_id_status_idx`(`tenant_id`, `project_id`, `status`),
    INDEX `project_draw_milestone_tenant_id_status_idx`(`tenant_id`, `status`),
    UNIQUE INDEX `project_draw_milestone_project_id_draw_number_key`(`project_id`, `draw_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_invoice` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `invoice_number` VARCHAR(50) NOT NULL,
    `milestone_id` VARCHAR(36) NULL,
    `description` VARCHAR(500) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `tax_amount` DECIMAL(10, 2) NULL,
    `amount_paid` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `amount_due` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('draft', 'sent', 'partial', 'paid', 'voided') NOT NULL DEFAULT 'draft',
    `due_date` DATE NULL,
    `sent_at` DATETIME(3) NULL,
    `paid_at` DATETIME(3) NULL,
    `voided_at` DATETIME(3) NULL,
    `voided_reason` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `project_invoice_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `project_invoice_tenant_id_project_id_status_idx`(`tenant_id`, `project_id`, `status`),
    INDEX `project_invoice_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `project_invoice_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    UNIQUE INDEX `project_invoice_tenant_id_invoice_number_key`(`tenant_id`, `invoice_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project_invoice_payment` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `invoice_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_date` DATE NOT NULL,
    `payment_method` ENUM('cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH') NOT NULL,
    `payment_method_registry_id` VARCHAR(36) NULL,
    `reference_number` VARCHAR(200) NULL,
    `notes` TEXT NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `project_invoice_payment_tenant_id_invoice_id_idx`(`tenant_id`, `invoice_id`),
    INDEX `project_invoice_payment_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `project_invoice_payment_tenant_id_payment_date_idx`(`tenant_id`, `payment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_export_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `export_type` ENUM('quickbooks_expenses', 'quickbooks_invoices', 'xero_expenses', 'xero_invoices', 'pl_csv', 'entries_csv') NOT NULL,
    `date_from` DATE NULL,
    `date_to` DATE NULL,
    `record_count` INTEGER NOT NULL,
    `file_name` VARCHAR(255) NOT NULL,
    `filters_applied` TEXT NULL,
    `exported_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fin_export_log_tenant_export_type_idx`(`tenant_id`, `export_type`),
    INDEX `fin_export_log_tenant_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `fin_export_log_tenant_user_idx`(`tenant_id`, `exported_by_user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_category_account_mapping` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    `platform` ENUM('quickbooks', 'xero') NOT NULL,
    `account_name` VARCHAR(200) NOT NULL,
    `account_code` VARCHAR(50) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `updated_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `fin_cat_acct_map_tenant_platform_idx`(`tenant_id`, `platform`),
    UNIQUE INDEX `fin_cat_acct_map_tenant_cat_platform_key`(`tenant_id`, `category_id`, `platform`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_clock_settings` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_in_mode` ENUM('anywhere', 'specific_addresses', 'active_job_sites') NOT NULL DEFAULT 'anywhere',
    `geofence_violation_action` ENUM('block', 'warn_only') NOT NULL DEFAULT 'warn_only',
    `gps_required` BOOLEAN NOT NULL DEFAULT true,
    `gps_unavailable_action` ENUM('block', 'allow_flagged') NOT NULL DEFAULT 'allow_flagged',
    `require_job_tag` BOOLEAN NOT NULL DEFAULT false,
    `require_task_tag` BOOLEAN NOT NULL DEFAULT false,
    `overtime_enabled` BOOLEAN NOT NULL DEFAULT true,
    `overtime_daily_threshold_hours` DECIMAL(4, 2) NULL DEFAULT 8.00,
    `overtime_weekly_threshold_hours` DECIMAL(5, 2) NULL DEFAULT 40.00,
    `overtime_multiplier` DECIMAL(3, 2) NULL DEFAULT 1.50,
    `pay_period_type` ENUM('weekly', 'biweekly', 'semimonthly', 'monthly') NOT NULL DEFAULT 'biweekly',
    `pay_period_start_day` INTEGER NULL,
    `pay_period_anchor_date` DATE NULL,
    `kiosk_mode_enabled` BOOLEAN NOT NULL DEFAULT false,
    `kiosk_token_hash` VARCHAR(255) NULL,
    `shift_reminder_minutes` INTEGER NOT NULL DEFAULT 30,
    `missed_shift_threshold_minutes` INTEGER NOT NULL DEFAULT 30,
    `native_app_features_enabled` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `time_clock_settings_tenant_id_key`(`tenant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_profile` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `crew_member_id` VARCHAR(36) NULL,
    `hourly_rate` DECIMAL(10, 2) NULL,
    `overtime_rule_override` BOOLEAN NOT NULL DEFAULT false,
    `overtime_daily_threshold_hours` DECIMAL(4, 2) NULL,
    `overtime_weekly_threshold_hours` DECIMAL(5, 2) NULL,
    `kiosk_pin_hash` VARCHAR(255) NULL,
    `kiosk_pin_failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `kiosk_pin_locked_until` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `push_subscription_json` TEXT NULL,
    `push_token_native` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `employee_profile_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `employee_profile_tenant_id_crew_member_id_idx`(`tenant_id`, `crew_member_id`),
    UNIQUE INDEX `employee_profile_tenant_id_user_id_key`(`tenant_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clockin_address` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `label` VARCHAR(100) NOT NULL,
    `address_line1` VARCHAR(255) NOT NULL,
    `address_line2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(2) NOT NULL,
    `zip_code` VARCHAR(10) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `radius_meters` INTEGER NOT NULL DEFAULT 100,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `source` ENUM('manual', 'imported_from_quote', 'imported_from_lead') NOT NULL DEFAULT 'manual',
    `source_address_id` VARCHAR(36) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clockin_address_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `clockin_address_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employee_project_assignment` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NOT NULL,
    `assigned_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `employee_project_assignment_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    UNIQUE INDEX `employee_project_assignment_tenant_id_employee_profile_id_pr_key`(`tenant_id`, `employee_profile_id`, `project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `work_shift` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `scheduled_start` DATETIME(3) NOT NULL,
    `scheduled_end` DATETIME(3) NOT NULL,
    `title` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `status` ENUM('scheduled', 'in_progress', 'completed', 'missed', 'cancelled') NOT NULL DEFAULT 'scheduled',
    `reminder_sent_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `work_shift_tenant_id_employee_profile_id_scheduled_start_idx`(`tenant_id`, `employee_profile_id`, `scheduled_start`),
    INDEX `work_shift_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `work_shift_tenant_id_scheduled_start_idx`(`tenant_id`, `scheduled_start`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clock_session` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `employee_profile_id` VARCHAR(36) NOT NULL,
    `work_shift_id` VARCHAR(36) NULL,
    `project_id` VARCHAR(36) NULL,
    `task_id` VARCHAR(36) NULL,
    `clockin_address_id` VARCHAR(36) NULL,
    `status` ENUM('active', 'on_break', 'completed') NOT NULL DEFAULT 'active',
    `clock_in_at` DATETIME(3) NOT NULL,
    `clock_out_at` DATETIME(3) NULL,
    `clock_in_latitude` DECIMAL(10, 8) NULL,
    `clock_in_longitude` DECIMAL(11, 8) NULL,
    `clock_in_location_source` ENUM('browser_gps', 'native_gps', 'kiosk', 'manual') NOT NULL DEFAULT 'browser_gps',
    `clock_in_geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL DEFAULT 'not_enforced',
    `clock_out_latitude` DECIMAL(10, 8) NULL,
    `clock_out_longitude` DECIMAL(11, 8) NULL,
    `clock_out_location_source` ENUM('browser_gps', 'native_gps', 'kiosk', 'manual') NOT NULL DEFAULT 'browser_gps',
    `clock_out_geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL DEFAULT 'not_enforced',
    `total_worked_minutes` INTEGER NULL,
    `regular_minutes` INTEGER NULL,
    `overtime_minutes` INTEGER NULL,
    `is_manual_edit` BOOLEAN NOT NULL DEFAULT false,
    `is_flagged` BOOLEAN NOT NULL DEFAULT false,
    `flag_reason` VARCHAR(255) NULL,
    `labor_cost_posted` BOOLEAN NOT NULL DEFAULT false,
    `labor_cost_entry_id` VARCHAR(36) NULL,
    `labor_cost_reconciliation_needed` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `clock_session_tenant_id_employee_profile_id_clock_in_at_idx`(`tenant_id`, `employee_profile_id`, `clock_in_at`),
    INDEX `clock_session_tenant_id_status_idx`(`tenant_id`, `status`),
    INDEX `clock_session_tenant_id_project_id_idx`(`tenant_id`, `project_id`),
    INDEX `clock_session_tenant_id_is_flagged_idx`(`tenant_id`, `is_flagged`),
    INDEX `clock_session_tenant_id_clock_in_at_idx`(`tenant_id`, `clock_in_at`),
    INDEX `clock_session_tenant_id_labor_cost_posted_idx`(`tenant_id`, `labor_cost_posted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `break_entry` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `break_type` ENUM('paid', 'unpaid') NOT NULL DEFAULT 'unpaid',
    `break_label` VARCHAR(50) NULL,
    `started_at` DATETIME(3) NOT NULL,
    `ended_at` DATETIME(3) NULL,
    `duration_minutes` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `break_entry_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clock_session_edit_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `edited_by_user_id` VARCHAR(36) NOT NULL,
    `field_changed` VARCHAR(100) NOT NULL,
    `original_value` TEXT NULL,
    `new_value` TEXT NULL,
    `reason` TEXT NOT NULL,
    `edited_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `clock_session_edit_log_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `time_dispute` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `submitted_by_user_id` VARCHAR(36) NOT NULL,
    `dispute_type` ENUM('flag_only', 'correction_request') NOT NULL,
    `description` TEXT NOT NULL,
    `proposed_clock_in_at` DATETIME(3) NULL,
    `proposed_clock_out_at` DATETIME(3) NULL,
    `proposed_project_id` VARCHAR(36) NULL,
    `proposed_task_id` VARCHAR(36) NULL,
    `proposed_notes` TEXT NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'resolved') NOT NULL DEFAULT 'pending',
    `reviewed_by_user_id` VARCHAR(36) NULL,
    `review_notes` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `time_dispute_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    INDEX `time_dispute_tenant_id_status_idx`(`tenant_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clock_session_location_log` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `clock_session_id` VARCHAR(36) NOT NULL,
    `captured_at` DATETIME(3) NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `accuracy_meters` DECIMAL(6, 2) NULL,
    `geofence_status` ENUM('inside', 'outside', 'unavailable', 'not_enforced') NOT NULL,

    INDEX `clock_session_location_log_tenant_id_clock_session_id_idx`(`tenant_id`, `clock_session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_log` ADD CONSTRAINT `audit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file` ADD CONSTRAINT `file_uploaded_by_fkey` FOREIGN KEY (`uploaded_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_industry` ADD CONSTRAINT `tenant_industry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_industry` ADD CONSTRAINT `tenant_industry_industry_id_fkey` FOREIGN KEY (`industry_id`) REFERENCES `industry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permission` ADD CONSTRAINT `permission_module_id_fkey` FOREIGN KEY (`module_id`) REFERENCES `module`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permission` ADD CONSTRAINT `role_permission_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_template_permission` ADD CONSTRAINT `role_template_permission_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_template_permission` ADD CONSTRAINT `role_template_permission_role_template_id_fkey` FOREIGN KEY (`role_template_id`) REFERENCES `role_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_logo_file_id_fkey` FOREIGN KEY (`logo_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_subscription_plan_id_fkey` FOREIGN KEY (`subscription_plan_id`) REFERENCES `subscription_plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_venmo_qr_code_file_id_fkey` FOREIGN KEY (`venmo_qr_code_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant` ADD CONSTRAINT `tenant_active_quote_template_id_fkey` FOREIGN KEY (`active_quote_template_id`) REFERENCES `quote_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_address` ADD CONSTRAINT `tenant_address_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_business_hours` ADD CONSTRAINT `tenant_business_hours_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_custom_hours` ADD CONSTRAINT `tenant_custom_hours_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_insurance` ADD CONSTRAINT `tenant_insurance_gl_document_file_id_fkey` FOREIGN KEY (`gl_document_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_insurance` ADD CONSTRAINT `tenant_insurance_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_insurance` ADD CONSTRAINT `tenant_insurance_wc_document_file_id_fkey` FOREIGN KEY (`wc_document_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_license` ADD CONSTRAINT `tenant_license_document_file_id_fkey` FOREIGN KEY (`document_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_license` ADD CONSTRAINT `tenant_license_license_type_id_fkey` FOREIGN KEY (`license_type_id`) REFERENCES `license_type`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_license` ADD CONSTRAINT `tenant_license_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_payment_terms` ADD CONSTRAINT `tenant_payment_terms_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_service` ADD CONSTRAINT `tenant_service_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `service`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_service` ADD CONSTRAINT `tenant_service_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_service_area` ADD CONSTRAINT `tenant_service_area_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_role` ADD CONSTRAINT `user_role_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `role`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_tenant_membership` ADD CONSTRAINT `user_tenant_membership_invited_by_user_id_fkey` FOREIGN KEY (`invited_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_signature` ADD CONSTRAINT `user_signature_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_share_link` ADD CONSTRAINT `file_share_link_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_share_link` ADD CONSTRAINT `file_share_link_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `file_share_link` ADD CONSTRAINT `file_share_link_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `storage_config` ADD CONSTRAINT `storage_config_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_flag` ADD CONSTRAINT `feature_flag_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_mode` ADD CONSTRAINT `maintenance_mode_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_impersonated_user_id_fkey` FOREIGN KEY (`impersonated_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `impersonation_session` ADD CONSTRAINT `impersonation_session_impersonated_tenant_id_fkey` FOREIGN KEY (`impersonated_tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `system_setting` ADD CONSTRAINT `system_setting_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_job` ADD CONSTRAINT `export_job_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_report` ADD CONSTRAINT `scheduled_report_admin_user_id_fkey` FOREIGN KEY (`admin_user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_sms_config` ADD CONSTRAINT `tenant_sms_config_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_sms_config` ADD CONSTRAINT `tenant_sms_config_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_whatsapp_config` ADD CONSTRAINT `tenant_whatsapp_config_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_whatsapp_config` ADD CONSTRAINT `tenant_whatsapp_config_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_record` ADD CONSTRAINT `call_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_record` ADD CONSTRAINT `call_record_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_record` ADD CONSTRAINT `call_record_initiated_by_fkey` FOREIGN KEY (`initiated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_record` ADD CONSTRAINT `call_record_voice_call_log_id_fkey` FOREIGN KEY (`voice_call_log_id`) REFERENCES `voice_call_log`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ivr_configuration` ADD CONSTRAINT `ivr_configuration_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `office_number_whitelist` ADD CONSTRAINT `office_number_whitelist_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_transcription` ADD CONSTRAINT `call_transcription_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `call_transcription` ADD CONSTRAINT `call_transcription_call_record_id_fkey` FOREIGN KEY (`call_record_id`) REFERENCES `call_record`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transcription_provider_configuration` ADD CONSTRAINT `transcription_provider_configuration_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_ai_credentials` ADD CONSTRAINT `voice_ai_credentials_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `voice_ai_provider`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_ai_credentials` ADD CONSTRAINT `voice_ai_credentials_updated_by_fkey` FOREIGN KEY (`updated_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_ai_global_config` ADD CONSTRAINT `voice_ai_global_config_default_stt_provider_id_fkey` FOREIGN KEY (`default_stt_provider_id`) REFERENCES `voice_ai_provider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_ai_global_config` ADD CONSTRAINT `voice_ai_global_config_default_llm_provider_id_fkey` FOREIGN KEY (`default_llm_provider_id`) REFERENCES `voice_ai_provider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_ai_global_config` ADD CONSTRAINT `voice_ai_global_config_default_tts_provider_id_fkey` FOREIGN KEY (`default_tts_provider_id`) REFERENCES `voice_ai_provider`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_voice_ai_settings` ADD CONSTRAINT `tenant_voice_ai_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_voice_ai_settings` ADD CONSTRAINT `tenant_voice_ai_settings_default_transfer_number_id_fkey` FOREIGN KEY (`default_transfer_number_id`) REFERENCES `tenant_voice_transfer_number`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_voice_transfer_number` ADD CONSTRAINT `tenant_voice_transfer_number_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_voice_agent_profile_override` ADD CONSTRAINT `tenant_voice_agent_profile_override_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_voice_agent_profile_override` ADD CONSTRAINT `tenant_voice_agent_profile_override_agent_profile_id_fkey` FOREIGN KEY (`agent_profile_id`) REFERENCES `voice_ai_agent_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_call_log` ADD CONSTRAINT `voice_call_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_call_log` ADD CONSTRAINT `voice_call_log_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_usage_record` ADD CONSTRAINT `voice_usage_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_usage_record` ADD CONSTRAINT `voice_usage_record_call_log_id_fkey` FOREIGN KEY (`call_log_id`) REFERENCES `voice_call_log`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_usage_record` ADD CONSTRAINT `voice_usage_record_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `voice_ai_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `voice_monthly_usage` ADD CONSTRAINT `voice_monthly_usage_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_member` ADD CONSTRAINT `crew_member_profile_photo_file_id_fkey` FOREIGN KEY (`profile_photo_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_log` ADD CONSTRAINT `job_log_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_queue` ADD CONSTRAINT `email_queue_job_id_fkey` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead` ADD CONSTRAINT `lead_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_email` ADD CONSTRAINT `lead_email_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_phone` ADD CONSTRAINT `lead_phone_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_address` ADD CONSTRAINT `lead_address_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request` ADD CONSTRAINT `service_request_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request` ADD CONSTRAINT `service_request_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_request` ADD CONSTRAINT `service_request_lead_address_id_fkey` FOREIGN KEY (`lead_address_id`) REFERENCES `lead_address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_note` ADD CONSTRAINT `lead_note_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_note` ADD CONSTRAINT `lead_note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activity` ADD CONSTRAINT `lead_activity_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activity` ADD CONSTRAINT `lead_activity_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_api_key` ADD CONSTRAINT `webhook_api_key_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_api_key` ADD CONSTRAINT `webhook_api_key_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_type` ADD CONSTRAINT `appointment_type_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_type` ADD CONSTRAINT `appointment_type_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment_type_schedule` ADD CONSTRAINT `appointment_type_schedule_appointment_type_id_fkey` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_appointment_type_id_fkey` FOREIGN KEY (`appointment_type_id`) REFERENCES `appointment_type`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_service_request_id_fkey` FOREIGN KEY (`service_request_id`) REFERENCES `service_request`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_assigned_user_id_fkey` FOREIGN KEY (`assigned_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_cancelled_by_user_id_fkey` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `appointment` ADD CONSTRAINT `appointment_rescheduled_from_id_fkey` FOREIGN KEY (`rescheduled_from_id`) REFERENCES `appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_provider_connection` ADD CONSTRAINT `calendar_provider_connection_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_provider_connection` ADD CONSTRAINT `calendar_provider_connection_connected_by_user_id_fkey` FOREIGN KEY (`connected_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_sync_log` ADD CONSTRAINT `calendar_sync_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_sync_log` ADD CONSTRAINT `calendar_sync_log_connection_id_fkey` FOREIGN KEY (`connection_id`) REFERENCES `calendar_provider_connection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_sync_log` ADD CONSTRAINT `calendar_sync_log_appointment_id_fkey` FOREIGN KEY (`appointment_id`) REFERENCES `appointment`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_external_block` ADD CONSTRAINT `calendar_external_block_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calendar_external_block` ADD CONSTRAINT `calendar_external_block_connection_id_fkey` FOREIGN KEY (`connection_id`) REFERENCES `calendar_provider_connection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `platform_email_config` ADD CONSTRAINT `platform_email_config_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_email_config` ADD CONSTRAINT `tenant_email_config_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tenant_email_config` ADD CONSTRAINT `tenant_email_config_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `email_template` ADD CONSTRAINT `email_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `communication_event` ADD CONSTRAINT `communication_event_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `communication_event` ADD CONSTRAINT `communication_event_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `communication_event` ADD CONSTRAINT `communication_event_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_event` ADD CONSTRAINT `webhook_event_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `communication_provider`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_event` ADD CONSTRAINT `webhook_event_communication_event_id_fkey` FOREIGN KEY (`communication_event_id`) REFERENCES `communication_event`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification_rule` ADD CONSTRAINT `notification_rule_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `twilio_usage_record` ADD CONSTRAINT `twilio_usage_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_alert` ADD CONSTRAINT `admin_alert_acknowledged_by_fkey` FOREIGN KEY (`acknowledged_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_alert` ADD CONSTRAINT `admin_alert_resolved_by_fkey` FOREIGN KEY (`resolved_by`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_measurement` ADD CONSTRAINT `unit_measurement_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `template_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_source_template_id_fkey` FOREIGN KEY (`source_template_id`) REFERENCES `quote_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template_version` ADD CONSTRAINT `quote_template_version_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quote_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template_version` ADD CONSTRAINT `quote_template_version_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_component` ADD CONSTRAINT `template_component_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_component` ADD CONSTRAINT `template_component_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quote_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor` ADD CONSTRAINT `vendor_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor` ADD CONSTRAINT `vendor_signature_file_id_fkey` FOREIGN KEY (`signature_file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `vendor` ADD CONSTRAINT `vendor_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_tag` ADD CONSTRAINT `quote_tag_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_warranty_tier` ADD CONSTRAINT `quote_warranty_tier_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_jobsite_address` ADD CONSTRAINT `quote_jobsite_address_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_parent_quote_id_fkey` FOREIGN KEY (`parent_quote_id`) REFERENCES `quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_vendor_id_fkey` FOREIGN KEY (`vendor_id`) REFERENCES `vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_jobsite_address_id_fkey` FOREIGN KEY (`jobsite_address_id`) REFERENCES `quote_jobsite_address`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_active_template_id_fkey` FOREIGN KEY (`active_template_id`) REFERENCES `quote_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote` ADD CONSTRAINT `quote_latest_pdf_file_id_fkey` FOREIGN KEY (`latest_pdf_file_id`) REFERENCES `file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_note` ADD CONSTRAINT `quote_note_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_note` ADD CONSTRAINT `quote_note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_version` ADD CONSTRAINT `quote_version_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_version` ADD CONSTRAINT `quote_version_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_group` ADD CONSTRAINT `quote_group_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_quote_group_id_fkey` FOREIGN KEY (`quote_group_id`) REFERENCES `quote_group`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_unit_measurement_id_fkey` FOREIGN KEY (`unit_measurement_id`) REFERENCES `unit_measurement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_warranty_tier_id_fkey` FOREIGN KEY (`warranty_tier_id`) REFERENCES `quote_warranty_tier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_item` ADD CONSTRAINT `quote_item_quote_bundle_id_fkey` FOREIGN KEY (`quote_bundle_id`) REFERENCES `quote_bundle`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_approval` ADD CONSTRAINT `quote_approval_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_approval` ADD CONSTRAINT `quote_approval_approver_user_id_fkey` FOREIGN KEY (`approver_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_discount_rule` ADD CONSTRAINT `quote_discount_rule_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_tag_assignment` ADD CONSTRAINT `quote_tag_assignment_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_tag_assignment` ADD CONSTRAINT `quote_tag_assignment_quote_tag_id_fkey` FOREIGN KEY (`quote_tag_id`) REFERENCES `quote_tag`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_attachment` ADD CONSTRAINT `quote_attachment_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_attachment` ADD CONSTRAINT `quote_attachment_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_attachment` ADD CONSTRAINT `quote_attachment_qr_code_file_id_fkey` FOREIGN KEY (`qr_code_file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_view_log` ADD CONSTRAINT `quote_view_log_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_download_log` ADD CONSTRAINT `quote_download_log_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `draw_schedule_entry` ADD CONSTRAINT `draw_schedule_entry_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_public_access` ADD CONSTRAINT `quote_public_access_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_library` ADD CONSTRAINT `item_library_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_library` ADD CONSTRAINT `item_library_unit_measurement_id_fkey` FOREIGN KEY (`unit_measurement_id`) REFERENCES `unit_measurement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_library` ADD CONSTRAINT `item_library_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_bundle` ADD CONSTRAINT `quote_bundle_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_bundle` ADD CONSTRAINT `quote_bundle_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_bundle_item` ADD CONSTRAINT `quote_bundle_item_quote_bundle_id_fkey` FOREIGN KEY (`quote_bundle_id`) REFERENCES `quote_bundle`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_bundle_item` ADD CONSTRAINT `quote_bundle_item_unit_measurement_id_fkey` FOREIGN KEY (`unit_measurement_id`) REFERENCES `unit_measurement`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sms_template` ADD CONSTRAINT `sms_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sms_template` ADD CONSTRAINT `sms_template_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor` ADD CONSTRAINT `subcontractor_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor` ADD CONSTRAINT `subcontractor_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_contact` ADD CONSTRAINT `subcontractor_contact_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_contact` ADD CONSTRAINT `subcontractor_contact_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_document` ADD CONSTRAINT `subcontractor_document_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template` ADD CONSTRAINT `project_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template` ADD CONSTRAINT `project_template_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template_task` ADD CONSTRAINT `project_template_task_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `project_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_template_task` ADD CONSTRAINT `project_template_task_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category` ADD CONSTRAINT `financial_category_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category` ADD CONSTRAINT `financial_category_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_purchased_by_user_id_fkey` FOREIGN KEY (`purchased_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_purchased_by_crew_member_id_fkey` FOREIGN KEY (`purchased_by_crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_payment_method_registry_id_fkey` FOREIGN KEY (`payment_method_registry_id`) REFERENCES `payment_method_registry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_rejected_by_user_id_fkey` FOREIGN KEY (`rejected_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry` ADD CONSTRAINT `financial_entry_recurring_rule_id_fkey` FOREIGN KEY (`recurring_rule_id`) REFERENCES `recurring_expense_rule`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry_line_item` ADD CONSTRAINT `financial_entry_line_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry_line_item` ADD CONSTRAINT `financial_entry_line_item_financial_entry_id_fkey` FOREIGN KEY (`financial_entry_id`) REFERENCES `financial_entry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_entry_line_item` ADD CONSTRAINT `financial_entry_line_item_supplier_product_id_fkey` FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_payment_method_registry_id_fkey` FOREIGN KEY (`payment_method_registry_id`) REFERENCES `payment_method_registry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recurring_expense_rule` ADD CONSTRAINT `recurring_expense_rule_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_method_registry` ADD CONSTRAINT `payment_method_registry_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_financial_entry_id_fkey` FOREIGN KEY (`financial_entry_id`) REFERENCES `financial_entry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `receipt` ADD CONSTRAINT `receipt_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_assigned_pm_user_id_fkey` FOREIGN KEY (`assigned_pm_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_quote_item_id_fkey` FOREIGN KEY (`quote_item_id`) REFERENCES `quote_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_task` ADD CONSTRAINT `project_task_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_depends_on_task_id_fkey` FOREIGN KEY (`depends_on_task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_dependency` ADD CONSTRAINT `task_dependency_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_assignee` ADD CONSTRAINT `task_assignee_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_activity` ADD CONSTRAINT `project_activity_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_document` ADD CONSTRAINT `project_document_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_photo` ADD CONSTRAINT `project_photo_log_id_fkey` FOREIGN KEY (`log_id`) REFERENCES `project_log`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log` ADD CONSTRAINT `project_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log` ADD CONSTRAINT `project_log_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log` ADD CONSTRAINT `project_log_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log` ADD CONSTRAINT `project_log_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log_attachment` ADD CONSTRAINT `project_log_attachment_log_id_fkey` FOREIGN KEY (`log_id`) REFERENCES `project_log`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log_attachment` ADD CONSTRAINT `project_log_attachment_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_log_attachment` ADD CONSTRAINT `project_log_attachment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_calendar_event` ADD CONSTRAINT `task_calendar_event_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permit` ADD CONSTRAINT `permit_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_permit_id_fkey` FOREIGN KEY (`permit_id`) REFERENCES `permit`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inspection` ADD CONSTRAINT `inspection_inspected_by_user_id_fkey` FOREIGN KEY (`inspected_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `completion_checklist_template` ADD CONSTRAINT `completion_checklist_template_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `completion_checklist_template` ADD CONSTRAINT `completion_checklist_template_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `completion_checklist_template_item` ADD CONSTRAINT `completion_checklist_template_item_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `completion_checklist_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `completion_checklist_template_item` ADD CONSTRAINT `completion_checklist_template_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `completion_checklist_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist` ADD CONSTRAINT `project_completion_checklist_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_checklist_id_fkey` FOREIGN KEY (`checklist_id`) REFERENCES `project_completion_checklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_template_item_id_fkey` FOREIGN KEY (`template_item_id`) REFERENCES `completion_checklist_template_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_completion_checklist_item` ADD CONSTRAINT `project_completion_checklist_item_completed_by_user_id_fkey` FOREIGN KEY (`completed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_checklist_id_fkey` FOREIGN KEY (`checklist_id`) REFERENCES `project_completion_checklist`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_reported_by_user_id_fkey` FOREIGN KEY (`reported_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_resolved_by_user_id_fkey` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `punch_list_item` ADD CONSTRAINT `punch_list_item_assigned_to_crew_id_fkey` FOREIGN KEY (`assigned_to_crew_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_payment_record` ADD CONSTRAINT `crew_payment_record_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `crew_hour_log` ADD CONSTRAINT `crew_hour_log_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_payment_record` ADD CONSTRAINT `subcontractor_payment_record_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_subcontractor_id_fkey` FOREIGN KEY (`subcontractor_id`) REFERENCES `subcontractor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `subcontractor_task_invoice` ADD CONSTRAINT `subcontractor_task_invoice_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portal_account` ADD CONSTRAINT `portal_account_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `portal_account` ADD CONSTRAINT `portal_account_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category` ADD CONSTRAINT `supplier_category_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category` ADD CONSTRAINT `supplier_category_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_supplier_category_id_fkey` FOREIGN KEY (`supplier_category_id`) REFERENCES `supplier_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_category_assignment` ADD CONSTRAINT `supplier_category_assignment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier` ADD CONSTRAINT `supplier_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product` ADD CONSTRAINT `supplier_product_price_last_updated_by_user_id_fkey` FOREIGN KEY (`price_last_updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_supplier_product_id_fkey` FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_product_price_history` ADD CONSTRAINT `supplier_product_price_history_changed_by_user_id_fkey` FOREIGN KEY (`changed_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_draw_milestone` ADD CONSTRAINT `project_draw_milestone_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_draw_milestone` ADD CONSTRAINT `project_draw_milestone_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_draw_milestone` ADD CONSTRAINT `project_draw_milestone_quote_draw_entry_id_fkey` FOREIGN KEY (`quote_draw_entry_id`) REFERENCES `draw_schedule_entry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_draw_milestone` ADD CONSTRAINT `project_draw_milestone_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `project_invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_draw_milestone` ADD CONSTRAINT `project_draw_milestone_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice` ADD CONSTRAINT `project_invoice_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice` ADD CONSTRAINT `project_invoice_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice` ADD CONSTRAINT `project_invoice_milestone_id_fkey` FOREIGN KEY (`milestone_id`) REFERENCES `project_draw_milestone`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice` ADD CONSTRAINT `project_invoice_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice` ADD CONSTRAINT `project_invoice_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice_payment` ADD CONSTRAINT `project_invoice_payment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice_payment` ADD CONSTRAINT `project_invoice_payment_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `project_invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice_payment` ADD CONSTRAINT `project_invoice_payment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project_invoice_payment` ADD CONSTRAINT `project_invoice_payment_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_export_log` ADD CONSTRAINT `financial_export_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_export_log` ADD CONSTRAINT `financial_export_log_exported_by_user_id_fkey` FOREIGN KEY (`exported_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `financial_category_account_mapping_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `financial_category_account_mapping_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `financial_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `financial_category_account_mapping_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_category_account_mapping` ADD CONSTRAINT `financial_category_account_mapping_updated_by_user_id_fkey` FOREIGN KEY (`updated_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_clock_settings` ADD CONSTRAINT `time_clock_settings_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_profile` ADD CONSTRAINT `employee_profile_crew_member_id_fkey` FOREIGN KEY (`crew_member_id`) REFERENCES `crew_member`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clockin_address` ADD CONSTRAINT `clockin_address_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employee_project_assignment` ADD CONSTRAINT `employee_project_assignment_assigned_by_user_id_fkey` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `work_shift` ADD CONSTRAINT `work_shift_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_employee_profile_id_fkey` FOREIGN KEY (`employee_profile_id`) REFERENCES `employee_profile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_work_shift_id_fkey` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_task_id_fkey` FOREIGN KEY (`task_id`) REFERENCES `project_task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session` ADD CONSTRAINT `clock_session_clockin_address_id_fkey` FOREIGN KEY (`clockin_address_id`) REFERENCES `clockin_address`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `break_entry` ADD CONSTRAINT `break_entry_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `break_entry` ADD CONSTRAINT `break_entry_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session_edit_log` ADD CONSTRAINT `clock_session_edit_log_edited_by_user_id_fkey` FOREIGN KEY (`edited_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_submitted_by_user_id_fkey` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `time_dispute` ADD CONSTRAINT `time_dispute_reviewed_by_user_id_fkey` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session_location_log` ADD CONSTRAINT `clock_session_location_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_session_location_log` ADD CONSTRAINT `clock_session_location_log_clock_session_id_fkey` FOREIGN KEY (`clock_session_id`) REFERENCES `clock_session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

