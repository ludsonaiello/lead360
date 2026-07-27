-- Add file storage enhancements
-- Phase 1: Extend File model with storage abstraction and optimization fields

-- Add new columns to file table
ALTER TABLE `file`
  ADD COLUMN `original_size_bytes` INT NULL COMMENT 'Original file size before optimization',
  ADD COLUMN `storage_provider` VARCHAR(20) NOT NULL DEFAULT 'local' COMMENT 'Storage backend: local or s3',
  ADD COLUMN `s3_bucket` VARCHAR(100) NULL COMMENT 'S3 bucket name',
  ADD COLUMN `s3_key` VARCHAR(500) NULL COMMENT 'S3 object key/path',
  ADD COLUMN `s3_region` VARCHAR(50) NULL COMMENT 'S3 region',
  ADD COLUMN `has_thumbnail` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether thumbnail was generated',
  ADD COLUMN `thumbnail_path` VARCHAR(500) NULL COMMENT 'Local filesystem path for thumbnail',
  ADD COLUMN `thumbnail_s3_key` VARCHAR(500) NULL COMMENT 'S3 key for thumbnail',
  ADD COLUMN `is_optimized` BOOLEAN NOT NULL DEFAULT FALSE COMMENT 'Whether file was optimized (WebP conversion, compression)',
  ADD COLUMN `optimization_quality` TINYINT NULL COMMENT 'Quality setting used for optimization (1-100)',
  ADD COLUMN `width` INT NULL COMMENT 'Image width in pixels',
  ADD COLUMN `height` INT NULL COMMENT 'Image height in pixels',
  ADD COLUMN `page_count` INT NULL COMMENT 'Number of pages for PDFs';

-- Create indexes for new fields
CREATE INDEX `file_storage_provider_idx` ON `file`(`storage_provider`);
CREATE INDEX `file_has_thumbnail_idx` ON `file`(`has_thumbnail`);
CREATE INDEX `file_is_optimized_idx` ON `file`(`is_optimized`);

-- Create FileShareLink table
CREATE TABLE `file_share_link` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `file_id` VARCHAR(36) NOT NULL,
  `share_token` VARCHAR(64) NOT NULL,
  `password_hash` VARCHAR(255) NULL,
  `expires_at` DATETIME NULL,
  `max_downloads` INT NULL,
  `download_count` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(36) NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_accessed_at` DATETIME NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `file_share_link_share_token_key` (`share_token`),
  INDEX `file_share_link_tenant_id_idx` (`tenant_id`),
  INDEX `file_share_link_file_id_idx` (`file_id`),
  INDEX `file_share_link_created_by_idx` (`created_by`),
  INDEX `file_share_link_expires_at_idx` (`expires_at`),
  INDEX `file_share_link_is_active_idx` (`is_active`),

  CONSTRAINT `file_share_link_file_id_fkey` FOREIGN KEY (`file_id`) REFERENCES `file`(`file_id`) ON DELETE CASCADE,
  CONSTRAINT `file_share_link_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE RESTRICT,
  CONSTRAINT `file_share_link_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create StorageConfig table
CREATE TABLE `storage_config` (
  `id` VARCHAR(36) NOT NULL,
  `tenant_id` VARCHAR(36) NOT NULL,
  `storage_provider` VARCHAR(20) NOT NULL DEFAULT 'local',
  `s3_endpoint` VARCHAR(255) NULL,
  `s3_region` VARCHAR(50) NULL,
  `s3_bucket` VARCHAR(100) NULL,
  `s3_access_key_id` VARCHAR(255) NULL,
  `s3_secret_key` VARCHAR(500) NULL,
  `s3_use_ssl` BOOLEAN NOT NULL DEFAULT TRUE,
  `s3_force_path_style` BOOLEAN NOT NULL DEFAULT FALSE,
  `enable_webp_conversion` BOOLEAN NOT NULL DEFAULT TRUE,
  `webp_quality` TINYINT NOT NULL DEFAULT 85,
  `enable_thumbnails` BOOLEAN NOT NULL DEFAULT TRUE,
  `thumbnail_width` INT NOT NULL DEFAULT 200,
  `thumbnail_height` INT NOT NULL DEFAULT 200,
  `strip_exif` BOOLEAN NOT NULL DEFAULT TRUE,
  `enable_pdf_thumbnails` BOOLEAN NOT NULL DEFAULT TRUE,
  `pdf_thumbnail_quality` TINYINT NOT NULL DEFAULT 80,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `storage_config_tenant_id_key` (`tenant_id`),

  CONSTRAINT `storage_config_tenant_id_fkey` FOREIGN KEY (`tenant_id`) REFERENCES `tenant`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
