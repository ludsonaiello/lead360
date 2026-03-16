# Task-Level Financial Endpoints — REST API Documentation

**Module**: Project Management (Sprint 28)
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT required on all endpoints
**Content-Type**: `application/json` (except receipt upload: `multipart/form-data`)

---

## Endpoints Overview

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | `/projects/:projectId/tasks/:taskId/costs` | Create cost entry for task | Owner, Admin, Manager, Bookkeeper |
| GET | `/projects/:projectId/tasks/:taskId/costs` | List cost entries for task | Owner, Admin, Manager, Bookkeeper |
| POST | `/projects/:projectId/tasks/:taskId/receipts` | Upload receipt for task | Owner, Admin, Manager, Bookkeeper, Field |
| GET | `/projects/:projectId/tasks/:taskId/receipts` | List receipts for task | Owner, Admin, Manager, Bookkeeper |
| GET | `/projects/:id/summary` | Enhanced project financial summary | Owner, Admin, Manager, Bookkeeper |

---

## 1. POST /projects/:projectId/tasks/:taskId/costs

**Description**: Create a financial cost entry linked to a specific task. The `project_id` and `task_id` are taken from the URL path — they are not accepted in the request body.

**Required Roles**: Owner, Admin, Manager, Bookkeeper

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| category_id | string (UUID) | Yes | Must exist and belong to tenant, must be active | Financial category ID |
| amount | number | Yes | > 0, max 2 decimal places | Entry amount in dollars |
| entry_date | string (ISO date) | Yes | Cannot be in the future | Date of the expense |
| vendor_name | string | No | Max 200 chars | Vendor/supplier name |
| crew_member_id | string (UUID) | No | Must exist in tenant | Associated crew member |
| subcontractor_id | string (UUID) | No | Must exist in tenant | Associated subcontractor |
| notes | string | No | — | Additional notes |

### Request Example

```http
POST /api/v1/projects/a1b2c3d4-0001-0001-0001-000000000001/tasks/a1b2c3d4-0002-0002-0002-000000000001/costs HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "category_id": "a1b2c3d4-0003-0003-0003-000000000001",
  "amount": 450.00,
  "entry_date": "2026-03-10",
  "vendor_name": "Home Depot",
  "notes": "2x4 studs for framing"
}
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-0004-0004-0004-000000000001",
  "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
  "task_id": "a1b2c3d4-0002-0002-0002-000000000001",
  "category_id": "a1b2c3d4-0003-0003-0003-000000000001",
  "entry_type": "expense",
  "amount": "450.00",
  "entry_date": "2026-03-10T00:00:00.000Z",
  "vendor_name": "Home Depot",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "2x4 studs for framing",
  "has_receipt": false,
  "created_by_user_id": "user-uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-16T10:30:00.000Z",
  "updated_at": "2026-03-16T10:30:00.000Z",
  "category": {
    "id": "a1b2c3d4-0003-0003-0003-000000000001",
    "name": "Material",
    "type": "material"
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (amount <= 0, future date, invalid category) |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found, or task not found in project |

---

## 2. GET /projects/:projectId/tasks/:taskId/costs

**Description**: List all financial cost entries linked to a specific task. Ordered by `entry_date` descending (most recent first).

**Required Roles**: Owner, Admin, Manager, Bookkeeper

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Example

```http
GET /api/v1/projects/a1b2c3d4-0001-0001-0001-000000000001/tasks/a1b2c3d4-0002-0002-0002-000000000001/costs HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response (200 OK)

```json
[
  {
    "id": "a1b2c3d4-0004-0004-0004-000000000001",
    "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
    "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
    "task_id": "a1b2c3d4-0002-0002-0002-000000000001",
    "category_id": "a1b2c3d4-0003-0003-0003-000000000001",
    "entry_type": "expense",
    "amount": "450.00",
    "entry_date": "2026-03-10T00:00:00.000Z",
    "vendor_name": "Home Depot",
    "crew_member_id": null,
    "subcontractor_id": null,
    "notes": "2x4 studs for framing",
    "has_receipt": false,
    "created_by_user_id": "user-uuid",
    "updated_by_user_id": null,
    "created_at": "2026-03-16T10:30:00.000Z",
    "updated_at": "2026-03-16T10:30:00.000Z",
    "category": {
      "id": "a1b2c3d4-0003-0003-0003-000000000001",
      "name": "Material",
      "type": "material"
    }
  },
  {
    "id": "a1b2c3d4-0004-0004-0004-000000000002",
    "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
    "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
    "task_id": "a1b2c3d4-0002-0002-0002-000000000001",
    "category_id": "a1b2c3d4-0003-0003-0003-000000000002",
    "entry_type": "expense",
    "amount": "200.00",
    "entry_date": "2026-03-08T00:00:00.000Z",
    "vendor_name": "ACE Hardware",
    "crew_member_id": null,
    "subcontractor_id": null,
    "notes": "Screws and nails",
    "has_receipt": true,
    "created_by_user_id": "user-uuid",
    "updated_by_user_id": null,
    "created_at": "2026-03-08T14:20:00.000Z",
    "updated_at": "2026-03-08T14:20:00.000Z",
    "category": {
      "id": "a1b2c3d4-0003-0003-0003-000000000002",
      "name": "Material",
      "type": "material"
    }
  }
]
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found, or task not found in project |

---

## 3. POST /projects/:projectId/tasks/:taskId/receipts

**Description**: Upload a receipt file (image or PDF) linked to a specific task. The `project_id` and `task_id` are taken from the URL path. Uses `multipart/form-data` encoding.

**Required Roles**: Owner, Admin, Manager, Bookkeeper, Field

**Content-Type**: `multipart/form-data`

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Body (multipart/form-data)

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| file | binary | Yes | jpg, png, webp, pdf; max 25 MB | Receipt file |
| vendor_name | string | No | Max 200 chars | Vendor name |
| amount | number | No | > 0, max 2 decimal places | Receipt amount in dollars |
| receipt_date | string (ISO date) | No | Valid ISO date string | Date on receipt |

### Request Example

```http
POST /api/v1/projects/a1b2c3d4-0001-0001-0001-000000000001/tasks/a1b2c3d4-0002-0002-0002-000000000001/receipts HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: multipart/form-data; boundary=----FormBoundary

------FormBoundary
Content-Disposition: form-data; name="file"; filename="receipt-home-depot.jpg"
Content-Type: image/jpeg

<binary file data>
------FormBoundary
Content-Disposition: form-data; name="vendor_name"

Home Depot
------FormBoundary
Content-Disposition: form-data; name="amount"

450.00
------FormBoundary
Content-Disposition: form-data; name="receipt_date"

2026-03-10
------FormBoundary--
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-0005-0005-0005-000000000001",
  "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
  "financial_entry_id": null,
  "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
  "task_id": "a1b2c3d4-0002-0002-0002-000000000001",
  "file_id": "a1b2c3d4-0006-0006-0006-000000000001",
  "file_url": "/public/a1b2c3d4-0000-0000-0000-000000000001/files/a1b2c3d4-0006-0006-0006-000000000001.jpg",
  "file_name": "receipt-home-depot.jpg",
  "file_type": "photo",
  "file_size_bytes": 1048576,
  "vendor_name": "Home Depot",
  "amount": 450.0,
  "receipt_date": "2026-03-10T00:00:00.000Z",
  "ocr_status": "not_processed",
  "ocr_vendor": null,
  "ocr_amount": null,
  "ocr_date": null,
  "is_categorized": false,
  "uploaded_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:35:00.000Z",
  "updated_at": "2026-03-16T10:35:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | No file uploaded, invalid file type, file too large (>25 MB), validation error |
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found, or task not found in project |

---

## 4. GET /projects/:projectId/tasks/:taskId/receipts

**Description**: List all receipts linked to a specific task. Ordered by `created_at` descending (most recent first). No pagination — tasks are bounded.

**Required Roles**: Owner, Admin, Manager, Bookkeeper

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project UUID |
| taskId | UUID | Yes | Task UUID (must belong to the project) |

### Request Example

```http
GET /api/v1/projects/a1b2c3d4-0001-0001-0001-000000000001/tasks/a1b2c3d4-0002-0002-0002-000000000001/receipts HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response (200 OK)

```json
[
  {
    "id": "a1b2c3d4-0005-0005-0005-000000000001",
    "tenant_id": "a1b2c3d4-0000-0000-0000-000000000001",
    "financial_entry_id": null,
    "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
    "task_id": "a1b2c3d4-0002-0002-0002-000000000001",
    "file_id": "a1b2c3d4-0006-0006-0006-000000000001",
    "file_url": "/public/a1b2c3d4-0000-0000-0000-000000000001/files/a1b2c3d4-0006-0006-0006-000000000001.jpg",
    "file_name": "receipt-home-depot.jpg",
    "file_type": "photo",
    "file_size_bytes": 1048576,
    "vendor_name": "Home Depot",
    "amount": 450.0,
    "receipt_date": "2026-03-10T00:00:00.000Z",
    "ocr_status": "not_processed",
    "ocr_vendor": null,
    "ocr_amount": null,
    "ocr_date": null,
    "is_categorized": false,
    "uploaded_by_user_id": "user-uuid",
    "created_at": "2026-03-16T10:35:00.000Z",
    "updated_at": "2026-03-16T10:35:00.000Z"
  }
]
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found, or task not found in project |

---

## 5. GET /projects/:id/summary (Enhanced)

**Description**: Get project financial summary combining contract value with actual costs. **Enhanced in Sprint 28** to include `receipt_count`, `margin_estimated`, and `margin_actual`.

**Required Roles**: Owner, Admin, Manager, Bookkeeper

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Project UUID |

### Request Example

```http
GET /api/v1/projects/a1b2c3d4-0001-0001-0001-000000000001/summary HTTP/1.1
Host: api.lead360.app
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### Response (200 OK)

```json
{
  "project_id": "a1b2c3d4-0001-0001-0001-000000000001",
  "project_number": "PRJ-2026-0001",
  "contract_value": 45000.00,
  "estimated_cost": 32000.00,
  "progress_percent": 40.0,
  "task_count": 10,
  "completed_task_count": 4,
  "total_actual_cost": 12500.00,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 4500.00,
    "subcontractor": 2000.00,
    "equipment": 800.00,
    "other": 200.00
  },
  "entry_count": 15,
  "receipt_count": 8,
  "margin_estimated": 13000.00,
  "margin_actual": 32500.00
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| project_id | string (UUID) | Project identifier |
| project_number | string | Human-readable project number |
| contract_value | number \| null | Contract value from quote (null for standalone projects) |
| estimated_cost | number \| null | Estimated project cost (null if not set) |
| progress_percent | number | Completion percentage (0–100) |
| task_count | number | Total non-deleted tasks |
| completed_task_count | number | Tasks with status "done" |
| total_actual_cost | number | Sum of all financial entries |
| cost_by_category | object | Cost breakdown by category type |
| cost_by_category.labor | number | Labor costs |
| cost_by_category.material | number | Material costs |
| cost_by_category.subcontractor | number | Subcontractor costs |
| cost_by_category.equipment | number | Equipment costs |
| cost_by_category.other | number | Other costs |
| entry_count | number | Total financial entries |
| receipt_count | number | Total receipts for the project |
| margin_estimated | number \| null | `contract_value - estimated_cost` (null when either is null) |
| margin_actual | number \| null | `contract_value - total_actual_cost` (null when contract_value is null) |

### Margin Calculation Rules

- `margin_estimated` = `contract_value - estimated_cost` — null if either `contract_value` or `estimated_cost` is null
- `margin_actual` = `contract_value - total_actual_cost` — null if `contract_value` is null
- Standalone projects (no quote) will have `contract_value = null`, so both margins return `null`

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | Insufficient role |
| 404 | Project not found |

---

## Business Rules

1. **Task ownership validation**: All task-level endpoints first verify that the project exists for the tenant, then that the task belongs to the project and tenant. Requests for non-existent or cross-tenant resources return 404.

2. **Tenant isolation**: All queries include `tenant_id` filter derived from the JWT token. A user from Tenant A cannot access Tenant B's projects, tasks, costs, or receipts.

3. **Cost entries**: Delegate to `FinancialEntryService.createEntry()` with `project_id` and `task_id` pre-filled from URL params. The entry_type is always `expense` in Phase 1.

4. **Receipt uploads**: Delegate to `ReceiptService.uploadReceipt()` with `project_id` and `task_id` pre-filled. Accepted file types: jpg, png, webp, pdf. Max file size: 25 MB.

5. **Financial summary margins**: Computed server-side. `margin_estimated` requires both `contract_value` and `estimated_cost` to be non-null. `margin_actual` requires `contract_value` to be non-null.

6. **Audit logging**: Cost entry creation is audit-logged by the underlying `FinancialEntryService`. Receipt upload is audit-logged by the underlying `ReceiptService`.
