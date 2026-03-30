# Sprint 12 — Receipt OCR Enhancement
**Module:** Financial Frontend
**File:** ./documentation/sprints/financial_frontend/sprint_12.md
**Type:** Frontend — Feature Enhancement
**Depends On:** Sprint 1, Sprint 9
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Enhance the receipt upload and OCR flow. After uploading a receipt, the system polls for OCR completion, shows extracted data, and allows creating a financial entry pre-populated from OCR results. Includes retry OCR and linking receipts to existing entries.

---

## IMPORTANT RULES

- **You are a masterclass developer** that makes Google, Amazon, and Apple developers jealous.
- **You CANNOT touch any backend code.** Only frontend code in `/var/www/lead360.app/app/`.
- You CAN read backend API documentation — Section 7 (Receipts & OCR).
- **Always use modal prompts, never system prompts.**
- **Test accounts:**
  - Admin: `ludsonaiello@gmail.com` / `978@F32c`
  - Tenant: `contact@honeydo4you.com` / `978@F32c`

---

## Dev Server

```
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Upload a receipt
curl -s -X POST http://localhost:8000/api/v1/financial/receipts \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/receipt.jpg" \
  -F "project_id=f87e2a4c-a745-45c8-a47d-90f7fc4e8285" | jq '.'

# Check OCR status
curl -s "http://localhost:8000/api/v1/financial/receipts/RECEIPT_ID/ocr-status" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

---

## Tasks

### Task 1 — Receipt Upload Component

**Component:** `/var/www/lead360.app/app/src/app/(dashboard)/financial/entries/components/ReceiptUploadModal.tsx`

This modal handles receipt upload with OCR processing flow.

**RBAC for Receipts (per API Sections 7.1, 7.4):**
- Upload receipt: Owner, Admin, Manager, Bookkeeper, **Field**
- List/get receipts: Owner, Admin, Manager, Bookkeeper
- OCR status check: Owner, Admin, Manager, Bookkeeper, **Field** (own receipts only)
- Create entry from receipt: Owner, Admin, Manager, Bookkeeper, Field
- Retry OCR / Link / Update: Owner, Admin, Manager, Bookkeeper

**Upload form fields:**
| Field | Component | Required | Notes |
|-------|-----------|----------|-------|
| File | File input (drag & drop zone) | Yes | JPEG, PNG, WebP, PDF. Max 25MB |
| Project | Select with search | No | Optional project link |
| Task | Select with search | No | Conditional on project |
| Vendor Name | Input | No | Override OCR result |
| Amount | MoneyInput | No | Override OCR result |
| Receipt Date | DatePicker | No | Override OCR result |

**Drag & drop zone:**
- Accept images and PDFs
- Show file preview (image thumbnail or PDF icon)
- Show file size
- Allow removing before upload

**Upload flow:**
1. User selects file + optional fields
2. Build FormData: `file`, `project_id`, `task_id`, `vendor_name`, `amount`, `receipt_date`
3. Call `uploadReceipt(formData)`
4. Show upload progress (if possible)
5. On success: transition to OCR polling view within the same modal

---

### Task 2 — OCR Status Polling

After upload completes, the modal transitions to an OCR status view:

```
┌──────────────────────────────────────┐
│  Processing Receipt...               │
│                                      │
│  [Receipt thumbnail/preview]         │
│                                      │
│  ⏳ Analyzing receipt with OCR...    │
│  ████████░░░░░░░░  Processing        │
│                                      │
│  This usually takes 5-15 seconds.    │
│                              [Cancel]│
└──────────────────────────────────────┘
```

**Polling logic:**
1. Start polling `getOcrStatus(receiptId)` every 3 seconds
2. Show current status with appropriate indicator:
   - `processing` → spinner + "Analyzing receipt..."
   - `complete` → success icon + show extracted data
   - `failed` → error icon + retry button
   - `not_processed` → info + "OCR not available"
3. Stop polling when status is `complete`, `failed`, or `not_processed`
4. Max 20 polls (60 seconds timeout) → show "Taking longer than expected" message

---

### Task 3 — OCR Results & Create Entry

When OCR completes successfully, show extracted data and offer to create an entry:

```
┌──────────────────────────────────────┐
│  ✅ Receipt Analyzed                 │
│                                      │
│  [Receipt thumbnail]                 │
│                                      │
│  Extracted Data:                     │
│  Vendor:  Home Depot                 │
│  Amount:  $142.50                    │
│  Date:    Mar 15, 2026              │
│                                      │
│  [Create Entry from Receipt]         │
│  [Link to Existing Entry]            │
│  [Close]                             │
└──────────────────────────────────────┘
```

**"Create Entry from Receipt" button:**
Opens a specialized form modal (or reuses EntryFormModal from Sprint 9 with modifications) pre-populated with:
- `vendor_name` from `ocr_vendor`
- `amount` from `ocr_amount`
- `entry_date` from `ocr_date`
- `project_id` from the receipt's project
- `task_id` from the receipt's task

**REQUIRED fields for this endpoint (must be validated before submit):**
- `project_id` — REQUIRED. If not already set on the receipt, user must select a project.
- `category_id` — REQUIRED. User must always select a category (OCR does not extract this).
- `amount` — Falls back to `ocr_amount` if not provided, but FAILS if neither exists. Validate at least one is set.

The form calls `createEntryFromReceipt(receiptId, dto)` instead of `createFinancialEntry(dto)`.
The endpoint is `POST /financial/receipts/:id/create-entry` (NOT `/financial/entries`).

**"Link to Existing Entry" button:**
Opens a small modal with a searchable select of existing entries. User picks an entry, then calls `linkReceiptToEntry(receiptId, { financial_entry_id })` via **PATCH** method (`PATCH /financial/receipts/:id/link`).

---

### Task 4 — Failed OCR & Retry

When OCR fails:
```
┌──────────────────────────────────────┐
│  ❌ OCR Processing Failed            │
│                                      │
│  [Receipt thumbnail]                 │
│                                      │
│  Unable to extract data from this    │
│  receipt. You can retry or enter     │
│  the information manually.           │
│                                      │
│  [Retry OCR]  [Enter Manually]       │
│  [Close]                             │
└──────────────────────────────────────┘
```

- **Retry OCR:** Call `retryOcr(receiptId)`, restart polling
- **Enter Manually:** Open EntryFormModal with no pre-populated OCR data (but with receipt's project/task)

---

### Task 5 — Receipt Image Preview

For photo receipts (`file_type: "photo"`):
- Show the image inline in the modal using the `file_url`
- Image URL: `${NEXT_PUBLIC_API_URL.replace('/api/v1', '')}${receipt.file_url}`
- Allow click to open full-size in new tab

For PDF receipts (`file_type: "pdf"`):
- Show a PDF icon with filename
- Link to open/download the PDF

---

### Task 6 — Integration Points

1. Add "Upload Receipt" button to the entries list page (Sprint 8)
2. Add "Upload Receipt" flow to the project financial receipt section (if exists)
3. When a receipt is linked to an entry, show the receipt thumbnail on the entry card

---

## Acceptance Criteria
- [ ] Receipt upload modal with drag & drop
- [ ] File validation (type, size)
- [ ] Upload sends FormData correctly
- [ ] OCR polling works with 3-second interval
- [ ] OCR results displayed when complete
- [ ] "Create Entry from Receipt" pre-populates form
- [ ] `createEntryFromReceipt` API call works correctly
- [ ] "Link to Existing Entry" modal with entry select
- [ ] Failed OCR shows retry + manual entry options
- [ ] Retry OCR re-queues and re-polls
- [ ] Image preview for photo receipts
- [ ] PDF icon for PDF receipts
- [ ] Upload button on entries list page
- [ ] Toast notifications for all actions
- [ ] Mobile responsive (camera upload on mobile)
- [ ] Dark mode support
- [ ] No backend code modified

---

## Handoff Notes
- Receipt file_url is relative — prepend the API base URL (without /api/v1)
- OCR is async via BullMQ — must poll, don't expect instant results
- `createEntryFromReceipt` returns `{ entry, receipt }` — both objects
- Linking a receipt sets `receipt.is_categorized = true` and `entry.has_receipt = true`
- Max file size: 25MB
- Accepted types: JPEG, PNG, WebP, PDF
