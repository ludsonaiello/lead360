# Quote Module - Database Schema Documentation

**Module**: Quote Management System
**Created**: January 2026
**Status**: ✅ Implemented
**Database**: MySQL/MariaDB (via Prisma ORM)
**Version**: 1.0

---

## Overview

The Quote module database schema consists of **20 tables** and **9 enums** that support the complete quote lifecycle:
- Quote creation and versioning
- Item-based pricing with detailed cost breakdown
- Approval workflows
- Public URL sharing with analytics
- PDF template management
- Bundle/package system
- Warranty options
- Payment schedules

**Total Tables**: 20
**Total Enums**: 9
**Total Indexes**: 50+
**Multi-Tenant**: Yes (strict isolation enforced)

---

## Tables Summary

| # | Table Name | Purpose | Tenant Scoped |
|---|------------|---------|---------------|
| 1 | `unit_measurement` | Standardized units for pricing (sq ft, hour, each) | Partial (nullable) |
| 2 | `quote_template` | PDF templates with HTML/CSS | Partial (nullable) |
| 3 | `vendor` | Company representatives assigned to quotes | Yes |
| 4 | `quote_tag` | Custom tags for organizing quotes | Yes |
| 5 | `quote_warranty_tier` | Optional warranties per item | Yes |
| 6 | `quote_jobsite_address` | Work location addresses | No (via quote) |
| 7 | `quote` | Master quote record | Yes |
| 8 | `quote_version` | Complete audit trail of changes | No (via quote) |
| 9 | `quote_group` | Organize items into sections | No (via quote) |
| 10 | `quote_item` | Line items with cost breakdown | No (via quote) |
| 11 | `quote_approval` | Approval workflow tracking | No (via quote) |
| 12 | `quote_discount_rule` | Quote-level discounts | No (via quote) |
| 13 | `quote_tag_assignment` | Many-to-many quote-tag junction | No (via quote) |
| 14 | `quote_attachment` | Photos and URLs with QR codes | No (via quote) |
| 15 | `quote_view_log` | Public URL view analytics | No (via quote) |
| 16 | `draw_schedule_entry` | Payment schedule | No (via quote) |
| 17 | `quote_public_access` | Public URL tokens and passwords | No (via quote) |
| 18 | `item_library` | Reusable catalog items | Yes |
| 19 | `quote_bundle` | Pre-configured packages | Yes |
| 20 | `quote_bundle_item` | Items in bundles | No (via bundle) |

---

## Enums

### 1. quote_status
**Usage**: quote.status
**Values**: draft, pending_approval, ready, sent, read, approved, denied, lost

### 2. attachment_type
**Usage**: quote_attachment.attachment_type
**Values**: cover_photo, full_page_photo, grid_photo, url_attachment

### 3. grid_layout
**Usage**: quote_attachment.grid_layout
**Values**: grid_2, grid_4, grid_6

### 4. approval_status
**Usage**: quote_approval.status
**Values**: pending, approved, rejected

### 5. discount_rule_type
**Usage**: quote_discount_rule.rule_type, quote_bundle.discount_type
**Values**: percentage, fixed_amount

### 6. discount_apply_to
**Usage**: quote_discount_rule.apply_to
**Values**: subtotal, total

### 7. warranty_price_type
**Usage**: quote_warranty_tier.price_type
**Values**: fixed, percentage

### 8. draw_calculation_type
**Usage**: draw_schedule_entry.calculation_type
**Values**: percentage, fixed_amount

### 9. device_type
**Usage**: quote_view_log.device_type
**Values**: desktop, mobile, tablet, unknown

---

## Detailed Table Specifications

### 1. unit_measurement

**Purpose**: Standardized units for pricing (square feet, hours, each, etc.)

**Columns**:
- `id` (VARCHAR(36), PK): UUID identifier
- `tenant_id` (VARCHAR(36), nullable): Owner tenant (NULL = global)
- `name` (VARCHAR(100)): Full name (e.g., "Square Foot")
- `abbreviation` (VARCHAR(20)): Short form (e.g., "sq ft")
- `is_global` (BOOLEAN, default false): Admin-created global unit
- `is_active` (BOOLEAN, default true): Active status
- `created_at` (DATETIME): Creation timestamp
- `updated_at` (DATETIME): Last modification

**Indexes**:
- `@@index([tenant_id, is_active])`
- `@@index([is_global, is_active])`

**Relationships**:
- Belongs to: `tenant` (nullable)
- Used by: `quote_item`, `item_library`, `quote_bundle_item`

**Business Rules**:
- When `tenant_id` is NULL, unit is global (available to all tenants)
- Tenants can create custom units (tenant_id set)
- Cannot delete if used in any quotes/items

---

### 2. quote_template

**Purpose**: PDF templates with HTML/CSS for quote generation

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), nullable): Owner tenant (NULL = global)
- `name` (VARCHAR(200)): Template name
- `description` (TEXT, nullable)
- `html_content` (LONGTEXT): Complete HTML/CSS code
- `thumbnail_url` (VARCHAR(500), nullable): Preview image
- `is_global` (BOOLEAN, default false): Available to all tenants
- `is_active` (BOOLEAN, default true)
- `is_default` (BOOLEAN, default false): Platform default
- `created_by_user_id` (VARCHAR(36), nullable): Creator (admin)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([tenant_id])`
- `@@index([is_global, is_active])`
- `@@index([is_default])`

**Relationships**:
- Belongs to: `tenant` (nullable), `user` (creator)
- Used by: `quote` (active_template_id), `tenant` (active_quote_template_id)

**Business Rules**:
- Admin-only creation
- Global templates (tenant_id = NULL) available to all
- One default template per platform

---

### 3. vendor

**Purpose**: Company representatives assigned to quotes as vendor/estimator

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `name` (VARCHAR(200))
- `email` (VARCHAR(255))
- `phone` (VARCHAR(20))
- `address_line1` (VARCHAR(255))
- `address_line2` (VARCHAR(255), nullable)
- `city` (VARCHAR(100))
- `state` (VARCHAR(2))
- `zip_code` (VARCHAR(10))
- `latitude` (DECIMAL(10,8)): Coordinates
- `longitude` (DECIMAL(11,8)): Coordinates
- `google_place_id` (VARCHAR(255), nullable)
- `signature_file_id` (VARCHAR(36)): Signature image reference
- `is_active` (BOOLEAN, default true)
- `is_default` (BOOLEAN, default false): Default vendor for tenant
- `created_by_user_id` (VARCHAR(36), nullable)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@unique([tenant_id, email])`: One email per tenant
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, is_default])`

**Relationships**:
- Belongs to: `tenant`, `file` (signature), `user` (creator)
- Has many: `quote`

**Business Rules**:
- Signature image required before quote can be sent
- Address stored directly (not in separate address table)
- One default vendor per tenant

---

### 4. quote_tag

**Purpose**: Custom tags for organizing and categorizing quotes

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `name` (VARCHAR(100))
- `color` (VARCHAR(7)): Hex color code (#FF5733)
- `is_active` (BOOLEAN, default true)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@unique([tenant_id, name])`: Case-insensitive unique
- `@@index([tenant_id, is_active])`

**Relationships**:
- Belongs to: `tenant`
- Many-to-many with: `quote` (via `quote_tag_assignment`)

---

### 5. quote_warranty_tier

**Purpose**: Optional warranty tiers that can be added per item

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `tier_name` (VARCHAR(100)): e.g., "1-Year Standard", "5-Year Premium"
- `description` (TEXT, nullable)
- `price_type` (ENUM: warranty_price_type): fixed or percentage
- `price_value` (DECIMAL(10,2)): Price amount
- `duration_months` (INT): Warranty duration
- `is_active` (BOOLEAN, default true)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([tenant_id, is_active])`

**Relationships**:
- Belongs to: `tenant`
- Referenced by: `quote_item`

---

### 6. quote_jobsite_address

**Purpose**: Address where work will be performed (separate from customer address)

**Columns**:
- `id` (VARCHAR(36), PK)
- `address_line1` (VARCHAR(255))
- `address_line2` (VARCHAR(255), nullable)
- `city` (VARCHAR(100))
- `state` (VARCHAR(2))
- `zip_code` (VARCHAR(10))
- `latitude` (DECIMAL(10,8))
- `longitude` (DECIMAL(11,8))
- `google_place_id` (VARCHAR(255), nullable)
- `created_at` (DATETIME)

**Indexes**:
- `@@index([latitude, longitude])`

**Relationships**:
- Has many: `quote`

**Business Rules**:
- Work location can differ from customer billing/contact address
- No tenant_id (isolated via parent quote relationship)

---

### 7. quote (Main Entity)

**Purpose**: Master quote record containing all quote-level information

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `quote_number` (VARCHAR(50)): Human-readable number
- `title` (VARCHAR(200))
- `status` (ENUM: quote_status, default draft)
- `lead_id` (VARCHAR(36), nullable): Associated customer/lead
- `vendor_id` (VARCHAR(36), nullable): Assigned vendor
- `jobsite_address_id` (VARCHAR(36)): Where work will be done
- `po_number` (VARCHAR(100), nullable): Purchase order number
- `private_notes` (TEXT, nullable): Internal notes
- `use_default_settings` (BOOLEAN, default true): Use tenant defaults
- `custom_profit_percent` (DECIMAL(5,2), nullable): Override profit %
- `custom_overhead_percent` (DECIMAL(5,2), nullable): Override overhead %
- `custom_contingency_percent` (DECIMAL(5,2), nullable): Override contingency %
- `custom_terms` (TEXT, nullable): Override terms
- `custom_payment_instructions` (TEXT, nullable): Override payment info
- `expiration_days` (INT, nullable): Days until expiration
- `expires_at` (DATETIME, nullable): Calculated expiration
- `active_version_number` (DECIMAL(4,2), default 1.0): Current version
- `subtotal` (DECIMAL(12,2), default 0): **Subtotal before discounts** (item costs + profit + overhead + contingency markups). Auto-calculated by QuotePricingService.
- `tax_amount` (DECIMAL(12,2), default 0): **Tax amount** calculated as (subtotal after discounts × tax rate). Auto-calculated by QuotePricingService.
- `discount_amount` (DECIMAL(12,2), default 0): **Total discount amount** from all quote_discount_rule entries. Auto-calculated by QuotePricingService.
- `total` (DECIMAL(12,2), default 0): **Final total** calculated as (subtotal - discount_amount + tax_amount). Auto-calculated by QuotePricingService.
- `active_template_id` (VARCHAR(36), nullable): PDF template to use
- `is_archived` (BOOLEAN, default false): Soft delete flag
- `created_by_user_id` (VARCHAR(36), nullable): Creator
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@unique([tenant_id, quote_number])`
- `@@index([tenant_id, status])`
- `@@index([tenant_id, vendor_id])`
- `@@index([tenant_id, created_at(sort: Desc)])`
- `@@index([tenant_id, lead_id])`
- `@@index([tenant_id, expires_at])`
- `@@index([tenant_id, is_archived])`
- `@@index([status])`

**Relationships**:
- Belongs to: `tenant`, `lead`, `vendor`, `quote_jobsite_address`, `quote_template`, `user`
- Has many: `quote_version`, `quote_item`, `quote_group`, `quote_approval`, `quote_discount_rule`, `quote_tag_assignment`, `quote_attachment`, `quote_view_log`, `draw_schedule_entry`, `quote_public_access`

**Financial Calculations** (Auto-calculated by QuotePricingService):

The financial fields (`subtotal`, `tax_amount`, `discount_amount`, `total`) are automatically calculated whenever quote items or discount rules are modified. The calculation follows this order:

1. **Item Subtotal** = SUM(all quote_item.total_cost)
2. **Apply Markups** (compounding):
   - Profit Amount = Item Subtotal × Profit %
   - Overhead Amount = (Item Subtotal + Profit) × Overhead %
   - Contingency Amount = (Item Subtotal + Profit + Overhead) × Contingency %
3. **Subtotal Before Discounts** = Item Subtotal + Profit + Overhead + Contingency → stored in `quote.subtotal`
4. **Apply Discount Rules** (percentage first, then fixed amount in order_index order)
5. **Discount Amount** = SUM(all discounts) → stored in `quote.discount_amount`
6. **Subtotal After Discounts** = Subtotal - Discount Amount
7. **Tax Amount** = Subtotal After Discounts × Tax Rate → stored in `quote.tax_amount`
8. **Final Total** = Subtotal After Discounts + Tax Amount → stored in `quote.total`

See [quotes_PRICING_LOGIC.md](./quotes_PRICING_LOGIC.md) for comprehensive calculation documentation.

---

### 8. quote_version

**Purpose**: Complete audit trail of all quote changes

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `version_number` (DECIMAL(4,2)): 1.0, 1.1, 2.0, etc.
- `snapshot_data` (LONGTEXT): Complete quote data in JSON
- `change_summary` (TEXT, nullable): What changed
- `changed_by_user_id` (VARCHAR(36), nullable): Who made change
- `created_at` (DATETIME)

**Indexes**:
- `@@unique([quote_id, version_number])`
- `@@index([quote_id, created_at(sort: Desc)])`

**Relationships**:
- Belongs to: `quote`, `user` (changer)

**Business Rules**:
- New version created on every save
- Cannot delete (audit trail)
- Cannot modify past versions

---

### 9. quote_group

**Purpose**: Organize items into logical sections with subtotals

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `name` (VARCHAR(200))
- `description` (TEXT, nullable)
- `order_index` (INT, default 0): Sort order
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, order_index])`

**Relationships**:
- Belongs to: `quote`
- Has many: `quote_item`

---

### 10. quote_item

**Purpose**: Individual line items with detailed cost breakdown

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `quote_group_id` (VARCHAR(36), nullable): Group assignment
- `item_library_id` (VARCHAR(36), nullable): Source from library
- `title` (VARCHAR(200))
- `description` (TEXT, nullable)
- `quantity` (DECIMAL(10,2))
- `unit_measurement_id` (VARCHAR(36)): Unit type
- `order_index` (INT, default 0): Sort order
- `material_cost_per_unit` (DECIMAL(10,2), default 0)
- `labor_cost_per_unit` (DECIMAL(10,2), default 0)
- `equipment_cost_per_unit` (DECIMAL(10,2), default 0)
- `subcontract_cost_per_unit` (DECIMAL(10,2), default 0)
- `other_cost_per_unit` (DECIMAL(10,2), default 0)
- `custom_markup_percent` (DECIMAL(5,2), nullable): Override markup
- `custom_discount_amount` (DECIMAL(10,2), nullable): Override discount
- `custom_tax_rate` (DECIMAL(5,2), nullable): Override tax
- `private_notes` (TEXT, nullable): Internal notes
- `save_to_library` (BOOLEAN, default false): Create library entry
- `warranty_tier_id` (VARCHAR(36), nullable): Warranty option
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, order_index])`
- `@@index([quote_id, quote_group_id])`
- `@@index([item_library_id])`

**Relationships**:
- Belongs to: `quote`, `quote_group` (nullable), `unit_measurement`, `quote_warranty_tier` (nullable)

**Business Rules**:
- Quantity must be > 0
- At least one cost field must be > 0
- Order index determines display sequence

---

### 11. quote_approval

**Purpose**: Track approval workflow for quotes requiring manager/owner approval

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `approval_level` (INT): Level (1, 2, 3...)
- `approver_user_id` (VARCHAR(36)): Who must approve
- `status` (ENUM: approval_status, default pending)
- `comments` (TEXT, nullable): Approval notes
- `decided_at` (DATETIME, nullable): When decided
- `created_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, approval_level])`
- `@@index([approver_user_id, status])`

**Relationships**:
- Belongs to: `quote`, `user` (approver)

---

### 12. quote_discount_rule

**Purpose**: Quote-level discounts (early payment, volume, seasonal, etc.)

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `rule_type` (ENUM: discount_rule_type): percentage or fixed_amount
- `value` (DECIMAL(10,2)): Discount value
- `reason` (VARCHAR(255)): Discount reason
- `apply_to` (ENUM: discount_apply_to, default subtotal): Where to apply
- `order_index` (INT, default 0): Application order
- `created_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, order_index])`

---

### 13. quote_tag_assignment

**Purpose**: Many-to-many junction table for quote-to-tag relationships

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `quote_tag_id` (VARCHAR(36), NOT NULL)
- `created_at` (DATETIME)

**Indexes**:
- `@@unique([quote_id, quote_tag_id])`
- `@@index([quote_id])`
- `@@index([quote_tag_id])`

---

### 14. quote_attachment

**Purpose**: Photos and URL attachments for quotes (ALL images stored via file storage module)

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `attachment_type` (ENUM: attachment_type): Type of attachment
- `file_id` (VARCHAR(36), nullable): Image file reference
- `url` (VARCHAR(500), nullable): URL attachment
- `title` (VARCHAR(200), nullable): URL title
- `qr_code_file_id` (VARCHAR(36), nullable): Generated QR code
- `grid_layout` (ENUM: grid_layout, nullable): Grid layout option
- `order_index` (INT, default 0): Sort order
- `created_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, attachment_type, order_index])`
- `@@index([file_id])`

**Relationships**:
- Belongs to: `quote`, `file` (for images and QR codes)

**Business Rules**:
- Cover photo: Maximum 1 per quote
- Full page photos: Multiple allowed, each on own page
- Grid photos: Multiple allowed, grouped by grid_layout
- URL attachments: Auto-generate QR code on save

---

### 15. quote_view_log

**Purpose**: Track customer views of public quote URLs for analytics

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `public_token` (VARCHAR(32)): URL token used
- `viewed_at` (DATETIME): View timestamp
- `ip_address` (VARCHAR(45), nullable): Viewer IP (anonymized after 90 days)
- `view_duration_seconds` (INT, nullable): Time on page
- `device_type` (ENUM: device_type, nullable): Device category
- `referrer_url` (VARCHAR(500), nullable): Where they came from

**Indexes**:
- `@@index([quote_id, viewed_at])`
- `@@index([public_token])`

**Relationships**:
- Belongs to: `quote`

**Business Rules**:
- First view triggers status change from "sent" to "read"
- Anonymize IP after 90 days (GDPR compliance)

---

### 16. draw_schedule_entry

**Purpose**: Payment schedule breakdown showing when payments are due

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `draw_number` (INT): Sequential number
- `description` (VARCHAR(255)): What this covers
- `calculation_type` (ENUM: draw_calculation_type): percentage or fixed_amount
- `value` (DECIMAL(10,2)): % or $ amount
- `order_index` (INT, default 0): Sort order
- `created_at` (DATETIME)

**Indexes**:
- `@@index([quote_id, order_index])`

**Relationships**:
- Belongs to: `quote`

**Business Rules**:
- If percentage: sum must equal 100%
- If fixed amount: sum should equal quote total
- Cannot mix percentage and fixed in same quote

---

### 17. quote_public_access

**Purpose**: Manage public URL access tokens and passwords for quote sharing

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_id` (VARCHAR(36), NOT NULL)
- `access_token` (VARCHAR(32), UNIQUE): URL token
- `password_hash` (VARCHAR(255), nullable): Bcrypt hash
- `password_hint` (VARCHAR(255), nullable): Password hint
- `is_active` (BOOLEAN, default true): Token active
- `created_at` (DATETIME)
- `expires_at` (DATETIME, nullable): Token expiration

**Indexes**:
- `@@unique([access_token])`
- `@@index([quote_id])`

**Relationships**:
- Belongs to: `quote`

**Business Rules**:
- One active token per quote
- Creating new token deactivates old one
- Password protection optional

---

### 18. item_library

**Purpose**: Reusable catalog of common items for quick quote building

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `title` (VARCHAR(200))
- `description` (TEXT, nullable)
- `default_quantity` (DECIMAL(10,2), default 1)
- `unit_measurement_id` (VARCHAR(36))
- `material_cost_per_unit` (DECIMAL(10,2), default 0)
- `labor_cost_per_unit` (DECIMAL(10,2), default 0)
- `equipment_cost_per_unit` (DECIMAL(10,2), default 0)
- `subcontract_cost_per_unit` (DECIMAL(10,2), default 0)
- `other_cost_per_unit` (DECIMAL(10,2), default 0)
- `usage_count` (INT, default 0): Times used
- `last_used_at` (DATETIME, nullable): Last usage
- `is_active` (BOOLEAN, default true)
- `created_by_user_id` (VARCHAR(36), nullable)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, title])`
- `@@index([tenant_id, last_used_at])`

**Relationships**:
- Belongs to: `tenant`, `unit_measurement`, `user` (creator)
- Referenced by: `quote_item` (soft reference)

**Business Rules**:
- When added to quote, creates new quote_item (not linked)
- Library item changes don't affect existing quotes

---

### 19. quote_bundle

**Purpose**: Pre-configured packages of items for quick quote building

**Columns**:
- `id` (VARCHAR(36), PK)
- `tenant_id` (VARCHAR(36), NOT NULL)
- `name` (VARCHAR(200))
- `description` (TEXT, nullable)
- `discount_type` (ENUM: discount_rule_type, nullable)
- `discount_value` (DECIMAL(10,2), nullable)
- `is_active` (BOOLEAN, default true)
- `created_by_user_id` (VARCHAR(36), nullable)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

**Indexes**:
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, name])`

**Relationships**:
- Belongs to: `tenant`, `user` (creator)
- Has many: `quote_bundle_item`

---

### 20. quote_bundle_item

**Purpose**: Items included in a bundle definition

**Columns**:
- `id` (VARCHAR(36), PK)
- `quote_bundle_id` (VARCHAR(36), NOT NULL)
- `item_library_id` (VARCHAR(36), nullable): Source item
- `title` (VARCHAR(200))
- `description` (TEXT, nullable)
- `quantity` (DECIMAL(10,2))
- `unit_measurement_id` (VARCHAR(36))
- `material_cost_per_unit` (DECIMAL(10,2), default 0)
- `labor_cost_per_unit` (DECIMAL(10,2), default 0)
- `equipment_cost_per_unit` (DECIMAL(10,2), default 0)
- `subcontract_cost_per_unit` (DECIMAL(10,2), default 0)
- `other_cost_per_unit` (DECIMAL(10,2), default 0)
- `order_index` (INT, default 0)
- `created_at` (DATETIME)

**Indexes**:
- `@@index([quote_bundle_id, order_index])`

**Relationships**:
- Belongs to: `quote_bundle`, `unit_measurement`

---

## Multi-Tenant Isolation Strategy

### Direct Tenant Scoping
Tables with `tenant_id` column enforcing isolation:
- `quote`, `vendor`, `item_library`, `quote_bundle`, `quote_tag`, `quote_warranty_tier`
- `unit_measurement` (nullable), `quote_template` (nullable)

### Inherited Tenant Scoping
Tables inheriting isolation via parent relationship:
- Via `quote`: `quote_version`, `quote_item`, `quote_group`, `quote_approval`, `quote_discount_rule`, `quote_tag_assignment`, `quote_attachment`, `quote_view_log`, `draw_schedule_entry`, `quote_public_access`, `quote_jobsite_address`
- Via `quote_bundle`: `quote_bundle_item`

### Prisma Middleware Enforcement
All tenant-scoped models added to `TENANT_SCOPED_MODELS` array in [prisma.service.ts:64](/var/www/lead360.app/api/src/core/database/prisma.service.ts#L64):
- Quote, Vendor, ItemLibrary, QuoteBundle, QuoteTag, QuoteWarrantyTier, UnitMeasurement, QuoteTemplate

---

## Index Strategy

### Multi-Tenant Query Optimization
Every tenant-scoped table has:
```
@@index([tenant_id, frequently_queried_field])
```

### Common Index Patterns
- Status filtering: `@@index([tenant_id, status])`
- Date sorting: `@@index([tenant_id, created_at(sort: Desc)])`
- Active records: `@@index([tenant_id, is_active])`
- Relationships: `@@index([parent_id, child_index])`

---

## Foreign Key Cascade Rules

### Cascade Delete (onDelete: Cascade)
Parent deletion removes children:
- quote → all quote child tables
- quote_bundle → quote_bundle_item
- tenant → all tenant-owned tables

### Set Null (onDelete: SetNull)
Preserve child, remove reference:
- user → created_by_user_id fields (keep record, null creator)
- vendor → quote.vendor_id (keep quote, reassign vendor)
- lead → quote.lead_id (keep quote record)

### Restrict (onDelete: Restrict)
Prevent deletion if references exist:
- unit_measurement → quote_item (cannot delete if used)
- file → vendor.signature_file_id (must replace signature first)
- quote_jobsite_address → quote (cannot delete if quotes exist)

---

## Data Type Conventions

### UUIDs
- Type: `VARCHAR(36)`
- Format: Full UUID with hyphens
- Generated at application layer

### Money Fields
- Type: `DECIMAL(10,2)` or `DECIMAL(12,2)` for larger amounts
- Precision: 2 decimal places
- Range: Up to $9,999,999.99 (10,2) or $9,999,999,999.99 (12,2)

### Percentages
- Type: `DECIMAL(5,2)`
- Range: 0-999.99%
- Precision: 2 decimal places

### Coordinates
- Latitude: `DECIMAL(10,8)`
- Longitude: `DECIMAL(11,8)`

### Timestamps
- `created_at`: `DATETIME @default(now())`
- `updated_at`: `DATETIME @updatedAt` (auto-updated by Prisma)

---

## Schema Validation Rules

### Required Constraints
- Quote number unique per tenant
- Vendor email unique per tenant
- Tag name unique per tenant
- Quote version number unique per quote

### Business Logic Constraints
- Quantity > 0
- All cost fields >= 0
- Percentages: 0-100 range
- Draw schedule must total 100% (if percentage)

---

## Status

✅ **Schema Complete**
- All 20 tables created
- All 9 enums defined
- All indexes implemented
- All relationships mapped
- Prisma Client generated
- Middleware updated
- Multi-tenant isolation enforced

**Ready for Backend Developer 2** to implement business logic and API endpoints.

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Maintained By**: Backend Developer 1
