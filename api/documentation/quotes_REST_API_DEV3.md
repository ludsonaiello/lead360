# Quote CRUD API Documentation (Developer 3)

**Version**: 1.0
**Module**: Quote Management System - Core CRUD Operations
**Developer**: Backend Developer 3
**Total Endpoints**: 36
**Last Updated**: January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Base URL](#base-url)
4. [Quote Management Endpoints](#1-quote-management-12-endpoints)
5. [Quote Items Endpoints](#2-quote-items-10-endpoints)
6. [Quote Groups Endpoints](#3-quote-groups-6-endpoints)
7. [Item Library Endpoints](#4-item-library-8-endpoints)
8. [Pricing Calculation Logic](#pricing-calculation-logic)
9. [Version History System](#version-history-system)
10. [Multi-Tenant Isolation](#multi-tenant-isolation)
11. [Error Responses](#error-responses)
12. [Business Rules](#business-rules)
13. [Transaction Safety](#transaction-safety)

---

## Overview

This document provides complete API documentation for the Quote CRUD module (Developer 3), which implements the core functionality for creating, managing, and organizing quotes in the Lead360 platform.

**Key Features**:
- Complete quote lifecycle management (draft → ready → sent → approved/denied/lost)
- Line item management with cost tracking
- Item grouping for quote organization
- Reusable item library for efficiency
- Automated version history (tracks every change)
- Centralized pricing calculations with compounding markups
- Deep cloning for quote duplication
- Multi-tenant data isolation

**What This Module Handles**:
- Quote creation from leads or new customers
- Quote updates and status transitions
- Line item CRUD operations
- Group organization
- Item library management
- Financial total calculations (stored in database)

**What This Module Does NOT Handle** (handled by other developers):
- Discount rule CRUD (Developer 4 - Pricing & Approvals)
- Draw schedule / payment schedules (Developer 4)
- Warranty tiers (Developer 4)
- Approval workflows (Developer 4)
- Public quote access (Developer 5)
- PDF generation (Developer 5)

---

## Authentication & Authorization

**Authentication**: All endpoints require JWT Bearer token authentication.

```
Authorization: Bearer <jwt_token>
```

**Authorization (RBAC)**: Role-Based Access Control is enforced per endpoint.

**Available Roles**:
- `Owner` - Full access to all resources
- `Admin` - Administrative access
- `Manager` - Management-level access
- `Sales` - Sales team access (limited to own quotes)
- `Employee` - Read-only access for most resources

**Tenant Isolation**: All requests are automatically scoped to the authenticated user's `tenant_id` (extracted from JWT). Cross-tenant access is impossible.

---

## Base URL

```
Production: https://api.lead360.app/api/v1
Development: http://localhost:3000/api/v1
```

All endpoints in this document are relative to the base URL.

**Example Full URL**:
```
https://api.lead360.app/api/v1/quotes
```

---

## 1. Quote Management (12 Endpoints)

### 1.1 Create Quote from Existing Lead

Creates a new quote linked to an existing lead. Updates the lead's status to "prospect".

**Endpoint**: `POST /quotes/from-lead/:leadId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates initial version v1.0

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| leadId | UUID | Yes | The UUID of the existing lead |

**Request Body**:
```json
{
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Kitchen Remodel - Main St Property",
  "jobsite_address": {
    "address_line1": "123 Main St",
    "address_line2": "Suite 100",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": 42.3601,
    "longitude": -71.0589
  },
  "po_number": "PO-2026-001",
  "expiration_days": 30,
  "use_default_settings": true,
  "custom_profit_percent": 25.0,
  "custom_overhead_percent": 12.0,
  "custom_contingency_percent": 5.0,
  "private_notes": "Customer prefers oak finishes"
}
```

**Request Body Schema**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| vendor_id | string (UUID) | Yes | Valid UUID, vendor must exist | Primary vendor for this quote |
| title | string | Yes | 1-200 chars | Quote title/description |
| jobsite_address | object | Yes | Nested DTO (see below) | Job site location |
| po_number | string | No | 1-100 chars | Purchase order number |
| expiration_days | number | No | Min: 1 | Days until quote expires (default: 30) |
| use_default_settings | boolean | No | - | Use tenant default pricing settings |
| custom_profit_percent | number | No | 0-100 | Override profit percentage |
| custom_overhead_percent | number | No | 0-100 | Override overhead percentage |
| custom_contingency_percent | number | No | 0-100 | Override contingency percentage |
| private_notes | string | No | - | Internal notes (not shown to customer) |

**Jobsite Address Schema**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| address_line1 | string | Yes | 1-255 chars | Street address |
| address_line2 | string | No | 1-255 chars | Apt/Suite number |
| city | string | No* | 1-100 chars | City name |
| state | string | No* | 2 chars (e.g., "MA") | State code |
| zip_code | string | Yes | Format: XXXXX or XXXXX-XXXX | ZIP code |
| latitude | number | No | -90 to 90 | GPS latitude (auto-geocoded if missing) |
| longitude | number | No | -180 to 180 | GPS longitude (auto-geocoded if missing) |

*City and state are auto-populated via reverse geocoding if latitude/longitude are provided.

**Success Response** (201 Created):
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "tenant_id": "450e8400-e29b-41d4-a716-446655440000",
  "quote_number": "Q-2026-001",
  "lead_id": "550e8400-e29b-41d4-a716-446655440002",
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "jobsite_address_id": "750e8400-e29b-41d4-a716-446655440003",
  "title": "Kitchen Remodel - Main St Property",
  "status": "draft",
  "po_number": "PO-2026-001",
  "expiration_date": "2026-02-22T00:00:00.000Z",
  "custom_profit_percent": "25.00",
  "custom_overhead_percent": "12.00",
  "custom_contingency_percent": "5.00",
  "private_notes": "Customer prefers oak finishes",
  "subtotal": "0.00",
  "discount_amount": "0.00",
  "tax_amount": "0.00",
  "total": "0.00",
  "active_version_number": "1.0",
  "is_archived": false,
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T10:30:00.000Z",
  "lead": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "first_name": "John",
    "last_name": "Doe",
    "status": "prospect"
  },
  "vendor": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ABC Supply Co",
    "is_active": true
  },
  "jobsite_address": {
    "id": "750e8400-e29b-41d4-a716-446655440003",
    "address_line1": "123 Main St",
    "address_line2": "Suite 100",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": "42.3601",
    "longitude": "-71.0589",
    "place_id": "ChIJ..."
  }
}
```

**Error Responses**:
- `404 Not Found` - Lead not found or doesn't belong to tenant
- `404 Not Found` - Vendor not found or doesn't belong to tenant
- `422 Unprocessable Entity` - Address validation failed (Google Maps)

**Business Rules**:
- Lead status is automatically updated to "prospect"
- Quote number is auto-generated (sequential per tenant, format: PREFIX-YEAR-NUMBER)
- Initial version v1.0 is created automatically
- Expiration date is calculated from expiration_days (defaults to 30 days from now)
- Address is validated via Google Maps API (geocoding/reverse geocoding)
- If custom percentages are not provided, tenant defaults are used
- Quote starts in "draft" status

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/from-lead/550e8400-e29b-41d4-a716-446655440002" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Kitchen Remodel - Main St Property",
    "jobsite_address": {
      "address_line1": "123 Main St",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101"
    }
  }'
```

---

### 1.2 Create Quote with New Customer

Creates a new lead AND a new quote in a single atomic transaction. Useful for walk-in customers or phone orders.

**Endpoint**: `POST /quotes/with-new-customer`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates initial version v1.0

**Request Body**:
```json
{
  "customer": {
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane.smith@example.com",
    "phone": "+1-555-123-4567"
  },
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Bathroom Renovation",
  "jobsite_address": {
    "address_line1": "456 Oak Ave",
    "city": "Cambridge",
    "state": "MA",
    "zip_code": "02139"
  },
  "expiration_days": 14,
  "custom_profit_percent": 20.0
}
```

**Request Body Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| customer | object | Yes | New customer information (see Customer Schema) |
| vendor_id | string (UUID) | Yes | Primary vendor UUID |
| title | string | Yes | Quote title (1-200 chars) |
| jobsite_address | object | Yes | Job site address (see Jobsite Address Schema above) |
| po_number | string | No | Purchase order number |
| expiration_days | number | No | Days until expiration (default: 30) |
| use_default_settings | boolean | No | Use tenant defaults |
| custom_profit_percent | number | No | Override profit (0-100) |
| custom_overhead_percent | number | No | Override overhead (0-100) |
| custom_contingency_percent | number | No | Override contingency (0-100) |
| private_notes | string | No | Internal notes |

**Customer Schema**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| first_name | string | Yes | 1-100 chars | Customer first name |
| last_name | string | Yes | 1-100 chars | Customer last name |
| email | string | Yes | Valid email format | Customer email (must be unique per tenant) |
| phone | string | Yes | E.164 format | Customer phone number |

**Success Response** (201 Created):
```json
{
  "quote": {
    "id": "650e8400-e29b-41d4-a716-446655440004",
    "quote_number": "Q-2026-002",
    "lead_id": "550e8400-e29b-41d4-a716-446655440005",
    "title": "Bathroom Renovation",
    "status": "draft",
    "active_version_number": "1.0",
    ...
  },
  "lead": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "first_name": "Jane",
    "last_name": "Smith",
    "status": "prospect",
    "emails": [
      {
        "email": "jane.smith@example.com",
        "is_primary": true
      }
    ],
    "phones": [
      {
        "phone": "+1-555-123-4567",
        "is_primary": true
      }
    ],
    ...
  }
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed (missing required fields, invalid formats)
- `404 Not Found` - Vendor not found
- `409 Conflict` - Email already exists for another lead in this tenant
- `422 Unprocessable Entity` - Address validation failed

**Business Rules**:
- **Transaction Safety**: If quote creation fails, lead creation is rolled back (all or nothing)
- New lead is created with source = "manual"
- Lead status is immediately set to "prospect"
- Quote number is auto-generated
- Address is validated via Google Maps
- Empty addresses array is passed to LeadsService (required field)

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/with-new-customer" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer": {
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "phone": "+1-555-123-4567"
    },
    "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Bathroom Renovation",
    "jobsite_address": {
      "address_line1": "456 Oak Ave",
      "city": "Cambridge",
      "state": "MA",
      "zip_code": "02139"
    }
  }'
```

---

### 1.3 Create Quote Manually

Creates a quote with full manual control (requires existing lead).

**Endpoint**: `POST /quotes`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates initial version v1.0

**Request Body**: Same schema as "Create from Lead" (1.1) but without the leadId path parameter. Instead, include `lead_id` in the request body:

```json
{
  "lead_id": "550e8400-e29b-41d4-a716-446655440002",
  "vendor_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Full Home Remodel",
  ...
}
```

**Success Response** (201 Created): Same as endpoint 1.1

**Error Responses**: Same as endpoint 1.1

---

### 1.4 List Quotes with Filters

Retrieves a paginated list of quotes with optional filtering and sorting.

**Endpoint**: `GET /quotes`

**RBAC**: All Roles (Owner, Admin, Manager, Sales, Employee)

**Version Impact**: None (read-only)

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| page | number | No | 1 | Page number (1-indexed) |
| limit | number | No | 20 | Items per page (max: 100) |
| status | string | No | - | Filter by status (draft, ready, sent, read, approved, denied, lost) |
| search | string | No | - | Search in quote_number, title, customer name |
| vendor_id | string (UUID) | No | - | Filter by vendor |
| min_total | number | No | - | Filter by minimum total amount |
| max_total | number | No | - | Filter by maximum total amount |
| created_after | string (ISO date) | No | - | Filter by creation date (after) |
| created_before | string (ISO date) | No | - | Filter by creation date (before) |
| sort_by | string | No | created_at | Sort field (created_at, updated_at, quote_number, total) |
| sort_order | string | No | desc | Sort order (asc, desc) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440001",
      "quote_number": "Q-2026-001",
      "title": "Kitchen Remodel",
      "status": "draft",
      "subtotal": "15000.00",
      "total": "18450.00",
      "expiration_date": "2026-02-22T00:00:00.000Z",
      "active_version_number": "1.2",
      "created_at": "2026-01-23T10:30:00.000Z",
      "lead": {
        "id": "...",
        "first_name": "John",
        "last_name": "Doe"
      },
      "vendor": {
        "id": "...",
        "name": "ABC Supply Co"
      }
    },
    ...
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Business Rules**:
- Results are automatically filtered by tenant_id
- Sales users only see quotes they created (RBAC enforcement)
- Archived quotes (is_archived = true) are excluded by default

**cURL Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/quotes?status=draft&limit=10&sort_by=total&sort_order=desc" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 1.5 Search Quotes

Full-text search across quotes.

**Endpoint**: `GET /quotes/search`

**RBAC**: All Roles

**Version Impact**: None

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| q | string | Yes | Search term (min 2 chars) |

**Searchable Fields**:
- quote_number
- title
- customer first_name + last_name
- item titles
- tags (if present)

**Success Response** (200 OK): Same structure as List Quotes (1.4)

**cURL Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/quotes/search?q=kitchen" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 1.6 Get Quote Statistics

Retrieves aggregate statistics for quotes.

**Endpoint**: `GET /quotes/statistics`

**RBAC**: Owner, Admin, Manager

**Version Impact**: None

**Success Response** (200 OK):
```json
{
  "counts": {
    "total": 150,
    "draft": 45,
    "ready": 20,
    "sent": 30,
    "read": 15,
    "approved": 25,
    "denied": 10,
    "lost": 5
  },
  "revenue": {
    "pending": "450000.00",
    "approved": "1250000.00",
    "denied": "75000.00",
    "lost": "50000.00"
  },
  "conversionRate": {
    "approvalRate": 0.416,
    "denialRate": 0.166,
    "lostRate": 0.083
  },
  "averageQuoteValue": "8333.33"
}
```

**Business Rules**:
- Statistics are scoped to tenant
- Revenue calculations use the `total` field (after markups, discounts, tax)
- Conversion rates are calculated as: approved / (approved + denied + lost)

---

### 1.7 Get Single Quote

Retrieves complete quote details with all relationships.

**Endpoint**: `GET /quotes/:id`

**RBAC**: All Roles

**Version Impact**: None

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID | Yes | Quote UUID |

**Success Response** (200 OK):
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "quote_number": "Q-2026-001",
  "title": "Kitchen Remodel",
  "status": "draft",
  "subtotal": "15000.00",
  "discount_amount": "750.00",
  "tax_amount": "1087.50",
  "total": "15337.50",
  "active_version_number": "1.3",
  "custom_profit_percent": "25.00",
  "custom_overhead_percent": "12.00",
  "custom_contingency_percent": "5.00",
  "private_notes": "Customer prefers oak finishes",
  "is_archived": false,
  "created_at": "2026-01-23T10:30:00.000Z",
  "updated_at": "2026-01-23T14:45:00.000Z",
  "lead": {
    "id": "...",
    "first_name": "John",
    "last_name": "Doe",
    "status": "prospect",
    "emails": [...],
    "phones": [...]
  },
  "vendor": {
    "id": "...",
    "name": "ABC Supply Co",
    "contact_name": "Bob Johnson",
    "email": "bob@abcsupply.com"
  },
  "jobsite_address": {
    "id": "...",
    "address_line1": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": "42.3601",
    "longitude": "-71.0589"
  },
  "items": [
    {
      "id": "...",
      "title": "Oak Hardwood Flooring",
      "quantity": "500.00",
      "unit_measurement": {
        "id": "...",
        "name": "sq ft",
        "abbreviation": "sf"
      },
      "material_cost_per_unit": "5.50",
      "labor_cost_per_unit": "3.25",
      "total_cost": "4375.00",
      "order_index": 1
    },
    ...
  ],
  "groups": [
    {
      "id": "...",
      "name": "Flooring",
      "description": "All flooring materials and labor",
      "order_index": 1,
      "subtotal": "8500.00",
      "items": [...]
    },
    ...
  ],
  "discount_rules": [...],
  "versions": [
    {
      "id": "...",
      "version_number": "1.0",
      "change_summary": "Quote created",
      "created_at": "2026-01-23T10:30:00.000Z"
    },
    {
      "id": "...",
      "version_number": "1.1",
      "change_summary": "Item added: Oak Hardwood Flooring",
      "created_at": "2026-01-23T11:15:00.000Z"
    },
    ...
  ]
}
```

**Error Responses**:
- `404 Not Found` - Quote not found or doesn't belong to tenant

**cURL Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 1.8 Update Quote

Updates basic quote information (non-financial fields).

**Endpoint**: `PATCH /quotes/:id`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1 (minor change)

**Request Body** (all fields optional):
```json
{
  "title": "Kitchen Remodel - Updated Scope",
  "po_number": "PO-2026-001-REV1",
  "expiration_days": 45,
  "custom_profit_percent": 28.0,
  "custom_overhead_percent": 15.0,
  "custom_contingency_percent": 7.0,
  "private_notes": "Customer approved oak finishes and added countertop upgrade"
}
```

**Success Response** (200 OK): Returns updated quote (same structure as 1.7)

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot edit approved quote

**Business Rules**:
- Cannot update quotes with status = "approved"
- Updating custom percentages triggers QuotePricingService to recalculate totals
- Version increments by 0.1 (e.g., 1.2 → 1.3)
- change_summary = "Quote updated: {title}"

**cURL Example**:
```bash
curl -X PATCH "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Kitchen Remodel - Updated Scope",
    "custom_profit_percent": 28.0
  }'
```

---

### 1.9 Update Quote Status

Updates quote status with validation of allowed transitions.

**Endpoint**: `PATCH /quotes/:id/status`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +1.0 (major change)

**Request Body**:
```json
{
  "status": "ready"
}
```

**Valid Status Values**: draft, ready, sent, read, approved, denied, lost

**Status Transition Rules**:
```
draft → ready (requires: items, vendor, valid address, future expiration)
ready → sent
sent → read
read → approved | denied | lost
approved → (no further transitions allowed)
denied → (no further transitions allowed)
lost → (no further transitions allowed)
```

**Success Response** (200 OK): Returns updated quote

**Error Responses**:
- `400 Bad Request` - Invalid status transition
- `400 Bad Request` - Quote not ready (missing items, expired, etc.)

**Business Rules**:
- Status change to "ready" validates:
  - At least 1 item exists
  - Vendor is set and active
  - Jobsite address is valid
  - Expiration date is in the future
- Version increments by 1.0 (e.g., 1.3 → 2.0)
- change_summary = "Status changed: {old_status} → {new_status}"

**cURL Example**:
```bash
curl -X PATCH "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/status" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "ready"}'
```

---

### 1.10 Update Jobsite Address

Re-validates and updates the jobsite address (triggers Google Maps validation).

**Endpoint**: `PATCH /quotes/:id/jobsite-address`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body**: Same as Jobsite Address Schema (see 1.1)

**Success Response** (200 OK): Returns updated quote

**Error Responses**:
- `404 Not Found` - Quote not found
- `422 Unprocessable Entity` - Address validation failed

**Business Rules**:
- Address is re-validated via Google Maps (geocoding/reverse geocoding)
- Cannot update if status = "approved"
- Version increments +0.1

---

### 1.11 Clone Quote (Deep Copy)

Creates a complete duplicate of a quote with all items, groups, discounts, and draw schedule entries.

**Endpoint**: `POST /quotes/:id/clone`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates new quote with version v1.0

**Success Response** (201 Created): Returns new quote with all cloned data

**What Gets Cloned**:
- Quote basic information (title, vendor, jobsite address)
- All line items (with new UUIDs)
- All groups (with new UUIDs)
- All discount rules (with new UUIDs)
- All draw schedule entries (with new UUIDs)
- Items grouped within groups maintain their group assignment

**What Does NOT Get Cloned**:
- Version history (new quote starts at v1.0)
- Approval records
- View logs
- Tags

**Cloned Quote Modifications**:
- New quote_number (auto-generated, next in sequence)
- Title appended with " (Copy)"
- Status reset to "draft"
- Expiration date recalculated (30 days from now)
- created_at and updated_at set to current timestamp

**Error Responses**:
- `404 Not Found` - Source quote not found

**Business Rules**:
- Clone operation is transactional (all or nothing)
- Jobsite address is duplicated (new address record created)
- Items maintain their order_index values
- Groups maintain their order_index values

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/clone" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 1.12 Delete Quote (Soft Delete)

Archives a quote (soft delete - sets is_archived = true).

**Endpoint**: `DELETE /quotes/:id`

**RBAC**: Owner, Admin only

**Version Impact**: Creates version +0.1

**Success Response**: `204 No Content` (empty body)

**Error Responses**:
- `404 Not Found` - Quote not found

**Business Rules**:
- Quote is NOT permanently deleted (data preserved)
- is_archived flag is set to true
- Archived quotes are excluded from list queries by default
- Archived quotes can still be retrieved by direct ID
- Version history is preserved
- change_summary = "Quote archived"

**cURL Example**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 2. Quote Items (10 Endpoints)

### 2.1 Add Item to Quote

Adds a new line item to a quote with cost breakdown.

**Endpoint**: `POST /quotes/:quoteId/items`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body**:
```json
{
  "title": "Premium Oak Hardwood Flooring",
  "description": "3/4 inch thick, prefinished oak hardwood",
  "quantity": 500,
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75,
  "quote_group_id": "650e8400-e29b-41d4-a716-446655440020",
  "save_to_library": true
}
```

**Request Body Schema**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | string | Yes | 1-255 chars | Item name/title |
| description | string | No | - | Detailed description |
| quantity | number | Yes | Min: 0.01 | Quantity of units |
| unit_measurement_id | UUID | Yes | Valid UUID, unit must exist | Unit of measurement (sq ft, linear ft, etc.) |
| material_cost_per_unit | number | Yes | Min: 0 | Material cost per unit |
| labor_cost_per_unit | number | Yes | Min: 0 | Labor cost per unit |
| equipment_cost_per_unit | number | No | Min: 0, Default: 0 | Equipment cost per unit |
| subcontract_cost_per_unit | number | No | Min: 0, Default: 0 | Subcontractor cost per unit |
| other_cost_per_unit | number | No | Min: 0, Default: 0 | Other costs per unit |
| quote_group_id | UUID | No | Valid UUID if provided | Group to assign this item to |
| save_to_library | boolean | No | Default: false | Save to item library after creating |

**Success Response** (201 Created):
```json
{
  "id": "750e8400-e29b-41d4-a716-446655440025",
  "quote_id": "650e8400-e29b-41d4-a716-446655440001",
  "quote_group_id": "650e8400-e29b-41d4-a716-446655440020",
  "title": "Premium Oak Hardwood Flooring",
  "description": "3/4 inch thick, prefinished oak hardwood",
  "quantity": 500.00,
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75,
  "total_cost": 5000.00,
  "order_index": 3,
  "created_at": "2026-01-23T15:20:00.000Z",
  "unit_measurement": {
    "id": "...",
    "name": "square feet",
    "abbreviation": "sq ft"
  },
  "quote_group": {
    "id": "...",
    "name": "Flooring"
  }
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `404 Not Found` - Unit measurement not found or inactive
- `404 Not Found` - Quote group not found (if quote_group_id provided)
- `400 Bad Request` - At least one cost field must be > 0
- `400 Bad Request` - Cannot add items to approved quote

**Business Rules**:
- order_index is auto-assigned (max + 1)
- total_cost is calculated: (material + labor + equipment + subcontract + other) × quantity
- **Quote totals are recalculated** via QuotePricingService (markups, discounts, tax applied)
- Unit measurement must be global OR belong to tenant
- If save_to_library = true, item is also created in item_library table
- Version increments +0.1
- change_summary = "Item added: {title}"

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/items" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Premium Oak Hardwood Flooring",
    "quantity": 500,
    "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
    "material_cost_per_unit": 5.50,
    "labor_cost_per_unit": 3.25
  }'
```

---

### 2.2 Add Item from Library

Adds an item to a quote using a template from the item library (increments usage_count).

**Endpoint**: `POST /quotes/:quoteId/items/from-library/:libraryItemId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| quoteId | UUID | Yes | Quote UUID |
| libraryItemId | UUID | Yes | Library item UUID |

**Success Response** (201 Created): Same as 2.1

**Business Rules**:
- Library item data is copied to create a new quote_item
- Library item's usage_count increments by 1
- Library item's last_used_at updated to current timestamp
- default_quantity from library is used as initial quantity
- Item is NOT linked to library (template pattern, not reference)
- Quote totals recalculated via QuotePricingService

**Error Responses**:
- `404 Not Found` - Quote or library item not found

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/items/from-library/750e8400-e29b-41d4-a716-446655440050" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2.3 List Quote Items

Retrieves all items for a quote.

**Endpoint**: `GET /quotes/:quoteId/items`

**RBAC**: All Roles

**Version Impact**: None

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| includeGrouped | boolean | No | true | Include items that belong to groups |

**Success Response** (200 OK):
```json
[
  {
    "id": "750e8400-e29b-41d4-a716-446655440025",
    "title": "Premium Oak Hardwood Flooring",
    "quantity": 500.00,
    "total_cost": 5000.00,
    "order_index": 1,
    "quote_group_id": "650e8400-e29b-41d4-a716-446655440020",
    "unit_measurement": {...}
  },
  {
    "id": "750e8400-e29b-41d4-a716-446655440026",
    "title": "Granite Countertops",
    "quantity": 50.00,
    "total_cost": 2500.00,
    "order_index": 2,
    "quote_group_id": null,
    "unit_measurement": {...}
  },
  ...
]
```

**Business Rules**:
- Results ordered by order_index ASC
- If includeGrouped = false, only returns items with quote_group_id = null (ungrouped items)
- Soft-deleted items (is_deleted = true) are excluded

---

### 2.4 Get Single Item

Retrieves a single quote item with relationships.

**Endpoint**: `GET /quotes/:quoteId/items/:itemId`

**RBAC**: All Roles

**Version Impact**: None

**Success Response** (200 OK): Same structure as item in 2.1

**Error Responses**:
- `404 Not Found` - Quote or item not found

---

### 2.5 Update Item

Updates an existing quote item.

**Endpoint**: `PATCH /quotes/:quoteId/items/:itemId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body** (all fields optional):
```json
{
  "title": "Premium Oak Hardwood Flooring - Updated",
  "description": "3/4 inch thick, prefinished oak with protective coating",
  "quantity": 600,
  "material_cost_per_unit": 5.75,
  "labor_cost_per_unit": 3.50
}
```

**Success Response** (200 OK): Returns updated item

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot edit items in approved quote

**Business Rules**:
- total_cost is recalculated if quantity or costs change
- Quote totals recalculated via QuotePricingService
- Version increments +0.1
- change_summary = "Item updated: {title}"

---

### 2.6 Delete Item

Permanently deletes a quote item (hard delete).

**Endpoint**: `DELETE /quotes/:quoteId/items/:itemId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Success Response**: `204 No Content`

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot delete items from approved quote

**Business Rules**:
- Item is permanently deleted (hard delete)
- Remaining items are reordered (order_index gaps removed)
- Quote totals recalculated via QuotePricingService
- Version increments +0.1
- change_summary = "Item deleted: {title}"

---

### 2.7 Duplicate Item

Creates a copy of an existing item (inserts after original with " (Copy)" suffix).

**Endpoint**: `POST /quotes/:quoteId/items/:itemId/duplicate`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Success Response** (201 Created): Returns duplicated item

**Error Responses**:
- `404 Not Found` - Quote or item not found
- `400 Bad Request` - Cannot duplicate items in approved quote

**Business Rules**:
- New item created with identical values (costs, quantity, etc.)
- title appended with " (Copy)"
- New UUID assigned
- Inserted with order_index = original.order_index + 1
- Subsequent items' order_index incremented
- Quote totals recalculated
- Version increments +0.1

**cURL Example**:
```bash
curl -X POST "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/items/750e8400-e29b-41d4-a716-446655440025/duplicate" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 2.8 Reorder Items

Updates the display order of items (cosmetic only, no version created).

**Endpoint**: `PATCH /quotes/:quoteId/items/reorder`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: None (cosmetic change)

**Request Body**:
```json
{
  "items": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440025",
      "order_index": 1
    },
    {
      "id": "750e8400-e29b-41d4-a716-446655440026",
      "order_index": 2
    },
    {
      "id": "750e8400-e29b-41d4-a716-446655440027",
      "order_index": 3
    }
  ]
}
```

**Success Response**: `204 No Content`

**Business Rules**:
- Only updates order_index (no other changes)
- Does NOT create a version (cosmetic change)
- Does NOT recalculate totals

---

### 2.9 Move Item to Group

Assigns an item to a group or moves it to ungrouped.

**Endpoint**: `PATCH /quotes/:quoteId/items/:itemId/move-to-group`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body**:
```json
{
  "quote_group_id": "650e8400-e29b-41d4-a716-446655440020"
}
```

**To move to ungrouped**, set quote_group_id to null:
```json
{
  "quote_group_id": null
}
```

**Success Response** (200 OK): Returns updated item

**Error Responses**:
- `404 Not Found` - Quote, item, or target group not found
- `400 Bad Request` - Cannot move items in approved quote

**Business Rules**:
- Version increments +0.1
- Quote totals recalculated (grouping can affect markup calculations in future enhancements)
- change_summary = "Item moved to group: {group_name}" or "Item moved to ungrouped"

---

### 2.10 Save Item to Library

Creates a library item template from a quote item.

**Endpoint**: `POST /quotes/:quoteId/items/:itemId/save-to-library`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: None

**Success Response** (201 Created):
```json
{
  "id": "850e8400-e29b-41d4-a716-446655440060",
  "tenant_id": "450e8400-e29b-41d4-a716-446655440000",
  "title": "Premium Oak Hardwood Flooring",
  "description": "3/4 inch thick, prefinished oak hardwood",
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
  "default_quantity": 500.00,
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75,
  "usage_count": 0,
  "is_active": true,
  "created_at": "2026-01-23T16:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - Quote or item not found

**Business Rules**:
- Creates new item_library record (template pattern)
- usage_count starts at 0
- is_active defaults to true
- Does NOT create a quote version (library operation)
- Item quantity becomes default_quantity in library

---

## 3. Quote Groups (6 Endpoints)

### 3.1 Create Group

Creates a new group for organizing related quote items.

**Endpoint**: `POST /quotes/:quoteId/groups`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body**:
```json
{
  "name": "Flooring",
  "description": "All flooring materials and labor"
}
```

**Request Body Schema**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | Yes | 1-100 chars | Group name |
| description | string | No | - | Group description |

**Success Response** (201 Created):
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440020",
  "quote_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Flooring",
  "description": "All flooring materials and labor",
  "order_index": 1,
  "created_at": "2026-01-23T16:10:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - Quote not found
- `400 Bad Request` - Cannot add groups to approved quote

**Business Rules**:
- order_index auto-assigned (max + 1)
- Empty group is allowed (items can be added later)
- Version increments +0.1
- change_summary = "Group created: {name}"

---

### 3.2 List Groups

Retrieves all groups for a quote with nested items and subtotals.

**Endpoint**: `GET /quotes/:quoteId/groups`

**RBAC**: All Roles

**Version Impact**: None

**Success Response** (200 OK):
```json
[
  {
    "id": "650e8400-e29b-41d4-a716-446655440020",
    "name": "Flooring",
    "description": "All flooring materials and labor",
    "order_index": 1,
    "subtotal": 8500.00,
    "items": [
      {
        "id": "750e8400-e29b-41d4-a716-446655440025",
        "title": "Oak Hardwood Flooring",
        "quantity": 500.00,
        "total_cost": 5000.00,
        "order_index": 1,
        "unit_measurement": {...}
      },
      {
        "id": "750e8400-e29b-41d4-a716-446655440030",
        "title": "Underlayment",
        "quantity": 500.00,
        "total_cost": 1500.00,
        "order_index": 2,
        "unit_measurement": {...}
      },
      ...
    ]
  },
  ...
]
```

**Business Rules**:
- Groups ordered by order_index ASC
- Items within groups ordered by order_index ASC
- subtotal calculated as sum of item.total_cost

---

### 3.3 Get Single Group

Retrieves a single group with items.

**Endpoint**: `GET /quotes/:quoteId/groups/:groupId`

**RBAC**: All Roles

**Version Impact**: None

**Success Response** (200 OK): Same structure as item in 3.2

**Error Responses**:
- `404 Not Found` - Quote or group not found

---

### 3.4 Update Group

Updates group name/description.

**Endpoint**: `PATCH /quotes/:quoteId/groups/:groupId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Request Body** (all fields optional):
```json
{
  "name": "Flooring Materials",
  "description": "All flooring materials, underlayment, and installation labor"
}
```

**Success Response** (200 OK): Returns updated group

**Error Responses**:
- `404 Not Found` - Quote or group not found
- `400 Bad Request` - Cannot edit groups in approved quote

**Business Rules**:
- Version increments +0.1
- change_summary = "Group updated: {name}"

---

### 3.5 Delete Group

Deletes a group with option to delete or move items.

**Endpoint**: `DELETE /quotes/:quoteId/groups/:groupId`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| delete_items | boolean | No | false | Delete items in group (default: move to ungrouped) |

**Success Response**: `204 No Content`

**Error Responses**:
- `404 Not Found` - Quote or group not found
- `400 Bad Request` - Cannot delete groups from approved quote

**Business Rules**:
- If delete_items = true: All items in group are permanently deleted, quote totals recalculated
- If delete_items = false: Items moved to ungrouped (quote_group_id set to null)
- Version increments +0.1
- change_summary = "Group deleted with items: {name}" or "Group deleted (items moved to ungrouped): {name}"

**cURL Example (delete group, keep items)**:
```bash
curl -X DELETE "https://api.lead360.app/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001/groups/650e8400-e29b-41d4-a716-446655440020?delete_items=false" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### 3.6 Duplicate Group

Clones a group with all its items.

**Endpoint**: `POST /quotes/:quoteId/groups/:groupId/duplicate`

**RBAC**: Owner, Admin, Manager, Sales

**Version Impact**: Creates version +0.1

**Success Response** (201 Created): Returns duplicated group with items

**Business Rules**:
- New group created with name = "{original_name} (Copy)"
- All items in group are cloned (new UUIDs)
- New group inserted with order_index = original.order_index + 1
- Subsequent groups' order_index incremented
- Quote totals recalculated
- Version increments +0.1
- change_summary = "Group duplicated: {name}"

**⚠️ Known Issue**: QuoteGroupService.duplicate() currently uses manual total calculation instead of QuotePricingService. It only calculates subtotal = sum(item.total_cost) and total = subtotal, missing markups, discounts, and tax. This should be refactored to call `pricingService.updateQuoteFinancials()`.

---

## 4. Item Library (8 Endpoints)

### 4.1 Create Library Item

Creates a reusable item template.

**Endpoint**: `POST /item-library`

**RBAC**: Owner, Admin, Manager

**Version Impact**: None (library operation)

**Request Body**:
```json
{
  "title": "Standard Oak Hardwood Flooring",
  "description": "3/4 inch thick, prefinished oak",
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
  "default_quantity": 500,
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75
}
```

**Request Body Schema**: Same as CreateItemDto (see 2.1) but with default_quantity instead of quantity

**Success Response** (201 Created):
```json
{
  "id": "850e8400-e29b-41d4-a716-446655440060",
  "tenant_id": "450e8400-e29b-41d4-a716-446655440000",
  "title": "Standard Oak Hardwood Flooring",
  "description": "3/4 inch thick, prefinished oak",
  "unit_measurement_id": "550e8400-e29b-41d4-a716-446655440010",
  "default_quantity": 500.00,
  "material_cost_per_unit": 5.50,
  "labor_cost_per_unit": 3.25,
  "equipment_cost_per_unit": 0.50,
  "subcontract_cost_per_unit": 0.00,
  "other_cost_per_unit": 0.75,
  "usage_count": 0,
  "last_used_at": null,
  "is_active": true,
  "created_at": "2026-01-23T17:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - Unit measurement not found or inactive
- `400 Bad Request` - At least one cost must be > 0

**Business Rules**:
- default_quantity is the suggested quantity when adding to quote
- usage_count starts at 0
- last_used_at is null until first use
- is_active defaults to true

---

### 4.2 Bulk Import Library Items

Atomically imports multiple library items (transaction: all or nothing).

**Endpoint**: `POST /item-library/bulk-import`

**RBAC**: Owner, Admin only

**Version Impact**: None

**Request Body**:
```json
{
  "items": [
    {
      "title": "Oak Flooring",
      "unit_measurement_id": "...",
      "default_quantity": 500,
      "material_cost_per_unit": 5.50,
      "labor_cost_per_unit": 3.25
    },
    {
      "title": "Granite Countertop",
      "unit_measurement_id": "...",
      "default_quantity": 50,
      "material_cost_per_unit": 45.00,
      "labor_cost_per_unit": 25.00
    },
    ...
  ]
}
```

**Success Response** (201 Created):
```json
{
  "imported": 15,
  "items": [...]
}
```

**Error Responses**:
- `400 Bad Request` - Validation failed for one or more items (transaction rolled back)

**Business Rules**:
- All items validated before import
- If ANY item fails validation, NO items are imported (atomic transaction)
- All items belong to tenant_id from JWT

---

### 4.3 List Library Items

Retrieves library items with filters.

**Endpoint**: `GET /item-library`

**RBAC**: All Roles

**Version Impact**: None

**Query Parameters**:
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| is_active | boolean | No | true | Filter by active status |
| search | string | No | - | Search in title, description |
| unit_id | UUID | No | - | Filter by unit measurement |
| page | number | No | 1 | Page number |
| limit | number | No | 20 | Items per page (max: 100) |
| sort_by | string | No | usage_count | Sort field (usage_count, title, created_at) |
| sort_order | string | No | desc | Sort order (asc, desc) |

**Success Response** (200 OK):
```json
{
  "data": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440060",
      "title": "Standard Oak Hardwood Flooring",
      "default_quantity": 500.00,
      "usage_count": 12,
      "last_used_at": "2026-01-20T14:30:00.000Z",
      "is_active": true,
      "unit_measurement": {
        "id": "...",
        "name": "square feet",
        "abbreviation": "sq ft"
      }
    },
    ...
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

**Business Rules**:
- Results automatically filtered by tenant_id
- Default sort by usage_count DESC (most used items first)

---

### 4.4 Get Single Library Item

Retrieves a single library item.

**Endpoint**: `GET /item-library/:id`

**RBAC**: All Roles

**Version Impact**: None

**Success Response** (200 OK): Same as 4.1

**Error Responses**:
- `404 Not Found` - Library item not found

---

### 4.5 Get Library Item Statistics

Retrieves usage statistics for a library item.

**Endpoint**: `GET /item-library/:id/statistics`

**RBAC**: Owner, Admin, Manager

**Version Impact**: None

**Success Response** (200 OK):
```json
{
  "usage_count": 12,
  "last_used_at": "2026-01-20T14:30:00.000Z",
  "quotes_using": [
    {
      "quote_id": "...",
      "quote_number": "Q-2026-001",
      "title": "Kitchen Remodel",
      "status": "approved"
    },
    ...
  ],
  "total_revenue_from_item": "54000.00"
}
```

**Business Rules**:
- total_revenue_from_item calculated as sum of (item.total_cost) from approved quotes
- quotes_using shows last 10 quotes that used this item

---

### 4.6 Update Library Item

Updates a library item template (only affects future uses).

**Endpoint**: `PATCH /item-library/:id`

**RBAC**: Owner, Admin, Manager

**Version Impact**: None

**Request Body** (all fields optional):
```json
{
  "title": "Standard Oak Hardwood Flooring - Updated",
  "default_quantity": 600,
  "material_cost_per_unit": 5.75
}
```

**Success Response** (200 OK): Returns updated item

**Error Responses**:
- `404 Not Found` - Library item not found

**Business Rules**:
- **Only affects future uses** - existing quote items are NOT updated
- Library items are templates, not linked references

---

### 4.7 Mark Library Item as Inactive

Soft-deletes a library item (alternative to hard delete).

**Endpoint**: `PATCH /item-library/:id/mark-inactive`

**RBAC**: Owner, Admin, Manager

**Version Impact**: None

**Success Response** (200 OK): Returns updated item with is_active = false

**Business Rules**:
- is_active set to false
- Item hidden from default list queries (is_active = true filter)
- Can still be retrieved by ID
- Preferred over hard delete when usage_count > 0

---

### 4.8 Delete Library Item

Permanently deletes a library item (only if usage_count = 0).

**Endpoint**: `DELETE /item-library/:id`

**RBAC**: Owner, Admin only

**Version Impact**: None

**Success Response**: `204 No Content`

**Error Responses**:
- `404 Not Found` - Library item not found
- `409 Conflict` - Cannot delete item with usage_count > 0

**Business Rules**:
- Hard delete only allowed if usage_count = 0
- If usage_count > 0, use "Mark Inactive" endpoint instead
- Prevents accidental deletion of frequently-used templates

---

## Pricing Calculation Logic

### Overview

Quote pricing uses a **centralized pricing service** (`QuotePricingService`) that calculates financial totals with compounding markups, sequential discounts, and tax.

**Key Principle**: Financial totals are **STORED in the database** (not calculated on-the-fly) for performance and easier statistics/reporting.

### Calculation Flow

```
1. Item Subtotal
   └─ Sum of all quote_item.total_cost values

2. Apply Compounding Markups
   ├─ Profit = itemSubtotal × (profitPercent / 100)
   ├─ Overhead = (itemSubtotal + profit) × (overheadPercent / 100)  ← COMPOUNDS on profit
   ├─ Contingency = (itemSubtotal + profit + overhead) × (contingencyPercent / 100)  ← COMPOUNDS
   └─ Subtotal Before Discounts = itemSubtotal + profit + overhead + contingency

3. Apply Sequential Discount Rules
   ├─ First: All percentage discounts (in order_index order, applied to running subtotal)
   ├─ Then: All fixed amount discounts (in order_index order)
   └─ Subtotal After Discounts = subtotal - total discounts (capped at 0)

4. Calculate Tax
   └─ Tax = subtotalAfterDiscounts × (taxRate / 100)

5. Calculate Final Total
   └─ Total = subtotalAfterDiscounts + tax
```

### Percentage Priority System

```
Quote Custom > Tenant Default > System Default

- Profit: custom_profit_percent (quote) || default_profit_margin (tenant) || 20%
- Overhead: custom_overhead_percent (quote) || default_overhead_rate (tenant) || 10%
- Contingency: custom_contingency_percent (quote) || default_contingency_rate (tenant) || 5%
- Tax Rate: sales_tax_rate (tenant) || 0%
```

### Example Calculation

**Input**:
- Item subtotal: $10,000.00
- Profit: 20%
- Overhead: 10%
- Contingency: 5%
- Discount: 5% off
- Tax rate: 7.5%

**Step-by-step**:
1. Item subtotal: $10,000.00
2. Profit (20%): $10,000 × 0.20 = $2,000.00
3. Overhead (10% of $12,000): $12,000 × 0.10 = $1,200.00
4. Contingency (5% of $13,200): $13,200 × 0.05 = $660.00
5. Subtotal before discounts: $13,860.00
6. Discount (5%): $13,860 × 0.05 = $693.00
7. Subtotal after discounts: $13,860 - $693 = $13,167.00
8. Tax (7.5%): $13,167 × 0.075 = $987.53
9. **Final Total: $14,154.53**

### When Pricing Service is Called

**Automatically triggered after**:
- Quote item create/update/delete
- Discount rule create/update/delete (Dev 4)
- Settings update (profit/overhead/contingency/tax changes)

**Method**: `QuotePricingService.updateQuoteFinancials(quoteId, tx?)`

**Database Fields Updated**:
- `quote.subtotal` (before discounts/tax)
- `quote.discount_amount`
- `quote.tax_amount`
- `quote.total` (final amount)

---

## Version History System

### Overview

Every quote change is tracked in an automated version history system. Versions are stored in the `quote_version` table with complete snapshots.

### Version Numbering

**Format**: MAJOR.MINOR (e.g., 1.0, 1.1, 2.0)

**Rules**:
- Initial version: v1.0 (created on quote creation)
- Minor changes: +0.1 (e.g., 1.0 → 1.1, 1.1 → 1.2)
- Major changes: +1.0 (e.g., 1.3 → 2.0)

**Minor Changes (+0.1)**:
- Quote basic info updated (title, notes, etc.)
- Item added/updated/deleted
- Group added/updated/deleted
- Jobsite address updated
- Quote archived

**Major Changes (+1.0)**:
- Status change (draft → ready → sent → approved, etc.)

### Version Snapshot

Each version stores a complete JSON snapshot of the quote state:

```json
{
  "quote": {
    "id": "...",
    "quote_number": "Q-2026-001",
    "title": "Kitchen Remodel",
    "status": "draft",
    "subtotal": "15000.00",
    "total": "18450.00",
    ...
  },
  "items": [...],
  "groups": [...],
  "discount_rules": [...],
  "jobsite_address": {...}
}
```

### Change Summary

Each version includes a human-readable change_summary:
- "Quote created"
- "Item added: Oak Hardwood Flooring"
- "Status changed: draft → ready"
- "Group updated: Flooring Materials"
- "Quote archived"

### Accessing Version History

**Via GET /quotes/:id**:
```json
{
  "id": "...",
  "active_version_number": "1.3",
  ...
  "versions": [
    {
      "id": "...",
      "version_number": "1.0",
      "change_summary": "Quote created",
      "created_at": "2026-01-23T10:30:00.000Z",
      "created_by_user": {...}
    },
    {
      "id": "...",
      "version_number": "1.1",
      "change_summary": "Item added: Oak Hardwood Flooring",
      "created_at": "2026-01-23T11:15:00.000Z",
      "snapshot_data": {...}
    },
    ...
  ]
}
```

### Version Immutability

- Past versions are **immutable** (cannot be edited or deleted)
- Snapshots provide complete audit trail
- Can be used for quote comparison or rollback (future feature)

---

## Multi-Tenant Isolation

### Overview

**CRITICAL**: Every API request is automatically scoped to the authenticated user's `tenant_id`. Cross-tenant data access is impossible.

### How It Works

1. **JWT Token**: Contains `tenant_id` claim
2. **Middleware**: Extracts `tenant_id` from token
3. **Service Layer**: ALL database queries include `tenant_id` filter
4. **Prisma Middleware**: Validates `tenant_id` presence on mutations

### Query Pattern

**✅ CORRECT**:
```typescript
const quote = await this.prisma.quote.findFirst({
  where: { id: quoteId, tenant_id: tenantId },
});
```

**❌ WRONG**:
```typescript
const quote = await this.prisma.quote.findUnique({
  where: { id: quoteId },  // Missing tenant_id filter - security risk!
});
```

### Global Resources

Some resources (like unit measurements) can be **global** (shared across tenants) or tenant-specific:

```typescript
const unit = await this.prisma.unit_measurement.findFirst({
  where: {
    id: unitId,
    OR: [
      { tenant_id: tenantId },               // Tenant-owned
      { is_global: true, tenant_id: null },  // Global
    ],
    is_active: true,
  },
});
```

### Tenant-Scoped Models

- Quote
- Quote Item
- Quote Group
- Vendor
- Item Library
- Quote Bundle
- Quote Tag
- Quote Warranty Tier
- Unit Measurement (can be tenant-specific or global)
- Quote Template

### Child Tables

Child tables (quote_item, quote_group, etc.) inherit tenant isolation via parent relationship:

```typescript
// No direct tenant_id filter needed - inherited from quote relationship
const items = await this.prisma.quote_item.findMany({
  where: { quote_id: quoteId },  // quote_id already validated for tenant
});
```

---

## Error Responses

### Standard Error Format

All errors follow this structure:

```json
{
  "statusCode": 404,
  "message": "Quote not found",
  "error": "Not Found",
  "timestamp": "2026-01-23T18:30:00.000Z",
  "path": "/api/v1/quotes/650e8400-e29b-41d4-a716-446655440001"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Validation error, business rule violation |
| 401 | Unauthorized | Missing or invalid JWT token |
| 403 | Forbidden | RBAC role insufficient for endpoint |
| 404 | Not Found | Resource doesn't exist or doesn't belong to tenant |
| 409 | Conflict | Uniqueness violation (e.g., duplicate email) |
| 422 | Unprocessable Entity | External validation failed (Google Maps) |
| 500 | Internal Server Error | Server error (logged for debugging) |

### Validation Error Format

**Request**:
```json
{
  "title": "",
  "quantity": -10
}
```

**Response** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": [
    "title must be between 1 and 255 characters",
    "quantity must be at least 0.01"
  ],
  "error": "Bad Request"
}
```

---

## Business Rules

### Quote Status Transitions

```
draft → ready (requires validation)
  ├─ At least 1 item
  ├─ Vendor is active
  ├─ Valid jobsite address
  └─ Expiration date in future

ready → sent (no validation)

sent → read (auto-tracked when customer views)

read → approved | denied | lost
  └─ Terminal states (no further changes allowed)
```

### Quote Editing Restrictions

**Cannot edit if status = "approved"**:
- Quote basic info
- Items (add/update/delete)
- Groups (add/update/delete)
- Jobsite address

**Allowed on approved quotes**:
- Read operations (GET endpoints)

### Item Cost Validation

- At least one cost field must be > 0:
  - material_cost_per_unit
  - labor_cost_per_unit
  - equipment_cost_per_unit
  - subcontract_cost_per_unit
  - other_cost_per_unit
- quantity must be > 0.01

### Library Item Usage Tracking

- usage_count increments when added to quote (via "Add from Library")
- last_used_at updated to current timestamp
- Cannot hard-delete if usage_count > 0 (must use "Mark Inactive")

### Quote Number Generation

- Sequential per tenant (no gaps)
- Format: `{prefix}-{year}-{number}`
- Example: Q-2026-001, Q-2026-002, Q-2026-003
- Prefix configurable per tenant (default: "Q-")
- Year is current calendar year
- Number is zero-padded to 3 digits (001, 002, ..., 999, 1000)

---

## Transaction Safety

### Atomic Operations

The following operations use database transactions (all or nothing):

1. **Create Quote with New Customer** (1.2)
   - Lead creation
   - Quote creation
   - Jobsite address creation
   - Initial version creation

2. **Clone Quote** (1.11)
   - New quote creation
   - Jobsite address duplication
   - All items duplication
   - All groups duplication
   - All discount rules duplication
   - All draw schedule entries duplication

3. **Add Item** (2.1)
   - Item creation
   - Quote totals recalculation
   - Version creation
   - Optional: Library item creation (if save_to_library = true)

4. **Delete Group with Items** (3.5 with delete_items=true)
   - Item deletion
   - Group deletion
   - Quote totals recalculation
   - Version creation

5. **Duplicate Group** (3.6)
   - Group creation
   - All items duplication
   - Order index updates
   - Quote totals recalculation
   - Version creation

6. **Bulk Import Library Items** (4.2)
   - Validates ALL items first
   - Creates ALL items atomically
   - If ANY fails, NONE are created

### Rollback Guarantees

If ANY step in a transaction fails:
- All changes are rolled back
- Database state remains unchanged
- Error is returned to client
- No partial data is persisted

### Example: Transaction Failure

**Request**: Create quote with new customer
**Failure**: Address validation fails (Google Maps returns error)
**Result**:
- Lead is NOT created
- Quote is NOT created
- User receives 422 error
- Database unchanged

---

## Contact & Support

**Frontend Team**: Use this documentation for all quote-related API integration.

**Questions**: Contact Backend Developer 3 or refer to source code:
- Controllers: `/api/src/modules/quotes/controllers/`
- Services: `/api/src/modules/quotes/services/`
- DTOs: `/api/src/modules/quotes/dto/`

**Swagger UI**: Available at `https://api.lead360.app/api/docs` for interactive testing.

**Handoff Document**: See `quotes_HANDOFF_DEV3.md` for implementation notes and known issues.

---

**End of Documentation**
