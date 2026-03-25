# Financial Module — Supplier Registry REST API

**Version:** 1.0
**Last Updated:** March 2026
**Base URL:** `https://api.lead360.app/api/v1`
**Authentication:** Bearer JWT token required for all endpoints
**Module:** Financial (Sprint F-02)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Multi-Tenant Isolation](#multi-tenant-isolation)
3. [Error Response Format](#error-response-format)
4. [Supplier Categories](#supplier-categories)
5. [Suppliers](#suppliers)
6. [Supplier Products](#supplier-products)
7. [Pagination Format](#pagination-format)
8. [Business Rules](#business-rules)

---

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

**RBAC Roles by Endpoint Group:**

| Action | Owner | Admin | Manager | Bookkeeper | Sales | Employee |
|--------|-------|-------|---------|------------|-------|----------|
| List Categories | Yes | Yes | Yes | No | Yes | Yes |
| Create Category | Yes | Yes | Yes | Yes | No | No |
| Update Category | Yes | Yes | Yes | Yes | No | No |
| Delete Category | Yes | Yes | No | No | No | No |
| List Suppliers | Yes | Yes | Yes | No | Yes | Yes |
| Create Supplier | Yes | Yes | Yes | Yes | No | No |
| Get Supplier | Yes | Yes | Yes | No | Yes | Yes |
| Update Supplier | Yes | Yes | Yes | Yes | No | No |
| Delete Supplier | Yes | Yes | No | No | No | No |
| Supplier Map | Yes | Yes | Yes | No | Yes | Yes |
| Supplier Statistics | Yes | Yes | Yes | No | Yes | Yes |
| List Products | Yes | Yes | Yes | No | Yes | Yes |
| Create Product | Yes | Yes | Yes | Yes | No | No |
| Update Product | Yes | Yes | Yes | Yes | No | No |
| Delete Product | Yes | Yes | No | No | No | No |
| Price History | Yes | Yes | Yes | No | Yes | Yes |

---

## Multi-Tenant Isolation

All endpoints automatically filter data by the authenticated user's `tenant_id`. Cross-tenant access is strictly prohibited.

- `tenant_id` is derived server-side from the JWT token
- Clients never send `tenant_id` in requests
- All database queries are scoped to the authenticated tenant
- Supplier references (e.g., `category_ids`, `supplier_id`) are validated to belong to the same tenant

---

## Error Response Format

All error responses follow this standard format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

**Common HTTP Status Codes:**

| Status Code | Description |
|-------------|-------------|
| `400` | Bad Request — Validation error or business rule violation |
| `401` | Unauthorized — Missing or invalid JWT token |
| `403` | Forbidden — Insufficient role permissions |
| `404` | Not Found — Resource does not exist or belongs to another tenant |
| `409` | Conflict — Duplicate name or resource in use |
| `422` | Unprocessable Entity — Google Places address resolution failed |
| `500` | Internal Server Error — Unexpected server error |

---

## Supplier Categories

### GET /financial/supplier-categories

**Description:** List all supplier categories for the authenticated tenant.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `is_active` | boolean | No | — | Filter by active status (`true` or `false`). If omitted, returns all categories. |

**Response 200:**

```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "name": "Roofing Materials",
    "description": "Shingles, underlayment, flashing",
    "color": "#3B82F6",
    "is_active": true,
    "created_by_user_id": "uuid",
    "created_at": "2026-03-19T04:00:00.000Z",
    "updated_at": "2026-03-19T04:00:00.000Z",
    "supplier_count": 3
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Category unique identifier |
| `tenant_id` | string (UUID) | Tenant identifier |
| `name` | string | Category name (unique per tenant) |
| `description` | string \| null | Optional description |
| `color` | string \| null | Hex color for UI badge (`#RRGGBB`) |
| `is_active` | boolean | Whether the category is active |
| `created_by_user_id` | string (UUID) | User who created the category |
| `created_at` | string (ISO 8601) | Creation timestamp |
| `updated_at` | string (ISO 8601) | Last update timestamp |
| `supplier_count` | number | Count of suppliers assigned to this category |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden (insufficient role)

---

### POST /financial/supplier-categories

**Description:** Create a new supplier category.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | **Yes** | 1–100 chars | Category name (unique per tenant, case-insensitive) |
| `description` | string | No | Max 2000 chars | Optional description |
| `color` | string | No | Regex: `^#[0-9A-Fa-f]{6}$` | Hex color for UI badge (e.g., `#3B82F6`) |

**Example Request:**

```bash
curl -X POST https://api.lead360.app/api/v1/financial/supplier-categories \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Roofing Materials",
    "description": "Shingles, underlayment, flashing",
    "color": "#3B82F6"
  }'
```

**Response 201:**

```json
{
  "id": "b3d6378c-613f-47f6-839f-749630d75e69",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "name": "Roofing Materials",
  "description": "Shingles, underlayment, flashing",
  "color": "#3B82F6",
  "is_active": true,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-19T04:44:14.981Z",
  "updated_at": "2026-03-19T04:44:14.981Z"
}
```

**Errors:**
- `400` — Validation error or 50-category limit reached (`"Maximum of 50 active supplier categories per tenant. Deactivate unused categories before creating new ones."`)
- `401` — Unauthorized
- `403` — Forbidden
- `409` — Category name already exists (`"Supplier category \"<name>\" already exists for this tenant."`)

---

### PATCH /financial/supplier-categories/:id

**Description:** Update a supplier category (partial update).

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier category ID |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | No | 1–100 chars | New category name (unique per tenant, case-insensitive) |
| `description` | string | No | Max 2000 chars | Updated description |
| `color` | string | No | Regex: `^#[0-9A-Fa-f]{6}$` | Updated hex color |
| `is_active` | boolean | No | — | Active status. Deactivating hides from picker but preserves assignments |

**Example Request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/financial/supplier-categories/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Roofing Supplies", "color": "#EF4444"}'
```

**Response 200:** Returns the updated category object (same shape as POST response).

**Errors:**
- `400` — Validation error or 50-category limit reached when reactivating (`is_active: true`)
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Category not found (`"Supplier category not found."`)
- `409` — Category name already exists for this tenant

---

### DELETE /financial/supplier-categories/:id

**Description:** Hard-delete a supplier category. Blocked if the category is assigned to any supplier.

**Roles:** Owner, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier category ID |

**Example Request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/financial/supplier-categories/<id> \
  -H "Authorization: Bearer <token>"
```

**Response 200:**

```json
{
  "message": "Supplier category deleted successfully"
}
```

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden (requires Owner or Admin)
- `404` — Category not found
- `409` — Category is assigned to one or more suppliers (`"Category is assigned to one or more suppliers. Deactivate it instead."`)

---

## Suppliers

### GET /financial/suppliers

**Description:** List suppliers with search, filtering, sorting, and pagination.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `search` | string | No | — | Search against supplier name, contact_name, and email |
| `category_id` | UUID | No | — | Filter by supplier category UUID |
| `is_active` | boolean | No | `true` | Filter by active status |
| `is_preferred` | boolean | No | — | Filter preferred suppliers only |
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `20` | Items per page (min: 1, max: 100) |
| `sort_by` | enum | No | `name` | Sort field. Values: `name`, `total_spend`, `last_purchase_date`, `created_at` |
| `sort_order` | enum | No | `asc` | Sort direction. Values: `asc`, `desc` |

**Example Request:**

```bash
curl "https://api.lead360.app/api/v1/financial/suppliers?page=1&limit=10&search=ABC&sort_by=total_spend&sort_order=desc" \
  -H "Authorization: Bearer <token>"
```

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "ABC Building Supply",
      "legal_name": "ABC Building Supply LLC",
      "phone": "5551234567",
      "email": "orders@abc.com",
      "contact_name": "John Smith",
      "city": "Houston",
      "state": "TX",
      "is_preferred": true,
      "is_active": true,
      "total_spend": "1250.00",
      "last_purchase_date": "2026-03-15T00:00:00.000Z",
      "categories": [
        {
          "id": "uuid",
          "name": "Roofing Materials",
          "color": "#3B82F6"
        }
      ],
      "product_count": 5,
      "created_at": "2026-03-19T04:00:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

**Response Fields — `data[]` items:**

> **Note:** The list response returns a lightweight subset of supplier fields for performance. Use `GET /financial/suppliers/:id` for full details.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Supplier unique identifier |
| `name` | string | Business name |
| `legal_name` | string \| null | Legal entity name |
| `phone` | string \| null | Primary phone number |
| `email` | string \| null | Primary email address |
| `contact_name` | string \| null | Primary contact person name |
| `city` | string \| null | City |
| `state` | string \| null | 2-letter US state code |
| `is_preferred` | boolean | Whether marked as preferred supplier |
| `is_active` | boolean | Whether the supplier is active |
| `total_spend` | string (decimal) | Total spend across all financial entries |
| `last_purchase_date` | string (ISO date) \| null | Date of most recent financial entry |
| `categories` | array | Assigned categories (`{id, name, color}`) |
| `product_count` | number | Count of products for this supplier |
| `created_at` | string (ISO 8601) | Creation timestamp |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden

---

### POST /financial/suppliers

**Description:** Create a new supplier. If `google_place_id` is provided, address fields are auto-filled from Google Places API. If `category_ids` are provided, categories are assigned in the same transaction.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | **Yes** | 1–200 chars | Business name (unique per tenant, case-insensitive) |
| `legal_name` | string | No | Max 200 chars | Legal entity name |
| `website` | string | No | Max 500 chars | Supplier website URL |
| `phone` | string | No | Max 20 chars | Primary phone number |
| `email` | string | No | Valid email | Primary email address |
| `contact_name` | string | No | Max 150 chars | Primary contact person name |
| `address_line1` | string | No | Max 255 chars | Street address line 1 |
| `address_line2` | string | No | Max 255 chars | Address line 2 (suite, unit) |
| `city` | string | No | Max 100 chars | City |
| `state` | string | No | Exactly 2 uppercase letters (`^[A-Z]{2}$`) | US state code |
| `zip_code` | string | No | Regex: `^\d{5}(-\d{4})?$` | ZIP code (5 or 9 digits) |
| `country` | string | No | Exactly 2 chars | ISO country code (default: `US`) |
| `latitude` | number | No | -90 to 90 | Latitude for map display |
| `longitude` | number | No | -180 to 180 | Longitude for map display |
| `google_place_id` | string | No | Max 255 chars | Google Place ID — triggers address auto-fill |
| `notes` | string | No | — | Internal notes |
| `is_preferred` | boolean | No | — | Mark as preferred supplier (default: `false`) |
| `category_ids` | string[] | No | Array of UUIDs (v4) | Supplier category UUIDs to assign |

**Example Request (minimal):**

```bash
curl -X POST https://api.lead360.app/api/v1/financial/suppliers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Supplier Co"}'
```

**Example Request (full):**

```bash
curl -X POST https://api.lead360.app/api/v1/financial/suppliers \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Building Supply",
    "phone": "5551234567",
    "email": "orders@abc.com",
    "contact_name": "John Smith",
    "address_line1": "123 Industrial Blvd",
    "city": "Houston",
    "state": "TX",
    "zip_code": "77001",
    "notes": "Net 30 terms",
    "is_preferred": true,
    "category_ids": ["550e8400-e29b-41d4-a716-446655440000"]
  }'
```

**Response 201:**

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "ABC Building Supply",
  "legal_name": null,
  "website": null,
  "phone": "5551234567",
  "email": "orders@abc.com",
  "contact_name": "John Smith",
  "address_line1": "123 Industrial Blvd",
  "address_line2": null,
  "city": "Houston",
  "state": "TX",
  "zip_code": "77001",
  "country": "US",
  "latitude": null,
  "longitude": null,
  "google_place_id": null,
  "notes": "Net 30 terms",
  "is_preferred": true,
  "is_active": true,
  "total_spend": "0",
  "last_purchase_date": null,
  "created_by_user_id": "uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-19T04:44:00.000Z",
  "updated_at": "2026-03-19T04:44:00.000Z",
  "categories": [
    {
      "id": "uuid",
      "name": "Roofing Materials",
      "color": "#3B82F6"
    }
  ],
  "products": [],
  "created_by": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Errors:**
- `400` — Validation error or invalid category IDs (`"One or more category IDs are invalid or do not belong to this tenant."`)
- `401` — Unauthorized
- `403` — Forbidden
- `409` — Supplier name already exists (`"Supplier \"<name>\" already exists for this tenant."`)
- `422` — Google Places address resolution failed

---

### GET /financial/suppliers/map

**Description:** Get all active suppliers that have latitude and longitude coordinates, formatted for map rendering.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Response 200:**

```json
[
  {
    "id": "uuid",
    "name": "ABC Building Supply",
    "latitude": "29.76040000",
    "longitude": "-95.36980000",
    "city": "Houston",
    "state": "TX",
    "is_preferred": true,
    "total_spend": "5000.00",
    "categories": [
      {
        "id": "uuid",
        "name": "Roofing Materials",
        "color": "#3B82F6"
      }
    ]
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Supplier identifier |
| `name` | string | Business name |
| `latitude` | string (decimal) | Latitude coordinate |
| `longitude` | string (decimal) | Longitude coordinate |
| `city` | string \| null | City |
| `state` | string \| null | State code |
| `is_preferred` | boolean | Preferred supplier flag |
| `total_spend` | string (decimal) | Total spend amount |
| `categories` | array | Assigned categories (`{id, name, color}`) |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden

---

### GET /financial/suppliers/:id

**Description:** Get a single supplier with full details including assigned categories and active products.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier ID |

**Response 200:**

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "ABC Building Supply",
  "legal_name": "ABC Building Supply LLC",
  "website": "https://www.abcbuildingsupply.com",
  "phone": "5551234567",
  "email": "orders@abc.com",
  "contact_name": "John Smith",
  "address_line1": "123 Industrial Blvd",
  "address_line2": null,
  "city": "Houston",
  "state": "TX",
  "zip_code": "77001",
  "country": "US",
  "latitude": "29.76040000",
  "longitude": "-95.36980000",
  "google_place_id": null,
  "notes": "Net 30 terms",
  "is_preferred": true,
  "is_active": true,
  "total_spend": "1250.00",
  "last_purchase_date": "2026-03-15T00:00:00.000Z",
  "created_by_user_id": "uuid",
  "updated_by_user_id": null,
  "created_at": "2026-03-19T04:00:00.000Z",
  "updated_at": "2026-03-19T04:00:00.000Z",
  "categories": [
    {
      "id": "uuid",
      "name": "Roofing Materials",
      "color": "#3B82F6"
    }
  ],
  "products": [
    {
      "id": "uuid",
      "name": "Crushed Stone",
      "unit_of_measure": "ton",
      "unit_price": "45.50",
      "price_last_updated_at": "2026-03-19T00:00:00.000Z",
      "is_active": true
    }
  ],
  "created_by": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier not found (`"Supplier not found."`)

---

### PATCH /financial/suppliers/:id

**Description:** Update a supplier (partial update). If `google_place_id` is provided, address fields are re-resolved from Google Places. If `category_ids` is provided, existing category assignments are replaced with the new list.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier ID |

**Request Body:** All fields from `POST /financial/suppliers` are accepted (all optional), plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_active` | boolean | No | Active status — deactivating hides from supplier picker but preserves historical references |

**Example Request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/financial/suppliers/<id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Updated notes", "is_preferred": true}'
```

**Response 200:** Returns the full updated supplier object (same shape as GET single supplier, including `categories`, `products`, and `created_by`).

**Errors:**
- `400` — Validation error or invalid category IDs
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier not found
- `409` — Supplier name already exists for this tenant

---

### DELETE /financial/suppliers/:id

**Description:** Soft-delete a supplier by setting `is_active = false`. The supplier record is preserved for historical reference but will no longer appear in default list queries.

**Roles:** Owner, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier ID |

**Example Request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/financial/suppliers/<id> \
  -H "Authorization: Bearer <token>"
```

**Response 200:** Returns the updated supplier object with `is_active: false`.

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden (requires Owner or Admin)
- `404` — Supplier not found

---

### GET /financial/suppliers/:id/statistics

**Description:** Get spend statistics for a supplier, including total spend, transaction count, spend breakdown by financial category, and monthly spend trend.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Supplier ID |

**Response 200:**

```json
{
  "supplier_id": "uuid",
  "total_spend": 1250.00,
  "transaction_count": 5,
  "first_purchase_date": "2026-01-15T00:00:00.000Z",
  "last_purchase_date": "2026-03-15T00:00:00.000Z",
  "spend_by_category": [
    {
      "category_name": "Materials - General",
      "total_spend": 800.00
    }
  ],
  "spend_by_month": [
    {
      "year": 2026,
      "month": 3,
      "total_spend": "250.00"
    }
  ]
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `supplier_id` | string (UUID) | Supplier identifier |
| `total_spend` | number \| Decimal | Sum of all financial entries linked to this supplier (0 if none) |
| `transaction_count` | number | Count of financial entries |
| `first_purchase_date` | string (ISO date) \| null | Earliest entry date |
| `last_purchase_date` | string (ISO date) \| null | Most recent entry date |
| `spend_by_category` | array | Spend breakdown by financial entry category |
| `spend_by_category[].category_name` | string | Financial category name (or "Unknown") |
| `spend_by_category[].total_spend` | number \| Decimal | Sum of entries in this category |
| `spend_by_month` | array | Monthly spend trend (last 12 months, from raw SQL) |
| `spend_by_month[].year` | number | Year (e.g., 2026) |
| `spend_by_month[].month` | number | Month number (1–12) |
| `spend_by_month[].total_spend` | string (decimal) | Sum of entries in this month |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier not found

---

## Supplier Products

### GET /financial/suppliers/:supplierId/products

**Description:** List all products for a supplier. Defaults to active products only.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplierId` | UUID | Supplier ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `is_active` | boolean | No | `true` | Filter by active status. Pass `false` to include deactivated products. |

**Response 200:**

```json
[
  {
    "id": "uuid",
    "name": "Crushed Stone",
    "description": "#57 crushed limestone",
    "unit_of_measure": "ton",
    "unit_price": "45.50",
    "price_last_updated_at": "2026-03-19T00:00:00.000Z",
    "sku": "CS-57",
    "is_active": true,
    "created_at": "2026-03-19T04:00:00.000Z"
  }
]
```

> **Note:** The list response returns a subset of product fields. The full product object (including `tenant_id`, `supplier_id`, `created_by_user_id`, `updated_at`) is returned by POST and PATCH operations.

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Product unique identifier |
| `name` | string | Product or service name |
| `description` | string \| null | Optional product description |
| `unit_of_measure` | string | Unit of measure for pricing (e.g., `ton`, `each`, `sqft`) |
| `unit_price` | string (decimal) \| null | Current price per unit (4 decimal places) |
| `price_last_updated_at` | string (ISO date) \| null | Date the price was last changed |
| `sku` | string \| null | Supplier's product code or SKU |
| `is_active` | boolean | Whether the product is active |
| `created_at` | string (ISO 8601) | Creation timestamp |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier not found

---

### POST /financial/suppliers/:supplierId/products

**Description:** Add a product to a supplier. If `unit_price` is provided, an initial price history record is automatically created with `previous_price: null`.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplierId` | UUID | Supplier ID |

**Request Body:**

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | **Yes** | 1–200 chars | Product name (unique per supplier, case-insensitive) |
| `description` | string | No | — | Optional product description |
| `unit_of_measure` | string | **Yes** | 1–50 chars | Unit of measure (e.g., `ton`, `each`, `sqft`) |
| `unit_price` | number | No | Min: 0, max 4 decimal places | Current price per unit |
| `sku` | string | No | Max 100 chars | Supplier's product code or SKU |

**Example Request:**

```bash
curl -X POST https://api.lead360.app/api/v1/financial/suppliers/<supplierId>/products \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Crushed Stone",
    "unit_of_measure": "ton",
    "unit_price": 45.50,
    "sku": "CS-57"
  }'
```

**Response 201:** Returns the full created product object (all fields including `tenant_id`, `supplier_id`, `created_by_user_id`, `price_last_updated_by_user_id`, `updated_at`).

**Business Rule:** When `unit_price` is provided, a `supplier_product_price_history` record is automatically created:
```json
{
  "previous_price": null,
  "new_price": 45.50,
  "changed_by_user_id": "<actor>",
  "changed_at": "<now>"
}
```

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier not found (`"Supplier not found."`)
- `409` — Product name already exists for this supplier (`"Product \"<name>\" already exists for this supplier."`)

---

### PATCH /financial/suppliers/:supplierId/products/:productId

**Description:** Update a supplier product (partial update). If `unit_price` is changed, a price history record is automatically created tracking the old and new price.

**Roles:** Owner, Admin, Manager, Bookkeeper

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplierId` | UUID | Supplier ID |
| `productId` | UUID | Product ID |

**Request Body:** All fields from `POST` are accepted (all optional), plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_active` | boolean | No | Active status — deactivating hides from product list but preserves historical references |

**Example Request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/financial/suppliers/<supplierId>/products/<productId> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"unit_price": 52.00}'
```

**Response 200:** Returns the updated product object with `unit_price: "52"` and `price_last_updated_at` set.

**Business Rule:** When `unit_price` changes from the current value, the following happens automatically:
1. A `supplier_product_price_history` record is created with `previous_price` and `new_price`
2. `price_last_updated_at` is set to the current date
3. `price_last_updated_by_user_id` is set to the authenticated user

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier or product not found
- `409` — Product name already exists for this supplier

---

### DELETE /financial/suppliers/:supplierId/products/:productId

**Description:** Soft-delete a supplier product by setting `is_active = false`. The product record is preserved for historical reference.

**Roles:** Owner, Admin

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplierId` | UUID | Supplier ID |
| `productId` | UUID | Product ID |

**Example Request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/financial/suppliers/<supplierId>/products/<productId> \
  -H "Authorization: Bearer <token>"
```

**Response 200:** Returns the updated product object with `is_active: false`.

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden (requires Owner or Admin)
- `404` — Supplier or product not found

---

### GET /financial/suppliers/:supplierId/products/:productId/price-history

**Description:** Get the price change history for a product, ordered by most recent change first.

**Roles:** Owner, Admin, Manager, Sales, Employee

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `supplierId` | UUID | Supplier ID |
| `productId` | UUID | Product ID |

**Response 200:**

```json
[
  {
    "id": "uuid",
    "previous_price": "45.50",
    "new_price": "52.00",
    "changed_at": "2026-03-19T04:47:50.362Z",
    "changed_by": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe"
    },
    "notes": null
  },
  {
    "id": "uuid",
    "previous_price": null,
    "new_price": "45.50",
    "changed_at": "2026-03-19T04:47:50.273Z",
    "changed_by": {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe"
    },
    "notes": "Initial price set on product creation"
  }
]
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Price history record ID |
| `previous_price` | string (decimal) \| null | Price before the change (`null` for initial record) |
| `new_price` | string (decimal) | Price after the change |
| `changed_at` | string (ISO 8601) | Timestamp of the price change |
| `changed_by` | object | User who made the change |
| `changed_by.id` | string (UUID) | User ID |
| `changed_by.first_name` | string | User first name |
| `changed_by.last_name` | string | User last name |
| `notes` | string \| null | Optional notes about the price change |

**Errors:**
- `401` — Unauthorized
- `403` — Forbidden
- `404` — Supplier or product not found

---

## Pagination Format

Paginated endpoints return data in this format:

```json
{
  "data": [ ... ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "pages": 2
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | array | Array of resource objects |
| `meta.total` | number | Total number of matching records |
| `meta.page` | number | Current page number |
| `meta.limit` | number | Items per page |
| `meta.pages` | number | Total number of pages |

**Currently paginated endpoints:**
- `GET /financial/suppliers`

**Array-response endpoints (no pagination):**
- `GET /financial/supplier-categories`
- `GET /financial/suppliers/map`
- `GET /financial/suppliers/:supplierId/products`
- `GET /financial/suppliers/:supplierId/products/:productId/price-history`

---

## Business Rules

### Supplier Categories
1. Category names are **unique per tenant** (case-insensitive comparison)
2. Maximum **50 active categories** per tenant
3. Deactivating a category preserves existing supplier assignments
4. Deleting a category is **blocked** if it is assigned to one or more suppliers — deactivate instead
5. Reactivating a category counts toward the 50-category limit

### Suppliers
1. Supplier names are **unique per tenant** (case-insensitive comparison)
2. Only `name` is required — all address and contact fields are optional
3. If `google_place_id` is provided, address fields are resolved via Google Places API
4. `total_spend` and `last_purchase_date` are automatically maintained when financial entries are created, updated, or deleted with a `supplier_id`
5. `DELETE` performs a **soft delete** (`is_active = false`) — the supplier remains in the database for historical references
6. Default list query filters to `is_active = true` only
7. Map endpoint returns only suppliers with both `latitude` and `longitude` set

### Supplier Products
1. Product names are **unique per supplier** (case-insensitive comparison)
2. When a product is created with `unit_price`, an initial price history record is auto-created
3. When `unit_price` is updated to a different value, a new price history record is auto-created
4. Price history records are ordered by `changed_at DESC` (most recent first)
5. `DELETE` performs a **soft delete** (`is_active = false`)
6. Default list query filters to `is_active = true` only

### Financial Entry Integration
1. `financial_entry.supplier_id` is an optional foreign key to the `supplier` table
2. Creating a financial entry with `supplier_id` updates `supplier.total_spend` and `supplier.last_purchase_date`
3. Deleting a financial entry with `supplier_id` recalculates and decrements `supplier.total_spend`
4. Updating a financial entry's `supplier_id` or `amount` triggers spend recalculation for both old and new suppliers
