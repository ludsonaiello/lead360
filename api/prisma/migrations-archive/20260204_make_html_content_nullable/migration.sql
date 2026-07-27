-- Make html_content nullable since visual templates don't use HTML content
ALTER TABLE `quote_template` MODIFY COLUMN `html_content` LONGTEXT NULL;

-- Make html_content nullable in version table as well
ALTER TABLE `quote_template_version` MODIFY COLUMN `html_content` LONGTEXT NULL;
