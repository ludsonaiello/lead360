-- Add custom_tax_rate field to quote table
ALTER TABLE `quote`
  ADD COLUMN `custom_tax_rate` DECIMAL(5,2) NULL AFTER `custom_contingency_percent`;

-- Add check constraint to ensure custom_tax_rate is valid (0-100)
ALTER TABLE `quote`
  ADD CONSTRAINT `quote_custom_tax_rate_check`
    CHECK (`custom_tax_rate` IS NULL OR (`custom_tax_rate` >= 0 AND `custom_tax_rate` <= 100));
