-- Add PDF tracking fields to quote table
ALTER TABLE `quote`
ADD COLUMN `latest_pdf_file_id` VARCHAR(36) NULL,
ADD COLUMN `pdf_content_hash` VARCHAR(64) NULL,
ADD COLUMN `pdf_last_generated_at` DATETIME(0) NULL,
ADD COLUMN `pdf_generation_params` JSON NULL;

-- Add index on latest_pdf_file_id for performance
CREATE INDEX `quote_latest_pdf_file_id_idx` ON `quote`(`latest_pdf_file_id`);

-- Add foreign key constraint to file table
ALTER TABLE `quote`
ADD CONSTRAINT `quote_latest_pdf_file_id_fkey`
FOREIGN KEY (`latest_pdf_file_id`)
REFERENCES `file`(`id`)
ON DELETE SET NULL
ON UPDATE CASCADE;
