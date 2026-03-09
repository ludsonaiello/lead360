-- CreateTable
CREATE TABLE `tenant_voice_agent_profile` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `title` VARCHAR(100) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `voice_id` VARCHAR(200) NOT NULL,
    `custom_greeting` TEXT NULL,
    `custom_instructions` LONGTEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `updated_by` VARCHAR(36) NULL,

    INDEX `tenant_voice_agent_profile_tenant_id_idx`(`tenant_id`),
    INDEX `tenant_voice_agent_profile_tenant_id_is_active_idx`(`tenant_id`, `is_active`),
    INDEX `tenant_voice_agent_profile_tenant_id_language_code_idx`(`tenant_id`, `language_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable subscription_plan
ALTER TABLE `subscription_plan` ADD COLUMN `voice_ai_max_agent_profiles` INTEGER NOT NULL DEFAULT 1;

-- AlterTable tenant_voice_ai_settings
ALTER TABLE `tenant_voice_ai_settings` ADD COLUMN `default_agent_profile_id` VARCHAR(36) NULL;

-- AddForeignKey (tenant_voice_agent_profile → tenant)
ALTER TABLE `tenant_voice_agent_profile` ADD CONSTRAINT `tenant_voice_agent_profile_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (tenant_voice_ai_settings → tenant_voice_agent_profile)
ALTER TABLE `tenant_voice_ai_settings` ADD CONSTRAINT `tenant_voice_ai_settings_default_agent_profile_id_fkey` FOREIGN KEY (`default_agent_profile_id`) REFERENCES `tenant_voice_agent_profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
