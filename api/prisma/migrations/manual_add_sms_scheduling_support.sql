-- Manual Migration: Add SMS Scheduling Support
-- Sprint 4: SMS Scheduling
-- Date: February 13, 2026
--
-- This migration adds scheduled_at and scheduled_by fields to communication_event
-- and adds 'scheduled' and 'cancelled' statuses to communication_status enum

-- Step 1: Add new statuses to communication_status enum
ALTER TABLE `communication_event`
MODIFY COLUMN `status` ENUM('pending', 'scheduled', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked', 'cancelled')
NOT NULL DEFAULT 'pending';

-- Step 2: Add scheduled_at field
ALTER TABLE `communication_event`
ADD COLUMN `scheduled_at` DATETIME(3) NULL AFTER `created_by_user_id`;

-- Step 3: Add scheduled_by field
ALTER TABLE `communication_event`
ADD COLUMN `scheduled_by` VARCHAR(36) NULL AFTER `scheduled_at`;

-- Step 4: Add index for efficient querying of scheduled messages
ALTER TABLE `communication_event`
ADD INDEX `communication_event_tenant_id_status_scheduled_at_idx` (`tenant_id`, `status`, `scheduled_at`);

-- Migration complete
-- You can now:
-- 1. Schedule SMS for future delivery
-- 2. List scheduled SMS sorted by scheduled_at
-- 3. Cancel scheduled SMS before sending
