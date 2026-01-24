# Backend Developer 1: Database Schema & Core Models

**Module**: Quote Management System  
**Phase**: Database Foundation  
**Timeline**: 1.5 weeks  
**Complexity**: High (Foundation for entire module)  
**Your Role**: Database architect and schema designer

---

## 🎯 YOUR MISSION

You are responsible for designing and implementing the complete database schema for the Quote module. Every other developer depends on your work being correct, complete, and properly indexed.

**You will create**:
- All database tables with proper relationships
- All indexes (especially tenant_id composites)
- All enums and constraints
- Database migrations
- Complete schema documentation

**You will NOT**:
- Write any business logic
- Create controllers or services
- Write API endpoints
- Implement any features

---

## 📋 WHAT YOU MUST DELIVER

### Deliverables Checklist

- [ ] Prisma schema file updated with all quote tables
- [ ] Database migrations created and tested
- [ ] All indexes created (tenant_id composites mandatory)
- [ ] All enums defined
- [ ] All relationships mapped correctly
- [ ] Schema documentation file created
- [ ] ERD diagram generated (use Prisma tools or draw.io)
- [ ] Handoff document for Backend Developer 2

### Files You Will Create/Modify

```
/var/www/lead360.app/api/
├── prisma/
│   ├── schema.prisma (MODIFY - add all quote tables)
│   └── migrations/ (CREATE - new migration files)
└── documentation/
    ├── quotes_SCHEMA.md (CREATE - complete schema documentation)
    ├── quotes_ERD.png (CREATE - entity relationship diagram)
    └── quotes_HANDOFF_DEV1.md (CREATE - handoff to Dev 2)
```

---

## 🗄️ TABLES YOU MUST CREATE

### Table 1: `quote`

**Purpose**: Master quote record containing all quote-level information.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| quote_number | String (50) | NOT NULL, Unique per tenant | Human-readable number |
| title | String (200) | NOT NULL | Quote title |
| status | Enum | NOT NULL, Default 'draft' | Current status |
| lead_id | String (36) | FK, NOT NULL | Associated lead/customer |
| vendor_id | String (36) | FK, NOT NULL | Assigned vendor |
| jobsite_address_id | String (36) | FK, NOT NULL | Where work will be done |
| po_number | String (100) | Nullable | Purchase order number |
| private_notes | Text | Nullable | Internal notes |
| use_default_settings | Boolean | Default true | Use tenant defaults? |
| custom_profit_percent | Decimal (5,2) | Nullable | Override profit % |
| custom_overhead_percent | Decimal (5,2) | Nullable | Override overhead % |
| custom_contingency_percent | Decimal (5,2) | Nullable | Override contingency % |
| custom_terms | Text | Nullable | Override terms |
| custom_payment_instructions | Text | Nullable | Override payment info |
| expiration_days | Integer | Nullable | Days until expiration |
| expires_at | DateTime | Nullable | Calculated expiration |
| active_version_number | Decimal (4,2) | Default 1.0 | Current version |
| active_template_id | String (36) | FK, Nullable | PDF template to use |
| is_archived | Boolean | Default false | Soft delete flag |
| created_by_user_id | String (36) | FK, NOT NULL | Creator |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Enums Needed**:
- `quote_status`: 'draft', 'pending_approval', 'ready', 'sent', 'read', 'approved', 'denied', 'lost'

**Indexes Required** (CRITICAL):
```
@@index([tenant_id, created_at])
@@index([tenant_id, status])
@@index([tenant_id, quote_number])
@@index([tenant_id, lead_id])
@@index([tenant_id, vendor_id])
@@index([tenant_id, expires_at])
@@index([tenant_id, is_archived])
@@index([status])
@@unique([tenant_id, quote_number])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Belongs to: `lead` (via lead_id)
- Belongs to: `vendor` (via vendor_id)
- Belongs to: `quote_jobsite_address` (via jobsite_address_id)
- Belongs to: `quote_template` (via active_template_id, nullable)
- Belongs to: `user` (via created_by_user_id)
- Has many: `quote_version`, `quote_item`, `quote_group`, `quote_attachment`, `quote_approval`, `quote_view_log`, `quote_discount_rule`, `draw_schedule_entry`, `quote_tag_assignment`

---

### Table 2: `quote_version`

**Purpose**: Complete audit trail of all quote changes.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| version_number | Decimal (4,2) | NOT NULL | Version number (1.0, 1.1, 2.0) |
| snapshot_data | JSON | NOT NULL | Complete quote data |
| change_summary | Text | Nullable | What changed |
| changed_by_user_id | String (36) | FK, NOT NULL | Who made change |
| created_at | DateTime | Default now() | When created |

**Indexes Required**:
```
@@index([quote_id, version_number])
@@index([quote_id, created_at])
@@unique([quote_id, version_number])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Belongs to: `user` (via changed_by_user_id)

**Important**: This table does NOT have tenant_id because it inherits isolation through the parent quote.

---

### Table 3: `quote_item`

**Purpose**: Individual line items in quotes with detailed cost breakdown.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| quote_group_id | String (36) | FK, Nullable | Group assignment |
| item_library_id | String (36) | FK, Nullable | Source from library |
| title | String (200) | NOT NULL | Item title |
| description | Text | Nullable | Item description |
| quantity | Decimal (10,2) | NOT NULL | Quantity |
| unit_measurement_id | String (36) | FK, NOT NULL | Unit type |
| order_index | Integer | NOT NULL | Sort order |
| material_cost_per_unit | Decimal (10,2) | Default 0 | Material cost |
| labor_cost_per_unit | Decimal (10,2) | Default 0 | Labor cost |
| equipment_cost_per_unit | Decimal (10,2) | Default 0 | Equipment cost |
| subcontract_cost_per_unit | Decimal (10,2) | Default 0 | Subcontract cost |
| other_cost_per_unit | Decimal (10,2) | Default 0 | Other costs |
| custom_markup_percent | Decimal (5,2) | Nullable | Override markup |
| custom_discount_amount | Decimal (10,2) | Nullable | Override discount |
| custom_tax_rate | Decimal (5,2) | Nullable | Override tax |
| private_notes | Text | Nullable | Internal notes |
| save_to_library | Boolean | Default false | Create library entry? |
| warranty_tier_id | String (36) | FK, Nullable | Warranty option |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([quote_id, order_index])
@@index([quote_id, quote_group_id])
@@index([item_library_id])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Belongs to: `quote_group` (via quote_group_id, nullable)
- Belongs to: `unit_measurement` (via unit_measurement_id)
- Belongs to: `item_library` (via item_library_id, nullable)
- Belongs to: `quote_warranty_tier` (via warranty_tier_id, nullable)

**Important**: No tenant_id needed - inherits through parent quote.

---

### Table 4: `quote_group`

**Purpose**: Organize items into logical sections with subtotals.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| name | String (200) | NOT NULL | Group name |
| description | Text | Nullable | Group description |
| order_index | Integer | NOT NULL | Sort order |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([quote_id, order_index])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Has many: `quote_item` (items in this group)

---

### Table 5: `quote_jobsite_address`

**Purpose**: Address where work will be performed (separate from customer address).

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| address_line1 | String (255) | NOT NULL | Street address |
| address_line2 | String (255) | Nullable | Apt/Suite |
| city | String (100) | NOT NULL | City name |
| state | String (2) | NOT NULL | State code |
| zip_code | String (10) | NOT NULL | ZIP code |
| latitude | Decimal (10,8) | NOT NULL | Coordinates |
| longitude | Decimal (11,8) | NOT NULL | Coordinates |
| google_place_id | String (255) | Nullable | Google Maps ID |
| created_at | DateTime | Default now() | Creation timestamp |

**Indexes Required**:
```
@@index([quote_id])
@@index([latitude, longitude])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)

**Important**: This is a SEPARATE address from the lead's address. Work location can differ from customer billing/contact address.

---

### Table 6: `item_library`

**Purpose**: Reusable catalog of common items for quick quote building.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| title | String (200) | NOT NULL | Item title |
| description | Text | Nullable | Default description |
| default_quantity | Decimal (10,2) | Default 1 | Default qty |
| unit_measurement_id | String (36) | FK, NOT NULL | Default unit |
| material_cost_per_unit | Decimal (10,2) | Default 0 | Material cost |
| labor_cost_per_unit | Decimal (10,2) | Default 0 | Labor cost |
| equipment_cost_per_unit | Decimal (10,2) | Default 0 | Equipment cost |
| subcontract_cost_per_unit | Decimal (10,2) | Default 0 | Subcontract cost |
| other_cost_per_unit | Decimal (10,2) | Default 0 | Other costs |
| usage_count | Integer | Default 0 | Times used |
| last_used_at | DateTime | Nullable | Last usage |
| is_active | Boolean | Default true | Active flag |
| created_by_user_id | String (36) | FK, NOT NULL | Creator |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([tenant_id, is_active])
@@index([tenant_id, title])
@@index([tenant_id, last_used_at])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Belongs to: `unit_measurement` (via unit_measurement_id)
- Belongs to: `user` (via created_by_user_id)
- Referenced by: `quote_item` (soft reference)

---

### Table 7: `quote_template`

**Purpose**: Reusable PDF templates with HTML/CSS for quote generation.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, Nullable, Indexed | Owner (NULL = global) |
| name | String (200) | NOT NULL | Template name |
| description | Text | Nullable | Template description |
| html_content | LongText | NOT NULL | Full HTML/CSS |
| thumbnail_url | String (500) | Nullable | Preview image |
| is_global | Boolean | Default false | Available to all? |
| is_active | Boolean | Default true | Active flag |
| is_default | Boolean | Default false | Platform default? |
| created_by_user_id | String (36) | FK, NOT NULL | Creator (admin) |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([tenant_id])
@@index([is_global, is_active])
@@index([is_default])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id, nullable for global)
- Belongs to: `user` (via created_by_user_id)
- Used by: `quote` (via active_template_id)

**Important**: When tenant_id is NULL, template is global (available to all tenants).

---

### Table 8: `vendor`

**Purpose**: Company representatives assigned to quotes as the vendor/estimator.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| name | String (200) | NOT NULL | Vendor name |
| email | String (255) | NOT NULL | Email address |
| phone | String (20) | NOT NULL | Phone number |
| address_line1 | String (255) | NOT NULL | Street address |
| address_line2 | String (255) | Nullable | Apt/Suite |
| city | String (100) | NOT NULL | City |
| state | String (2) | NOT NULL | State code |
| zip_code | String (10) | NOT NULL | ZIP code |
| latitude | Decimal (10,8) | NOT NULL | Coordinates |
| longitude | Decimal (11,8) | NOT NULL | Coordinates |
| google_place_id | String (255) | Nullable | Google Maps ID |
| signature_file_id | String (36) | FK, NOT NULL | Signature image |
| is_active | Boolean | Default true | Active flag |
| is_default | Boolean | Default false | Default vendor? |
| created_by_user_id | String (36) | FK, NOT NULL | Creator |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([tenant_id, is_active])
@@index([tenant_id, is_default])
@@unique([tenant_id, email])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Belongs to: `file` (via signature_file_id - from existing file storage module)
- Belongs to: `user` (via created_by_user_id)
- Has many: `quote` (quotes assigned to this vendor)

**Important**: Vendor address is stored directly in this table (not in separate address table). One vendor = one address.

---

### Table 9: `unit_measurement`

**Purpose**: Standardized units for pricing (sq ft, hour, each, etc.)

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, Nullable, Indexed | Owner (NULL = global) |
| name | String (100) | NOT NULL | Full name |
| abbreviation | String (20) | NOT NULL | Short form |
| is_global | Boolean | Default false | Admin-created? |
| is_active | Boolean | Default true | Active flag |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([tenant_id, is_active])
@@index([is_global, is_active])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id, nullable for global)
- Used by: `quote_item`, `item_library`, `quote_bundle_item`

**Important**: When tenant_id is NULL, unit is global (created by admin, available to all).

---

### Table 10: `quote_bundle`

**Purpose**: Pre-configured packages of items for quick quote building.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| name | String (200) | NOT NULL | Bundle name |
| description | Text | Nullable | Bundle description |
| discount_type | Enum | Nullable | 'percentage' or 'fixed' |
| discount_value | Decimal (10,2) | Nullable | Discount amount |
| is_active | Boolean | Default true | Active flag |
| created_by_user_id | String (36) | FK, NOT NULL | Creator |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Enums Needed**:
- `discount_type`: 'percentage', 'fixed'

**Indexes Required**:
```
@@index([tenant_id, is_active])
@@index([tenant_id, name])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Belongs to: `user` (via created_by_user_id)
- Has many: `quote_bundle_item` (items in bundle)

---

### Table 11: `quote_bundle_item`

**Purpose**: Items included in a bundle definition.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_bundle_id | String (36) | FK, NOT NULL, Indexed | Parent bundle |
| item_library_id | String (36) | FK, Nullable | Source item |
| title | String (200) | NOT NULL | Item title |
| description | Text | Nullable | Item description |
| quantity | Decimal (10,2) | NOT NULL | Quantity |
| unit_measurement_id | String (36) | FK, NOT NULL | Unit type |
| material_cost_per_unit | Decimal (10,2) | Default 0 | Material cost |
| labor_cost_per_unit | Decimal (10,2) | Default 0 | Labor cost |
| equipment_cost_per_unit | Decimal (10,2) | Default 0 | Equipment cost |
| subcontract_cost_per_unit | Decimal (10,2) | Default 0 | Subcontract cost |
| other_cost_per_unit | Decimal (10,2) | Default 0 | Other costs |
| order_index | Integer | NOT NULL | Sort order |
| created_at | DateTime | Default now() | Creation timestamp |

**Indexes Required**:
```
@@index([quote_bundle_id, order_index])
```

**Relationships**:
- Belongs to: `quote_bundle` (via quote_bundle_id)
- Belongs to: `unit_measurement` (via unit_measurement_id)
- Belongs to: `item_library` (via item_library_id, nullable)

---

### Table 12: `quote_approval`

**Purpose**: Track approval workflow for quotes requiring manager/owner approval.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| approval_level | Integer | NOT NULL | Level (1, 2, 3...) |
| approver_user_id | String (36) | FK, NOT NULL | Who must approve |
| status | Enum | Default 'pending' | Approval status |
| comments | Text | Nullable | Approval notes |
| decided_at | DateTime | Nullable | When decided |
| created_at | DateTime | Default now() | Creation timestamp |

**Enums Needed**:
- `approval_status`: 'pending', 'approved', 'rejected'

**Indexes Required**:
```
@@index([quote_id, approval_level])
@@index([approver_user_id, status])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Belongs to: `user` (via approver_user_id)

---

### Table 13: `quote_discount_rule`

**Purpose**: Quote-level discounts (early payment, volume, seasonal, etc.)

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| rule_type | Enum | NOT NULL | 'percentage' or 'fixed' |
| value | Decimal (10,2) | NOT NULL | Discount value |
| reason | String (255) | NOT NULL | Discount reason |
| apply_to | Enum | Default 'subtotal' | Where to apply |
| order_index | Integer | NOT NULL | Application order |
| created_at | DateTime | Default now() | Creation timestamp |

**Enums Needed**:
- `discount_rule_type`: 'percentage', 'fixed'
- `discount_apply_to`: 'subtotal', 'total'

**Indexes Required**:
```
@@index([quote_id, order_index])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)

---

### Table 14: `quote_tag`

**Purpose**: Custom tags for organizing and categorizing quotes.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| name | String (100) | NOT NULL | Tag name |
| color | String (7) | NOT NULL | Hex color code |
| is_active | Boolean | Default true | Active flag |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Indexes Required**:
```
@@index([tenant_id, is_active])
@@unique([tenant_id, name])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Many-to-many with: `quote` (via quote_tag_assignment)

---

### Table 15: `quote_tag_assignment`

**Purpose**: Junction table for quote-to-tag many-to-many relationship.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| quote_tag_id | String (36) | FK, NOT NULL, Indexed | Assigned tag |
| created_at | DateTime | Default now() | Assignment timestamp |

**Indexes Required**:
```
@@index([quote_id])
@@index([quote_tag_id])
@@unique([quote_id, quote_tag_id])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Belongs to: `quote_tag` (via quote_tag_id)

---

### Table 16: `quote_attachment`

**Purpose**: Photos and URL attachments for quotes (ALL images stored via file storage module).

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| attachment_type | Enum | NOT NULL | Type of attachment |
| file_id | String (36) | FK, Nullable | Image file reference |
| url | String (500) | Nullable | URL attachment |
| title | String (200) | Nullable | URL title |
| qr_code_file_id | String (36) | FK, Nullable | Generated QR code |
| grid_layout | Enum | Nullable | Grid layout option |
| order_index | Integer | NOT NULL | Sort order |
| created_at | DateTime | Default now() | Creation timestamp |

**Enums Needed**:
- `attachment_type`: 'cover_photo', 'full_page_photo', 'grid_photo', 'url_attachment'
- `grid_layout`: 'grid_2', 'grid_4', 'grid_6'

**Indexes Required**:
```
@@index([quote_id, attachment_type, order_index])
@@index([file_id])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)
- Belongs to: `file` (via file_id - from existing file storage module)
- Belongs to: `file` (via qr_code_file_id - auto-generated QR code)

**CRITICAL IMAGE STORAGE RULES**:
1. Cover photo goes in the cover of the quote (when template supports it)
2. ALL images MUST be stored using the existing file storage module
3. file_id references the `file` table (already exists in system)
4. Images are attached to specific areas based on attachment_type
5. QR codes for URLs are also stored as files (qr_code_file_id)

---

### Table 17: `quote_view_log`

**Purpose**: Track customer views of public quote URLs for analytics.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| public_token | String (32) | NOT NULL | URL token used |
| viewed_at | DateTime | Default now() | View timestamp |
| ip_address | String (45) | Nullable | Viewer IP (anonymize after 90 days) |
| view_duration_seconds | Integer | Nullable | Time on page |
| device_type | Enum | Nullable | Device category |
| referrer_url | String (500) | Nullable | Where they came from |

**Enums Needed**:
- `device_type`: 'desktop', 'mobile', 'tablet', 'unknown'

**Indexes Required**:
```
@@index([quote_id, viewed_at])
@@index([public_token])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)

---

### Table 18: `quote_warranty_tier`

**Purpose**: Optional warranty tiers that can be added per item.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| tenant_id | String (36) | FK, NOT NULL, Indexed | Owner tenant |
| tier_name | String (100) | NOT NULL | Warranty name |
| description | Text | Nullable | Warranty details |
| price_type | Enum | NOT NULL | 'fixed' or 'percentage' |
| price_value | Decimal (10,2) | NOT NULL | Price amount |
| duration_months | Integer | NOT NULL | Warranty duration |
| is_active | Boolean | Default true | Active flag |
| created_at | DateTime | Default now() | Creation timestamp |
| updated_at | DateTime | Auto-update | Last modification |

**Enums Needed**:
- `warranty_price_type`: 'fixed', 'percentage'

**Indexes Required**:
```
@@index([tenant_id, is_active])
```

**Relationships**:
- Belongs to: `tenant` (via tenant_id)
- Referenced by: `quote_item` (via warranty_tier_id)

---

### Table 19: `draw_schedule_entry`

**Purpose**: Payment schedule breakdown showing when payments are due.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| draw_number | Integer | NOT NULL | Sequential number |
| description | String (255) | NOT NULL | What this covers |
| calculation_type | Enum | NOT NULL | 'percentage' or 'fixed' |
| value | Decimal (10,2) | NOT NULL | % or $ amount |
| order_index | Integer | NOT NULL | Sort order |
| created_at | DateTime | Default now() | Creation timestamp |

**Enums Needed**:
- `draw_calculation_type`: 'percentage', 'fixed'

**Indexes Required**:
```
@@index([quote_id, order_index])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)

**Important**: All entries for a quote must use same calculation_type. Cannot mix percentage and fixed.

---

### Table 20: `quote_public_access`

**Purpose**: Manage public URL access tokens and passwords for quote sharing.

**Columns Required**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | String (36) | PK, UUID | Unique identifier |
| quote_id | String (36) | FK, NOT NULL, Indexed | Parent quote |
| access_token | String (32) | NOT NULL, Unique | URL token |
| password_hash | String (255) | Nullable | Bcrypt hash |
| password_hint | String (255) | Nullable | Password hint |
| is_active | Boolean | Default true | Token active? |
| created_at | DateTime | Default now() | Creation timestamp |
| expires_at | DateTime | Nullable | Token expiration |

**Indexes Required**:
```
@@index([quote_id])
@@unique([access_token])
```

**Relationships**:
- Belongs to: `quote` (via quote_id)

**Important**: One active token per quote. Creating new token deactivates old one.

---

## 🔗 RELATIONSHIPS WITH EXISTING TABLES

### Tables You Will Reference (Already Exist)

**From `tenant` table**:
- quote.tenant_id → tenant.id
- item_library.tenant_id → tenant.id
- vendor.tenant_id → tenant.id
- quote_template.tenant_id → tenant.id (nullable)
- unit_measurement.tenant_id → tenant.id (nullable)
- quote_bundle.tenant_id → tenant.id
- quote_tag.tenant_id → tenant.id
- quote_warranty_tier.tenant_id → tenant.id

**From `user` table**:
- quote.created_by_user_id → user.id
- quote_version.changed_by_user_id → user.id
- quote_approval.approver_user_id → user.id
- item_library.created_by_user_id → user.id
- quote_template.created_by_user_id → user.id
- vendor.created_by_user_id → user.id
- quote_bundle.created_by_user_id → user.id

**From `lead` table**:
- quote.lead_id → lead.id

**From `file` table (file storage module)**:
- vendor.signature_file_id → file.file_id
- quote_attachment.file_id → file.file_id
- quote_attachment.qr_code_file_id → file.file_id

### Update Required: `tenant` Table

Add this column to existing `tenant` table:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| active_quote_template_id | String (36) | FK, Nullable | Selected template |

Add relationship:
- tenant.active_quote_template_id → quote_template.id

---

## 📐 ENUMS SUMMARY

All enums you must define:

```
enum quote_status {
  draft
  pending_approval
  ready
  sent
  read
  approved
  denied
  lost
}

enum discount_type {
  percentage
  fixed
}

enum approval_status {
  pending
  approved
  rejected
}

enum discount_rule_type {
  percentage
  fixed
}

enum discount_apply_to {
  subtotal
  total
}

enum attachment_type {
  cover_photo
  full_page_photo
  grid_photo
  url_attachment
}

enum grid_layout {
  grid_2
  grid_4
  grid_6
}

enum device_type {
  desktop
  mobile
  tablet
  unknown
}

enum warranty_price_type {
  fixed
  percentage
}

enum draw_calculation_type {
  percentage
  fixed
}
```

---

## ✅ VALIDATION RULES TO ENFORCE AT SCHEMA LEVEL

### Constraints You Must Add

**Check Constraints** (if your database supports them):
- quantity > 0 on quote_item, item_library, quote_bundle_item
- All cost fields >= 0
- Percentages: 0-100 range
- order_index >= 0
- approval_level > 0
- draw_number > 0

**Default Values**:
- Boolean fields: Default false or true as specified
- Timestamps: created_at = now(), updated_at = auto-update
- Status fields: Default to initial state
- Cost fields: Default 0

**Uniqueness Constraints**:
- [tenant_id, quote_number] on quote
- [tenant_id, email] on vendor
- [tenant_id, name] on quote_tag
- [quote_id, version_number] on quote_version
- [quote_id, quote_tag_id] on quote_tag_assignment
- access_token on quote_public_access

---

## 📊 INDEX STRATEGY

### CRITICAL: Multi-Tenant Isolation Indexes

Every table with tenant_id MUST have these indexes:
```
@@index([tenant_id, created_at])
@@index([tenant_id, {frequently_queried_column}])
```

### Performance Indexes

**For Sorting**:
- order_index on tables with drag & drop
- created_at on all main tables
- version_number on quote_version

**For Filtering**:
- status on quote
- is_active on all tables with this flag
- is_global on quote_template, unit_measurement

**For Searching**:
- quote_number on quote
- title on item_library
- name on vendor, quote_bundle, quote_tag

**For Foreign Keys**:
- All foreign key columns must be indexed

---

## 📝 DOCUMENTATION YOU MUST CREATE

### 1. Schema Documentation File

**Location**: `/api/documentation/quotes_SCHEMA.md`

**Must include**:
- Complete table list with purposes
- All columns with data types and constraints
- All relationships mapped
- All enums defined
- Index strategy explained
- Business rules enforced at schema level

### 2. Entity Relationship Diagram

**Location**: `/api/documentation/quotes_ERD.png`

**Must show**:
- All 20 tables
- All relationships (one-to-many, many-to-many)
- Foreign keys clearly marked
- Cardinality indicated (1:1, 1:N, N:M)

**Tools you can use**:
- Prisma ERD generator
- draw.io
- dbdiagram.io
- Any tool that produces clear diagram

### 3. Handoff Document

**Location**: `/api/documentation/quotes_HANDOFF_DEV1.md`

**Must include**:
- What you completed (checklist)
- Files you created/modified
- Migration status (applied successfully?)
- Any issues encountered
- Any deviations from spec (with justification)
- Confirmation that Dev 2 can start
- Database connection tested
- All tables queryable

---

## 🚨 CRITICAL REQUIREMENTS

### Multi-Tenant Isolation (ABSOLUTE)

Every business-owned table MUST:
1. Have tenant_id column (or inherit through parent)
2. Have composite index: [tenant_id, {other_column}]
3. Never allow queries without tenant_id filtering

**Tables requiring tenant_id directly**:
- quote (YES - root table)
- item_library (YES - tenant-owned)
- vendor (YES - tenant-owned)
- unit_measurement (nullable - global or tenant)
- quote_template (nullable - global or tenant)
- quote_bundle (YES - tenant-owned)
- quote_tag (YES - tenant-owned)
- quote_warranty_tier (YES - tenant-owned)

**Tables inheriting tenant_id through parent**:
- quote_version (via quote)
- quote_item (via quote)
- quote_group (via quote)
- quote_jobsite_address (via quote)
- quote_attachment (via quote)
- quote_approval (via quote)
- quote_view_log (via quote)
- quote_discount_rule (via quote)
- draw_schedule_entry (via quote)
- quote_tag_assignment (via quote)
- quote_public_access (via quote)
- quote_bundle_item (via quote_bundle)

### UUID Generation

All primary keys must be UUIDs:
- Use proper UUID type or String(36)
- Generate with secure random algorithm
- No auto-increment integers for tenant data

### Cascading Deletes

Set appropriate ON DELETE behavior:
- CASCADE: When parent deleted, children must delete
- SET NULL: When referenced item deleted, set FK to null
- RESTRICT: Prevent deletion if references exist

**Examples**:
- Delete quote → CASCADE to all quote children
- Delete vendor → RESTRICT if quotes exist
- Delete item_library → SET NULL on quote_items

### Timestamp Management

All tables with created_at/updated_at must:
- created_at: Default to current timestamp, never update
- updated_at: Auto-update on every modification

---

## 🔍 TESTING YOUR SCHEMA

### Required Tests

Before marking complete, you must verify:

1. **Migration Success**:
   - Run `prisma migrate dev`
   - No errors
   - All tables created
   - All indexes created

2. **Relationship Integrity**:
   - Insert test quote with items
   - Query quote with all relationships
   - Verify cascading deletes work

3. **Constraint Enforcement**:
   - Try inserting duplicate quote_number for same tenant (should fail)
   - Try inserting negative quantity (should fail)
   - Try inserting quote without tenant_id (should fail)

4. **Multi-Tenant Isolation**:
   - Create quote for tenant A
   - Verify tenant B cannot see it
   - Verify tenant_id indexes exist

5. **Enum Validation**:
   - Try inserting invalid status (should fail)
   - Verify all enum values work

---

## 🎯 SUCCESS CRITERIA

You are done when:

- [ ] All 20 tables created in Prisma schema
- [ ] All enums defined (9 enums)
- [ ] All indexes created (50+ indexes)
- [ ] All relationships mapped correctly
- [ ] Migration runs successfully
- [ ] Schema documentation complete
- [ ] ERD diagram generated and clear
- [ ] Handoff document written
- [ ] Test queries run successfully
- [ ] No errors in Prisma client generation
- [ ] Backend Developer 2 has everything needed to start

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Forgetting tenant_id indexes**: Every tenant_id column needs composite indexes
2. **Wrong ON DELETE cascade settings**: Review each relationship carefully
3. **Missing enums**: Define all enums before using them
4. **Incorrect data types**: Decimal for money (not Float), String for UUIDs
5. **No unique constraints**: Add unique constraints where needed
6. **Forgetting nullable vs required**: Check contract for each column
7. **Missing relationships**: Every FK must have relationship defined
8. **Poor index choices**: Index frequently queried and filtered columns

---

## 📞 NEED CLARIFICATION?

If anything is unclear in this specification:

1. Re-read the Feature Contract (source of truth)
2. Check existing tables for patterns (auth, leads, files)
3. Ask Backend Reviewer before making assumptions
4. Document your decision in handoff if you deviate

**Do NOT**:
- Make up business rules
- Skip indexes to "save time"
- Ignore multi-tenant requirements
- Create tables not in spec

---

## 🚀 YOU'RE READY

You have everything you need to build the database foundation for the Quote module. Your work is critical - every other developer depends on you getting this right.

**Take your time. Be thorough. Double-check everything.**

**When complete, create your handoff document and notify the Backend Reviewer for approval before Backend Developer 2 starts.**

---

**Status**: 📋 **READY FOR IMPLEMENTATION**