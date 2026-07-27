-- AddColumn: quote_template
ALTER TABLE `quote_template` ADD COLUMN `template_type` VARCHAR(20) NOT NULL DEFAULT 'code';
ALTER TABLE `quote_template` ADD COLUMN `visual_structure` JSON NULL;
ALTER TABLE `quote_template` ADD COLUMN `css_content` LONGTEXT NULL;
ALTER TABLE `quote_template` ADD COLUMN `category_id` VARCHAR(36) NULL;
ALTER TABLE `quote_template` ADD COLUMN `tags` JSON NULL;
ALTER TABLE `quote_template` ADD COLUMN `is_prebuilt` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `quote_template` ADD COLUMN `source_template_id` VARCHAR(36) NULL;

-- AddColumn: quote_template_version
ALTER TABLE `quote_template_version` ADD COLUMN `template_type` VARCHAR(20) NOT NULL DEFAULT 'code';
ALTER TABLE `quote_template_version` ADD COLUMN `visual_structure` JSON NULL;
ALTER TABLE `quote_template_version` ADD COLUMN `render_time_ms` INT NULL;
ALTER TABLE `quote_template_version` ADD COLUMN `pdf_size_kb` INT NULL;

-- CreateTable: template_category
CREATE TABLE `template_category` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon_name` VARCHAR(50) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `template_category_sort_order_idx`(`sort_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: template_component
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
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_by_user_id` VARCHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `template_component_component_type_idx`(`component_type`),
    INDEX `template_component_category_idx`(`category`),
    INDEX `template_component_tenant_id_idx`(`tenant_id`),
    INDEX `template_component_is_global_is_active_idx`(`is_global`, `is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: template_usage_log
CREATE TABLE `template_usage_log` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `quote_id` VARCHAR(36) NULL,
    `event_type` VARCHAR(50) NOT NULL,
    `render_time_ms` INT NULL,
    `pdf_generation_time_ms` INT NULL,
    `pdf_size_kb` INT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `template_usage_log_template_id_created_at_idx`(`template_id`, `created_at`),
    INDEX `template_usage_log_tenant_id_created_at_idx`(`tenant_id`, `created_at`),
    INDEX `template_usage_log_event_type_created_at_idx`(`event_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex: quote_template
CREATE INDEX `quote_template_category_id_idx` ON `quote_template`(`category_id`);
CREATE INDEX `quote_template_template_type_idx` ON `quote_template`(`template_type`);
CREATE INDEX `quote_template_is_prebuilt_idx` ON `quote_template`(`is_prebuilt`);

-- AddForeignKey
ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `template_category`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `quote_template` ADD CONSTRAINT `quote_template_source_template_id_fkey` FOREIGN KEY (`source_template_id`) REFERENCES `quote_template`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `template_component` ADD CONSTRAINT `template_component_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `template_component` ADD CONSTRAINT `template_component_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quote_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `template_usage_log` ADD CONSTRAINT `template_usage_log_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
