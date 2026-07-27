-- ============================================================================
-- MANUAL MIGRATION: Normalize Phone Numbers to E.164 Format
-- ============================================================================
--
-- Purpose: Fix duplicate Lead creation issue by normalizing all phone numbers
--          to E.164 international format (+[country code][number])
--
-- Issue:   Phone numbers stored in display format like "(978) 896-8047"
--          don't match Twilio's E.164 format "+19788968047", causing
--          duplicate Leads to be created on SMS keyword detection
--
-- Fix:     Normalize ALL existing phone numbers to E.164 format for
--          consistent matching
--
-- Date:    February 13, 2026
-- Author:  AI Developer
--
-- IMPORTANT:
-- - Backup database before running!
-- - Test on staging first!
-- - This is a ONE-TIME migration
-- - Can be run AFTER deploying the code fix (code is backward compatible)
--
-- ============================================================================

-- Step 1: Create backup table (for safety)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_phone_backup_20260213 AS
SELECT * FROM lead_phone;

SELECT 'Backup created: lead_phone_backup_20260213' AS status;
SELECT COUNT(*) AS backup_row_count FROM lead_phone_backup_20260213;

-- Step 2: Show current phone formats BEFORE migration
-- ============================================================================
SELECT 'BEFORE MIGRATION - Phone Formats' AS report;
SELECT
  CASE
    WHEN phone LIKE '+1%' AND LENGTH(phone) = 12 THEN 'E.164 US (+1)'
    WHEN phone LIKE '+%' THEN 'E.164 International'
    WHEN phone REGEXP '^\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}$' THEN 'US Display: (XXX) XXX-XXXX'
    WHEN phone REGEXP '^[0-9]{3}-[0-9]{3}-[0-9]{4}$' THEN 'US Dashes: XXX-XXX-XXXX'
    WHEN phone REGEXP '^[0-9]{10}$' THEN 'US Numeric: XXXXXXXXXX'
    ELSE 'Unknown Format'
  END AS format_type,
  COUNT(*) as count,
  GROUP_CONCAT(DISTINCT phone SEPARATOR ', ') AS examples
FROM lead_phone
GROUP BY format_type
ORDER BY count DESC;

-- Step 3: Normalize US phones in display format
-- Pattern: (978) 896-8047 → +19788968047
-- ============================================================================
SELECT 'Normalizing: (XXX) XXX-XXXX format' AS step;

UPDATE lead_phone
SET phone = CONCAT('+1', REGEXP_REPLACE(phone, '[^0-9]', ''))
WHERE phone REGEXP '^\\([0-9]{3}\\) [0-9]{3}-[0-9]{4}$'
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) = 10;

SELECT ROW_COUNT() AS rows_updated_display_format;

-- Step 4: Normalize US phones with dashes
-- Pattern: 978-896-8047 → +19788968047
-- ============================================================================
SELECT 'Normalizing: XXX-XXX-XXXX format' AS step;

UPDATE lead_phone
SET phone = CONCAT('+1', REGEXP_REPLACE(phone, '[^0-9]', ''))
WHERE phone REGEXP '^[0-9]{3}-[0-9]{3}-[0-9]{4}$'
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) = 10;

SELECT ROW_COUNT() AS rows_updated_dash_format;

-- Step 5: Normalize US phones with dots
-- Pattern: 978.896.8047 → +19788968047
-- ============================================================================
SELECT 'Normalizing: XXX.XXX.XXXX format' AS step;

UPDATE lead_phone
SET phone = CONCAT('+1', REGEXP_REPLACE(phone, '[^0-9]', ''))
WHERE phone REGEXP '^[0-9]{3}\\.[0-9]{3}\\.[0-9]{4}$'
  AND phone NOT LIKE '+%'
  AND LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '')) = 10;

SELECT ROW_COUNT() AS rows_updated_dot_format;

-- Step 6: Normalize US phones with no formatting (10 digits)
-- Pattern: 9788968047 → +19788968047
-- ============================================================================
SELECT 'Normalizing: XXXXXXXXXX format (10 digits)' AS step;

UPDATE lead_phone
SET phone = CONCAT('+1', phone)
WHERE phone REGEXP '^[0-9]{10}$'
  AND phone NOT LIKE '+%';

SELECT ROW_COUNT() AS rows_updated_numeric_format;

-- Step 7: Normalize US phones with country code but no plus
-- Pattern: 19788968047 → +19788968047
-- ============================================================================
SELECT 'Normalizing: 1XXXXXXXXXX format (11 digits)' AS step;

UPDATE lead_phone
SET phone = CONCAT('+', phone)
WHERE phone REGEXP '^1[0-9]{10}$'
  AND phone NOT LIKE '+%';

SELECT ROW_COUNT() AS rows_updated_country_code_format;

-- Step 8: Show phone formats AFTER migration
-- ============================================================================
SELECT 'AFTER MIGRATION - Phone Formats' AS report;
SELECT
  CASE
    WHEN phone LIKE '+1%' AND LENGTH(phone) = 12 THEN 'E.164 US (+1)'
    WHEN phone LIKE '+%' THEN 'E.164 International'
    ELSE 'Legacy Format (NEEDS MANUAL FIX)'
  END AS format_type,
  COUNT(*) as count,
  GROUP_CONCAT(DISTINCT phone SEPARATOR ', ') AS examples
FROM lead_phone
GROUP BY format_type
ORDER BY count DESC;

-- Step 9: Identify any phones that still need manual fixing
-- ============================================================================
SELECT 'Phones needing manual review:' AS report;
SELECT
  lp.id,
  lp.lead_id,
  lp.phone,
  l.first_name,
  l.last_name,
  l.tenant_id
FROM lead_phone lp
JOIN lead l ON lp.lead_id = l.id
WHERE lp.phone NOT LIKE '+%'
ORDER BY l.tenant_id, lp.phone;

-- Step 10: Show migration summary
-- ============================================================================
SELECT 'MIGRATION SUMMARY' AS report;
SELECT
  (SELECT COUNT(*) FROM lead_phone WHERE phone LIKE '+%') AS normalized_count,
  (SELECT COUNT(*) FROM lead_phone WHERE phone NOT LIKE '+%') AS legacy_count,
  (SELECT COUNT(*) FROM lead_phone) AS total_count,
  CONCAT(
    ROUND(
      (SELECT COUNT(*) FROM lead_phone WHERE phone LIKE '+%') * 100.0 /
      (SELECT COUNT(*) FROM lead_phone),
      2
    ),
    '%'
  ) AS normalized_percentage;

-- Step 11: Validation checks
-- ============================================================================
SELECT 'VALIDATION CHECKS' AS report;

-- Check for duplicates (same normalized phone for same lead)
SELECT 'Checking for duplicate phones per lead' AS check_name;
SELECT lead_id, phone, COUNT(*) as duplicate_count
FROM lead_phone
GROUP BY lead_id, phone
HAVING COUNT(*) > 1;

-- Check for invalid E.164 format
SELECT 'Checking for invalid E.164 format' AS check_name;
SELECT phone, COUNT(*) as count
FROM lead_phone
WHERE phone LIKE '+%'
  AND (
    LENGTH(phone) < 8 OR  -- Too short
    LENGTH(phone) > 16 OR -- Too long (E.164 max is +[country][number] = 15 chars + 1 for +)
    phone NOT REGEXP '^\\+[1-9][0-9]{6,14}$' -- Must be + followed by digits
  )
GROUP BY phone;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
--
-- If migration causes issues, restore from backup:
--
-- TRUNCATE TABLE lead_phone;
-- INSERT INTO lead_phone SELECT * FROM lead_phone_backup_20260213;
--
-- After restoring, the code fix will still work (it handles both formats)
-- ============================================================================

-- ============================================================================
-- POST-MIGRATION CLEANUP (Optional - run after verifying everything works)
-- ============================================================================
--
-- After 7 days of stable operation, you can drop the backup:
-- DROP TABLE lead_phone_backup_20260213;
-- ============================================================================
