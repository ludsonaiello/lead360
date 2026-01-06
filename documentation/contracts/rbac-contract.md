# Feature Contract: Role-Based Access Control (RBAC)

**Feature Name**: Role-Based Access Control (RBAC)  
**Module**: Authorization & Permissions  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides granular access control for users within a tenant based on their assigned roles. Ensures users can only perform actions appropriate to their job function, protecting sensitive data and preventing unauthorized operations.

**Who is this for?**

- **Primary Users**: All tenant users (assigned different roles)
- **Administrators**: Tenant Owners and Admins (assign roles to users)
- **Use Cases**: 
  - Restrict financial data access to authorized users
  - Allow estimators to create quotes but not manage finances
  - Limit employees to time tracking and assigned tasks
  - Provide read-only access for stakeholders

---

## Scope

### **In Scope**

- ✅ Seven default role templates (starting points)
- ✅ Custom roles (Platform Admin creates new roles)
- ✅ Granular permission builder (assign specific permissions per role)
- ✅ Role templates (pre-configured permission sets)
- ✅ Users can have multiple roles (role stacking)
- ✅ Role assignment by Owner/Admin
- ✅ API endpoint protection (role-based guards)
- ✅ UI feature visibility (hide inaccessible features)
- ✅ Dynamic permission matrix (stored in database)
- ✅ Module and permission management (Platform Admin)
- ✅ Default role assignment (configurable per tenant)
- ✅ Platform Admin role (super-user, cross-tenant access)
- ✅ Role audit logging (who assigned/removed roles)
- ✅ Batch operations (assign roles to multiple users, bulk permission updates)
- ✅ PATCH/UPDATE endpoints (modify roles and permissions)

### **Out of Scope**

- ❌ Time-based role assignment (temporary roles - Phase 2)
- ❌ Approval workflows for role changes (Phase 2)
- ❌ Role inheritance hierarchy (complex permission chains - Phase 2)
- ❌ Conditional permissions (based on resource ownership - Phase 2)

---

## Dependencies

### **Requires (must be complete first)**

- [ ] Authentication module (user management)
- [ ] Tenant module (multi-tenant isolation)
- [ ] Database initialized

### **Blocks (must complete before)**

- All business modules (Leads, Quotes, Projects, Invoices, etc.)
- Admin panel (requires Owner/Admin check)

---

## Data Model

### **Tables Required**

1. **role** - Roles (system default + custom admin-created)
2. **user_role** - Junction table (users have many roles)
3. **module** - Platform modules (Leads, Quotes, Projects, etc.)
4. **permission** - Actions per module (view, create, edit, delete, export, etc.)
5. **role_permission** - Which roles have which permissions (many-to-many)
6. **role_template** - Pre-configured role sets (starting points for admins)

**Architecture**: Fully dynamic, database-driven permission system. No hardcoded permissions in code.

---

## Role System Architecture

### **How It Works**

1. **Modules** are defined in database (Leads, Quotes, Projects, Invoices, etc.)
2. **Permissions** are defined per module (view, create, edit, delete, export, etc.)
3. **Roles** are created by Platform Admin and assigned specific permissions
4. **Role Templates** provide starting points (7 default templates)
5. **Admin** can create custom roles with any permission combination
6. **Users** are assigned roles, which grant them specific permissions

### **No Hardcoding**: All permissions are stored in database and checked dynamically at runtime.

---

## Default Role Templates

**Purpose**: Pre-configured roles that Platform Admin can create or use as starting points for custom roles.

### **Template 1: Owner**

**Description**: Tenant owner with full access to everything including billing and subscription management.

**Default Permissions**: ALL modules, ALL actions

**Cannot Be**:
- Removed from tenant (at least one Owner required)
- Deleted (can only transfer ownership)

**Use Case**: Business owner, founder

---

### **Template 2: Admin**

**Description**: Administrative user with nearly full access, except billing and subscription management.

**Default Permissions**: ALL modules except "Subscription" module, ALL actions

**Use Case**: Office manager, operations manager

---

### **Template 3: Estimator**

**Description**: Creates and manages quotes, estimates, and service requests. Limited financial visibility.

**Default Permissions**:
- Leads: view, create, edit
- Quotes: view, create, edit, send
- Service Requests: view, create, edit
- Projects: view, create
- Calendar: view, edit (own)

**Use Case**: Sales estimator, project estimator

---

### **Template 4: Project Manager**

**Description**: Manages active projects, tasks, and schedules. Limited financial access.

**Default Permissions**:
- Leads: view (read-only)
- Quotes: view (read-only)
- Projects: view, create, edit
- Tasks: view, create, edit, assign
- Change Orders: view, create, edit
- Calendar: view, edit
- Reports: view (project reports)

**Use Case**: Project manager, site supervisor

---

### **Template 5: Bookkeeper**

**Description**: Manages all financial operations including invoices, payments, and expenses.

**Default Permissions**:
- Leads: view (read-only)
- Quotes: view (read-only)
- Projects: view (read-only)
- Invoices: view, create, edit, send
- Payments: view, create, edit
- Expenses: view, create, edit
- Reports: view, export (financial reports)

**Use Case**: Bookkeeper, accountant, financial admin

---

### **Template 6: Employee**

**Description**: Limited access for field workers and staff. Clock in/out, view assigned tasks.

**Default Permissions**:
- Time Clock: create (clock in/out)
- Tasks: view (assigned only), edit (assigned only, status updates)
- Calendar: view (own)

**Use Case**: Field worker, crew member, installer

---

### **Template 7: Read-only**

**Description**: View-only access for stakeholders, investors, or auditors.

**Default Permissions**:
- Dashboard: view
- Reports: view, export (all reports)

**Use Case**: Investor, board member, auditor, stakeholder

---

### **Platform Admin (Special Role)**

**Description**: Super-user role for Lead360 platform administrators. Cross-tenant access.

**Permissions**: ALL (across all tenants)

**Special Attributes**:
- Not tenant-specific (has `is_platform_admin = true` on user table)
- Can access any tenant's data
- Can manage subscription plans
- Can manage license types
- Can suspend/activate tenants
- Bypasses all tenant isolation

**Use Case**: Lead360 platform support, system administrator

---

## Modules (Platform Features)

**Purpose**: Define what areas of the platform exist. Stored in database, managed by Platform Admin.

**Initial Modules** (Seeded on platform setup):
1. Dashboard
2. Leads
3. Quotes
4. Projects
5. Tasks
6. Invoices
7. Payments
8. Expenses
9. Reports
10. Calendar
11. Time Clock
12. Users (User Management)
13. Settings (Business Settings)
14. Subscription (Billing & Subscription)

**Module Fields**:
- name (unique identifier, e.g., "leads")
- display_name (human-readable, e.g., "Lead Management")
- description
- is_active (can be disabled to hide module from all users)
- sort_order (for UI display)

**Extensibility**: Platform Admin can add new modules as platform grows (e.g., "Inventory", "CRM", "Marketing").

---

## Permissions (Actions)

**Purpose**: Define what actions can be performed on modules. Stored in database.

**Standard Permissions** (Apply to most modules):
- **view** - Read access
- **create** - Create new records
- **edit** - Modify existing records
- **delete** - Delete records
- **export** - Export data (CSV, PDF)

**Module-Specific Permissions** (Examples):
- Quotes: **send** (send quote to customer)
- Projects: **assign** (assign tasks to users)
- Invoices: **send** (send invoice to customer)
- Time Clock: **clock_in**, **clock_out**
- Users: **manage_roles** (assign/remove roles)

**Permission Fields**:
- module_id (foreign key)
- action (e.g., "view", "create", "edit", "delete", "send")
- display_name (e.g., "View Leads", "Create Quotes")
- description
- is_active

**Flexibility**: Platform Admin can add new permissions as needed (e.g., "approve", "reject", "archive").

---

## Custom Roles

**Purpose**: Platform Admin creates roles tailored to specific needs beyond the 7 default templates.

**Use Cases**:
- Sales Manager (Leads + Quotes + Reports, but no Projects)
- Field Supervisor (Projects + Tasks + Time Clock, but no Financials)
- Customer Service (Leads + Communication, but no Quotes or Invoices)
- Finance Manager (All financial modules + Reports)

**Role Fields**:
- name (unique, e.g., "Sales Manager")
- description
- is_system_role (false for custom, true for templates)
- is_active (can be deactivated without deletion)
- created_by (Platform Admin user ID)
- created_at, updated_at

**Custom Role Creation Flow**:
1. Platform Admin navigates to Role Management
2. Clicks "Create Custom Role"
3. Enters role name and description
4. Uses Permission Builder to select modules and actions
5. Saves role
6. Role becomes available for assignment to users

**Role Templates vs. Custom Roles**:
- **Templates**: Pre-configured starting points (7 default)
- **Custom**: Admin-created from scratch or by copying/modifying template

---

## Granular Permission Builder

**Purpose**: UI for Platform Admin to assign specific permissions to roles.

**Interface**:
- Table or tree view showing all modules
- Each module expands to show available permissions
- Checkboxes to enable/disable each permission
- "Select All" / "Deselect All" shortcuts per module
- Visual grouping by permission type (view, create, edit, delete, special)

**Example**:
```
☐ Leads Module
  ☑ View Leads
  ☑ Create Leads
  ☑ Edit Leads
  ☐ Delete Leads
  ☑ Export Leads

☐ Quotes Module
  ☑ View Quotes
  ☑ Create Quotes
  ☑ Edit Quotes
  ☐ Delete Quotes
  ☑ Send Quotes
```

**Bulk Actions**:
- Copy permissions from existing role
- Apply template permissions
- Grant all view permissions
- Grant all create permissions

---

## Role Templates

**Purpose**: Pre-configured permission sets that Platform Admin can use as starting points.

**How It Works**:
1. Platform seeds database with 7 default role templates
2. Each template has predefined permissions (in role_permission table)
3. Platform Admin can:
   - Create role directly from template (one-click)
   - View template permissions before creating
   - Modify template permissions (creates custom role)
   - Create new templates for their own use

**Template Usage Flow**:
1. Admin clicks "Create Role from Template"
2. Selects template (e.g., "Estimator")
3. System pre-populates Permission Builder with template permissions
4. Admin can modify permissions before saving
5. Saves as new custom role

**Template Management**:
- Platform Admin can view all templates
- Can create new templates (save custom role as template)
- Cannot delete/edit default 7 templates (system-managed)
- Can deactivate templates (hide from selection)

---

## Permission Matrix

### **Dynamic Permission Matrix**

**Important**: Permission matrix is NOT hardcoded. It is dynamically generated from database at runtime.

**How It Works**:
1. Query role_permission table for all roles
2. Join with module and permission tables
3. Generate matrix showing which roles have which permissions
4. Display in admin UI for visibility
5. Use for runtime permission checks

**Example Query Logic**:
```
For role "Estimator":
  - Get all role_permission records where role_id = "Estimator"
  - Each record links to a permission (e.g., "leads:view")
  - Permission links to module (e.g., "Leads")
  - Result: Estimator can view, create, edit Leads
```

**API Response Example**:
```json
{
  "Owner": {
    "leads": ["view", "create", "edit", "delete", "export"],
    "quotes": ["view", "create", "edit", "delete", "send"],
    // ... all modules
  },
  "Estimator": {
    "leads": ["view", "create", "edit"],
    "quotes": ["view", "create", "edit", "send"],
    "invoices": []
  }
}
```

### **Permission Matrix Display**

The permission matrix is dynamically generated from the database and displayed in the admin UI for transparency and reference.

**Purpose**:
- Help admins understand what each role can do
- Visual tool for role comparison
- Reference when creating custom roles

**Matrix Structure**:
- Rows: Modules (Leads, Quotes, Projects, etc.)
- Columns: Actions (View, Create, Edit, Delete, Special Actions)
- Cells: Checkmarks showing which roles have which permissions

**Dynamic Nature**: As new modules, permissions, or roles are added, the matrix updates automatically.

---

## Business Rules

### **Role Management**

1. **System Roles vs. Custom Roles**:
   - System roles (7 default templates): Created by platform on setup
   - Custom roles: Created by Platform Admin anytime
   - Both types stored in same `role` table with `is_system_role` flag

2. **Role Naming**:
   - Name must be unique across platform
   - No special characters except spaces and hyphens
   - Case-sensitive (but enforce unique case-insensitive)

3. **Role Activation**:
   - Inactive roles (is_active = false) remain in database
   - Users keep inactive roles but permissions don't apply
   - Used for temporary role suspension

4. **Role Deletion**:
   - Cannot delete system roles (is_system_role = true)
   - Cannot delete if users have the role (must unassign first)
   - Soft delete (set deleted_at)

### **Permission Assignment**

1. **Dynamic Permissions**: All permissions stored in database, checked at runtime
2. **No Hardcoding**: Permission checks query database, never hardcoded in code
3. **Module-Action Pair**: Every permission is a combination of module + action
4. **Extensibility**: New modules and permissions added via admin UI, not code changes

### **Role Assignment to Users**

1. **Default Role**: Tenant can configure default role for new users (not hardcoded as "Read-only")
2. **Multiple Roles**: Users can have multiple roles (permissions are additive)
3. **Owner Requirement**: Every tenant must have at least one Owner
   - Cannot remove Owner role if it's the last Owner
   - Can transfer ownership (assign Owner to another, then remove from original)
4. **Self-Assignment**: Users cannot assign roles to themselves
   - Only Owner/Admin can assign roles to others
5. **Role Removal**: Owner/Admin can remove roles from users
   - Except: Cannot remove own Owner role if last Owner
6. **Platform Admin**: Cannot be assigned by tenant users
   - Only Lead360 system can assign Platform Admin

### **Permission Enforcement**

1. **Runtime Checks**: Every API request checks permissions from database
2. **Cache Strategy**: Permission checks can be cached (5 minutes max)
3. **UI Level**: Frontend hides features user cannot access
4. **API Level**: Backend validates permissions on every protected endpoint
5. **Additive Permissions**: If user has multiple roles, highest permission wins
   - Example: User is both "Employee" (can view tasks) and "Estimator" (can create quotes)
   - Result: Can view tasks AND create quotes

### **Permission Changes**

1. **Immediate Effect**: Permission changes (role updated, user role changed) take effect on next API request
2. **No Session Invalidation**: Users stay logged in when permissions change
3. **Re-check on Each Request**: Don't rely on JWT token for permissions (always check database)
4. **Cache Invalidation**: If using cache, invalidate on permission changes

### **Module & Permission Management**

1. **Platform Admin Only**: Only Platform Admin can manage modules and permissions
2. **Module Activation**: Inactive modules hidden from all users (regardless of permissions)
3. **Permission Activation**: Inactive permissions don't grant access (even if assigned to role)
4. **Breaking Changes**: Deleting module/permission removes from all roles (use deactivation instead)

---

## API Specification

### **Endpoints Overview**

#### **Role Management**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /roles | List all roles | Yes | All |
| POST | /roles | Create custom role | Yes | Platform Admin |
| GET | /roles/:id | Get role details | Yes | Platform Admin |
| PATCH | /roles/:id | Update role | Yes | Platform Admin |
| DELETE | /roles/:id | Delete role | Yes | Platform Admin |
| POST | /roles/:id/clone | Clone role | Yes | Platform Admin |

#### **Role Permissions**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /roles/:id/permissions | Get role's permissions | Yes | Platform Admin |
| PUT | /roles/:id/permissions | Replace all permissions | Yes | Platform Admin |
| POST | /roles/:id/permissions | Add permission to role | Yes | Platform Admin |
| DELETE | /roles/:id/permissions/:permissionId | Remove permission | Yes | Platform Admin |
| PATCH | /roles/:id/permissions/batch | Batch update permissions | Yes | Platform Admin |

#### **User Role Assignment**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /users/:id/roles | Get user's roles | Yes | Owner, Admin |
| POST | /users/:id/roles | Assign role to user | Yes | Owner, Admin |
| DELETE | /users/:id/roles/:roleId | Remove role from user | Yes | Owner, Admin |
| PATCH | /users/:id/roles | Update user's roles | Yes | Owner, Admin |
| POST | /users/roles/batch | Batch assign roles | Yes | Owner, Admin |

#### **Module Management**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /modules | List all modules | Yes | Platform Admin |
| POST | /modules | Create module | Yes | Platform Admin |
| GET | /modules/:id | Get module details | Yes | Platform Admin |
| PATCH | /modules/:id | Update module | Yes | Platform Admin |
| DELETE | /modules/:id | Delete module | Yes | Platform Admin |

#### **Permission Management**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /modules/:moduleId/permissions | List module's permissions | Yes | Platform Admin |
| POST | /modules/:moduleId/permissions | Create permission | Yes | Platform Admin |
| PATCH | /permissions/:id | Update permission | Yes | Platform Admin |
| DELETE | /permissions/:id | Delete permission | Yes | Platform Admin |

#### **Role Templates**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /role-templates | List all templates | Yes | Platform Admin |
| GET | /role-templates/:id | Get template details | Yes | Platform Admin |
| POST | /role-templates | Create template | Yes | Platform Admin |
| POST | /role-templates/:id/create-role | Create role from template | Yes | Platform Admin |

#### **Permission Matrix**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /permissions/matrix | Get full permission matrix | Yes | Owner, Admin, Platform Admin |

---

### **Endpoint Details**

#### **1. Create Custom Role**

**POST** `/roles`

**Purpose**: Platform Admin creates a new custom role

**Request Body**:
```json
{
  "name": "Sales Manager",
  "description": "Manages sales team and quotes",
  "is_active": true
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "name": "Sales Manager",
  "description": "Manages sales team and quotes",
  "is_system_role": false,
  "is_active": true,
  "created_by_user_id": "uuid",
  "created_at": "2025-01-05T10:00:00Z"
}
```

**Business Logic**:
1. Validate name is unique
2. Set is_system_role = false (custom role)
3. Create role record
4. Return role (permissions assigned separately)

---

#### **2. Update Role**

**PATCH** `/roles/:id`

**Purpose**: Update role name, description, or status

**Request Body**:
```json
{
  "name": "Senior Sales Manager",
  "description": "Updated description",
  "is_active": false
}
```

**Success Response (200)**:
```json
{
  "id": "uuid",
  "name": "Senior Sales Manager",
  "description": "Updated description",
  "is_active": false,
  "updated_at": "2025-01-05T11:00:00Z"
}
```

**Business Logic**:
1. Cannot update is_system_role (protected field)
2. Can update name, description, is_active
3. If is_active changed to false, users keep role but permissions don't apply
4. Audit log the change

---

#### **3. Delete Role**

**DELETE** `/roles/:id`

**Purpose**: Delete custom role

**Success Response (200)**:
```json
{
  "message": "Role deleted successfully"
}
```

**Business Logic**:
1. Cannot delete system roles (is_system_role = true)
2. Cannot delete if users currently have this role (check user_role table)
3. Must remove role from all users first
4. Soft delete (set deleted_at)

**Error Responses**:
- 400: Cannot delete system role
- 409: Role is assigned to users (must remove first)

---

#### **4. Clone Role**

**POST** `/roles/:id/clone`

**Purpose**: Create a copy of existing role with all its permissions

**Request Body**:
```json
{
  "new_name": "Sales Manager Copy"
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "name": "Sales Manager Copy",
  "description": "Cloned from Sales Manager",
  "permissions_copied": 15
}
```

**Business Logic**:
1. Create new role with new name
2. Copy all role_permission records
3. Return new role

---

#### **5. Get Role's Permissions**

**GET** `/roles/:id/permissions`

**Purpose**: Get all permissions assigned to a role

**Success Response (200)**:
```json
{
  "role_id": "uuid",
  "role_name": "Estimator",
  "permissions": [
    {
      "permission_id": "uuid",
      "module_name": "leads",
      "module_display_name": "Lead Management",
      "action": "view",
      "display_name": "View Leads"
    },
    {
      "permission_id": "uuid",
      "module_name": "leads",
      "module_display_name": "Lead Management",
      "action": "create",
      "display_name": "Create Leads"
    },
    // ... more permissions
  ]
}
```

---

#### **6. Replace All Role Permissions**

**PUT** `/roles/:id/permissions`

**Purpose**: Replace all permissions for a role (atomic operation)

**Request Body**:
```json
{
  "permission_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3",
    // ... array of permission IDs
  ]
}
```

**Success Response (200)**:
```json
{
  "role_id": "uuid",
  "permissions_added": 15,
  "permissions_removed": 8,
  "total_permissions": 15
}
```

**Business Logic**:
1. Delete all existing role_permission records for this role
2. Insert new role_permission records for provided permission_ids
3. Atomic transaction (all or nothing)
4. Return summary

---

#### **7. Add Permission to Role**

**POST** `/roles/:id/permissions`

**Purpose**: Add a single permission to role

**Request Body**:
```json
{
  "permission_id": "uuid"
}
```

**Success Response (201)**:
```json
{
  "role_id": "uuid",
  "permission_id": "uuid",
  "added_at": "2025-01-05T12:00:00Z"
}
```

**Business Logic**:
1. Check if role already has this permission (skip if duplicate)
2. Create role_permission record
3. Return confirmation

---

#### **8. Remove Permission from Role**

**DELETE** `/roles/:id/permissions/:permissionId`

**Purpose**: Remove a single permission from role

**Success Response (200)**:
```json
{
  "message": "Permission removed successfully"
}
```

---

#### **9. Batch Update Role Permissions**

**PATCH** `/roles/:id/permissions/batch`

**Purpose**: Add and remove multiple permissions in one request

**Request Body**:
```json
{
  "add": ["uuid-1", "uuid-2", "uuid-3"],
  "remove": ["uuid-4", "uuid-5"]
}
```

**Success Response (200)**:
```json
{
  "role_id": "uuid",
  "permissions_added": 3,
  "permissions_removed": 2,
  "total_permissions": 18
}
```

**Business Logic**:
1. Remove permissions in "remove" array
2. Add permissions in "add" array
3. Atomic transaction
4. Return summary

---

#### **10. Update User's Roles**

**PATCH** `/users/:id/roles`

**Purpose**: Replace all user's roles in one request (instead of multiple POST/DELETE)

**Request Body**:
```json
{
  "role_ids": [
    "uuid-owner",
    "uuid-estimator"
  ]
}
```

**Success Response (200)**:
```json
{
  "user_id": "uuid",
  "roles_added": 1,
  "roles_removed": 1,
  "current_roles": [
    {
      "role_id": "uuid-owner",
      "role_name": "Owner"
    },
    {
      "role_id": "uuid-estimator",
      "role_name": "Estimator"
    }
  ]
}
```

**Business Logic**:
1. Compare current roles vs. new roles
2. Remove roles not in new list
3. Add roles in new list but not in current
4. Validate last Owner protection
5. Atomic transaction
6. Audit log

---

#### **11. Batch Assign Roles to Users**

**POST** `/users/roles/batch`

**Purpose**: Assign same role(s) to multiple users at once

**Request Body**:
```json
{
  "user_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ],
  "role_ids": [
    "uuid-estimator"
  ]
}
```

**Success Response (200)**:
```json
{
  "users_updated": 3,
  "roles_assigned": 3,
  "details": [
    {
      "user_id": "uuid-1",
      "roles_added": 1
    },
    {
      "user_id": "uuid-2",
      "roles_added": 1
    },
    {
      "user_id": "uuid-3",
      "roles_added": 1
    }
  ]
}
```

**Business Logic**:
1. For each user_id, assign each role_id
2. Skip duplicates (if user already has role)
3. Atomic transaction (all users or none)
4. Audit log for each user

**Use Case**: Onboarding multiple employees at once, all get "Employee" role

---

#### **12. Create Module**

**POST** `/modules`

**Purpose**: Platform Admin creates new module

**Request Body**:
```json
{
  "name": "inventory",
  "display_name": "Inventory Management",
  "description": "Track materials and inventory",
  "sort_order": 15,
  "is_active": true
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "name": "inventory",
  "display_name": "Inventory Management",
  "description": "Track materials and inventory",
  "sort_order": 15,
  "is_active": true,
  "created_at": "2025-01-05T10:00:00Z"
}
```

---

#### **13. Create Permission**

**POST** `/modules/:moduleId/permissions`

**Purpose**: Platform Admin creates new permission for module

**Request Body**:
```json
{
  "action": "approve",
  "display_name": "Approve Quotes",
  "description": "Approve quotes before sending to customers",
  "is_active": true
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "module_id": "uuid",
  "action": "approve",
  "display_name": "Approve Quotes",
  "description": "Approve quotes before sending to customers",
  "is_active": true,
  "created_at": "2025-01-05T10:00:00Z"
}
```

---

#### **14. Get Permission Matrix**

**GET** `/permissions/matrix`

**Purpose**: Get complete permission matrix (dynamically generated from database)

**Success Response (200)**:
```json
{
  "matrix": {
    "Owner": {
      "leads": ["view", "create", "edit", "delete", "export"],
      "quotes": ["view", "create", "edit", "delete", "send", "approve"],
      "invoices": ["view", "create", "edit", "delete", "send"]
    },
    "Estimator": {
      "leads": ["view", "create", "edit"],
      "quotes": ["view", "create", "edit", "send"],
      "invoices": []
    },
    // ... all roles
  },
  "modules": [
    {
      "name": "leads",
      "display_name": "Lead Management",
      "permissions": ["view", "create", "edit", "delete", "export"]
    },
    // ... all modules
  ]
}
```

**Business Logic**:
1. Query all roles
2. For each role, get all assigned permissions
3. Group permissions by module
4. Return nested structure

---

#### **15. Create Role from Template**

**POST** `/role-templates/:id/create-role`

**Purpose**: Create new role using template as starting point

**Request Body**:
```json
{
  "role_name": "Custom Estimator",
  "description": "Estimator with custom permissions"
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "name": "Custom Estimator",
  "description": "Estimator with custom permissions",
  "permissions_copied": 12,
  "template_used": "Estimator"
}
```

**Business Logic**:
1. Create new role
2. Copy all permissions from template
3. Return new role

---

## UI Requirements

### **Pages Required**

1. **User Management Page** (`/settings/users`)
   - List of users
   - Each user shows assigned roles
   - "Edit Roles" button (Owner/Admin only)

2. **Edit User Roles Modal**
   - Checkbox list of all available roles
   - Role descriptions shown
   - Save button
   - Shows current roles pre-checked

3. **Role Description Page** (`/settings/roles`)
   - List of all roles with descriptions
   - Permission matrix table
   - Read-only (informational)

---

## User Flows

### **Primary Flow: Assign Roles to User**

1. Owner/Admin navigates to Settings → Users
2. Click user row → Click "Edit Roles"
3. Modal opens with checkbox list of roles
4. Current roles are pre-checked
5. Owner/Admin checks/unchecks roles
6. Click "Save"
7. API call to POST /users/:id/roles for new roles
8. API call to DELETE /users/:id/roles/:roleId for removed roles
9. Success toast: "Roles updated successfully"
10. Modal closes
11. User list refreshes

**Error Handling**:
- If removing last Owner: Show error modal "Cannot remove last Owner. Assign another Owner first."
- If API error: Show error modal with retry option

---

### **Secondary Flow: View Role Descriptions**

1. User navigates to Settings → Roles
2. Page displays all 7 roles
3. Each role shows:
   - Name
   - Description
   - Permission list (what they can/cannot do)
4. Permission matrix table at bottom
5. Read-only (no actions)

---

## Security & Permissions

### **API Enforcement**

Every API endpoint must:
1. Require authentication (JWT)
2. Check roles using `@Roles()` decorator
3. Validate user has at least one of required roles
4. Reject with 403 Forbidden if insufficient permissions

### **UI Enforcement**

Frontend must:
1. Hide menu items for inaccessible modules
2. Hide buttons for actions user cannot perform
3. Redirect to 403 page if user manually navigates to restricted route
4. Check roles on every navigation (in case roles changed)

### **Multi-Tenant Isolation**

- Roles are tenant-specific (user in Tenant A cannot access Tenant B)
- Platform Admin bypasses tenant isolation (cross-tenant access)

### **Audit Logging**

**Log These Actions**:
- Role assigned to user
- Role removed from user
- Ownership transferred
- User attempted action without permission (failed 403)

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Validate role names (only accept predefined)
- ✅ Check user has required role
- ✅ Check user has at least one of multiple roles
- ✅ Additive permissions (multiple roles)
- ✅ Cannot remove last Owner
- ✅ Platform Admin bypasses tenant isolation

**Integration Tests**:
- ✅ Assign role to user
- ✅ Remove role from user
- ✅ Get user's roles
- ✅ API endpoint rejects insufficient permissions (403)
- ✅ API endpoint allows sufficient permissions
- ✅ Multiple roles grant union of permissions

**RBAC Tests** (Critical):
- ✅ Owner can create quotes
- ✅ Estimator can create quotes
- ✅ Employee cannot create quotes (403)
- ✅ Bookkeeper can view invoices
- ✅ Estimator cannot view invoices (403)
- ✅ Owner can manage users
- ✅ Admin can manage users
- ✅ Estimator cannot manage users (403)
- ✅ User with multiple roles has combined permissions

---

### **Frontend Tests**

**Component Tests**:
- ✅ EditUserRolesModal shows current roles checked
- ✅ EditUserRolesModal allows checking/unchecking
- ✅ EditUserRolesModal shows role descriptions

**Integration Tests**:
- ✅ Owner can assign roles to user
- ✅ Admin can assign roles to user
- ✅ Estimator cannot access user management (UI hidden)
- ✅ Menu hides modules based on role
- ✅ Buttons hide based on role
- ✅ Navigation to restricted route shows 403 page

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] role table seeded with 7 predefined roles
- [ ] user_role junction table created
- [ ] All RBAC endpoints implemented
- [ ] Roles guard created and working
- [ ] @Roles() decorator working
- [ ] Permission checks on all protected endpoints
- [ ] Cannot remove last Owner enforced
- [ ] Audit logging for role changes
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] RBAC tests passing (all role combinations)
- [ ] API documentation complete

### **Frontend**
- [ ] User management page with role display
- [ ] Edit User Roles modal working
- [ ] Role descriptions page
- [ ] Menu items hidden based on role
- [ ] Action buttons hidden based on role
- [ ] 403 page for unauthorized access
- [ ] useRole() hook implemented
- [ ] Role check on every navigation
- [ ] Component tests >70% coverage
- [ ] E2E tests passing

### **Integration**
- [ ] Backend enforces roles on all endpoints
- [ ] Frontend hides inaccessible features
- [ ] Role changes reflect immediately in UI
- [ ] Multiple roles grant additive permissions

---

## Open Questions

1. **Role Hierarchy**
   - **Question**: Should roles have explicit hierarchy (Admin > Estimator > Employee)?
   - **Options**: Yes (explicit hierarchy) or No (flat, additive permissions)
   - **Decision**: Flat, additive permissions (simpler for MVP)
   - **Blocker**: No

2. **Custom Roles**
   - **Question**: When should we add custom role builder?
   - **Options**: Phase 2, Phase 3, or never (predefined only)
   - **Decision**: Phase 2 (after MVP proves demand)
   - **Blocker**: No

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Permission loopholes | High | Medium | Comprehensive RBAC tests, manual security audit |
| Last Owner deleted | High | Low | Hard validation preventing last Owner removal |
| Role confusion | Medium | Medium | Clear descriptions, permission matrix documentation |
| Performance (checking roles on every request) | Low | Low | Cache roles in JWT payload, validate on critical operations |

---

## Timeline Estimate

**Backend Development**: 6-8 days
- Tables and seeding: 1 day (4 new tables: module, permission, role_permission, role_template)
- Role CRUD operations: 1 day
- Permission builder logic: 1.5 days
- Dynamic permission checking: 1.5 days
- Batch operations: 0.5 day
- API endpoints (15+ endpoints): 1.5 days
- Testing: 2 days

**Frontend Development**: 5-7 days
- Role management UI: 1.5 days
- Permission builder UI (checkbox matrix): 2 days
- Template management: 0.5 day
- User role assignment UI: 1 day
- Batch operations UI: 0.5 day
- Testing: 1.5 days

**Integration & Testing**: 2 days

**Total**: 13-17 days

---

## Notes

- RBAC is critical for security and compliance
- Must be tested exhaustively before production
- Role descriptions must be clear to avoid confusion
- Permission matrix should be displayed in UI for transparency
- Platform Admin is special case (cross-tenant access)

---

**End of RBAC Contract**
