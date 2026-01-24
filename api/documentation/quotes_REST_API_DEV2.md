# Quote Module REST API - Developer 2
## Vendor, Bundle, Settings & Template Management

**Version**: 1.0
**Last Updated**: January 2026
**Developer**: Backend Developer 2
**Status**: ✅ Complete

---

## Overview

Total Endpoints: **41**

- **Vendor Management**: 8 endpoints
- **Unit Measurement System**: 10 endpoints (4 admin + 6 tenant)
- **Bundle/Package System**: 8 endpoints
- **Quote Settings Management**: 4 endpoints
- **PDF Template System**: 11 endpoints (8 admin + 3 tenant)

---

## Authentication

All endpoints require JWT Bearer token authentication except where noted.

**Header**:
```
Authorization: Bearer <JWT_TOKEN>
```

**User Object** (available in `req.user`):
```typescript
{
  id: string;           // User UUID
  tenant_id: string;    // Tenant UUID
  role: string;         // User role (Owner, Admin, Manager, Sales, Employee, Platform Admin)
}
```

---

## Error Response Format

All endpoints use consistent error response format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

**Common Status Codes**:
- `400` Bad Request - Invalid input or business logic violation
- `401` Unauthorized - Missing or invalid JWT token
- `403` Forbidden - Insufficient permissions (RBAC)
- `404` Not Found - Resource doesn't exist
- `409` Conflict - Duplicate resource (e.g., email already exists)
- `422` Unprocessable Entity - External validation failed (e.g., Google Maps)

---

## 💰 Quote Financial Fields (Auto-Calculated)

**Important**: The following quote financial fields are **automatically calculated** by `QuotePricingService` and should **NOT** be manually set:

| Field | Type | Description | Auto-Calculated |
|-------|------|-------------|-----------------|
| `subtotal` | DECIMAL(12,2) | Subtotal before discounts (includes profit, overhead, contingency markups) | ✅ Yes |
| `discount_amount` | DECIMAL(12,2) | Total discount amount from all discount rules | ✅ Yes |
| `tax_amount` | DECIMAL(12,2) | Tax amount (subtotal after discounts × tax rate) | ✅ Yes |
| `total` | DECIMAL(12,2) | Final total (subtotal - discount_amount + tax_amount) | ✅ Yes |

**Recalculation Triggers**:
- Quote item created, updated, or deleted
- Discount rule created, updated, or deleted
- Quote custom percentages updated (profit/overhead/contingency)

**Calculation Order**:
1. Item subtotal = SUM(all item costs)
2. Apply profit/overhead/contingency markups (compounding)
3. Calculate subtotal before discounts
4. Apply discount rules (percentage first, then fixed)
5. Calculate tax on discounted subtotal
6. Calculate final total

**See**: [`quotes_PRICING_LOGIC.md`](./quotes_PRICING_LOGIC.md) for comprehensive calculation documentation.

---

# Vendor Management

Base Path: `/api/v1/vendors`

## 1. Create Vendor

**Endpoint**: `POST /vendors`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Request Body

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

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 1-200 characters |
| email | string | Yes | Valid email format, unique per tenant |
| phone | string | Yes | Exactly 10 digits |
| address_line1 | string | Yes | 1-255 characters |
| address_line2 | string | No | 1-255 characters |
| city | string | No | 1-100 characters |
| state | string | No | Exactly 2 characters |
| zip_code | string | Yes | 5 or 9 digits with optional dash (e.g., 02101 or 02101-1234) |
| latitude | number | No | Decimal latitude coordinate |
| longitude | number | No | Decimal longitude coordinate |
| signature_file_id | string | Yes | Valid UUID, file must exist and belong to tenant |
| is_default | boolean | No | Set as default vendor (unsets others) |

### Success Response (201)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ABC Construction Inc",
  "email": "vendor@abcconstruction.com",
  "phone": "5551234567",
  "address_line1": "123 Main St",
  "address_line2": "Suite 100",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02101",
  "latitude": "42.36010000",
  "longitude": "-71.05890000",
  "google_place_id": "ChIJGzE9DS1l44kRoOhiASS_fHg",
  "signature_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "is_default": false,
  "created_by_user_id": "440e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T10:30:00.000Z"
}
```

### Error Responses

**409 Conflict** - Email already exists:
```json
{
  "statusCode": 409,
  "message": "Email already in use",
  "error": "Conflict"
}
```

**404 Not Found** - Signature file not found:
```json
{
  "statusCode": 404,
  "message": "Signature file not found",
  "error": "Not Found"
}
```

**422 Unprocessable Entity** - Address validation failed:
```json
{
  "statusCode": 422,
  "message": "Address validation failed: unable to geocode address",
  "error": "Unprocessable Entity"
}
```

### Business Logic

1. Validates email uniqueness within tenant
2. Validates signature file exists and belongs to tenant
3. Geocodes address using Google Maps API if lat/lng not provided
4. If `is_default=true`, unsets default flag on other vendors
5. Stores validated address with coordinates and Google Place ID
6. Creates audit log entry

### Example cURL

```bash
curl -X POST https://api.lead360.app/api/v1/vendors \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Construction Inc",
    "email": "vendor@abcconstruction.com",
    "phone": "5551234567",
    "address_line1": "123 Main St",
    "zip_code": "02101",
    "signature_file_id": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

---

## 2. List Vendors

**Endpoint**: `GET /vendors`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| is_active | boolean | No | - | Filter by active status |
| page | number | No | 1 | Page number (min: 1) |
| limit | number | No | 50 | Items per page (min: 1, max: 100) |

### Success Response (200)

```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "ABC Construction Inc",
      "email": "vendor@abcconstruction.com",
      "phone": "5551234567",
      "address_line1": "123 Main St",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "is_active": true,
      "is_default": true,
      "signature_file": {
        "file_id": "550e8400-e29b-41d4-a716-446655440000",
        "filename": "signature.png",
        "public_url": "https://cdn.lead360.app/signatures/abc.png"
      },
      "created_at": "2026-01-23T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

### Example cURL

```bash
curl -X GET "https://api.lead360.app/api/v1/vendors?is_active=true&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Get Vendor

**Endpoint**: `GET /vendors/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Success Response (200)

```json
{
  "id": "660e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "ABC Construction Inc",
  "email": "vendor@abcconstruction.com",
  "phone": "5551234567",
  "address_line1": "123 Main St",
  "address_line2": "Suite 100",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02101",
  "latitude": "42.36010000",
  "longitude": "-71.05890000",
  "google_place_id": "ChIJGzE9DS1l44kRoOhiASS_fHg",
  "signature_file_id": "550e8400-e29b-41d4-a716-446655440000",
  "is_active": true,
  "is_default": true,
  "signature_file": {
    "file_id": "550e8400-e29b-41d4-a716-446655440000",
    "filename": "signature.png",
    "public_url": "https://cdn.lead360.app/signatures/abc.png",
    "size": 45678,
    "mime_type": "image/png"
  },
  "created_by_user_id": "440e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T10:30:00.000Z"
}
```

### Error Responses

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Vendor not found",
  "error": "Not Found"
}
```

---

## 4. Update Vendor

**Endpoint**: `PATCH /vendors/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Request Body

All fields are optional (partial update):

```json
{
  "name": "ABC Construction LLC",
  "email": "newvendor@abc.com",
  "phone": "5559876543",
  "address_line1": "456 Oak Ave",
  "zip_code": "02139",
  "is_default": true
}
```

### Success Response (200)

Returns updated vendor object (same format as GET /vendors/:id).

### Error Responses

Same as Create Vendor endpoint.

---

## 5. Delete Vendor

**Endpoint**: `DELETE /vendors/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Success Response (204)

No content returned.

### Error Responses

**400 Bad Request** - Vendor in use:
```json
{
  "statusCode": 400,
  "message": "Cannot delete vendor. It is used in 5 quote(s)",
  "error": "Bad Request"
}
```

**404 Not Found**:
```json
{
  "statusCode": 404,
  "message": "Vendor not found",
  "error": "Not Found"
}
```

---

## 6. Set Default Vendor

**Endpoint**: `PATCH /vendors/:id/set-default`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Success Response (200)

Returns updated vendor object with `is_default: true`.

---

## 7. Upload Vendor Signature

**Endpoint**: `POST /vendors/:id/signature`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Request Body

```json
{
  "file_id": "770e8400-e29b-41d4-a716-446655440000"
}
```

**Note**: File must be uploaded via `/api/v1/files` endpoint first, then provide the `file_id` here.

### Success Response (200)

Returns updated vendor object with new signature_file_id.

---

## 8. Get Vendor Statistics

**Endpoint**: `GET /vendors/:id/stats`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Vendor UUID |

### Success Response (200)

```json
{
  "vendor_id": "660e8400-e29b-41d4-a716-446655440000",
  "total_quotes": 15,
  "quotes_by_status": {
    "draft": 3,
    "pending": 5,
    "approved": 4,
    "accepted": 2,
    "converted": 1
  }
}
```

---

# Unit Measurement System

## Admin Endpoints

Base Path: `/api/v1/admin/units`

### 9. Create Global Unit (Admin)

**Endpoint**: `POST /admin/units`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Request Body

```json
{
  "name": "Square Meter",
  "abbreviation": "sq m"
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 1-100 characters, unique globally |
| abbreviation | string | Yes | 1-20 characters |

### Success Response (201)

```json
{
  "id": "880e8400-e29b-41d4-a716-446655440000",
  "tenant_id": null,
  "name": "Square Meter",
  "abbreviation": "sq m",
  "is_global": true,
  "is_active": true,
  "created_by_user_id": "990e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T10:30:00.000Z"
}
```

### Error Responses

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Global unit with this name already exists",
  "error": "Conflict"
}
```

---

### 10. List Global Units (Admin)

**Endpoint**: `GET /admin/units`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Query Parameters

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| is_active | boolean | No | - |
| page | number | No | 1 |
| limit | number | No | 50 |

### Success Response (200)

Returns paginated list of global units (tenant_id = null).

---

### 11. Update Global Unit (Admin)

**Endpoint**: `PATCH /admin/units/:id`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Request Body

```json
{
  "name": "Square Metre",
  "abbreviation": "m²"
}
```

### Success Response (200)

Returns updated unit object.

---

### 12. Seed Default Units (Admin)

**Endpoint**: `POST /admin/units/seed-defaults`
**Auth**: Required (JWT)
**Roles**: Platform Admin

**Description**: Creates 10 default global units (idempotent - skips existing).

**Default Units**:
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

### Success Response (200)

```json
{
  "message": "Default units seeded successfully",
  "created": 10,
  "skipped": 0,
  "created_units": ["Each", "Square Foot", "Linear Foot", "Hour", "Cubic Yard", "Ton", "Gallon", "Pound", "Box", "Bundle"],
  "skipped_units": []
}
```

---

## Tenant Endpoints

Base Path: `/api/v1/units`

### 13. Create Tenant Custom Unit

**Endpoint**: `POST /units`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Request Body

```json
{
  "name": "Pallet",
  "abbreviation": "plt"
}
```

### Success Response (201)

```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Pallet",
  "abbreviation": "plt",
  "is_global": false,
  "is_active": true,
  "created_by_user_id": "440e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T10:30:00.000Z"
}
```

### Error Responses

**409 Conflict**:
```json
{
  "statusCode": 409,
  "message": "Unit with this name already exists for your tenant",
  "error": "Conflict"
}
```

---

### 14. List Available Units (Tenant)

**Endpoint**: `GET /units`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

**Description**: Returns global units (admin-created) + tenant-specific custom units.

### Success Response (200)

```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "tenant_id": null,
      "name": "Square Foot",
      "abbreviation": "sq ft",
      "is_global": true,
      "is_active": true
    },
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Pallet",
      "abbreviation": "plt",
      "is_global": false,
      "is_active": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "totalPages": 1
  }
}
```

---

### 15. Get Unit

**Endpoint**: `GET /units/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

Returns unit details (global or tenant-specific).

---

### 16. Update Tenant Custom Unit

**Endpoint**: `PATCH /units/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

**Important**: Can only update tenant-specific units, not global units.

### Error Responses

**403 Forbidden** - Attempting to edit global unit:
```json
{
  "statusCode": 403,
  "message": "Cannot edit global units",
  "error": "Forbidden"
}
```

---

### 17. Delete Tenant Custom Unit

**Endpoint**: `DELETE /units/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

### Error Responses

**400 Bad Request** - Unit in use:
```json
{
  "statusCode": 400,
  "message": "Cannot delete unit. It is used in 12 record(s)",
  "error": "Bad Request"
}
```

**403 Forbidden** - Attempting to delete global unit:
```json
{
  "statusCode": 403,
  "message": "Cannot delete global units via tenant endpoint",
  "error": "Forbidden"
}
```

---

### 18. Get Unit Usage Statistics

**Endpoint**: `GET /units/:id/stats`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Success Response (200)

```json
{
  "unit_id": "880e8400-e29b-41d4-a716-446655440000",
  "usage": {
    "quote_items": 45,
    "item_library": 12,
    "bundle_items": 8,
    "total": 65
  }
}
```

---

# Bundle/Package System

Base Path: `/api/v1/bundles`

### 19. Create Bundle

**Endpoint**: `POST /bundles`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Request Body

```json
{
  "name": "Complete Kitchen Remodel",
  "description": "Standard kitchen renovation package",
  "discount_type": "percentage",
  "discount_value": 10.0,
  "items": [
    {
      "item_library_id": "bb0e8400-e29b-41d4-a716-446655440000",
      "title": "Kitchen Cabinet Installation",
      "description": "Custom kitchen cabinets",
      "quantity": 15,
      "unit_measurement_id": "880e8400-e29b-41d4-a716-446655440000",
      "material_cost_per_unit": 250.0,
      "labor_cost_per_unit": 150.0,
      "equipment_cost_per_unit": 0,
      "subcontract_cost_per_unit": 0,
      "other_cost_per_unit": 0,
      "order_index": 0
    },
    {
      "title": "Countertop Installation",
      "description": "Granite countertops",
      "quantity": 25,
      "unit_measurement_id": "880e8400-e29b-41d4-a716-446655440000",
      "material_cost_per_unit": 85.0,
      "labor_cost_per_unit": 45.0,
      "equipment_cost_per_unit": 0,
      "subcontract_cost_per_unit": 0,
      "other_cost_per_unit": 0,
      "order_index": 1
    }
  ]
}
```

### Validation Rules

**Bundle**:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 1-200 characters |
| description | string | No | Text |
| discount_type | enum | No | 'percentage' or 'fixed_amount' |
| discount_value | number | No* | >= 0; if percentage: 0-100 |
| items | array | Yes | Minimum 1 item |

*Required if discount_type is set

**Bundle Item**:
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| item_library_id | string | No | Valid UUID (optional reference) |
| title | string | Yes | 1-200 characters |
| description | string | No | Text |
| quantity | number | Yes | > 0 |
| unit_measurement_id | string | Yes | Valid UUID, unit must be active |
| material_cost_per_unit | number | Yes | >= 0 |
| labor_cost_per_unit | number | Yes | >= 0 |
| equipment_cost_per_unit | number | Yes | >= 0 |
| subcontract_cost_per_unit | number | Yes | >= 0 |
| other_cost_per_unit | number | Yes | >= 0 |
| order_index | number | Yes | >= 0 |

### Success Response (201)

Returns complete bundle with all items nested.

### Error Responses

**400 Bad Request** - Validation errors:
```json
{
  "statusCode": 400,
  "message": "Bundle must have at least one item",
  "error": "Bad Request"
}
```

```json
{
  "statusCode": 400,
  "message": "Percentage discount must be between 0 and 100",
  "error": "Bad Request"
}
```

**400 Bad Request** - Invalid unit:
```json
{
  "statusCode": 400,
  "message": "One or more unit measurements not found or inactive",
  "error": "Bad Request"
}
```

---

### 20. List Bundles

**Endpoint**: `GET /bundles`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Success Response (200)

```json
{
  "data": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Complete Kitchen Remodel",
      "description": "Standard kitchen renovation package",
      "discount_type": "percentage",
      "discount_value": "10.00",
      "is_active": true,
      "_count": {
        "items": 2
      },
      "created_at": "2026-01-23T10:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 21. Get Bundle

**Endpoint**: `GET /bundles/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Success Response (200)

Returns complete bundle with nested items array and unit measurement details.

---

### 22. Update Bundle

**Endpoint**: `PATCH /bundles/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

**Note**: Updates bundle metadata only (name, description, discount). Use item endpoints to modify items.

### Request Body

```json
{
  "name": "Premium Kitchen Remodel",
  "discount_type": "percentage",
  "discount_value": 15.0
}
```

---

### 23. Delete Bundle

**Endpoint**: `DELETE /bundles/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

**Note**: Cascades to delete all associated items automatically.

---

### 24. Add Item to Bundle

**Endpoint**: `POST /bundles/:id/items`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Request Body

Same structure as bundle item in Create Bundle endpoint.

---

### 25. Update Bundle Item

**Endpoint**: `PATCH /bundles/:bundleId/items/:itemId`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Request Body

Partial update of item fields.

---

### 26. Delete Bundle Item

**Endpoint**: `DELETE /bundles/:bundleId/items/:itemId`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager

### Error Responses

**400 Bad Request** - Last item:
```json
{
  "statusCode": 400,
  "message": "Cannot delete last item. Bundle must have at least one item",
  "error": "Bad Request"
}
```

---

# Quote Settings Management

Base Path: `/api/v1/quotes/settings`

### 27. Get Quote Settings

**Endpoint**: `GET /quotes/settings`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Success Response (200)

```json
{
  "default_profit_margin": 20.0,
  "default_overhead_rate": 10.0,
  "default_contingency_rate": 5.0,
  "default_quote_terms": "Payment due upon completion",
  "default_payment_instructions": "Check or cash accepted",
  "default_quote_validity_days": 30,
  "is_using_system_defaults": false
}
```

**Note**: Returns tenant-specific settings with system defaults as fallback.

---

### 28. Update Quote Settings

**Endpoint**: `PATCH /quotes/settings`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

### Request Body

All fields optional:

```json
{
  "default_profit_margin": 25.0,
  "default_overhead_rate": 12.0,
  "default_contingency_rate": 5.0,
  "default_quote_terms": "Net 30 terms available",
  "default_payment_instructions": "ACH, check, or cash accepted",
  "default_quote_validity_days": 45
}
```

### Validation Rules

| Field | Type | Rules |
|-------|------|-------|
| default_profit_margin | number | 0-100 (percentage) |
| default_overhead_rate | number | 0-100 (percentage) |
| default_contingency_rate | number | 0-100 (percentage) |
| default_quote_terms | string | Text |
| default_payment_instructions | string | Text |
| default_quote_validity_days | number | >= 1 |

### Success Response (200)

Returns updated settings object.

---

### 29. Reset Settings to Defaults

**Endpoint**: `POST /quotes/settings/reset`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

**Description**: Clears tenant-specific settings and reverts to system defaults.

### Success Response (200)

Returns settings object with system defaults.

---

### 30. Get Approval Thresholds

**Endpoint**: `GET /quotes/settings/approval-thresholds`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

### Success Response (200)

```json
{
  "approval_levels": [
    {
      "level": 1,
      "role": "Manager",
      "min_amount": 0,
      "max_amount": 10000,
      "description": "Manager approval required for quotes up to $10,000"
    },
    {
      "level": 2,
      "role": "Admin",
      "min_amount": 10000,
      "max_amount": 50000,
      "description": "Admin approval required for quotes $10,000 - $50,000"
    },
    {
      "level": 3,
      "role": "Owner",
      "min_amount": 50000,
      "max_amount": null,
      "description": "Owner approval required for quotes over $50,000"
    }
  ]
}
```

---

# PDF Template System

## Admin Endpoints

Base Path: `/api/v1/admin/quotes/templates`

### 31. Create Template (Admin)

**Endpoint**: `POST /admin/quotes/templates`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Request Body

```json
{
  "name": "Modern Professional Quote",
  "description": "Clean modern design with company branding",
  "html_content": "<html>...</html>",
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "tenant_id": null,
  "is_global": true,
  "is_default": false
}
```

### Validation Rules

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| name | string | Yes | 1-200 characters |
| description | string | No | Text |
| html_content | string | Yes | Min 1 character (Handlebars HTML) |
| thumbnail_url | string | No | URL |
| tenant_id | string | No | UUID or null (null = global) |
| is_global | boolean | No | Default: based on tenant_id |
| is_default | boolean | No | Default: false |

### Success Response (201)

Returns created template object.

---

### 32. List All Templates (Admin)

**Endpoint**: `GET /admin/quotes/templates`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| is_active | boolean | Filter by active status |
| is_global | boolean | Filter global templates |
| tenant_id | string | Filter by specific tenant |
| page | number | Page number |
| limit | number | Items per page |

### Success Response (200)

Returns paginated templates with usage count.

---

### 33. Get Template (Admin)

**Endpoint**: `GET /admin/quotes/templates/:id`
**Auth**: Required (JWT)
**Roles**: Platform Admin

Returns complete template including html_content.

---

### 34. Update Template (Admin)

**Endpoint**: `PATCH /admin/quotes/templates/:id`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Request Body

Partial update:

```json
{
  "name": "Modern Professional Quote V2",
  "html_content": "<html>...updated...</html>",
  "is_default": true
}
```

---

### 35. Delete Template (Admin)

**Endpoint**: `DELETE /admin/quotes/templates/:id`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Error Responses

**400 Bad Request** - Default template:
```json
{
  "statusCode": 400,
  "message": "Cannot delete default template",
  "error": "Bad Request"
}
```

**400 Bad Request** - Template in use:
```json
{
  "statusCode": 400,
  "message": "Cannot delete template. It is used in 15 quote(s)",
  "error": "Bad Request"
}
```

**400 Bad Request** - Active template for tenants:
```json
{
  "statusCode": 400,
  "message": "Cannot delete template. It is set as active template for 3 tenant(s)",
  "error": "Bad Request"
}
```

---

### 36. Clone Template (Admin)

**Endpoint**: `POST /admin/quotes/templates/:id/clone`
**Auth**: Required (JWT)
**Roles**: Platform Admin

### Request Body

```json
{
  "new_name": "Modern Professional Quote V2"
}
```

**Note**: If `new_name` not provided, defaults to "{Original Name} (Copy)".

### Success Response (201)

Returns cloned template (always `is_default: false`).

---

### 37. Set Default Template (Admin)

**Endpoint**: `PATCH /admin/quotes/templates/:id/set-default`
**Auth**: Required (JWT)
**Roles**: Platform Admin

**Note**: Only global templates can be set as platform default.

### Error Responses

**403 Forbidden**:
```json
{
  "statusCode": 403,
  "message": "Only global templates can be set as platform default",
  "error": "Forbidden"
}
```

---

### 38. Get Template Variables Schema (Admin)

**Endpoint**: `GET /admin/quotes/templates/variables/schema`
**Auth**: Required (JWT)
**Roles**: Platform Admin

**Description**: Returns complete Handlebars variable schema for template development.

### Success Response (200)

```json
{
  "quote": {
    "id": { "type": "string", "description": "Quote UUID", "example": "550e8400-e29b-41d4-a716" },
    "quote_number": { "type": "string", "description": "Sequential quote number", "example": "Q-2024-001" },
    "title": { "type": "string", "description": "Quote title", "example": "Kitchen Renovation" },
    "status": { "type": "string", "enum": ["draft", "pending", "approved", ...] }
  },
  "customer": {
    "first_name": { "type": "string", "example": "John" },
    "last_name": { "type": "string", "example": "Doe" }
  },
  "vendor": {
    "name": { "type": "string", "example": "ABC Construction Inc" },
    "signature_url": { "type": "string", "example": "https://cdn.example.com/signatures/abc.png" }
  },
  "items": {
    "_description": "Array of items, iterate with {{#each items}}",
    "_example": [...]
  },
  "totals": {
    "subtotal": { "type": "number", "format": "currency" },
    "total": { "type": "number", "format": "currency" }
  }
}
```

---

## Tenant Endpoints

Base Path: `/api/v1/quotes/templates`

### 39. List Available Templates (Tenant)

**Endpoint**: `GET /quotes/templates`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

**Description**: Returns global templates + tenant-specific templates (no html_content).

### Success Response (200)

```json
{
  "data": [
    {
      "id": "dd0e8400-e29b-41d4-a716-446655440000",
      "tenant_id": null,
      "name": "Modern Professional Quote",
      "description": "Clean modern design",
      "thumbnail_url": "https://cdn.example.com/thumb.png",
      "is_global": true,
      "is_default": true,
      "is_active": true,
      "created_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {...}
}
```

---

### 40. Get Template (Tenant)

**Endpoint**: `GET /quotes/templates/:id`
**Auth**: Required (JWT)
**Roles**: Owner, Admin, Manager, Sales, Employee

**Description**: Get template details including html_content (if accessible).

### Error Responses

**404 Not Found** - Template not accessible:
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

---

### 41. Set Active Template (Tenant)

**Endpoint**: `PATCH /quotes/templates/active`
**Auth**: Required (JWT)
**Roles**: Owner, Admin

**Description**: Select which template to use for new quotes.

### Request Body

```json
{
  "template_id": "dd0e8400-e29b-41d4-a716-446655440000"
}
```

### Success Response (200)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "active_quote_template_id": "dd0e8400-e29b-41d4-a716-446655440000",
  "active_quote_template": {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "name": "Modern Professional Quote",
    "description": "Clean modern design",
    "thumbnail_url": "https://cdn.example.com/thumb.png",
    "is_global": true
  }
}
```

---

## Summary

**Developer 2 Deliverables**: ✅ Complete

- **41 Endpoints Implemented**
- **5 Services Created**
- **25+ DTOs with Validation**
- **100% API Documentation Coverage**
- **Multi-Tenant Isolation Enforced**
- **RBAC Security Implemented**
- **Google Maps Integration Working**
- **File Storage Integration Working**
- **Audit Logging Complete**
- **Transaction Handling Implemented**

**Next**: Backend Developer 3 can now implement Quote CRUD operations using these services.
