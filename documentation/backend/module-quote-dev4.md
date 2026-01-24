# Backend Developer 4: Pricing Engine & Approval Workflow

**Module**: Quote Management System  
**Phase**: Business Logic & Calculations  
**Timeline**: 1.5 weeks  
**Complexity**: Very High (Most complex business logic in module)  
**Dependencies**: Backend Developers 1, 2, AND 3 MUST be complete  
**Your Role**: Build the pricing brain and approval system

---

## 🎯 YOUR MISSION

You are responsible for building the most complex part of the Quote module: the pricing calculation engine and approval workflow. Every dollar amount displayed to users depends on your calculations being correct.

**You will create**:
- Pricing calculation engine (costs → prices with profit/overhead/contingency)
- Discount rules system (quote-level discounts)
- Tax calculation system
- Draw schedule calculator (payment schedules)
- Approval workflow (multi-level approvals based on thresholds)
- Version comparison (what changed between versions)
- Profitability warnings (margin protection)
- Real-time calculation endpoints (for frontend live updates)

**You will NOT**:
- Build quote CRUD (that's Developer 3, already done)
- Build items or groups (that's Developer 3, already done)
- Build PDF generation (that's Developer 5)
- Build public access (that's Developer 5)
- Build frontend (that's Frontend team)

---

## 📋 WHAT YOU MUST DELIVER

### Deliverables Checklist

- [ ] Pricing calculation service (complex algorithms)
- [ ] Discount rules CRUD (6 endpoints)
- [ ] Approval workflow system (8 endpoints)
- [ ] Version comparison logic (6 endpoints)
- [ ] Profitability analysis (2 endpoints)
- [ ] Draw schedule management (4 endpoints)
- [ ] Real-time calculation endpoints (4 endpoints)
- [ ] 100% API documentation in REST_API file
- [ ] All DTOs with validation
- [ ] Service layer with calculation algorithms
- [ ] Comprehensive unit tests for calculations
- [ ] Handoff document for Backend Developer 5

### Files You Will Create/Modify

```
/var/www/lead360.app/api/src/modules/quotes/
├── quotes.module.ts (MODIFY - add new services/controllers)
├── controllers/
│   ├── quote-discount.controller.ts (CREATE)
│   ├── quote-approval.controller.ts (CREATE)
│   ├── quote-version.controller.ts (CREATE)
│   ├── draw-schedule.controller.ts (CREATE)
│   └── quote-calculation.controller.ts (CREATE)
├── services/
│   ├── pricing-calculator.service.ts (CREATE - THE BRAIN)
│   ├── discount-rules.service.ts (CREATE)
│   ├── approval-workflow.service.ts (CREATE)
│   ├── quote-version-comparison.service.ts (CREATE)
│   ├── profitability-analyzer.service.ts (CREATE)
│   └── draw-schedule.service.ts (CREATE)
├── dto/
│   ├── discount/ (CREATE)
│   ├── approval/ (CREATE)
│   ├── version/ (CREATE)
│   ├── draw-schedule/ (CREATE)
│   └── calculation/ (CREATE)
└── interfaces/
    └── pricing-calculation.interface.ts (CREATE)

/var/www/lead360.app/api/documentation/
├── quotes_REST_API_DEV4.md (CREATE - 100% docs)
├── quotes_PRICING_LOGIC.md (CREATE - calculation details)
└── quotes_HANDOFF_DEV4.md (CREATE - handoff to Dev 5)
```

---

## 🏗️ MODULE 1: PRICING CALCULATION ENGINE

### Purpose

The pricing calculator is the brain of the quote system. It takes item costs and applies profit, overhead, contingency, discounts, and taxes to calculate final prices. Every price displayed anywhere in the system comes from this service.

### Critical Calculation Rules

**Item-Level Calculations** (per item):

1. **Total Cost per Item**:
   - Cost per unit = material + labor + equipment + subcontract + other
   - Total cost = Cost per unit × Quantity

2. **Base Price Calculation** (before item overrides):
   - Step 1: Add profit: Cost × (1 + Profit %)
   - Step 2: Add overhead: Result × (1 + Overhead %)
   - Step 3: Add contingency: Result × (1 + Contingency %)
   - Result = Base price per unit

3. **Item Override Application** (if item has custom values):
   - If custom_markup_percent exists: Base price × (1 + Markup %)
   - If custom_discount_amount exists: Subtract discount
   - If custom_tax_rate exists: Apply custom tax (otherwise use quote-level tax)

4. **Final Item Price**:
   - Price per unit = After all overrides
   - Total price = Price per unit × Quantity

**Group-Level Calculations**:
- Group subtotal = Sum of all item total prices in group
- No additional calculations at group level

**Quote-Level Calculations**:

1. **Items Subtotal**:
   - Sum of all ungrouped item total prices
   - Plus sum of all group subtotals
   - This is the base before quote-level discounts

2. **Profit, Overhead, Contingency Totals** (for display):
   - Total profit amount = Sum of profit added to each item
   - Total overhead amount = Sum of overhead added to each item
   - Total contingency amount = Sum of contingency added to each item
   - These are NOT added again at quote level (already in item prices)

3. **Quote-Level Discount Application** (order matters):
   - Start with items subtotal
   - Apply percentage discounts first (in order_index order)
   - Apply fixed amount discounts second (in order_index order)
   - Result = Subtotal after discounts

4. **Tax Calculation**:
   - Tax amount = Subtotal after discounts × Tax rate
   - Tax rate comes from tenant settings or quote custom setting

5. **Final Quote Total**:
   - Total = Subtotal after discounts + Tax amount

**Profitability Calculations**:

1. **Total Cost** (all items):
   - Sum of all item total costs
   - This is pure cost without markup

2. **Total Revenue**:
   - Quote total (after all calculations)

3. **Gross Profit**:
   - Gross profit = Total revenue - Total cost

4. **Margin Percentage**:
   - Margin % = (Gross profit / Total revenue) × 100
   - This is the KEY metric for profitability warnings

**Margin Warning Thresholds** (configurable per tenant):
- Green: Margin >= Target (e.g., 25%)
- Yellow: Margin between Minimum and Target (15-25%)
- Red: Margin below Minimum (< 15%)
- Block: Margin below Hard Floor (< 10%) - Cannot send quote

### Service Architecture

**PricingCalculatorService** is the core service that:
- Takes quote data as input
- Returns complete calculation breakdown
- Used by: Quote detail endpoint, PDF generation, frontend display
- Must be PURE (no side effects, no database writes)
- Deterministic (same input = same output)

**Calculation Methods**:
1. `calculateItemPrice(item, quoteSettings)` → ItemPriceBreakdown
2. `calculateGroupSubtotal(group, quoteSettings)` → GroupSubtotal
3. `calculateQuoteTotal(quote)` → QuoteTotalBreakdown
4. `calculateProfitability(quote)` → ProfitabilityAnalysis
5. `applyDiscounts(subtotal, discountRules)` → DiscountedTotal
6. `calculateTax(subtotal, taxRate)` → TaxAmount
7. `validateProfitability(quote, thresholds)` → ValidationResult

### Endpoints Required (Calculation API)

#### 1. Calculate Quote Total
```
GET /api/v1/quotes/:id/calculate
Auth: JWT required
Roles: All authenticated users
```

**Purpose**: Get complete pricing breakdown for a quote

**Business Logic**:
1. Fetch quote with all items, groups, discount rules
2. Fetch tenant settings (profit, overhead, contingency, tax rate)
3. If quote has custom settings, use those instead of tenant defaults
4. Call PricingCalculatorService.calculateQuoteTotal(quote)
5. Return detailed breakdown

**Response Structure**:
```json
{
  "quote_id": "uuid",
  "items": [
    {
      "item_id": "uuid",
      "title": "Bathroom Tile Installation",
      "quantity": 100,
      "unit": "sq ft",
      "cost_breakdown": {
        "material_cost": 500.00,
        "labor_cost": 2500.00,
        "equipment_cost": 0.00,
        "subcontract_cost": 0.00,
        "other_cost": 0.00,
        "total_cost_per_unit": 30.00,
        "total_cost": 3000.00
      },
      "price_calculation": {
        "base_cost_per_unit": 30.00,
        "after_profit": 36.00,
        "after_overhead": 39.60,
        "after_contingency": 41.58,
        "custom_markup_applied": false,
        "custom_discount_applied": false,
        "final_price_per_unit": 41.58,
        "total_price": 4158.00
      },
      "profit_breakdown": {
        "profit_amount": 600.00,
        "overhead_amount": 360.00,
        "contingency_amount": 198.00,
        "total_markup": 1158.00
      }
    }
  ],
  "groups": [
    {
      "group_id": "uuid",
      "name": "Bathroom Renovation",
      "items_count": 3,
      "subtotal": 8500.00
    }
  ],
  "summary": {
    "items_subtotal": 15000.00,
    "total_profit": 3000.00,
    "total_overhead": 1500.00,
    "total_contingency": 750.00,
    "subtotal_before_discounts": 15000.00,
    "total_discounts": 500.00,
    "subtotal_after_discounts": 14500.00,
    "tax_rate": 6.5,
    "tax_amount": 942.50,
    "total": 15442.50
  },
  "profitability": {
    "total_cost": 10000.00,
    "total_revenue": 15442.50,
    "gross_profit": 5442.50,
    "margin_percent": 35.25,
    "warning_level": "green"
  },
  "settings_used": {
    "profit_percent": 20.0,
    "overhead_percent": 10.0,
    "contingency_percent": 5.0,
    "tax_rate": 6.5,
    "source": "custom"
  }
}
```

---

#### 2. Recalculate After Item Change (Real-time)
```
POST /api/v1/quotes/:id/recalculate
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Purpose**: Frontend calls this when item changed to get updated totals without saving

**Request Body**:
- items (optional, array of modified items - not saved yet)
- discount_rules (optional, array of modified discounts)
- custom_settings (optional, changed profit/overhead/contingency)

**Business Logic**:
- Accept temporary changes without saving to database
- Run calculations with provided data
- Return same breakdown as Calculate endpoint
- Do NOT modify database

**Response**: Same as Calculate endpoint

**Use Case**: User editing item quantity in UI, frontend shows live total update

---

#### 3. Validate Profitability
```
GET /api/v1/quotes/:id/validate-profitability
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Calculate current margin percentage
- Compare against tenant thresholds (target, minimum, hard floor)
- Return validation result with warnings

**Response**:
```json
{
  "is_valid": true,
  "margin_percent": 25.5,
  "warning_level": "green",
  "thresholds": {
    "target": 25.0,
    "minimum": 15.0,
    "hard_floor": 10.0
  },
  "can_send": true,
  "warnings": [],
  "recommendations": [
    "Margin is above target - good profitability"
  ]
}
```

**Warning Levels**:
- `green`: Margin >= target (no warnings)
- `yellow`: Margin between minimum and target (warning but can send)
- `red`: Margin below minimum (strong warning, requires override)
- `blocked`: Margin below hard floor (cannot send without admin override)

---

#### 4. Get Margin Analysis
```
GET /api/v1/quotes/:id/margin-analysis
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Purpose**: Detailed profitability breakdown for managers

**Business Logic**:
- Calculate margin per item
- Calculate margin per group
- Identify lowest margin items (potential problems)
- Compare to similar quotes (if available)

**Response**:
```json
{
  "overall_margin": 25.5,
  "items_analysis": [
    {
      "item_id": "uuid",
      "title": "Bathroom Tile",
      "margin_percent": 28.0,
      "status": "healthy"
    },
    {
      "item_id": "uuid",
      "title": "Custom Cabinets",
      "margin_percent": 12.0,
      "status": "low_margin"
    }
  ],
  "groups_analysis": [
    {
      "group_id": "uuid",
      "name": "Kitchen Work",
      "margin_percent": 30.0
    }
  ],
  "low_margin_items": [
    {
      "item_id": "uuid",
      "title": "Custom Cabinets",
      "margin_percent": 12.0,
      "recommendation": "Consider increasing markup or reducing costs"
    }
  ]
}
```

---

## 🏗️ MODULE 2: DISCOUNT RULES SYSTEM

### Purpose

Quote-level discounts that apply to the entire quote (after item pricing). Multiple discounts can stack. Order matters.

### Critical Business Rules

**Discount Types**:
- Percentage: Reduces subtotal by X% (e.g., 10% early payment discount)
- Fixed Amount: Reduces subtotal by $X (e.g., $500 seasonal promotion)

**Application Order** (CRITICAL):
1. Calculate items subtotal (all items priced)
2. Apply percentage discounts in order_index sequence
3. Apply fixed amount discounts in order_index sequence
4. Result = Subtotal after discounts
5. Then apply tax to result

**Discount Rules**:
- Can have multiple discounts on one quote
- Each discount needs a reason (for audit trail)
- Total discounts cannot exceed subtotal (validation)
- Percentage discounts: 0-100% range
- Fixed discounts: Must be > 0 and < subtotal

**Common Discount Reasons**:
- Early payment discount
- Volume discount
- Seasonal promotion
- Referral discount
- Loyalty discount
- Price match
- Goodwill adjustment

### Endpoints Required

#### 1. Add Discount Rule
```
POST /api/v1/quotes/:quoteId/discounts
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- rule_type (required, enum: 'percentage' | 'fixed')
- value (required, decimal > 0)
- reason (required, 1-255 chars)
- apply_to (optional, enum: 'subtotal', default 'subtotal')

**Validation**:
- If percentage: value must be 0-100
- If fixed: value must be > 0 and < current subtotal
- Reason required (no blank discounts)
- Quote cannot be approved

**Business Logic**:
- Set order_index = max(existing discounts) + 1
- Create discount rule record
- Recalculate quote total
- Update quote version (+0.1)

**Response**: Created discount rule with updated quote total

---

#### 2. List Discount Rules
```
GET /api/v1/quotes/:quoteId/discounts
Auth: JWT required
Roles: All authenticated users
```

**Response**: Array of discount rules ordered by order_index

---

#### 3. Update Discount Rule
```
PATCH /api/v1/quotes/:quoteId/discounts/:discountId
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- value
- reason
- apply_to

**Business Logic**:
- Recalculate quote total after change
- Update quote version (+0.1)

**Response**: Updated discount rule

---

#### 4. Delete Discount Rule
```
DELETE /api/v1/quotes/:quoteId/discounts/:discountId
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Hard delete discount
- Recalculate quote total
- Update quote version (+0.1)

**Response**: 204 No Content

---

#### 5. Reorder Discount Rules
```
PATCH /api/v1/quotes/:quoteId/discounts/reorder
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- discounts (array of {id, new_order_index})

**Business Logic**:
- Update order_index for each discount
- Recalculate quote (order affects final total)
- Update quote version (+0.1)

**Response**: Reordered discounts with updated total

**Important**: Order matters because percentage discounts compound

---

#### 6. Calculate Discount Impact
```
POST /api/v1/quotes/:quoteId/discounts/calculate-impact
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Purpose**: Preview what discount would do before adding

**Request Body**:
- rule_type (required)
- value (required)

**Business Logic**:
- Calculate current total
- Apply proposed discount
- Calculate new total
- Return before/after comparison
- Do NOT save to database

**Response**:
```json
{
  "current_total": 15000.00,
  "discount_amount": 1500.00,
  "new_total": 13500.00,
  "impact_percent": 10.0,
  "new_margin_percent": 22.5,
  "margin_change": -3.0
}
```

---

## 🏗️ MODULE 3: APPROVAL WORKFLOW SYSTEM

### Purpose

Multi-level approval workflow for quotes exceeding value thresholds. Managers/owners must approve expensive quotes before they can be sent to customers.

### Critical Business Rules

**Approval Triggers**:
- Based on quote total amount
- Configurable thresholds per tenant
- Example: Level 1 (Manager) at $10k, Level 2 (Owner) at $50k

**Approval Levels**:
- Level 1: Manager approval (quotes $10k - $49,999)
- Level 2: Owner approval (quotes $50k - $99,999)
- Level 3: Executive approval (quotes $100k+)
- Configurable per tenant (can have 1-5 levels)

**Approval Flow**:
1. User submits quote for approval
2. System determines required levels based on total
3. Creates approval records for each required level
4. Sends notification to first approver
5. First approver approves → Notification to next approver
6. All approvals complete → Quote status changes to "ready"
7. Any rejection → Quote returns to "draft" with comments

**Approval States**:
- `pending`: Awaiting decision
- `approved`: Approver accepted
- `rejected`: Approver declined

**Approval Rules**:
- Must approve in sequence (level 1 before level 2)
- Cannot skip levels
- Owner role can bypass all approvals (admin override)
- Rejecting requires comments (explain why)
- Approving is optional comments
- Quote cannot be sent until all approvals obtained

**When Quote Modified After Approval**:
- If quote total changes > 10%: Reset all approvals (must re-approve)
- If quote total changes < 10%: Keep approvals, notify approvers
- If items added/removed: Reset approvals
- Status changes from "ready" back to "pending_approval"

### Endpoints Required

#### 1. Submit Quote for Approval
```
POST /api/v1/quotes/:quoteId/submit-for-approval
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
1. Calculate quote total
2. Fetch tenant approval thresholds
3. Determine required approval levels based on total
4. Create approval records for each required level (status = pending)
5. Change quote status to "pending_approval"
6. Send notification to first level approver
7. Update quote version (+1.0 - status change)

**Response**:
```json
{
  "quote_id": "uuid",
  "status": "pending_approval",
  "required_approvals": [
    {
      "level": 1,
      "approver": {
        "id": "user-uuid",
        "name": "Manager Name",
        "role": "Manager"
      },
      "status": "pending",
      "threshold": 10000.00
    },
    {
      "level": 2,
      "approver": {
        "id": "user-uuid",
        "name": "Owner Name",
        "role": "Owner"
      },
      "status": "pending",
      "threshold": 50000.00
    }
  ],
  "total_amount": 75000.00,
  "submitted_by": "Sales Name",
  "submitted_at": "2024-01-15T10:00:00Z"
}
```

**Errors**:
- 400: Quote not ready (missing items, vendor, etc.)
- 400: Quote already approved

---

#### 2. Approve Quote
```
POST /api/v1/quotes/:quoteId/approvals/:approvalId/approve
Auth: JWT required
Roles: Owner, Admin, Manager (must be assigned approver)
```

**Request Body**:
- comments (optional, text)

**Validation**:
- Verify current user is the assigned approver for this approval record
- Verify approval status is "pending"
- Verify previous level approved (if level > 1)

**Business Logic**:
1. Update approval.status = "approved"
2. Set approval.decided_at = now
3. Set approval.comments = provided comments
4. If this is last approval:
   - Change quote.status = "ready"
   - Send notification to quote creator
5. If more approvals needed:
   - Send notification to next level approver
6. Update quote version (+0.1)

**Response**: Updated approval record with quote status

**Errors**:
- 403: User is not the assigned approver
- 400: Previous level not approved yet
- 400: Approval already decided

---

#### 3. Reject Quote
```
POST /api/v1/quotes/:quoteId/approvals/:approvalId/reject
Auth: JWT required
Roles: Owner, Admin, Manager (must be assigned approver)
```

**Request Body**:
- comments (required, text, min 10 chars)

**Validation**:
- Verify current user is the assigned approver
- Verify approval status is "pending"
- Comments required for rejection (must explain why)

**Business Logic**:
1. Update approval.status = "rejected"
2. Set approval.decided_at = now
3. Set approval.comments = provided comments
4. Change quote.status = "draft"
5. Set all other approval records to "rejected" (workflow terminated)
6. Send notification to quote creator with rejection reason
7. Update quote version (+1.0 - status change)

**Response**: Updated approval record with rejection reason

**Errors**:
- 403: User is not the assigned approver
- 400: Comments required for rejection

---

#### 4. Get Approval Status
```
GET /api/v1/quotes/:quoteId/approvals
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Fetch all approval records for quote
- Include approver details
- Calculate approval progress percentage

**Response**:
```json
{
  "quote_id": "uuid",
  "status": "pending_approval",
  "approvals": [
    {
      "id": "uuid",
      "level": 1,
      "approver": {
        "id": "uuid",
        "name": "Manager Name",
        "email": "manager@company.com"
      },
      "status": "approved",
      "comments": "Looks good, approved",
      "decided_at": "2024-01-15T11:00:00Z"
    },
    {
      "id": "uuid",
      "level": 2,
      "approver": {
        "id": "uuid",
        "name": "Owner Name",
        "email": "owner@company.com"
      },
      "status": "pending",
      "comments": null,
      "decided_at": null
    }
  ],
  "progress": {
    "completed": 1,
    "total": 2,
    "percentage": 50
  }
}
```

---

#### 5. Get Pending Approvals for User
```
GET /api/v1/approvals/pending
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Fetch all pending approvals where approver_user_id = current user
- Include quote details for each
- Filter by tenant_id

**Response**: Paginated list of pending approvals

---

#### 6. Bypass Approval (Owner Override)
```
POST /api/v1/quotes/:quoteId/approvals/bypass
Auth: JWT required
Roles: Owner ONLY
```

**Request Body**:
- reason (required, text, why bypassing)

**Business Logic**:
- Mark all pending approvals as "approved"
- Set approver = current user (owner)
- Set comments = "Bypassed: {reason}"
- Change quote.status = "ready"
- Log override action in audit log
- Update quote version (+1.0)

**Response**: Quote with all approvals bypassed

**Errors**:
- 403: Only owner can bypass

---

#### 7. Update Approval Thresholds (Tenant Settings)
```
PATCH /api/v1/quotes/settings/approval-thresholds
Auth: JWT required
Roles: Owner, Admin
```

**Request Body**:
- thresholds (array of {level, amount, approver_role})

**Example**:
```json
{
  "thresholds": [
    { "level": 1, "amount": 10000.00, "approver_role": "Manager" },
    { "level": 2, "amount": 50000.00, "approver_role": "Owner" },
    { "level": 3, "amount": 100000.00, "approver_role": "Owner" }
  ]
}
```

**Business Logic**:
- Store in tenant settings or separate approval_threshold table
- Validate amounts are ascending
- Validate roles exist

**Response**: Updated thresholds

---

#### 8. Reset Approvals (Quote Modified)
```
POST /api/v1/quotes/:quoteId/approvals/reset
Auth: JWT required (Internal use - called by quote update logic)
```

**Purpose**: Automatically called when quote modified significantly

**Business Logic**:
- Mark all existing approvals as "obsolete" or delete
- Change quote status from "ready" to "pending_approval" or "draft"
- Notify previous approvers that quote changed
- User must resubmit for approval

**Response**: Success message

**Note**: This is typically called internally by quote update service, not directly by users

---

## 🏗️ MODULE 4: VERSION COMPARISON SYSTEM

### Purpose

Allow users to compare different versions of a quote to see what changed. Critical for approval workflow and audit trail.

### Critical Business Rules

**Version Storage**:
- Every change creates new version (handled by Dev 3)
- Complete quote snapshot stored in JSON (snapshot_data field)
- Version numbers: Major.Minor (1.0, 1.1, 2.0)
- Cannot delete versions (audit trail)

**Comparison Logic**:
- Compare two versions side-by-side
- Highlight differences: Added (green), Removed (red), Changed (yellow)
- Compare: Items, pricing, settings, totals
- Show who made changes and when

**What to Compare**:
- Quote basic info (title, vendor, dates)
- Items (added, removed, modified)
- Groups (added, removed, modified)
- Pricing settings (profit, overhead, contingency)
- Totals (subtotal, discounts, tax, total)
- Status changes

### Endpoints Required

#### 1. List Quote Versions
```
GET /api/v1/quotes/:quoteId/versions
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Fetch all versions for quote
- Include: version_number, changed_by user, change_summary, created_at
- Order by version_number DESC (newest first)

**Response**: Array of version summaries

---

#### 2. Get Specific Version
```
GET /api/v1/quotes/:quoteId/versions/:versionNumber
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Fetch version record
- Parse snapshot_data JSON
- Return complete quote state at that version

**Response**: Complete quote snapshot (same structure as Get Quote endpoint)

---

#### 3. Compare Two Versions
```
GET /api/v1/quotes/:quoteId/versions/compare
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- from_version (required, decimal, e.g., 1.0)
- to_version (required, decimal, e.g., 1.5)

**Business Logic**:
1. Fetch both version snapshots
2. Deep compare JSON structures
3. Identify differences:
   - Items added (in to, not in from)
   - Items removed (in from, not in to)
   - Items modified (exists in both but data changed)
   - Groups added/removed/modified
   - Settings changed
   - Totals changed

**Response Structure**:
```json
{
  "quote_id": "uuid",
  "from_version": 1.0,
  "to_version": 1.5,
  "changed_by": {
    "id": "uuid",
    "name": "User Name"
  },
  "changed_at": "2024-01-15T14:00:00Z",
  "summary": {
    "items_added": 2,
    "items_removed": 0,
    "items_modified": 3,
    "groups_added": 1,
    "groups_removed": 0,
    "settings_changed": true,
    "total_change": 2500.00
  },
  "differences": {
    "items": {
      "added": [
        {
          "id": "uuid",
          "title": "New Item",
          "quantity": 10,
          "total_price": 500.00
        }
      ],
      "removed": [],
      "modified": [
        {
          "id": "uuid",
          "title": "Modified Item",
          "changes": {
            "quantity": { "from": 5, "to": 10 },
            "total_price": { "from": 250.00, "to": 500.00 }
          }
        }
      ]
    },
    "settings": {
      "profit_percent": { "from": 20.0, "to": 25.0 },
      "overhead_percent": { "from": 10.0, "to": 10.0 }
    },
    "totals": {
      "subtotal": { "from": 12500.00, "to": 15000.00 },
      "total": { "from": 13312.50, "to": 15975.00 }
    }
  }
}
```

---

#### 4. Restore Previous Version
```
POST /api/v1/quotes/:quoteId/versions/:versionNumber/restore
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
1. Fetch version snapshot
2. Create new version with current state (backup before restore)
3. Update current quote with snapshot data
4. Set status = "draft" (restored quotes need review)
5. Create new version record (version = current + 1.0)
6. Notify user about restoration

**Response**: Restored quote object

**Errors**:
- 400: Cannot restore if quote is approved
- 400: Confirm restoration required (destructive operation)

---

#### 5. Get Version History Timeline
```
GET /api/v1/quotes/:quoteId/versions/timeline
Auth: JWT required
Roles: All authenticated users
```

**Purpose**: Visual timeline of quote evolution

**Business Logic**:
- Fetch all versions
- Group by date
- Include key events: created, modified, status changes, approvals

**Response**:
```json
{
  "timeline": [
    {
      "date": "2024-01-15",
      "events": [
        {
          "version": 1.0,
          "type": "created",
          "user": "Sales Rep",
          "timestamp": "2024-01-15T10:00:00Z"
        },
        {
          "version": 1.1,
          "type": "modified",
          "summary": "Added 2 items",
          "user": "Sales Rep",
          "timestamp": "2024-01-15T11:30:00Z"
        },
        {
          "version": 2.0,
          "type": "status_change",
          "from_status": "draft",
          "to_status": "pending_approval",
          "user": "Sales Rep",
          "timestamp": "2024-01-15T14:00:00Z"
        }
      ]
    }
  ]
}
```

---

#### 6. Get Change Summary for Version
```
GET /api/v1/quotes/:quoteId/versions/:versionNumber/summary
Auth: JWT required
Roles: All authenticated users
```

**Purpose**: Quick summary of what changed in this version

**Business Logic**:
- Compare this version to previous version
- Generate human-readable summary
- Example: "Added 2 items, increased profit to 25%, total increased by $2,500"

**Response**:
```json
{
  "version": 1.5,
  "previous_version": 1.4,
  "changed_by": "User Name",
  "changed_at": "2024-01-15T14:00:00Z",
  "summary": "Added 2 items, modified 1 item, increased profit to 25%",
  "impact": {
    "total_change_amount": 2500.00,
    "total_change_percent": 20.0,
    "margin_change": 3.5
  }
}
```

---

## 🏗️ MODULE 5: DRAW SCHEDULE SYSTEM

### Purpose

Payment schedule showing when customer will pay throughout project. Can be percentage-based or fixed amounts.

### Critical Business Rules

**Draw Schedule Types**:
- Percentage-based: Each draw is X% of total (must sum to 100%)
- Fixed amount: Each draw is $X (should sum to total, warning if not)
- Cannot mix types in same quote

**Common Draw Schedules**:
- 50/50: 50% deposit, 50% on completion
- 30/40/30: 30% deposit, 40% at milestone, 30% final
- Progressive: 20% deposit, 20% at each of 4 milestones

**Validation Rules**:
- If percentage: Sum must equal 100%
- If fixed: Sum should equal quote total (warning if off)
- Each draw must have description (what it's for)
- Draw_number determines payment order
- Minimum 1 draw, maximum 10 draws

### Endpoints Required

#### 1. Create Draw Schedule
```
POST /api/v1/quotes/:quoteId/draw-schedule
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- calculation_type (required, enum: 'percentage' | 'fixed')
- entries (required, array of draw entries, min 1)

**Draw Entry Structure**:
```json
{
  "draw_number": 1,
  "description": "Initial deposit",
  "value": 30.0
}
```

**Validation**:
- All entries must use same calculation_type
- If percentage: Sum of values must equal 100
- If fixed: Sum should be close to quote total (warning if > 5% difference)
- Each entry must have description

**Business Logic**:
1. Delete existing draw schedule entries (if any)
2. Create new entries with order_index = draw_number
3. Calculate amounts:
   - If percentage: amount = quote_total × (value / 100)
   - If fixed: amount = value
4. Update quote version (+0.1)

**Response**: Created draw schedule with calculated amounts

**Errors**:
- 400: Percentages don't sum to 100%
- 400: Missing descriptions

---

#### 2. Get Draw Schedule
```
GET /api/v1/quotes/:quoteId/draw-schedule
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Fetch all entries ordered by draw_number
- Calculate amounts based on current quote total
- Calculate running total and remaining balance

**Response**:
```json
{
  "quote_id": "uuid",
  "quote_total": 15000.00,
  "calculation_type": "percentage",
  "entries": [
    {
      "draw_number": 1,
      "description": "Initial deposit",
      "value": 30.0,
      "amount": 4500.00,
      "running_total": 4500.00,
      "percentage_of_total": 30.0
    },
    {
      "draw_number": 2,
      "description": "At project midpoint",
      "value": 40.0,
      "amount": 6000.00,
      "running_total": 10500.00,
      "percentage_of_total": 70.0
    },
    {
      "draw_number": 3,
      "description": "Final payment",
      "value": 30.0,
      "amount": 4500.00,
      "running_total": 15000.00,
      "percentage_of_total": 100.0
    }
  ],
  "validation": {
    "is_valid": true,
    "percentage_sum": 100.0,
    "amount_sum": 15000.00,
    "variance": 0.00
  }
}
```

---

#### 3. Update Draw Schedule
```
PATCH /api/v1/quotes/:quoteId/draw-schedule
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**: Same as Create

**Business Logic**:
- Delete existing entries
- Create new entries
- Recalculate amounts
- Update quote version (+0.1)

**Response**: Updated draw schedule

---

#### 4. Delete Draw Schedule
```
DELETE /api/v1/quotes/:quoteId/draw-schedule
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Delete all draw schedule entries for quote
- Update quote version (+0.1)

**Response**: 204 No Content

---

## 🔗 SERVICE INTEGRATION

### Existing Services You MUST Use

**Quote Service** (from Dev 3):
- Fetch quote data with all items, groups
- Update quote records
- Trigger version creation

**Tenant Settings Service** (from Dev 2):
- Get default profit, overhead, contingency, tax rate
- Get approval thresholds
- Get profitability warning levels

**Notification Service** (optional integration):
- Send approval request notifications
- Send approval decision notifications
- Can be simple email or use communication module

### New Services You Create

**PricingCalculatorService** (PURE SERVICE):
- No database writes
- Takes data in, returns calculations
- Deterministic (same input = same output)
- Used by: Quote endpoints, PDF generation, frontend

**DiscountRulesService**:
- CRUD for discount rules
- Apply discount logic
- Validation

**ApprovalWorkflowService**:
- Determine required approvals
- Create approval records
- Process approve/reject
- Check completion

**QuoteVersionComparisonService**:
- Deep JSON comparison
- Generate diff report
- Human-readable summaries

**ProfitabilityAnalyzerService**:
- Calculate margins
- Analyze per item/group
- Generate warnings
- Compare to thresholds

**DrawScheduleService**:
- CRUD for draw schedules
- Calculate amounts
- Validate percentages/totals

---

## ✅ VALIDATION RULES

### Pricing Validation

- All percentages: 0-100 range
- All amounts: >= 0 (no negative)
- Quote total must be > 0 after all calculations
- Discounts cannot exceed subtotal
- Tax rate: 0-100 range

### Approval Validation

- User must be assigned approver
- Previous levels must be approved (sequential)
- Comments required for rejection
- Cannot approve own quote (if configured)

### Discount Validation

- Reason required (min 3 chars)
- Percentage: 0-100
- Fixed amount: > 0 and < subtotal
- Order matters (validate sequence)

### Draw Schedule Validation

- Percentage type: Sum must equal 100%
- Fixed type: Sum should equal total (±5% tolerance with warning)
- Each entry must have description (min 5 chars)
- Minimum 1 entry, maximum 10 entries
- Draw numbers must be sequential (1, 2, 3, ...)

---

## 🎯 SUCCESS CRITERIA

You are done when:

- [ ] All 36 endpoints implemented and tested
- [ ] PricingCalculatorService calculates correctly
- [ ] All calculation tests pass (CRITICAL - must unit test calculations)
- [ ] Discount application order correct
- [ ] Approval workflow functional (submit, approve, reject)
- [ ] Version comparison shows differences accurately
- [ ] Profitability warnings trigger correctly
- [ ] Draw schedule calculations accurate
- [ ] Real-time calculation endpoints fast (<200ms)
- [ ] 100% API documentation complete
- [ ] Calculation logic documented separately
- [ ] No rounding errors in currency
- [ ] Multi-tenant isolation verified
- [ ] No TypeScript errors
- [ ] Server runs without errors
- [ ] Backend Developer 5 has everything needed to start

---

## 📝 CRITICAL: CALCULATION TESTING

### You MUST Create Unit Tests

**Test PricingCalculatorService extensively**:

1. **Item Price Calculation**:
   - Test with all cost types
   - Test with zero costs
   - Test with profit/overhead/contingency
   - Test with item overrides (markup, discount, tax)
   - Test edge cases (very small numbers, very large numbers)

2. **Discount Application**:
   - Test percentage discounts
   - Test fixed amount discounts
   - Test multiple discounts (order matters)
   - Test edge cases (100% discount, $0.01 discount)

3. **Tax Calculation**:
   - Test various tax rates
   - Test tax on discounted amounts
   - Test zero tax
   - Test high tax rates

4. **Profitability**:
   - Test margin calculation
   - Test with various profit levels
   - Test edge cases (0% margin, 100% margin)

5. **Draw Schedule**:
   - Test percentage sum validation
   - Test fixed amount validation
   - Test rounding (percentages to dollars)

**Example Test Structure** (you write these):
```
describe('PricingCalculatorService', () => {
  describe('calculateItemPrice', () => {
    it('calculates base price with profit/overhead/contingency')
    it('applies custom markup correctly')
    it('applies custom discount correctly')
    it('handles zero costs')
    it('handles item overrides')
  })
  
  describe('applyDiscounts', () => {
    it('applies percentage discount')
    it('applies fixed discount')
    it('applies multiple discounts in order')
    it('validates discount does not exceed subtotal')
  })
  
  describe('calculateProfitability', () => {
    it('calculates margin correctly')
    it('identifies low margin items')
    it('returns correct warning level')
  })
})
```

---

## 📝 API DOCUMENTATION REQUIREMENTS

Create `/api/documentation/quotes_REST_API_DEV4.md` with:

**For EACH endpoint** (36 total):
1. Complete specification (method, path, purpose)
2. Request/response schemas
3. Validation rules
4. Business logic explanation
5. Error scenarios
6. Examples

Create `/api/documentation/quotes_PRICING_LOGIC.md` with:

**Calculation Documentation**:
1. Item price calculation formula (step-by-step)
2. Discount application logic (order matters)
3. Tax calculation logic
4. Profitability margin formula
5. Draw schedule calculation examples
6. Rounding rules (currency precision)
7. Edge cases handling
8. Example calculations with real numbers

---

## 📋 HANDOFF DOCUMENT

Create `/api/documentation/quotes_HANDOFF_DEV4.md` with:

**What You Completed**:
- Endpoints implemented (36 total)
- Services created (6 services)
- DTOs created
- Calculation algorithms
- Test coverage

**Calculation Verification**:
- Sample calculations performed
- Test results
- Edge cases handled
- Rounding verified

**Developer 5 Readiness**:
- [ ] All pricing calculations available
- [ ] Approval workflow functional
- [ ] Version comparison working
- [ ] Draw schedule ready
- [ ] Ready for PDF generation
- [ ] Ready for public access

**Performance Notes**:
- Calculation speed benchmarks
- Optimization opportunities

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Rounding errors**: Use proper decimal precision for currency
2. **Discount order**: Percentage before fixed, order_index matters
3. **Margin calculation**: Use (revenue - cost) / revenue, not / cost
4. **Approval bypass**: Only owner can bypass, must log
5. **Version comparison**: Deep compare, not shallow
6. **Draw schedule**: Validate sum equals 100% or total
7. **Real-time calc**: Must be fast (<200ms), don't save to DB
8. **Approval sequence**: Must enforce level 1 before level 2
9. **Profitability**: Calculate AFTER discounts and tax
10. **Negative values**: Validate no negative prices

---

## 🚀 YOU'RE READY

You are building the mathematical brain of the quote system. Every number users see depends on your calculations being correct.

**Your work enables**:
- Dev 5: PDF generation (needs final pricing)
- Dev 5: Public quote view (needs totals)
- Frontend: Live calculation updates
- Frontend: Approval workflow UI
- Frontend: Profitability warnings

**This is the most complex logic in the module:**
- Multi-step calculations
- Order-dependent discounts
- Sequential approvals
- Deep JSON comparison
- Real-time performance

**Test extensively. Document thoroughly. Calculate accurately.**

**When complete, notify Backend Reviewer for approval before Backend Developer 5 starts.**

---

**Status**: 📋 **READY FOR IMPLEMENTATION**