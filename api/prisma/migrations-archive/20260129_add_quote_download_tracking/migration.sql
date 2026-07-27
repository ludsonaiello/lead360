-- Create quote_download_log table for tracking PDF downloads
CREATE TABLE `quote_download_log` (
  `id` VARCHAR(36) NOT NULL,
  `quote_id` VARCHAR(36) NOT NULL,
  `public_token` VARCHAR(32) NOT NULL,
  `downloaded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip_address` VARCHAR(45) NULL,
  `device_type` ENUM('desktop', 'mobile', 'tablet', 'unknown') NULL,
  `file_id` VARCHAR(36) NULL,
  `download_type` VARCHAR(20) NOT NULL DEFAULT 'pdf',

  PRIMARY KEY (`id`),
  INDEX `idx_quote_download_quote_id` (`quote_id`, `downloaded_at`),
  INDEX `idx_quote_download_token` (`public_token`),

  CONSTRAINT `fk_quote_download_quote`
    FOREIGN KEY (`quote_id`)
    REFERENCES `quote` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
