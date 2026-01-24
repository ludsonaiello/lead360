# Backend Developer 3: Quote CRUD & Items Management

**Module**: Quote Management System  
**Phase**: Core Quote Functionality  
**Timeline**: 1.5 weeks  
**Complexity**: High (Core module with complex transactions)  
**Dependencies**: Backend Developers 1 AND 2 MUST be complete  
**Your Role**: Build the heart of the quote system

---

## 🎯 YOUR MISSION

You are responsible for building the core quote creation, editing, and item management functionality. This is the most critical part of the Quote module - users will spend most of their time in the features you build.

**You will create**:
- Quote CRUD operations (create, read, update, delete, list, search)
- Quote item management (add, edit, delete, reorder, save to library)
- Quote group management (create, edit, delete, move items)
- Item library system (reusable item catalog)
- Clone and duplicate operations (quote, item, group)
- Lead integration (create quotes from leads, create leads from quotes)
- Jobsite address management
- Version history tracking (every save creates version)

**You will NOT**:
- Build pricing calculations (that's Developer 4)
- Build approval workflow (that's Developer 4)
- Build public access or PDF (that's Developer 5)
- Build templates (that's Developer 2, already done)
- Build frontend (that's Frontend team)

---

## 📋 WHAT YOU MUST DELIVER

### Deliverables Checklist

- [ ] Quote CRUD endpoints (12 endpoints)
- [ ] Quote item management (10 endpoints)
- [ ] Quote group management (6 endpoints)
- [ ] Item library CRUD (8 endpoints)
- [ ] Clone/duplicate operations (4 endpoints)
- [ ] Drag & drop ordering (2 endpoints)
- [ ] 100% API documentation in REST_API file
- [ ] All DTOs with comprehensive validation
- [ ] Service layer with complex business logic
- [ ] Transaction handling for nested operations
- [ ] Version history automation
- [ ] Lead status integration
- [ ] Handoff document for Backend Developer 4

### Files You Will Create/Modify

```
/var/www/lead360.app/api/src/modules/quotes/
├── quotes.module.ts (MODIFY - add new services/controllers)
├── controllers/
│   ├── quote.controller.ts (CREATE - main quote operations)
│   ├── quote-item.controller.ts (CREATE - item management)
│   ├── quote-group.controller.ts (CREATE - group management)
│   └── item-library.controller.ts (CREATE - library CRUD)
├── services/
│   ├── quote.service.ts (CREATE - core quote logic)
│   ├── quote-item.service.ts (CREATE - item management)
│   ├── quote-group.service.ts (CREATE - group management)
│   ├── item-library.service.ts (CREATE - library logic)
│   ├── quote-version.service.ts (CREATE - version tracking)
│   └── quote-jobsite-address.service.ts (CREATE - address handling)
├── dto/
│   ├── quote/ (CREATE - all quote DTOs)
│   ├── item/ (CREATE - all item DTOs)
│   ├── group/ (CREATE - all group DTOs)
│   └── library/ (CREATE - all library DTOs)
└── interfaces/
    └── (CREATE - shared interfaces if needed)

/var/www/lead360.app/api/documentation/
├── quotes_REST_API_DEV3.md (CREATE - 100% endpoint docs)
└── quotes_HANDOFF_DEV3.md (CREATE - handoff to Dev 4)
```

---

## 🏗️ MODULE 1: QUOTE CRUD OPERATIONS

### Purpose

Core quote management: creating quotes from leads or manually, reading quote details, updating quote information, searching quotes, and managing quote lifecycle.

### Critical Business Rules

**Quote Creation Rules**:
- Must have customer/lead (existing or create new)
- Must have vendor (from Dev 2's vendor system)
- Must have jobsite address (can differ from customer address)
- When created from existing lead: Change lead.status to "prospect"
- When created with new customer data: Create new lead with status "prospect"
- Initial status: "draft"
- Initial version: 1.0
- Auto-generate quote_number (tenant-specific sequential)
- Extract tenant_id from JWT (never from request body)

**Quote Number Generation**:
- Format: Tenant-defined prefix + sequential number
- Example: "Q-2024-001", "Q-2024-002", etc.
- Must be unique per tenant
- Auto-increment on creation
- Store both prefix and number (or combined string)

**Quote Validation Before Status Change to "ready"**:
- Must have at least 1 item OR 1 group with items
- Must have valid expiration date (in future)
- Must have jobsite address with valid coordinates
- Must have vendor assigned
- All items must have valid costs and pricing
- If approval required: Must have approvals (Dev 4 handles this check)

**Quote Update Rules**:
- Every update creates new version (version history)
- Version increment: Minor changes = +0.1, major changes = +1.0
- Cannot edit quote if status = "approved" (must be draft/ready/sent)
- Updating quote resets status to "draft" if currently "sent" or "read"
- Cannot change tenant_id (security violation)

**Quote Delete Rules**:
- Soft delete: Set is_archived=true (don't hard delete)
- Cannot delete if status = "approved" (return error)
- Archived quotes don't appear in normal lists
- Admins can view archived quotes

**Lead Integration Rules**:
- When quote created from lead_id: Update lead.status to "prospect"
- When quote approved: Update lead.status to "customer" (Dev 5 handles this)
- Quote always links to lead (required relationship)
- If creating new customer: Create lead record first, then quote

### Endpoints Required

#### 1. Create Quote from Existing Lead
```
POST /api/v1/quotes/from-lead/:leadId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Path Parameters**:
- leadId (required, UUID, must belong to tenant)

**Request Body**:
- vendor_id (required, UUID, must belong to tenant)
- title (required, 1-200 chars)
- jobsite_address (required, object - see structure below)
- po_number (optional, 1-100 chars)
- private_notes (optional, text)
- use_default_settings (optional, boolean, default true)
- custom_profit_percent (optional if use_default_settings=false)
- custom_overhead_percent (optional if use_default_settings=false)
- custom_contingency_percent (optional if use_default_settings=false)
- custom_terms (optional if use_default_settings=false, text)
- custom_payment_instructions (optional if use_default_settings=false, text)
- expiration_days (optional, integer > 0, default from tenant settings)

**Jobsite Address Structure**:
```json
{
  "address_line1": "string (required)",
  "address_line2": "string (optional)",
  "city": "string (optional if lat/lng provided)",
  "state": "string (optional if lat/lng provided)",
  "zip_code": "string (required)",
  "latitude": "decimal (optional)",
  "longitude": "decimal (optional)"
}
```

**Validation**:
- Verify lead_id exists and belongs to tenant
- Verify vendor_id exists and belongs to tenant
- Validate jobsite address via Google Maps (get lat/lng)
- If use_default_settings=false, validate custom values provided
- Calculate expires_at from expiration_days

**Business Logic**:
1. Extract tenant_id from JWT
2. Validate lead belongs to tenant
3. Validate vendor belongs to tenant
4. Validate and geocode jobsite address (use Google Maps service)
5. Generate quote_number (get max number for tenant, increment)
6. Create quote record with status="draft", version=1.0
7. Create quote_jobsite_address record
8. Create initial quote_version record (version 1.0)
9. Update lead.status to "prospect" (if not already)
10. Return complete quote with relationships

**Response**: Created quote object with:
- All quote fields
- Lead object (basic info)
- Vendor object (basic info)
- Jobsite address object
- Empty items array
- Empty groups array
- Empty attachments array

**Errors**:
- 404: Lead not found or belongs to different tenant
- 404: Vendor not found or belongs to different tenant
- 422: Address validation failed (Google Maps)
- 400: Validation errors (missing required fields, invalid values)

---

#### 2. Create Quote with New Customer
```
POST /api/v1/quotes/with-new-customer
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- All fields from "Create Quote" above, plus:
- customer (required, object with new customer data)

**Customer Data Structure**:
```json
{
  "first_name": "string (required)",
  "last_name": "string (required)",
  "email": "string (optional)",
  "phone": "string (required if no email)",
  "company_name": "string (optional)",
  "source": "string (enum, default 'manual')"
}
```

**Business Logic**:
1. Validate customer data (at least email OR phone required)
2. Create new lead record:
   - tenant_id from JWT
   - status = "prospect"
   - created_by_user_id from JWT
   - All customer data fields
3. Then create quote using new lead_id (same as endpoint 1)
4. All in one transaction (rollback if any step fails)

**Response**: Created quote object with newly created lead

**Errors**:
- 400: Customer validation failed (missing email and phone)
- 409: Phone or email already exists for this tenant (lead duplicate)
- 422: Address validation failed

---

#### 3. Create Quote Manually (Select Existing Customer)
```
POST /api/v1/quotes
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- Same as "Create Quote from Lead" but with:
- lead_id (required, UUID) instead of path parameter

**Business Logic**: Identical to endpoint 1, just different route structure

---

#### 4. List Quotes
```
GET /api/v1/quotes
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- page (optional, default 1)
- limit (optional, default 50, max 100)
- status (optional, filter by status enum)
- vendor_id (optional, filter by vendor)
- search (optional, search in quote_number, title, customer name)
- date_from (optional, filter created_at >= date)
- date_to (optional, filter created_at <= date)
- is_archived (optional, boolean, default false)
- sort_by (optional, enum: 'created_at', 'quote_number', 'status', default 'created_at')
- sort_order (optional, enum: 'asc', 'desc', default 'desc')

**Business Logic**:
- Always filter by tenant_id from JWT
- Exclude archived quotes unless is_archived=true
- Search: Match quote_number OR title OR customer first/last name (case-insensitive)
- Include relationships: lead (basic), vendor (basic), counts (items_count, groups_count)
- Calculate total_price for each quote (sum of items, no full calculation yet - Dev 4 adds that)

**Response**: Paginated list with:
```json
{
  "data": [
    {
      "id": "uuid",
      "quote_number": "Q-2024-001",
      "title": "Kitchen Remodel",
      "status": "draft",
      "lead": { "id": "uuid", "first_name": "John", "last_name": "Doe" },
      "vendor": { "id": "uuid", "name": "ABC Contracting" },
      "created_at": "2024-01-15T10:00:00Z",
      "expires_at": "2024-02-15T10:00:00Z",
      "items_count": 5,
      "groups_count": 2,
      "estimated_total": 15000.00
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 50,
    "total": 150,
    "total_pages": 3
  }
}
```

---

#### 5. Get Quote by ID
```
GET /api/v1/quotes/:id
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Verify quote belongs to tenant
- Include ALL relationships:
  - Lead (full object with emails, phones, addresses)
  - Vendor (full object with signature URL)
  - Jobsite address
  - Items (ordered by order_index)
  - Groups (ordered by order_index, with items)
  - Attachments (ordered by order_index)
  - Tags
  - Discount rules
  - Draw schedule entries
  - Approval records (if any)
- Calculate totals (basic sum of items - Dev 4 adds full pricing)

**Response**: Complete quote object with all nested data

**Errors**:
- 404: Quote not found or belongs to different tenant

---

#### 6. Update Quote Basic Info
```
PATCH /api/v1/quotes/:id
Auth: JWT required
Roles: Owner, Admin, Manager, Sales (own quotes only)
```

**Request Body** (all optional):
- title
- vendor_id
- po_number
- private_notes
- use_default_settings
- custom_profit_percent
- custom_overhead_percent
- custom_contingency_percent
- custom_terms
- custom_payment_instructions
- expiration_days

**Validation**:
- Cannot update if status = "approved"
- If changing vendor_id, verify vendor exists and belongs to tenant
- If use_default_settings changes to false, require custom values
- Sales role can only update own quotes (created_by_user_id match)

**Business Logic**:
1. Verify quote belongs to tenant and user has permission
2. If status was "sent" or "read", reset to "draft" (quote modified)
3. Increment version number (+0.1 for minor edit)
4. Update quote record
5. Create new quote_version record (snapshot current state)
6. Return updated quote

**Response**: Updated quote object

**Errors**:
- 400: Cannot edit approved quote
- 403: Insufficient permissions (Sales editing other user's quote)
- 404: Vendor not found

---

#### 7. Update Quote Status
```
PATCH /api/v1/quotes/:id/status
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- status (required, enum: 'draft', 'ready', 'sent', 'denied', 'lost')
- reason (required if status='denied' or 'lost', text)

**Validation**:
- Validate status transition is allowed (see status flow in contract)
- If changing to "ready": Run readiness validation (has items, vendor, address, etc.)
- If changing to "denied" or "lost": Require reason

**Allowed Transitions**:
- draft → ready (if validation passes)
- ready → sent (when sent to customer)
- sent → draft (user wants to edit)
- sent → denied (customer rejected)
- sent → lost (quote expired or abandoned)
- read → draft (user wants to edit)
- read → denied
- read → lost
- NOT allowed: Any status → approved (that's automatic via public URL)

**Business Logic**:
1. Verify current status and new status are valid transition
2. If ready: Validate quote completeness
3. Create new version (status change is major = +1.0)
4. Update quote.status
5. If denied/lost: Store reason in private_notes or separate field

**Response**: Updated quote with new status

**Errors**:
- 400: Invalid status transition
- 400: Quote not ready (missing items, vendor, etc.)
- 400: Reason required for denied/lost

---

#### 8. Update Jobsite Address
```
PATCH /api/v1/quotes/:id/jobsite-address
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- address_line1 (optional)
- address_line2 (optional)
- city (optional)
- state (optional)
- zip_code (optional)
- latitude (optional)
- longitude (optional)

**Business Logic**:
- If any address field changes, re-validate via Google Maps
- Update coordinates if address changed
- Create new quote version (+0.1)
- Cannot update if quote status = "approved"

**Response**: Updated jobsite address object

**Errors**:
- 422: Address validation failed

---

#### 9. Delete Quote (Soft Delete)
```
DELETE /api/v1/quotes/:id
Auth: JWT required
Roles: Owner, Admin
```

**Business Logic**:
- Cannot delete if status = "approved" (return 400)
- Set is_archived = true (soft delete)
- Do NOT delete related items, groups, attachments (preserve for history)
- Create final version record (archive action)

**Response**: 204 No Content

**Errors**:
- 400: Cannot delete approved quote
- 403: Insufficient permissions

---

#### 10. Clone Quote
```
POST /api/v1/quotes/:id/clone
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body** (optional):
- title (if not provided, use "Copy of {original title}")

**Business Logic** (COMPLEX - deep copy):
1. Verify source quote belongs to tenant
2. Create new quote with new ID:
   - Copy all quote fields except: id, quote_number, created_at
   - Generate new quote_number
   - Set status = "draft"
   - Set version = 1.0
   - Title = provided title OR "Copy of {original}"
   - created_by_user_id = current user (not original creator)
3. Clone jobsite address (new record, new ID)
4. Clone all items (new IDs, same data)
5. Clone all groups (new IDs, same data)
6. Clone all attachments (same file_id references, new attachment records)
7. Clone discount rules (new IDs, same data)
8. Clone draw schedule (new IDs, same data)
9. Do NOT clone: versions, approvals, view logs, tags (fresh start)
10. All in one transaction (rollback if any step fails)
11. Create initial version record for new quote

**Response**: Complete cloned quote object with all nested data

**Errors**:
- 404: Source quote not found

---

#### 11. Search Quotes
```
GET /api/v1/quotes/search
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- q (required, search query string)
- page, limit

**Search In**:
- quote_number (exact or partial match)
- title (partial match, case-insensitive)
- customer first_name, last_name (partial match)
- city (jobsite address)
- item titles (search in quote_item.title)
- tags (search in quote_tag.name)

**Business Logic**:
- Always filter by tenant_id
- Search across multiple fields (OR conditions)
- Rank results: Exact quote_number match first, then others
- Return same structure as List Quotes endpoint

**Response**: Paginated search results

---

#### 12. Get Quote Statistics
```
GET /api/v1/quotes/stats
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from (optional, filter by date range)
- date_to (optional)

**Business Logic**:
- Calculate for authenticated tenant only
- Total quotes (count)
- Quotes by status (breakdown with counts and percentages)
- Total estimated revenue (sum of all quote totals)
- Average quote value
- Conversion rate (approved / sent × 100)
- Quote velocity (quotes created this period vs previous period)

**Response**:
```json
{
  "total_quotes": 150,
  "by_status": {
    "draft": { "count": 20, "percentage": 13.3 },
    "ready": { "count": 15, "percentage": 10.0 },
    "sent": { "count": 40, "percentage": 26.7 },
    "approved": { "count": 50, "percentage": 33.3 },
    "denied": { "count": 15, "percentage": 10.0 },
    "lost": { "count": 10, "percentage": 6.7 }
  },
  "total_revenue": 2500000.00,
  "average_quote_value": 16666.67,
  "conversion_rate": 55.6,
  "quote_velocity": {
    "current_period": 25,
    "previous_period": 18,
    "change_percent": 38.9
  }
}
```

---

## 🏗️ MODULE 2: QUOTE ITEM MANAGEMENT

### Purpose

Items are the line items in a quote - individual tasks/products being quoted. Items have detailed cost breakdowns, can be organized into groups, can be reordered via drag & drop, and can be saved to the item library for reuse.

### Critical Business Rules

**Item Creation Rules**:
- Must belong to a quote
- Must have title (required)
- Must have quantity > 0
- Must have unit_measurement_id (from Dev 2's unit system)
- At least one cost field must be > 0
- Order_index determines display order
- If no group assigned, item is "ungrouped"
- If save_to_library = true, create item_library entry after save

**Item Cost Structure**:
- material_cost_per_unit (default 0)
- labor_cost_per_unit (default 0)
- equipment_cost_per_unit (default 0)
- subcontract_cost_per_unit (default 0)
- other_cost_per_unit (default 0)
- All must be >= 0 (no negative costs)

**Item Validation**:
- quantity must be > 0 (decimal allowed, e.g., 5.5)
- unit_measurement_id must exist and be accessible to tenant
- item_library_id (if provided) must belong to tenant
- warranty_tier_id (if provided) must belong to tenant
- Custom overrides (markup, discount, tax) handled by Dev 4

**Item Update Rules**:
- Updating item costs triggers quote version update (+0.1)
- Cannot update items if quote status = "approved"
- Changing order_index doesn't trigger version update (just reorder)

**Item Delete Rules**:
- Hard delete item (not soft delete)
- If item is only item in quote, return warning (quote must have items to be "ready")
- Deleting item triggers quote version update (+0.1)

**Save to Library Rules**:
- If save_to_library = true, create item_library entry
- Copy: title, description, costs, unit_measurement_id
- Do NOT copy: quantity (library uses default 1), group assignment
- Library entry is independent (editing library doesn't affect quote)

### Endpoints Required

#### 1. Add Item to Quote
```
POST /api/v1/quotes/:quoteId/items
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- title (required, 1-200 chars)
- description (optional, text)
- quantity (required, decimal > 0)
- unit_measurement_id (required, UUID)
- quote_group_id (optional, UUID, assign to group)
- item_library_id (optional, UUID, reference source)
- material_cost_per_unit (optional, decimal >= 0, default 0)
- labor_cost_per_unit (optional, decimal >= 0, default 0)
- equipment_cost_per_unit (optional, decimal >= 0, default 0)
- subcontract_cost_per_unit (optional, decimal >= 0, default 0)
- other_cost_per_unit (optional, decimal >= 0, default 0)
- private_notes (optional, text)
- save_to_library (optional, boolean, default false)
- warranty_tier_id (optional, UUID)

**Validation**:
- Verify quote belongs to tenant and is editable (not approved)
- Verify unit_measurement_id exists and is available to tenant
- If quote_group_id provided, verify group belongs to this quote
- If item_library_id provided, verify library item belongs to tenant
- If warranty_tier_id provided, verify warranty belongs to tenant
- At least one cost field must be > 0

**Business Logic**:
1. Set order_index = max(existing items in quote) + 1
2. Create quote_item record
3. If save_to_library = true:
   - Create item_library entry with same data
   - Set default_quantity = 1 (not from quote item)
   - Link: item_library_id for tracking
4. Update quote version (+0.1)
5. Return created item with calculated totals

**Response**: Created item object with:
- All item fields
- Unit measurement object (name, abbreviation)
- Warranty tier object (if assigned)
- Calculated total_cost (quantity × sum of costs)
- Calculated total_price (Dev 4 adds full pricing calculation)

**Errors**:
- 400: Quote is approved (cannot edit)
- 404: Unit measurement not found
- 404: Group not found or doesn't belong to this quote
- 400: All costs are zero

---

#### 2. Add Item from Library
```
POST /api/v1/quotes/:quoteId/items/from-library/:libraryItemId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body** (all optional, override library defaults):
- quantity (override default)
- Any cost fields (override defaults)
- quote_group_id (assign to group)

**Business Logic**:
1. Fetch library item (verify belongs to tenant)
2. Create quote_item with library data
3. Apply any overrides from request body
4. Set item_library_id = libraryItemId (track source)
5. Set order_index = max + 1
6. Update quote version (+0.1)

**Response**: Created item object

**Errors**:
- 404: Library item not found or belongs to different tenant

---

#### 3. List Quote Items
```
GET /api/v1/quotes/:quoteId/items
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- include_grouped (optional, boolean, default true - include items in groups)
- group_id (optional, UUID, filter by group)

**Business Logic**:
- Verify quote belongs to tenant
- Return items ordered by order_index
- If include_grouped=false, return only ungrouped items
- If group_id provided, return only items in that group
- Include: unit measurement, warranty tier (if assigned), group name (if assigned)

**Response**: Array of items with relationships

---

#### 4. Get Item by ID
```
GET /api/v1/quotes/:quoteId/items/:itemId
Auth: JWT required
Roles: All authenticated users
```

**Validation**:
- Verify quote belongs to tenant
- Verify item belongs to this quote

**Response**: Single item object with all relationships

**Errors**:
- 404: Item not found or doesn't belong to this quote

---

#### 5. Update Item
```
PATCH /api/v1/quotes/:quoteId/items/:itemId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body** (all optional):
- title
- description
- quantity
- unit_measurement_id
- All cost fields
- private_notes
- warranty_tier_id
- quote_group_id (move to different group or null for ungrouped)

**Business Logic**:
- Verify quote not approved
- Verify item belongs to quote
- If moving to group, verify group belongs to quote
- Update item record
- Update quote version (+0.1 if costs changed)

**Response**: Updated item object

**Errors**:
- 400: Quote is approved
- 404: Group not found

---

#### 6. Delete Item
```
DELETE /api/v1/quotes/:quoteId/items/:itemId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Verify quote not approved
- Hard delete item record
- Update quote version (+0.1)
- Reorder remaining items if needed (close gaps in order_index)

**Response**: 204 No Content

**Errors**:
- 400: Quote is approved

---

#### 7. Duplicate Item
```
POST /api/v1/quotes/:quoteId/items/:itemId/duplicate
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Copy all item data to new record
- New ID generated
- Title suffixed with " (Copy)"
- order_index = original + 1 (insert right after original)
- Increment order_index of items below
- Update quote version (+0.1)

**Response**: Created duplicate item

---

#### 8. Reorder Items (Drag & Drop)
```
PATCH /api/v1/quotes/:quoteId/items/reorder
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- items (required, array of objects with id and new_order_index)

**Example**:
```json
{
  "items": [
    { "id": "item-1-uuid", "new_order_index": 0 },
    { "id": "item-2-uuid", "new_order_index": 1 },
    { "id": "item-3-uuid", "new_order_index": 2 }
  ]
}
```

**Business Logic**:
- Verify all items belong to this quote
- Update order_index for each item
- Do NOT create version (just visual reorder)
- Transaction: All or nothing

**Response**: Success message

**Errors**:
- 400: Some items don't belong to this quote

---

#### 9. Move Item to Group
```
PATCH /api/v1/quotes/:quoteId/items/:itemId/move-to-group
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- quote_group_id (required, UUID, or null for ungrouped)

**Business Logic**:
- Verify group belongs to quote (or null for ungrouped)
- Update item.quote_group_id
- Set order_index = max(items in target group/ungrouped) + 1
- Update quote version (+0.1)

**Response**: Updated item object

---

#### 10. Save Item to Library
```
POST /api/v1/quotes/:quoteId/items/:itemId/save-to-library
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Create item_library entry from quote_item
- Copy: title, description, costs, unit_measurement_id
- Set: default_quantity = 1, tenant_id from JWT
- Do NOT copy: quantity (use default), group, private_notes
- Link: Set item.item_library_id for reference

**Response**: Created library item object

---

## 🏗️ MODULE 3: QUOTE GROUP MANAGEMENT

### Purpose

Groups organize related items into logical sections (e.g., "Kitchen Work", "Bathroom Renovation"). Groups have subtotals and can be reordered.

### Critical Business Rules

**Group Creation Rules**:
- Must belong to a quote
- Must have name (required)
- order_index determines display order
- Can be empty initially (validation on quote status change requires items)

**Group Subtotal**:
- Calculated as sum of all item totals in group
- Not stored in database (computed on read)
- Dev 4 adds full pricing with profit/overhead/contingency

**Group Operations**:
- Moving items to group: Update item.quote_group_id
- Deleting group: Can either delete items OR move to ungrouped (ask user)
- Duplicating group: Copy group + all items inside

### Endpoints Required

#### 1. Create Group
```
POST /api/v1/quotes/:quoteId/groups
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- name (required, 1-200 chars)
- description (optional, text)

**Business Logic**:
- Verify quote belongs to tenant and is editable
- Set order_index = max(existing groups) + 1
- Create quote_group record
- Update quote version (+0.1)

**Response**: Created group object

---

#### 2. List Groups
```
GET /api/v1/quotes/:quoteId/groups
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Verify quote belongs to tenant
- Return groups ordered by order_index
- Include items array for each group (ordered by order_index)
- Calculate subtotal for each group

**Response**: Array of groups with nested items

---

#### 3. Get Group by ID
```
GET /api/v1/quotes/:quoteId/groups/:groupId
Auth: JWT required
Roles: All authenticated users
```

**Response**: Single group with items array and calculated subtotal

---

#### 4. Update Group
```
PATCH /api/v1/quotes/:quoteId/groups/:groupId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body** (all optional):
- name
- description

**Business Logic**:
- Verify quote not approved
- Update group record
- Update quote version (+0.1)

**Response**: Updated group object

---

#### 5. Delete Group
```
DELETE /api/v1/quotes/:quoteId/groups/:groupId
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Query Parameters**:
- delete_items (optional, boolean, default false)

**Business Logic**:
- If delete_items = true: Delete group and all items inside (cascade)
- If delete_items = false: Move items to ungrouped (set quote_group_id = null)
- Update quote version (+0.1)
- Reorder remaining groups if needed

**Response**: 204 No Content

**Errors**:
- 400: Quote is approved

---

#### 6. Duplicate Group
```
POST /api/v1/quotes/:quoteId/groups/:groupId/duplicate
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Copy group with new ID
- Name suffixed with " (Copy)"
- order_index = original + 1
- Copy ALL items in group (new IDs)
- Items keep same order_index within group
- Update quote version (+0.1)

**Response**: Created group with duplicated items

---

## 🏗️ MODULE 4: ITEM LIBRARY SYSTEM

### Purpose

Item library is a tenant-specific catalog of reusable items. Users save commonly used items to quickly add them to future quotes without re-entering all data.

### Critical Business Rules

**Library Item Rules**:
- Belongs to tenant (tenant_id required)
- Acts as template only (not linked to quotes)
- Track usage: usage_count, last_used_at
- Can be edited (affects future uses only, not existing quotes)
- Can be marked inactive (hide from selection)
- Cannot be deleted if usage_count > 0 (data integrity)

**Usage Tracking**:
- Increment usage_count when added to quote
- Update last_used_at timestamp
- Used for sorting (most used first) and statistics

### Endpoints Required

#### 1. Create Library Item
```
POST /api/v1/item-library
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- title (required, 1-200 chars)
- description (optional, text)
- default_quantity (optional, decimal > 0, default 1)
- unit_measurement_id (required, UUID)
- material_cost_per_unit (optional, decimal >= 0, default 0)
- labor_cost_per_unit (optional, decimal >= 0, default 0)
- equipment_cost_per_unit (optional, decimal >= 0, default 0)
- subcontract_cost_per_unit (optional, decimal >= 0, default 0)
- other_cost_per_unit (optional, decimal >= 0, default 0)

**Validation**:
- Extract tenant_id from JWT
- Verify unit_measurement_id exists and is available to tenant
- At least one cost field must be > 0
- Set created_by_user_id from JWT

**Response**: Created library item

---

#### 2. List Library Items
```
GET /api/v1/item-library
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- is_active (optional, boolean, default true)
- search (optional, search in title/description)
- unit_id (optional, filter by unit)
- sort_by (optional, enum: 'title', 'usage_count', 'last_used_at', default 'usage_count')
- sort_order (optional, enum: 'asc', 'desc', default 'desc')
- page, limit

**Business Logic**:
- Filter by tenant_id from JWT
- Default sort: Most used first (usage_count DESC)
- Include unit measurement object

**Response**: Paginated library items list

---

#### 3. Get Library Item by ID
```
GET /api/v1/item-library/:id
Auth: JWT required
Roles: All authenticated users
```

**Validation**:
- Verify item belongs to tenant

**Response**: Single library item with unit measurement

---

#### 4. Update Library Item
```
PATCH /api/v1/item-library/:id
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- All fields from creation

**Business Logic**:
- Update only affects future uses (existing quotes unchanged)
- Cannot change usage_count or last_used_at (automatic)

**Response**: Updated library item

---

#### 5. Delete Library Item
```
DELETE /api/v1/item-library/:id
Auth: JWT required
Roles: Owner, Admin
```

**Business Logic**:
- Check usage_count
- If usage_count > 0: Return 400 "Item has been used in quotes, cannot delete. Mark inactive instead."
- If usage_count = 0: Hard delete

**Response**: 204 No Content

**Errors**:
- 400: Item in use (cannot delete)

---

#### 6. Mark Library Item Inactive
```
PATCH /api/v1/item-library/:id/deactivate
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Set is_active = false
- Item hidden from selection but preserved in database
- Existing quotes still show this item (data intact)

**Response**: Updated library item

---

#### 7. Get Library Item Statistics
```
GET /api/v1/item-library/:id/stats
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Count quotes using this item
- Total revenue from quotes with this item (Dev 4 calculates)
- Average quantity used
- Last 10 quotes using this item

**Response**: Statistics object

---

#### 8. Bulk Import Library Items
```
POST /api/v1/item-library/bulk-import
Auth: JWT required
Roles: Owner, Admin
```

**Request Body**:
- items (required, array of library item objects)

**Business Logic**:
- Validate all items
- Create all in transaction (all or nothing)
- Set tenant_id and created_by_user_id
- Return success/error for each item

**Response**: Array of results (success/error per item)

---

## 🔗 SERVICE INTEGRATION

### Existing Services You MUST Reuse

**Lead Module Integration**:
- When creating quote from lead: Fetch lead data (verify ownership)
- When creating quote: Update lead.status to "prospect"
- When quote approved (Dev 5): Update lead.status to "customer"
- Access lead relationships: emails, phones, addresses

**Google Maps Service** (from Leads Module):
- Validate jobsite address (same as lead address validation)
- Forward geocoding if lat/lng missing
- Reverse geocoding if city/state missing
- Store google_place_id for reference

**Vendor Service** (from Dev 2):
- Verify vendor_id exists and belongs to tenant
- Fetch vendor details for quote display

**Unit Measurement Service** (from Dev 2):
- Verify unit_measurement_id accessible to tenant (global or custom)
- Fetch unit details for display

**Item Library Service** (from Dev 2, but you extend it):
- Actually this is YOUR responsibility to build
- Dev 2 built bundles, you build item library

**File Storage** (Dev 5 uses this):
- Not needed in your scope
- Attachments handled by Dev 5

### Transaction Management

**Critical: Use Database Transactions**

Operations requiring transactions:
1. **Create Quote with New Customer**: Create lead → Create quote → Create address
2. **Clone Quote**: Create quote → Create address → Create items → Create groups → Create attachments
3. **Duplicate Group**: Create group → Create all items in group
4. **Bulk Import Library**: Create all items atomically

**Transaction Pattern**:
- Start transaction
- Execute all operations
- If any fails: Rollback entire transaction
- If all succeed: Commit transaction
- Return error if rollback, or success if commit

### Version History Automation

**Every Quote Modification Creates Version**:

Trigger version creation on:
- Quote created (version 1.0)
- Quote updated (version +0.1 or +1.0)
- Item added/updated/deleted (version +0.1)
- Group added/updated/deleted (version +0.1)
- Status changed (version +1.0)
- Settings changed (version +0.1)

**Version Increment Rules**:
- Minor change (edit, add/delete item): +0.1
- Major change (status change, significant edit): +1.0
- Your service decides increment amount

**Version Snapshot Data**:
Store in quote_version.snapshot_data (JSON):
```json
{
  "quote": { /* all quote fields */ },
  "items": [ /* all items */ ],
  "groups": [ /* all groups */ ],
  "jobsite_address": { /* address */ },
  "totals": { /* calculated totals */ },
  "metadata": {
    "items_count": 5,
    "groups_count": 2,
    "version_number": 1.1,
    "changed_at": "2024-01-15T10:00:00Z"
  }
}
```

---

## ✅ VALIDATION RULES

### Quote Validation

**Create Quote**:
- tenant_id from JWT (never from body)
- lead_id exists and belongs to tenant
- vendor_id exists and belongs to tenant
- title: 1-200 chars, required
- jobsite_address: All required fields present, valid coordinates after Google Maps
- expiration_days > 0 or use tenant default
- If custom settings: All custom values provided

**Update Quote**:
- Cannot edit if status = "approved"
- Sales role: Can only edit own quotes (created_by_user_id match)
- Version number auto-increments

**Status Change Validation**:
- Only allowed transitions (see contract)
- Ready status requires: items, vendor, address, valid expiration
- Denied/lost requires reason

**Delete Quote**:
- Cannot delete if status = "approved"
- Soft delete only (is_archived = true)

### Item Validation

**Create/Update Item**:
- title: 1-200 chars, required
- quantity > 0, required
- unit_measurement_id exists and accessible
- At least one cost field > 0
- All costs >= 0 (no negative)
- If quote_group_id: Group belongs to same quote
- If warranty_tier_id: Warranty belongs to tenant

**Item Library Validation**:
- Same as item validation
- default_quantity defaults to 1
- Cannot delete if usage_count > 0

### Group Validation

**Create/Update Group**:
- name: 1-200 chars, required
- Can be empty initially
- Cannot delete if quote is approved

---

## 🎯 SUCCESS CRITERIA

You are done when:

- [ ] All 42 endpoints implemented and tested
- [ ] All services have complex business logic
- [ ] All DTOs created with comprehensive validation
- [ ] Transaction handling for nested operations works
- [ ] Version history creates snapshot on every change
- [ ] Lead status integration working (prospect on quote create)
- [ ] Google Maps address validation working
- [ ] Clone quote copies all nested data correctly
- [ ] Duplicate item/group works correctly
- [ ] Save to library creates library entries
- [ ] Order index management (drag & drop) works
- [ ] 100% API documentation complete
- [ ] All relationships loading correctly
- [ ] Multi-tenant isolation verified
- [ ] No TypeScript errors
- [ ] Server runs without errors
- [ ] All endpoints testable via Swagger
- [ ] Backend Developer 4 has everything needed to start

---

## 📝 API DOCUMENTATION REQUIREMENTS

Create `/api/documentation/quotes_REST_API_DEV3.md` with:

**For EACH endpoint** (42 total):
1. HTTP method and path
2. Purpose (what it does)
3. Authentication requirements
4. RBAC roles allowed
5. Path parameters (with types, descriptions)
6. Query parameters (all options with defaults)
7. Request body schema (complete structure, all fields)
8. Validation rules (all requirements)
9. Business logic summary (what happens)
10. Success response (status code, complete schema with examples)
11. Error responses (all possible codes with examples)
12. Integration notes (what other services used)
13. Transaction scope (if applicable)
14. Version impact (does it create version?)
15. Example request (complete, valid example)
16. Example response (complete, realistic data)

**Additional Documentation**:
- Overview of quote lifecycle
- Version history system explanation
- Lead integration flow
- Clone operation deep dive
- Order index management strategy
- Common error scenarios

---

## 📋 HANDOFF DOCUMENT

Create `/api/documentation/quotes_HANDOFF_DEV3.md` with:

**What You Completed**:
- Endpoints implemented (42 total with details)
- Services created (6+ services)
- DTOs created (count them all)
- Transaction patterns implemented
- Version history automation working

**Files Created/Modified**:
- Complete list of new files
- List of modified files (quotes.module.ts, etc.)

**Testing Performed**:
- Quote CRUD tested (all scenarios)
- Item management tested
- Group management tested
- Library system tested
- Clone operation tested (deep copy verification)
- Lead integration tested
- Version history tested (snapshots created)
- Transaction rollback tested

**Integration Verification**:
- Lead status changes confirmed
- Google Maps validation working
- Vendor/unit lookups working
- Multi-tenant isolation verified

**Developer 4 Readiness**:
- [ ] All quote/item data available
- [ ] Version history working
- [ ] Ready for pricing calculations
- [ ] Ready for approval workflow
- [ ] No blocking issues

**Database Performance**:
- Query performance notes
- Index usage confirmed
- Transaction performance acceptable

**Known Limitations** (if any):
- Document any edge cases
- Note any temporary workarounds

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Forgetting transactions**: Clone and nested creates MUST use transactions
2. **Not creating versions**: Every change must create version snapshot
3. **Forgetting tenant_id**: Always filter by tenant in every query
4. **Not updating lead status**: Must change to "prospect" on quote create
5. **Poor order_index management**: Gaps and duplicates cause problems
6. **Not validating jobsite address**: Must use Google Maps
7. **Allowing approved quote edits**: Status = approved is locked
8. **Not handling clone deep copy**: Must copy ALL nested data
9. **Forgetting to increment usage_count**: Track library item usage
10. **Missing validation**: Validate everything before database
11. **Not documenting complex operations**: Clone, transactions need clear docs
12. **Ignoring RBAC**: Sales can only edit own quotes

---

## 🚀 YOU'RE READY

You are building the core of the quote system - the functionality users interact with daily. Your work enables users to create quotes efficiently and manage them throughout their lifecycle.

**Your work enables**:
- Dev 4: Pricing calculations (needs item data)
- Dev 4: Approval workflow (needs quote status)
- Dev 5: PDF generation (needs complete quote data)
- Dev 5: Public sharing (needs quote structure)
- Frontend: Quote builder UI (needs all your endpoints)

**This is complex work with many moving parts:**
- Nested transactions
- Version history
- Deep cloning
- Order management
- Lead integration
- Address validation

**Take your time. Test thoroughly. Document everything.**

**When complete, notify Backend Reviewer for approval before Backend Developer 4 starts.**

---

**Status**: 📋 **READY FOR IMPLEMENTATION**