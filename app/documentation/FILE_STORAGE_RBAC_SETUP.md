# File Storage Module - RBAC Setup Guide

**Module**: Files
**Resource Key**: `files`
**Date**: 2026-01-06

---

## Quick Reference

### Actions to Add to RBAC System

Add these 7 actions for the `files` resource:

| Action | Key | Description | Required Roles |
|--------|-----|-------------|----------------|
| **View** | `view` | View and list files | All authenticated users |
| **Create** | `create` | Upload new files | All authenticated users |
| **Delete** | `delete` | Delete files | Owner, Admin |
| **Share** | `share` | Create public share links | All authenticated users |
| **Revoke Share** | `revoke_share` | Revoke share links | Owner, Admin |
| **Manage Orphans** | `manage_orphans` | View and trash orphan files | Owner, Admin |
| **Bulk Operations** | `bulk_operations` | Bulk delete and download | All users (download), Owner/Admin (delete) |

---

## SQL Insert Script (Example)

If you're using a database to store permissions:

```sql
-- Insert file storage resource
INSERT INTO resources (name, key, description)
VALUES ('Files', 'files', 'File storage and management');

-- Get the resource ID
SET @files_resource_id = LAST_INSERT_ID();

-- Insert actions
INSERT INTO actions (resource_id, name, key, description) VALUES
(@files_resource_id, 'View Files', 'view', 'View and list files'),
(@files_resource_id, 'Create Files', 'create', 'Upload new files'),
(@files_resource_id, 'Delete Files', 'delete', 'Delete files'),
(@files_resource_id, 'Share Files', 'share', 'Create public share links'),
(@files_resource_id, 'Revoke Share Links', 'revoke_share', 'Revoke share links'),
(@files_resource_id, 'Manage Orphans', 'manage_orphans', 'View and trash orphan files'),
(@files_resource_id, 'Bulk Operations', 'bulk_operations', 'Bulk delete and download');

-- Assign permissions to roles
-- Owner: All permissions
INSERT INTO role_permissions (role_id, action_id)
SELECT r.id, a.id
FROM roles r, actions a
WHERE r.key = 'owner' AND a.resource_id = @files_resource_id;

-- Admin: All permissions
INSERT INTO role_permissions (role_id, action_id)
SELECT r.id, a.id
FROM roles r, actions a
WHERE r.key = 'admin' AND a.resource_id = @files_resource_id;

-- Bookkeeper: View, Create, Share
INSERT INTO role_permissions (role_id, action_id)
SELECT r.id, a.id
FROM roles r, actions a
WHERE r.key = 'bookkeeper'
  AND a.resource_id = @files_resource_id
  AND a.key IN ('view', 'create', 'share');

-- User: View, Create, Share
INSERT INTO role_permissions (role_id, action_id)
SELECT r.id, a.id
FROM roles r, actions a
WHERE r.key = 'user'
  AND a.resource_id = @files_resource_id
  AND a.key IN ('view', 'create', 'share');

-- Platform Admin: View only (cross-tenant viewing)
INSERT INTO role_permissions (role_id, action_id)
SELECT r.id, a.id
FROM roles r, actions a
WHERE r.key = 'platform_admin'
  AND a.resource_id = @files_resource_id
  AND a.key = 'view';
```

---

## NestJS Permission Setup (Example)

If you need to seed permissions in NestJS:

```typescript
// src/modules/rbac/seeds/file-permissions.seed.ts

export const filePermissions = [
  {
    resource: 'files',
    actions: [
      {
        key: 'view',
        name: 'View Files',
        description: 'View and list files',
        roles: ['Owner', 'Admin', 'Bookkeeper', 'User', 'PlatformAdmin'],
      },
      {
        key: 'create',
        name: 'Create Files',
        description: 'Upload new files',
        roles: ['Owner', 'Admin', 'Bookkeeper', 'User'],
      },
      {
        key: 'delete',
        name: 'Delete Files',
        description: 'Delete files',
        roles: ['Owner', 'Admin'],
      },
      {
        key: 'share',
        name: 'Share Files',
        description: 'Create public share links',
        roles: ['Owner', 'Admin', 'Bookkeeper', 'User'],
      },
      {
        key: 'revoke_share',
        name: 'Revoke Share Links',
        description: 'Revoke share links',
        roles: ['Owner', 'Admin'],
      },
      {
        key: 'manage_orphans',
        name: 'Manage Orphans',
        description: 'View and trash orphan files',
        roles: ['Owner', 'Admin'],
      },
      {
        key: 'bulk_operations',
        name: 'Bulk Operations',
        description: 'Bulk delete and download (delete restricted to Owner/Admin)',
        roles: ['Owner', 'Admin', 'Bookkeeper', 'User'],
      },
    ],
  },
];
```

---

## Backend Decorators Used

The backend already uses these decorators on the endpoints:

| Endpoint | Decorator | Notes |
|----------|-----------|-------|
| `POST /files/upload` | None | All authenticated users |
| `GET /files` | None | All authenticated users |
| `GET /files/:id` | None | All authenticated users |
| `DELETE /files/:id` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `GET /files/orphans` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `POST /files/orphans/trash` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `DELETE /files/trash/cleanup` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `POST /files/share` | None | All authenticated users |
| `GET /files/share/list` | None | All authenticated users |
| `DELETE /files/share/:id` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `POST /files/bulk/delete` | `@Roles('Owner', 'Admin')` | Owner/Admin only |
| `POST /files/bulk/download` | `@RequirePermission('files', 'view')` | All authenticated users |
| `GET /public/share/:token` | `@Public()` | No authentication |
| `POST /public/share/:token/download` | `@Public()` | No authentication |

---

## Permission Matrix

| Role | View | Upload | Download | Delete | Share | Revoke Share | Orphans | Bulk Delete | Admin Panel |
|------|------|--------|----------|--------|-------|--------------|---------|-------------|-------------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Bookkeeper** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User** | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Platform Admin** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Frontend Route Protection

The frontend uses these routes with role-based access:

| Route | Component | Access | Notes |
|-------|-----------|--------|-------|
| `/files` | Tenant Gallery | Owner, Admin, Bookkeeper | Full features |
| `/admin/files` | Admin Gallery | Platform Admin | View-only, cross-tenant |
| `/public/share/[token]` | Public Share | Public | No authentication |

---

## Testing Permissions

After setting up permissions, test each role:

### As Owner/Admin
- ✅ Upload files
- ✅ View files
- ✅ Download files
- ✅ Delete files
- ✅ Create share links
- ✅ Revoke share links
- ✅ View orphan files
- ✅ Bulk delete
- ✅ Bulk download

### As Bookkeeper/User
- ✅ Upload files
- ✅ View files
- ✅ Download files
- ❌ Delete files (should be disabled/hidden)
- ✅ Create share links
- ❌ Revoke share links (should be disabled/hidden)
- ❌ View orphan files (not available)
- ❌ Bulk delete (should be disabled/hidden)
- ✅ Bulk download

### As Platform Admin
- ❌ Upload files (not available in admin panel)
- ✅ View all files across all tenants
- ✅ Download files
- ❌ Delete files (not available in admin panel)
- ❌ Create share links (not available in admin panel)

---

## Notes

1. **Bulk Download**: Available to all users with `files:view` permission
2. **Bulk Delete**: Only available to Owner/Admin roles
3. **Orphan Management**: Only available to Owner/Admin roles
4. **Public Share Pages**: No authentication required, access controlled by share token
5. **Platform Admin**: Can view all files cross-tenant but cannot modify anything

---

**Setup Status**: Ready to implement
**Backend Protection**: ✅ Already implemented
**Frontend Routes**: ✅ Already protected
**Action Required**: Add permissions to RBAC database
