# Financial Gate 1 Module - Complete REST API Documentation

**Version**: 1.0
**Last Updated**: March 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Multi-Tenant Isolation](#multi-tenant-isolation)
3. [Error Response Format](#error-response-format)
4. [System Default Categories](#system-default-categories)
5. [Financial Categories](#financial-categories)
6. [Financial Entries](#financial-entries)
7. [Project Financial Summary](#project-financial-summary)
8. [Business Rules](#business-rules)
9. [Pagination Format](#pagination-format)

---

## Authentication

All endpoints require JWT authentication.

**Header Required**:
```
Authorization: Bearer <JWT_TOKEN>
```

**RBAC Roles**:
- `Owner` - Full access to all financial resources (categories + entries)
- `Admin` - Full access to all financial resources (categories + entries)
- `Manager` - Can create/read categories and create/read/update entries
- `Employee` - No access to financial module

**Role Permissions Summary**:

| Action | Owner | Admin | Manager |
|--------|-------|-------|---------|
| Create Category | Yes | Yes | Yes |
| List Categories | Yes | Yes | Yes |
| Update Category | Yes | Yes | No |
| Delete (Deactivate) Category | Yes | Yes | No |
| Create Entry | Yes | Yes | Yes |
| List Entries | Yes | Yes | Yes |
| Get Entry | Yes | Yes | Yes |
| Update Entry | Yes | Yes | Yes |
| Delete Entry | Yes | Yes | Yes |
| View Project Financial Summary | Yes | Yes | Yes |

---

## Multi-Tenant Isolation

All endpoints automatically filter data by the authenticated user's `tenant_id`. Cross-tenant access is strictly prohibited.

- `tenant_id` is derived server-side from the JWT token
- Clients never send `tenant_id` in requests
- All database queries are scoped to the authenticated tenant
- Category references (e.g., `category_id` on entries) are validated to belong to the same tenant

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

**Common HTTP Status Codes**:

| Status Code | Description |
|-------------|-------------|
| `400` | Bad Request - Validation error or business rule violation |
| `401` | Unauthorized - Missing or invalid JWT token |
| `403` | Forbidden - Insufficient role permissions |
| `404` | Not Found - Resource does not exist or belongs to another tenant |
| `500` | Internal Server Error - Unexpected server error |

---

## System Default Categories

When a new tenant is created, the following 9 system default categories are automatically seeded. These categories have `is_system_default: true` and **cannot be deactivated or deleted**.

| Name | Type | Description |
|------|------|-------------|
| Labor - General | `labor` | Default labor category |
| Labor - Crew Overtime | `labor` | Overtime labor costs |
| Materials - General | `material` | Default materials category |
| Materials - Tools | `equipment` | Tools and small equipment |
| Materials - Safety Equipment | `equipment` | Safety gear and equipment |
| Subcontractor - General | `subcontractor` | Default subcontractor category |
| Equipment Rental | `equipment` | Equipment rental costs |
| Fuel & Transportation | `other` | Fuel and transportation expenses |
| Miscellaneous | `other` | Miscellaneous expenses |

Tenants can create additional custom categories as needed.

---

## Financial Categories

Financial categories define how expenses are classified. Categories are scoped per tenant and used to tag financial entries.

**Base Path**: `/settings/financial-categories`

---

### Create Financial Category

**Endpoint**: `POST /settings/financial-categories`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "name": "Materials - Concrete",
  "type": "material",
  "description": "Concrete and cement products"
}
```

**Field Validation**:
- `name`: string (1-200 chars), **required**
- `type`: enum (`labor` | `material` | `subcontractor` | `equipment` | `other`), **required**
- `description`: string, optional

**Response**: `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Materials - Concrete",
  "type": "material",
  "description": "Concrete and cement products",
  "is_active": true,
  "is_system_default": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-03-12T10:00:00.000Z",
  "updated_at": "2026-03-12T10:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient role permissions

---

### List Financial Categories

**Endpoint**: `GET /settings/financial-categories`
**RBAC**: `Owner`, `Admin`, `Manager`

**Description**: List all active financial categories for the tenant, ordered by type then name.

**Response**: `200 OK`
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Labor - General",
    "type": "labor",
    "description": "Default labor category",
    "is_active": true,
    "is_system_default": true,
    "created_by_user_id": null,
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Labor - Crew Overtime",
    "type": "labor",
    "description": "Overtime labor costs",
    "is_active": true,
    "is_system_default": true,
    "created_by_user_id": null,
    "created_at": "2026-01-15T10:30:00.000Z",
    "updated_at": "2026-01-15T10:30:00.000Z"
  },
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
    "name": "Materials - Concrete",
    "type": "material",
    "description": "Concrete and cement products",
    "is_active": true,
    "is_system_default": false,
    "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
    "created_at": "2026-03-12T10:00:00.000Z",
    "updated_at": "2026-03-12T10:00:00.000Z"
  }
]
```

**Notes**:
- Returns only active categories (`is_active: true`)
- Results are ordered by `type` (alphabetical), then by `name` (alphabetical)
- Includes both system default and custom categories

---

### Update Financial Category

**Endpoint**: `PATCH /settings/financial-categories/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Financial Category UUID

**Request Body** (all fields optional):
```json
{
  "name": "Materials - Concrete & Cement",
  "description": "Updated description for concrete materials"
}
```

**Field Validation**:
- `name`: string (1-200 chars), optional
- `description`: string, optional
- `type`: **NOT updatable** - will be ignored or rejected if provided

**Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Materials - Concrete & Cement",
  "type": "material",
  "description": "Updated description for concrete materials",
  "is_active": true,
  "is_system_default": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-03-12T10:00:00.000Z",
  "updated_at": "2026-03-12T14:30:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid data or validation error
- `404 Not Found` - Category not found or belongs to another tenant

---

### Delete (Deactivate) Financial Category

**Endpoint**: `DELETE /settings/financial-categories/:id`
**RBAC**: `Owner`, `Admin`

**Path Parameters**:
- `id` (UUID, required) - Financial Category UUID

**Description**: Soft deletes (deactivates) a category by setting `is_active` to `false`. System default categories **cannot** be deactivated.

**Response**: `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "name": "Materials - Concrete & Cement",
  "type": "material",
  "description": "Updated description for concrete materials",
  "is_active": false,
  "is_system_default": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-03-12T10:00:00.000Z",
  "updated_at": "2026-03-12T15:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Cannot deactivate a system default category
- `404 Not Found` - Category not found or belongs to another tenant

**Notes**:
- This is a soft delete (sets `is_active = false`)
- System default categories (`is_system_default: true`) cannot be deactivated
- Deactivated categories will no longer appear in the list endpoint
- Existing financial entries referencing this category are not affected

---

## Financial Entries

Financial entries track individual expenses against projects. Each entry is associated with a project, a financial category, and optionally a task, crew member, or subcontractor.

**Base Path**: `/financial`

---

### Create Financial Entry

**Endpoint**: `POST /financial/entries`
**RBAC**: `Owner`, `Admin`, `Manager`

**Request Body**:
```json
{
  "project_id": "a50e8400-e29b-41d4-a716-446655440000",
  "task_id": null,
  "category_id": "550e8400-e29b-41d4-a716-446655440005",
  "amount": 450.00,
  "entry_date": "2026-03-10",
  "vendor_name": "Home Depot",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "2x4 studs for framing"
}
```

**Field Validation**:
- `project_id`: UUID, **required** - must reference a valid project within the same tenant
- `task_id`: UUID, optional - must reference a valid task within the same tenant
- `category_id`: UUID, **required** - must reference an active financial category within the same tenant
- `amount`: number (greater than 0), **required**
- `entry_date`: ISO date string, **required** - cannot be a future date
- `vendor_name`: string (max 200 chars), optional
- `crew_member_id`: UUID, optional - must reference a valid crew member within the same tenant
- `subcontractor_id`: UUID, optional - must reference a valid subcontractor within the same tenant
- `notes`: string, optional

**Response**: `201 Created`
```json
{
  "id": "b50e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "project_id": "a50e8400-e29b-41d4-a716-446655440000",
  "task_id": null,
  "category_id": "550e8400-e29b-41d4-a716-446655440005",
  "category": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "name": "Materials - Lumber",
    "type": "material"
  },
  "entry_type": "expense",
  "amount": 450.00,
  "entry_date": "2026-03-10T00:00:00.000Z",
  "vendor_name": "Home Depot",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "2x4 studs for framing",
  "has_receipt": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "updated_by_user_id": null,
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-10T14:00:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Validation error (invalid amount, future date, category not found in tenant, etc.)
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Insufficient role permissions

---

### List Financial Entries

**Endpoint**: `GET /financial/entries`
**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `project_id` | UUID | **Yes** | - | Filter entries by project |
| `task_id` | UUID | No | - | Filter entries by task |
| `category_id` | UUID | No | - | Filter entries by category |
| `date_from` | ISO date | No | - | Filter entries from this date (inclusive) |
| `date_to` | ISO date | No | - | Filter entries up to this date (inclusive) |
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `20` | Items per page (min: 1, max: 100) |

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "b50e8400-e29b-41d4-a716-446655440000",
      "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
      "project_id": "a50e8400-e29b-41d4-a716-446655440000",
      "task_id": null,
      "category_id": "550e8400-e29b-41d4-a716-446655440005",
      "category": {
        "id": "550e8400-e29b-41d4-a716-446655440005",
        "name": "Materials - Lumber",
        "type": "material"
      },
      "entry_type": "expense",
      "amount": 450.00,
      "entry_date": "2026-03-10T00:00:00.000Z",
      "vendor_name": "Home Depot",
      "crew_member_id": null,
      "subcontractor_id": null,
      "notes": "2x4 studs for framing",
      "has_receipt": false,
      "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
      "updated_by_user_id": null,
      "created_at": "2026-03-10T14:00:00.000Z",
      "updated_at": "2026-03-10T14:00:00.000Z"
    },
    {
      "id": "b50e8400-e29b-41d4-a716-446655440001",
      "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
      "project_id": "a50e8400-e29b-41d4-a716-446655440000",
      "task_id": "c50e8400-e29b-41d4-a716-446655440000",
      "category_id": "550e8400-e29b-41d4-a716-446655440000",
      "category": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Labor - General",
        "type": "labor"
      },
      "entry_type": "expense",
      "amount": 1200.00,
      "entry_date": "2026-03-11T00:00:00.000Z",
      "vendor_name": null,
      "crew_member_id": "d50e8400-e29b-41d4-a716-446655440000",
      "subcontractor_id": null,
      "notes": "8 hours framing work",
      "has_receipt": false,
      "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
      "updated_by_user_id": null,
      "created_at": "2026-03-11T16:00:00.000Z",
      "updated_at": "2026-03-11T16:00:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

**Notes**:
- `project_id` is a **required** query parameter
- Results include the nested `category` object with `id`, `name`, and `type`

---

### Get Financial Entry

**Endpoint**: `GET /financial/entries/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Financial Entry UUID

**Response**: `200 OK`
```json
{
  "id": "b50e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "project_id": "a50e8400-e29b-41d4-a716-446655440000",
  "task_id": null,
  "category_id": "550e8400-e29b-41d4-a716-446655440005",
  "category": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "name": "Materials - Lumber",
    "type": "material"
  },
  "entry_type": "expense",
  "amount": 450.00,
  "entry_date": "2026-03-10T00:00:00.000Z",
  "vendor_name": "Home Depot",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "2x4 studs for framing",
  "has_receipt": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "updated_by_user_id": null,
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-10T14:00:00.000Z"
}
```

**Error Responses**:
- `404 Not Found` - Entry not found or belongs to another tenant

---

### Update Financial Entry

**Endpoint**: `PATCH /financial/entries/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Financial Entry UUID

**Request Body** (all fields optional):
```json
{
  "task_id": "c50e8400-e29b-41d4-a716-446655440000",
  "category_id": "550e8400-e29b-41d4-a716-446655440005",
  "amount": 525.00,
  "entry_date": "2026-03-10",
  "vendor_name": "Lowe's",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "Updated: 2x4 studs and plywood for framing"
}
```

**Field Validation**:
- `project_id`: **NOT updatable** - will be ignored or rejected if provided
- `task_id`: UUID, optional
- `category_id`: UUID, optional - must reference an active financial category within the same tenant
- `amount`: number (greater than 0), optional
- `entry_date`: ISO date string, optional - cannot be a future date
- `vendor_name`: string (max 200 chars), optional
- `crew_member_id`: UUID, optional
- `subcontractor_id`: UUID, optional
- `notes`: string, optional

**Response**: `200 OK`
```json
{
  "id": "b50e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "650e8400-e29b-41d4-a716-446655440001",
  "project_id": "a50e8400-e29b-41d4-a716-446655440000",
  "task_id": "c50e8400-e29b-41d4-a716-446655440000",
  "category_id": "550e8400-e29b-41d4-a716-446655440005",
  "category": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "name": "Materials - Lumber",
    "type": "material"
  },
  "entry_type": "expense",
  "amount": 525.00,
  "entry_date": "2026-03-10T00:00:00.000Z",
  "vendor_name": "Lowe's",
  "crew_member_id": null,
  "subcontractor_id": null,
  "notes": "Updated: 2x4 studs and plywood for framing",
  "has_receipt": false,
  "created_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "updated_by_user_id": "750e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-12T09:15:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request` - Validation error (invalid amount, future date, category not in tenant, etc.)
- `404 Not Found` - Entry not found or belongs to another tenant

---

### Delete Financial Entry

**Endpoint**: `DELETE /financial/entries/:id`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `id` (UUID, required) - Financial Entry UUID

**Description**: Permanently deletes (hard delete) a financial entry.

**Response**: `200 OK`
```json
{
  "message": "Financial entry deleted successfully"
}
```

**Error Responses**:
- `404 Not Found` - Entry not found or belongs to another tenant
- `403 Forbidden` - Requires Owner, Admin, or Manager role

**Notes**:
- This is a **hard delete** - the entry is permanently removed from the database
- This action cannot be undone

---

## Project Financial Summary

Provides an aggregated cost summary for a project, broken down by category type.

---

### Get Project Financial Summary

**Endpoint**: `GET /projects/:projectId/financial-summary`
**RBAC**: `Owner`, `Admin`, `Manager`

**Path Parameters**:
- `projectId` (UUID, required) - Project UUID

**Description**: Returns the total actual cost for a project, broken down by category type (`labor`, `material`, `subcontractor`, `equipment`, `other`), along with the total number of financial entries.

**Response**: `200 OK`
```json
{
  "project_id": "a50e8400-e29b-41d4-a716-446655440000",
  "total_actual_cost": 12500.00,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 4500.00,
    "subcontractor": 2000.00,
    "equipment": 800.00,
    "other": 200.00
  },
  "entry_count": 15
}
```

**Response Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | UUID | The project identifier |
| `total_actual_cost` | number | Sum of all financial entry amounts for this project |
| `cost_by_category` | object | Breakdown of costs by category type |
| `cost_by_category.labor` | number | Total labor costs |
| `cost_by_category.material` | number | Total material costs |
| `cost_by_category.subcontractor` | number | Total subcontractor costs |
| `cost_by_category.equipment` | number | Total equipment costs |
| `cost_by_category.other` | number | Total other/miscellaneous costs |
| `entry_count` | number | Total number of financial entries for this project |

**Notes**:
- Category types with no entries will show `0.00`
- Only entries belonging to the authenticated tenant are included
- The summary is computed in real-time from the financial entries

**Error Responses**:
- `404 Not Found` - Project not found or belongs to another tenant

---

## Business Rules

### Financial Category Rules

1. **Category Type is Immutable**: Once a category is created, its `type` field (`labor`, `material`, `subcontractor`, `equipment`, `other`) cannot be changed. Update requests that include `type` will be ignored or rejected.

2. **System Defaults Cannot Be Deactivated**: Categories with `is_system_default: true` cannot be deleted or deactivated. Attempting to do so returns a `400 Bad Request` error.

3. **Soft Delete Only**: Deleting a category sets `is_active = false` rather than removing the record. This preserves referential integrity with existing financial entries.

4. **Tenant Scoping**: Categories are scoped per tenant. A category created by Tenant A is invisible to Tenant B.

### Financial Entry Rules

1. **Amount Must Be Positive**: The `amount` field must be greater than `0`. Zero and negative values are rejected with a `400 Bad Request` error.

2. **Entry Date Cannot Be in the Future**: The `entry_date` must be today or a past date. Future dates are rejected with a `400 Bad Request` error.

3. **Category Must Belong to Same Tenant**: The `category_id` must reference an active financial category that belongs to the same tenant as the authenticated user. Cross-tenant category references are rejected.

4. **Project ID is Not Updatable**: Once a financial entry is created, its `project_id` cannot be changed via the update endpoint.

5. **Hard Delete**: Unlike categories, financial entries are permanently deleted (hard delete) when the delete endpoint is called.

6. **Entry Type**: All entries in Gate 1 are of type `expense`. The `entry_type` field is automatically set and not user-controllable.

### Cross-Entity Validation

- `project_id` must reference a valid project within the tenant
- `task_id` (if provided) must reference a valid task within the tenant
- `category_id` must reference an active financial category within the tenant
- `crew_member_id` (if provided) must reference a valid crew member within the tenant
- `subcontractor_id` (if provided) must reference a valid subcontractor within the tenant

---

## Pagination Format

Paginated endpoints return data in the following format:

```json
{
  "data": [ ... ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}
```

**Meta Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of records matching the query |
| `page` | number | Current page number |
| `limit` | number | Number of items per page |
| `pages` | number | Total number of pages |

**Default Pagination Values**:
- `page`: `1`
- `limit`: `20` (max: `100`)

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| March 2026 | 1.0 | Initial Financial Gate 1 API documentation | System |
