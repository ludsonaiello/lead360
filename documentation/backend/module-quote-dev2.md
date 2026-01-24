# Backend Developer 2: Vendor, Bundle, Settings & Template Management

**Module**: Quote Management System  
**Phase**: Foundation Services  
**Timeline**: 1.5 weeks  
**Complexity**: Medium-High  
**Dependencies**: Backend Developer 1 MUST be complete  
**Your Role**: Build support infrastructure for quote creation

---

## 🎯 YOUR MISSION

You are responsible for building all the supporting systems that quotes depend on. Users need vendors, units, bundles, settings, and templates BEFORE they can create quotes.

**You will create**:
- Vendor management (who creates the quote)
- Unit measurement system (how items are priced)
- Bundle/package system (pre-configured item groups)
- Quote settings management (tenant defaults)
- PDF template system (admin creates, tenants use)
- Template variables API (what data is available to templates)

**You will NOT**:
- Build quote CRUD (that's Developer 3)
- Build items or groups (that's Developer 3)
- Build pricing calculations (that's Developer 4)
- Build frontend (that's Frontend team)

---

## 📋 WHAT YOU MUST DELIVER

### Deliverables Checklist

- [ ] Vendor CRUD (8 endpoints with Google Maps validation)
- [ ] Unit measurement system (10 endpoints - global + tenant)
- [ ] Bundle CRUD (8 endpoints with item management)
- [ ] Tenant quote settings (4 endpoints)
- [ ] Admin template management (10 endpoints)
- [ ] Template variables endpoint (1 endpoint)
- [ ] 100% API documentation in REST_API file
- [ ] All DTOs with validation
- [ ] Service layer with business logic
- [ ] Controller layer with proper RBAC
- [ ] Handoff document for Backend Developer 3

### Files You Will Create

```
/var/www/lead360.app/api/src/modules/quotes/
├── quotes.module.ts (CREATE - register all services/controllers)
├── controllers/
│   ├── vendor.controller.ts (CREATE)
│   ├── unit-measurement.controller.ts (CREATE)
│   ├── bundle.controller.ts (CREATE)
│   ├── quote-settings.controller.ts (CREATE)
│   └── quote-template.controller.ts (CREATE - admin only)
├── services/
│   ├── vendor.service.ts (CREATE)
│   ├── unit-measurement.service.ts (CREATE)
│   ├── bundle.service.ts (CREATE)
│   ├── quote-settings.service.ts (CREATE)
│   └── quote-template.service.ts (CREATE)
├── dto/
│   ├── vendor/ (CREATE - all vendor DTOs)
│   ├── unit-measurement/ (CREATE - all unit DTOs)
│   ├── bundle/ (CREATE - all bundle DTOs)
│   ├── settings/ (CREATE - all settings DTOs)
│   └── template/ (CREATE - all template DTOs)
└── guards/
    └── (reuse existing guards)

/var/www/lead360.app/api/documentation/
├── quotes_REST_API_DEV2.md (CREATE - 100% endpoint documentation)
└── quotes_HANDOFF_DEV2.md (CREATE - handoff to Dev 3)
```

---

## 🏗️ MODULE 1: VENDOR MANAGEMENT

### Purpose

Vendors are company representatives who can be assigned to quotes. Each vendor has contact info, address, and signature image. One vendor can be marked as default (auto-selected on new quotes).

### Business Rules

**Vendor Requirements**:
- Must have name, email, phone, address, signature image
- Email must be unique per tenant (cannot have 2 vendors with same email)
- Address must be validated via Google Maps API
- Address must have valid latitude/longitude coordinates
- Signature must be a PNG file uploaded via file storage module
- Only one vendor can be marked as default per tenant
- Cannot delete vendor if assigned to any quotes (return error)
- Can mark vendor as inactive (hides from selection but preserves data)

**Address Validation Rules**:
- MUST reuse existing Google Maps integration (from leads module)
- If lat/lng provided: Use them, validate city/state if missing
- If lat/lng missing: Forward geocode address to get coordinates
- Auto-fill missing city/state from Google Maps response
- Store google_place_id for reference
- All addresses MUST have valid coordinates after validation

**Signature Image Rules**:
- MUST use existing file storage module (FilesService)
- Accept PNG only (validate MIME type)
- Maximum file size: 2MB
- Store file_id reference in vendor.signature_file_id
- When vendor deleted, do NOT delete signature file (other quotes may reference)

### Endpoints Required

#### 1. Create Vendor
```
POST /api/v1/vendors
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- name (required, 1-200 chars)
- email (required, valid email format, unique per tenant)
- phone (required, valid phone format)
- address_line1 (required, 1-255 chars)
- address_line2 (optional, 1-255 chars)
- city (optional if lat/lng provided, 1-100 chars)
- state (optional if lat/lng provided, 2 chars)
- zip_code (required, 5 or 10 chars)
- latitude (optional, decimal)
- longitude (optional, decimal)
- signature_file_id (required, valid file_id from file storage)
- is_default (optional, boolean, default false)

**Validation**:
- Extract tenant_id from JWT (never from request body)
- Validate email unique within tenant
- Validate phone format (use existing phone validation)
- Validate signature_file_id exists and belongs to tenant
- Call Google Maps validation (reuse existing service)
- If setting is_default=true, unset default on other vendors for this tenant
- Set is_active=true automatically

**Response**: Created vendor object with all fields including generated coordinates

**Errors**:
- 400: Validation failed
- 409: Email already exists for this tenant
- 422: Address validation failed (Google Maps)

---

#### 2. List Vendors
```
GET /api/v1/vendors
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- is_active (optional, boolean, filter by active status)
- page (optional, default 1)
- limit (optional, default 50, max 100)

**Business Logic**:
- Always filter by tenant_id from JWT
- Return active vendors first, then inactive
- Default vendor appears first in list
- Include signature_url (presigned URL from file storage)

**Response**: Paginated vendor list with metadata

---

#### 3. Get Vendor by ID
```
GET /api/v1/vendors/:id
Auth: JWT required
Roles: All authenticated users
```

**Validation**:
- Verify vendor belongs to authenticated tenant (tenant_id match)
- Return 404 if not found or wrong tenant

**Response**: Single vendor object with all fields

---

#### 4. Update Vendor
```
PATCH /api/v1/vendors/:id
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- name
- email (must still be unique per tenant)
- phone
- address fields (if any address field changes, re-validate with Google Maps)
- signature_file_id (must belong to tenant)
- is_default
- is_active

**Business Logic**:
- If email changes, validate uniqueness
- If any address field changes, re-run Google Maps validation
- If is_default changes to true, unset default on others
- Cannot set is_active=false if vendor is default (must choose new default first)

**Response**: Updated vendor object

**Errors**:
- 400: Cannot deactivate default vendor
- 409: Email already exists
- 422: Address validation failed

---

#### 5. Delete Vendor
```
DELETE /api/v1/vendors/:id
Auth: JWT required
Roles: Owner, Admin
```

**Business Logic**:
- Check if vendor assigned to any quotes
- If assigned: Return 400 error "Cannot delete vendor assigned to quotes"
- If not assigned: Hard delete vendor record
- Do NOT delete signature file (keep for historical quotes)

**Response**: 204 No Content

**Errors**:
- 400: Vendor assigned to quotes (cannot delete)

---

#### 6. Set Default Vendor
```
PATCH /api/v1/vendors/:id/set-default
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Unset is_default on all other vendors for this tenant
- Set is_default=true on this vendor
- Vendor must be active to become default

**Response**: Updated vendor object

**Errors**:
- 400: Vendor is inactive (cannot set inactive as default)

---

#### 7. Upload Vendor Signature
```
POST /api/v1/vendors/:id/signature
Auth: JWT required
Roles: Owner, Admin, Manager
Content-Type: multipart/form-data
```

**Request Body**:
- file (required, PNG only, max 2MB)

**Business Logic**:
- Use FilesService to upload signature
- Validate file is PNG
- Validate file size < 2MB
- Store in file storage with category="vendor_signature"
- Update vendor.signature_file_id with new file_id
- Old signature file can be deleted (no longer referenced)

**Response**: Vendor object with new signature_url

**Errors**:
- 400: Invalid file type (must be PNG)
- 413: File too large (max 2MB)

---

#### 8. Get Vendor Statistics
```
GET /api/v1/vendors/:id/stats
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Count total quotes assigned to this vendor
- Count quotes by status (draft, sent, approved, etc.)
- Calculate total revenue from approved quotes
- Calculate average quote value

**Response**:
```json
{
  "vendor_id": "uuid",
  "total_quotes": 45,
  "quotes_by_status": {
    "draft": 5,
    "sent": 10,
    "approved": 20,
    "denied": 5,
    "lost": 5
  },
  "total_revenue": 125000.00,
  "average_quote_value": 2777.78
}
```

---

## 🏗️ MODULE 2: UNIT MEASUREMENT SYSTEM

### Purpose

Units define how items are measured and priced (square foot, hour, each, linear foot, etc.). Admin creates global units available to all tenants. Tenants can create custom units for their specific needs.

### Business Rules

**Global Units (Admin Created)**:
- Created by platform admin only
- tenant_id = NULL (available to all tenants)
- is_global = true
- Cannot be edited by tenants
- Cannot be deleted if used in any quote
- Must seed at least 10 common units on first deployment

**Tenant Custom Units**:
- Created by tenant users
- tenant_id = authenticated tenant
- is_global = false
- Only visible to creating tenant
- Can edit own custom units
- Cannot delete if used in any quotes

**Default Global Units** (seed these):
1. Each (ea)
2. Square Foot (sq ft)
3. Linear Foot (lin ft)
4. Hour (hr)
5. Cubic Yard (cu yd)
6. Ton (ton)
7. Gallon (gal)
8. Pound (lb)
9. Box (box)
10. Bundle (bundle)

### Endpoints Required

#### 1. Create Global Unit (Admin Only)
```
POST /api/v1/admin/units
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body**:
- name (required, 1-100 chars)
- abbreviation (required, 1-20 chars)

**Business Logic**:
- Set tenant_id = NULL
- Set is_global = true
- Set is_active = true
- Name must be unique globally (across all units)

**Response**: Created unit object

---

#### 2. Create Tenant Custom Unit
```
POST /api/v1/units
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- name (required, 1-100 chars)
- abbreviation (required, 1-20 chars)

**Business Logic**:
- Set tenant_id = authenticated tenant
- Set is_global = false
- Set is_active = true
- Name must be unique within this tenant (can duplicate global names)

**Response**: Created unit object

---

#### 3. List All Available Units (Tenant View)
```
GET /api/v1/units
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- is_active (optional, boolean, default true)
- page (optional, default 1)
- limit (optional, default 100)

**Business Logic**:
- Return global units (tenant_id IS NULL) + tenant custom units (tenant_id = authenticated tenant)
- Sort: Global units first (alphabetical), then tenant units (alphabetical)
- Filter by is_active if specified

**Response**: Paginated list of units

---

#### 4. List Global Units (Admin View)
```
GET /api/v1/admin/units
Auth: JWT required
Roles: Platform Admin ONLY
```

**Query Parameters**:
- is_active (optional, boolean)
- page, limit

**Business Logic**:
- Return ONLY global units (tenant_id IS NULL)
- Include usage statistics (how many quotes/items use each unit)

**Response**: Paginated list with stats

---

#### 5. Get Unit by ID
```
GET /api/v1/units/:id
Auth: JWT required
Roles: All authenticated users
```

**Validation**:
- Must be global unit OR belong to authenticated tenant
- 404 if not found or belongs to different tenant

**Response**: Single unit object

---

#### 6. Update Global Unit (Admin Only)
```
PATCH /api/v1/admin/units/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body** (all optional):
- name
- abbreviation
- is_active

**Business Logic**:
- Can only update global units
- Name must remain unique globally

**Response**: Updated unit object

---

#### 7. Update Tenant Custom Unit
```
PATCH /api/v1/units/:id
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- name
- abbreviation
- is_active

**Business Logic**:
- Can only update units belonging to authenticated tenant
- Cannot update global units (403 error)
- Name must remain unique within tenant

**Response**: Updated unit object

**Errors**:
- 403: Cannot edit global unit

---

#### 8. Delete Unit
```
DELETE /api/v1/units/:id
Auth: JWT required
Roles: Owner, Admin (tenant), Platform Admin (global)
```

**Business Logic**:
- Check if unit used in any quote_item, item_library, or quote_bundle_item
- If used: Return 400 "Cannot delete unit currently in use"
- If not used: Hard delete
- Tenant users can only delete their own custom units
- Admin can only delete global units

**Response**: 204 No Content

**Errors**:
- 400: Unit in use (cannot delete)
- 403: Insufficient permissions

---

#### 9. Get Unit Usage Statistics
```
GET /api/v1/units/:id/stats
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Count usage in quote_item table
- Count usage in item_library table
- Count usage in quote_bundle_item table
- For tenant units: Only count within their tenant
- For global units: Count across all tenants (admin only)

**Response**:
```json
{
  "unit_id": "uuid",
  "name": "Square Foot",
  "quote_items_count": 1250,
  "library_items_count": 45,
  "bundle_items_count": 12,
  "total_usage": 1307
}
```

---

#### 10. Seed Default Global Units (One-time Setup)
```
POST /api/v1/admin/units/seed-defaults
Auth: JWT required
Roles: Platform Admin ONLY
```

**Business Logic**:
- Check if default units already exist (don't duplicate)
- Create all 10 default global units
- Set tenant_id = NULL, is_global = true, is_active = true
- Idempotent: Can run multiple times without duplicating

**Response**: Array of created units

---

## 🏗️ MODULE 3: BUNDLE/PACKAGE SYSTEM

### Purpose

Bundles are pre-configured packages of items that tenants create for quick quote building. When a bundle is added to a quote, it creates individual quote items (not linked - bundles are templates only).

### Business Rules

**Bundle Requirements**:
- Must belong to tenant (no global bundles in Phase 1)
- Must have at least 1 item to be usable
- Can have optional discount (percentage or fixed amount)
- Bundle price = sum of all item prices - discount
- Can mark as inactive (hides from selection)

**Bundle Items**:
- Same structure as quote items (quantity, costs, unit)
- Can reference item_library for defaults
- Can override library values
- Order matters (order_index)

**Usage**:
- When bundle added to quote, creates individual quote_item records
- NOT linked to bundle (changes to bundle don't affect existing quotes)
- Bundle acts as template only

### Endpoints Required

#### 1. Create Bundle
```
POST /api/v1/bundles
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- name (required, 1-200 chars)
- description (optional, text)
- discount_type (optional, enum: 'percentage' | 'fixed')
- discount_value (optional, decimal, required if discount_type set)
- items (required, array of bundle items, minimum 1)

**Bundle Item Structure**:
```json
{
  "item_library_id": "uuid (optional)",
  "title": "string (required)",
  "description": "string (optional)",
  "quantity": 5.5,
  "unit_measurement_id": "uuid (required)",
  "material_cost_per_unit": 10.00,
  "labor_cost_per_unit": 25.00,
  "equipment_cost_per_unit": 0.00,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.00,
  "order_index": 0
}
```

**Validation**:
- Extract tenant_id from JWT
- Validate at least 1 item provided
- Validate all unit_measurement_id exist and are available to tenant
- If discount_type set, discount_value required and > 0
- If discount_type = 'percentage', value must be 0-100
- Validate all cost fields >= 0
- Validate quantity > 0
- Set created_by_user_id from JWT

**Business Logic**:
- Create bundle record
- Create all bundle_item records in transaction
- Calculate total bundle price and return in response

**Response**: Created bundle with items array

---

#### 2. List Bundles
```
GET /api/v1/bundles
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- is_active (optional, boolean, default true)
- search (optional, search in name/description)
- page, limit

**Business Logic**:
- Filter by tenant_id from JWT
- Sort by name alphabetically
- Include item count and calculated price in response

**Response**: Paginated bundle list with summary data

---

#### 3. Get Bundle by ID
```
GET /api/v1/bundles/:id
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Verify bundle belongs to authenticated tenant
- Include all items with full details
- Include calculated total price

**Response**: Single bundle with complete items array

---

#### 4. Update Bundle
```
PATCH /api/v1/bundles/:id
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- name
- description
- discount_type
- discount_value
- is_active

**Business Logic**:
- Cannot update items here (use separate endpoints)
- If discount_type changes, must provide new discount_value
- Recalculate bundle price if discount changes

**Response**: Updated bundle object

---

#### 5. Delete Bundle
```
DELETE /api/v1/bundles/:id
Auth: JWT required
Roles: Owner, Admin
```

**Business Logic**:
- Hard delete bundle and all associated bundle_items (cascade)
- Safe to delete because bundles don't link to quotes (quotes copy data)

**Response**: 204 No Content

---

#### 6. Add Item to Bundle
```
POST /api/v1/bundles/:bundleId/items
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**: Same as bundle item structure above

**Validation**:
- Verify bundle belongs to tenant
- Set order_index = max(existing order_index) + 1

**Response**: Created bundle item

---

#### 7. Update Bundle Item
```
PATCH /api/v1/bundles/:bundleId/items/:itemId
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body** (all optional):
- All bundle item fields

**Response**: Updated bundle item

---

#### 8. Delete Bundle Item
```
DELETE /api/v1/bundles/:bundleId/items/:itemId
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Prevent deletion if bundle would have 0 items after
- Return 400 if last item

**Response**: 204 No Content

**Errors**:
- 400: Cannot delete last item in bundle

---

## 🏗️ MODULE 4: QUOTE SETTINGS MANAGEMENT

### Purpose

Each tenant has default settings for quotes (profit %, overhead %, contingency %, terms, payment instructions, expiration days). These are used as defaults when creating quotes, but can be overridden per quote.

### Business Rules

**Settings Storage**:
- Store in tenant table (add new columns) OR create quote_settings table
- One settings record per tenant
- Created automatically on tenant creation with system defaults

**Default Values**:
- Profit: 20%
- Overhead: 10%
- Contingency: 5%
- Expiration days: 30
- Terms: "Payment due upon completion"
- Payment instructions: "Check or cash accepted"

### Endpoints Required

#### 1. Get Quote Settings
```
GET /api/v1/quotes/settings
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Retrieve settings for authenticated tenant
- If no settings exist, return system defaults (don't create yet)

**Response**: Settings object with all fields

---

#### 2. Update Quote Settings
```
PATCH /api/v1/quotes/settings
Auth: JWT required
Roles: Owner, Admin
```

**Request Body** (all optional):
- default_profit_percent (decimal, 0-100)
- default_overhead_percent (decimal, 0-100)
- default_contingency_percent (decimal, 0-100)
- default_terms (text)
- default_payment_instructions (text)
- default_expiration_days (integer, > 0)

**Business Logic**:
- Upsert settings (create if doesn't exist, update if exists)
- Validate percentage ranges
- Validate expiration_days > 0

**Response**: Updated settings object

---

#### 3. Reset Quote Settings to Defaults
```
POST /api/v1/quotes/settings/reset
Auth: JWT required
Roles: Owner, Admin
```

**Business Logic**:
- Reset all settings to system defaults
- Same as initial tenant creation

**Response**: Reset settings object

---

#### 4. Get Approval Thresholds
```
GET /api/v1/quotes/settings/approval-thresholds
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Return configured approval levels and thresholds
- Example: Level 1 at $10k (Manager), Level 2 at $50k (Owner)

**Response**: Array of approval level configurations

---

## 🏗️ MODULE 5: PDF TEMPLATE SYSTEM

### Purpose

Platform admins create PDF templates that tenants use to generate quote PDFs. Templates are HTML/CSS with Handlebars variables. Tenants select which template to use.

### Business Rules

**Admin Template Creation**:
- Only platform admins can create/edit templates
- Templates can be global (all tenants) or tenant-specific
- One template can be marked as platform default
- Templates use Handlebars syntax for variables
- HTML/CSS must be complete and valid

**Tenant Template Selection**:
- Tenants see: Global templates + their custom templates
- Tenants select one active template
- Selection stored in tenant table or quote settings
- Cannot create templates (Phase 1 restriction)

**Template Variables**:
- Complete data structure available to templates
- Documented in variables endpoint
- Includes quote, customer, vendor, items, totals, photos, etc.

### Endpoints Required

#### 1. Create Template (Admin Only)
```
POST /api/v1/admin/quotes/templates
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body**:
- name (required, 1-200 chars)
- description (optional, text)
- html_content (required, long text, complete HTML/CSS)
- tenant_id (optional, for tenant-specific templates)
- is_global (boolean, default false)
- is_default (boolean, default false)
- thumbnail_url (optional, preview image URL)

**Validation**:
- If is_default=true, unset default on other templates
- If tenant_id provided, template is tenant-specific
- If tenant_id NULL and is_global=true, available to all
- Validate HTML is not empty
- Set created_by_user_id from JWT (admin user)

**Business Logic**:
- If tenant-specific: tenant_id set, is_global=false
- If global: tenant_id=NULL, is_global=true
- Only one template can be is_default=true globally

**Response**: Created template object

---

#### 2. List Templates (Admin View)
```
GET /api/v1/admin/quotes/templates
Auth: JWT required
Roles: Platform Admin ONLY
```

**Query Parameters**:
- is_global (optional, boolean)
- tenant_id (optional, filter by tenant)
- is_active (optional, boolean)
- page, limit

**Business Logic**:
- Return all templates (global + all tenant-specific)
- Include usage statistics (how many tenants using each)

**Response**: Paginated template list with stats

---

#### 3. List Available Templates (Tenant View)
```
GET /api/v1/quotes/templates
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Return global templates (tenant_id IS NULL, is_global=true)
- Plus tenant-specific templates (tenant_id = authenticated tenant)
- Filter is_active=true only
- Sort: Default first, then global, then custom

**Response**: Array of available templates

---

#### 4. Get Template by ID (Admin)
```
GET /api/v1/admin/quotes/templates/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Response**: Complete template with full HTML content

---

#### 5. Get Template by ID (Tenant)
```
GET /api/v1/quotes/templates/:id
Auth: JWT required
Roles: All authenticated users
```

**Validation**:
- Template must be global OR belong to authenticated tenant
- 404 if not found or not accessible

**Response**: Complete template with full HTML content

---

#### 6. Update Template (Admin Only)
```
PATCH /api/v1/admin/quotes/templates/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body** (all optional):
- name
- description
- html_content
- is_active
- is_default
- thumbnail_url

**Business Logic**:
- If is_default changes to true, unset default on others
- Validate HTML if provided

**Response**: Updated template object

---

#### 7. Delete Template (Admin Only)
```
DELETE /api/v1/admin/quotes/templates/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Business Logic**:
- Check if any tenant using this as active template
- If in use: Return 400 "Template in use, cannot delete"
- Cannot delete default template
- If safe: Hard delete

**Response**: 204 No Content

**Errors**:
- 400: Template in use or is default

---

#### 8. Clone Template (Admin Only)
```
POST /api/v1/admin/quotes/templates/:id/clone
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body** (optional):
- name (if not provided, use "Copy of {original name}")

**Business Logic**:
- Copy all template data
- New template is NOT default
- New template gets new ID
- Prefix name with "Copy of" if name not provided

**Response**: Cloned template object

---

#### 9. Set Platform Default Template (Admin Only)
```
PATCH /api/v1/admin/quotes/templates/:id/set-default
Auth: JWT required
Roles: Platform Admin ONLY
```

**Business Logic**:
- Unset is_default on all other templates
- Set is_default=true on this template
- Template must be global and active

**Response**: Updated template object

**Errors**:
- 400: Template is not global or not active

---

#### 10. Set Active Template (Tenant)
```
PATCH /api/v1/quotes/settings/template
Auth: JWT required
Roles: Owner, Admin
```

**Request Body**:
- template_id (required, UUID)

**Validation**:
- Template must be global OR belong to this tenant
- Template must be active

**Business Logic**:
- Update tenant.active_quote_template_id
- If NULL provided, unset (use platform default)

**Response**: Success message with selected template

**Errors**:
- 404: Template not found or not accessible
- 400: Template is inactive

---

## 🏗️ MODULE 6: TEMPLATE VARIABLES ENDPOINT

### Purpose

Provide frontend template builder with complete structure of all available variables. This endpoint returns the schema of what data is available to Handlebars templates.

### Endpoint Required

#### Get Template Variables
```
GET /api/v1/admin/quotes/template-variables
Auth: JWT required
Roles: Platform Admin ONLY (template builders)
```

**Business Logic**:
- Return complete JSON structure documenting all available variables
- Include data types, descriptions, examples for each field
- Organized by category: quote, customer, jobsite, vendor, tenant, items, groups, totals, photos, attachments, warranty, draw_schedule

**Response Structure** (example format):
```json
{
  "quote": {
    "id": {
      "type": "string",
      "description": "Quote UUID",
      "example": "quote-123"
    },
    "quote_number": {
      "type": "string",
      "description": "Human-readable quote number",
      "example": "Q-2024-001"
    },
    "title": {
      "type": "string",
      "description": "Quote title",
      "example": "Kitchen Remodel"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "ready", "sent", "read", "approved", "denied", "lost"],
      "example": "sent"
    },
    "created_at": {
      "type": "datetime",
      "format": "ISO 8601",
      "example": "2024-01-15T10:00:00Z"
    },
    "expires_at": {
      "type": "datetime",
      "format": "ISO 8601",
      "example": "2024-02-15T10:00:00Z"
    }
  },
  "customer": {
    "first_name": {
      "type": "string",
      "example": "John"
    },
    "last_name": {
      "type": "string",
      "example": "Doe"
    },
    "email": {
      "type": "string",
      "example": "john@example.com"
    },
    "phone": {
      "type": "string",
      "format": "formatted",
      "example": "(555) 123-4567"
    }
  },
  "items": {
    "_description": "Array of items, iterate with {{#each items}}",
    "_example": [
      {
        "title": "Bathroom Tile Installation",
        "description": "12x12 porcelain tiles",
        "quantity": 100,
        "unit": "sq ft",
        "unit_price": 8.25,
        "total_price": 825.00,
        "group_name": "Bathroom Renovation"
      }
    ]
  },
  "totals": {
    "subtotal": {
      "type": "number",
      "description": "Sum of all item prices",
      "example": 10000.00
    },
    "profit_amount": {
      "type": "number",
      "example": 2000.00
    },
    "total": {
      "type": "number",
      "description": "Final quote total",
      "example": 14250.00
    }
  }
}
```

**Documentation Purpose**:
- Frontend uses this to build variable picker UI
- Shows template creators what data is available
- Provides examples for testing templates
- Documents Handlebars syntax patterns

---

## 📝 API DOCUMENTATION REQUIREMENTS

### What You MUST Document

Create `/api/documentation/quotes_REST_API_DEV2.md` with 100% coverage of:

**For EACH endpoint** (41 total):
1. HTTP method and path
2. Authentication requirements
3. RBAC roles allowed
4. Request body schema (every field, type, validation)
5. Query parameters (every option)
6. Path parameters
7. Success response (status code, complete schema)
8. Error responses (all possible status codes with examples)
9. Business logic summary
10. Example request
11. Example response

**Additional Documentation**:
- Overview of module relationships
- Google Maps integration notes
- File storage integration notes
- Handlebars variable usage examples
- Common error codes
- Pagination format

---

## 🔗 SERVICE INTEGRATION

### Existing Services You MUST Reuse

**Google Maps Validation**:
- Use existing AddressValidationService (from leads module)
- Same validation logic as lead addresses
- Forward geocoding, reverse geocoding
- Store google_place_id

**File Storage**:
- Use existing FilesService
- Upload vendor signatures: category="vendor_signature"
- Generate presigned URLs for signature display
- Handle file uploads via multipart/form-data

**Authentication**:
- Extract tenant_id from JWT payload (req.user.tenant_id)
- Extract user_id from JWT payload (req.user.id)
- Never accept tenant_id from request body
- Use existing JwtAuthGuard

**RBAC**:
- Use existing RolesGuard
- Use @Roles() decorator
- Platform Admin role for template management
- Owner/Admin/Manager for regular operations

**Database**:
- Use PrismaService
- Always filter by tenant_id
- Use transactions for multi-record operations
- Handle Prisma errors properly

---

## ✅ VALIDATION RULES

### DTO Validation

Every DTO must validate:
- Required fields present
- Data types correct
- String lengths within limits
- Number ranges valid
- Email format (if applicable)
- Phone format (if applicable)
- Enum values valid
- Foreign key references exist
- Uniqueness constraints (where applicable)

**Use class-validator decorators**:
- @IsNotEmpty()
- @IsString()
- @IsEmail()
- @IsNumber()
- @Min() / @Max()
- @Length()
- @IsEnum()
- @IsOptional()
- @IsBoolean()
- @ValidateNested() (for nested objects)

### Business Logic Validation

**Vendor**:
- Email unique per tenant
- Address has valid coordinates after Google Maps
- Signature file exists and belongs to tenant
- Only one default vendor per tenant
- Cannot delete if assigned to quotes

**Units**:
- Name unique (globally for global units, per tenant for custom)
- Cannot delete if in use
- Tenants cannot edit global units

**Bundles**:
- Must have at least 1 item
- If discount set, type and value both required
- Percentage discounts: 0-100 range
- All costs >= 0
- Quantity > 0

**Templates**:
- HTML content not empty
- Only one default template globally
- Cannot delete if in use
- Global templates: tenant_id must be NULL
- Tenant templates: tenant_id must be set

---

## 🎯 SUCCESS CRITERIA

You are done when:

- [ ] All 41 endpoints implemented and tested
- [ ] All services have business logic (not just CRUD)
- [ ] All DTOs created with validation
- [ ] All controllers use proper RBAC guards
- [ ] Google Maps integration working (vendor addresses)
- [ ] File storage integration working (signatures)
- [ ] 100% API documentation complete
- [ ] Default global units seeded
- [ ] Template variables endpoint returns complete schema
- [ ] Handoff document written
- [ ] No TypeScript errors
- [ ] Server runs without errors
- [ ] All endpoints testable via Swagger
- [ ] Backend Developer 3 has everything needed to start

---

## 📋 HANDOFF DOCUMENT

Create `/api/documentation/quotes_HANDOFF_DEV2.md` with:

**What You Completed**:
- Endpoints implemented (41 total)
- Services created (5 services)
- DTOs created (count them)
- Integration points confirmed

**Files Created/Modified**:
- List all new files
- List all modified files

**Testing Performed**:
- Vendor CRUD tested
- Google Maps validation tested
- File upload tested
- Unit system tested
- Bundle system tested
- Template system tested

**Integration Notes**:
- How Google Maps service is used
- How File storage service is used
- How tenant_id filtering works

**Developer 3 Readiness**:
- [ ] All endpoints documented
- [ ] All services tested
- [ ] Database queries optimized
- [ ] No blocking issues
- [ ] Ready for quote CRUD development

**Known Issues** (if any):
- Document any limitations or workarounds

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Forgetting tenant_id filtering**: Every query must filter by tenant
2. **Not reusing existing services**: Use Google Maps and File storage services
3. **Accepting tenant_id from request**: Always extract from JWT
4. **Poor error messages**: Return helpful, specific errors
5. **Missing validation**: Validate everything before database
6. **Not documenting endpoints**: 100% coverage required
7. **Hardcoding defaults**: Use configurable settings
8. **Ignoring RBAC**: Protect admin endpoints properly
9. **Not handling file uploads**: Use proper multipart handling
10. **Incomplete DTOs**: Every field needs validation

---

## 🚀 YOU'RE READY

You are building the foundation that quote creation depends on. Without vendors, units, bundles, and templates, no one can create quotes.

**Your work enables**:
- Dev 3: Quote CRUD (needs vendors, units)
- Dev 4: Pricing calculations (needs units, bundles)
- Dev 5: PDF generation (needs templates)
- Frontend: Template builder (needs variables endpoint)

**Take your time. Document thoroughly. Test everything.**

**When complete, notify Backend Reviewer for approval before Backend Developer 3 starts.**

---

**Status**: 📋 **READY FOR IMPLEMENTATION**