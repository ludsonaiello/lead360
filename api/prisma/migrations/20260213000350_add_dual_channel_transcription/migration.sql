-- Add default_language to tenant table
ALTER TABLE `tenant` ADD COLUMN `default_language` VARCHAR(10) NULL AFTER `timezone`;

-- Add dual-channel transcription fields to call_transcription table
ALTER TABLE `call_transcription`
  ADD COLUMN `channel_count` TINYINT NULL AFTER `transcription_text`,
  ADD COLUMN `speaker_1_transcription` TEXT NULL AFTER `channel_count`,
  ADD COLUMN `speaker_2_transcription` TEXT NULL AFTER `speaker_1_transcription`,
  ADD COLUMN `speaker_1_label` VARCHAR(50) NULL AFTER `speaker_2_transcription`,
  ADD COLUMN `speaker_2_label` VARCHAR(50) NULL AFTER `speaker_1_label`,
  ADD COLUMN `language_requested` VARCHAR(10) NULL AFTER `speaker_2_label`;
