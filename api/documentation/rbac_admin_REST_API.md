# RBAC Admin REST API Documentation (Platform Admin Endpoints)

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer Token (JWT)
**Authorization**: Platform Admin Required
**Date**: January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Error Handling](#error-handling)
4. [Role Management](#role-management)
5. [Permission Management](#permission-management)
6. [Module Management](#module-management)
7. [Role Template Management](#role-template-management)

---

## Overview

The RBAC Admin API provides Platform Admin endpoints for managing the entire RBAC system across all tenants.

### Key Features

- **Platform-Wide Access**: Manage roles, permissions, and modules globally
- **System Role Protection**: System roles can be modified but use caution
- **Cascade Operations**: Deleting modules/permissions cascades to roles
- **Template System**: Pre-defined role templates for quick role creation
- **Audit Logging**: All admin operations are logged

### Access Requirements

- **Authentication**: Valid JWT token required
- **Authorization**: `is_platform_admin = true` required
- **No Tenant Context**: These endpoints operate platform-wide (no tenant filtering)

---

## Authentication & Authorization

### Authentication

All endpoints require a valid JWT access token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

### Authorization

All endpoints in this API require **Platform Admin** privileges (`is_platform_admin = true`).

- **Platform Admins**: Full access to all endpoints
- **All other users** (including Owners/Admins): `403 Forbidden`

**Response** if not Platform Admin:

```json
{
  "statusCode": 403,
  "message": "Access denied. Platform Admin privileges required.",
  "error": "Forbidden"
}
```

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
| `403` | Forbidden (Platform Admin required) |
| `404` | Not Found |
| `409` | Conflict (duplicate entry) |
| `500` | Internal Server Error |

### Common Error Messages

- **`403 Forbidden`**: `"Access denied. Platform Admin privileges required."`
- **`403 Forbidden`**: `"Only Platform Admins can create roles"`
- **`403 Forbidden`**: `"Cannot modify system templates"`
- **`400 Bad Request`**: `"Cannot delete role - assigned to X user(s)"`
- **`400 Bad Request`**: `"Module name must be lowercase letters and underscores only"`
- **`409 Conflict`**: `"Role with name X already exists"`

---

## Role Management

### Get All Roles

Get all roles (system + custom) with permissions and usage statistics.

**Endpoint**: `GET /admin/rbac/roles`

**Required Permission**: Platform Admin

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeDeleted` | boolean | No | false | Include soft-deleted roles |

**Request Example**:

```
GET /admin/rbac/roles?includeDeleted=false
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
[
  {
    "id": "role-id-123",
    "name": "Owner",
    "is_system": true,
    "is_active": true,
    "created_by_user_id": null,
    "deleted_at": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "role_permissions": [
      {
        "id": "role-perm-id-456",
        "role_id": "role-id-123",
        "permission_id": "perm-id-789",
        "granted_at": "2026-01-01T00:00:00.000Z",
        "granted_by_user_id": null,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "permission": {
          "id": "perm-id-789",
          "module_id": "module-id-abc",
          "action": "view",
          "display_name": "View Dashboard",
          "description": null,
          "is_active": true,
          "created_at": "2026-01-01T00:00:00.000Z",
          "updated_at": "2026-01-01T00:00:00.000Z",
          "module": {
            "id": "module-id-abc",
            "name": "dashboard",
            "display_name": "Dashboard",
            "description": "Main dashboard and analytics",
            "is_active": true,
            "sort_order": 1,
            "icon": "LayoutDashboard",
            "created_at": "2026-01-01T00:00:00.000Z",
            "updated_at": "2026-01-01T00:00:00.000Z"
          }
        }
      }
    ],
    "_count": {
      "user_roles": 145
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Role ID |
| `name` | string | Role name (unique globally) |
| `is_system` | boolean | Whether this is a system-defined role |
| `is_active` | boolean | Whether role is active |
| `created_by_user_id` | string \| null | Platform Admin who created role (null for system roles) |
| `deleted_at` | string \| null | Soft delete timestamp (null if active) |
| `created_at` | string | ISO 8601 timestamp of creation |
| `updated_at` | string | ISO 8601 timestamp of last update |
| `role_permissions[]` | array | Array of role permission assignments |
| `role_permissions[].id` | string | Role permission assignment ID |
| `role_permissions[].role_id` | string | Role ID |
| `role_permissions[].permission_id` | string | Permission ID |
| `role_permissions[].granted_at` | string | ISO 8601 timestamp of grant |
| `role_permissions[].granted_by_user_id` | string \| null | Platform Admin who granted permission |
| `role_permissions[].created_at` | string | ISO 8601 timestamp |
| `role_permissions[].updated_at` | string | ISO 8601 timestamp |
| `role_permissions[].permission.id` | string | Permission ID |
| `role_permissions[].permission.module_id` | string | Module ID |
| `role_permissions[].permission.action` | string | Action name (e.g., "view", "create") |
| `role_permissions[].permission.display_name` | string | Human-readable permission name |
| `role_permissions[].permission.description` | string \| null | Permission description |
| `role_permissions[].permission.is_active` | boolean | Whether permission is active |
| `role_permissions[].permission.created_at` | string | ISO 8601 timestamp |
| `role_permissions[].permission.updated_at` | string | ISO 8601 timestamp |
| `role_permissions[].permission.module.*` | object | See module fields above |
| `_count.user_roles` | number | Number of users with this role (across all tenants) |

---

### Get Role by ID

Get a single role by ID with all permissions.

**Endpoint**: `GET /admin/rbac/roles/:roleId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleId` | string | Yes | Role ID (UUID) |

**Response** (`200 OK`): Same as single item from Get All Roles

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Role not found

---

### Create Role

Create a new custom role with specified permissions.

**Endpoint**: `POST /admin/rbac/roles`

**Required Permission**: Platform Admin

**Request Body**:

```json
{
  "name": "Sales Manager",
  "permissionIds": ["perm-id-123", "perm-id-456", "perm-id-789"]
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Role name (must be unique globally) |
| `permissionIds` | string[] | Yes | Array of permission IDs to assign |

**Response** (`201 Created`):

```json
{
  "id": "role-id-new-123",
  "name": "Sales Manager",
  "is_system": false,
  "is_active": true,
  "created_by_user_id": "platform-admin-id-456",
  "deleted_at": null,
  "created_at": "2026-01-05T12:00:00.000Z",
  "updated_at": "2026-01-05T12:00:00.000Z",
  "role_permissions": [
    {
      "id": "role-perm-new-789",
      "role_id": "role-id-new-123",
      "permission_id": "perm-id-123",
      "granted_at": "2026-01-05T12:00:00.000Z",
      "granted_by_user_id": "platform-admin-id-456",
      "created_at": "2026-01-05T12:00:00.000Z",
      "updated_at": "2026-01-05T12:00:00.000Z",
      "permission": {
        "id": "perm-id-123",
        "module_id": "module-id-abc",
        "action": "view",
        "display_name": "View Leads",
        "description": null,
        "is_active": true,
        "created_at": "2026-01-01T00:00:00.000Z",
        "updated_at": "2026-01-01T00:00:00.000Z",
        "module": {
          "id": "module-id-abc",
          "name": "leads",
          "display_name": "Lead Management",
          "description": null,
          "is_active": true,
          "sort_order": 2,
          "icon": "Users",
          "created_at": "2026-01-01T00:00:00.000Z",
          "updated_at": "2026-01-01T00:00:00.000Z"
        }
      }
    }
  ]
}
```

**Behavior**:

- Created role has `is_system = false` (custom role)
- Created role has `is_active = true` by default
- All permissions assigned atomically (transaction)
- Audit log entry created

**Errors**:

- `400 Bad Request`: `"One or more permissions not found"`
- `403 Forbidden`: Not Platform Admin
- `409 Conflict`: `"Role with name 'X' already exists"`

---

### Update Role

Update role metadata and/or permissions.

**Endpoint**: `PATCH /admin/rbac/roles/:roleId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleId` | string | Yes | Role ID (UUID) |

**Request Body**:

```json
{
  "name": "Senior Sales Manager",
  "is_active": true,
  "permissionIds": ["perm-id-123", "perm-id-456"]
}
```

**Request Body Fields** (all optional):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | No | New role name (must be unique) |
| `is_active` | boolean | No | Whether role is active |
| `permissionIds` | string[] | No | Array of permission IDs (replaces ALL existing) |

**Response** (`200 OK`): Same structure as Create Role

**Behavior**:

- **System roles**: Can be updated, but use caution
- **Cannot update**: `is_system` flag (always set at creation)
- **Permissions**: If `permissionIds` provided, replaces ALL permissions atomically
- **Name uniqueness**: Checked if name is being changed
- Audit log entry created

**Errors**:

- `400 Bad Request`: `"One or more permissions not found"`
- `403 Forbidden`: Not Platform Admin (or system role restrictions)
- `404 Not Found`: Role not found
- `409 Conflict`: `"Role with name 'X' already exists"`

---

### Delete Role

Soft delete a role (cannot delete if assigned to any users).

**Endpoint**: `DELETE /admin/rbac/roles/:roleId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleId` | string | Yes | Role ID (UUID) |

**Response** (`200 OK`):

```json
{
  "message": "Role deleted successfully"
}
```

**Behavior**:

- **Soft delete**: Sets `deleted_at` timestamp (not physical delete)
- **Cannot delete**: If role is assigned to ANY users (across all tenants)
- **System roles**: Can be deleted (but use extreme caution)
- Audit log entry created

**Errors**:

- `400 Bad Request`: `"Cannot delete role 'X' - assigned to 145 user(s). Remove all assignments first."`
- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Role not found

---

### Clone Role

Clone a role (duplicate with new name).

**Endpoint**: `POST /admin/rbac/roles/:roleId/clone`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `roleId` | string | Yes | Source role ID (UUID) |

**Request Body**:

```json
{
  "newName": "Custom Sales Manager"
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `newName` | string | Yes | New role name (must be unique) |

**Response** (`201 Created`): Same structure as Create Role

**Behavior**:

- Cloned role has `is_system = false` (always custom)
- Cloned role has `is_active = true`
- All permissions from source role are copied
- Audit log entry created with source role reference

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Source role not found
- `409 Conflict`: `"Role with name 'X' already exists"`

---

## Permission Management

### Get All Permissions

Get all permissions (optionally filtered by module).

**Endpoint**: `GET /admin/rbac/permissions`

**Required Permission**: Platform Admin

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `moduleId` | string | No | null | Filter by module ID |

**Request Example**:

```
GET /admin/rbac/permissions?moduleId=module-id-123
Authorization: Bearer <access_token>
```

**Response** (`200 OK`):

```json
[
  {
    "id": "perm-id-123",
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
      "description": null,
      "is_active": true,
      "sort_order": 2,
      "icon": "Users",
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z"
    },
    "_count": {
      "role_permissions": 7,
      "role_template_permissions": 5
    }
  }
]
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Permission ID |
| `module_id` | string | Module ID |
| `action` | string | Action name (e.g., "view", "create", "edit") |
| `display_name` | string | Human-readable permission name |
| `description` | string \| null | Permission description |
| `is_active` | boolean | Whether permission is active |
| `created_at` | string | ISO 8601 timestamp |
| `updated_at` | string | ISO 8601 timestamp |
| `module.*` | object | Module details (see Module Management section) |
| `_count.role_permissions` | number | Number of roles with this permission |
| `_count.role_template_permissions` | number | Number of role templates with this permission |

---

### Get Permission by ID

Get a single permission by ID.

**Endpoint**: `GET /admin/rbac/permissions/:permissionId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `permissionId` | string | Yes | Permission ID (UUID) |

**Response** (`200 OK`):

```json
{
  "id": "perm-id-123",
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
    "description": null,
    "is_active": true,
    "sort_order": 2,
    "icon": "Users",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  },
  "role_permissions": [
    {
      "id": "role-perm-id-789",
      "role_id": "role-id-abc",
      "permission_id": "perm-id-123",
      "granted_at": "2026-01-01T00:00:00.000Z",
      "granted_by_user_id": null,
      "created_at": "2026-01-01T00:00:00.000Z",
      "updated_at": "2026-01-01T00:00:00.000Z",
      "role": {
        "id": "role-id-abc",
        "name": "Owner",
        "is_system": true
      }
    }
  ],
  "_count": {
    "role_permissions": 7,
    "role_template_permissions": 5
  }
}
```

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Permission not found

---

### Create Permission

Create a new permission.

**Endpoint**: `POST /admin/rbac/permissions`

**Required Permission**: Platform Admin

**Request Body**:

```json
{
  "moduleId": "module-id-456",
  "action": "export",
  "displayName": "Export Leads",
  "description": "Allows exporting leads to CSV/Excel"
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `moduleId` | string | Yes | Module ID |
| `action` | string | Yes | Action name (e.g., "view", "create", "edit", "delete", "export") |
| `displayName` | string | Yes | Human-readable permission name |
| `description` | string \| null | No | Permission description (optional) |

**Response** (`201 Created`):

```json
{
  "id": "perm-id-new-123",
  "module_id": "module-id-456",
  "action": "export",
  "display_name": "Export Leads",
  "description": "Allows exporting leads to CSV/Excel",
  "is_active": true,
  "created_at": "2026-01-05T12:30:00.000Z",
  "updated_at": "2026-01-05T12:30:00.000Z",
  "module": {
    "id": "module-id-456",
    "name": "leads",
    "display_name": "Lead Management",
    "description": null,
    "is_active": true,
    "sort_order": 2,
    "icon": "Users",
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z"
  }
}
```

**Behavior**:

- Created permission has `is_active = true` by default
- **Unique constraint**: `module_id + action` must be unique
- Audit log entry created

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: `"Module not found"`
- `409 Conflict`: `"Permission 'leads:export' already exists"`

---

### Update Permission

Update permission metadata.

**Endpoint**: `PATCH /admin/rbac/permissions/:permissionId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `permissionId` | string | Yes | Permission ID (UUID) |

**Request Body** (all fields optional):

```json
{
  "display_name": "Export All Leads",
  "description": "Allows exporting all leads to CSV/Excel/PDF",
  "is_active": false
}
```

**Request Body Fields** (all optional):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `display_name` | string | No | Human-readable permission name |
| `description` | string \| null | No | Permission description |
| `is_active` | boolean | No | Whether permission is active |

**Response** (`200 OK`): Same structure as Create Permission

**Behavior**:

- **Cannot update**: `module_id` or `action` (would break references)
- Audit log entry created

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Permission not found

---

### Delete Permission

Delete a permission (removes from all roles).

**Endpoint**: `DELETE /admin/rbac/permissions/:permissionId`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `permissionId` | string | Yes | Permission ID (UUID) |

**Response** (`200 OK`):

```json
{
  "message": "Permission deleted successfully",
  "roles_affected": 7
}
```

**Response Fields**:

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Success message |
| `roles_affected` | number | Number of roles this permission was removed from |

**Behavior**:

- **Physical delete**: Permission is permanently deleted
- **Cascade delete**: Foreign key CASCADE removes from all roles automatically
- **Warning logged**: If permission is assigned to roles
- Audit log entry created with affected role count

**Errors**:

- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Permission not found

---

## Module Management

### Get All Modules

Get all modules with their permissions.

**Endpoint**: `GET /admin/rbac/modules`

**Required Permission**: Platform Admin

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeInactive` | boolean | No | false | Include inactive modules |

**Response** (`200 OK`):

```json
[
  {
    "id": "module-id-123",
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
        "id": "perm-id-456",
        "action": "view",
        "display_name": "View Leads",
        "description": null,
        "is_active": true,
        "_count": {
          "role_permissions": 7
        }
      }
    ],
    "_count": {
      "permissions": 5
    }
  }
]
```

---

### Create Module

Create a new module.

**Endpoint**: `POST /admin/rbac/modules`

**Required Permission**: Platform Admin

**Request Body**:

```json
{
  "name": "work_orders",
  "displayName": "Work Orders",
  "description": "Manage work orders and job tracking",
  "icon": "Wrench",
  "sortOrder": 10
}
```

**Request Body Fields**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Module name (lowercase, underscores only) |
| `displayName` | string | Yes | Human-readable module name |
| `description` | string \| null | No | Module description (optional) |
| `icon` | string \| null | No | Icon name (optional) |
| `sortOrder` | number | Yes | Display order |

**Behavior**:

- **Name validation**: Must match `/^[a-z_]+$/` (lowercase, underscores only)
- Created module has `is_active = true` by default
- **Name uniqueness**: Must be unique globally

**Errors**:

- `400 Bad Request`: `"Module name must be lowercase letters and underscores only"`
- `403 Forbidden`: Not Platform Admin
- `409 Conflict`: `"Module 'X' already exists"`

---

### Delete Module

Delete a module (cascades to permissions and roles).

**Endpoint**: `DELETE /admin/rbac/modules/:moduleId`

**Required Permission**: Platform Admin

**Response** (`200 OK`):

```json
{
  "message": "Module deleted successfully",
  "permissions_deleted": 5,
  "role_permissions_deleted": 35
}
```

**Behavior**:

- **Physical delete**: Module is permanently deleted
- **Cascade delete**: All permissions for this module are deleted
- **Warning logged**: If module has permissions assigned to roles

---

## Role Template Management

### Get All Templates

Get all role templates (system + custom).

**Endpoint**: `GET /admin/rbac/templates`

**Required Permission**: Platform Admin

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `includeInactive` | boolean | No | false | Include inactive templates |

**Response** (`200 OK`):

```json
[
  {
    "id": "template-id-123",
    "name": "Owner",
    "description": "Full access to all modules and subscription management",
    "is_system_template": true,
    "is_active": true,
    "created_by_user_id": null,
    "created_at": "2026-01-01T00:00:00.000Z",
    "updated_at": "2026-01-01T00:00:00.000Z",
    "role_template_permissions": [
      {
        "id": "template-perm-id-456",
        "role_template_id": "template-id-123",
        "permission_id": "perm-id-789",
        "created_at": "2026-01-01T00:00:00.000Z",
        "permission": {
          "id": "perm-id-789",
          "module_id": "module-id-abc",
          "action": "view",
          "display_name": "View Dashboard",
          "description": null,
          "is_active": true,
          "created_at": "2026-01-01T00:00:00.000Z",
          "updated_at": "2026-01-01T00:00:00.000Z",
          "module": {
            "id": "module-id-abc",
            "name": "dashboard",
            "display_name": "Dashboard",
            "description": null,
            "is_active": true,
            "sort_order": 1,
            "icon": "LayoutDashboard",
            "created_at": "2026-01-01T00:00:00.000Z",
            "updated_at": "2026-01-01T00:00:00.000Z"
          }
        }
      }
    ],
    "_count": {
      "role_template_permissions": 59
    }
  }
]
```

---

### Create Template

Create a custom role template.

**Endpoint**: `POST /admin/rbac/templates`

**Required Permission**: Platform Admin

**Request Body**:

```json
{
  "name": "Custom Manager",
  "description": "Custom manager role with specific permissions",
  "permissionIds": ["perm-id-123", "perm-id-456"]
}
```

**Behavior**:

- Created template has `is_system_template = false`
- Created template has `is_active = true`

---

### Apply Template

Create a role from a template.

**Endpoint**: `POST /admin/rbac/templates/:templateId/apply`

**Required Permission**: Platform Admin

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `templateId` | string | Yes | Template ID (UUID) |

**Request Body**:

```json
{
  "roleName": "Custom Sales Manager"
}
```

**Response** (`201 Created`): Returns the newly created role (same structure as Create Role)

**Behavior**:

- Creates a new role with all permissions from the template
- New role has `is_system = false`
- New role has `is_active = true`
- All permissions copied atomically (transaction)

**Errors**:

- `400 Bad Request`: `"Template is inactive"`
- `403 Forbidden`: Not Platform Admin
- `404 Not Found`: Template not found
- `409 Conflict`: `"Role name already exists"`

---

**End of RBAC Admin REST API Documentation (Platform Admin Endpoints)**
