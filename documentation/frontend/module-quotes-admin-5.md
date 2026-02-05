# Admin Frontend Dev 5: Tenant Management & Operations

**Developer**: Frontend Developer 5  
**Duration**: 8 days  
**Prerequisites**: Read `ADMIN_FRONTEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build tenant management and operational tools:
- Tenant list and details
- Emergency operations
- Diagnostic tools
- Unit measurements admin
- Cross-tenant quote search

---

## PAGES TO BUILD

### 1. Tenant List (`/admin/tenants`)

**API Endpoint**: `GET /admin/tenants/quotes`

**Filters**:
- Search (company name or subdomain)
- Subscription status: Active, Trial, Suspended, All
- Sort by: Quote Count, Revenue, Name

**Table Columns**:
- Tenant Name
- Subdomain
- Subscription Status (badge)
- Total Quotes
- Quotes (Last 30 Days)
- Total Revenue
- Conversion Rate
- Created Date
- Actions (View Details)

**Summary Cards** (above table):
- Total Tenants
- Active Tenants
- Total Quotes (platform-wide)
- Total Revenue (platform-wide)

---

### 2. Tenant Details (`/admin/tenants/:id`)

**API Endpoints**: 
- `GET /admin/tenants/:tenantId/quote-stats`
- `GET /admin/tenants/:tenantId/activity`
- `GET /admin/tenants/:tenantId/configuration`

**Tabs**:

**Overview Tab**:
- Tenant info (name, subdomain, status)
- Quote statistics (by status)
- Revenue metrics
- Conversion rate
- Top quoted items (table)
- Trends (vs previous period)

**Activity Tab**:
- Timeline of events:
  - Quote created
  - Quote sent
  - Quote accepted/rejected
  - Settings updated
- Filter by event type
- Date range filter

**Configuration Tab**:
- Active template
- Quote settings (profit margin, overhead, expiration days)
- Custom units count
- Approval thresholds
- Feature flags (if applicable)

**Quotes Tab**:
- List of all quotes for this tenant
- Link to quote detail (in tenant context or admin context)

---

### 3. Emergency Operations (`/admin/operations/emergency`)

**Hard Delete Quote**:

**API Endpoint**: `DELETE /admin/quotes/:id/hard-delete`

**Form**:
- Quote ID input (with search/autocomplete)
- Reason textarea (required, min 10 chars)
- Confirmation checkbox: "I understand this cannot be undone"
- Type "DELETE" input
- Delete button (red, disabled until valid)

**Warning**:
```
⚠️ DANGER ZONE
Hard delete permanently removes quote and all related data:
- Items, groups, attachments
- Approval history
- Versions
- Analytics data

Tenant will be notified.
```

**Bulk Update**:

**API Endpoint**: `POST /admin/quotes/bulk-update`

**Form**:
- Quote IDs (textarea, one per line or comma-separated)
- New Status (select)
- Reason (textarea, required)
- Preview button (shows affected quotes)
- Update button

---

### 4. Diagnostics (`/admin/operations/diagnostics`)

**API Endpoint**: `GET /admin/diagnostics/run-tests`

**Test Suite Selector**:
- All Tests
- PDF Generation
- Email Delivery
- File Storage
- Database
- Google Maps API

**Run Tests Button**

**Results Display**:
- Test name
- Status (✓ Pass, ✗ Fail)
- Duration (ms)
- Error message (if failed)

**Overall Summary**:
- X of Y tests passed
- Status badge (All Pass = Green, Any Fail = Red)

**Refresh button**: Re-run tests

---

### 5. Quote Repair Tool (`/admin/operations/repair`)

**API Endpoint**: `POST /admin/quotes/:id/repair`

**Form**:
- Quote ID input
- Load Quote button (fetches quote data)

**Display Current State**:
- Quote number, title, status
- Current totals (subtotal, tax, discount, total)
- Item count, group count
- Last updated

**Issue Type** (radio select):
- Recalculate Totals (re-run pricing service)
- Fix Relationships (repair orphaned items/groups)
- Reset Status (force status change)

**Notes** (textarea, optional)

**Repair Button**: Execute repair

**Result Display**:
- Before/after comparison
- List of repairs made
- Success/error message

---

### 6. Unit Measurements Admin (`/admin/units`)

**API Endpoints**:
- `GET /admin/units`
- `POST /admin/units`
- `PATCH /admin/units/:id`
- `POST /admin/units/seed-defaults`

**Layout**:
- Table of global units
- Search/filter
- "Create Global Unit" button
- "Seed Defaults" button (if not already seeded)

**Table Columns**:
- Unit Name
- Abbreviation
- Category (if applicable)
- Usage Count (across all tenants)
- Created Date
- Actions (Edit, View Usage)

**Create/Edit Unit Form**:
- Name (required)
- Abbreviation (required)
- Description (optional)
- Category (optional select)
- Save button

**Usage Details**:
- Show which tenants use this unit
- Count of items using unit
- Cannot delete if usage > 0

---

### 7. Cross-Tenant Quote Search (`/admin/quotes/search`)

**API Endpoint**: `GET /admin/quotes`

**Search Form**:
- Quote number
- Customer name
- Tenant selector (searchable dropdown or "All")
- Status (multi-select)
- Date range
- Amount range (min/max)

**Results Table**:
- Quote Number
- Tenant Name (with badge)
- Customer Name
- Amount
- Status
- Created Date
- Actions (View, Edit - in admin context)

**Link to Quote**: Opens quote detail in admin view (read-only or editable with caution)

---

### 8. Cleanup Orphans Tool (`/admin/operations/cleanup`)

**API Endpoint**: `POST /admin/maintenance/cleanup-orphans`

**Form**:
- Entity Type: Items, Groups, Attachments, All
- Dry Run toggle (default: ON)
- Run Cleanup button

**Dry Run Mode**:
- Shows what WOULD be deleted
- Counts of orphans found
- List preview (first 10)
- "Run for Real" button (if admin confirms)

**Actual Run**:
- Shows deleted counts
- Confirmation message
- Audit log created

---

## COMPONENTS TO BUILD

**TenantSelector**:
- Searchable dropdown
- Shows: company name + subdomain
- "All Tenants" option

**QuoteStatusBadge**:
- Color-coded by status
- Used throughout admin

**ConfirmationModal**:
- Reusable for dangerous actions
- Type-to-confirm option
- Reason input option

**AuditTrailDisplay**:
- Shows action history
- User, timestamp, action, entity

---

## TESTING REQUIREMENTS

Test:
- Tenant list loads and filters
- Tenant details display correctly
- Emergency delete works (with validation)
- Bulk update processes multiple quotes
- Diagnostics run successfully
- Quote repair executes
- Unit CRUD operations work
- Cross-tenant search finds quotes
- Cleanup orphans (dry run and actual)

---

## DELIVERABLES

1. Tenant list page
2. Tenant details page
3. Emergency operations page
4. Diagnostics page
5. Quote repair tool
6. Unit measurements admin
7. Cross-tenant quote search
8. Cleanup orphans tool
9. Shared components (selectors, confirmations)
10. Tests

---

## COMPLETION CRITERIA

- Tenant management works
- Emergency tools functional (with safety checks)
- Diagnostics run and report
- Repair tool works
- Unit admin CRUD complete
- Search finds quotes across tenants
- Cleanup tool works (dry run and actual)
- Tests pass