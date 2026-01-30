# Sprint 4: API Testing Findings

**Date**: 2026-01-26
**Tester**: Frontend Developer 4
**Test Accounts**:
- Admin: `ludsonaiello@gmail.com`
- Tenant: `contact@honeydo4you.com`

---

## Approval Workflow Endpoints

### 1. GET /quotes/settings/approval-thresholds ✅ WORKS

**Response Structure:**
```json
{
  "approval_levels": [
    {
      "level": 1,
      "role": "Manager",
      "min_amount": 0,
      "max_amount": 10000,
      "description": "Manager approval required for quotes up to $10,000"
    }
  ]
}
```

**Discrepancy**: Documentation says `thresholds` array, actual response has `approval_levels`

---

### 2. PATCH /quotes/settings/approval-thresholds ✅ WORKS (Different Structure)

**Request Body Structure:**
```json
{
  "thresholds": [
    {
      "level": 1,
      "amount": 10000,
      "approver_role": "Manager"
    }
  ]
}
```

**Response:**
```json
{
  "thresholds": [
    {
      "level": 1,
      "amount": 10000,
      "approver_role": "Manager"
    }
  ],
  "updated_at": "2026-01-26T05:24:31.984Z"
}
```

**Critical Discrepancy**: GET and PATCH have completely different structures!
- GET returns: `approval_levels` with `role`, `min_amount`, `max_amount`, `description`
- PATCH expects: `thresholds` with `approver_role`, `amount` (no min/max, no description)

---

### 3. GET /quotes/:quoteId/approvals ✅ WORKS

**Response Structure:**
```json
{
  "quote_id": "ddeb7a70-e5b3-4bcd-bbc5-0aaf86b484d3",
  "status": "draft",
  "approvals": [],
  "progress": {
    "completed": 0,
    "total": 0,
    "percentage": 0
  }
}
```

**Discrepancy**:
- Documentation says `quote_status`, actual is `status`
- Documentation says `progress_percent` (number), actual is `progress` (object with completed, total, percentage)

---

### 4. POST /quotes/:quoteId/submit-for-approval ❌ BACKEND ISSUE

**Error:**
```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "No approval thresholds configured for this tenant",
  "error": "Bad Request"
}
```

**Issue**: Even after successfully configuring thresholds (PATCH returned 200), submit still fails with "No approval thresholds configured". This is a backend bug.

**Cannot test further approval endpoints without fixing this:**
- POST /quotes/:quoteId/approvals/:approvalId/approve
- POST /quotes/:quoteId/approvals/:approvalId/reject
- GET /users/me/pending-approvals
- POST /quotes/:quoteId/approvals/bypass
- POST /quotes/:quoteId/approvals/reset

---

## Quotes List Endpoint

### GET /quotes ✅ WORKS

**Response Structure:**
```json
{
  "data": [
    {
      "id": "ddeb7a70-e5b3-4bcd-bbc5-0aaf86b484d3",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "quote_number": "Q-2026-1113",
      "title": "Quote 01 Teste",
      "status": "draft",
      "lead_id": "dab131e0-7fd8-4baa-a531-b5ceae3c69da",
      "vendor_id": "e302577f-4482-45c2-8078-d02281262f86",
      "jobsite_address_id": "b67edd8b-e15f-4389-a6b8-7a0efd800d6c",
      "subtotal": 90.45,
      "tax_amount": 0.58,
      "discount_amount": 81.58,
      "total": 9.44,
      "created_at": "2026-01-26T02:26:13.987Z",
      "updated_at": "2026-01-26T04:12:32.400Z",
      "lead": {
        "id": "dab131e0-7fd8-4baa-a531-b5ceae3c69da",
        "first_name": "Ludson",
        "last_name": "Aiello"
      },
      "vendor": {
        "id": "e302577f-4482-45c2-8078-d02281262f86",
        "name": "Vend3 Signature"
      },
      "jobsite_address": { /* ... */ }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 5,
    "total": 1,
    "totalPages": 1
  }
}
```

**Discrepancy**:
- Response has `data` array (not `quotes` array as expected)
- Pagination in `meta` object (not `total` at root level)

---

## Version History Endpoints

### 5. GET /quotes/:quoteId/versions ✅ WORKS

**Response Structure:**
Returns an array of versions (20 versions found in test quote):
```json
[
  {
    "id": "1fddf07d-a237-4939-bc5d-868730de9374",
    "quote_id": "ddeb7a70-e5b3-4bcd-bbc5-0aaf86b484d3",
    "version_number": 2.9,
    "snapshot_data": { /* Full quote snapshot */ },
    "created_at": "2026-01-26T04:12:32.397Z",
    "created_by_user_id": null
  }
]
```

**Note**: Returns array directly, not wrapped in object with `versions` key as documentation suggests.

---

### 6. GET /quotes/:quoteId/versions/compare?from=X&to=Y ✅ WORKS

**Query Parameters**: Expects version numbers (e.g., "2.8", "2.9"), NOT version IDs (UUIDs)

**Response Structure:**
```json
{
  "quote_id": "ddeb7a70-e5b3-4bcd-bbc5-0aaf86b484d3",
  "from_version": "2.8",
  "to_version": "2.9",
  "from_created_at": "2026-01-26T04:12:29.007Z",
  "to_created_at": "2026-01-26T04:12:32.397Z",
  "to_change_summary": "Discount rules reordered",
  "summary": {
    "items_added": 0,
    "items_removed": 0,
    "items_modified": 0,
    "groups_added": 0,
    "groups_removed": 0,
    "groups_modified": 0,
    "settings_changed": false,
    "total_change_amount": 0,
    "total_change_percent": 0
  },
  "differences": {
    "quote_settings": {},
    "items": {
      "added": [],
      "removed": [],
      "modified": []
    },
    "groups": {
      "added": [],
      "removed": [],
      "modified": []
    },
    "totals": {},
    "discount_rules": {
      "added": [],
      "removed": []
    },
    "draw_schedule": {
      "changed": false,
      "from_count": 3,
      "to_count": 3
    }
  }
}
```

**Critical Finding**: Documentation says to use version IDs in query params, but actual endpoint expects version numbers (strings like "2.8").

---

### 7. POST /quotes/:quoteId/versions/:versionNumber/restore ❌ BACKEND ERROR

**Request Body:**
```json
{
  "reason": "Testing restore functionality"
}
```

**Error:**
```json
{
  "statusCode": 500,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "[DecimalError] Invalid argument: null"
}
```

**Issue**: Backend has a decimal handling error when restoring versions.

---

## Change Orders Endpoints

### 8. GET /quotes/:parentQuoteId/change-orders ✅ WORKS

**Response Structure:**
```json
{
  "change_orders": [],
  "total_count": 0
}
```

---

### 9. POST /quotes/:parentQuoteId/change-orders ⚠️ PARTIAL WORKS

**Request Body Structure:**
```json
{
  "title": "Additional tile work",
  "description": "Customer requested additional tile in bathroom"
}
```

**Critical Discrepancy**: Documentation says to send `items_to_add` and `items_to_remove` arrays, but actual endpoint only accepts `title` and `description`. Items must be added separately using regular quote item endpoints after change order is created.

**Validation Error When Quote Not Approved:**
```json
{
  "statusCode": 400,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "Parent quote must be approved to create change order. Current status: draft"
}
```

**Note**: Cannot fully test creation without an approved quote (blocked by approval workflow bug).

---

## Summary

**Tested Endpoints:**
- ✅ 3 approval endpoints working
- ❌ 1 approval endpoint blocked by backend bug (submit-for-approval)
- ⏸️ 5 approval endpoints untestable (require approved quote)
- ✅ 2 version history endpoints working
- ❌ 1 version history endpoint has backend error (restore)
- ⏸️ 5 version history endpoints not tested yet
- ✅ 1 change order endpoint working (list)
- ⚠️ 1 change order endpoint partial (create - needs approved quote)
- ⏸️ 4 change order endpoints not tested yet

**Critical Backend Issues:**
1. ❌ Submit for approval fails even after configuring thresholds
2. ❌ Version restore has decimal handling error
3. ⚠️ GET and PATCH approval-thresholds have inconsistent structures

**Major API Documentation Discrepancies:**

| Endpoint | Documentation Says | Actual API |
|----------|-------------------|------------|
| GET approval-thresholds | Returns `thresholds` array | Returns `approval_levels` array |
| PATCH approval-thresholds | Accepts `thresholds` with complex structure | Accepts `thresholds` with simplified structure (different fields) |
| GET approval status | Returns `quote_status`, `progress_percent` | Returns `status`, `progress` object |
| GET quotes list | Returns `quotes` array, `total` at root | Returns `data` array, pagination in `meta` |
| GET versions list | Returns wrapped object | Returns array directly |
| GET version compare | Expects version IDs (UUIDs) | Expects version numbers (strings like "2.8") |
| POST create change order | Accepts `items_to_add`, `items_to_remove` | Only accepts `title`, `description` |

**Threshold Configuration Discrepancies:**

**GET Returns:**
```json
{
  "approval_levels": [
    {
      "level": 1,
      "role": "Manager",
      "min_amount": 0,
      "max_amount": 10000,
      "description": "Manager approval..."
    }
  ]
}
```

**PATCH Expects:**
```json
{
  "thresholds": [
    {
      "level": 1,
      "amount": 10000,
      "approver_role": "Manager"
    }
  ]
}
```

---

## Implementation Recommendations

### For API Client Layer:
1. Create transformation functions to handle GET vs PATCH structure differences
2. Use version numbers (not IDs) for version comparison endpoint
3. Handle change order creation in two steps: create with title/description, then add items separately
4. Implement proper error handling for backend bugs (graceful degradation)

### For UI Components:
1. Approval threshold form should use simplified PATCH structure but display GET structure
2. Version comparison should extract version numbers from version objects
3. Change order creation modal should use multi-step: step 1 = create, step 2 = add items
4. Show friendly error messages when backend returns 500 errors

### For Testing:
1. Mock responses should use actual API structures, not documentation structures
2. Test error scenarios (unapproved quotes, missing thresholds, etc.)
3. E2E tests may need to wait for backend fixes

---

**Status**: Sufficient testing completed to begin frontend implementation. Implementation will work around known backend issues.

**Next Step**: Begin Phase 1 - Create API client files with actual structures discovered during testing.
