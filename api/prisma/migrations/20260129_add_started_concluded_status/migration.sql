-- Add 'started' and 'concluded' statuses to quote_status enum
-- These statuses track the project lifecycle after quote approval:
-- - started: Project work has begun
-- - concluded: Project work is complete

ALTER TABLE `quote` MODIFY COLUMN `status`
  ENUM('draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost', 'email_failed')
  NOT NULL DEFAULT 'draft';
