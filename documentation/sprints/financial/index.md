# Financial Module — Sprint Index

## F-01 — Financial Module Foundation Migration

| Sprint | File | Title |
|--------|------|-------|
| 1.1 | `fs01-backend-1-schema-migration-enums-model-fields-indexes-data-seed.md` | Schema Migration: Enums, Model Fields, Indexes, and Data Seed |
| 1.2 | `fs01-backend-2-dto-updates-optional-project-id-new-fields-category-classification.md` | DTO Updates: Optional project_id, New Fields, Category Classification |
| 1.3 | `fs01-backend-3-service-logic-nullable-project-id-classification-tax-validation.md` | Service Logic: Nullable project_id, Classification, Tax Validation |
| 1.4 | `fs01-backend-4-unit-tests-updated-mocks-new-scenarios-full-coverage.md` | Unit Tests: Updated Mocks, New Scenarios, Full Coverage |
| 1.5 | `fs01-backend-5-verification-gate-api-documentation.md` | Verification Gate + API Documentation |

---

## F-02 — Supplier Registry

| Sprint | File | Title |
|--------|------|-------|
| 2.1 | `fs02-backend-1-schema-migration-supplier-registry-tables-financial-entry-fk.md` | Schema Migration: Supplier Registry Tables + Financial Entry FK |
| 2.2 | `fs02-backend-2-dtos-supplier-category-supplier-supplier-product-validation.md` | DTOs: Supplier Category, Supplier, and Supplier Product Validation |
| 2.3 | `fs02-backend-3-service-layer-supplier-category-service.md` | Service Layer: SupplierCategoryService |
| 2.4 | `fs02-backend-4-service-layer-supplier-service.md` | Service Layer: SupplierService |
| 2.5 | `fs02-backend-5-service-layer-supplier-product-service.md` | Service Layer: SupplierProductService |
| 2.6 | `fs02-backend-6-controllers-module-registration-tenant-isolation.md` | Controllers + Module Registration + Tenant Isolation |
| 2.7 | `fs02-backend-7-financial-entry-integration-supplier-spend-tracking.md` | Financial Entry Integration: Supplier Spend Tracking |
| 2.8 | `fs02-backend-8-unit-tests-integration-tests.md` | Unit Tests + Integration Tests |
| 2.9 | `fs02-backend-9-verification-gate-api-documentation.md` | Verification Gate + API Documentation (FINAL STOP GATE) |

---

## F-03 — Payment Method Registry

| Sprint | File | Title |
|--------|------|-------|
| 3.1 | `fs03-backend-1-schema-migration-payment-method-registry-table-financial-entry-fk.md` | Schema Migration: payment_method_registry Table + financial_entry FK Relation |
| 3.2 | `fs03-backend-2-dtos-payment-method-registry-create-update-list.md` | DTOs: Payment Method Registry Create, Update, and List |
| 3.3 | `fs03-backend-3-service-layer-payment-method-registry-service.md` | Service Layer: PaymentMethodRegistryService |
| 3.4 | `fs03-backend-4-controller-module-registration-payment-method-registry-controller.md` | Controller + Module Registration: PaymentMethodRegistryController |
| 3.5 | `fs03-backend-5-financial-entry-auto-copy-integration.md` | Financial Entry Auto-Copy Integration |
| 3.6 | `fs03-backend-6-unit-tests-payment-method-registry-service.md` | Unit Tests: PaymentMethodRegistryService |
| 3.7 | `fs03-backend-7-api-documentation-final-verification.md` | API Documentation + Final Verification (STOP Gate) |

---

## F-04 — General Expense Entry Engine

| Sprint | File | Title |
|--------|------|-------|
| 4.1 | `fs04-backend-1-schema-migration-rejection-fields.md` | Schema Migration: Rejection Fields |
| 4.2 | `fs04-backend-2-dtos-create-update-list-query-approve-reject-resubmit.md` | DTOs: Create, Update, List Query, Approve, Reject, Resubmit |
| 4.3 | `fs04-backend-3-service-layer-part-1-enriched-query-builder-read-operations.md` | Service Layer Part 1: Enriched Query Builder + Read Operations |
| 4.4 | `fs04-backend-4-service-layer-part-2-create-update-delete-role-logic-hooks.md` | Service Layer Part 2: Create + Update + Delete with Role Logic & Hooks |
| 4.5 | `fs04-backend-5-service-layer-part-3-approve-reject-resubmit-csv-export.md` | Service Layer Part 3: Approve + Reject + Resubmit + CSV Export |
| 4.6 | `fs04-backend-6-controller-module-registration-swagger-documentation.md` | Controller + Module Registration + Swagger Documentation |
| 4.7 | `fs04-backend-7-unit-tests-financial-entry-service.md` | Unit Tests for FinancialEntryService |
| 4.8 | `fs04-backend-8-api-documentation.md` | API Documentation |
| 4.9 | `fs04-backend-9-final-verification-gate.md` | Final Verification Gate (FINAL STOP) |

---

## F-05 — Receipt OCR

| Sprint | File | Title |
|--------|------|-------|
| 5.1 | `fs05-backend-1-ocr-service-core-google-vision-api-text-parsing.md` | OcrService Core (Google Vision API + Text Parsing Logic) |
| 5.2 | `fs05-backend-2-bullmq-queue-registration-ocr-processor.md` | BullMQ Queue Registration + OCR Processor |
| 5.3 | `fs05-backend-3-receipt-service-updates-dto-ocr-enqueue-status-retry.md` | Receipt Service Updates + DTO (OCR Enqueue, Status, Retry, Create-Entry) |
| 5.4 | `fs05-backend-4-controller-endpoints-swagger-ocr-status-create-entry-retry.md` | Controller Endpoints + Swagger (OCR Status, Create-Entry, Retry-OCR) |
| 5.5 | `fs05-backend-5-unit-tests-ocr-parsing-amount-date-extraction-failure-paths.md` | Unit Tests (OCR Parsing, Amount Extraction, Date Extraction, Failure Paths) |
| 5.6 | `fs05-backend-6-api-documentation-integration-verification-final-stop-gate.md` | API Documentation + Integration Verification + Final STOP Gate |

---

## F-06 — Recurring Expense Engine

| Sprint | File | Title |
|--------|------|-------|
| 6.1 | `fs06-backend-1-schema-migration-recurring-expense-rule-table-enums-relation.md` | Schema Migration: recurring_expense_rule Table + Enums + Relation |
| 6.2 | `fs06-backend-2-dtos-validation-recurring-expense-rules.md` | DTOs + Validation for Recurring Expense Rules |
| 6.3 | `fs06-backend-3-service-layer-core-crud-calculate-next-due-date.md` | Service Layer Core: CRUD + calculateNextDueDate |
| 6.4 | `fs06-backend-4-service-layer-lifecycle-pause-resume-skip-trigger-process-preview-history.md` | Service Layer Lifecycle: pause/resume/skip/trigger/processRule/preview/history |
| 6.5 | `fs06-backend-5-controller-swagger-all-11-endpoints.md` | Controller + Swagger: All 11 Endpoints |
| 6.6 | `fs06-backend-6-bullmq-scheduler-processor-module-wiring.md` | BullMQ Scheduler + Processor + Module Wiring |
| 6.7 | `fs06-backend-7-unit-tests-recurring-expense-engine.md` | Unit Tests for Recurring Expense Engine |
| 6.8 | `fs06-backend-8-api-documentation-final-gate-verification.md` | API Documentation + Final Gate Verification |

---

## F-07 — Project Financial Intelligence

| Sprint | File | Title |
|--------|------|-------|
| 7.1 | `fs07-backend-1-prerequisite-migration-classification-submission-status-tax-amount.md` | Prerequisite Migration: Classification, Submission Status, and Tax Amount Fields |
| 7.2 | `fs07-backend-2-dtos-project-financial-summary-endpoints.md` | DTOs for Project Financial Summary Endpoints |
| 7.3 | `fs07-backend-3-service-part-1-validate-project-access-get-full-summary.md` | Service Part 1: validateProjectAccess + getFullSummary |
| 7.4 | `fs07-backend-4-service-part-2-task-breakdown-timeline-receipts-workforce-summary.md` | Service Part 2: getTaskBreakdown + getTimeline + getReceipts + getWorkforceSummary |
| 7.5 | `fs07-backend-5-controller-rebuild-module-registration-swagger.md` | Controller Rebuild + Module Registration + Swagger |
| 7.6 | `fs07-backend-6-unit-tests.md` | Unit Tests |
| 7.7 | `fs07-backend-7-api-documentation-final-verification.md` | API Documentation + Final Verification (STOP GATE) |

---

## F-08 — Draw Schedule to Invoice Automation

| Sprint | File | Title |
|--------|------|-------|
| 8.1 | `fs08-backend-1-schema-migration-draw-milestone-project-invoice-invoice-payment.md` | Schema Migration: Draw Milestone + Project Invoice + Invoice Payment |
| 8.2 | `fs08-backend-2-dtos-invoice-number-generator-service.md` | DTOs + Invoice Number Generator Service |
| 8.3 | `fs08-backend-3-draw-milestone-service.md` | Draw Milestone Service |
| 8.4 | `fs08-backend-4-project-invoice-service.md` | Project Invoice Service |
| 8.5 | `fs08-backend-5-draw-milestone-controller.md` | Draw Milestone Controller |
| 8.6 | `fs08-backend-6-project-invoice-controller.md` | Project Invoice Controller |
| 8.7 | `fs08-backend-7-module-registration-project-service-integration.md` | Module Registration + Project Service Integration |
| 8.8 | `fs08-backend-8-f07-revenue-addendum-project-financial-summary.md` | F-07 Revenue Addendum: Project Financial Summary |
| 8.9 | `fs08-backend-9-integration-tests-api-documentation-final-stop-gate.md` | Integration Tests + API Documentation + Final STOP Gate |

---

## F-09 — Business Financial Dashboard

| Sprint | File | Title |
|--------|------|-------|
| 9.1 | `fs09-backend-1-dtos-dashboard-service-pnl-method.md` | DTOs + DashboardService — P&L Method |
| 9.2 | `fs09-backend-2-dashboard-service-accounts-receivable-accounts-payable.md` | DashboardService — Accounts Receivable + Accounts Payable |
| 9.3 | `fs09-backend-3-dashboard-service-forecast-alerts-overview.md` | DashboardService — Forecast + Alerts + Overview |
| 9.4 | `fs09-backend-4-dashboard-controller-pnl-csv-export-module-registration.md` | DashboardController + P&L CSV Export + Module Registration |
| 9.5 | `fs09-backend-5-unit-tests-dashboard-service.md` | Unit Tests — DashboardService |
| 9.6 | `fs09-backend-6-api-documentation-final-verification.md` | API Documentation + Final Verification (STOP Gate) |

---

## F-10 — QuickBooks/Xero Export Readiness

| Sprint | File | Title |
|--------|------|-------|
| 10.1 | `fs10-backend-1-prerequisite-verification-schema-migration.md` | Prerequisite Verification + Schema Migration |
| 10.2 | `fs10-backend-2-dtos-and-validation.md` | DTOs and Validation |
| 10.3 | `fs10-backend-3-account-mapping-service.md` | AccountMappingService |
| 10.4 | `fs10-backend-4-export-service-part-1-core-helpers-quickbooks-exports.md` | ExportService Part 1: Core Helpers + QuickBooks Exports |
| 10.5 | `fs10-backend-5-export-service-part-2-xero-exports.md` | ExportService Part 2: Xero Exports |
| 10.6 | `fs10-backend-6-export-service-part-3-quality-report-export-history.md` | ExportService Part 3: Quality Report + Export History |
| 10.7 | `fs10-backend-7-controllers-module-registration.md` | Controllers + Module Registration |
| 10.8 | `fs10-backend-8-unit-tests.md` | Unit Tests |
| 10.9 | `fs10-backend-9-api-documentation-final-verification.md` | API Documentation + Final Verification (STOP Gate) |

---

## Summary

| Phase | Title | Sprints |
|-------|-------|---------|
| F-01 | Financial Module Foundation Migration | 5 |
| F-02 | Supplier Registry | 9 |
| F-03 | Payment Method Registry | 7 |
| F-04 | General Expense Entry Engine | 9 |
| F-05 | Receipt OCR | 6 |
| F-06 | Recurring Expense Engine | 8 |
| F-07 | Project Financial Intelligence | 7 |
| F-08 | Draw Schedule to Invoice Automation | 9 |
| F-09 | Business Financial Dashboard | 6 |
| F-10 | QuickBooks/Xero Export Readiness | 9 |
| **Total** | | **75 sprints** |
