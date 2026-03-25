-- AlterTable: Add index on submission_status for financial_entry
CREATE INDEX `financial_entry_tenant_id_submission_status_idx` ON `financial_entry`(`tenant_id`, `submission_status`);
