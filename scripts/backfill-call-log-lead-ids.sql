-- ============================================================================
-- Backfill: Link voice_call_log and call_record to leads by phone number
--
-- Problem: voice_call_log.lead_id and call_record.lead_id are NULL for all
-- existing records. The voice agent creates/finds leads during calls but
-- never linked the call log back to the lead.
--
-- Strategy:
--   1. Match from_number (E.164: +19788968047) to lead_phone.phone (raw: 9788968047)
--   2. Enforce tenant isolation (same tenant_id)
--   3. Update voice_call_log first, then call_record
--   4. Also propagate lead_id from voice_call_log → linked call_record
--
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- Preview: Show what will be matched (DRY RUN)
SELECT
  'voice_call_log' AS table_name,
  vcl.id,
  vcl.call_sid,
  vcl.from_number,
  vcl.lead_id AS current_lead_id,
  lp.lead_id AS matched_lead_id,
  l.first_name,
  l.last_name
FROM voice_call_log vcl
JOIN lead_phone lp ON REPLACE(REPLACE(vcl.from_number, '+1', ''), '+', '') = lp.phone
JOIN lead l ON lp.lead_id = l.id AND l.tenant_id = vcl.tenant_id
WHERE vcl.lead_id IS NULL;

SELECT
  'call_record' AS table_name,
  cr.id,
  cr.twilio_call_sid,
  cr.from_number,
  cr.lead_id AS current_lead_id,
  lp.lead_id AS matched_lead_id,
  l.first_name,
  l.last_name
FROM call_record cr
JOIN lead_phone lp ON REPLACE(REPLACE(cr.from_number, '+1', ''), '+', '') = lp.phone
JOIN lead l ON lp.lead_id = l.id AND l.tenant_id = cr.tenant_id
WHERE cr.lead_id IS NULL;

-- ============================================================================
-- Step 1: Update voice_call_log.lead_id
-- ============================================================================
UPDATE voice_call_log vcl
JOIN lead_phone lp ON REPLACE(REPLACE(vcl.from_number, '+1', ''), '+', '') = lp.phone
JOIN lead l ON lp.lead_id = l.id AND l.tenant_id = vcl.tenant_id
SET vcl.lead_id = lp.lead_id
WHERE vcl.lead_id IS NULL;

SELECT ROW_COUNT() AS voice_call_log_rows_updated;

-- ============================================================================
-- Step 2: Update call_record.lead_id by direct phone match
-- ============================================================================
UPDATE call_record cr
JOIN lead_phone lp ON REPLACE(REPLACE(cr.from_number, '+1', ''), '+', '') = lp.phone
JOIN lead l ON lp.lead_id = l.id AND l.tenant_id = cr.tenant_id
SET cr.lead_id = lp.lead_id
WHERE cr.lead_id IS NULL;

SELECT ROW_COUNT() AS call_record_rows_updated_by_phone;

-- ============================================================================
-- Step 3: Propagate lead_id from voice_call_log → linked call_record
-- (For voice_ai-handled calls that might not match by phone directly)
-- ============================================================================
UPDATE call_record cr
JOIN voice_call_log vcl ON cr.voice_call_log_id = vcl.id
SET cr.lead_id = vcl.lead_id
WHERE cr.lead_id IS NULL
  AND vcl.lead_id IS NOT NULL;

SELECT ROW_COUNT() AS call_record_rows_updated_by_vcl_link;

-- ============================================================================
-- Verification: Check results
-- ============================================================================
SELECT 'voice_call_log' AS table_name,
  COUNT(*) AS total,
  SUM(CASE WHEN lead_id IS NOT NULL THEN 1 ELSE 0 END) AS with_lead,
  SUM(CASE WHEN lead_id IS NULL THEN 1 ELSE 0 END) AS without_lead
FROM voice_call_log
UNION ALL
SELECT 'call_record',
  COUNT(*),
  SUM(CASE WHEN lead_id IS NOT NULL THEN 1 ELSE 0 END),
  SUM(CASE WHEN lead_id IS NULL THEN 1 ELSE 0 END)
FROM call_record;
