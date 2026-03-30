# Sprint 26 — Task-Level Financial Operations
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_26.md
**Type:** Frontend — Feature Enhancement (Project Task Integration)
**Depends On:** Sprint 1a, Sprint 1b, Sprint 1c, Sprint 9 (Entry Form), Sprint 12 (Receipt Upload)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Add task-level financial operations within the project task detail view. Users can create cost entries, upload receipts, and view subcontractor invoices scoped to a specific project task — all without leaving the task context. These are convenience endpoints that automatically pre-fill `project_id` and `task_id`.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 16 (Task-Level Financial Operations).
- **Reuse existing components** (EntryFormModal from Sprint 9, ReceiptUploadModal from Sprint 12).
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

PROJECT_ID="f87e2a4c-a745-45c8-a47d-90f7fc4e8285"
TASK_ID="4dffa994-995d-482a-95ab-6c2cb8b5faa6"

# List task costs
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/$TASK_ID/costs" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# List task receipts
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/$TASK_ID/receipts" \
  -H "Authorization: Bearer $TOKEN" | jq '.'

# List task subcontractor invoices
curl -s "http://localhost:8000/api/v1/projects/$PROJECT_ID/tasks/$TASK_ID/invoices" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Find and Enhance Task Detail Financial Section

Read the existing task detail view in the project module:
- `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/`
- Look for task detail, task modal, or task panel components

Add a "Financial" section/tab to the task detail view with three sub-sections:
- Costs (expense entries)
- Receipts
- Subcontractor Invoices

---

### Task 2 — Task Costs Section

**API Endpoints:**
- `POST /api/v1/projects/:projectId/tasks/:taskId/costs` — Create cost entry
- `GET /api/v1/projects/:projectId/tasks/:taskId/costs` — List task costs

**List response:** Array of financial entries (NOT paginated, NOT enriched).

> **IMPORTANT:** The task-level `GET /costs` endpoint returns **raw Prisma entry objects**, NOT the enriched format from `/financial/entries`. Raw entries include fields like `crew_member_id`, `subcontractor_id`, `updated_by_user_id` but do NOT include enriched name fields (`project_name`, `category_name`, `supplier_name`, etc.). Handle this difference in your display logic.

**Layout within task detail:**
```
+----------------------------------------------+
| Task: Retirar Driveway                        |
|                                                |
| [Details] [Financial] [Notes]                 |
|                                                |
| -- Costs --                    [+ Add Cost]   |
| +------------------------------------------+ |
| | $542.00 | Miscellaneous | Mar 17         | |
| | Confirmed                                 | |
| +------------------------------------------+ |
| | $1,500.00 | Labor - General | Mar 16     | |
| | Confirmed                                 | |
| +------------------------------------------+ |
| Total: $2,042.00 (2 entries)                  |
+----------------------------------------------+
```

**Features:**
1. List all entries for this task (flat array)
2. Show amount (parse from string or number), category, date, status
3. Total calculation at the bottom
4. "+ Add Cost" button opens the **EntryFormModal** (from Sprint 9) with:
   - `defaultProjectId` = current project ID
   - `defaultTaskId` = current task ID
   - These fields should be **read-only/locked** in the form since they come from task context
5. The create endpoint is `POST /projects/:projectId/tasks/:taskId/costs` — same body as regular entry create BUT `project_id` and `task_id` are auto-filled from the URL, so do NOT include them in the request body
6. Use `createTaskCost(projectId, taskId, dto)` from the API client

**RBAC:** Owner, Admin, Manager, Bookkeeper

---

### Task 3 — Task Receipts Section

**API Endpoints:**
- `POST /api/v1/projects/:projectId/tasks/:taskId/receipts` — Upload receipt
- `GET /api/v1/projects/:projectId/tasks/:taskId/receipts` — List receipts

**List response:** Array of receipt objects (NOT paginated).

**Layout within task detail:**
```
+----------------------------------------------+
| -- Receipts --               [+ Upload]       |
| +------------------------------------------+ |
| | IMG_0152.jpg | $100 | Mar 16             | |
| | Vendor: Ludson | OCR: Complete            | |
| | [View] [Create Entry]                     | |
| +------------------------------------------+ |
| Total: 1 receipt (0 categorized)              |
+----------------------------------------------+
```

**Features:**
1. List all receipts for this task (flat array)
2. Show file name, amount, date, vendor, OCR status
3. Image thumbnail for photos, PDF icon for PDFs
4. "+ Upload" button opens the **ReceiptUploadModal** (from Sprint 12) with:
   - Pre-filled `project_id` and `task_id`
   - The upload uses `uploadTaskReceipt(projectId, taskId, formData)` which auto-fills project/task from URL
5. "Create Entry" link → opens create entry from receipt flow (Sprint 12)
6. "View" → image preview or download

**Receipt file URL:** `${NEXT_PUBLIC_API_URL.replace('/api/v1', '')}${receipt.file_url}`

**RBAC:**
- Upload: Owner, Admin, Manager, Bookkeeper, **Field**
- List: Owner, Admin, Manager, Bookkeeper

---

### Task 4 — Task Subcontractor Invoices Section

**API Endpoint:** `GET /api/v1/projects/:projectId/tasks/:taskId/invoices`

**Response:** Array of subcontractor invoice objects (NOT paginated). Same shape as Section 19 data items.

**Layout within task detail:**
```
+----------------------------------------------+
| -- Subcontractor Invoices --                  |
| +------------------------------------------+ |
| | Ludson Developer | SUB-INV-001           | |
| | $2,500.00 | Pending | Mar 16             | |
| +------------------------------------------+ |
| Total Invoiced: $2,500.00 (1 invoice)        |
+----------------------------------------------+
```

**Features:**
1. List all subcontractor invoices for this task (flat array, read-only)
2. Show subcontractor name (`business_name`), invoice number, amount, status badge, date
3. Status badges: pending (yellow), approved (blue), paid (green)
4. Total invoiced calculation
5. Link to full invoice detail (Sprint 24) or link to subcontractor invoices page filtered by this task

**Note:** This section is read-only — creating/managing subcontractor invoices is done from Sprint 24. This just shows what exists for the task.

**RBAC:** Owner, Admin, Manager, Bookkeeper

---

### Task 5 — Financial Summary in Task Card/Row

If the project task list shows task cards or rows, add a small financial indicator:
- "$X,XXX" — total cost for the task (from task breakdown data in Sprint 18)
- Show only if costs exist
- Small muted text under the task title or as a badge

This is optional but recommended for quick visibility.

---

## Acceptance Criteria
- [ ] Financial section/tab exists in task detail view
- [ ] Task costs list displays all entries
- [ ] Add Cost button opens EntryFormModal with locked project/task
- [ ] Cost creation uses `createTaskCost` API (task-scoped endpoint)
- [ ] Task receipts list displays all receipts
- [ ] Upload Receipt button opens ReceiptUploadModal with pre-filled project/task
- [ ] Receipt upload uses `uploadTaskReceipt` API (task-scoped endpoint)
- [ ] Image preview for photo receipts, PDF icon for PDFs
- [ ] Subcontractor invoices listed (read-only) with status badges
- [ ] Total calculations at bottom of each section
- [ ] Raw entry format handled correctly (no enriched name fields)
- [ ] RBAC enforced per section
- [ ] Mobile responsive, dark mode
- [ ] No backend code modified

---

## Handoff Notes
- Task-level `GET /costs` returns **RAW** entries — no enriched `_name` fields. Use `category_id` to display category (may need to fetch categories separately or show ID only)
- Task-level `GET /receipts` and `GET /invoices` return flat arrays, NOT paginated
- `POST /tasks/:taskId/costs` auto-fills `project_id` and `task_id` from URL — do NOT send them in the request body
- `POST /tasks/:taskId/receipts` similarly auto-fills from URL — build FormData WITHOUT project_id/task_id
- Reuse EntryFormModal and ReceiptUploadModal components — pass `defaultProjectId` and `defaultTaskId` props
- Subcontractor invoices section is read-only in task context — CRUD is in Sprint 24
- Financial categories may need to be fetched separately to display category names for raw entries
