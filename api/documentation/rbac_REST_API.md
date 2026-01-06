# RBAC REST API Documentation (Frontend - Owner/Admin Endpoints)

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer Token (JWT)
**Date**: January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Error Handling](#error-handling)
4. [User Roles Endpoints](#user-roles-endpoints)
   - [Get User Roles](#get-user-roles)
   - [Get User Permissions](#get-user-permissions)
   - [Assign Role to User](#assign-role-to-user)
   - [Remove Role from User](#remove-role-from-user)
   - [Replace User Roles](#replace-user-roles)
   - [Batch Assign Roles](#batch-assign-roles)
   - [Get Users with Role](#get-users-with-role)
   - [Get Permission Matrix](#get-permission-matrix)

---

## Overview

The RBAC (Role-Based Access Control) API provides endpoints for **Owner** and **Admin** users to manage role assignments within their tenant.

### Key Features

- **Tenant-Aware**: All endpoints operate within the authenticated user's tenant context
- **Dynamic Permission Checking**: All permissions are database-driven (no hardcoded permissions)
- **Last Owner Protection**: Business logic prevents removing the last Owner in a tenant
- **Audit Logging**: All role assignments/removals are logged
- **Platform Admin Bypass**: Users with `is_platform_admin=true` bypass all checks

### Access Requirements

- **Authentication**: Valid JWT token required
- **Authorization**: Owner or Admin role required
- **Tenant Resolution**: Tenant must be resolved from JWT or subdomain

---

## Authentication & Authorization

### Authentication

All endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Authorization

All endpoints in this API require **Owner** or **Admin** role in the current tenant.

- **Owners**: Full access to all endpoints
- **Admins**: Full access to all endpoints
- **Other roles**: `403 Forbidden`

**Platform Admins** (`is_platform_admin=true`) have unrestricted access to all endpoints.

---

## Error Handling

### Standard Error Response

All endpoints return errors in this format:

```json
{
  "statusCode": 400,
  "message": "Error description here",
  "error": "Bad Request"
}
```

### Common Status Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success |
| `201` | Created successfully |
| `400` | Bad Request (validation error, business rule violation) |
| `401` | Unauthorized (missing or invalid token) |
| `403` | Forbidden (insufficient permissions) |
| `404` | Not Found |
| `409` | Conflict (duplicate entry) |
| `500` | Internal Server Error |

### Common Error Messages

- **`403 Forbidden`**: `"Access denied. Required roles: Owner, Admin"`
- **`403 Forbidden`**: `"Tenant context not found"`
- **`400 Bad Request`**: `"Cannot remove last Owner. Assign another Owner first."`
- **`404 Not Found`**: `"User not found or does not belong to this tenant"`
- **`404 Not Found`**: `"Role not found"`
- **`404 Not Found`**: `"User does not have this role"`

---

## User Roles Endpoints

### Get User Roles

Get all roles assigned to a specific user in the current tenant.

**Endpoint**: `GET /user-roles/:userId`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
[
  {
    "id": "user-role-id-123",
    "user_id": "user-id-456",
    "role_id": "role-id-789",
    "tenant_id": "tenant-id-abc",
    "assigned_by_user_id": "admin-user-id-def",
    "assigned_at": "2026-01-05T10:30:00.000Z",
    "updated_at": "2026-01-05T10:30:00.000Z",
    "role": {
      "id": "role-id-789",
      "name": "Admin",
      "description": "Administrator with full tenant access",
      "is_system": true,
      "is_active": true
    }
  },
  {
    "id": "user-role-id-124",
    "user_id": "user-id-456",
    "role_id": "role-id-790",
    "tenant_id": "tenant-id-abc",
    "assigned_by_user_id": "owner-user-id-xyz",
    "assigned_at": "2026-01-04T09:15:00.000Z",
    "updated_at": "2026-01-04T09:15:00.000Z",
    "role": {
      "id": "role-id-790",
      "name": "Estimator",
      "description": "Can create and manage quotes/estimates",
      "is_system": true,
      "is_active": true
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User role assignment ID |
| `user_id` | string | User ID |
| `role_id` | string | Role ID |
| `tenant_id` | string | Tenant ID (current tenant) |
| `assigned_by_user_id` | string \| null | ID of user who assigned this role |
| `assigned_at` | string | ISO 8601 timestamp of assignment |
| `updated_at` | string | ISO 8601 timestamp of last update |
| `role.id` | string | Role ID |
| `role.name` | string | Role name (e.g., "Owner", "Admin", "Estimator") |
| `role.description` | string \| null | Role description |
| `role.is_system` | boolean | Whether this is a system-defined role |
| `role.is_active` | boolean | Whether this role is active |

**Errors**:

- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: User not found or doesn't belong to tenant

---

### Get User Permissions

Get all permissions a user has across all their roles in the current tenant.

**Endpoint**: `GET /user-roles/:userId/permissions`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
[
  {
    "id": "permission-id-123",
    "module_id": "module-id-456",
    "action": "view",
    "display_name": "View Leads",
    "description": "Allows viewing lead details",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "module": {
      "id": "module-id-456",
      "name": "leads",
      "display_name": "Lead Management",
      "description": "Manage sales leads and opportunities",
      "is_active": true,
      "sort_order": 2,
      "icon": "Users",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  },
  {
    "id": "permission-id-124",
    "module_id": "module-id-456",
    "action": "create",
    "display_name": "Create Leads",
    "description": "Allows creating new leads",
    "is_active": true,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "module": {
      "id": "module-id-456",
      "name": "leads",
      "display_name": "Lead Management",
      "description": "Manage sales leads and opportunities",
      "is_active": true,
      "sort_order": 2,
      "icon": "Users",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Permission ID |
| `module_id` | string | Module ID this permission belongs to |
| `action` | string | Action name (e.g., "view", "create", "edit", "delete", "export") |
| `display_name` | string | Human-readable permission name |
| `description` | string \| null | Permission description |
| `is_active` | boolean | Whether this permission is active |
| `created_at` | string | ISO 8601 timestamp of creation |
| `updated_at` | string | ISO 8601 timestamp of last update |
| `module.id` | string | Module ID |
| `module.name` | string | Module name (lowercase, underscores) |
| `module.display_name` | string | Human-readable module name |
| `module.description` | string \| null | Module description |
| `module.is_active` | boolean | Whether this module is active |
| `module.sort_order` | number | Display order |
| `module.icon` | string \| null | Icon name |
| `module.created_at` | string | ISO 8601 timestamp of creation |
| `module.updated_at` | string | ISO 8601 timestamp of last update |

**Errors**:

- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: User not found

---

### Assign Role to User

Assign a role to a user in the current tenant.

**Endpoint**: `POST /user-roles/:userId/roles/:roleId`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |
| `roleId` | string | Yes | Role ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Request Body**: None

**Response** (`201 Created`):

```json
{
  "id": "user-role-id-123",
  "user_id": "user-id-456",
  "role_id": "role-id-789",
  "tenant_id": "tenant-id-abc",
  "assigned_by_user_id": "admin-user-id-def",
  "assigned_at": "2026-01-05T10:30:00.000Z",
  "updated_at": "2026-01-05T10:30:00.000Z",
  "role": {
    "id": "role-id-789",
    "name": "Estimator",
    "description": "Can create and manage quotes/estimates",
    "is_system": true,
    "is_active": true,
    "created_by_user_id": null,
    "deleted_at": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User role assignment ID |
| `user_id` | string | User ID |
| `role_id` | string | Role ID |
| `tenant_id` | string | Tenant ID |
| `assigned_by_user_id` | string | ID of user who assigned this role (you) |
| `assigned_at` | string | ISO 8601 timestamp of assignment |
| `updated_at` | string | ISO 8601 timestamp of last update |
| `role.id` | string | Role ID |
| `role.name` | string | Role name |
| `role.description` | string \| null | Role description |
| `role.is_system` | boolean | Whether this is a system role |
| `role.is_active` | boolean | Whether this role is active |
| `role.created_by_user_id` | string \| null | ID of user who created role (null for system roles) |
| `role.deleted_at` | string \| null | Soft delete timestamp (null if not deleted) |
| `role.created_at` | string | ISO 8601 timestamp of role creation |
| `role.updated_at` | string | ISO 8601 timestamp of role last update |

**Behavior**:

- **Duplicate assignment**: If role already assigned, returns existing assignment (200 OK, not 201)
- **Audit logging**: Assignment is logged to `audit_log` table

**Errors**:

- `400 Bad Request`: Cannot assign inactive role
- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: User not found or doesn't belong to tenant
- `404 Not Found`: Role not found

---

### Remove Role from User

Remove a role from a user in the current tenant.

**Endpoint**: `DELETE /user-roles/:userId/roles/:roleId`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |
| `roleId` | string | Yes | Role ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Request Body**: None

**Response** (`200 OK`):

```json
{
  "message": "Role removed successfully"
}
```

**Behavior**:

- **Last Owner Protection**: If removing Owner role and user is last Owner in tenant, returns `400 Bad Request`
- **Audit logging**: Removal is logged to `audit_log` table

**Errors**:

- `400 Bad Request`: `"Cannot remove last Owner. Assign another Owner first."`
- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: User does not have this role

---

### Replace User Roles

Replace all of a user's roles with a new set (atomic operation).

**Endpoint**: `PATCH /user-roles/:userId/roles`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `userId` | string | Yes | User ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "roleIds": ["role-id-789", "role-id-790"]
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `roleIds` | string[] | Yes | Array of role IDs to assign (replaces all existing) |

**Response** (`200 OK`):

```json
{
  "roles_added": 1,
  "roles_removed": 2,
  "current_roles": [
    {
      "id": "user-role-id-125",
      "user_id": "user-id-456",
      "role_id": "role-id-789",
      "tenant_id": "tenant-id-abc",
      "assigned_by_user_id": "admin-user-id-def",
      "assigned_at": "2026-01-05T10:35:00.000Z",
      "updated_at": "2026-01-05T10:35:00.000Z",
      "role": {
        "id": "role-id-789",
        "name": "Admin",
        "description": "Administrator with full tenant access"
      }
    },
    {
      "id": "user-role-id-126",
      "user_id": "user-id-456",
      "role_id": "role-id-790",
      "tenant_id": "tenant-id-abc",
      "assigned_by_user_id": "admin-user-id-def",
      "assigned_at": "2026-01-05T10:35:00.000Z",
      "updated_at": "2026-01-05T10:35:00.000Z",
      "role": {
        "id": "role-id-790",
        "name": "Estimator",
        "description": "Can create and manage quotes/estimates"
      }
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `roles_added` | number | Number of roles added |
| `roles_removed` | number | Number of roles removed |
| `current_roles` | array | Array of current user roles (after update) |
| `current_roles[].id` | string | User role assignment ID |
| `current_roles[].user_id` | string | User ID |
| `current_roles[].role_id` | string | Role ID |
| `current_roles[].tenant_id` | string | Tenant ID |
| `current_roles[].assigned_by_user_id` | string | ID of user who assigned role |
| `current_roles[].assigned_at` | string | ISO 8601 timestamp of assignment |
| `current_roles[].updated_at` | string | ISO 8601 timestamp of last update |
| `current_roles[].role.id` | string | Role ID |
| `current_roles[].role.name` | string | Role name |
| `current_roles[].role.description` | string \| null | Role description |

**Behavior**:

- **Atomic operation**: All changes happen in a transaction (all or nothing)
- **Last Owner Protection**: Cannot remove last Owner unless new roles include Owner
- **Audit logging**: Operation is logged to `audit_log` table

**Errors**:

- `400 Bad Request`: `"Cannot remove last Owner. Assign another Owner first."`
- `400 Bad Request`: `"One or more roles not found"`
- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: User not found

---

### Batch Assign Roles

Assign roles to multiple users at once (bulk operation).

**Endpoint**: `POST /user-roles/batch/assign`

**Required Role**: `Owner` or `Admin`

**Request Headers**:

```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body**:

```json
{
  "userIds": ["user-id-456", "user-id-457", "user-id-458"],
  "roleIds": ["role-id-789", "role-id-790"]
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userIds` | string[] | Yes | Array of user IDs |
| `roleIds` | string[] | Yes | Array of role IDs to assign to each user |

**Response** (`200 OK`):

```json
{
  "users_updated": 3,
  "roles_assigned": 5,
  "details": [
    {
      "user_id": "user-id-456",
      "roles_added": 2
    },
    {
      "user_id": "user-id-457",
      "roles_added": 2
    },
    {
      "user_id": "user-id-458",
      "roles_added": 1
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `users_updated` | number | Number of users updated |
| `roles_assigned` | number | Total number of role assignments created |
| `details` | array | Per-user details |
| `details[].user_id` | string | User ID |
| `details[].roles_added` | number | Number of roles added to this user (skips duplicates) |

**Behavior**:

- **Duplicate skip**: If user already has a role, skips it (no error)
- **Atomic operation**: All changes happen in a transaction
- **Audit logging**: Not currently logged (bulk operations)

**Errors**:

- `400 Bad Request`: `"One or more roles not found"`
- `403 Forbidden`: User lacks Owner/Admin role
- `404 Not Found`: `"One or more users not found in this tenant"`

---

### Get Users with Role

Get all users who have a specific role in the current tenant.

**Endpoint**: `GET /user-roles/role/:roleId/users`

**Required Role**: `Owner` or `Admin`

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleId` | string | Yes | Role ID (UUID) |

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
[
  {
    "id": "user-role-id-123",
    "user_id": "user-id-456",
    "role_id": "role-id-789",
    "tenant_id": "tenant-id-abc",
    "assigned_by_user_id": "admin-user-id-def",
    "assigned_at": "2026-01-05T10:30:00.000Z",
    "updated_at": "2026-01-05T10:30:00.000Z",
    "user": {
      "id": "user-id-456",
      "email": "john.doe@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "role": {
      "name": "Admin"
    }
  },
  {
    "id": "user-role-id-124",
    "user_id": "user-id-457",
    "role_id": "role-id-789",
    "tenant_id": "tenant-id-abc",
    "assigned_by_user_id": "owner-user-id-xyz",
    "assigned_at": "2026-01-04T09:15:00.000Z",
    "updated_at": "2026-01-04T09:15:00.000Z",
    "user": {
      "id": "user-id-457",
      "email": "jane.smith@example.com",
      "first_name": "Jane",
      "last_name": "Smith"
    },
    "role": {
      "name": "Admin"
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User role assignment ID |
| `user_id` | string | User ID |
| `role_id` | string | Role ID |
| `tenant_id` | string | Tenant ID |
| `assigned_by_user_id` | string \| null | ID of user who assigned role |
| `assigned_at` | string | ISO 8601 timestamp of assignment |
| `updated_at` | string | ISO 8601 timestamp of last update |
| `user.id` | string | User ID |
| `user.email` | string | User email |
| `user.first_name` | string | User first name |
| `user.last_name` | string | User last name |
| `role.name` | string | Role name |

**Errors**:

- `403 Forbidden`: User lacks Owner/Admin role

---

### Get Permission Matrix

Get a complete matrix of all roles and their permissions (useful for role management UI).

**Endpoint**: `GET /user-roles/permissions/matrix`

**Required Role**: `Owner` or `Admin`

**Request Headers**:

```
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
{
  "matrix": {
    "Owner": {
      "dashboard": ["view"],
      "leads": ["view", "create", "edit", "delete", "export"],
      "quotes": ["view", "create", "edit", "delete", "convert", "export"],
      "invoices": ["view", "create", "edit", "delete", "export"],
      "communications": ["view", "create", "edit", "delete"],
      "calendar": ["view", "create", "edit", "delete"],
      "team": ["view", "create", "edit", "delete"],
      "reports": ["view", "create", "export"],
      "time_clock": ["view", "create", "edit", "delete", "approve", "export"],
      "accounting": ["view", "create", "edit", "delete", "reconcile"],
      "settings": ["view", "edit"],
      "roles": ["view", "create", "edit", "delete", "assign"],
      "subscription": ["view", "edit"],
      "integrations": ["view", "edit"]
    },
    "Admin": {
      "dashboard": ["view"],
      "leads": ["view", "create", "edit", "delete", "export"],
      "quotes": ["view", "create", "edit", "delete", "convert", "export"],
      "invoices": ["view", "create", "edit", "delete", "export"],
      "communications": ["view", "create", "edit", "delete"],
      "calendar": ["view", "create", "edit", "delete"],
      "team": ["view", "create", "edit", "delete"],
      "reports": ["view", "create", "export"],
      "time_clock": ["view", "create", "edit", "delete", "approve", "export"],
      "accounting": ["view", "create", "edit", "delete", "reconcile"],
      "settings": ["view", "edit"],
      "roles": ["view", "assign"],
      "integrations": ["view", "edit"]
    },
    "Estimator": {
      "dashboard": ["view"],
      "leads": ["view", "create", "edit", "export"],
      "quotes": ["view", "create", "edit", "delete", "convert", "export"],
      "communications": ["view", "create"],
      "calendar": ["view", "create", "edit"],
      "reports": ["view"]
    }
  },
  "modules": [
    {
      "id": "module-id-123",
      "name": "dashboard",
      "display_name": "Dashboard",
      "description": "Main dashboard and analytics",
      "is_active": true,
      "sort_order": 1,
      "icon": "LayoutDashboard",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z",
      "permissions": [
        {
          "id": "permission-id-456",
          "action": "view",
          "display_name": "View Dashboard"
        }
      ]
    },
    {
      "id": "module-id-124",
      "name": "leads",
      "display_name": "Lead Management",
      "description": "Manage sales leads and opportunities",
      "is_active": true,
      "sort_order": 2,
      "icon": "Users",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z",
      "permissions": [
        {
          "id": "permission-id-457",
          "action": "view",
          "display_name": "View Leads"
        },
        {
          "id": "permission-id-458",
          "action": "create",
          "display_name": "Create Leads"
        },
        {
          "id": "permission-id-459",
          "action": "edit",
          "display_name": "Edit Leads"
        },
        {
          "id": "permission-id-460",
          "action": "delete",
          "display_name": "Delete Leads"
        },
        {
          "id": "permission-id-461",
          "action": "export",
          "display_name": "Export Leads"
        }
      ]
    }
  ]
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `matrix` | object | Permission matrix indexed by role name |
| `matrix[roleName][moduleName]` | string[] | Array of actions for this role + module |
| `modules` | array | Array of all active modules with permissions |
| `modules[].id` | string | Module ID |
| `modules[].name` | string | Module name (lowercase, underscores) |
| `modules[].display_name` | string | Human-readable module name |
| `modules[].description` | string \| null | Module description |
| `modules[].is_active` | boolean | Whether module is active |
| `modules[].sort_order` | number | Display order |
| `modules[].icon` | string \| null | Icon name |
| `modules[].created_at` | string | ISO 8601 timestamp of creation |
| `modules[].updated_at` | string | ISO 8601 timestamp of last update |
| `modules[].permissions` | array | Array of permissions for this module |
| `modules[].permissions[].id` | string | Permission ID |
| `modules[].permissions[].action` | string | Action name |
| `modules[].permissions[].display_name` | string | Human-readable permission name |

**Use Case**:

This endpoint is designed for building role management UIs. The frontend can:
1. Display a table/matrix showing which roles have which permissions
2. Allow Owner/Admin to compare roles
3. Guide users when creating custom roles

**Errors**:

- `403 Forbidden`: User lacks Owner/Admin role

---

## Appendix

### Standard Role Names

These are the 7 system-defined roles:

| Role Name | Description |
|-----------|-------------|
| `Owner` | Full access to all modules + subscription management |
| `Admin` | Full access except subscription management |
| `Estimator` | Can create and manage quotes/estimates |
| `Project Manager` | Can manage projects and team assignments |
| `Bookkeeper` | Financial access (invoices, accounting, reports) |
| `Employee` | Basic access (time clock, own calendar) |
| `Read-only` | View-only access to most modules |

### Standard Module Names

These are the 14 system-defined modules:

| Module Name | Display Name | Common Actions |
|-------------|--------------|----------------|
| `dashboard` | Dashboard | view |
| `leads` | Lead Management | view, create, edit, delete, export |
| `quotes` | Quote Builder | view, create, edit, delete, convert, export |
| `invoices` | Invoice Management | view, create, edit, delete, export |
| `communications` | Communications | view, create, edit, delete |
| `calendar` | Calendar | view, create, edit, delete |
| `team` | Team Management | view, create, edit, delete |
| `reports` | Reports & Analytics | view, create, export |
| `time_clock` | Time Clock | view, create, edit, delete, approve, export |
| `accounting` | Accounting | view, create, edit, delete, reconcile |
| `settings` | Settings | view, edit |
| `roles` | Role Management | view, create, edit, delete, assign |
| `subscription` | Subscription Management | view, edit |
| `integrations` | Integrations | view, edit |

---

**End of RBAC REST API Documentation (Frontend - Owner/Admin Endpoints)**
