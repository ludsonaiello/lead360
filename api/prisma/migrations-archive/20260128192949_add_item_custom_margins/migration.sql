-- Add new custom margin fields to quote_item
ALTER TABLE `quote_item`
  ADD COLUMN `custom_profit_percent` DECIMAL(5,2) NULL AFTER `custom_markup_percent`,
  ADD COLUMN `custom_overhead_percent` DECIMAL(5,2) NULL AFTER `custom_profit_percent`,
  ADD COLUMN `custom_contingency_percent` DECIMAL(5,2) NULL AFTER `custom_overhead_percent`,
  ADD COLUMN `custom_discount_percentage` DECIMAL(5,2) NULL AFTER `custom_contingency_percent`;

-- Remove old custom_markup_percent field
ALTER TABLE `quote_item`
  DROP COLUMN `custom_markup_percent`;

-- Add check constraints to ensure percentages are valid (0-100)
ALTER TABLE `quote_item`
  ADD CONSTRAINT `quote_item_custom_profit_percent_check`
    CHECK (`custom_profit_percent` IS NULL OR (`custom_profit_percent` >= 0 AND `custom_profit_percent` <= 100)),
  ADD CONSTRAINT `quote_item_custom_overhead_percent_check`
    CHECK (`custom_overhead_percent` IS NULL OR (`custom_overhead_percent` >= 0 AND `custom_overhead_percent` <= 100)),
  ADD CONSTRAINT `quote_item_custom_contingency_percent_check`
    CHECK (`custom_contingency_percent` IS NULL OR (`custom_contingency_percent` >= 0 AND `custom_contingency_percent` <= 100)),
  ADD CONSTRAINT `quote_item_custom_discount_percentage_check`
    CHECK (`custom_discount_percentage` IS NULL OR (`custom_discount_percentage` >= 0 AND `custom_discount_percentage` <= 100));
