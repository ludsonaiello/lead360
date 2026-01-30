-- Add 'opened' and 'clicked' to communication_status enum
-- This migration adds two new status values to track email engagement

-- Update communication_event table to include new enum values
ALTER TABLE `communication_event`
MODIFY COLUMN `status` ENUM('pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked') NOT NULL DEFAULT 'pending';
