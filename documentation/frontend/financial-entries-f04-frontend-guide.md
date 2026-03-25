# Financial Entry Engine (F-04) Frontend Integration Guide — Lead360

**Status**: Ready for Frontend Implementation
**Backend Docs**: `/api/documentation/financial_f04_REST_API.md`
**Architecture Docs**: `/documentation/architecture/module-financial-entries-f04.md`
**Verified**: YES — all 10 endpoints confirmed working with live HTTP requests on 2026-03-20

---

## Authentication

All authenticated endpoints require:
```
Authorization: Bearer {jwt_token}
```
Token obtained from: `POST /api/v1/auth/login`

## Base URL
- Production: `https://api.lead360.app/api/v1`
- Local dev: `http://localhost:8000/api/v1`

---

## Key Workflows

### Workflow 1: List & Browse Entries

```
1. GET /financial/entries?page=1&limit=20&sort_by=entry_date&sort_order=desc
   → Returns { data: Entry[], meta: PaginationMeta, summary: SummaryBlock }

2. Use meta.total_pages for pagination controls
3. Use summary.total_expenses / total_income / total_tax for dashboard cards
4. Summary reflects FULL filtered result set, not just current page

5. Apply filters via query params:
   - classification=operating_expense  (for overhead view)
   - classification=cost_of_goods_sold (for project costs view)
   - project_id=uuid (for project-scoped view)
   - date_from=2026-01-01&date_to=2026-03-31 (date range)
   - search=keyword (searches vendor_name and notes)
   - submission_status=pending_review (pending only)
```

### Workflow 2: Create New Entry

```
1. Fetch dependencies:
   GET /settings/financial-categories     → category dropdown
   GET /financial/suppliers?is_active=true → supplier dropdown
   GET /financial/payment-methods?is_active=true → payment method dropdown
   (User list and crew member list from their respective endpoints)

2. POST /financial/entries with body:
   {
     "category_id": "uuid",
     "entry_type": "expense",
     "amount": 450.00,
     "entry_date": "2026-03-15",
     ...optional fields
   }
   → Returns enriched Entry object

3. IMPORTANT: If the logged-in user is Employee role:
   - submission_status will ALWAYS be "pending_review" regardless of what you send
   - Show the user a message: "Your entry has been submitted for review"

4. If the logged-in user is Owner/Admin/Manager/Bookkeeper:
   - Default is "confirmed" — entry is immediately posted
   - Optionally allow them to select "pending_review" if they want manual review
```

### Workflow 3: Pending Approval Queue (Privileged Roles Only)

```
1. GET /financial/entries/pending?page=1&limit=20
   → Returns only pending_review entries with summary

2. For each entry, show:
   - Entry details (amount, date, category, vendor)
   - created_by_name (who submitted it)
   - rejection_reason (if previously rejected — shows as warning)
   - rejected_by_name + rejected_at (if previously rejected)

3. Actions per entry:
   a. APPROVE: POST /financial/entries/{id}/approve
      - Optional body: { "notes": "Approval note" }
      - Returns entry with submission_status: "confirmed"

   b. REJECT: POST /financial/entries/{id}/reject
      - Required body: { "rejection_reason": "Receipt is illegible..." }
      - Returns entry still in pending_review but with rejection fields populated

4. After approve/reject, refresh the pending list
```

### Workflow 4: Resubmit Rejected Entry (Employee View)

```
1. Employee lists their entries: GET /financial/entries
   → Only their own entries returned (automatic scoping)

2. Identify rejected entries: entries where rejection_reason is not null
   AND rejected_at is not null AND submission_status is "pending_review"

3. Show rejection details:
   - rejection_reason (the reason given by reviewer)
   - rejected_by_name (who rejected it)
   - rejected_at (when)

4. Allow Employee to edit and resubmit:
   POST /financial/entries/{id}/resubmit
   Body: { "amount": 475.00, "notes": "Corrected per reviewer feedback" }
   → All optional — only include fields that changed

5. After resubmit: rejection fields are cleared, entry returns to clean pending state
```

### Workflow 5: CSV Export

```
1. GET /financial/entries/export?date_from=2026-01-01&date_to=2026-03-31
   → Returns CSV file as text/csv with Content-Disposition header

2. Same filter params as list endpoint (minus pagination)
3. Maximum 10,000 rows — show error if exceeded
4. Only available to Owner, Admin, Bookkeeper

5. Frontend handling:
   - Trigger download via fetch() and create blob URL
   - Or use window.location / anchor tag download
   - Content-Disposition filename: "expenses-YYYY-MM-DD.csv"
```

### Workflow 6: Edit Entry

```
1. GET /financial/entries/{id} → Get current entry data
2. PATCH /financial/entries/{id} with changed fields only

Important restrictions:
- Employee can only edit own entries in pending_review status
- project_id, task_id, submission_status are NOT editable via PATCH
- Use approve/reject/resubmit for status changes
```

### Workflow 7: Delete Entry

```
1. DELETE /financial/entries/{id}
   → Returns { "message": "Entry deleted successfully" }

Important restrictions:
- Manager/Bookkeeper CANNOT delete (always 403)
- Employee can only delete own entries in pending_review status
- Owner/Admin can delete any entry in any status

Show confirmation dialog before delete.
```

---

## Important Data Relationships

```
Entry.category_id      → financial_category.id  (required)
Entry.project_id       → project.id             (optional — null = overhead)
Entry.task_id          → project_task.id         (optional)
Entry.supplier_id      → supplier.id             (optional)
Entry.payment_method_registry_id → payment_method_registry.id (optional)
Entry.purchased_by_user_id      → user.id        (optional, XOR with crew member)
Entry.purchased_by_crew_member_id → crew_member.id (optional, XOR with user)
Entry.created_by_user_id        → user.id         (auto from JWT)
Entry.rejected_by_user_id       → user.id         (auto from reject action)
```

The enriched response includes human-readable names for ALL FK references:
- `category_name`, `category_type`, `category_classification`
- `project_name`, `task_title`
- `supplier_name`
- `payment_method_nickname`
- `purchased_by_user_name`, `purchased_by_crew_member_name`
- `created_by_name`, `rejected_by_name`

**You do NOT need to make additional API calls to resolve names — they're included in every response.**

---

## Response Shape Reference

### Single Entry (GET /:id, POST, PATCH, approve, reject, resubmit)

37 fields total. Key ones for UI:

| Field | Type | Display Notes |
|-------|------|---------------|
| `amount` | number | Decimal values: `542`, `125.5` — format as currency |
| `tax_amount` | number or null | Same as amount |
| `entry_date` | string | ISO 8601: `"2026-03-17T00:00:00.000Z"` — display date only |
| `entry_time` | string or null | ISO 8601: `"1970-01-01T14:30:00.000Z"` — extract time only, ignore date |
| `submission_status` | string | `"pending_review"` or `"confirmed"` — use for badge/chip UI |
| `rejection_reason` | string or null | Show as warning banner when present |
| `rejected_at` | string or null | ISO 8601 datetime when present |
| `has_receipt` | boolean | Show receipt icon/indicator |

### List Response (GET /financial/entries, GET /financial/entries/pending)

```typescript
{
  data: Entry[],
  meta: {
    total: number,       // Total matching entries (full result set)
    page: number,        // Current page
    limit: number,       // Items per page
    total_pages: number  // Calculated
  },
  summary: {
    total_expenses: number,  // Sum of expense amounts (full result set)
    total_income: number,    // Sum of income amounts (full result set)
    total_tax: number,       // Sum of tax amounts (full result set)
    entry_count: number      // Same as meta.total
  }
}
```

### Delete Response

```json
{ "message": "Entry deleted successfully" }
```

---

## Pagination Pattern

```
GET /financial/entries?page=1&limit=20
```

Response includes `meta` with `total`, `page`, `limit`, `total_pages`.

**Max limit**: 100 (server caps at 100 even if you send higher)
**Default limit**: 20
**Default sort**: `entry_date` descending

---

## Error Handling

Standard error format:
```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "Descriptive error message",
  "error": "Bad Request",
  "timestamp": "2026-03-20T12:00:00.000Z",
  "path": "/api/v1/financial/entries",
  "requestId": "req_abc123"
}
```

### Validation errors (400)
When class-validator catches multiple issues, `message` is a comma-separated string of all validation errors. Parse by comma if you need individual messages.

### Common error scenarios to handle in UI:

| Status | Scenario | User Message |
|--------|----------|-------------|
| 400 | Tax >= amount | "Tax amount must be less than the entry amount" |
| 400 | Both purchased_by provided | "Cannot assign purchase to both a user and a crew member" |
| 400 | Future date | "Entry date cannot be in the future" |
| 400 | Export > 10K rows | "Export limit exceeded. Apply date filters to narrow the result set." |
| 400 | Approve non-pending | "Entry is not in pending_review status" |
| 400 | Reject non-pending | "Entry is not in pending_review status" |
| 400 | Resubmit non-rejected | "Only rejected entries can be resubmitted" |
| 403 | Employee accessing other's entry | "Access denied. You can only view your own entries." |
| 403 | Employee editing confirmed | "Access denied. You can only edit entries with pending_review status." |
| 403 | Manager/Bookkeeper deleting | "Managers and Bookkeepers are not authorized to delete financial entries." |
| 404 | Entry not found | "Financial entry not found" |
| 404 | Invalid category | "Financial category not found or inactive" |
| 404 | Invalid supplier | "Supplier not found or inactive" |

---

## Role-Based UI Considerations

### Owner / Admin
- See all entries, can do everything
- Show pending count badge in navigation
- Show export button
- Show delete button on all entries

### Manager
- See all entries
- Show pending queue access
- Show approve/reject buttons
- **NO** delete button (they cannot delete)
- **NO** export button (they cannot export)

### Bookkeeper
- See all entries
- Show pending queue access
- Show approve/reject buttons
- **NO** delete button (they cannot delete)
- Show export button

### Employee
- See ONLY own entries (API enforces this — no frontend filter needed)
- **NO** pending queue link (403)
- **NO** export button (403)
- Show edit button ONLY on pending_review entries
- Show delete button ONLY on pending_review entries
- Show resubmit button on rejected entries (entries with `rejection_reason` populated)

---

## Form Field Reference (Create Entry)

| Field | Input Type | Required | Notes |
|-------|-----------|----------|-------|
| category_id | Dropdown | Yes | Fetch from GET /settings/financial-categories |
| entry_type | Radio/Select | Yes | `expense` (default) or `income` |
| amount | Number (currency) | Yes | Min 0.01, max 2 decimal places |
| entry_date | Date picker | Yes | Cannot be future |
| tax_amount | Number (currency) | No | Must be < amount |
| entry_time | Time picker | No | HH:MM:SS format |
| vendor_name | Text input | No | Max 200 chars |
| supplier_id | Dropdown | No | Fetch from GET /financial/suppliers?is_active=true |
| payment_method | Dropdown | No | Enum values (ignored if registry selected) |
| payment_method_registry_id | Dropdown | No | Fetch from GET /financial/payment-methods?is_active=true |
| purchased_by_user_id | Dropdown | No | Mutually exclusive with crew member |
| purchased_by_crew_member_id | Dropdown | No | Mutually exclusive with user |
| project_id | Dropdown | No | Fetch from GET /projects |
| task_id | Dropdown | No | Requires project_id first — fetch tasks for selected project |
| submission_status | Toggle/Select | No | Only show for privileged roles (Employee value is forced) |
| notes | Textarea | No | Max 2000 chars |

### Form UX Notes:
- When `payment_method_registry_id` is selected, disable/hide `payment_method` dropdown (it's auto-populated server-side)
- When `purchased_by_user_id` is selected, disable `purchased_by_crew_member_id` (and vice versa)
- When `supplier_id` is selected, consider auto-filling `vendor_name` from supplier name
- `task_id` dropdown should only appear after `project_id` is selected
- For Employee role: hide `submission_status` entirely (always forced to pending_review)

---

## Gotchas & Edge Cases (Discovered During Verification)

1. **`entry_time` format in response**: Returns as `"1970-01-01T14:30:00.000Z"` — you must extract the time portion and ignore the date. Don't display "January 1, 1970" to the user.

2. **`amount` serialization**: Prisma Decimal comes back as a JS number (`542`, `125.5`), NOT a string. You can use it directly but be aware of floating point — format with `toFixed(2)` for display.

3. **Summary is for full filter, not page**: The `summary` block in list responses aggregates the ENTIRE filtered result set, not just the items on the current page. This is intentional — use it for dashboard totals.

4. **Rejected entries stay in pending**: After rejection, `submission_status` remains `"pending_review"`. To identify rejected entries, check if `rejected_at` is not null. Don't look for a "rejected" status — it doesn't exist.

5. **Global prefix**: All paths use `/api/v1/` prefix. The controller declares `@Controller('financial')` and the global prefix adds `api/v1/`, making the full path `/api/v1/financial/entries`.

6. **DTO validation runs before business logic**: If you send invalid field types (e.g., non-UUID for category_id), you get a class-validator error (400). Business rules (tax < amount, mutual exclusion) only run after DTO validation passes.

7. **Employee silent scoping**: GET /financial/entries for Employees automatically filters to `created_by_user_id = current user`. No error — just returns fewer results. Don't add a client-side filter.

8. **Export returns raw text**: The export endpoint returns `text/csv` content type. It does NOT return JSON. Handle the response as text/blob, not JSON.

---

## Existing UI Components to Reuse

Check the existing codebase at `/var/www/lead360.app/app/src/` for:

- **Currency input**: Look for existing masked currency inputs used in quotes module
- **Date picker**: Existing date picker components used elsewhere
- **Status badges**: Existing badge components for status display
- **Data tables**: Existing paginated table components with sort/filter
- **Dropdown selects**: Existing searchable select components
- **Confirmation modals**: Existing modal components for delete confirmation
- **Loading states**: Existing spinner/skeleton components
- **Toast/notification**: Existing toast system for success/error messages
