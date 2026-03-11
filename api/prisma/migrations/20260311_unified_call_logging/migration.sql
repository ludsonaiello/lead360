-- Unified Call Logging Migration
-- Links call_record (canonical entry) to voice_call_log (AI metadata)

-- Step 1: Add handled_by and voice_call_log_id to call_record
ALTER TABLE `call_record`
  ADD COLUMN `handled_by` VARCHAR(20) NOT NULL DEFAULT 'direct',
  ADD COLUMN `voice_call_log_id` VARCHAR(36) NULL;

-- Step 2: Add parent_call_sid to voice_call_log
ALTER TABLE `voice_call_log`
  ADD COLUMN `parent_call_sid` VARCHAR(100) NULL;

-- Step 3: Set handled_by based on existing call_type
UPDATE `call_record` SET `handled_by` = 'ivr' WHERE `call_type` = 'ivr_routed_call';
UPDATE `call_record` SET `handled_by` = 'office_bypass' WHERE `call_type` = 'office_bypass_call';
UPDATE `call_record` SET `handled_by` = 'direct' WHERE `call_type` = 'customer_call';

-- Step 4: Retroactively link existing call_record <-> voice_call_log pairs
-- Match by from_number + tenant_id + closest time within 60 seconds (1:1 matching)
UPDATE call_record cr
INNER JOIN (
  SELECT
    vcl.id AS vcl_id,
    (
      SELECT cr2.id FROM call_record cr2
      WHERE cr2.tenant_id = vcl.tenant_id
      AND cr2.from_number = vcl.from_number
      AND cr2.voice_call_log_id IS NULL
      AND ABS(TIMESTAMPDIFF(SECOND, cr2.created_at, vcl.created_at)) < 60
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, cr2.created_at, vcl.created_at)) ASC
      LIMIT 1
    ) AS best_cr_id
  FROM voice_call_log vcl
) AS matched ON cr.id = matched.best_cr_id
SET
  cr.voice_call_log_id = matched.vcl_id,
  cr.handled_by = 'voice_ai';

-- Update parent_call_sid on linked voice_call_logs
UPDATE voice_call_log vcl
INNER JOIN call_record cr ON cr.voice_call_log_id = vcl.id
SET vcl.parent_call_sid = cr.twilio_call_sid;

-- Step 5: Add unique constraint and indexes
ALTER TABLE `call_record`
  ADD UNIQUE INDEX `call_record_voice_call_log_id_key` (`voice_call_log_id`);

CREATE INDEX `call_record_tenant_id_handled_by_idx` ON `call_record` (`tenant_id`, `handled_by`);
CREATE INDEX `voice_call_log_parent_call_sid_idx` ON `voice_call_log` (`parent_call_sid`);

-- Step 6: Add foreign key constraint
ALTER TABLE `call_record`
  ADD CONSTRAINT `call_record_voice_call_log_id_fkey`
  FOREIGN KEY (`voice_call_log_id`) REFERENCES `voice_call_log`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
