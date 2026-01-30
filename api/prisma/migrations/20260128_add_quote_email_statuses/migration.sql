-- Add 'delivered', 'opened', and 'email_failed' to quote_status enum
-- This migration adds new status values to track quote email engagement

-- Update quote table to include new enum values
ALTER TABLE `quote`
MODIFY COLUMN `status` ENUM('draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'approved', 'denied', 'lost', 'email_failed') NOT NULL DEFAULT 'draft';
