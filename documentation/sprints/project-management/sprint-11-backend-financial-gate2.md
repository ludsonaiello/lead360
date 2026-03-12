# Sprint 11 — Financial Gate 2: Receipt Entity + ReceiptService + API + Tests + Docs

## Sprint Goal
Deliver the receipt entity with file upload via FilesService, receipt-to-financial-entry linking, and complete API. This opens Financial Gate 2, unblocking receipt capture on project tasks.

## Phase
BACKEND

## Module
Financial (Project-Scoped)

## Gate Status
OPENS_FINANCIAL_GATE_2

## Prerequisites
- Sprint 06 must be complete (reason: financial_entry table must exist, FinancialModule registered)

## Codebase Reference
- Module path: `api/src/modules/financial/`
- FilesService: `import { FilesService } from '../../files/files.service';`
- FilesModule: `import { FilesModule } from '../files/files.module';`
- FileCategory for receipts: `receipt`
- AuditLoggerService + AuditModule
- TenantId, Guards

## Tasks

### Task 11.1 — Add receipt model to Prisma schema
**Type**: Schema
**Complexity**: Medium

**Enums to create**:
```
enum receipt_file_type {
  photo
  pdf
}

enum receipt_ocr_status {
  not_processed
  processing
  complete
  failed
}
```

**Field Table — receipt**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| financial_entry_id | String? @db.VarChar(36) | yes | null | FK → financial_entry. Null before categorization. |
| project_id | String? @db.VarChar(36) | yes | null | FK → project |
| task_id | String? @db.VarChar(36) | yes | null | FK → project_task |
| file_id | String @db.VarChar(36) | no | — | FK → file table |
| file_url | String @db.VarChar(500) | no | — | Nginx-served URL. FileCategory: receipt |
| file_name | String @db.VarChar(255) | no | — | Original filename |
| file_type | receipt_file_type | no | — | photo or pdf |
| file_size_bytes | Int? | yes | null | From FilesService response |
| vendor_name | String? @db.VarChar(200) | yes | null | Manually entered |
| amount | Decimal? @db.Decimal(12, 2) | yes | null | Manually entered |
| receipt_date | DateTime? @db.Date | yes | null | Manually entered |
| ocr_raw | String? @db.Text | yes | null | RESERVED — not processed Phase 1 |
| ocr_status | receipt_ocr_status | no | not_processed | @default(not_processed) |
| ocr_vendor | String? @db.VarChar(200) | yes | null | RESERVED |
| ocr_amount | Decimal? @db.Decimal(12, 2) | yes | null | RESERVED |
| ocr_date | DateTime? @db.Date | yes | null | RESERVED |
| is_categorized | Boolean | no | false | @default(false). True when linked to entry. |
| uploaded_by_user_id | String @db.VarChar(36) | no | — | FK → user |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@index([tenant_id, financial_entry_id]), @@index([tenant_id, project_id]), @@index([tenant_id, task_id]), @@index([tenant_id, is_categorized]), @@index([tenant_id, created_at(sort: Desc)]) — for chronological receipt listing
**Map**: @@map("receipt")

**Relations**: tenant (Cascade), financial_entry (SetNull), uploaded_by (Restrict). Add reverse to financial_entry model (receipt receipt?).

**Acceptance Criteria**:
- [ ] receipt model with all 22 fields
- [ ] Enums created
- [ ] All indexes defined

**Files Expected**: api/prisma/schema.prisma (modified)
**Blocker**: NONE

---

### Task 11.2 — Migration
**Type**: Migration
**Complexity**: Low

**Acceptance Criteria**:
- [ ] Migration applied, receipt table exists

**Files Expected**: api/prisma/migrations/[timestamp]_add_receipt/migration.sql
**Blocker**: Task 11.1

---

### Task 11.3 — DTOs + ReceiptService + Controller
**Type**: DTO + Service + Controller
**Complexity**: High

**ReceiptService methods**:
1. **uploadReceipt(tenantId, userId, file, dto: { project_id?, task_id?, vendor_name?, amount?, receipt_date? })** — Call FilesService.uploadFile(tenantId, userId, file, { category: 'receipt', entity_type: 'receipt' }). Determine file_type from mime (jpg/png/webp→photo, pdf→pdf). Create receipt with ocr_status='not_processed', is_categorized=false. Max 25MB. Accepted: jpg, png, webp, pdf.
2. **linkReceiptToEntry(tenantId, receiptId, financialEntryId)** — Set receipt.financial_entry_id, is_categorized=true. Set financial_entry.has_receipt=true. Validate one receipt per entry.
3. **updateReceipt(tenantId, receiptId, userId, dto: { vendor_name?, amount?, receipt_date? })** — Update metadata. Audit log.
4. **getProjectReceipts(tenantId, projectId, query: { is_categorized?, page?, limit? })** — Paginated.
5. **getTaskReceipts(tenantId, taskId)** — All receipts for task.

**Controller** — `@Controller('api/v1/financial/receipts')`:
| Method | Path | Roles |
|--------|------|-------|
| POST | /financial/receipts | Owner, Admin, Manager, Bookkeeper, Field (own tasks) |
| GET | /financial/receipts | Owner, Admin, Manager, Bookkeeper |
| PATCH | /financial/receipts/:id/link | Owner, Admin, Manager, Bookkeeper |
| PATCH | /financial/receipts/:id | Owner, Admin, Manager, Bookkeeper |

Query params for GET: project_id, task_id, is_categorized, page, limit

**Receipt response**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "financial_entry_id": null,
  "project_id": "uuid",
  "task_id": null,
  "file_url": "/public/tenant-uuid/files/receipt-uuid.jpg",
  "file_name": "home-depot-receipt.jpg",
  "file_type": "photo",
  "file_size_bytes": 245000,
  "vendor_name": "Home Depot",
  "amount": 125.50,
  "receipt_date": "2026-03-10",
  "ocr_status": "not_processed",
  "is_categorized": false,
  "uploaded_by_user_id": "uuid",
  "created_at": "2026-03-10T14:00:00.000Z"
}
```

Update FinancialModule to add ReceiptService, import FilesModule, register controller.

**Business Rules**:
- Upload uses FilesService with FileCategory 'receipt'
- Max file size 25MB, accepted: jpg, png, webp, pdf
- One receipt links to one financial entry only
- When linked: set is_categorized=true, financial_entry.has_receipt=true
- OCR fields reserved — ocr_status always 'not_processed' in Phase 1
- All queries include where: { tenant_id }

**Acceptance Criteria**:
- [ ] Receipt upload via FilesService working
- [ ] Linking to financial entry working
- [ ] File validation (type, size)
- [ ] All queries include tenant_id

**Files Expected**:
- api/src/modules/financial/dto/upload-receipt.dto.ts (created)
- api/src/modules/financial/dto/update-receipt.dto.ts (created)
- api/src/modules/financial/dto/link-receipt.dto.ts (created)
- api/src/modules/financial/services/receipt.service.ts (created)
- api/src/modules/financial/controllers/receipt.controller.ts (created)
- api/src/modules/financial/financial.module.ts (modified)

**Blocker**: Task 11.2

---

### Task 11.4 — Tests + Documentation
**Type**: Test + Documentation
**Complexity**: Medium

Unit tests, integration tests, REST API docs at `api/documentation/receipt_REST_API.md`.

**Acceptance Criteria**:
- [ ] Tests passing
- [ ] Documentation complete

**Files Expected**:
- api/src/modules/financial/services/receipt.service.spec.ts (created)
- api/test/receipt.e2e-spec.ts (created)
- api/documentation/receipt_REST_API.md (created)

**Blocker**: Task 11.3

---

## Sprint Acceptance Criteria
- [ ] Receipt upload via FilesService working
- [ ] Receipt linking to financial entry working
- [ ] File validation (25MB max, jpg/png/webp/pdf)
- [ ] OCR fields reserved, not processed
- [ ] All queries include tenant_id
- [ ] Tests and docs complete

## Gate Marker
STOP — FINANCIAL GATE 2 IS NOW OPEN. ReceiptService is exported from FinancialModule:
- ReceiptService.uploadReceipt(tenantId, userId, file, dto)
- ReceiptService.linkReceiptToEntry(tenantId, receiptId, financialEntryId)
- ReceiptService.getProjectReceipts(tenantId, projectId)
- ReceiptService.getTaskReceipts(tenantId, taskId)

## Handoff Notes
- Receipts at `/api/v1/financial/receipts`
- ReceiptService exported from FinancialModule
- Receipt → financial_entry is 1:1 link
- OCR is reserved architecture — Phase 2
