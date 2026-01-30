-- Add 'downloaded' status to quote_status enum
-- This status indicates that the customer has downloaded the quote PDF

ALTER TABLE `quote` MODIFY COLUMN `status`
  ENUM('draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'denied', 'lost', 'email_failed')
  NOT NULL DEFAULT 'draft';
