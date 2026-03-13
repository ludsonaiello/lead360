# Receipt REST API

**Module**: Financial (Project-Scoped)
**Sprint**: 11 — Financial Gate 2
**Base URL**: `/api/v1/financial/receipts`
**Authentication**: Bearer JWT required on all endpoints
**Multi-Tenant**: All queries are scoped to `tenant_id` derived from the JWT

---

## Overview

The Receipt API enables receipt capture linked to projects and financial entries.
Phase 1 behaviour:

- OCR fields (`ocr_vendor`, `ocr_amount`, `ocr_date`) are **reserved** — always returned as `null`
- `ocr_status` is always `not_processed` on upload
- Receipt → Financial Entry linking is **1:1** and irreversible in Phase 1

---

## Receipt Object

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-0000-0000-0000-000000000001",
  "financial_entry_id": null,
  "project_id": "p1p2p3p4-0000-0000-0000-000000000001",
  "task_id": null,
  "file_id": "f1f2f3f4-0000-0000-0000-000000000001",
  "file_url": "/public/t1t2t3t4-0000-0000-0000-000000000001/files/f1f2f3f4.jpg",
  "file_name": "home-depot-receipt.jpg",
  "file_type": "photo",
  "file_size_bytes": 245000,
  "vendor_name": "Home Depot",
  "amount": 125.50,
  "receipt_date": "2026-03-10T00:00:00.000Z",
  "ocr_status": "not_processed",
  "ocr_vendor": null,
  "ocr_amount": null,
  "ocr_date": null,
  "is_categorized": false,
  "uploaded_by_user_id": "u1u2u3u4-0000-0000-0000-000000000001",
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-10T14:00:00.000Z"
}
```

### Field Reference

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | UUID | no | Primary key |
| `tenant_id` | UUID | no | Owning tenant |
| `financial_entry_id` | UUID | **yes** | Linked financial entry (null until categorized) |
| `project_id` | UUID | **yes** | Associated project |
| `task_id` | UUID | **yes** | Associated task |
| `file_id` | UUID | no | Reference to `file.file_id` |
| `file_url` | string | no | Nginx-served URL for the file |
| `file_name` | string | no | Original filename at upload time |
| `file_type` | `"photo"` \| `"pdf"` | no | Derived from MIME type at upload |
| `file_size_bytes` | integer | **yes** | File size in bytes |
| `vendor_name` | string | **yes** | Manually entered vendor name |
| `amount` | decimal | **yes** | Manually entered amount (USD) |
| `receipt_date` | date | **yes** | Manually entered receipt date |
| `ocr_status` | enum | no | `not_processed` \| `processing` \| `complete` \| `failed` |
| `ocr_vendor` | string | **yes** | **RESERVED (Phase 2)** — always `null` |
| `ocr_amount` | decimal | **yes** | **RESERVED (Phase 2)** — always `null` |
| `ocr_date` | date | **yes** | **RESERVED (Phase 2)** — always `null` |
| `is_categorized` | boolean | no | `true` once linked to a financial entry |
| `uploaded_by_user_id` | UUID | no | User who uploaded |
| `created_at` | ISO datetime | no | Upload timestamp |
| `updated_at` | ISO datetime | no | Last update timestamp |

---

## Endpoints

---

### POST `/api/v1/financial/receipts`

**Description**: Upload a receipt file. Associates it with a project/task at upload time.

**Roles**: Owner, Admin, Manager, Bookkeeper, Field

**Content-Type**: `multipart/form-data`

**Form Fields**:

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `file` | **yes** | binary | Receipt image or PDF. Max **25 MB**. Accepted: `jpg`, `png`, `webp`, `pdf` |
| `project_id` | no | UUID | Project to associate receipt with |
| `task_id` | no | UUID | Task to associate receipt with. If provided without `project_id`, project is auto-resolved. |
| `vendor_name` | no | string (max 200) | Vendor name |
| `amount` | no | number | Amount in USD (max 2 decimal places) |
| `receipt_date` | no | ISO date (`YYYY-MM-DD`) | Date on the receipt |

**Business Rules**:
- `file_type` is derived automatically: `jpg/png/webp` → `photo`, `pdf` → `pdf`
- If `task_id` is provided, the task must belong to the tenant
- If both `project_id` and `task_id` are provided, the task must belong to that project
- `ocr_status` is always set to `not_processed` (Phase 1)
- `is_categorized` is always `false` on upload

**cURL Example**:
```bash
curl -X POST https://api.lead360.app/api/v1/financial/receipts \
  -H "Authorization: Bearer <token>" \
  -F "file=@home-depot-receipt.jpg;type=image/jpeg" \
  -F "project_id=p1p2p3p4-0000-0000-0000-000000000001" \
  -F "vendor_name=Home Depot" \
  -F "amount=125.50" \
  -F "receipt_date=2026-03-10"
```

**Response 201 — Created**:
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-...",
  "financial_entry_id": null,
  "project_id": "p1p2p3p4-...",
  "task_id": null,
  "file_id": "f1f2f3f4-...",
  "file_url": "/public/t1t2.../files/f1f2....jpg",
  "file_name": "home-depot-receipt.jpg",
  "file_type": "photo",
  "file_size_bytes": 245000,
  "vendor_name": "Home Depot",
  "amount": 125.50,
  "receipt_date": "2026-03-10T00:00:00.000Z",
  "ocr_status": "not_processed",
  "ocr_vendor": null,
  "ocr_amount": null,
  "ocr_date": null,
  "is_categorized": false,
  "uploaded_by_user_id": "u1u2...",
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-10T14:00:00.000Z"
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | No file uploaded |
| 400 | Invalid file type (not jpg/png/webp/pdf) |
| 400 | File size exceeds 25 MB |
| 400 | `task_id` does not belong to `project_id` |
| 400 | `task_id` not found in tenant |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |

---

### GET `/api/v1/financial/receipts`

**Description**: Returns a paginated list of receipts. At least one of `project_id` or `task_id` is required.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:

| Parameter | Required | Type | Default | Description |
|-----------|----------|------|---------|-------------|
| `project_id` | conditional | UUID | — | Filter by project. Required unless `task_id` provided. |
| `task_id` | conditional | UUID | — | Filter by task. Required unless `project_id` provided. |
| `is_categorized` | no | boolean | — | `true` = linked to entry, `false` = unlinked |
| `page` | no | integer (≥1) | `1` | Page number |
| `limit` | no | integer (1–100) | `20` | Results per page |

**cURL Example**:
```bash
curl "https://api.lead360.app/api/v1/financial/receipts?project_id=p1p2p3p4-...&is_categorized=false&page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

**Response 200**:
```json
{
  "data": [
    { /* receipt object */ },
    { /* receipt object */ }
  ],
  "meta": {
    "total": 12,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | Neither `project_id` nor `task_id` provided |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |

---

### GET `/api/v1/financial/receipts/:id`

**Description**: Get a single receipt by UUID.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Receipt ID |

**cURL Example**:
```bash
curl "https://api.lead360.app/api/v1/financial/receipts/a1b2c3d4-..." \
  -H "Authorization: Bearer <token>"
```

**Response 200**: Receipt object (see [Receipt Object](#receipt-object))

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | `id` is not a valid UUID |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Receipt not found or belongs to different tenant |

---

### PATCH `/api/v1/financial/receipts/:id/link`

**Description**: Link a receipt to a financial entry (1:1 relationship).

After linking:
- `receipt.financial_entry_id` is set
- `receipt.is_categorized` becomes `true`
- `financial_entry.has_receipt` becomes `true`

Both updates are applied atomically in a database transaction.

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Receipt ID to link |

**Request Body**:
```json
{
  "financial_entry_id": "e1e2e3e4-0000-0000-0000-000000000001"
}
```

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `financial_entry_id` | **yes** | UUID | Financial entry to link this receipt to |

**cURL Example**:
```bash
curl -X PATCH "https://api.lead360.app/api/v1/financial/receipts/a1b2c3d4-.../link" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"financial_entry_id": "e1e2e3e4-..."}'
```

**Response 200**: Updated receipt object with `is_categorized: true` and `financial_entry_id` set.

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | Receipt is already linked to a financial entry |
| 400 | Financial entry already has a receipt linked to it (1:1 enforced) |
| 400 | `financial_entry_id` is not a valid UUID |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Receipt not found (wrong tenant or wrong ID) |
| 404 | Financial entry not found (wrong tenant or wrong ID) |

---

### PATCH `/api/v1/financial/receipts/:id`

**Description**: Update receipt metadata. Only `vendor_name`, `amount`, and `receipt_date` are updatable. All fields are optional (PATCH semantics).

**Roles**: Owner, Admin, Manager, Bookkeeper

**Path Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Receipt ID |

**Request Body** (all fields optional):
```json
{
  "vendor_name": "Lowes",
  "amount": 200.00,
  "receipt_date": "2026-03-12"
}
```

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `vendor_name` | string (max 200) \| null | **yes** | Set `null` to clear |
| `amount` | positive number (≤2 decimals) \| null | **yes** | Set `null` to clear |
| `receipt_date` | ISO date (`YYYY-MM-DD`) \| null | **yes** | Set `null` to clear |

**cURL Example**:
```bash
curl -X PATCH "https://api.lead360.app/api/v1/financial/receipts/a1b2c3d4-..." \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"vendor_name": "Lowes", "amount": 200}'
```

**Response 200**: Updated receipt object.

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | `amount` ≤ 0 or has more than 2 decimal places |
| 400 | `receipt_date` is not a valid date string |
| 401 | Missing or invalid JWT |
| 403 | Insufficient role |
| 404 | Receipt not found (wrong tenant or wrong ID) |

---

## Gate Marker — Financial Gate 2 OPEN

`ReceiptService` is exported from `FinancialModule`. The following methods are available to other modules:

```typescript
ReceiptService.uploadReceipt(tenantId, userId, file, dto)
ReceiptService.linkReceiptToEntry(tenantId, receiptId, userId, dto)
ReceiptService.updateReceipt(tenantId, receiptId, userId, dto)
ReceiptService.getProjectReceipts(tenantId, query)
ReceiptService.getTaskReceipts(tenantId, taskId)
ReceiptService.getReceiptById(tenantId, receiptId)
```

---

## Architecture Notes

### File Storage
Receipts are uploaded via `FilesService` with `category: 'receipt'`. Files are stored in the same object storage used by all other file uploads. The `receipt.file_id` is a FK to `file.file_id` (UUID unique column).

### OCR — Reserved for Phase 2
The `ocr_raw`, `ocr_vendor`, `ocr_amount`, and `ocr_date` columns exist in the database but are never populated in Phase 1. The API always returns `null` for these fields. `ocr_status` is always `not_processed`.

### 1:1 Receipt ↔ Financial Entry
Enforced at the service layer (not at DB unique constraint level). A receipt can only be linked to one entry, and an entry can only have one receipt. This is validated atomically in `linkReceiptToEntry()`.

### Tenant Isolation
Every query includes `WHERE tenant_id = :tenantId`. The `tenant_id` is always derived from the authenticated JWT — never from request body or path parameters.

---

## File Upload Limits

| Category | Max Size | Accepted MIME Types |
|----------|----------|---------------------|
| `receipt` | **25 MB** | `image/jpeg`, `image/jpg`, `image/png`, `image/webp`, `application/pdf` |

---

## Integration Checklist

Frontend integration should:

- [ ] Use `multipart/form-data` for the upload endpoint (not `application/json`)
- [ ] Use `file` as the form field name for the file input
- [ ] Display the `file_url` directly for image previews (no signed URLs needed for local storage)
- [ ] Use `is_categorized: false` filter to show the "receipts to categorize" list
- [ ] Call the `/link` endpoint after the user selects a financial entry for the receipt
- [ ] Never send `tenant_id` in request body — it is derived from the JWT on the backend
