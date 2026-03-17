# Sprint F-02 — Supplier Registry

**Module**: Financial  
**Sprint**: F-02  
**Status**: Ready for Development  
**Type**: New Feature — New Tables + Full CRUD API  
**Estimated Complexity**: High  
**Prerequisite**: Sprint F-01 must be complete and merged before this sprint begins.

---

## Purpose

Lead360 businesses buy materials, fuel, equipment, and services from external suppliers every day. Currently there is no structured way to record who supplies what, at what price, or where they are located. The `financial_entry` table has a free-text `vendor_name` field — this is queryable only as a string match, not as a structured entity.

The Supplier Registry transforms suppliers into first-class entities: searchable, filterable, map-viewable, with dynamic category tags, a product/service price catalog, and purchase price history. It is the foundational reference data layer for the entire financial module — every expense entry that references a supplier will link to a record here rather than typing a name in a text box.

**Important distinction:** The `vendor` table in `api/src/modules/quotes/` is the company issuing the quote (your own business identity on a quote document — it has a signature field and is_default). That is not a supplier. The `supplier` entity built in this sprint is who the business *buys from*. There is zero schema conflict.

---

## Scope

### In Scope

- New `supplier_category` table — tenant-managed dynamic categories for suppliers
- New `supplier` table — full supplier entity with address, geo, contacts, status
- New `supplier_product` table — products/services offered by a supplier, with unit price, unit of measure, and last-updated timestamp
- Full CRUD endpoints for all three tables
- Google Places autocomplete integration on supplier create/update (same pattern as existing `vendor` model)
- Geocoding: lat/lng stored from Google Places result for map display
- Map data endpoint: returns all active suppliers with lat/lng for frontend map rendering
- Supplier search: by name, category, product type, location radius
- Price history: when a `financial_entry` is created or updated with a `supplier_id` and an `amount`, the system records the implied unit price against that supplier's product if a product is linked — tracked as a `supplier_product_price_history` record
- Supplier statistics endpoint: total spend, number of transactions, last purchase date
- Seed: no system-default suppliers (tenant-specific data — no seeding needed)
- 100% API documentation
- Full test coverage including tenant isolation

### Out of Scope

- No frontend implementation (frontend sprint follows after backend is complete)
- No supplier portal or external-facing supplier access
- No automated price comparison between suppliers
- No purchase order module (that is a later sprint)
- No integration with any external supplier database or pricing API
- No modification of `financial_entry` beyond what was done in F-01 (the `supplier_id` stub field already exists from F-01 — this sprint adds the table, the relation, and wires up the FK)

---

## Platform Architecture Patterns (Mandatory)

- **Tenant isolation**: Every query on every table in this sprint must include `tenant_id`. Supplier categories, suppliers, and supplier products all belong to a tenant.
- **TenantId decorator**: All controller methods extract `tenant_id` from JWT via `@TenantId()`. Never from request body.
- **AuditLoggerService**: All create, update, and delete operations must be audit logged with action, actor (`user_id`), entity type, entity id, and before/after payload.
- **FilesService**: Not required in this sprint — no file uploads for suppliers.
- **Google Maps / Places integration**: The existing `vendor` model uses `google_place_id`, `latitude`, `longitude` on the same Prisma pattern. This sprint replicates that pattern for the `supplier` table. The Google Places service used by the vendor module must be reused — do not create a new integration. Read `api/src/modules/quotes/services/vendor.service.ts` to understand the exact Google API call pattern before implementing.
- **EncryptionService**: Not applicable — no sensitive fields.
- **Migrations**: Run `npx prisma migrate dev --name supplier_registry` after schema additions. Commit schema and migration together. Run `npx prisma generate`.

---

## Data Model

### Table 1: `supplier_category`

**Purpose:** Tenant-managed dynamic categories for classifying suppliers. Examples: "Roofing Materials", "Paint & Coatings", "Fuel", "Lumber", "Electrical", "Plumbing", "Equipment Rental". These are fully user-defined — not an enum.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | Primary key |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `name` | `String @db.VarChar(100)` | Yes | — | Category name, unique per tenant |
| `description` | `String? @db.Text` | No | null | Optional description |
| `color` | `String? @db.VarChar(7)` | No | null | Hex color for UI badge (e.g., `#3B82F6`) |
| `is_active` | `Boolean @default(true)` | Yes | true | Soft disable without deletion |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | User who created |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, name])`
- `@@unique([tenant_id, name])` — category name must be unique within a tenant

**Relations:**
- Has many: `supplier` (via `supplier_category_assignment` junction table — a supplier can have multiple categories)

**Business rules:**
- Category name is unique per tenant (case-insensitive comparison enforced at service level).
- A category cannot be deleted if it is assigned to any active supplier. Service must check and throw `ConflictException` with message: "Category is assigned to one or more suppliers. Deactivate it instead."
- Deactivating a category does not remove its assignments from suppliers — it only hides it from the category picker in the UI.
- Maximum 50 active categories per tenant. Enforce at service level on create.

---

### Table 2: `supplier_category_assignment` (Junction)

**Purpose:** Many-to-many between supplier and supplier_category.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | Primary key |
| `supplier_id` | `String @db.VarChar(36)` | Yes | FK to supplier |
| `supplier_category_id` | `String @db.VarChar(36)` | Yes | FK to supplier_category |
| `tenant_id` | `String @db.VarChar(36)` | Yes | Tenant owner — denormalized for query performance |
| `created_at` | `DateTime @default(now())` | Yes | — |

**Indexes:**
- `@@unique([supplier_id, supplier_category_id])`
- `@@index([tenant_id, supplier_id])`
- `@@index([tenant_id, supplier_category_id])`

---

### Table 3: `supplier`

**Purpose:** The core supplier entity. Represents a business the tenant buys from.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | Primary key |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `name` | `String @db.VarChar(200)` | Yes | — | Business name |
| `legal_name` | `String? @db.VarChar(200)` | No | null | Legal entity name if different |
| `website` | `String? @db.VarChar(500)` | No | null | Supplier website URL |
| `phone` | `String? @db.VarChar(20)` | No | null | Primary contact phone |
| `email` | `String? @db.VarChar(255)` | No | null | Primary contact email |
| `contact_name` | `String? @db.VarChar(150)` | No | null | Primary contact person name |
| `address_line1` | `String? @db.VarChar(255)` | No | null | Street address |
| `address_line2` | `String? @db.VarChar(255)` | No | null | Suite, unit, etc. |
| `city` | `String? @db.VarChar(100)` | No | null | City |
| `state` | `String? @db.VarChar(2)` | No | null | 2-letter US state code |
| `zip_code` | `String? @db.VarChar(10)` | No | null | ZIP or ZIP+4 |
| `country` | `String @db.VarChar(2) @default("US")` | Yes | US | ISO 2-letter country code |
| `latitude` | `Decimal? @db.Decimal(10, 8)` | No | null | From Google Places geocoding |
| `longitude` | `Decimal? @db.Decimal(11, 8)` | No | null | From Google Places geocoding |
| `google_place_id` | `String? @db.VarChar(255)` | No | null | Google Places ID for address resolution |
| `notes` | `String? @db.Text` | No | null | Internal notes about this supplier |
| `is_preferred` | `Boolean @default(false)` | Yes | false | Preferred supplier flag for UI highlighting |
| `is_active` | `Boolean @default(true)` | Yes | true | Soft delete |
| `total_spend` | `Decimal @default(0.00) @db.Decimal(14, 2)` | Yes | 0.00 | Running total of all expenses linked to this supplier — updated on each financial_entry create/delete |
| `last_purchase_date` | `DateTime? @db.Date` | No | null | Date of most recent financial_entry linked — updated on each financial_entry create |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `updated_by_user_id` | `String? @db.VarChar(36)` | No | null | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, is_active])`
- `@@index([tenant_id, is_preferred])`
- `@@index([tenant_id, name])`
- `@@index([tenant_id, last_purchase_date])`
- `@@index([tenant_id, created_at])`

**Relations:**
- Has many: `supplier_category_assignment`
- Has many: `supplier_product`
- Has many: `supplier_product_price_history`
- Has many: `financial_entry` (reverse — entries that reference this supplier)

**Business rules:**
- `name` is unique per tenant (case-insensitive check at service level). Duplicate name throws `ConflictException`.
- Address fields are all optional. A supplier can be created with name only (e.g., a cash vendor with no known address).
- When `google_place_id` is provided on create or update, the service calls Google Places API to resolve `latitude`, `longitude`, `address_line1`, `city`, `state`, `zip_code` — same pattern as `vendor.service.ts`. The resolved address fields are auto-populated and can be overridden by the user.
- `total_spend` and `last_purchase_date` are computed fields maintained by the service — they are not sent by the client. They are updated whenever a `financial_entry` with this `supplier_id` is created, updated, or deleted.
- A supplier cannot be hard-deleted if it has any `financial_entry` records. Service throws `ConflictException`: "Supplier has expense records. Deactivate it instead."
- `is_preferred` has no uniqueness constraint — multiple suppliers can be preferred.

---

### Table 4: `supplier_product`

**Purpose:** Products or services that a supplier offers, with unit pricing. A sand supplier has "Crushed Stone — per ton". A paint supplier has "Exterior Latex — per gallon". Prices are manually maintained by the tenant.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | auto | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | — | Tenant owner |
| `supplier_id` | `String @db.VarChar(36)` | Yes | — | FK to supplier |
| `name` | `String @db.VarChar(200)` | Yes | — | Product or service name |
| `description` | `String? @db.Text` | No | null | Optional description |
| `unit_of_measure` | `String @db.VarChar(50)` | Yes | — | e.g., "ton", "gallon", "sheet", "hour", "each", "roll", "bag", "yard" |
| `unit_price` | `Decimal? @db.Decimal(12, 4)` | No | null | Current price per unit — nullable if unknown |
| `price_last_updated_at` | `DateTime? @db.Date` | No | null | When the price was last manually set |
| `price_last_updated_by_user_id` | `String? @db.VarChar(36)` | No | null | Who last updated the price |
| `sku` | `String? @db.VarChar(100)` | No | null | Supplier's product code or SKU |
| `is_active` | `Boolean @default(true)` | Yes | true | Soft disable |
| `created_by_user_id` | `String @db.VarChar(36)` | Yes | — | — |
| `created_at` | `DateTime @default(now())` | Yes | auto | — |
| `updated_at` | `DateTime @updatedAt` | Yes | auto | — |

**Indexes:**
- `@@index([tenant_id, supplier_id])`
- `@@index([tenant_id, supplier_id, is_active])`
- `@@index([supplier_id, name])`

**Business rules:**
- Product name must be unique within a supplier (case-insensitive). Two different suppliers can have a product with the same name.
- `unit_price` can be null — not every product has a known price on file.
- When `unit_price` is updated (changed from its previous value), a `supplier_product_price_history` record is automatically created capturing the old price, new price, and timestamp. This happens in the service, not as a DB trigger.
- A product cannot be hard-deleted if it has price history records. Use `is_active = false` instead.
- `price_last_updated_at` is set automatically by the service when `unit_price` changes — not sent by the client.

---

### Table 5: `supplier_product_price_history`

**Purpose:** Immutable audit log of every price change for a supplier product. Enables price trend tracking over time.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `String @id @default(uuid()) @db.VarChar(36)` | Yes | — |
| `tenant_id` | `String @db.VarChar(36)` | Yes | Tenant owner |
| `supplier_product_id` | `String @db.VarChar(36)` | Yes | FK to supplier_product |
| `supplier_id` | `String @db.VarChar(36)` | Yes | Denormalized for query performance |
| `previous_price` | `Decimal? @db.Decimal(12, 4)` | No | null if first price ever set |
| `new_price` | `Decimal @db.Decimal(12, 4)` | Yes | The new price being recorded |
| `changed_by_user_id` | `String @db.VarChar(36)` | Yes | User who made the change |
| `changed_at` | `DateTime @default(now())` | Yes | Timestamp of change |
| `notes` | `String? @db.VarChar(500)` | No | Optional reason for price change |

**Indexes:**
- `@@index([tenant_id, supplier_product_id])`
- `@@index([tenant_id, supplier_id])`
- `@@index([supplier_product_id, changed_at])`

**Business rules:**
- Records are immutable — no update or delete allowed via API.
- Records are created automatically by `SupplierProductService.updateProduct()` when `unit_price` changes.
- `previous_price` is null for the first price ever set on a product.

---

### Schema Relation: `financial_entry.supplier_id` FK

Sprint F-01 added `supplier_id` as a plain `String?` field with no Prisma relation. This sprint adds the relation definition:

```
supplier   supplier?   @relation(fields: [supplier_id], references: [id], onDelete: SetNull)
```

And the reverse on `supplier`:
```
financial_entries   financial_entry[]
```

This requires a migration addendum within the F-02 migration file.

---

## API Specification

### Supplier Category Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/supplier-categories` | List all categories for tenant | All |
| `POST` | `/financial/supplier-categories` | Create a new category | Owner, Admin, Manager, Bookkeeper |
| `PATCH` | `/financial/supplier-categories/:id` | Update category | Owner, Admin, Manager, Bookkeeper |
| `DELETE` | `/financial/supplier-categories/:id` | Delete category (blocked if in use) | Owner, Admin |

---

#### `GET /financial/supplier-categories`

**Query parameters:**
- `is_active` — boolean, optional. If omitted, returns all. If `true`, returns only active. If `false`, returns only inactive.

**Response:** Array of category objects.

```
id              string
tenant_id       string
name            string
description     string | null
color           string | null
is_active       boolean
supplier_count  integer   — number of active suppliers assigned to this category
created_at      datetime
updated_at      datetime
```

---

#### `POST /financial/supplier-categories`

**Request body:**
```
name          string    required    max 100 chars
description   string    optional
color         string    optional    must be valid hex color (#RRGGBB format)
```

**Response:** 201 Created — full category object.

**Errors:**
- 409 Conflict — name already exists for this tenant
- 400 Bad Request — color format invalid
- 400 Bad Request — tenant has reached 50 active category limit

---

#### `PATCH /financial/supplier-categories/:id`

**Request body:** All fields optional. Only provided fields are updated.
```
name          string    optional
description   string    optional
color         string    optional
is_active     boolean   optional
```

**Errors:**
- 404 Not Found — category not found or not in this tenant
- 409 Conflict — name change conflicts with existing category name

---

#### `DELETE /financial/supplier-categories/:id`

**Errors:**
- 404 Not Found
- 409 Conflict — category is assigned to one or more suppliers

---

### Supplier Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/suppliers` | List suppliers with filters | All |
| `POST` | `/financial/suppliers` | Create supplier | Owner, Admin, Manager, Bookkeeper |
| `GET` | `/financial/suppliers/:id` | Get single supplier with full detail | All |
| `PATCH` | `/financial/suppliers/:id` | Update supplier | Owner, Admin, Manager, Bookkeeper |
| `DELETE` | `/financial/suppliers/:id` | Soft delete (set is_active = false) | Owner, Admin |
| `GET` | `/financial/suppliers/map` | All active suppliers with lat/lng for map | All |
| `GET` | `/financial/suppliers/:id/statistics` | Spend totals, transaction count, last purchase | All |

---

#### `GET /financial/suppliers`

**Query parameters:**
- `search` — string, optional. Searches against `name`, `contact_name`, `email`.
- `category_id` — UUID, optional. Filter by supplier category.
- `is_active` — boolean, optional. Default: `true` (active only).
- `is_preferred` — boolean, optional. Filter preferred suppliers.
- `page` — integer, default 1.
- `limit` — integer, default 20, max 100.
- `sort_by` — `name` | `total_spend` | `last_purchase_date` | `created_at`. Default: `name`.
- `sort_order` — `asc` | `desc`. Default: `asc`.

**Response:**
```
data: [
  {
    id
    name
    legal_name
    phone
    email
    contact_name
    city
    state
    is_preferred
    is_active
    total_spend
    last_purchase_date
    categories: [{ id, name, color }]
    product_count   integer
    created_at
  }
]
meta: { total, page, limit, total_pages }
```

---

#### `POST /financial/suppliers`

**Request body:**
```
name                  string    required
legal_name            string    optional
website               string    optional
phone                 string    optional
email                 string    optional
contact_name          string    optional
google_place_id       string    optional   — triggers address auto-fill
address_line1         string    optional   — used if google_place_id not provided
address_line2         string    optional
city                  string    optional
state                 string    optional   — 2-letter code
zip_code              string    optional
country               string    optional   — default "US"
notes                 string    optional
is_preferred          boolean   optional   — default false
category_ids          string[]  optional   — array of supplier_category UUIDs to assign
```

**Behavior when `google_place_id` is provided:**
1. Call Google Places API to resolve place details.
2. Auto-populate `latitude`, `longitude`, `address_line1`, `city`, `state`, `zip_code` from API response.
3. If the client also provided manual address fields, the Google-resolved values take precedence.
4. Store `google_place_id` on the record.

**Response:** 201 Created — full supplier object including resolved address and assigned categories.

**Errors:**
- 409 Conflict — supplier name already exists for this tenant
- 400 Bad Request — any `category_id` in `category_ids` not found or not in this tenant
- 422 Unprocessable — `google_place_id` provided but Google API returns no result

---

#### `GET /financial/suppliers/:id`

**Response:** Full supplier object:
```
id
name
legal_name
website
phone
email
contact_name
address_line1
address_line2
city
state
zip_code
country
latitude
longitude
google_place_id
notes
is_preferred
is_active
total_spend
last_purchase_date
categories: [{ id, name, color }]
products: [{ id, name, unit_of_measure, unit_price, price_last_updated_at, is_active }]
created_by: { id, first_name, last_name }
created_at
updated_at
```

---

#### `PATCH /financial/suppliers/:id`

All fields optional. Partial update.

**Special behavior:**
- If `google_place_id` is provided and differs from current value, re-call Google Places and re-resolve address.
- If `category_ids` is provided, it replaces the full set of category assignments (not a merge — it is a replace operation). Send empty array `[]` to remove all categories.

**Errors:**
- 404 Not Found
- 409 Conflict — name change conflicts
- 400 Bad Request — invalid category_id

---

#### `DELETE /financial/suppliers/:id`

Soft delete — sets `is_active = false`.

**Errors:**
- 404 Not Found
- 409 Conflict — supplier has `financial_entry` records (hard delete blocked)

**Note:** This endpoint sets `is_active = false`. It does not hard-delete the record. The error case above applies only if someone bypasses the soft-delete path (which they cannot via this API — document this for clarity).

**Correction:** The DELETE endpoint performs a soft delete always. The hard-delete block applies if someone attempts to bypass soft-delete at a future time. For this sprint, DELETE = soft delete, and returns 200 with the updated supplier.

---

#### `GET /financial/suppliers/map`

**Purpose:** Returns all active suppliers that have `latitude` and `longitude` set, for rendering on a map.

**No query parameters** beyond implicit `tenant_id` from JWT.

**Response:**
```
[
  {
    id
    name
    latitude
    longitude
    city
    state
    is_preferred
    categories: [{ id, name, color }]
    total_spend
  }
]
```

Only suppliers where `latitude IS NOT NULL AND longitude IS NOT NULL AND is_active = true` are returned.

---

#### `GET /financial/suppliers/:id/statistics`

**Response:**
```
supplier_id
total_spend           decimal   — sum of all financial_entry.amount where supplier_id = this
transaction_count     integer   — count of financial_entry records
last_purchase_date    date | null
first_purchase_date   date | null
spend_by_category: [
  { category_name, total_spend }   — financial_entry category breakdown for this supplier
]
spend_by_month: [
  { year, month, total_spend }   — last 12 months
]
```

---

### Supplier Product Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| `GET` | `/financial/suppliers/:id/products` | List products for supplier | All |
| `POST` | `/financial/suppliers/:id/products` | Add product to supplier | Owner, Admin, Manager, Bookkeeper |
| `PATCH` | `/financial/suppliers/:id/products/:productId` | Update product | Owner, Admin, Manager, Bookkeeper |
| `DELETE` | `/financial/suppliers/:id/products/:productId` | Soft delete product | Owner, Admin |
| `GET` | `/financial/suppliers/:id/products/:productId/price-history` | Price history | All |

---

#### `GET /financial/suppliers/:id/products`

**Query parameters:**
- `is_active` — boolean, optional. Default: true.

**Response:** Array of:
```
id
name
description
unit_of_measure
unit_price
price_last_updated_at
sku
is_active
created_at
```

---

#### `POST /financial/suppliers/:id/products`

**Request body:**
```
name              string    required
description       string    optional
unit_of_measure   string    required    max 50 chars
unit_price        decimal   optional
sku               string    optional
```

**Behavior:** If `unit_price` is provided, automatically creates first `supplier_product_price_history` record with `previous_price = null`.

**Response:** 201 Created — full product object.

**Errors:**
- 404 Not Found — supplier not found or not in this tenant
- 409 Conflict — product name already exists for this supplier

---

#### `PATCH /financial/suppliers/:id/products/:productId`

All fields optional.

**Behavior:** If `unit_price` changes from its current value, automatically creates a `supplier_product_price_history` record before saving the update.

**Response:** Updated product object including `price_last_updated_at`.

---

#### `DELETE /financial/suppliers/:id/products/:productId`

Soft delete — sets `is_active = false`.

**Errors:**
- 404 Not Found
- 409 Conflict — product has price history records (cannot hard-delete)

---

#### `GET /financial/suppliers/:id/products/:productId/price-history`

**Response:**
```
[
  {
    id
    previous_price
    new_price
    changed_at
    changed_by: { id, first_name, last_name }
    notes
  }
]
```

Ordered by `changed_at DESC` (most recent first).

---

## Service Architecture

### `SupplierCategoryService`
- `create(tenantId, userId, dto)`
- `findAll(tenantId, isActive?)`
- `findOne(tenantId, categoryId)`
- `update(tenantId, categoryId, userId, dto)`
- `delete(tenantId, categoryId, userId)`

### `SupplierService`
- `create(tenantId, userId, dto)` — includes Google Places resolution when `google_place_id` provided
- `findAll(tenantId, query)` — paginated, filtered, sorted
- `findOne(tenantId, supplierId)` — full detail with categories and products
- `update(tenantId, supplierId, userId, dto)` — includes category assignment replace
- `softDelete(tenantId, supplierId, userId)`
- `findForMap(tenantId)` — active suppliers with lat/lng only
- `getStatistics(tenantId, supplierId)` — aggregated spend data
- `updateSpendTotals(tenantId, supplierId)` — called internally when financial_entry changes (private method)

### `SupplierProductService`
- `create(tenantId, supplierId, userId, dto)`
- `findAll(tenantId, supplierId, isActive?)`
- `update(tenantId, supplierId, productId, userId, dto)` — triggers price history on price change
- `softDelete(tenantId, supplierId, productId, userId)`
- `getPriceHistory(tenantId, supplierId, productId)`

---

## Module Registration

`SupplierModule` must be created and registered in the root `AppModule`. It must export `SupplierService` so that `FinancialModule` can call `updateSpendTotals` when a `financial_entry` is created with a `supplier_id`.

**Alternatively:** The `SupplierService.updateSpendTotals()` can be injected into `FinancialModule` via a module import. The agent must choose the cleaner pattern based on existing module cross-import patterns in the codebase and document the choice in the API documentation.

---

## Business Rules Summary

1. Supplier names are unique per tenant (case-insensitive).
2. Supplier category names are unique per tenant (case-insensitive).
3. Product names are unique per supplier (case-insensitive).
4. A supplier with financial entries cannot be hard-deleted. Soft-delete only.
5. A supplier category with supplier assignments cannot be deleted (only deactivated).
6. A product with price history cannot be hard-deleted. Soft-delete only.
7. Price history records are immutable — no update or delete.
8. `total_spend` and `last_purchase_date` on the supplier record are maintained by the service, not by the client.
9. When `unit_price` on a product changes, a price history record is automatically written before the update is saved.
10. `google_place_id` triggers Google Places resolution — resolved address fields take precedence over manually provided fields.
11. Tenant maximum of 50 active supplier categories.
12. All endpoints are tenant-scoped — a supplier from tenant A is never visible to tenant B.

---

## Acceptance Criteria

**Schema:**
- [ ] `supplier_category` table exists in schema and database
- [ ] `supplier_category_assignment` junction table exists
- [ ] `supplier` table exists with all specified fields
- [ ] `supplier_product` table exists
- [ ] `supplier_product_price_history` table exists
- [ ] `financial_entry.supplier_id` Prisma relation is wired to `supplier`
- [ ] Migration runs cleanly from scratch

**Supplier Categories:**
- [ ] `POST /financial/supplier-categories` creates category
- [ ] Duplicate name returns 409
- [ ] 51st active category returns 400
- [ ] `DELETE` blocked if category is assigned to any supplier
- [ ] `PATCH` deactivates category — assignments preserved

**Suppliers:**
- [ ] `POST /financial/suppliers` with `google_place_id` resolves address from Google API
- [ ] `POST /financial/suppliers` without address fields is valid (name only)
- [ ] Duplicate supplier name returns 409
- [ ] `GET /financial/suppliers/map` returns only suppliers with lat/lng
- [ ] `GET /financial/suppliers/:id/statistics` returns correct spend aggregation
- [ ] `DELETE /financial/suppliers/:id` soft-deletes (sets is_active = false)
- [ ] Soft-deleted supplier does not appear in default list

**Products:**
- [ ] `POST /financial/suppliers/:id/products` creates product
- [ ] Creating product with `unit_price` creates first price history record
- [ ] Updating `unit_price` creates new price history record
- [ ] `GET /financial/suppliers/:id/products/:productId/price-history` returns ordered history

**Integration:**
- [ ] `financial_entry` with valid `supplier_id` links correctly — FK resolved
- [ ] Creating `financial_entry` with `supplier_id` updates `supplier.total_spend` and `last_purchase_date`
- [ ] Deleting `financial_entry` with `supplier_id` decrements `supplier.total_spend`

**Tests:**
- [ ] Unit tests for all service methods
- [ ] Tenant isolation test: supplier from tenant A not visible to tenant B
- [ ] RBAC test: Employee cannot create suppliers
- [ ] RBAC test: Employee can list suppliers and products (read access)
- [ ] Integration test: Google Places call mocked — test address resolution
- [ ] Integration test: price history auto-creation on price change

**Documentation:**
- [ ] `api/documentation/financial_REST_API.md` updated with all supplier endpoints
- [ ] All request/response shapes documented
- [ ] Error codes documented per endpoint

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Google Places API key not configured for this module | High — address resolution fails | Low — already used by vendor module | Reuse the same API key and service. Read vendor.service.ts for exact integration pattern before implementing. |
| `FinancialModule` circular dependency if importing `SupplierModule` for spend updates | Medium — app fails to start | Medium | Evaluate circular import risk. If present, use an event-emitter pattern or merge into FinancialModule directly. |
| `total_spend` drift if a financial_entry is bulk-updated outside the service | Low | Low | Document that `total_spend` is a denormalized cache and the statistics endpoint always computes from raw data as source of truth. |
| Supplier category 50-limit feels arbitrary for large operations | Low | Low | Make the limit a tenant plan setting in a future sprint. Document this as a known constraint. |

---

## Dependencies

### Requires (must be complete before this sprint)
- Sprint F-01 — `supplier_id` stub field must exist on `financial_entry`
- Google Places API key must be active (verify with existing vendor module)

### Blocks
- Sprint F-04 — expense entry form supplier selection
- Sprint F-09 — business dashboard supplier spend breakdown

---

## File Change Summary

### Files Created
- `api/src/modules/financial/services/supplier-category.service.ts`
- `api/src/modules/financial/services/supplier.service.ts`
- `api/src/modules/financial/services/supplier-product.service.ts`
- `api/src/modules/financial/dto/create-supplier-category.dto.ts`
- `api/src/modules/financial/dto/update-supplier-category.dto.ts`
- `api/src/modules/financial/dto/create-supplier.dto.ts`
- `api/src/modules/financial/dto/update-supplier.dto.ts`
- `api/src/modules/financial/dto/create-supplier-product.dto.ts`
- `api/src/modules/financial/dto/update-supplier-product.dto.ts`
- `api/src/modules/financial/dto/list-suppliers.dto.ts`
- `api/src/modules/financial/controllers/supplier-category.controller.ts`
- `api/src/modules/financial/controllers/supplier.controller.ts`
- `api/src/modules/financial/controllers/supplier-product.controller.ts`
- `api/prisma/migrations/[timestamp]_supplier_registry/migration.sql`

### Files Modified
- `api/prisma/schema.prisma` — add 5 new tables, add FK relation on financial_entry
- `api/src/modules/financial/financial.module.ts` — register new services and controllers
- `api/documentation/financial_REST_API.md` — add all new endpoints

### Files That Must NOT Be Modified
- Any file in `api/src/modules/quotes/` — do not touch vendor module
- Any file in `api/src/modules/projects/`
- Any frontend file

---

## Notes for Executing Agent

1. Read `api/src/modules/quotes/services/vendor.service.ts` in full before implementing `SupplierService`. The Google Places integration pattern is already working there — replicate it exactly, do not invent a new pattern.
2. Read `api/src/modules/financial/financial.module.ts` before adding new providers — understand the existing registration pattern.
3. The `GET /financial/suppliers/map` route must be defined **before** `GET /financial/suppliers/:id` in the controller, otherwise Express/NestJS will try to match `map` as an `:id` parameter. This is a critical routing order issue.
4. `total_spend` is a denormalized cache for performance. The `getStatistics` endpoint always recomputes from raw `financial_entry` data. The two values may temporarily diverge in high-concurrency scenarios — document this as an acceptable tradeoff.
5. When writing the `updateSpendTotals` private method, use a Prisma aggregate query (`_sum`) rather than loading all entries and summing in JavaScript.
6. Produce 100% API documentation. Every endpoint, every field in request and response, every error code.