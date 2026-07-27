-- Manual Migration: Add Transcription Retry Support
-- Date: 2026-02-13
-- Description: Enable retry/redo functionality for transcriptions

-- Step 1: Add new columns to call_transcription with safe defaults
ALTER TABLE `call_transcription`
  ADD COLUMN `is_current` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `retry_count` INT NOT NULL DEFAULT 0,
  ADD COLUMN `previous_transcription_id` VARCHAR(36) NULL;

-- Step 2: Ensure all existing transcriptions are marked as current
UPDATE `call_transcription` SET `is_current` = TRUE WHERE `is_current` IS NULL OR `is_current` = FALSE;

-- Step 3: Drop the unique constraint on call_record_id (if exists)
-- Note: This allows multiple transcriptions per call (for retries)
ALTER TABLE `call_transcription` DROP INDEX `call_transcription_call_record_id_key`;

-- Step 4: Add new composite index for efficient queries
ALTER TABLE `call_transcription` ADD INDEX `call_transcription_call_record_id_is_current_idx` (`call_record_id`, `is_current`);

-- Step 5: Drop transcription_id column from call_record (breaking change - handled by backend logic)
-- First, drop the unique constraint
ALTER TABLE `call_record` DROP INDEX `transcription_id`;
-- Then drop the column
ALTER TABLE `call_record` DROP COLUMN `transcription_id`;

-- Migration complete
-- Next steps:
-- 1. Backend will use call_record.transcriptions[] relation (one-to-many)
-- 2. Queries will filter by is_current = TRUE to get active transcription
-- 3. Retry endpoint will create new transcription and mark old as is_current = FALSE
