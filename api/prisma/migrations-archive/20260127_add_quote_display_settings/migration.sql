-- Add display preference settings for quotes
ALTER TABLE `tenant`
ADD COLUMN `show_line_items_by_default` BOOLEAN DEFAULT true,
ADD COLUMN `show_cost_breakdown_by_default` BOOLEAN DEFAULT false;
