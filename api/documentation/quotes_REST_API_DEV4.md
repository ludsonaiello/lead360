# Quote System REST API - Developer 4 (Business Logic Layer)

**Author**: Developer 4
**Date**: January 2026
**Total Endpoints**: 27
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Discount Rules Management (7 endpoints)](#discount-rules-management)
2. [Draw Schedule Management (4 endpoints)](#draw-schedule-management)
3. [Approval Workflow (8 endpoints)](#approval-workflow)
4. [Version History & Comparison (6 endpoints)](#version-history--comparison)
5. [Profitability Analysis (2 endpoints)](#profitability-analysis)
6. [Common Error Responses](#common-error-responses)

---

## Authentication

**All endpoints require authentication** via JWT Bearer token.

```http
Authorization: Bearer <jwt_token>
```

The token contains:
- `user.id` - User UUID
- `user.tenant_id` - Tenant UUID (enforced on all queries)
- `user.roles` - Array of role names

---

## Discount Rules Management

### 1. Create Discount Rule

**Endpoint**: `POST /quotes/:quoteId/discount-rules`

**Description**: Creates a new discount rule for a quote. Discount rules are applied sequentially by `order_index`. Percentage discounts are applied before fixed amounts. After creating, the quote's totals are automatically recalculated.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "rule_type": "percentage",
  "value": 10.0,
  "reason": "Volume discount",
  "apply_to": "subtotal"
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `rule_type` | string | Yes | Enum: `percentage`, `fixed_amount` | Type of discount |
| `value` | number | Yes | Min: 0, Max: 100 (percentage) or > 0 (fixed) | Discount value |
| `reason` | string | Yes | Length: 3-255 | Reason for discount |
| `apply_to` | string | No | Enum: `subtotal` (default) | What to apply discount to |

**Success Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "rule_type": "percentage",
  "value": 10.0,
  "reason": "Volume discount",
  "apply_to": "subtotal",
  "order_index": 1,
  "created_at": "2026-01-23T10:30:00Z"
}
```

**Error Responses**:
- `400` - Quote must have items / Quote is approved (cannot modify) / Invalid value range
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**:
- Recalculates quote totals (subtotal, discount_amount, tax_amount, total)
- Creates version snapshot (+0.1 minor version)
- Logs audit trail

---

### 2. List Discount Rules

**Endpoint**: `GET /quotes/:quoteId/discount-rules`

**Description**: Returns all discount rules for a quote, ordered by `order_index`.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "rules": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "rule_type": "percentage",
      "value": 10.0,
      "reason": "Volume discount",
      "apply_to": "subtotal",
      "order_index": 1,
      "created_at": "2026-01-23T10:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "rule_type": "fixed_amount",
      "value": 500.0,
      "reason": "Early payment discount",
      "apply_to": "subtotal",
      "order_index": 2,
      "created_at": "2026-01-23T10:35:00Z"
    }
  ],
  "total_discount_amount": 5500.0,
  "count": 2
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

---

### 3. Get Specific Discount Rule

**Endpoint**: `GET /quotes/:quoteId/discount-rules/:ruleId`

**Description**: Returns details of a specific discount rule.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Rule UUID

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "rule_type": "percentage",
  "value": 10.0,
  "reason": "Volume discount",
  "apply_to": "subtotal",
  "order_index": 1,
  "created_at": "2026-01-23T10:30:00Z"
}
```

**Error Responses**:
- `404` - Rule not found
- `403` - Insufficient permissions

---

### 4. Update Discount Rule

**Endpoint**: `PATCH /quotes/:quoteId/discount-rules/:ruleId`

**Description**: Updates an existing discount rule. All fields are optional. Recalculates quote totals after update.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Rule UUID

**Request Body**:
```json
{
  "rule_type": "percentage",
  "value": 15.0,
  "reason": "Updated volume discount"
}
```

**Request Fields** (all optional):
| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `rule_type` | string | Enum: `percentage`, `fixed_amount` | Type of discount |
| `value` | number | Min: 0 | Discount value |
| `reason` | string | Length: 3-255 | Reason for discount |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "rule_type": "percentage",
  "value": 15.0,
  "reason": "Updated volume discount",
  "apply_to": "subtotal",
  "order_index": 1,
  "created_at": "2026-01-23T10:30:00Z"
}
```

**Error Responses**:
- `400` - Quote is approved (cannot modify) / Invalid value range
- `404` - Rule not found
- `403` - Insufficient permissions

**Side Effects**:
- Recalculates quote totals
- Creates version snapshot (+0.1)
- Logs audit trail

---

### 5. Delete Discount Rule

**Endpoint**: `DELETE /quotes/:quoteId/discount-rules/:ruleId`

**Description**: Hard deletes a discount rule. Recalculates quote totals (total will increase).

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Rule UUID

**Success Response** (204 No Content)

**Error Responses**:
- `400` - Quote is approved (cannot modify)
- `404` - Rule not found
- `403` - Insufficient permissions

**Side Effects**:
- Recalculates quote totals (discount_amount decreases, total increases)
- Creates version snapshot (+0.1)
- Logs audit trail

---

### 6. Reorder Discount Rules

**Endpoint**: `PATCH /quotes/:quoteId/discount-rules/reorder`

**Description**: Changes the application order of discount rules. Order matters because percentage discounts compound. Recalculates totals after reordering.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "discount_rules": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "new_order_index": 2
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "new_order_index": 1
    }
  ]
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `discount_rules` | array | Yes | Array of rule reorders |
| `discount_rules[].id` | UUID | Yes | Rule UUID |
| `discount_rules[].new_order_index` | number | Yes | New order (1-based) |

**Success Response** (200 OK):
```json
{
  "message": "Discount rules reordered successfully",
  "rules": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "order_index": 1
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "order_index": 2
    }
  ]
}
```

**Error Responses**:
- `400` - Quote is approved / Invalid rule IDs / Duplicate order indexes
- `404` - Quote or rule not found
- `403` - Insufficient permissions

**Side Effects**:
- Recalculates quote totals (order affects percentage compounding)
- Creates version snapshot (+0.1)
- Logs audit trail

---

### 7. Preview Discount Impact

**Endpoint**: `POST /quotes/:quoteId/discount-rules/preview`

**Description**: Calculates the impact of a proposed discount WITHOUT saving to database. Used for "what-if" scenarios.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "rule_type": "percentage",
  "value": 10.0
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `rule_type` | string | Yes | Enum: `percentage`, `fixed_amount` | Type of discount |
| `value` | number | Yes | Min: 0 | Discount value |

**Success Response** (200 OK):
```json
{
  "current_total": 50000.0,
  "proposed_discount_amount": 5000.0,
  "new_total": 45000.0,
  "impact_amount": 5000.0,
  "impact_percent": 10.0,
  "current_margin_percent": 25.0,
  "new_margin_percent": 20.0,
  "margin_change": -5.0,
  "warning": "Margin will drop below target of 25%"
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**: None (read-only operation)

---

## Draw Schedule Management

### 8. Create Draw Schedule

**Endpoint**: `POST /quotes/:quoteId/draw-schedule`

**Description**: Creates a payment draw schedule for the quote. Replaces any existing schedule. Validates that percentage entries sum to 100% or fixed amounts are close to quote total (±5%).

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "calculation_type": "percentage",
  "entries": [
    {
      "draw_number": 1,
      "description": "Initial deposit",
      "value": 30.0
    },
    {
      "draw_number": 2,
      "description": "Midpoint payment",
      "value": 40.0
    },
    {
      "draw_number": 3,
      "description": "Final payment",
      "value": 30.0
    }
  ]
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `calculation_type` | string | Yes | Enum: `percentage`, `fixed_amount` | Calculation method |
| `entries` | array | Yes | Length: 1-10 | Draw schedule entries |
| `entries[].draw_number` | number | Yes | Min: 1, Sequential | Draw number (1, 2, 3...) |
| `entries[].description` | string | Yes | Length: 5-255 | What this payment covers |
| `entries[].value` | number | Yes | Min: 0 | Percentage (0-100) or dollar amount |

**Validation Rules**:
- Percentage entries must sum to 100% (±0.01% tolerance)
- Fixed amount entries should equal quote.total (warning if >5% variance)
- Draw numbers must be sequential (1, 2, 3...)
- Cannot have more than 10 entries

**Success Response** (201 Created):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "calculation_type": "percentage",
  "entries": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "draw_number": 1,
      "description": "Initial deposit",
      "value": 30.0,
      "order_index": 1,
      "created_at": "2026-01-23T11:00:00Z"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "draw_number": 2,
      "description": "Midpoint payment",
      "value": 40.0,
      "order_index": 2,
      "created_at": "2026-01-23T11:00:00Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440002",
      "draw_number": 3,
      "description": "Final payment",
      "value": 30.0,
      "order_index": 3,
      "created_at": "2026-01-23T11:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `400` - Percentage entries don't sum to 100% / Draw numbers not sequential / Too many entries
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**:
- Deletes existing draw schedule entries
- Creates version snapshot (+0.1)

---

### 9. Get Draw Schedule

**Endpoint**: `GET /quotes/:quoteId/draw-schedule`

**Description**: Returns the draw schedule with calculated amounts and running totals based on current quote total.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_total": 50000.0,
  "calculation_type": "percentage",
  "entries": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440000",
      "draw_number": 1,
      "description": "Initial deposit",
      "value": 30.0,
      "calculated_amount": 15000.0,
      "running_total": 15000.0,
      "percentage_of_total": 30.0,
      "created_at": "2026-01-23T11:00:00Z"
    },
    {
      "id": "880e8400-e29b-41d4-a716-446655440001",
      "draw_number": 2,
      "description": "Midpoint payment",
      "value": 40.0,
      "calculated_amount": 20000.0,
      "running_total": 35000.0,
      "percentage_of_total": 70.0,
      "created_at": "2026-01-23T11:00:00Z"
    },
    {
      "id": "990e8400-e29b-41d4-a716-446655440002",
      "draw_number": 3,
      "description": "Final payment",
      "value": 30.0,
      "calculated_amount": 15000.0,
      "running_total": 50000.0,
      "percentage_of_total": 100.0,
      "created_at": "2026-01-23T11:00:00Z"
    }
  ],
  "validation": {
    "is_valid": true,
    "percentage_sum": 100.0,
    "amount_sum": 50000.0,
    "variance": 0.0,
    "variance_percent": 0.0
  }
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `calculated_amount` | number | Dollar amount for this draw (value × quote_total ÷ 100 for percentage) |
| `running_total` | number | Cumulative total through this draw |
| `percentage_of_total` | number | Cumulative percentage of quote total |

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Empty Schedule Response**:
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_total": 50000.0,
  "calculation_type": null,
  "entries": [],
  "validation": {
    "is_valid": true,
    "percentage_sum": null,
    "amount_sum": null,
    "variance": null
  }
}
```

---

### 10. Update Draw Schedule

**Endpoint**: `PATCH /quotes/:quoteId/draw-schedule`

**Description**: Updates the entire draw schedule (replaces all entries). Same logic as create.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**: Same as [Create Draw Schedule](#8-create-draw-schedule)

**Success Response** (200 OK): Same as Create

**Error Responses**: Same as Create

**Side Effects**:
- Deletes existing draw schedule entries
- Creates version snapshot (+0.1)

---

### 11. Delete Draw Schedule

**Endpoint**: `DELETE /quotes/:quoteId/draw-schedule`

**Description**: Removes all draw schedule entries for the quote.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (204 No Content)

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**:
- Hard deletes all draw_schedule_entry records
- Creates version snapshot (+0.1)

---

## Approval Workflow

### 12. Submit Quote for Approval

**Endpoint**: `POST /quotes/:quoteId/submit-for-approval`

**Description**: Submits quote for approval workflow. Determines required approval levels based on quote total and tenant thresholds. Creates approval records and changes quote status to `pending_approval`.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**: None

**Business Logic**:
1. Validates quote has items, vendor, and jobsite address
2. Fetches tenant approval thresholds from `tenant.approval_thresholds` JSON column
3. Filters thresholds where `quote.total >= threshold.amount`
4. Creates `quote_approval` records for each required level
5. Finds approver user by role (first active user with role in tenant)
6. Sets quote status to `pending_approval`

**Default Thresholds** (if not configured):
```json
[
  { "level": 1, "amount": 10000, "approver_role": "Manager" },
  { "level": 2, "amount": 50000, "approver_role": "Owner" }
]
```

**Example**: Quote total = $75,000
- Requires Level 1 (Manager) - amount >= $10,000
- Requires Level 2 (Owner) - amount >= $50,000

**Success Response** (201 Created):
```json
{
  "quote": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "pending_approval",
    "total": 75000.0
  },
  "approvals": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "quote_id": "123e4567-e89b-12d3-a456-426614174000",
      "approval_level": 1,
      "approver_user_id": "user-manager-uuid",
      "approver_name": "John Manager",
      "status": "pending",
      "created_at": "2026-01-23T12:00:00Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440001",
      "quote_id": "123e4567-e89b-12d3-a456-426614174000",
      "approval_level": 2,
      "approver_user_id": "user-owner-uuid",
      "approver_name": "Jane Owner",
      "status": "pending",
      "created_at": "2026-01-23T12:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `400` - Quote must have items / Quote must have vendor / Quote must have jobsite address / Already submitted / No approval thresholds configured
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**:
- Creates `quote_approval` records (status = `pending`)
- Updates `quote.status` to `pending_approval`
- Creates version snapshot (+1.0 major version)
- TODO: Send notification to first level approver

---

### 13. Approve Quote

**Endpoint**: `POST /quotes/:quoteId/approvals/:approvalId/approve`

**Description**: Approves a specific approval level. Validates user is the assigned approver. Checks sequential approval (previous level must be approved first). If all levels approved, sets quote status to `ready`.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `approvalId` (UUID, required) - Approval UUID

**Request Body**:
```json
{
  "comments": "Pricing looks good, approved."
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `comments` | string | No | Max: 1000 | Optional approval comments |

**Sequential Approval Logic**:
- Level 1 can approve immediately
- Level 2 can only approve if Level 1 is approved
- Level 3 can only approve if Level 2 is approved
- Etc.

**Success Response** (201 Created):
```json
{
  "approval": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "approval_level": 1,
    "status": "approved",
    "comments": "Pricing looks good, approved.",
    "decided_at": "2026-01-23T12:30:00Z"
  },
  "quote_status": "pending_approval",
  "remaining_approvals": 1,
  "all_approved": false
}
```

**If all approvals complete**:
```json
{
  "approval": {
    "id": "bb0e8400-e29b-41d4-a716-446655440001",
    "approval_level": 2,
    "status": "approved",
    "comments": "Final approval granted.",
    "decided_at": "2026-01-23T13:00:00Z"
  },
  "quote_status": "ready",
  "remaining_approvals": 0,
  "all_approved": true,
  "message": "All approvals complete - quote is ready"
}
```

**Error Responses**:
- `403` - You are not the assigned approver
- `400` - Approval already decided / Previous level not approved yet
- `404` - Approval not found

**Side Effects**:
- Updates `quote_approval.status` to `approved`
- Sets `quote_approval.decided_at` to now
- If all approved: Updates `quote.status` to `ready` (+1.0 version)
- If more needed: Creates version (+0.1)
- TODO: Notify next level approver or quote creator

---

### 14. Reject Quote

**Endpoint**: `POST /quotes/:quoteId/approvals/:approvalId/reject`

**Description**: Rejects the quote. Requires comments explaining rejection. Terminates entire approval workflow - marks ALL approvals as rejected and returns quote to `draft` status.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `approvalId` (UUID, required) - Approval UUID

**Request Body**:
```json
{
  "comments": "Pricing is too high, needs revision."
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `comments` | string | Yes | Length: 10-1000 | Required rejection reason |

**Success Response** (201 Created):
```json
{
  "approval": {
    "id": "aa0e8400-e29b-41d4-a716-446655440000",
    "approval_level": 1,
    "status": "rejected",
    "comments": "Pricing is too high, needs revision.",
    "decided_at": "2026-01-23T12:30:00Z"
  },
  "quote_status": "draft",
  "message": "Quote rejected - returned to draft status"
}
```

**Error Responses**:
- `403` - You are not the assigned approver
- `400` - Approval already decided / Comments required
- `404` - Approval not found

**Side Effects**:
- Updates THIS approval: status = `rejected`, decided_at = now
- Updates ALL OTHER approvals: status = `rejected`
- Updates `quote.status` to `draft`
- Creates version snapshot (+1.0 major)
- TODO: Notify quote creator with rejection reason

---

### 15. Get Approval Status

**Endpoint**: `GET /quotes/:quoteId/approvals`

**Description**: Returns all approvals for the quote with progress information.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_status": "pending_approval",
  "approvals": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "approval_level": 1,
      "status": "approved",
      "approver": {
        "id": "user-manager-uuid",
        "name": "John Manager",
        "email": "john@company.com"
      },
      "comments": "Pricing looks good, approved.",
      "decided_at": "2026-01-23T12:30:00Z",
      "created_at": "2026-01-23T12:00:00Z"
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440001",
      "approval_level": 2,
      "status": "pending",
      "approver": {
        "id": "user-owner-uuid",
        "name": "Jane Owner",
        "email": "jane@company.com"
      },
      "comments": null,
      "decided_at": null,
      "created_at": "2026-01-23T12:00:00Z"
    }
  ],
  "progress": {
    "total_levels": 2,
    "approved_levels": 1,
    "progress_percent": 50.0,
    "current_level": 2
  }
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

---

### 16. Get Pending Approvals for User

**Endpoint**: `GET /users/me/pending-approvals`

**Description**: Returns all quotes awaiting approval by the current user.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**: None

**Success Response** (200 OK):
```json
{
  "pending_approvals": [
    {
      "approval_id": "aa0e8400-e29b-41d4-a716-446655440000",
      "approval_level": 1,
      "quote": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "quote_number": "Q-2026-001",
        "title": "Office Renovation Project",
        "total": 75000.0,
        "customer_name": "John Doe"
      },
      "created_at": "2026-01-23T12:00:00Z"
    },
    {
      "approval_id": "cc0e8400-e29b-41d4-a716-446655440002",
      "approval_level": 2,
      "quote": {
        "id": "456e7890-e89b-12d3-a456-426614174001",
        "quote_number": "Q-2026-002",
        "title": "Warehouse Expansion",
        "total": 125000.0,
        "customer_name": "Jane Smith"
      },
      "created_at": "2026-01-23T11:00:00Z"
    }
  ],
  "count": 2
}
```

**Error Responses**:
- `403` - Insufficient permissions

---

### 17. Bypass Approval (Owner Override)

**Endpoint**: `POST /quotes/:quoteId/approvals/bypass`

**Description**: Owner override that bypasses the entire approval workflow. Marks all approvals as approved and sets quote status to `ready`. Only owners can use this endpoint.

**Roles**: `Owner` (ONLY)

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "reason": "Emergency approval needed for urgent project"
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `reason` | string | Yes | Length: 10-500 | Reason for bypass |

**Success Response** (201 Created):
```json
{
  "message": "Approval bypassed successfully",
  "quote": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "ready"
  },
  "approvals_bypassed": 2
}
```

**Error Responses**:
- `403` - Only owners can bypass approval
- `400` - Quote is not pending approval
- `404` - Quote not found

**Side Effects**:
- Updates ALL approvals: status = `approved`, comments = "Bypassed: {reason}", decided_at = now
- Updates `quote.status` to `ready`
- Creates version snapshot (+1.0 major)
- Logs audit trail with bypass reason

---

### 18. Configure Approval Thresholds

**Endpoint**: `PATCH /quotes/settings/approval-thresholds`

**Description**: Configures tenant-wide approval thresholds. Defines which approval levels are required based on quote amounts.

**Roles**: `Owner`, `Admin`

**Path Parameters**: None

**Request Body**:
```json
{
  "approval_thresholds": [
    {
      "level": 1,
      "amount": 10000,
      "approver_role": "Manager"
    },
    {
      "level": 2,
      "amount": 50000,
      "approver_role": "Admin"
    },
    {
      "level": 3,
      "amount": 100000,
      "approver_role": "Owner"
    }
  ]
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `approval_thresholds` | array | Yes | Length: 1-5 | Threshold configuration |
| `approval_thresholds[].level` | number | Yes | Sequential (1, 2, 3...) | Approval level |
| `approval_thresholds[].amount` | number | Yes | Ascending order | Minimum quote amount |
| `approval_thresholds[].approver_role` | string | Yes | Valid role name | Role that approves this level |

**Validation Rules**:
- Levels must be sequential (1, 2, 3...)
- Amounts must be in ascending order
- Approver roles must exist in system
- Maximum 5 levels

**Success Response** (200 OK):
```json
{
  "message": "Approval thresholds updated successfully",
  "approval_thresholds": [
    {
      "level": 1,
      "amount": 10000,
      "approver_role": "Manager"
    },
    {
      "level": 2,
      "amount": 50000,
      "approver_role": "Admin"
    },
    {
      "level": 3,
      "amount": 100000,
      "approver_role": "Owner"
    }
  ]
}
```

**Error Responses**:
- `400` - Amounts must be ascending / Levels must be sequential / Invalid role
- `403` - Insufficient permissions

**Side Effects**:
- Updates `tenant.approval_thresholds` JSON column
- Affects future quote submissions (existing approvals unchanged)

---

### 19. Reset Approvals

**Endpoint**: `POST /quotes/:quoteId/approvals/reset`

**Description**: Resets the approval workflow. Deletes all approval records and returns quote to `draft` status. Used when quote is modified after submission.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**: None

**Success Response** (201 Created):
```json
{
  "message": "Approvals reset successfully",
  "quote": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "status": "draft"
  },
  "approvals_deleted": 2
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Side Effects**:
- Hard deletes all `quote_approval` records
- Updates `quote.status` to `draft`
- Creates version snapshot (+1.0 major)

**Use Case**: Quote was submitted for approval, but then customer requested changes. Reset approvals, modify quote, resubmit.

---

## Version History & Comparison

### 20. List Quote Versions

**Endpoint**: `GET /quotes/:quoteId/versions`

**Description**: Returns all version snapshots for a quote, ordered by creation date (newest first).

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "versions": [
    {
      "id": "version-uuid-3",
      "version_number": 2.0,
      "change_summary": "All approvals complete - quote ready",
      "created_at": "2026-01-23T13:00:00Z",
      "snapshot_data": "{...}"
    },
    {
      "id": "version-uuid-2",
      "version_number": 1.5,
      "change_summary": "Discount added: Volume discount",
      "created_at": "2026-01-23T10:30:00Z",
      "snapshot_data": "{...}"
    },
    {
      "id": "version-uuid-1",
      "version_number": 1.0,
      "change_summary": "Initial version",
      "created_at": "2026-01-23T09:00:00Z",
      "snapshot_data": "{...}"
    }
  ],
  "count": 3
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `version_number` | number | Version number (1.0, 1.1, 2.0, etc.) |
| `change_summary` | string | Human-readable change description |
| `snapshot_data` | string | JSON snapshot of entire quote state |

**Snapshot Contents**:
- Complete quote details
- All items with costs
- All groups
- Discount rules
- Draw schedule
- Jobsite address
- Vendor info
- Lead info

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

---

### 21. Get Specific Version

**Endpoint**: `GET /quotes/:quoteId/versions/:versionId`

**Description**: Returns a specific version snapshot with full quote state.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionId` (UUID, required) - Version UUID

**Success Response** (200 OK):
```json
{
  "id": "version-uuid-2",
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "version_number": 1.5,
  "change_summary": "Discount added: Volume discount",
  "created_at": "2026-01-23T10:30:00Z",
  "snapshot_data": {
    "quote": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "Office Renovation",
      "status": "draft",
      "subtotal": 50000.0,
      "discount_amount": 5000.0,
      "tax_amount": 3600.0,
      "total": 48600.0,
      "custom_profit_percent": 15.0,
      "custom_overhead_percent": 10.0,
      "custom_contingency_percent": 5.0
    },
    "items": [
      {
        "id": "item-uuid-1",
        "title": "Flooring Installation",
        "quantity": 1000,
        "total_cost": 10000.0,
        "quote_group": {
          "id": "group-uuid-1",
          "name": "Floor Work"
        }
      }
    ],
    "groups": [
      {
        "id": "group-uuid-1",
        "name": "Floor Work",
        "description": "All flooring related work"
      }
    ],
    "discount_rules": [
      {
        "id": "rule-uuid-1",
        "rule_type": "percentage",
        "value": 10.0,
        "reason": "Volume discount"
      }
    ],
    "draw_schedule": [],
    "jobsite_address": {...},
    "vendor": {...},
    "lead": {...}
  }
}
```

**Error Responses**:
- `404` - Version not found
- `403` - Insufficient permissions

---

### 22. Compare Two Versions

**Endpoint**: `GET /quotes/:quoteId/versions/compare`

**Description**: Compares two versions and shows detailed differences (added/removed/modified items, groups, settings, totals).

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Query Parameters**:
| Parameter | Type | Required | Example | Description |
|-----------|------|----------|---------|-------------|
| `from` | string | Yes | `1.0` | Source version number |
| `to` | string | Yes | `1.5` | Target version number |

**Example Request**:
```
GET /quotes/123e4567-e89b-12d3-a456-426614174000/versions/compare?from=1.0&to=1.5
```

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "from_version": "1.0",
  "to_version": "1.5",
  "from_created_at": "2026-01-23T09:00:00Z",
  "to_created_at": "2026-01-23T10:30:00Z",
  "to_change_summary": "Discount added: Volume discount",
  "summary": {
    "items_added": 2,
    "items_removed": 0,
    "items_modified": 3,
    "groups_added": 1,
    "groups_removed": 0,
    "groups_modified": 0,
    "settings_changed": true,
    "total_change_amount": -1400.0,
    "total_change_percent": -2.8
  },
  "differences": {
    "quote_settings": {
      "custom_profit_percent": {
        "from": 15.0,
        "to": 18.0
      }
    },
    "items": {
      "added": [
        {
          "id": "item-uuid-5",
          "title": "Paint Supplies",
          "quantity": 50,
          "total_cost": 500.0,
          "group_name": "Painting"
        }
      ],
      "removed": [],
      "modified": [
        {
          "id": "item-uuid-1",
          "title": "Flooring Installation",
          "changes": {
            "quantity": {
              "from": 1000,
              "to": 1200
            },
            "total_cost": {
              "from": 10000.0,
              "to": 12000.0
            }
          }
        }
      ]
    },
    "groups": {
      "added": [
        {
          "id": "group-uuid-2",
          "name": "Painting",
          "description": "All painting work",
          "item_count": 3
        }
      ],
      "removed": [],
      "modified": []
    },
    "totals": {
      "subtotal": {
        "from": 50000.0,
        "to": 52000.0,
        "change": 2000.0
      },
      "discount_amount": {
        "from": 0.0,
        "to": 5000.0,
        "change": 5000.0
      },
      "total": {
        "from": 50000.0,
        "to": 48600.0,
        "change": -1400.0
      }
    },
    "discount_rules": {
      "added": [
        {
          "id": "rule-uuid-1",
          "rule_type": "percentage",
          "value": 10.0,
          "reason": "Volume discount"
        }
      ],
      "removed": []
    },
    "draw_schedule": {
      "changed": false
    }
  }
}
```

**Error Responses**:
- `400` - Invalid version numbers
- `404` - Quote or version not found
- `403` - Insufficient permissions

---

### 23. Restore Previous Version

**Endpoint**: `POST /quotes/:quoteId/versions/:versionNumber/restore`

**Description**: Restores quote to a previous version. Creates backup of current state first, then recreates all items, groups, discount rules, and draw schedule from snapshot.

**Roles**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionNumber` (string, required) - Version to restore (e.g., "1.5")

**Request Body**:
```json
{
  "reason": "Customer requested revert to original pricing"
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | No | Optional reason for restore |

**Success Response** (201 Created):
```json
{
  "success": true,
  "message": "Quote restored to version 1.5",
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "restored_version": "1.5"
}
```

**Error Responses**:
- `400` - Cannot restore approved quote (change status first)
- `404` - Quote or version not found
- `403` - Insufficient permissions

**Side Effects**:
- Creates backup version (+1.0) before restore
- Deletes current items, groups, discount rules, draw schedule
- Recreates everything from snapshot (with new UUIDs to avoid conflicts)
- Updates quote settings (profit, overhead, contingency, totals)
- Sets `quote.status` to `draft` (restored quotes need review)
- Creates restore version (+1.0)

**Important Notes**:
- Group IDs change (new UUIDs), but items re-associate by matching order_index
- Approval records are NOT restored (would need resubmission)
- Cannot restore to approved quote (must change status first)

---

### 24. Get Version Timeline

**Endpoint**: `GET /quotes/:quoteId/versions/timeline`

**Description**: Returns version history grouped by date for UI timeline display.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "total_versions": 5,
  "timeline": {
    "2026-01-23": [
      {
        "id": "version-uuid-5",
        "version_number": 2.0,
        "change_summary": "All approvals complete",
        "created_at": "2026-01-23T13:00:00Z"
      },
      {
        "id": "version-uuid-4",
        "version_number": 1.5,
        "change_summary": "Discount added",
        "created_at": "2026-01-23T10:30:00Z"
      },
      {
        "id": "version-uuid-3",
        "version_number": 1.0,
        "change_summary": "Initial version",
        "created_at": "2026-01-23T09:00:00Z"
      }
    ],
    "2026-01-22": [
      {
        "id": "version-uuid-2",
        "version_number": 0.5,
        "change_summary": "Items added",
        "created_at": "2026-01-22T16:00:00Z"
      }
    ]
  }
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

---

### 25. Get Version Change Summary

**Endpoint**: `GET /quotes/:quoteId/versions/:versionNumber/summary`

**Description**: Returns a human-readable summary of what changed in this version compared to the previous version.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionNumber` (string, required) - Version number (e.g., "1.5")

**Success Response** (200 OK):
```json
{
  "version_number": "1.5",
  "change_summary": "Discount added: Volume discount",
  "created_at": "2026-01-23T10:30:00Z",
  "previous_version": 1.0,
  "summary": "2 items added, 3 items modified, 1 groups added, Quote settings changed, Total decreased by $1400.00 (2.80%)",
  "details": {
    "items": {
      "added": [...],
      "removed": [],
      "modified": [...]
    },
    "groups": {...},
    "totals": {...},
    "discount_rules": {...}
  }
}
```

**Initial Version Response** (no previous version):
```json
{
  "version_number": "1.0",
  "change_summary": "Initial version",
  "created_at": "2026-01-23T09:00:00Z",
  "summary": "Initial version - no previous version to compare"
}
```

**Error Responses**:
- `404` - Quote or version not found
- `403` - Insufficient permissions

---

## Profitability Analysis

### 26. Validate Profitability

**Endpoint**: `GET /quotes/:quoteId/profitability/validate`

**Description**: Validates quote profitability and warns if margins are too low. Uses tenant-specific thresholds or defaults. Returns warning level (green/yellow/red/blocked) with recommendations.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Margin Calculation**:
```
Total Cost = SUM(all quote_item.total_cost)
Total Revenue = quote.total
Gross Profit = Total Revenue - Total Cost
Margin % = (Gross Profit / Total Revenue) × 100
```

**Default Thresholds** (if not configured):
```json
{
  "target": 25.0,     // Green: >= 25%
  "minimum": 15.0,    // Yellow: 15-25%
  "hard_floor": 10.0  // Red: >= 10%, Blocked: < 10%
}
```

**Warning Levels**:
- **Green**: Margin >= target (25%) - Excellent profitability
- **Yellow**: Margin >= minimum (15%) but < target - Below target
- **Red**: Margin >= hard_floor (10%) but < minimum - Review carefully
- **Blocked**: Margin < hard_floor (10%) - Cannot send without admin override

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "is_valid": true,
  "can_send": true,
  "margin_percent": 22.5,
  "warning_level": "yellow",
  "thresholds": {
    "target": 25.0,
    "minimum": 15.0,
    "hard_floor": 10.0
  },
  "financial_summary": {
    "total_cost": 40000.0,
    "total_revenue": 51600.0,
    "gross_profit": 11600.0,
    "discount_amount": 5000.0,
    "tax_amount": 3600.0,
    "subtotal_before_discount": 56600.0
  },
  "warnings": [
    "Margin (22.50%) is below target (25.00%). Consider increasing markup or reducing costs."
  ],
  "recommendations": [
    "Review markup settings",
    "Negotiate better vendor pricing",
    "Optimize labor estimates"
  ]
}
```

**Blocked Example** (margin < 10%):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "is_valid": false,
  "can_send": false,
  "margin_percent": 8.5,
  "warning_level": "blocked",
  "thresholds": {
    "target": 25.0,
    "minimum": 15.0,
    "hard_floor": 10.0
  },
  "financial_summary": {
    "total_cost": 45000.0,
    "total_revenue": 49180.0,
    "gross_profit": 4180.0,
    "discount_amount": 5000.0,
    "tax_amount": 3600.0,
    "subtotal_before_discount": 50580.0
  },
  "warnings": [
    "Margin (8.50%) is below hard floor (10.00%). Cannot send without admin override.",
    "High discount applied (9.88%) - further reducing margin"
  ],
  "recommendations": [
    "CRITICAL: This quote will lose money",
    "Increase total significantly or reject quote",
    "Contact admin for override if necessary"
  ]
}
```

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Additional Warnings**:
- High discount warning if discount > 10% of subtotal
- Checks if quote has items (returns error if empty)

---

### 27. Analyze Margins

**Endpoint**: `GET /quotes/:quoteId/profitability/analysis`

**Description**: Provides detailed margin analysis per item and per group. Identifies low-margin and high-margin items with recommendations.

**Roles**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Margin Calculation Per Item**:
```
Item Cost = quote_item.total_cost
Item Price (before discount) = Cost × Markup Multiplier
Markup Multiplier = (1 + profit%) × (1 + overhead%) × (1 + contingency%)
Margin % = ((Price - Cost) / Price) × 100
```

**Success Response** (200 OK):
```json
{
  "quote_id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_total": 51600.0,
  "overall_margin_percent": 22.5,
  "markup_settings": {
    "profit_percent": 18.0,
    "overhead_percent": 10.0,
    "contingency_percent": 5.0,
    "total_markup_multiplier": 1.3671
  },
  "items_analysis": [
    {
      "item_id": "item-uuid-1",
      "title": "Flooring Installation",
      "group_name": "Floor Work",
      "quantity": 1200,
      "unit": "sqft",
      "cost": 12000.0,
      "price_before_discount": 16405.2,
      "profit": 4405.2,
      "margin_percent": 26.85,
      "status": "healthy"
    },
    {
      "item_id": "item-uuid-2",
      "title": "Labor - Demolition",
      "group_name": "Demolition",
      "quantity": 40,
      "unit": "hours",
      "cost": 2000.0,
      "price_before_discount": 2734.2,
      "profit": 734.2,
      "margin_percent": 26.85,
      "status": "healthy"
    },
    {
      "item_id": "item-uuid-3",
      "title": "Equipment Rental",
      "group_name": "Equipment",
      "quantity": 5,
      "unit": "days",
      "cost": 2500.0,
      "price_before_discount": 3417.75,
      "profit": 917.75,
      "margin_percent": 26.85,
      "status": "healthy"
    },
    {
      "item_id": "item-uuid-4",
      "title": "Subcontractor - Electrical",
      "group_name": "Electrical",
      "quantity": 1,
      "unit": "job",
      "cost": 22000.0,
      "price_before_discount": 30076.2,
      "profit": 8076.2,
      "margin_percent": 26.85,
      "status": "healthy"
    },
    {
      "item_id": "item-uuid-5",
      "title": "Materials - Discounted",
      "group_name": "Materials",
      "quantity": 1,
      "unit": "lot",
      "cost": 1500.0,
      "price_before_discount": 2050.65,
      "profit": 550.65,
      "margin_percent": 26.85,
      "status": "healthy"
    }
  ],
  "groups_analysis": [
    {
      "group_id": "group-uuid-1",
      "name": "Floor Work",
      "item_count": 1,
      "total_cost": 12000.0,
      "total_price": 16405.2,
      "margin_percent": 26.85
    },
    {
      "group_id": "group-uuid-2",
      "name": "Demolition",
      "item_count": 1,
      "total_cost": 2000.0,
      "total_price": 2734.2,
      "margin_percent": 26.85
    },
    {
      "group_id": "group-uuid-3",
      "name": "Equipment",
      "item_count": 1,
      "total_cost": 2500.0,
      "total_price": 3417.75,
      "margin_percent": 26.85
    },
    {
      "group_id": "group-uuid-4",
      "name": "Electrical",
      "item_count": 1,
      "total_cost": 22000.0,
      "total_price": 30076.2,
      "margin_percent": 26.85
    }
  ],
  "low_margin_items": [
    {
      "item_id": "item-uuid-6",
      "title": "Special Order Materials",
      "margin_percent": 8.5,
      "cost": 5000.0,
      "price_before_discount": 5465.0,
      "recommendation": "CRITICAL: Increase markup or reduce costs immediately"
    }
  ],
  "high_margin_items": [
    {
      "item_id": "item-uuid-7",
      "title": "Consultation Fee",
      "margin_percent": 75.0,
      "cost": 250.0,
      "price_before_discount": 1000.0,
      "recommendation": "Very high margin - verify pricing is competitive"
    }
  ],
  "summary": {
    "total_items": 7,
    "healthy_items": 5,
    "acceptable_items": 0,
    "low_margin_items": 1,
    "critical_items": 1
  }
}
```

**Item Status Categories**:
- **Healthy**: Margin >= 25%
- **Acceptable**: Margin >= 15% and < 25%
- **Low Margin**: Margin >= 10% and < 15%
- **Critical**: Margin < 10%

**Error Responses**:
- `404` - Quote not found
- `403` - Insufficient permissions

**Response Notes**:
- `price_before_discount` is calculated using markup multiplier (before discounts applied at quote level)
- `low_margin_items` are sorted by margin (lowest first)
- `high_margin_items` are items with margin > 50% (sorted by margin descending)
- Uses tenant's default markup settings or quote's custom settings

---

## Common Error Responses

### Error Format

All errors follow this format:
```json
{
  "statusCode": 400,
  "message": "Detailed error message",
  "error": "Bad Request"
}
```

### HTTP Status Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `200` | OK | Successful GET/PATCH |
| `201` | Created | Successful POST |
| `204` | No Content | Successful DELETE |
| `400` | Bad Request | Validation errors, business rule violations |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | User lacks required role |
| `404` | Not Found | Resource doesn't exist or doesn't belong to tenant |
| `500` | Internal Server Error | Unexpected server error |

### Common Error Messages

**Authentication**:
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

**Insufficient Permissions**:
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**Quote Not Found**:
```json
{
  "statusCode": 404,
  "message": "Quote not found",
  "error": "Not Found"
}
```

**Validation Error**:
```json
{
  "statusCode": 400,
  "message": [
    "value must be a positive number",
    "reason must be longer than or equal to 3 characters"
  ],
  "error": "Bad Request"
}
```

**Business Rule Violation**:
```json
{
  "statusCode": 400,
  "message": "Cannot modify approved quote",
  "error": "Bad Request"
}
```

---

## Multi-Tenant Isolation

**Critical Security Requirement**: All endpoints enforce tenant isolation.

Every database query includes `tenant_id` filter derived from JWT token:
```typescript
where: { id: quoteId, tenant_id: req.user.tenant_id }
```

**Never pass tenant_id from client** - it's extracted server-side from authenticated user's token.

**Middleware**: `TenantMiddleware` validates tenant_id on every request.

---

## Transaction Patterns

All mutations follow this pattern:
```typescript
await this.prisma.$transaction(async (tx) => {
  // 1. Mutate data
  // 2. Recalculate pricing (if needed)
  // 3. Create version snapshot
});
// 4. Log audit trail (outside transaction - non-blocking)
```

---

## Version Tracking

**Version increments**:
- **+0.1** (minor): Item/group/discount/draw schedule changes
- **+1.0** (major): Status changes (submit, approve, reject, restore)

**Snapshots include**:
- Complete quote state
- All items with costs
- All groups
- Discount rules
- Draw schedule
- Related data (vendor, lead, address)

---

## Audit Logging

All mutations create audit log entries:
```typescript
action: 'created' | 'updated' | 'deleted'
entityType: 'discount_rule' | 'draw_schedule_entry' | 'quote_approval'
entityId: UUID
tenantId: UUID
actorUserId: UUID
before: object (previous state)
after: object (new state)
description: string
```

---

**End of REST API Documentation**

Total: 27 endpoints documented with 100% coverage.
