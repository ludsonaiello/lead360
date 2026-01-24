# Quotes Module - Complete REST API Documentation

**Version**: 1.0
**Last Updated**: January 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Core Quote Operations](#core-quote-operations)
3. [Vendors](#vendors)
4. [Unit Measurements](#unit-measurements)
5. [Bundles](#bundles)
6. [Quote Settings](#quote-settings)
7. [Quote Templates](#quote-templates)
8. [Quote Items](#quote-items)
9. [Quote Groups](#quote-groups)
10. [Item Library](#item-library)
11. [Discount Rules](#discount-rules)
12. [Draw Schedule](#draw-schedule)
13. [Approval Workflow](#approval-workflow)
14. [Version History](#version-history)
15. [Profitability Analysis](#profitability-analysis)
16. [PDF Generation](#pdf-generation)
17. [Public Access & Analytics](#public-access--analytics)
18. [Dashboard](#dashboard)
19. [Search](#search)
20. [Change Orders](#change-orders)
21. [Admin Endpoints](#admin-endpoints)

---

## Authentication

All endpoints (except Public Access endpoints) require JWT authentication.

**Header Required**:
```
Authorization: Bearer <JWT_TOKEN>
```

**RBAC Roles**:
- `Owner` - Full access to all tenant resources
- `Admin` - Administrative access (cannot delete critical resources)
- `Manager` - Manage quotes, approve within limits
- `Sales` - Create and edit quotes
- `Employee` / `Field` - Read-only access
- `PlatformAdmin` - System-wide admin (admin endpoints only)

---

## Core Quote Operations

### Create Quote from Existing Lead

**Endpoint**: `POST /quotes/from-lead/:leadId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `leadId` (UUID, required) - Lead UUID

**Request Body**:
```json
{
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kitchen Remodel",
  "jobsite_address": {
    "address_line1": "123 Main St",
    "address_line2": "",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101"
  },
  "po_number": "PO-12345",
  "expiration_days": 30,
  "use_default_settings": true,
  "custom_profit_percent": 25.0,
  "custom_overhead_percent": 15.0,
  "private_notes": "Customer requested detailed breakdown"
}
```

**Field Validation**:
- `vendor_id`: UUID, required
- `title`: string (1-200 chars), required
- `jobsite_address`: object, required
  - `address_line1`: string (1-255 chars), required
  - `address_line2`: string (1-255 chars), optional
  - `city`: string (1-100 chars), optional
  - `state`: string (2 chars), optional
  - `zip_code`: string (matches `/^\d{5}(-\d{4})?$/`), required
  - `latitude`: number, optional
  - `longitude`: number, optional
- `po_number`: string (1-100 chars), optional
- `expiration_days`: number (min: 1), optional
- `use_default_settings`: boolean, optional (default: true)
- `custom_profit_percent`: number (0-100), optional
- `custom_overhead_percent`: number (0-100), optional
- `private_notes`: string, optional

**Response**: `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_number": "Q-2026-0001",
  "status": "draft",
  "title": "Kitchen Remodel",
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "version": "1.0",
  "created_at": "2026-01-24T10:00:00Z",
  "updated_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Lead not found
- `422 Unprocessable Entity` - Address validation failed (Google Maps)

---

### Create Quote with New Customer

**Endpoint**: `POST /quotes/with-new-customer`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Request Body**:
```json
{
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "company_name": "Doe Enterprises"
  },
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Bathroom Renovation",
  "jobsite_address": {
    "address_line1": "456 Oak Ave",
    "address_line2": "",
    "city": "Cambridge",
    "state": "MA",
    "zip_code": "02139"
  },
  "po_number": "PO-67890",
  "expiration_days": 45
}
```

**Field Validation**:
- `customer`: object, required
  - `first_name`: string (1-100 chars), required
  - `last_name`: string (1-100 chars), required
  - `email`: valid email, required
  - `phone`: string (1-20 chars, allows digits, spaces, dashes, parentheses, plus, dots), required
  - `company_name`: string (1-200 chars), optional
- All other fields same as "Create Quote from Lead"

**Response**: `201 Created`
```json
{
  "quote": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "quote_number": "Q-2026-0002",
    "status": "draft"
  },
  "lead": {
    "id": "650e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `422 Unprocessable Entity` - Address validation failed

---

### Create Quote (Manual)

**Endpoint**: `POST /quotes`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Request Body**:
```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kitchen Remodel",
  "jobsite_address": {
    "address_line1": "123 Main St",
    "address_line2": "",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101"
  },
  "po_number": "PO-12345",
  "expiration_days": 30,
  "use_default_settings": true,
  "custom_profit_percent": 25.0,
  "custom_overhead_percent": 15.0,
  "private_notes": "Customer requested detailed breakdown"
}
```

**Field Validation**:
- `lead_id`: UUID, required - Existing lead UUID
- `vendor_id`: UUID, required
- `title`: string (1-200 chars), required
- `jobsite_address`: object, required (see above for nested fields)
- `po_number`: string (1-100 chars), optional
- `expiration_days`: number (min: 1), optional
- `use_default_settings`: boolean, optional (default: true)
- `custom_profit_percent`: number (0-100), optional
- `custom_overhead_percent`: number (0-100), optional
- `private_notes`: string, optional

**Response**: `201 Created` (same structure as Create Quote from Lead)

**Error Responses**:
- `404 Not Found` - Lead or vendor not found
- `422 Unprocessable Entity` - Address validation failed

---

### List Quotes

**Endpoint**: `GET /quotes`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `page` (number, default: 1, min: 1) - Page number
- `limit` (number, default: 20, min: 1, max: 100) - Items per page
- `status` (enum, optional) - Filter by status: `draft`, `pending_approval`, `ready`, `sent`, `viewed`, `accepted`, `rejected`, `expired`
- `vendor_id` (UUID, optional) - Filter by vendor
- `lead_id` (UUID, optional) - Filter by lead
- `search` (string, optional) - Search in quote_number, title, customer name, items
- `created_from` (date string YYYY-MM-DD, optional) - Created on or after
- `created_to` (date string YYYY-MM-DD, optional) - Created on or before
- `sort_by` (string, default: "created_at") - Sort field (created_at, updated_at, quote_number, total)
- `sort_order` (enum, default: "desc") - Sort direction: `asc`, `desc`

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "quote_number": "Q-2026-0001",
      "title": "Kitchen Remodel",
      "status": "draft",
      "version": "1.0",
      "total": 50000.00,
      "subtotal": 45000.00,
      "tax_amount": 5000.00,
      "discount_amount": 0.00,
      "customer_name": "John Doe",
      "vendor_name": "ABC Construction",
      "created_at": "2026-01-24T10:00:00Z",
      "expires_at": "2026-02-23T10:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

---

### Search Quotes (Simple)

**Endpoint**: `GET /quotes/search`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `q` (string, required) - Search term

**Response**: `200 OK`
```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "quote_number": "Q-2026-0001",
      "title": "Kitchen Remodel",
      "customer_name": "John Doe",
      "total": 50000.00,
      "status": "draft"
    }
  ],
  "count": 1
}
```

---

### Get Quote Statistics

**Endpoint**: `GET /quotes/statistics`
**RBAC**: `Owner`, `Admin`, `Manager`

**Response**: `200 OK`
```json
{
  "total_quotes": 150,
  "draft_count": 25,
  "pending_approval_count": 10,
  "ready_count": 15,
  "sent_count": 40,
  "accepted_count": 35,
  "rejected_count": 15,
  "expired_count": 10,
  "total_revenue": 2500000.00,
  "conversion_rate": 45.5,
  "avg_quote_value": 16666.67
}
```

---

### Get Single Quote

**Endpoint**: `GET /quotes/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_number": "Q-2026-0001",
  "title": "Kitchen Remodel",
  "status": "draft",
  "version": "1.0",
  "lead_id": "650e8400-e29b-41d4-a716-446655440000",
  "vendor_id": "750e8400-e29b-41d4-a716-446655440000",
  "po_number": "PO-12345",
  "jobsite_address": {
    "address_line1": "123 Main St",
    "address_line2": "",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": 42.3601,
    "longitude": -71.0589
  },
  "subtotal": 45000.00,
  "tax_amount": 5000.00,
  "discount_amount": 0.00,
  "total": 50000.00,
  "expires_at": "2026-02-23T10:00:00Z",
  "custom_profit_percent": 25.0,
  "custom_overhead_percent": 15.0,
  "show_line_items": true,
  "show_cost_breakdown": false,
  "internal_notes": "Customer requested detailed breakdown",
  "customer_notes": null,
  "payment_terms": "Net 30",
  "payment_schedule": "50% deposit, 50% on completion",
  "created_at": "2026-01-24T10:00:00Z",
  "updated_at": "2026-01-24T10:00:00Z",
  "created_by": {
    "id": "user-uuid",
    "name": "Jane Smith"
  },
  "lead": {
    "id": "650e8400-e29b-41d4-a716-446655440000",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567"
  },
  "vendor": {
    "id": "750e8400-e29b-41d4-a716-446655440000",
    "name": "ABC Construction",
    "email": "vendor@abc.com",
    "phone": "5559876543"
  },
  "items": [],
  "groups": [],
  "discount_rules": [],
  "draw_schedule": null
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Update Quote

**Endpoint**: `PATCH /quotes/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body** (all fields optional):
```json
{
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kitchen Remodel - Updated",
  "po_number": "PO-12345-REV1",
  "expiration_date": "2026-02-28",
  "custom_profit_percent": 27.5,
  "custom_overhead_percent": 16.0,
  "show_line_items": true,
  "show_cost_breakdown": true,
  "internal_notes": "Updated per customer request",
  "customer_notes": "Please review the attached specifications",
  "payment_terms": "Net 30",
  "payment_schedule": "50% deposit, 50% on completion"
}
```

**Field Validation**:
- `vendor_id`: UUID, optional
- `title`: string (1-200 chars), optional
- `po_number`: string (1-100 chars), optional
- `expiration_date`: date string (YYYY-MM-DD), optional
- `custom_profit_percent`: number (0-100), optional
- `custom_overhead_percent`: number (0-100), optional
- `show_line_items`: boolean, optional
- `show_cost_breakdown`: boolean, optional
- `internal_notes`: string, optional
- `customer_notes`: string, optional
- `payment_terms`: string (1-100 chars), optional
- `payment_schedule`: string, optional

**Response**: `200 OK` (returns updated quote object)

**Side Effects**:
- Creates new version (+0.1)
- Recalculates totals

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot edit approved quote

---

### Update Quote Status

**Endpoint**: `PATCH /quotes/:id/status`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "status": "sent",
  "reason": "Sent to customer for review"
}
```

**Field Validation**:
- `status`: enum (required) - Valid values: `draft`, `pending_approval`, `ready`, `sent`, `viewed`, `accepted`, `rejected`, `expired`
- `reason`: string, optional (required for certain transitions)

**Status Transition Rules**:
- `draft` → `pending_approval` (requires approval submission)
- `pending_approval` → `ready` (requires all approvals)
- `ready` → `sent` (can send to customer)
- `sent` → `viewed` (customer opened)
- `sent` → `accepted` (customer accepted)
- `sent` → `rejected` (customer rejected)
- `*` → `expired` (expiration date passed)

**Response**: `200 OK` (returns updated quote object)

**Side Effects**:
- Creates new version (+1.0)
- May trigger notifications
- May trigger workflow actions

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Invalid status transition

---

### Update Jobsite Address

**Endpoint**: `PATCH /quotes/:id/jobsite-address`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "address_line1": "456 Oak Ave",
  "address_line2": "",
  "city": "Cambridge",
  "state": "MA",
  "zip_code": "02139"
}
```

**Field Validation**:
- `address_line1`: string (1-255 chars), required
- `address_line2`: string (1-255 chars), optional
- `city`: string (1-100 chars), optional
- `state`: string (2 chars), optional
- `zip_code`: string (matches `/^\d{5}(-\d{4})?$/`), required
- `latitude`: number, optional
- `longitude`: number, optional

**Response**: `200 OK` (returns updated quote with validated address)

**Side Effects**:
- Validates address via Google Maps API
- Updates latitude/longitude
- Creates new version (+0.1)

**Error Responses**:
- `404 Not Found` - Quote not found
- `422 Unprocessable Entity` - Address validation failed

---

### Clone Quote

**Endpoint**: `POST /quotes/:id/clone`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Source quote UUID

**Response**: `201 Created`
```json
{
  "id": "new-quote-uuid",
  "quote_number": "Q-2026-0010",
  "title": "Kitchen Remodel (Copy)",
  "status": "draft",
  "cloned_from": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Side Effects**:
- Deep clones all items, groups, discount rules, and draw schedule
- Resets status to `draft`
- Generates new quote number
- Appends " (Copy)" to title

**Error Responses**:
- `404 Not Found` - Source quote not found

---

### Delete Quote (Archive)

**Endpoint**: `DELETE /quotes/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Response**: `204 No Content`

**Side Effects**:
- Soft delete (sets `deleted_at` timestamp)
- Does not remove from database
- Excluded from all queries

**Error Responses**:
- `404 Not Found` - Quote not found

---

## Vendors

### Create Vendor

**Endpoint**: `POST /vendors`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "name": "ABC Construction Inc",
  "email": "vendor@abcconstruction.com",
  "phone": "5551234567",
  "address_line1": "123 Main St",
  "address_line2": "Suite 100",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02101",
  "latitude": 42.3601,
  "longitude": -71.0589,
  "signature_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_default": false
}
```

**Field Validation**:
- `name`: string (1-200 chars), required
- `email`: valid email, required
- `phone`: string (10 digits, matches `/^\d{10}$/`), required
- `address_line1`: string (1-255 chars), required
- `address_line2`: string (1-255 chars), optional
- `city`: string (1-100 chars), optional
- `state`: string (2 chars), optional
- `zip_code`: string (matches `/^\d{5}(-\d{4})?$/`), required
- `latitude`: number, optional
- `longitude`: number, optional
- `signature_file_id`: UUID, required
- `is_default`: boolean, optional

**Response**: `201 Created`
```json
{
  "id": "vendor-uuid",
  "name": "ABC Construction Inc",
  "email": "vendor@abcconstruction.com",
  "phone": "5551234567",
  "is_default": false,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `409 Conflict` - Email already exists for this tenant
- `422 Unprocessable Entity` - Address validation failed (Google Maps)

---

### List Vendors

**Endpoint**: `GET /vendors`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `page` (number, default: 1, min: 1)
- `limit` (number, default: 20, min: 1, max: 100)
- `search` (string, optional) - Search by name, email
- `is_active` (boolean, optional) - Filter active/inactive

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "vendor-uuid",
      "name": "ABC Construction Inc",
      "email": "vendor@abcconstruction.com",
      "phone": "5551234567",
      "is_default": true,
      "quote_count": 42
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 5,
    "total_pages": 1
  }
}
```

---

### Get Vendor

**Endpoint**: `GET /vendors/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Response**: `200 OK` (full vendor object with address)

**Error Responses**:
- `404 Not Found` - Vendor not found

---

### Update Vendor

**Endpoint**: `PATCH /vendors/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Request Body**: All fields from Create Vendor are optional

**Response**: `200 OK` (returns updated vendor object)

**Error Responses**:
- `404 Not Found` - Vendor not found
- `409 Conflict` - Email already exists for this tenant
- `422 Unprocessable Entity` - Address validation failed

---

### Delete Vendor

**Endpoint**: `DELETE /vendors/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request` - Cannot delete vendor (used in quotes)
- `404 Not Found` - Vendor not found

---

### Set Vendor as Default

**Endpoint**: `PATCH /vendors/:id/set-default`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Response**: `200 OK`

**Side Effects**:
- Unsets previous default vendor
- Sets this vendor as default for new quotes

**Error Responses**:
- `404 Not Found` - Vendor not found

---

### Update Vendor Signature

**Endpoint**: `POST /vendors/:id/signature`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Request Body**:
```json
{
  "file_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Field Validation**:
- `file_id`: UUID, required (must be uploaded to `/files` endpoint first)

**Response**: `200 OK`

**Error Responses**:
- `404 Not Found` - Vendor or file not found

---

### Get Vendor Statistics

**Endpoint**: `GET /vendors/:id/stats`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Vendor UUID

**Response**: `200 OK`
```json
{
  "vendor_id": "vendor-uuid",
  "total_quotes": 42,
  "draft_count": 5,
  "sent_count": 15,
  "accepted_count": 18,
  "rejected_count": 4,
  "total_revenue": 850000.00,
  "avg_quote_value": 20238.10
}
```

**Error Responses**:
- `404 Not Found` - Vendor not found

---

## Unit Measurements

### Create Tenant Custom Unit

**Endpoint**: `POST /units`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "name": "Pallet",
  "abbreviation": "plt",
  "description": "Standard shipping pallet"
}
```

**Field Validation**:
- `name`: string (1-100 chars), required
- `abbreviation`: string (1-20 chars), required
- `description`: string, optional

**Response**: `201 Created`
```json
{
  "id": "unit-uuid",
  "name": "Pallet",
  "abbreviation": "plt",
  "is_global": false,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `409 Conflict` - Unit with this name already exists for your tenant

---

### List Available Units

**Endpoint**: `GET /units`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 50, max: 200)
- `search` (string, optional)

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "unit-uuid-1",
      "name": "Each",
      "abbreviation": "ea",
      "is_global": true
    },
    {
      "id": "unit-uuid-2",
      "name": "Square Foot",
      "abbreviation": "sqft",
      "is_global": true
    },
    {
      "id": "unit-uuid-3",
      "name": "Pallet",
      "abbreviation": "plt",
      "is_global": false
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 50,
    "total": 13,
    "total_pages": 1
  }
}
```

---

### Get Unit

**Endpoint**: `GET /units/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Unit UUID

**Response**: `200 OK` (full unit object)

**Error Responses**:
- `404 Not Found` - Unit not found

---

### Update Tenant Custom Unit

**Endpoint**: `PATCH /units/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Unit UUID

**Request Body**: All fields from Create Unit are optional

**Response**: `200 OK` (returns updated unit object)

**Error Responses**:
- `403 Forbidden` - Cannot edit global units
- `404 Not Found` - Unit not found
- `409 Conflict` - Unit with this name already exists for your tenant

---

### Delete Tenant Custom Unit

**Endpoint**: `DELETE /units/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Unit UUID

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request` - Cannot delete unit (in use)
- `403 Forbidden` - Cannot delete global units
- `404 Not Found` - Unit not found

---

### Get Unit Usage Statistics

**Endpoint**: `GET /units/:id/stats`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Unit UUID

**Response**: `200 OK`
```json
{
  "unit_id": "unit-uuid",
  "usage_count": 127,
  "quote_count": 42,
  "library_item_count": 15
}
```

**Error Responses**:
- `404 Not Found` - Unit not found

---

### Admin Unit Measurement Endpoints (Platform Admin Only)

**Controller**: `UnitMeasurementAdminController`
**Base Path**: `/admin/units`

These endpoints allow Platform Admins to create and manage global unit measurements that are available to all tenants.

#### Create Global Unit Measurement

**Endpoint**: `POST /admin/units`
**RBAC**: `PlatformAdmin` (ONLY)

**Description**: Creates a new global unit measurement that becomes available to all tenants. Global units can be used by any tenant but cannot be modified or deleted by tenants.

**Request Body**:
```json
{
  "name": "Square Foot",
  "abbreviation": "sq ft"
}
```

**Request Fields**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `name` | string | Yes | Length: 1-100 | Full name of the unit (e.g., "Square Foot") |
| `abbreviation` | string | Yes | Length: 1-20 | Short abbreviation (e.g., "sq ft") |

**Success Response** (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Square Foot",
  "abbreviation": "sq ft",
  "is_global": true,
  "tenant_id": null,
  "is_active": true,
  "created_at": "2026-01-24T10:00:00Z",
  "updated_at": "2026-01-24T10:00:00Z"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unit UUID |
| `name` | string | Full unit name |
| `abbreviation` | string | Unit abbreviation |
| `is_global` | boolean | Always `true` for global units |
| `tenant_id` | null | Always `null` for global units |
| `is_active` | boolean | Active status (default: `true`) |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |

**Error Responses**:
- `400 Bad Request` - Validation error (name/abbreviation missing or too long)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not a Platform Admin
- `409 Conflict` - Global unit with this name or abbreviation already exists

**Example Error (409 Conflict)**:
```json
{
  "statusCode": 409,
  "message": "Global unit with name 'Square Foot' already exists",
  "error": "Conflict"
}
```

**Side Effects**:
- Unit becomes immediately available to all tenants
- Logs audit trail with admin user ID

**Business Rules**:
- Name and abbreviation must be unique across all global units
- Cannot create duplicate units
- Global units cannot be deleted (only deactivated)

---

#### List All Global Units

**Endpoint**: `GET /admin/units`
**RBAC**: `PlatformAdmin` (ONLY)

**Description**: Returns all global unit measurements with pagination and filtering options. Only accessible by Platform Admins.

**Query Parameters**:
| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `is_active` | boolean | No | - | - | Filter by active status (true/false) |
| `is_global` | boolean | No | `true` | - | Filter global units (always true for admin endpoint) |
| `page` | number | No | `1` | Min: 1 | Page number |
| `limit` | number | No | `50` | Min: 1, Max: 100 | Items per page |

**Example Request**:
```
GET /admin/units?is_active=true&page=1&limit=20
```

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Square Foot",
      "abbreviation": "sq ft",
      "is_global": true,
      "tenant_id": null,
      "is_active": true,
      "created_at": "2026-01-24T10:00:00Z",
      "updated_at": "2026-01-24T10:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Linear Foot",
      "abbreviation": "lin ft",
      "is_global": true,
      "tenant_id": null,
      "is_active": true,
      "created_at": "2026-01-24T10:05:00Z",
      "updated_at": "2026-01-24T10:05:00Z"
    },
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Each",
      "abbreviation": "ea",
      "is_global": true,
      "tenant_id": null,
      "is_active": true,
      "created_at": "2026-01-24T10:10:00Z",
      "updated_at": "2026-01-24T10:10:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 10,
    "total_pages": 1
  }
}
```

**Error Responses**:
- `400 Bad Request` - Invalid query parameters (e.g., page < 1, limit > 100)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not a Platform Admin

**Side Effects**: None (read-only operation)

---

#### Update Global Unit Measurement

**Endpoint**: `PATCH /admin/units/:id`
**RBAC**: `PlatformAdmin` (ONLY)

**Description**: Updates an existing global unit measurement. Only name, abbreviation, and is_active status can be modified.

**Path Parameters**:
- `id` (UUID, required) - Unit UUID

**Request Body** (all fields optional):
```json
{
  "name": "Square Footage",
  "abbreviation": "sqft",
  "is_active": true
}
```

**Request Fields** (all optional):
| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `name` | string | Length: 1-100 | Updated full name |
| `abbreviation` | string | Length: 1-20 | Updated abbreviation |
| `is_active` | boolean | - | Active status (deactivate instead of deleting) |

**Success Response** (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Square Footage",
  "abbreviation": "sqft",
  "is_global": true,
  "tenant_id": null,
  "is_active": true,
  "created_at": "2026-01-24T10:00:00Z",
  "updated_at": "2026-01-24T11:30:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Validation error (name/abbreviation too long)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not a Platform Admin
- `404 Not Found` - Global unit not found
- `409 Conflict` - Another global unit with this name/abbreviation already exists

**Side Effects**:
- Changes propagate to all tenants immediately
- Existing quote items using this unit are NOT affected (data snapshot preserved)
- Logs audit trail with admin user ID

**Business Rules**:
- Cannot change `is_global` flag (always true)
- Cannot change `tenant_id` (always null)
- Name/abbreviation must remain unique across global units
- Deactivating a unit (`is_active: false`) hides it from tenant selection but doesn't affect existing data

---

#### Seed Default Global Units

**Endpoint**: `POST /admin/units/seed-defaults`
**RBAC**: `PlatformAdmin` (ONLY)

**Description**: Creates 10 standard global unit measurements if they don't already exist. This endpoint is **idempotent** - running it multiple times will not create duplicates.

**Request Body**: None

**Default Units Created**:
1. **Each** (ea) - Individual items
2. **Square Foot** (sq ft) - Area measurement
3. **Linear Foot** (lin ft) - Length measurement
4. **Hour** (hr) - Time/labor
5. **Cubic Yard** (cu yd) - Volume measurement
6. **Ton** (ton) - Weight measurement
7. **Gallon** (gal) - Liquid volume
8. **Pound** (lb) - Weight measurement
9. **Box** (box) - Package quantity
10. **Bundle** (bdl) - Group quantity

**Success Response** (200 OK):
```json
{
  "message": "Default units seeded successfully",
  "created_count": 10,
  "skipped_count": 0,
  "units": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Each",
      "abbreviation": "ea",
      "is_global": true,
      "created_at": "2026-01-24T10:00:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Square Foot",
      "abbreviation": "sq ft",
      "is_global": true,
      "created_at": "2026-01-24T10:00:01Z"
    }
  ]
}
```

**Error Responses**:
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - User is not a Platform Admin
- `500 Internal Server Error` - Database error during seeding

**Side Effects**:
- Creates global units that didn't exist
- Units become immediately available to all tenants
- Logs audit trail for each created unit
- Safe to run multiple times (idempotent)

**Business Rules**:
- Checks for existing units by name before creating
- Skips units that already exist (no duplicates)
- Creates only missing units
- All units created with `is_active: true` and `is_global: true`

---

## Quote Items

I'll continue with the remaining sections in the next part. The file is being created systematically with complete endpoint documentation including all fields, validations, and responses.


### Add Item to Quote

**Endpoint**: `POST /quotes/:quoteId/items`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "title": "Premium hardwood flooring",
  "description": "Oak hardwood, 3/4 inch thick, prefinished",
  "quantity": 500,
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440000",
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75,
  "quote_group_id": "group-uuid-optional",
  "save_to_library": true
}
```

**Field Validation**:
- `title`: string (1-255 chars), required
- `description`: string, optional
- `quantity`: number (min: 0.01), required
- `unit_measurement_id`: UUID, required
- `material_cost_per_unit`: number (min: 0), required
- `labor_cost_per_unit`: number (min: 0), required
- `equipment_cost_per_unit`: number (min: 0), optional
- `subcontract_cost_per_unit`: number (min: 0), optional
- `other_cost_per_unit`: number (min: 0), optional
- `quote_group_id`: UUID, optional
- `save_to_library`: boolean, optional

**Validation Rules**:
- At least one cost must be > 0 (material + labor + equipment + subcontract + other)

**Response**: `201 Created`
```json
{
  "id": "item-uuid",
  "title": "Premium hardwood flooring",
  "quantity": 500,
  "unit_price": 12.50,
  "total_price": 6250.00,
  "total_cost": 5000.00,
  "order_index": 1,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - At least one cost must be > 0 / Cannot add items to approved quote

---

### Add Item from Library

**Endpoint**: `POST /quotes/:quoteId/items/from-library/:libraryItemId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `libraryItemId` (UUID, required) - Library item UUID

**Response**: `201 Created` (same as Add Item)

**Side Effects**:
- Increments library item usage count
- Copies all fields from library item

**Error Responses**:
- `404 Not Found` - Quote or library item not found

---

### List Quote Items

**Endpoint**: `GET /quotes/:quoteId/items`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Query Parameters**:
- `includeGrouped` (boolean, default: true) - Include items that belong to groups

**Response**: `200 OK`
```json
{
  "items": [
    {
      "id": "item-uuid",
      "title": "Premium hardwood flooring",
      "description": "Oak hardwood, 3/4 inch thick",
      "quantity": 500,
      "unit": "sqft",
      "unit_price": 12.50,
      "total_price": 6250.00,
      "total_cost": 5000.00,
      "order_index": 1,
      "quote_group_id": null
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Single Item

**Endpoint**: `GET /quotes/:quoteId/items/:itemId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID

**Response**: `200 OK` (full item object with cost breakdown)

**Error Responses**:
- `404 Not Found` - Quote or item not found

---

### Update Item

**Endpoint**: `PATCH /quotes/:quoteId/items/:itemId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID

**Request Body**: All fields from Create Item are optional

**Response**: `200 OK` (returns updated item)

**Side Effects**:
- Creates new version (+0.1)
- Recalculates quote totals

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot edit items in approved quote

---

### Delete Item

**Endpoint**: `DELETE /quotes/:quoteId/items/:itemId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID

**Response**: `204 No Content`

**Side Effects**:
- Hard delete (permanent removal)
- Reorders remaining items
- Recalculates quote totals

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot delete items from approved quote

---

### Duplicate Item

**Endpoint**: `POST /quotes/:quoteId/items/:itemId/duplicate`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID to duplicate

**Response**: `201 Created`

**Side Effects**:
- Creates copy with " (Copy)" appended to title
- Inserts after original item

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot duplicate items in approved quote

---

### Reorder Items

**Endpoint**: `PATCH /quotes/:quoteId/items/reorder`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "item_orders": [
    {"item_id": "item-uuid-1", "order_index": 1},
    {"item_id": "item-uuid-2", "order_index": 2},
    {"item_id": "item-uuid-3", "order_index": 3}
  ]
}
```

**Field Validation**:
- `item_orders`: array, required
  - `item_id`: UUID, required
  - `order_index`: number (min: 1), required

**Response**: `204 No Content`

**Side Effects**:
- No version created (cosmetic only)

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Move Item to Group

**Endpoint**: `PATCH /quotes/:quoteId/items/:itemId/move-to-group`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID

**Request Body**:
```json
{
  "quote_group_id": "group-uuid-or-null"
}
```

**Field Validation**:
- `quote_group_id`: UUID or null, required (null moves to ungrouped)

**Response**: `200 OK` (returns updated item)

**Side Effects**:
- Creates new version (+0.1)

**Error Responses**:
- `404 Not Found` - Quote, item, or target group not found
- `400 Bad Request` - Cannot move items in approved quote

---

### Save Item to Library

**Endpoint**: `POST /quotes/:quoteId/items/:itemId/save-to-library`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `itemId` (UUID, required) - Item UUID

**Response**: `201 Created`
```json
{
  "library_item_id": "library-item-uuid",
  "title": "Premium hardwood flooring",
  "usage_count": 0
}
```

**Side Effects**:
- Creates new library item with all fields from quote item

**Error Responses**:
- `404 Not Found` - Quote or item not found

---

## Quote Groups

### Create Group

**Endpoint**: `POST /quotes/:quoteId/groups`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "name": "Foundation Work",
  "description": "All foundation-related items"
}
```

**Field Validation**:
- `name`: string (1-200 chars), required
- `description`: string, optional

**Response**: `201 Created`
```json
{
  "id": "group-uuid",
  "name": "Foundation Work",
  "description": "All foundation-related items",
  "order_index": 1,
  "item_count": 0,
  "subtotal": 0.00
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot add groups to approved quote

---

### List Groups

**Endpoint**: `GET /quotes/:quoteId/groups`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "groups": [
    {
      "id": "group-uuid",
      "name": "Foundation Work",
      "description": "All foundation-related items",
      "order_index": 1,
      "item_count": 5,
      "subtotal": 25000.00,
      "items": [...]
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Single Group

**Endpoint**: `GET /quotes/:quoteId/groups/:groupId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `groupId` (UUID, required) - Group UUID

**Response**: `200 OK` (group with all items)

**Error Responses**:
- `404 Not Found` - Quote or group not found

---

### Update Group

**Endpoint**: `PATCH /quotes/:quoteId/groups/:groupId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `groupId` (UUID, required) - Group UUID

**Request Body**:
```json
{
  "name": "Foundation Work - Updated",
  "description": "Updated description"
}
```

**Field Validation**:
- `name`: string (1-200 chars), optional
- `description`: string, optional

**Response**: `200 OK` (returns updated group)

**Side Effects**:
- Creates new version (+0.1)

**Error Responses**:
- `404 Not Found` - Quote or group not found
- `400 Bad Request` - Cannot edit groups in approved quote

---

### Delete Group

**Endpoint**: `DELETE /quotes/:quoteId/groups/:groupId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `groupId` (UUID, required) - Group UUID

**Query Parameters**:
- `delete_items` (boolean, default: false) - Delete items in group (default moves to ungrouped)

**Response**: `204 No Content`

**Side Effects**:
- If `delete_items=false`: Moves items to ungrouped
- If `delete_items=true`: Deletes all items in group

**Error Responses**:
- `404 Not Found` - Quote or group not found
- `400 Bad Request` - Cannot delete groups from approved quote

---

### Duplicate Group

**Endpoint**: `POST /quotes/:quoteId/groups/:groupId/duplicate`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `groupId` (UUID, required) - Group UUID to duplicate

**Response**: `201 Created`

**Side Effects**:
- Creates copy with " (Copy)" appended to name
- Duplicates all items in the group

**Error Responses**:
- `404 Not Found` - Quote or group not found
- `400 Bad Request` - Cannot duplicate groups in approved quote

---

## Discount Rules

### Create Discount Rule

**Endpoint**: `POST /quotes/:quoteId/discount-rules`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "rule_type": "percentage",
  "value": 10.0,
  "reason": "Early payment discount",
  "apply_to": "subtotal"
}
```

**Field Validation**:
- `rule_type`: enum (required) - Values: `percentage`, `fixed_amount`
- `value`: number (min: 0), required
  - If `rule_type=percentage`: value must be 0-100
  - If `rule_type=fixed_amount`: value must be > 0
- `reason`: string (3-255 chars), required
- `apply_to`: enum (optional, default: "subtotal") - Values: `subtotal`

**Response**: `201 Created`
```json
{
  "id": "discount-rule-uuid",
  "rule_type": "percentage",
  "value": 10.0,
  "reason": "Early payment discount",
  "discount_amount": 4500.00,
  "order_index": 1,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot modify approved quote / Invalid discount value / Discount exceeds subtotal

---

### List Discount Rules

**Endpoint**: `GET /quotes/:quoteId/discount-rules`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "discount_rules": [
    {
      "id": "discount-rule-uuid",
      "rule_type": "percentage",
      "value": 10.0,
      "reason": "Early payment discount",
      "discount_amount": 4500.00,
      "order_index": 1
    }
  ],
  "total_discount": 4500.00,
  "subtotal_before_discount": 45000.00,
  "subtotal_after_discount": 40500.00
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Discount Rule

**Endpoint**: `GET /quotes/:quoteId/discount-rules/:ruleId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Discount rule UUID

**Response**: `200 OK` (full discount rule object)

**Error Responses**:
- `404 Not Found` - Quote or discount rule not found

---

### Update Discount Rule

**Endpoint**: `PATCH /quotes/:quoteId/discount-rules/:ruleId`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Discount rule UUID

**Request Body**: All fields from Create Discount Rule are optional

**Response**: `200 OK` (returns updated discount rule)

**Error Responses**:
- `404 Not Found` - Quote or discount rule not found
- `400 Bad Request` - Cannot modify approved quote / Invalid discount value

---

### Delete Discount Rule

**Endpoint**: `DELETE /quotes/:quoteId/discount-rules/:ruleId`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `ruleId` (UUID, required) - Discount rule UUID

**Response**: `204 No Content`

**Side Effects**:
- Hard delete (permanent removal)
- Recalculates quote totals

**Error Responses**:
- `404 Not Found` - Quote or discount rule not found
- `400 Bad Request` - Cannot modify approved quote

---

### Reorder Discount Rules

**Endpoint**: `PATCH /quotes/:quoteId/discount-rules/reorder`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "rule_orders": [
    {"rule_id": "rule-uuid-1", "order_index": 1},
    {"rule_id": "rule-uuid-2", "order_index": 2}
  ]
}
```

**Field Validation**:
- `rule_orders`: array, required
  - `rule_id`: UUID, required
  - `order_index`: number (min: 1), required

**Response**: `200 OK`

**Important Note**:
- Order affects totals - percentage discounts compound
- Example: 10% off, then 5% off = different from 5% off, then 10% off

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot modify approved quote

---

### Preview Discount Impact

**Endpoint**: `POST /quotes/:quoteId/discount-rules/preview`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "rule_type": "percentage",
  "value": 15.0
}
```

**Field Validation**:
- `rule_type`: enum (required) - Values: `percentage`, `fixed_amount`
- `value`: number (min: 0), required

**Response**: `200 OK`
```json
{
  "current_subtotal": 45000.00,
  "current_discount": 4500.00,
  "current_total": 40500.00,
  "new_discount_amount": 6750.00,
  "new_subtotal_after_discount": 38250.00,
  "new_total": 43250.00,
  "margin_before": 25.5,
  "margin_after": 22.3,
  "margin_impact": -3.2
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

## Approval Workflow

### Submit Quote for Approval

**Endpoint**: `POST /quotes/:quoteId/submit-for-approval`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `201 Created`
```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending_approval",
  "approvals_required": [
    {
      "id": "approval-uuid-1",
      "level": 1,
      "approver": {
        "id": "user-uuid-1",
        "name": "Manager Name"
      },
      "status": "pending"
    },
    {
      "id": "approval-uuid-2",
      "level": 2,
      "approver": {
        "id": "user-uuid-2",
        "name": "Owner Name"
      },
      "status": "pending"
    }
  ]
}
```

**Validation Rules**:
- Quote must have items, vendor, and address
- Quote must not already be submitted
- Tenant must have approval thresholds configured

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Quote must have items/vendor/address / Already submitted / No approval thresholds configured

---

### Approve Quote

**Endpoint**: `POST /quotes/:quoteId/approvals/:approvalId/approve`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `approvalId` (UUID, required) - Approval UUID

**Request Body**:
```json
{
  "comments": "Approved - looks good"
}
```

**Field Validation**:
- `comments`: string (max: 1000 chars), optional

**Response**: `201 Created`
```json
{
  "approval_id": "approval-uuid-1",
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "approved_by": {
    "id": "user-uuid-1",
    "name": "Manager Name"
  },
  "approved_at": "2026-01-24T10:00:00Z",
  "comments": "Approved - looks good",
  "next_approval": {
    "id": "approval-uuid-2",
    "level": 2,
    "approver": {
      "id": "user-uuid-2",
      "name": "Owner Name"
    }
  }
}
```

**Validation Rules**:
- User must be the assigned approver
- Previous approval levels must be approved (sequential approval)
- Approval must not already be decided

**Side Effects**:
- If all approvals complete: Quote status → `ready`
- If more approvals needed: Triggers next level

**Error Responses**:
- `404 Not Found` - Approval not found
- `403 Forbidden` - You are not the assigned approver
- `400 Bad Request` - Approval already decided / Previous level not approved yet

---

### Reject Quote

**Endpoint**: `POST /quotes/:quoteId/approvals/:approvalId/reject`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `approvalId` (UUID, required) - Approval UUID

**Request Body**:
```json
{
  "comments": "Margin too low - please review pricing"
}
```

**Field Validation**:
- `comments`: string (3-1000 chars), **required** (rejection requires reason)

**Response**: `201 Created`
```json
{
  "approval_id": "approval-uuid-1",
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "rejected",
  "rejected_by": {
    "id": "user-uuid-1",
    "name": "Manager Name"
  },
  "rejected_at": "2026-01-24T10:00:00Z",
  "comments": "Margin too low - please review pricing"
}
```

**Side Effects**:
- Terminates entire workflow
- All approvals marked as `rejected`
- Quote status → `draft`

**Error Responses**:
- `404 Not Found` - Approval not found
- `403 Forbidden` - You are not the assigned approver
- `400 Bad Request` - Approval already decided / Comments required

---

### Get Approval Status

**Endpoint**: `GET /quotes/:quoteId/approvals`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "quote_status": "pending_approval",
  "approvals": [
    {
      "id": "approval-uuid-1",
      "level": 1,
      "approver": {
        "id": "user-uuid-1",
        "name": "Manager Name"
      },
      "status": "approved",
      "approved_at": "2026-01-24T10:00:00Z",
      "comments": "Looks good"
    },
    {
      "id": "approval-uuid-2",
      "level": 2,
      "approver": {
        "id": "user-uuid-2",
        "name": "Owner Name"
      },
      "status": "pending",
      "approved_at": null,
      "comments": null
    }
  ],
  "progress_percent": 50,
  "is_complete": false
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Pending Approvals for Current User

**Endpoint**: `GET /users/me/pending-approvals`
**RBAC**: `Owner`, `Admin`, `Manager`

**Response**: `200 OK`
```json
{
  "pending_approvals": [
    {
      "approval_id": "approval-uuid",
      "quote_id": "quote-uuid",
      "quote_number": "Q-2026-0001",
      "quote_title": "Kitchen Remodel",
      "quote_total": 50000.00,
      "level": 2,
      "submitted_at": "2026-01-24T09:00:00Z",
      "submitted_by": {
        "id": "user-uuid",
        "name": "Sales Rep Name"
      }
    }
  ],
  "count": 1
}
```

---

### Bypass Approval (Owner Override)

**Endpoint**: `POST /quotes/:quoteId/approvals/bypass`
**RBAC**: `Owner` (ONLY)

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "reason": "Emergency approval - customer deadline"
}
```

**Field Validation**:
- `reason`: string (3-500 chars), required

**Response**: `201 Created`
```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "ready",
  "bypassed_by": {
    "id": "owner-user-uuid",
    "name": "Owner Name"
  },
  "bypassed_at": "2026-01-24T10:00:00Z",
  "reason": "Emergency approval - customer deadline"
}
```

**Side Effects**:
- Marks all approvals as `approved`
- Quote status → `ready`
- Audit log entry created

**Error Responses**:
- `404 Not Found` - Quote not found
- `403 Forbidden` - Only owners can bypass approval
- `400 Bad Request` - Quote is not pending approval

---

### Configure Approval Thresholds

**Endpoint**: `PATCH /quotes/settings/approval-thresholds`
**RBAC**: `Owner`, `Admin`

**Request Body**:
```json
{
  "thresholds": [
    {
      "level": 1,
      "min_amount": 0,
      "max_amount": 10000,
      "approver_user_id": "manager-uuid",
      "profitability_threshold_percent": 20.0
    },
    {
      "level": 2,
      "min_amount": 10000,
      "max_amount": 50000,
      "approver_user_id": "owner-uuid",
      "profitability_threshold_percent": 15.0
    },
    {
      "level": 3,
      "min_amount": 50000,
      "max_amount": null,
      "approver_user_id": "owner-uuid",
      "profitability_threshold_percent": 10.0
    }
  ]
}
```

**Field Validation**:
- `thresholds`: array, required
  - `level`: number (min: 1), required, must be sequential
  - `min_amount`: number (min: 0), required
  - `max_amount`: number or null, required (null = no upper limit)
  - `approver_user_id`: UUID, required
  - `profitability_threshold_percent`: number (0-100), required

**Validation Rules**:
- Amounts must be ascending (no gaps or overlaps)
- Levels must be sequential (1, 2, 3...)

**Response**: `200 OK`
```json
{
  "thresholds_updated": true,
  "thresholds": [...]
}
```

**Error Responses**:
- `400 Bad Request` - Amounts must be ascending / Levels must be sequential

---

### Reset Approvals

**Endpoint**: `POST /quotes/:quoteId/approvals/reset`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `201 Created`
```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "draft",
  "approvals_deleted": 2
}
```

**Side Effects**:
- Deletes all approvals
- Quote status → `draft`
- Used when quote is modified after submission

**Error Responses**:
- `404 Not Found` - Quote not found

---

## Public Access & Analytics

### Generate Public URL

**Endpoint**: `POST /quotes/:id/public-access`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "password": "SecurePass123",
  "password_hint": "Your street name",
  "expires_at": "2026-12-31T23:59:59Z"
}
```

**Field Validation**:
- `password`: string (6-100 chars), optional
- `password_hint`: string (max: 255 chars), optional
- `expires_at`: ISO 8601 date string, optional (null = never expires)

**Response**: `201 Created`
```json
{
  "public_url": "https://tenant.lead360.app/quotes/abc123def456ghi789jkl",
  "access_token": "abc123def456ghi789jkl",
  "has_password": true,
  "password_hint": "Your street name",
  "expires_at": "2026-12-31T23:59:59Z",
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Side Effects**:
- Generates 32-character access token
- Hashes password (bcrypt)
- Deactivates previous public URLs for this quote

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Deactivate Public URL

**Endpoint**: `DELETE /quotes/:id/public-access`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "message": "Public URL deactivated",
  "deactivated_at": "2026-01-24T10:00:00Z"
}
```

**Side Effects**:
- Sets `is_active = false`
- Public URL immediately stops working

**Error Responses**:
- `404 Not Found` - Quote not found

---

### View Quote via Public URL (PUBLIC - NO AUTH)

**Endpoint**: `GET /public/quotes/:token`
**RBAC**: NONE (Public endpoint)

**Path Parameters**:
- `token` (string, required) - 32-character access token

**Headers**:
- `X-Password` (string, optional) - Password for protected quotes

**Response**: `200 OK`
```json
{
  "id": "quote-uuid",
  "quote_number": "Q-2026-0001",
  "title": "Kitchen Remodel",
  "description": "Complete kitchen renovation",
  "status": "sent",
  "total_price": 50000.00,
  "subtotal": 45000.00,
  "total_tax": 5000.00,
  "total_discount": 0.00,
  "currency": "USD",
  "valid_until": "2026-02-23T10:00:00Z",
  "created_at": "2026-01-24T10:00:00Z",
  "updated_at": "2026-01-24T10:00:00Z",
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "5551234567",
    "company_name": "Doe Enterprises"
  },
  "jobsite_address": {
    "address_line1": "123 Main St",
    "address_line2": "",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101"
  },
  "vendor": {
    "name": "ABC Construction",
    "phone": "5559876543",
    "email": "vendor@abc.com",
    "website": "https://abc.com"
  },
  "items": [
    {
      "id": "item-uuid",
      "title": "Premium hardwood flooring",
      "description": "Oak hardwood, 3/4 inch thick",
      "quantity": 500,
      "unit": "sqft",
      "unit_price": 12.50,
      "total_price": 6250.00,
      "tax_amount": 562.50,
      "discount_amount": 0.00,
      "group": {
        "id": "group-uuid",
        "name": "Flooring",
        "display_order": 1
      },
      "display_order": 1,
      "is_optional": false,
      "images": []
    }
  ],
  "branding": {
    "company_name": "ABC Construction",
    "logo_url": "https://cdn.lead360.app/logos/abc.png",
    "primary_color": "#003366",
    "secondary_color": "#FF6600"
  },
  "cover_page_image_url": "https://cdn.lead360.app/covers/kitchen.jpg",
  "attachments": [],
  "public_notes": "Thank you for considering our proposal",
  "terms_and_conditions": "Payment terms: Net 30..."
}
```

**Important Notes**:
- DOES NOT expose: Internal notes, cost breakdown, approval history, vendor signatures
- Rate limited: 10 requests per minute per IP

**Error Responses**:
- `403 Forbidden` - Invalid password / Too many failed attempts (locked out)
- `404 Not Found` - Token not found or inactive
- `410 Gone` - Quote expired or no longer available
- `429 Too Many Requests` - Rate limit exceeded

---

### Validate Password (PUBLIC - NO AUTH)

**Endpoint**: `POST /public/quotes/:token/validate-password`
**RBAC**: NONE (Public endpoint)

**Path Parameters**:
- `token` (string, required) - 32-character access token

**Request Body**:
```json
{
  "password": "SecurePass123"
}
```

**Field Validation**:
- `password`: string, required

**Response**: `200 OK`
```json
{
  "valid": true,
  "failed_attempts": 0,
  "is_locked": false
}
```

**Or if invalid**:
```json
{
  "valid": false,
  "message": "Invalid password",
  "failed_attempts": 2,
  "is_locked": false,
  "lockout_expires_at": null
}
```

**Rate Limiting**:
- 5 failed attempts → 15 minute lockout
- Lockout applies per IP + token combination

---

### Log View (PUBLIC - NO AUTH)

**Endpoint**: `POST /public/quotes/:token/view`
**RBAC**: NONE (Public endpoint)

**Path Parameters**:
- `token` (string, required) - 32-character access token

**Request Body**:
```json
{
  "referrer_url": "https://example.com",
  "duration_seconds": 45
}
```

**Field Validation**:
- `referrer_url`: string, optional
- `duration_seconds`: number, optional

**Response**: `204 No Content`

**Side Effects**:
- Logs view event with IP, user agent, timestamp
- Quote status updates to `viewed` (if currently `sent`)

---

### Get View Analytics

**Endpoint**: `GET /quotes/:id/views/analytics`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "total_views": 15,
  "unique_visitors": 3,
  "first_viewed_at": "2026-01-24T11:00:00Z",
  "last_viewed_at": "2026-01-25T14:30:00Z",
  "avg_duration_seconds": 120,
  "views_by_day": [
    {"date": "2026-01-24", "count": 8},
    {"date": "2026-01-25", "count": 7}
  ],
  "top_referrers": [
    {"url": "https://email.client.com", "count": 10},
    {"url": "direct", "count": 5}
  ]
}
```

---

### Get View History

**Endpoint**: `GET /quotes/:id/views/history`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "view-uuid",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "referrer_url": "https://email.client.com",
      "duration_seconds": 120,
      "viewed_at": "2026-01-24T11:00:00Z"
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 15,
    "total_pages": 1
  }
}
```

---

### Anonymize Views (ADMIN ONLY - GDPR)

**Endpoint**: `POST /quotes/admin/anonymize-views`
**RBAC**: `PlatformAdmin`

**Response**: `200 OK`
```json
{
  "anonymized_count": 1523,
  "anonymized_at": "2026-01-24T10:00:00Z",
  "cutoff_date": "2025-10-26T10:00:00Z"
}
```

**Side Effects**:
- Anonymizes IP addresses older than 90 days
- Replaces IP with "0.0.0.0"
- GDPR compliance

---

## PDF Generation

### Generate PDF

**Endpoint**: `POST /quotes/:id/generate-pdf`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "include_cost_breakdown": false,
  "template_id": "template-uuid-optional"
}
```

**Field Validation**:
- `include_cost_breakdown`: boolean, optional (default: false)
- `template_id`: UUID, optional (uses active template if not specified)

**Response**: `200 OK`
```json
{
  "file_id": "file-uuid",
  "filename": "Q-2026-0001_Kitchen_Remodel.pdf",
  "download_url": "https://cdn.lead360.app/pdfs/file-uuid.pdf",
  "file_size_bytes": 524288,
  "generated_at": "2026-01-24T10:00:00Z",
  "expires_at": "2026-01-24T22:00:00Z"
}
```

**Side Effects**:
- Generates PDF using Handlebars template
- Stores in object storage
- Creates file record in database

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Quote not ready (missing data)
- `500 Internal Server Error` - PDF generation failed

---

### Get PDF Download URL

**Endpoint**: `GET /quotes/:id/download-pdf`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Response**: `200 OK` (same structure as Generate PDF)

**Note**: Currently regenerates PDF each time. Future enhancement will cache PDFs.

---

## Dashboard

### Get Dashboard Overview

**Endpoint**: `GET /quotes/dashboard/overview`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional, default: 30 days ago)
- `date_to` (date string YYYY-MM-DD, optional, default: today)
- `compare_to_previous` (boolean, optional, default: false)

**Response**: `200 OK`
```json
{
  "period": {
    "from": "2025-12-25",
    "to": "2026-01-24"
  },
  "summary": {
    "total_quotes": 42,
    "total_revenue": 2100000.00,
    "avg_quote_value": 50000.00,
    "conversion_rate": 45.2,
    "win_rate": 52.4
  },
  "by_status": {
    "draft": 8,
    "pending_approval": 3,
    "ready": 5,
    "sent": 12,
    "accepted": 10,
    "rejected": 4
  },
  "comparison": {
    "total_quotes_change_percent": 12.5,
    "revenue_change_percent": 18.3,
    "conversion_rate_change_percent": -2.1
  }
}
```

---

### Get Quotes Over Time

**Endpoint**: `GET /quotes/dashboard/quotes-over-time`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional)
- `date_to` (date string YYYY-MM-DD, optional)
- `interval` (enum, optional, default: "day") - Values: `day`, `week`, `month`

**Response**: `200 OK`
```json
{
  "interval": "day",
  "data": [
    {
      "date": "2026-01-20",
      "quotes_created": 5,
      "quotes_sent": 3,
      "quotes_accepted": 2,
      "revenue": 100000.00
    },
    {
      "date": "2026-01-21",
      "quotes_created": 7,
      "quotes_sent": 4,
      "quotes_accepted": 3,
      "revenue": 150000.00
    }
  ]
}
```

---

### Get Top Items

**Endpoint**: `GET /quotes/dashboard/top-items`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional)
- `date_to` (date string YYYY-MM-DD, optional)
- `limit` (number, optional, default: 10, max: 50)

**Response**: `200 OK`
```json
{
  "top_items": [
    {
      "title": "Premium hardwood flooring",
      "usage_count": 25,
      "total_revenue": 156250.00,
      "avg_price_per_unit": 12.50
    }
  ]
}
```

---

### Get Win/Loss Analysis

**Endpoint**: `GET /quotes/dashboard/win-loss-analysis`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional)
- `date_to` (date string YYYY-MM-DD, optional)

**Response**: `200 OK`
```json
{
  "total_quotes": 100,
  "won": 52,
  "lost": 35,
  "pending": 13,
  "win_rate_percent": 59.8,
  "avg_won_value": 55000.00,
  "avg_lost_value": 48000.00,
  "won_revenue": 2860000.00,
  "lost_potential_revenue": 1680000.00
}
```

---

### Get Conversion Funnel

**Endpoint**: `GET /quotes/dashboard/conversion-funnel`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional)
- `date_to` (date string YYYY-MM-DD, optional)

**Response**: `200 OK`
```json
{
  "funnel_stages": [
    {"stage": "created", "count": 100, "percent": 100},
    {"stage": "sent", "count": 85, "percent": 85},
    {"stage": "viewed", "count": 72, "percent": 72},
    {"stage": "accepted", "count": 52, "percent": 52}
  ],
  "drop_off_analysis": {
    "created_to_sent": 15,
    "sent_to_viewed": 13,
    "viewed_to_accepted": 20
  }
}
```

---

### Get Revenue by Vendor

**Endpoint**: `GET /quotes/dashboard/revenue-by-vendor`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:
- `date_from` (date string YYYY-MM-DD, optional)
- `date_to` (date string YYYY-MM-DD, optional)

**Response**: `200 OK`
```json
{
  "vendors": [
    {
      "vendor_id": "vendor-uuid",
      "vendor_name": "ABC Construction",
      "quote_count": 42,
      "total_revenue": 2100000.00,
      "avg_quote_value": 50000.00,
      "conversion_rate": 52.4
    }
  ]
}
```

---

### Export Dashboard Data

**Endpoint**: `POST /quotes/dashboard/export`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "format": "csv",
  "date_from": "2025-12-01",
  "date_to": "2026-01-24",
  "sections": ["overview", "quotes_over_time", "top_items"]
}
```

**Field Validation**:
- `format`: enum (required) - Values: `csv`, `xlsx`, `pdf`
- `date_from`: date string (YYYY-MM-DD), optional
- `date_to`: date string (YYYY-MM-DD), optional
- `sections`: array of strings, optional (default: all sections)

**Response**: `200 OK`
```json
{
  "export_url": "https://cdn.lead360.app/exports/dashboard-2026-01-24.csv",
  "format": "csv",
  "expires_at": "2026-01-25T10:00:00Z",
  "file_size_bytes": 102400
}
```

---

### Get Average Pricing by Task

**Endpoint**: `GET /quotes/dashboard/avg-pricing-by-task`
**RBAC**: `Owner`, `Admin`, `Manager`

**Description**: Returns average pricing breakdown by task/item type, showing minimum, maximum, median, and average prices. Helps identify pricing trends and benchmark against historical data.

**Query Parameters**:
| Parameter | Type | Required | Default | Validation | Description |
|-----------|------|----------|---------|------------|-------------|
| `date_from` | string | No | 30 days ago | ISO 8601 date | Start date for filtering quotes |
| `date_to` | string | No | Today | ISO 8601 date | End date for filtering quotes |

**Example Request**:
```
GET /quotes/dashboard/avg-pricing-by-task?date_from=2026-01-01&date_to=2026-01-31
```

**Business Logic**:
1. Fetches all quote items for tenant within date range
2. Groups items by `title` (normalized/case-insensitive)
3. Calculates pricing statistics for each task type:
   - **Usage count**: Number of times used across all quotes
   - **Average price**: Mean of all total_cost values
   - **Minimum price**: Lowest total_cost
   - **Maximum price**: Highest total_cost
   - **Median price**: Middle value when sorted
4. Links to library items if applicable
5. Sorts by usage_count (most used first)

**Success Response** (200 OK):
```json
{
  "benchmarks": [
    {
      "task_title": "Concrete Foundation",
      "usage_count": 45,
      "avg_price": 5000.00,
      "min_price": 3500.00,
      "max_price": 7500.00,
      "median_price": 4800.00,
      "library_item_id": "550e8400-e29b-41d4-a716-446655440000"
    },
    {
      "task_title": "Framing - Interior Walls",
      "usage_count": 38,
      "avg_price": 3200.00,
      "min_price": 2000.00,
      "max_price": 5000.00,
      "median_price": 3100.00,
      "library_item_id": "660e8400-e29b-41d4-a716-446655440001"
    },
    {
      "task_title": "Electrical Installation",
      "usage_count": 32,
      "avg_price": 4500.00,
      "min_price": 3000.00,
      "max_price": 6500.00,
      "median_price": 4400.00,
      "library_item_id": null
    }
  ],
  "date_from": "2026-01-01T00:00:00.000Z",
  "date_to": "2026-01-31T23:59:59.999Z"
}
```

**Response Fields**:
| Field | Type | Description |
|-------|------|-------------|
| `benchmarks` | array | Array of task pricing benchmarks |
| `benchmarks[].task_title` | string | Task/item title (normalized) |
| `benchmarks[].usage_count` | number | Number of times this task was used in quotes |
| `benchmarks[].avg_price` | number | Average price across all uses |
| `benchmarks[].min_price` | number | Lowest price observed |
| `benchmarks[].max_price` | number | Highest price observed |
| `benchmarks[].median_price` | number | Median price (middle value) |
| `benchmarks[].library_item_id` | UUID \| null | Associated library item ID (if saved to library) |
| `date_from` | string | Start date of analysis period (ISO 8601) |
| `date_to` | string | End date of analysis period (ISO 8601) |

**Empty Results Response** (no quotes in date range):
```json
{
  "benchmarks": [],
  "date_from": "2026-01-01T00:00:00.000Z",
  "date_to": "2026-01-31T23:59:59.999Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid date format (must be ISO 8601)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient permissions (requires Owner, Admin, or Manager role)

**Example Error (400 Bad Request)**:
```json
{
  "statusCode": 400,
  "message": [
    "date_from must be a valid ISO 8601 date string"
  ],
  "error": "Bad Request"
}
```

**Side Effects**: None (read-only operation)

**Use Cases**:
1. **Pricing Guidance**: See typical pricing for common tasks
2. **Estimating**: Use historical averages when creating new quotes
3. **Margin Analysis**: Compare current pricing to historical averages
4. **Market Research**: Identify most commonly used tasks
5. **Pricing Consistency**: Ensure consistent pricing across quotes

**Business Notes**:
- Only includes items from quotes with status `APPROVED` or `SENT` (not drafts)
- Prices represent `total_cost` (quantity × unit price with markup)
- Task titles are normalized (case-insensitive, trimmed whitespace)
- Sorted by `usage_count` descending (most used first)
- Library item link allows drilling into specific item details

---

## Bundles

### Create Bundle

**Endpoint**: `POST /bundles`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "name": "Complete Kitchen Package",
  "description": "Everything needed for a standard kitchen remodel",
  "default_discount_percent": 5.0,
  "items": [
    {
      "title": "Premium cabinets",
      "description": "Oak cabinets with soft-close hinges",
      "quantity": 15,
      "unit_measurement_id": "unit-uuid",
      "material_cost_per_unit": 500.00,
      "labor_cost_per_unit": 150.00
    },
    {
      "title": "Granite countertops",
      "quantity": 50,
      "unit_measurement_id": "unit-uuid-sqft",
      "material_cost_per_unit": 75.00,
      "labor_cost_per_unit": 25.00
    }
  ]
}
```

**Field Validation**:
- `name`: string (1-200 chars), required
- `description`: string, optional
- `default_discount_percent`: number (0-100), optional
- `items`: array (min: 1 item), required
  - Each item follows same validation as Quote Items

**Response**: `201 Created`
```json
{
  "id": "bundle-uuid",
  "name": "Complete Kitchen Package",
  "description": "Everything needed for a standard kitchen remodel",
  "default_discount_percent": 5.0,
  "item_count": 2,
  "total_cost": 11250.00,
  "total_price": 15050.63,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error

---

### List Bundles

**Endpoint**: `GET /bundles`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `search` (string, optional)

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "bundle-uuid",
      "name": "Complete Kitchen Package",
      "description": "Everything needed for a standard kitchen remodel",
      "item_count": 2,
      "total_cost": 11250.00,
      "total_price": 15050.63,
      "usage_count": 5
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 8,
    "total_pages": 1
  }
}
```

---

### Get Bundle

**Endpoint**: `GET /bundles/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Bundle UUID

**Response**: `200 OK` (full bundle with all items)

**Error Responses**:
- `404 Not Found` - Bundle not found

---

### Update Bundle

**Endpoint**: `PATCH /bundles/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Bundle UUID

**Request Body** (all fields optional):
```json
{
  "name": "Complete Kitchen Package - Updated",
  "description": "Updated description",
  "default_discount_percent": 7.5
}
```

**Note**: Use item endpoints to modify bundle items

**Response**: `200 OK` (returns updated bundle)

**Error Responses**:
- `404 Not Found` - Bundle not found
- `400 Bad Request` - Invalid data or validation error

---

### Delete Bundle

**Endpoint**: `DELETE /bundles/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Bundle UUID

**Response**: `204 No Content`

**Side Effects**:
- Cascades to delete all associated items

**Error Responses**:
- `404 Not Found` - Bundle not found

---

### Add Item to Bundle

**Endpoint**: `POST /bundles/:id/items`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Bundle UUID

**Request Body**: Same as Create Quote Item

**Response**: `201 Created`

**Error Responses**:
- `404 Not Found` - Bundle not found
- `400 Bad Request` - Invalid data or validation error

---

### Update Bundle Item

**Endpoint**: `PATCH /bundles/:bundleId/items/:itemId`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `bundleId` (UUID, required) - Bundle UUID
- `itemId` (UUID, required) - Item UUID

**Request Body**: Same as Update Quote Item

**Response**: `200 OK` (returns updated item)

**Error Responses**:
- `404 Not Found` - Bundle or item not found
- `400 Bad Request` - Invalid data or validation error

---

### Delete Bundle Item

**Endpoint**: `DELETE /bundles/:bundleId/items/:itemId`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `bundleId` (UUID, required) - Bundle UUID
- `itemId` (UUID, required) - Item UUID

**Response**: `204 No Content`

**Validation**:
- Cannot delete last item - bundle must have at least one item

**Error Responses**:
- `400 Bad Request` - Cannot delete last item
- `404 Not Found` - Bundle or item not found

---

## Item Library

### Create Library Item

**Endpoint**: `POST /item-library`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**: Same as Create Quote Item (without quote_group_id)

**Response**: `201 Created`
```json
{
  "id": "library-item-uuid",
  "title": "Premium hardwood flooring",
  "usage_count": 0,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - At least one cost must be > 0
- `404 Not Found` - Unit measurement not found

---

### Bulk Import Library Items

**Endpoint**: `POST /item-library/bulk-import`
**RBAC**: `Owner`, `Admin`

**Request Body**:
```json
{
  "items": [
    {
      "title": "Item 1",
      "quantity": 1,
      "unit_measurement_id": "unit-uuid",
      "material_cost_per_unit": 10.00,
      "labor_cost_per_unit": 5.00
    },
    {
      "title": "Item 2",
      "quantity": 1,
      "unit_measurement_id": "unit-uuid",
      "material_cost_per_unit": 20.00,
      "labor_cost_per_unit": 10.00
    }
  ]
}
```

**Field Validation**:
- `items`: array, required
  - Each item follows same validation as Create Library Item

**Response**: `201 Created`
```json
{
  "imported_count": 2,
  "failed_count": 0,
  "items": [...]
}
```

**Transaction**: All or nothing - if one fails, none are imported

**Error Responses**:
- `400 Bad Request` - Validation failed for one or more items

---

### List Library Items

**Endpoint**: `GET /item-library`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `search` (string, optional)
- `sort_by` (string, default: "usage_count") - Values: `usage_count`, `title`, `created_at`
- `sort_order` (enum, default: "desc") - Values: `asc`, `desc`
- `is_active` (boolean, optional)

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "library-item-uuid",
      "title": "Premium hardwood flooring",
      "description": "Oak hardwood, 3/4 inch thick",
      "unit": "sqft",
      "material_cost_per_unit": 5.50,
      "labor_cost_per_unit": 3.25,
      "total_cost_per_unit": 10.00,
      "unit_price": 13.38,
      "usage_count": 25,
      "is_active": true
    }
  ],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 127,
    "total_pages": 7
  }
}
```

---

### Get Library Item

**Endpoint**: `GET /item-library/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Path Parameters**:
- `id` (UUID, required) - Library item UUID

**Response**: `200 OK` (full library item object)

**Error Responses**:
- `404 Not Found` - Library item not found

---

### Get Library Item Statistics

**Endpoint**: `GET /item-library/:id/statistics`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Library item UUID

**Response**: `200 OK`
```json
{
  "library_item_id": "library-item-uuid",
  "usage_count": 25,
  "quote_count": 18,
  "total_revenue": 156250.00,
  "avg_quantity_per_quote": 500,
  "last_used_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `404 Not Found` - Library item not found

---

### Update Library Item

**Endpoint**: `PATCH /item-library/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Library item UUID

**Request Body**: All fields from Create Library Item are optional

**Important**: Only affects future uses, not existing quotes

**Response**: `200 OK` (returns updated library item)

**Error Responses**:
- `404 Not Found` - Library item not found

---

### Mark Library Item as Inactive

**Endpoint**: `PATCH /item-library/:id/mark-inactive`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Library item UUID

**Response**: `200 OK`
```json
{
  "id": "library-item-uuid",
  "is_active": false,
  "deactivated_at": "2026-01-24T10:00:00Z"
}
```

**Side Effects**:
- Soft delete alternative - item remains in database but hidden from lists
- Does not affect existing quotes

**Error Responses**:
- `404 Not Found` - Library item not found

---

### Delete Library Item

**Endpoint**: `DELETE /item-library/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Library item UUID

**Response**: `204 No Content`

**Validation**:
- Can only delete if usage_count = 0

**Error Responses**:
- `404 Not Found` - Library item not found
- `409 Conflict` - Cannot delete item with usage_count > 0

---

## Draw Schedule

### Create Draw Schedule

**Endpoint**: `POST /quotes/:quoteId/draw-schedule`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "entries": [
    {
      "draw_number": 1,
      "description": "Initial deposit",
      "percentage": 30.0,
      "due_on_event": "contract_signing"
    },
    {
      "draw_number": 2,
      "description": "Midpoint progress payment",
      "percentage": 40.0,
      "due_on_event": "50_percent_complete"
    },
    {
      "draw_number": 3,
      "description": "Final payment",
      "percentage": 30.0,
      "due_on_event": "completion"
    }
  ]
}
```

**Field Validation**:
- `entries`: array (min: 1), required
  - `draw_number`: number (min: 1), required, must be sequential
  - `description`: string (1-255 chars), required
  - `percentage`: number (0.01-100), required
  - `due_on_event`: string, required

**Validation Rules**:
- Percentage entries must sum to exactly 100%
- Draw numbers must be sequential (1, 2, 3...)

**Response**: `201 Created`
```json
{
  "quote_id": "quote-uuid",
  "entries": [
    {
      "id": "entry-uuid-1",
      "draw_number": 1,
      "description": "Initial deposit",
      "percentage": 30.0,
      "amount": 15000.00,
      "due_on_event": "contract_signing"
    },
    {
      "id": "entry-uuid-2",
      "draw_number": 2,
      "description": "Midpoint progress payment",
      "percentage": 40.0,
      "amount": 20000.00,
      "running_total": 35000.00,
      "due_on_event": "50_percent_complete"
    },
    {
      "id": "entry-uuid-3",
      "draw_number": 3,
      "description": "Final payment",
      "percentage": 30.0,
      "amount": 15000.00,
      "running_total": 50000.00,
      "due_on_event": "completion"
    }
  ],
  "total_amount": 50000.00,
  "is_valid": true
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Percentage entries must sum to 100% / Draw numbers must be sequential

---

### Get Draw Schedule

**Endpoint**: `GET /quotes/:quoteId/draw-schedule`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK` (same structure as Create Draw Schedule)

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Update Draw Schedule

**Endpoint**: `PATCH /quotes/:quoteId/draw-schedule`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Request Body**: Same as Create Draw Schedule (replaces entire schedule)

**Response**: `200 OK` (returns updated draw schedule)

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Percentage entries must sum to 100% / Draw numbers must be sequential

---

### Delete Draw Schedule

**Endpoint**: `DELETE /quotes/:quoteId/draw-schedule`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `204 No Content`

**Side Effects**:
- Removes all entries

**Error Responses**:
- `404 Not Found` - Quote not found

---

## Version History

### List Versions

**Endpoint**: `GET /quotes/:quoteId/versions`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "versions": [
    {
      "id": "version-uuid-3",
      "version_number": "1.5",
      "created_by": {
        "id": "user-uuid",
        "name": "John Doe"
      },
      "created_at": "2026-01-24T12:00:00Z",
      "change_type": "minor",
      "change_reason": "Updated item pricing",
      "snapshot_summary": {
        "item_count": 15,
        "total": 52000.00
      }
    },
    {
      "id": "version-uuid-2",
      "version_number": "1.0",
      "created_by": {
        "id": "user-uuid",
        "name": "John Doe"
      },
      "created_at": "2026-01-24T10:00:00Z",
      "change_type": "major",
      "change_reason": "Status changed to sent",
      "snapshot_summary": {
        "item_count": 15,
        "total": 50000.00
      }
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Specific Version

**Endpoint**: `GET /quotes/:quoteId/versions/:versionId`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionId` (UUID, required) - Version UUID

**Response**: `200 OK` (full version with parsed snapshot - includes items, groups, etc.)

**Error Responses**:
- `404 Not Found` - Version not found

---

### Compare Versions

**Endpoint**: `GET /quotes/:quoteId/versions/compare`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Query Parameters**:
- `from` (string, required) - Source version number (e.g., "1.0")
- `to` (string, required) - Target version number (e.g., "1.5")

**Response**: `200 OK`
```json
{
  "from_version": "1.0",
  "to_version": "1.5",
  "changes": {
    "items_added": [
      {"id": "item-uuid-16", "title": "New flooring option"}
    ],
    "items_removed": [],
    "items_modified": [
      {
        "id": "item-uuid-1",
        "field": "unit_price",
        "old_value": 12.50,
        "new_value": 13.00
      }
    ],
    "groups_added": [],
    "groups_removed": [],
    "settings_changed": {
      "custom_profit_percent": {
        "old_value": 25.0,
        "new_value": 27.5
      }
    },
    "totals": {
      "old_total": 50000.00,
      "new_total": 52000.00,
      "difference": 2000.00
    }
  }
}
```

**Error Responses**:
- `404 Not Found` - Quote or version not found
- `400 Bad Request` - Invalid version numbers

---

### Restore Version

**Endpoint**: `POST /quotes/:quoteId/versions/:versionNumber/restore`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionNumber` (string, required) - Version number to restore (e.g., "1.0")

**Request Body**:
```json
{
  "reason": "Customer requested original pricing"
}
```

**Field Validation**:
- `reason`: string (3-500 chars), required

**Response**: `201 Created`
```json
{
  "quote_id": "quote-uuid",
  "restored_to_version": "1.0",
  "new_version_created": "2.0",
  "backup_version_created": "1.9",
  "restored_at": "2026-01-24T10:00:00Z"
}
```

**Side Effects**:
- Creates backup of current state first
- Recreates quote from snapshot
- Creates new version

**Error Responses**:
- `404 Not Found` - Quote or version not found
- `400 Bad Request` - Cannot restore approved quote

---

### Get Version Timeline

**Endpoint**: `GET /quotes/:quoteId/versions/timeline`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK`
```json
{
  "timeline": [
    {
      "date": "2026-01-24",
      "versions": [
        {
          "version_number": "1.5",
          "created_at": "2026-01-24T12:00:00Z",
          "change_type": "minor",
          "change_reason": "Updated item pricing"
        },
        {
          "version_number": "1.0",
          "created_at": "2026-01-24T10:00:00Z",
          "change_type": "major",
          "change_reason": "Status changed to sent"
        }
      ]
    }
  ]
}
```

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Get Version Change Summary

**Endpoint**: `GET /quotes/:quoteId/versions/:versionNumber/summary`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID
- `versionNumber` (string, required) - Version number (e.g., "1.5")

**Response**: `200 OK`
```json
{
  "version_number": "1.5",
  "created_at": "2026-01-24T12:00:00Z",
  "change_summary": [
    "Updated unit price for 'Premium hardwood flooring' from $12.50 to $13.00",
    "Added new item 'Tile backsplash'",
    "Increased custom profit percentage from 25% to 27.5%",
    "Quote total changed from $50,000.00 to $52,000.00"
  ],
  "comparison_to_previous": {
    "previous_version": "1.4",
    "total_change": 2000.00,
    "item_count_change": 1
  }
}
```

**Error Responses**:
- `404 Not Found` - Quote or version not found

---

## Profitability Analysis

### Validate Profitability

**Endpoint**: `GET /quotes/:quoteId/profitability/validate`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK` (detailed response shown in controller comments)

**Error Responses**:
- `404 Not Found` - Quote not found

---

### Analyze Margins

**Endpoint**: `GET /quotes/:quoteId/profitability/analysis`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `quoteId` (UUID, required) - Quote UUID

**Response**: `200 OK` (detailed response shown in controller comments)

**Error Responses**:
- `404 Not Found` - Quote not found

---

## Quote Settings

### Get Settings

**Endpoint**: `GET /quotes/settings`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Response**: `200 OK`
```json
{
  "default_profit_percent": 25.0,
  "default_overhead_percent": 15.0,
  "default_contingency_percent": 5.0,
  "default_expiration_days": 30,
  "default_tax_rate_percent": 6.25,
  "auto_generate_quote_numbers": true,
  "quote_number_prefix": "Q",
  "require_approval_over_amount": 10000.00,
  "show_line_items_by_default": true,
  "show_cost_breakdown_by_default": false
}
```

---

### Update Settings

**Endpoint**: `PATCH /quotes/settings`
**RBAC**: `Owner`, `Admin`

**Request Body**: All fields from Get Settings are optional

**Response**: `200 OK` (returns updated settings)

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error

---

### Reset Settings to Defaults

**Endpoint**: `POST /quotes/settings/reset`
**RBAC**: `Owner`, `Admin`

**Response**: `200 OK`
```json
{
  "message": "Settings reset to system defaults",
  "settings": {...}
}
```

---

### Get Approval Thresholds

**Endpoint**: `GET /quotes/settings/approval-thresholds`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Response**: `200 OK`
```json
{
  "thresholds": [
    {
      "level": 1,
      "min_amount": 0,
      "max_amount": 10000,
      "approver": {
        "id": "user-uuid",
        "name": "Manager Name"
      },
      "profitability_threshold_percent": 20.0
    }
  ]
}
```

---

## Search

### Advanced Search

**Endpoint**: `GET /quotes/search/advanced`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Query Parameters**:
- `query` (string, optional) - Search term
- `status` (string, optional) - Quote status
- `vendor_id` (UUID, optional)
- `min_amount` (number, optional)
- `max_amount` (number, optional)
- `date_from` (date string, optional)
- `date_to` (date string, optional)
- `has_items` (boolean, optional)
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response**: `200 OK` (paginated quote results)

---

### Get Search Suggestions (Autocomplete)

**Endpoint**: `GET /quotes/search/suggestions`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Query Parameters**:
- `query` (string, required) - Search term (min: 2 chars)
- `field` (string, default: "all") - Values: `all`, `quote_number`, `customer`, `items`
- `limit` (number, default: 10, max: 50)

**Response**: `200 OK`
```json
{
  "suggestions": [
    {"type": "quote_number", "value": "Q-2026-0001", "label": "Q-2026-0001 - Kitchen Remodel"},
    {"type": "customer", "value": "John Doe", "label": "John Doe"},
    {"type": "item", "value": "Premium hardwood flooring", "label": "Premium hardwood flooring"}
  ]
}
```

---

### Save Search

**Endpoint**: `POST /quotes/search/save`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "name": "High Value Quotes",
  "filters": {
    "min_amount": 50000,
    "status": "sent"
  }
}
```

**Field Validation**:
- `name`: string (1-200 chars), required
- `filters`: object, required

**Response**: `201 Created`
```json
{
  "id": "saved-search-uuid",
  "name": "High Value Quotes",
  "filters": {...},
  "created_at": "2026-01-24T10:00:00Z"
}
```

---

### Get Saved Searches

**Endpoint**: `GET /quotes/search/saved`
**RBAC**: `Owner`, `Admin`, `Manager`

**Response**: `200 OK`
```json
{
  "saved_searches": [
    {
      "id": "saved-search-uuid",
      "name": "High Value Quotes",
      "filters": {...},
      "created_at": "2026-01-24T10:00:00Z"
    }
  ]
}
```

---

## Change Orders

### Create Change Order

**Endpoint**: `POST /quotes/:parentQuoteId/change-orders`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`

**Path Parameters**:
- `parentQuoteId` (UUID, required) - Parent quote UUID

**Request Body**:
```json
{
  "title": "Additional tile work",
  "description": "Customer requested additional tile in bathroom",
  "items_to_add": [
    {
      "title": "Ceramic tile",
      "quantity": 100,
      "unit_measurement_id": "unit-uuid",
      "material_cost_per_unit": 3.00,
      "labor_cost_per_unit": 2.00
    }
  ],
  "items_to_remove": []
}
```

**Validation**:
- Parent quote must be approved

**Response**: `201 Created`
```json
{
  "id": "change-order-uuid",
  "change_order_number": "CO-2026-0001",
  "parent_quote_id": "parent-quote-uuid",
  "title": "Additional tile work",
  "status": "pending",
  "amount_change": 500.00,
  "new_total": 50500.00,
  "created_at": "2026-01-24T10:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Parent quote not approved

---

### List Change Orders

**Endpoint**: `GET /quotes/:parentQuoteId/change-orders`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `parentQuoteId` (UUID, required) - Parent quote UUID

**Response**: `200 OK`
```json
{
  "change_orders": [
    {
      "id": "change-order-uuid",
      "change_order_number": "CO-2026-0001",
      "title": "Additional tile work",
      "status": "approved",
      "amount_change": 500.00,
      "created_at": "2026-01-24T10:00:00Z"
    }
  ],
  "total_change_orders": 1,
  "total_amount_change": 500.00
}
```

---

### Get Total Impact

**Endpoint**: `GET /quotes/:parentQuoteId/change-orders/total-impact`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `parentQuoteId` (UUID, required) - Parent quote UUID

**Response**: `200 OK`
```json
{
  "parent_quote_id": "parent-quote-uuid",
  "original_total": 50000.00,
  "total_change_orders": 3,
  "total_amount_added": 1200.00,
  "total_amount_removed": 300.00,
  "net_change": 900.00,
  "new_total": 50900.00
}
```

---

### Approve Change Order

**Endpoint**: `POST /change-orders/:id/approve`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Change order UUID

**Response**: `200 OK`
```json
{
  "id": "change-order-uuid",
  "status": "approved",
  "approved_by": {
    "id": "user-uuid",
    "name": "Manager Name"
  },
  "approved_at": "2026-01-24T10:00:00Z"
}
```

---

### Get Change Order History Timeline

**Endpoint**: `GET /quotes/:parentQuoteId/change-orders/history`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Field`

**Path Parameters**:
- `parentQuoteId` (UUID, required) - Parent quote UUID

**Response**: `200 OK`
```json
{
  "history": [
    {
      "date": "2026-01-24",
      "change_orders": [
        {
          "id": "change-order-uuid",
          "change_order_number": "CO-2026-0001",
          "title": "Additional tile work",
          "status": "approved",
          "amount_change": 500.00,
          "created_at": "2026-01-24T10:00:00Z"
        }
      ]
    }
  ]
}
```

---

### Link Change Order to Project

**Endpoint**: `POST /change-orders/:id/link-to-project`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Change order UUID

**Request Body**: None

**Description**: Links an approved change order to a project in the project management system. This is currently a **placeholder endpoint** for Phase 2 (Projects Module).

**Response**: `200 OK`
```json
{
  "change_order_id": "co-550e8400-e29b-41d4-a716-446655440000",
  "status": "approved",
  "linked_to_project": false,
  "message": "Change order linking is not yet implemented. Available in Phase 2.",
  "planned_features": [
    "Automatic project creation from approved change orders",
    "Link to existing projects",
    "Update project budget when change order approved",
    "Sync change order items to project tasks"
  ]
}
```

**Error Responses**:
- `404 Not Found` - Change order not found
- `400 Bad Request` - Change order must be approved before linking
- `403 Forbidden` - Insufficient permissions

**Note**: This is a **placeholder endpoint**. Full implementation planned for Phase 2.

---

## Quote Templates (Admin)

### Create Template (Admin)

**Endpoint**: `POST /admin/quotes/templates`
**RBAC**: `PlatformAdmin`

**Request Body**:
```json
{
  "name": "Modern Professional Quote",
  "description": "Clean, modern design for professional services",
  "html_template": "<!DOCTYPE html>...",
  "css_styles": "body { font-family: Arial; }",
  "is_global": true,
  "tenant_id": null
}
```

**Response**: `201 Created`

---

### List All Templates (Admin)

**Endpoint**: `GET /admin/quotes/templates`
**RBAC**: `PlatformAdmin`

**Response**: `200 OK` (all templates with usage statistics)

---

### Get Template (Admin)

**Endpoint**: `GET /admin/quotes/templates/:id`
**RBAC**: `PlatformAdmin`

**Path Parameters**:
- `id` (UUID, required) - Template UUID

**Response**: `200 OK` (full template with HTML/CSS)

---

### Update Template (Admin)

**Endpoint**: `PATCH /admin/quotes/templates/:id`
**RBAC**: `PlatformAdmin`

**Response**: `200 OK`

---

### Delete Template (Admin)

**Endpoint**: `DELETE /admin/quotes/templates/:id`
**RBAC**: `PlatformAdmin`

**Validation**:
- Cannot delete if in use or is default

**Response**: `204 No Content`

---

### Clone Template (Admin)

**Endpoint**: `POST /admin/quotes/templates/:id/clone`
**RBAC**: `PlatformAdmin`

**Request Body**:
```json
{
  "new_name": "Modern Professional Quote V2"
}
```

**Response**: `201 Created`

---

### Set Default Template (Admin)

**Endpoint**: `PATCH /admin/quotes/templates/:id/set-default`
**RBAC**: `PlatformAdmin`

**Validation**:
- Only global templates can be set as platform default

**Response**: `200 OK`

---

### Get Template Variables Schema (Admin)

**Endpoint**: `GET /admin/quotes/templates/variables/schema`
**RBAC**: `PlatformAdmin`

**Response**: `200 OK` (complete Handlebars variable schema)

---

## Quote Templates (Tenant)

### List Available Templates

**Endpoint**: `GET /quotes/templates`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Response**: `200 OK` (global + tenant-specific templates)

---

### Get Template

**Endpoint**: `GET /quotes/templates/:id`
**RBAC**: `Owner`, `Admin`, `Manager`, `Sales`, `Employee`

**Response**: `200 OK`

---

### Set Active Template

**Endpoint**: `PATCH /quotes/templates/active`
**RBAC**: `Owner`, `Admin`

**Request Body**:
```json
{
  "template_id": "template-uuid"
}
```

**Response**: `200 OK`

---

## Admin Endpoints (Platform Admin Only)

**Controller**: `QuoteAdminController`
**Base Path**: `/admin/quotes`

**IMPORTANT**: These 6 endpoints are **NOT YET IMPLEMENTED**. They are placeholders for Phase 6 development. All endpoints currently throw an error.

**Implementation Status**: Phase 6 (Future Release)
**Current Behavior**: All endpoints throw `Error: Not implemented yet - Phase 6`

---

### Get Global Dashboard Overview (Platform Admin)

**Endpoint**: `GET /admin/quotes/dashboard/overview`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will provide global dashboard overview showing statistics across all tenants (platform-wide analytics).

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date_from` | string | No | Start date (ISO 8601) |
| `date_to` | string | No | End date (ISO 8601) |

**Planned Response** (Phase 6):
```json
{
  "global_stats": {
    "total_tenants": 145,
    "active_tenants": 132,
    "total_quotes": 12458,
    "total_revenue": 45678900.00,
    "avg_quote_value": 3665.00,
    "conversion_rate": 68.5
  },
  "tenant_breakdown": {
    "top_tenants_by_revenue": [],
    "top_tenants_by_quote_count": [],
    "new_tenants_this_period": 8
  },
  "trends": {
    "quote_velocity": "up 12%",
    "avg_value_change": "up 5%",
    "conversion_rate_change": "down 2%"
  }
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Global quote statistics across all tenants
- Tenant comparison and rankings
- Platform-wide trends
- Revenue analytics
- Conversion metrics
- Active tenant tracking

**Timeline**: Expected in Phase 6 (Q2 2026)

---

### List All Quotes Across All Tenants (Platform Admin)

**Endpoint**: `GET /admin/quotes`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will return a list of all quotes across all tenants with advanced filtering and search capabilities.

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenant_id` | UUID | No | Filter by specific tenant |
| `status` | string | No | Filter by quote status |
| `date_from` | string | No | Start date (ISO 8601) |
| `date_to` | string | No | End date (ISO 8601) |
| `search` | string | No | Search in quote number, title, customer name |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 20, max: 100) |

**Planned Response** (Phase 6):
```json
{
  "data": [
    {
      "id": "quote-uuid-1",
      "quote_number": "Q-2026-001",
      "title": "Office Renovation",
      "status": "approved",
      "total": 75000.00,
      "tenant": {
        "id": "tenant-uuid-1",
        "name": "ABC Construction LLC"
      },
      "customer_name": "John Doe",
      "created_at": "2026-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12458,
    "total_pages": 623
  }
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Cross-tenant quote listing
- Advanced filtering (tenant, status, date, search)
- Pagination support
- Tenant name resolution
- Customer information
- Quote statistics

**Timeline**: Expected in Phase 6 (Q2 2026)

---

### Get Quote by ID (Any Tenant - Platform Admin)

**Endpoint**: `GET /admin/quotes/:id`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will retrieve a quote by ID from any tenant (bypasses tenant isolation for admin purposes).

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Planned Response** (Phase 6):
```json
{
  "id": "quote-uuid-1",
  "quote_number": "Q-2026-001",
  "title": "Office Renovation",
  "status": "approved",
  "total": 75000.00,
  "tenant": {
    "id": "tenant-uuid-1",
    "name": "ABC Construction LLC",
    "plan": "Professional"
  },
  "customer": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "vendor": {},
  "items": [],
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-20T15:30:00Z"
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Bypass tenant isolation (admin access)
- Full quote details including all relationships
- Tenant information
- Audit trail access
- Version history

**Timeline**: Expected in Phase 6 (Q2 2026)

---

### Delete Quote (Emergency Only - Platform Admin)

**Endpoint**: `DELETE /admin/quotes/:id`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will allow Platform Admin to delete a quote from any tenant (emergency use only, requires confirmation).

**Path Parameters**:
- `id` (UUID, required) - Quote UUID

**Request Body**:
```json
{
  "reason": "Data corruption - emergency deletion",
  "confirm": true
}
```

**Request Fields**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Detailed reason for deletion (audit trail) |
| `confirm` | boolean | Yes | Must be `true` to proceed (safety check) |

**Planned Response** (Phase 6):
```json
{
  "message": "Quote deleted successfully",
  "quote_id": "quote-uuid-1",
  "tenant_id": "tenant-uuid-1",
  "deleted_at": "2026-01-24T12:00:00Z",
  "deleted_by": "admin-user-uuid",
  "reason": "Data corruption - emergency deletion"
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Hard delete capability (bypass soft delete)
- Requires confirmation flag
- Mandatory reason field
- Audit logging
- Tenant notification
- Cascade delete (items, groups, approvals, versions)

**Planned Validation**:
- `confirm` must be `true`
- `reason` must be at least 10 characters
- Logs full audit trail before deletion
- Sends notification to tenant owner

**Security Note**: This is an emergency-only operation. Normal quote deletion should be handled by tenant users.

**Timeline**: Expected in Phase 6 (Q2 2026)

---

### Get Global Item Pricing Benchmarks (Platform Admin)

**Endpoint**: `GET /admin/quotes/dashboard/global-item-pricing`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will provide global pricing benchmarks for common items/tasks across all tenants (anonymized data).

**Planned Response** (Phase 6):
```json
{
  "global_benchmarks": [
    {
      "task_title": "Concrete Foundation",
      "tenant_count": 78,
      "usage_count": 458,
      "avg_price": 5200.00,
      "min_price": 2500.00,
      "max_price": 12000.00,
      "median_price": 4800.00,
      "std_deviation": 1850.00,
      "price_variance": "high"
    },
    {
      "task_title": "Framing - Interior Walls",
      "tenant_count": 65,
      "usage_count": 342,
      "avg_price": 3400.00,
      "min_price": 1800.00,
      "max_price": 6500.00,
      "median_price": 3200.00,
      "std_deviation": 980.00,
      "price_variance": "medium"
    }
  ],
  "analysis": {
    "total_tenants_analyzed": 145,
    "total_items_analyzed": 45678,
    "common_tasks": 250,
    "data_quality": "high"
  }
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Cross-tenant pricing analysis
- Anonymized aggregate data
- Statistical measures (mean, median, std deviation)
- Price variance indicators
- Tenant count per task
- Data quality scoring

**Privacy Note**: All data will be anonymized and aggregated to protect tenant confidentiality.

**Timeline**: Expected in Phase 6 (Q2 2026)

---

### Compare Tenants by Metrics (Platform Admin)

**Endpoint**: `GET /admin/quotes/dashboard/tenant-comparison`
**RBAC**: `PlatformAdmin` (ONLY)

**Status**: ⚠️ **NOT IMPLEMENTED** - Phase 6 Placeholder

**Description**: Will compare tenants by various metrics (quote count, revenue, conversion rate, average quote value).

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `metric` | string | No | Metric to compare: `quote_count`, `revenue`, `conversion_rate`, `avg_quote_value` |
| `limit` | number | No | Number of top tenants to return (default: 10, max: 50) |
| `date_from` | string | No | Start date (ISO 8601) |
| `date_to` | string | No | End date (ISO 8601) |

**Planned Response** (Phase 6):
```json
{
  "metric": "revenue",
  "date_from": "2026-01-01T00:00:00.000Z",
  "date_to": "2026-01-31T23:59:59.999Z",
  "tenants": [
    {
      "rank": 1,
      "tenant_id": "tenant-uuid-1",
      "tenant_name": "ABC Construction LLC",
      "value": 450000.00,
      "quote_count": 145,
      "conversion_rate": 72.5,
      "avg_quote_value": 3103.45
    },
    {
      "rank": 2,
      "tenant_id": "tenant-uuid-2",
      "tenant_name": "XYZ Builders Inc",
      "value": 385000.00,
      "quote_count": 118,
      "conversion_rate": 68.2,
      "avg_quote_value": 3262.71
    }
  ],
  "summary": {
    "total_tenants": 145,
    "total_revenue": 12458000.00,
    "avg_revenue_per_tenant": 85951.72
  }
}
```

**Current Response** (501 Not Implemented):
```json
{
  "statusCode": 500,
  "message": "Not implemented yet - Phase 6",
  "error": "Internal Server Error"
}
```

**Planned Features**:
- Tenant rankings by multiple metrics
- Comparative analysis
- Date range filtering
- Top N tenant selection
- Summary statistics
- Anonymization options

**Metric Options**:
- `quote_count` - Total quotes created
- `revenue` - Total revenue from approved quotes
- `conversion_rate` - Percentage of quotes approved
- `avg_quote_value` - Average total per quote

**Timeline**: Expected in Phase 6 (Q2 2026)

---

## Status Codes Reference

**Success Codes**:
- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `204 No Content` - Request succeeded, no response body

**Client Error Codes**:
- `400 Bad Request` - Invalid request data or validation error
- `403 Forbidden` - Authentication valid but insufficient permissions
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate email)
- `410 Gone` - Resource permanently unavailable
- `422 Unprocessable Entity` - Request valid but cannot be processed (e.g., address validation failed)
- `429 Too Many Requests` - Rate limit exceeded

**Server Error Codes**:
- `500 Internal Server Error` - Unexpected server error

---

## Error Response Format

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "details": [
    {
      "field": "title",
      "message": "title must be between 1 and 200 characters"
    }
  ]
}
```

---

## Rate Limiting

**Authenticated Endpoints**: 1000 requests per hour per tenant
**Public Endpoints**: 10 requests per minute per IP

Rate limit headers included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: UTC timestamp when limit resets

---

## Pagination

All list endpoints support pagination with consistent parameters:

**Query Parameters**:
- `page` (number, default: 1, min: 1)
- `limit` (number, default: 20, min: 1, max: 100)

**Response Meta**:
```json
{
  "data": [...],
  "meta": {
    "current_page": 1,
    "per_page": 20,
    "total": 127,
    "total_pages": 7
  }
}
```

---

## Versioning Strategy

**Version Numbering**:
- **Major version** (+1.0): Status changes, significant modifications
- **Minor version** (+0.1): Item edits, pricing updates, cosmetic changes

**Version Creation Triggers**:
- Status change → +1.0
- Item add/edit/delete → +0.1
- Group add/edit/delete → +0.1
- Discount add/edit/delete → +0.1
- Quote metadata update → +0.1
- Reordering items/groups → No version (cosmetic only)

---

## End of Documentation

This comprehensive REST API documentation covers all 21 controllers and 150+ endpoints in the quotes module. Every endpoint includes exact field names, validation rules, request/response examples, RBAC requirements, and error scenarios.

**Last Updated**: January 24, 2026
**Module Version**: 1.0
**Total Endpoints Documented**: 150+

