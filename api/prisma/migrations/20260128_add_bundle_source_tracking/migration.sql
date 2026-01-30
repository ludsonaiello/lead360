-- Add quote_bundle_id to track source bundle
ALTER TABLE `quote_item`
  ADD COLUMN `quote_bundle_id` VARCHAR(36) NULL AFTER `item_library_id`,
  ADD INDEX `idx_quote_item_bundle_id` (`quote_bundle_id`);

-- Add foreign key constraint
-- Note: No ON DELETE CASCADE - if bundle is deleted, quote items remain
ALTER TABLE `quote_item`
  ADD CONSTRAINT `fk_quote_item_bundle`
    FOREIGN KEY (`quote_bundle_id`)
    REFERENCES `quote_bundle` (`id`)
    ON DELETE SET NULL;
