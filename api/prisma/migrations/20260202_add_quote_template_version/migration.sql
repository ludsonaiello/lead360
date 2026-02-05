-- CreateTable
CREATE TABLE `quote_template_version` (
    `id` VARCHAR(36) NOT NULL,
    `template_id` VARCHAR(36) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `html_content` LONGTEXT NOT NULL,
    `css_content` LONGTEXT NULL,
    `changes_summary` VARCHAR(500) NULL,
    `created_by_user_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_template_version_template_id_version_number_idx`(`template_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `quote_template_version` ADD CONSTRAINT `quote_template_version_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `quote_template`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_template_version` ADD CONSTRAINT `quote_template_version_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
