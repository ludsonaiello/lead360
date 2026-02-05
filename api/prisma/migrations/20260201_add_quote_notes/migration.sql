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

-- AddForeignKey
ALTER TABLE `quote_note` ADD CONSTRAINT `quote_note_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_note` ADD CONSTRAINT `quote_note_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
