-- Add parent_quote_id to quote table for change order support
-- This replaces the temporary hack of storing parent ID in private_notes

-- Step 1: Add nullable parent_quote_id column
ALTER TABLE `quote`
ADD COLUMN `parent_quote_id` VARCHAR(36) NULL
AFTER `latest_pdf_file_id`;

-- Step 2: Migrate existing change orders (extract parent ID from private_notes)
-- IMPORTANT: Do this BEFORE adding foreign key constraint
-- Pattern in private_notes: "PARENT_QUOTE_ID:{uuid}\n..."
-- Extract UUID between 'PARENT_QUOTE_ID:' and newline
UPDATE `quote`
SET `parent_quote_id` = SUBSTRING_INDEX(
  SUBSTRING_INDEX(`private_notes`, 'PARENT_QUOTE_ID:', -1),
  CHAR(10),
  1
)
WHERE `private_notes` LIKE '%PARENT_QUOTE_ID:%'
  AND `quote_number` LIKE 'CO-%'
  AND `private_notes` IS NOT NULL;

-- Step 3: Clean up private_notes (remove PARENT_QUOTE_ID: prefix line)
-- This removes the PARENT_QUOTE_ID line but keeps other notes
UPDATE `quote`
SET `private_notes` = TRIM(BOTH '\n' FROM REPLACE(
  `private_notes`,
  CONCAT('PARENT_QUOTE_ID:', `parent_quote_id`),
  ''
))
WHERE `parent_quote_id` IS NOT NULL
  AND `private_notes` LIKE '%PARENT_QUOTE_ID:%';

-- Step 4: Set empty private_notes to NULL for cleanliness
UPDATE `quote`
SET `private_notes` = NULL
WHERE `private_notes` = ''
  OR `private_notes` = '\n'
  OR TRIM(`private_notes`) = '';

-- Step 5: Add foreign key constraint (ON DELETE RESTRICT prevents orphaned COs)
-- Only add constraint after data migration to ensure referential integrity
ALTER TABLE `quote`
ADD CONSTRAINT `quote_parent_quote_id_fkey`
FOREIGN KEY (`parent_quote_id`)
REFERENCES `quote`(`id`)
ON DELETE RESTRICT
ON UPDATE CASCADE;

-- Step 6: Add index for fast CO lookup by parent
CREATE INDEX `quote_tenant_id_parent_quote_id_idx`
ON `quote`(`tenant_id`, `parent_quote_id`);
