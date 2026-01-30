-- Remove custom_tax_rate from quote_item (tax is quote-level only)
ALTER TABLE `quote_item`
  DROP COLUMN `custom_tax_rate`;
