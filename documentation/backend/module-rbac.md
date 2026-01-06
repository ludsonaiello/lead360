# Backend Module: Role-Based Access Control (RBAC)

**Module Name**: RBAC  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/rbac-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements role-based permission enforcement across the entire platform. You will build the data layer for roles, role assignment, and guards/decorators to protect API endpoints.

**Read First**:
- `/documentation/contracts/rbac-contract.md` (complete role definitions and permissions)
- `/documentation/shared/security-rules.md` (security requirements)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Tables Structure

### **Tables to Create**

1. **role** - Roles (system default + custom admin-created)
2. **user_role** - Junction table (users have many roles)
3. **module** - Platform modules (Leads, Quotes, Projects, etc.)
4. **permission** - Actions per module (view, create, edit, delete, etc.)
5. **role_permission** - Which roles have which permissions (many-to-many)
6. **role_template** - Pre-configured role sets for quick setup

**CRITICAL**: NO hardcoded permissions in code. All permissions are database-driven and checked dynamically.

---

## Table Design

### **role Table**

**Purpose**: Store all roles (system default templates + custom admin-created)

**Key Fields**:
- id (UUID, primary key)
- name (unique - "Owner", "Sales Manager", etc.)
- description (text)
- is_system_role (boolean - true for 7 default templates, false for custom)
- is_active (boolean - inactive roles don't grant permissions)
- created_by_user_id (nullable - null for system roles, user ID for custom)
- created_at, updated_at, deleted_at (soft delete)

**Seed Data** (7 default role templates):
1. Owner
2. Admin
3. Estimator
4. Project Manager
5. Bookkeeper
6. Employee
7. Read-only

**Business Rules**:
- Name must be unique (case-insensitive check, case-sensitive storage)
- System roles cannot be deleted (is_system_role = true)
- Custom roles can be deleted if no users have them
- Inactive roles remain in DB but don't grant permissions

---

### **user_role Table**

**Purpose**: Assign roles to users (many-to-many)

**Key Fields**:
- id (UUID, primary key)
- user_id (foreign key to user)
- role_id (foreign key to role)
- tenant_id (foreign key to tenant - roles are tenant-specific)
- assigned_by_user_id (foreign key to user who assigned)
- assigned_at (timestamp)
- created_at, updated_at

**Indexes**:
- Composite unique: (user_id, role_id, tenant_id) - prevent duplicate assignments
- Index: (user_id, tenant_id) - fetch user's roles quickly
- Index: (tenant_id, role_id) - fetch all users with specific role
- Index: (role_id) - check if role is assigned to any users

**Business Rules**:
- User can have multiple roles (additive permissions)
- Roles are tenant-specific
- At least one Owner required per tenant
- Assignment tracked (who assigned, when)

---

### **module Table**

**Purpose**: Define platform modules/features

**Key Fields**:
- id (UUID, primary key)
- name (unique identifier - "leads", "quotes", "projects")
- display_name (human-readable - "Lead Management", "Quote Builder")
- description (text)
- is_active (boolean - inactive modules hidden from all users)
- sort_order (integer - for UI display order)
- icon (optional - icon name for UI)
- created_at, updated_at

**Seed Data** (Initial 14 modules):
1. dashboard - Dashboard
2. leads - Lead Management
3. quotes - Quote Builder
4. projects - Project Management
5. tasks - Task Management
6. invoices - Invoice Management
7. payments - Payment Processing
8. expenses - Expense Tracking
9. reports - Reports & Analytics
10. calendar - Calendar & Scheduling
11. timeclock - Time Clock
12. users - User Management
13. settings - Business Settings
14. subscription - Subscription & Billing

**Extensibility**: Platform Admin can add new modules (e.g., "inventory", "crm", "marketing")

---

### **permission Table**

**Purpose**: Define actions that can be performed on modules

**Key Fields**:
- id (UUID, primary key)
- module_id (foreign key to module)
- action (e.g., "view", "create", "edit", "delete", "send", "export")
- display_name (e.g., "View Leads", "Send Quotes")
- description (text)
- is_active (boolean - inactive permissions don't grant access)
- created_at, updated_at

**Indexes**:
- Composite unique: (module_id, action) - each module has unique actions
- Index: (module_id) - fetch module's permissions
- Index: (is_active) - filter active permissions

**Seed Data Examples**:
- module: "leads", action: "view", display_name: "View Leads"
- module: "leads", action: "create", display_name: "Create Leads"
- module: "leads", action: "edit", display_name: "Edit Leads"
- module: "leads", action: "delete", display_name: "Delete Leads"
- module: "leads", action: "export", display_name: "Export Leads"
- module: "quotes", action: "send", display_name: "Send Quotes"
- module: "projects", action: "assign", display_name: "Assign Tasks"

**Flexibility**: Platform Admin can add new permissions (e.g., "approve", "reject", "archive")

---

### **role_permission Table**

**Purpose**: Link roles to permissions (many-to-many)

**Key Fields**:
- id (UUID, primary key)
- role_id (foreign key to role)
- permission_id (foreign key to permission)
- granted_at (timestamp)
- granted_by_user_id (nullable - who granted this permission)
- created_at, updated_at

**Indexes**:
- Composite unique: (role_id, permission_id) - prevent duplicate permission assignments
- Index: (role_id) - fetch role's permissions
- Index: (permission_id) - check which roles have permission

**Business Rules**:
- A role can have 0 to unlimited permissions
- Permissions are checked at runtime by querying this table
- Adding/removing permissions takes effect immediately

---

### **role_template Table**

**Purpose**: Store pre-configured permission sets for quick role creation

**Key Fields**:
- id (UUID, primary key)
- name (unique - "Owner Template", "Custom Sales Template")
- description (text)
- is_system_template (boolean - true for 7 defaults, false for custom)
- is_active (boolean)
- created_by_user_id (nullable)
- created_at, updated_at

**Related**: Template permissions stored in separate `role_template_permission` junction table

**Seed Data**: 7 default templates (Owner, Admin, Estimator, etc.) with pre-configured permissions

**Usage**: Platform Admin can create role from template (copies all permissions)

---

## NestJS Module Structure

**Directory**:
```
src/modules/rbac/
├── rbac.module.ts
├── rbac.controller.ts
├── rbac.service.ts
├── guards/
│   ├── roles.guard.ts
│   └── owner-or-admin.guard.ts
├── decorators/
│   ├── roles.decorator.ts
│   └── require-owner.decorator.ts
├── dto/
│   ├── assign-role.dto.ts
│   └── role-response.dto.ts
└── rbac.service.spec.ts
```

---

## Core Service Methods

### **RBACService**

#### **Role Management**

1. **seedRoles()**
   - Insert 7 default role templates
   - Create default permissions for each module
   - Link default permissions to default roles (role_permission table)
   - Called during initial platform setup
   - Idempotent (check if exists before inserting)

2. **getAllRoles(tenantId?)**
   - Fetch all roles (system + custom)
   - Optional: Filter by tenant (if multi-tenant user ever exists)
   - Include permission count
   - Return array of roles

3. **getRole(roleId)**
   - Fetch single role by ID
   - Include permissions (join role_permission → permission → module)
   - Return role with full permission details

4. **createRole(name, description, createdByUserId)**
   - Validate name uniqueness
   - Create role with is_system_role=false
   - Return new role (no permissions yet - assigned separately)

5. **updateRole(roleId, updateData)**
   - Update name, description, is_active
   - Cannot update is_system_role (protected field)
   - Validate name uniqueness if changing name
   - Audit log the change
   - Return updated role

6. **deleteRole(roleId)**
   - Validate is_system_role=false (cannot delete system roles)
   - Check if any users have this role (query user_role table)
   - If users exist: throw error "Role is assigned to X users. Remove role from users first."
   - Soft delete (set deleted_at)
   - Audit log

7. **cloneRole(roleId, newName)**
   - Create new role with new name
   - Copy all role_permission records
   - Return new role with permission count

---

#### **Permission Management for Roles**

8. **getRolePermissions(roleId)**
   - Query role_permission table
   - Join with permission and module tables
   - Return array of {module, action, permission_id}
   - Grouped by module

9. **addPermissionToRole(roleId, permissionId, grantedByUserId)**
   - Check if role already has this permission (skip if duplicate)
   - Create role_permission record
   - Return confirmation

10. **removePermissionFromRole(roleId, permissionId)**
    - Delete role_permission record
    - Return confirmation

11. **replaceRolePermissions(roleId, permissionIds[])**
    - Delete all existing role_permission records for this role
    - Insert new role_permission records for provided permission IDs
    - Atomic transaction (all or nothing)
    - Return summary {added, removed, total}

12. **batchUpdateRolePermissions(roleId, addPermissionIds[], removePermissionIds[])**
    - Remove permissions in removePermissionIds
    - Add permissions in addPermissionIds
    - Atomic transaction
    - Return summary {added, removed, total}

---

#### **User Role Assignment**

13. **getUserRoles(userId, tenantId)**
    - Fetch all roles assigned to user in specific tenant
    - Return array of role names + role IDs
    - Used by guards to check permissions

14. **hasRole(userId, tenantId, roleName)**
    - Check if user has specific role
    - Query user_role join role
    - Return boolean

15. **hasAnyRole(userId, tenantId, roleNames[])**
    - Check if user has at least one of specified roles
    - Return boolean

16. **assignRoleToUser(userId, tenantId, roleId, assignedByUserId)**
    - Check if user already has this role (skip if duplicate)
    - Create user_role record
    - Audit log the assignment
    - Return assignment details

17. **removeRoleFromUser(userId, tenantId, roleId, removedByUserId)**
    - Validate user has this role
    - Get role name from role table
    - If role name is "Owner":
      - Count how many Owners exist in tenant
      - If user is last Owner, throw error "Cannot remove last Owner"
    - If removedByUserId equals userId and role is Owner:
      - Check if last Owner
      - If yes, throw error
    - Delete user_role record
    - Audit log the removal
    - Return success

18. **replaceUserRoles(userId, tenantId, roleIds[], updatedByUserId)**
    - Compare current roles vs. new roles
    - Remove roles not in new list (with Owner validation)
    - Add roles in new list but not in current
    - Atomic transaction
    - Audit log
    - Return summary {added, removed, current_roles}

19. **batchAssignRoles(userIds[], roleIds[], tenantId, assignedByUserId)**
    - For each user_id, assign each role_id
    - Skip duplicates (if user already has role)
    - Atomic transaction (all users or none)
    - Audit log for each user
    - Return summary {users_updated, roles_assigned, details[]}

20. **getUsersWithRole(tenantId, roleId)**
    - Get all users in tenant who have specific role
    - Returns array of users
    - Used for checking "last Owner" scenario

---

#### **Dynamic Permission Checking** (CRITICAL - No Hardcoding)

21. **checkPermission(userId, tenantId, moduleName, action)**
    - Fetch user's roles (from user_role table)
    - For each role, fetch permissions (from role_permission table)
    - Check if any permission matches moduleName + action
    - Check role is active (role.is_active = true)
    - Check permission is active (permission.is_active = true)
    - Check module is active (module.is_active = true)
    - Returns boolean
    - **NEVER hardcoded** - always queries database

22. **hasPermission(userId, tenantId, permissionId)**
    - Check if user's roles include specific permission
    - Return boolean

23. **getUserPermissions(userId, tenantId)**
    - Get all permissions user has (via their roles)
    - Deduplicate (user might have same permission from multiple roles)
    - Return array of {module, action, permission_id}

24. **getPermissionMatrix()**
    - Query all roles
    - For each role, get all permissions
    - Build nested object: {role_name: {module_name: [actions]}}
    - Return dynamically generated matrix (NOT hardcoded)

---

#### **Module Management** (Platform Admin Only)

25. **getAllModules()**
    - Fetch all modules
    - Include permission count per module
    - Return array ordered by sort_order

26. **createModule(name, displayName, description, sortOrder)**
    - Validate name uniqueness
    - Create module record
    - Return module

27. **updateModule(moduleId, updateData)**
    - Update display_name, description, sort_order, is_active
    - Cannot update name (breaking change - immutable identifier)
    - Return updated module

28. **deleteModule(moduleId)**
    - Soft delete (set deleted_at)
    - Delete all associated permissions (cascade)
    - Delete all role_permission records for those permissions (cascade)
    - Audit log

---

#### **Permission Management** (Platform Admin Only)

29. **getModulePermissions(moduleId)**
    - Fetch all permissions for specific module
    - Return array of permissions

30. **createPermission(moduleId, action, displayName, description)**
    - Validate unique (module_id, action)
    - Create permission record
    - Return permission

31. **updatePermission(permissionId, updateData)**
    - Update display_name, description, is_active
    - Cannot update module_id or action (breaking changes)
    - Return updated permission

32. **deletePermission(permissionId)**
    - Delete permission
    - Delete all role_permission records using this permission (cascade)
    - Audit log

---

#### **Role Template Management**

33. **getAllTemplates()**
    - Fetch all role templates
    - Include permission count
    - Return array

34. **getTemplate(templateId)**
    - Fetch template with permissions
    - Return template details

35. **createRoleFromTemplate(templateId, roleName, description, createdByUserId)**
    - Create new role
    - Copy all permissions from template
    - Return new role with permission count

36. **createTemplate(name, description, permissionIds[], createdByUserId)**
    - Create template record
    - Link permissions
    - Return template

---

## Dynamic Permission Checking

**CRITICAL**: NO hardcoded permissions anywhere in the codebase.

**How Permission Checks Work**:

1. **Request comes in** → Guard extracts user_id and tenant_id from JWT
2. **Fetch user's roles** → Query user_role table
3. **For each role, fetch permissions** → Query role_permission table
4. **Check if any permission matches** → module + action comparison
5. **Validate active states** → role.is_active AND permission.is_active AND module.is_active must all be true
6. **Return result** → Allow or deny request

**Example Flow**:
```
User tries to create a quote:
1. Extract user_id from JWT: "user-123"
2. Extract tenant_id from subdomain: "tenant-456"
3. Query user_role: User has roles ["Estimator", "Employee"]
4. Query role_permission for "Estimator": Has permissions ["leads:view", "leads:create", "quotes:view", "quotes:create", "quotes:send"]
5. Query role_permission for "Employee": Has permissions ["timeclock:clock_in", "tasks:view"]
6. Check if "quotes:create" is in combined permissions: YES
7. Check module "quotes" is active: YES
8. Check permission "quotes:create" is active: YES
9. Result: ALLOW
```

**Caching Strategy** (Optional for Performance):
- Cache user permissions for 5 minutes
- Invalidate cache on:
  - User role added/removed
  - Role permission added/removed
  - Module/permission deactivated
- Use Redis for distributed cache

---

## Roles Guard

**Purpose**: Protect routes that require specific permissions

**Location**: `guards/roles.guard.ts`

**Implementation Logic**:
1. Extract required module + action from route metadata (set by @RequirePermission() decorator)
2. Extract user_id and tenant_id from JWT token
3. Call RBACService.checkPermission(userId, tenantId, module, action)
4. RBACService queries database dynamically (NO hardcoded permissions)
5. If user has permission: Allow request
6. If user lacks permission: Throw 403 Forbidden

**Special Cases**:
- If user is Platform Admin (is_platform_admin=true): Always allow
- If route has no permission decorator: Allow (handled by authentication guard only)

**Usage**:
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@RequirePermission('leads', 'create')
@Post('leads')
async createLead(...) {
  // Only users with "leads:create" permission can access
}
```

---

## Permission Decorator

**Purpose**: Declare required permission for route (replaces @Roles decorator)

**Location**: `decorators/require-permission.decorator.ts`

**Implementation Logic**:
- Accepts module name and action
- Sets metadata on route handler
- RolesGuard reads this metadata

**Usage**:
```typescript
@RequirePermission('quotes', 'send')
@Post('quotes/:id/send')
async sendQuote(...) {
  // Only users with "quotes:send" permission can access
}
```

**Old @Roles() Decorator**: Deprecated (replaced by @RequirePermission)

---

## Alternative: Role-Based Guard (Simplified Version)

For routes that should only be accessible to specific roles (not granular permissions):

**Usage**:
```typescript
@Roles('Owner', 'Admin')
@Patch('settings/subscription')
async updateSubscription(...) {
  // Only Owner or Admin can access
}
```

**Implementation**: Checks if user has ANY of the specified roles (still queries database, not hardcoded)

---

## API Controller

**Location**: `rbac.controller.ts`

**Routes**:

1. **GET /roles**
   - Public (all authenticated users)
   - Returns list of all available roles
   - No guard restriction

2. **GET /users/:id/roles**
   - @UseGuards(JwtAuthGuard, OwnerOrAdminGuard)
   - Returns user's assigned roles
   - Only Owner/Admin can view

3. **POST /users/:id/roles**
   - @UseGuards(JwtAuthGuard, OwnerOrAdminGuard)
   - Assign role to user
   - Body: { role_name: "Estimator" }
   - Only Owner/Admin can assign

4. **DELETE /users/:id/roles/:roleId**
   - @UseGuards(JwtAuthGuard, OwnerOrAdminGuard)
   - Remove role from user
   - Only Owner/Admin can remove

5. **GET /roles/permissions**
   - @UseGuards(JwtAuthGuard, OwnerOrAdminGuard)
   - Return permission matrix
   - Only Owner/Admin can view

---

## Validation Rules

**Role Assignment**:
- role_name must be one of 7 predefined roles
- Cannot assign same role twice to same user
- Only Owner/Admin can assign roles

**Role Removal**:
- Cannot remove last Owner from tenant
- User cannot remove own Owner role if last Owner
- Only Owner/Admin can remove roles

**Role Names**:
- Case-sensitive: "Owner" not "owner"
- Exact match required
- No typos allowed (validated against role table)

---

## Business Logic Requirements

### **Last Owner Protection**

**Scenario**: Removing Owner role from user

**Check**:
1. Count Owners in tenant: `SELECT COUNT(*) FROM user_role WHERE tenant_id = ? AND role_id = (SELECT id FROM role WHERE name = 'Owner')`
2. If count = 1: Throw error "Cannot remove last Owner. Assign another Owner first."
3. If count > 1: Allow removal

**Edge Case**: What if removing last Owner AND assigning new Owner in same transaction?
- Solution: Allow if done atomically (remove + assign in same request)
- Simpler: Require assign new Owner first, then remove old

---

### **Additive Permissions**

**Scenario**: User has multiple roles

**Logic**: User can perform action if ANY of their roles allow it

**Example**:
- User has ["Employee", "Estimator"]
- Action: Create quote
- Employee cannot create quotes
- Estimator CAN create quotes
- Result: ALLOW (because Estimator allows)

**Implementation**: In checkPermission(), loop through all user's roles and return true if any role matches

---

### **Platform Admin Exception**

**Scenario**: User is Platform Admin (is_platform_admin=true)

**Logic**: Bypass all role checks, grant full access

**Implementation**: In RolesGuard, check if user.is_platform_admin=true, if yes, skip role validation

---

## Audit Logging

**Log These Actions**:
- Role assigned to user
- Role removed from user
- Failed permission check (user attempted action without permission)
- Ownership transferred

**Audit Fields**:
- actor_user_id (who performed action)
- entity_type = "user_role"
- entity_id = user_role.id
- action = "assigned" or "removed"
- before_json (existing roles before change)
- after_json (roles after change)
- metadata_json { role_name, target_user_id }
- timestamp

---

## Testing Requirements

### **Unit Tests** (>80% coverage)

1. **Role Validation**
   - ✅ Valid role names accepted
   - ✅ Invalid role names rejected
   - ✅ Case-sensitive validation

2. **Role Assignment**
   - ✅ Assign role successfully
   - ✅ Duplicate role assignment skipped
   - ✅ Only Owner/Admin can assign

3. **Role Removal**
   - ✅ Remove role successfully
   - ✅ Cannot remove last Owner (throws error)
   - ✅ Cannot remove own Owner if last Owner
   - ✅ Only Owner/Admin can remove

4. **Permission Checks**
   - ✅ Owner can perform all actions
   - ✅ Admin can perform most actions (except billing)
   - ✅ Estimator can create quotes
   - ✅ Employee cannot create quotes
   - ✅ Bookkeeper can view invoices
   - ✅ Estimator cannot view invoices
   - ✅ Read-only cannot edit anything

5. **Multiple Roles**
   - ✅ User with ["Employee", "Estimator"] has combined permissions
   - ✅ Additive permissions work correctly

6. **Platform Admin**
   - ✅ Platform Admin bypasses all role checks
   - ✅ Platform Admin can access any tenant

---

### **Integration Tests**

1. **API Endpoints**
   - ✅ GET /roles returns all roles
   - ✅ GET /users/:id/roles returns user's roles
   - ✅ POST /users/:id/roles assigns role
   - ✅ POST /users/:id/roles (duplicate) returns 409 or skips
   - ✅ DELETE /users/:id/roles/:roleId removes role
   - ✅ DELETE /users/:id/roles/:roleId (last Owner) returns 400

2. **Guard Tests**
   - ✅ RolesGuard allows request if user has required role
   - ✅ RolesGuard rejects request if user lacks required role (403)
   - ✅ RolesGuard allows Platform Admin always
   - ✅ OwnerOrAdminGuard allows Owner
   - ✅ OwnerOrAdminGuard allows Admin
   - ✅ OwnerOrAdminGuard rejects Estimator (403)

3. **End-to-End Role Tests**
   - ✅ Owner can create user
   - ✅ Admin can create user
   - ✅ Estimator cannot create user (403)
   - ✅ Estimator can create quote
   - ✅ Employee cannot create quote (403)
   - ✅ Bookkeeper can view invoice
   - ✅ Estimator cannot view invoice (403)

---

### **RBAC Enforcement Tests** (Critical)

**Purpose**: Verify every protected endpoint enforces roles correctly

**Strategy**: For each module (Leads, Quotes, Projects, etc.), test:
- Owner can access (200)
- Admin can access (200)
- Estimator can access (if allowed) (200) or (403)
- Employee cannot access (if not allowed) (403)
- Read-only cannot access (403)

**Test Matrix**: At least 10-15 endpoints across different modules

---

## Completion Checklist

- [ ] role table created and seeded
- [ ] user_role table created with indexes
- [ ] RBACService implemented (all methods)
- [ ] Permission matrix defined (hardcoded)
- [ ] RolesGuard implemented
- [ ] @Roles() decorator implemented
- [ ] OwnerOrAdminGuard implemented
- [ ] RBAC API controller implemented (all routes)
- [ ] Last Owner protection logic working
- [ ] Additive permissions working
- [ ] Platform Admin bypass working
- [ ] Audit logging implemented
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] RBAC enforcement tests passing (all modules)
- [ ] API documentation complete (Swagger)

---

## Common Pitfalls to Avoid

1. **Don't forget tenant_id on user_role** - Roles are tenant-specific
2. **Don't allow removing last Owner** - Hard validation required
3. **Don't cache roles in JWT** - Always fetch from database on critical operations
4. **Don't use AND logic for multiple roles** - Use OR (user needs at least one)
5. **Don't skip Platform Admin bypass** - Platform Admin must bypass all checks
6. **Don't forget to check roles on EVERY protected endpoint** - Even "obvious" ones
7. **Don't hardcode role checks in business logic** - Use guard/decorator pattern
8. **Don't forget audit logging** - Security requirement

---

## Integration with Other Modules

**Authentication Module**:
- User's roles loaded after login (optional: include in JWT)
- Re-check roles on each request (from database)

**Tenant Module**:
- Roles are tenant-specific
- user_role includes tenant_id

**All Business Modules**:
- Every controller uses @UseGuards(JwtAuthGuard, RolesGuard)
- Every protected route uses @Roles() decorator

---

**End of Backend Module Documentation**

RBAC is the security foundation for the entire platform. Must be implemented correctly and tested exhaustively.