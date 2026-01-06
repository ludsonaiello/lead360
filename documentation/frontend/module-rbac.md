# Frontend Module: Role-Based Access Control (RBAC)

**Module Name**: RBAC  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/rbac-contract.md`  
**Backend Module**: `/documentation/backend/module-rbac.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements role-based UI visibility and access control across the entire frontend. You will build user management interfaces and role-checking logic that hides/shows features based on user permissions.

**CRITICAL**: Do NOT start until backend RBAC module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/rbac-contract.md` (role definitions and permission matrix)
- `/documentation/backend/module-rbac.md` (API endpoints)
- Backend API documentation (Swagger)

---

## Technology Stack

**No New Libraries Required** - Use existing:
- react-hook-form + zod (for forms)
- @headlessui/react (for modals, checkboxes)
- lucide-react (icons)
- axios (API calls)

---

## Project Structure

```
app/
├── (dashboard)/
│   ├── settings/
│   │   ├── users/
│   │   │   ├── page.tsx (user list)
│   │   │   └── [id]/page.tsx (user detail)
│   │   ├── roles/
│   │   │   └── page.tsx (role information - read-only for users)
│   │   └── layout.tsx
│   └── layout.tsx
├── (admin)/
│   ├── roles/
│   │   ├── page.tsx (role management - Platform Admin only)
│   │   ├── [id]/
│   │   │   └── page.tsx (edit role permissions)
│   │   └── new/
│   │       └── page.tsx (create custom role)
│   ├── modules/
│   │   └── page.tsx (module management - Platform Admin only)
│   ├── role-templates/
│   │   └── page.tsx (template management)
│   └── layout.tsx
├── components/
│   ├── rbac/
│   │   ├── UserRolesList.tsx
│   │   ├── EditUserRolesModal.tsx
│   │   ├── RoleDescriptionCard.tsx
│   │   ├── PermissionMatrixTable.tsx (dynamic, from API)
│   │   ├── RoleRequiredWrapper.tsx
│   │   ├── PermissionBuilder.tsx (checkbox matrix UI - Platform Admin)
│   │   ├── RoleForm.tsx (create/edit role)
│   │   ├── ModulePermissionGroup.tsx (expandable permission group)
│   │   ├── BatchRoleAssignModal.tsx
│   │   ├── RoleTemplateCard.tsx
│   │   └── CloneRoleModal.tsx
│   └── ui/
├── lib/
│   ├── api/
│   │   └── rbac.ts (expanded with new endpoints)
│   ├── hooks/
│   │   ├── useRole.ts (updated to work with dynamic permissions)
│   │   ├── usePermission.ts (fetches from API, not hardcoded)
│   │   ├── useCurrentUser.ts
│   │   └── usePermissionMatrix.ts (new - fetches dynamic matrix)
│   ├── utils/
│   │   └── permissions.ts (REMOVED - no hardcoded permissions)
│   └── types/
│       └── rbac.ts (expanded interfaces)
├── contexts/
│   └── RBACContext.tsx (updated to fetch from API)
└── middleware.ts (role checks for routing)
```

---

## TypeScript Interfaces

**Location**: `lib/types/rbac.ts`

Define interfaces for:
- Role (id, name, description, is_system_role)
- UserRole (role_id, role_name, assigned_by, assigned_at)
- PermissionMatrix (nested object structure)

Developer will create based on API documentation.

---

## API Client

**Location**: `lib/api/rbac.ts`

**Methods to Implement**:

#### **Role Management**
1. **getAllRoles()** - GET /roles
2. **getRole(roleId)** - GET /roles/:id
3. **createRole(data)** - POST /roles
4. **updateRole(roleId, data)** - PATCH /roles/:id
5. **deleteRole(roleId)** - DELETE /roles/:id
6. **cloneRole(roleId, newName)** - POST /roles/:id/clone

#### **Role Permissions**
7. **getRolePermissions(roleId)** - GET /roles/:id/permissions
8. **replaceRolePermissions(roleId, permissionIds)** - PUT /roles/:id/permissions
9. **addPermissionToRole(roleId, permissionId)** - POST /roles/:id/permissions
10. **removePermissionFromRole(roleId, permissionId)** - DELETE /roles/:id/permissions/:permissionId
11. **batchUpdateRolePermissions(roleId, add, remove)** - PATCH /roles/:id/permissions/batch

#### **User Role Assignment**
12. **getUserRoles(userId)** - GET /users/:id/roles
13. **assignRole(userId, roleId)** - POST /users/:id/roles
14. **removeRole(userId, roleId)** - DELETE /users/:id/roles/:roleId
15. **replaceUserRoles(userId, roleIds)** - PATCH /users/:id/roles
16. **batchAssignRoles(userIds, roleIds)** - POST /users/roles/batch

#### **Module Management** (Platform Admin)
17. **getAllModules()** - GET /modules
18. **createModule(data)** - POST /modules
19. **updateModule(moduleId, data)** - PATCH /modules/:id
20. **deleteModule(moduleId)** - DELETE /modules/:id

#### **Permission Management** (Platform Admin)
21. **getModulePermissions(moduleId)** - GET /modules/:moduleId/permissions
22. **createPermission(moduleId, data)** - POST /modules/:moduleId/permissions
23. **updatePermission(permissionId, data)** - PATCH /permissions/:id
24. **deletePermission(permissionId)** - DELETE /permissions/:id

#### **Role Templates**
25. **getAllTemplates()** - GET /role-templates
26. **getTemplate(templateId)** - GET /role-templates/:id
27. **createRoleFromTemplate(templateId, roleName, description)** - POST /role-templates/:id/create-role
28. **createTemplate(data)** - POST /role-templates

#### **Permission Matrix**
29. **getPermissionMatrix()** - GET /permissions/matrix (dynamically generated from database)

---

## RBAC Context

**Location**: `contexts/RBACContext.tsx`

**Purpose**: Global RBAC state management

**State to Manage**:
- userRoles (array of role objects with IDs and names)
- userPermissions (array of {module, action, permission_id})
- isLoading (boolean)
- permissionMatrix (fetched from API - NOT hardcoded)

**Methods to Provide**:
- hasRole(roleName) → boolean
- hasAnyRole(roleNames[]) → boolean
- canPerform(module, action) → boolean
- refreshRoles() → void
- refreshPermissions() → void

**Implementation Logic**:
1. On mount: Fetch current user's roles AND permissions
2. Store in state
3. Provide helper methods for permission checks
4. Re-fetch on user/permission changes

**CRITICAL**: Do NOT hardcode permissions. Always fetch from API.

**Permission Checking**:
```typescript
canPerform(module: string, action: string) {
  // Check if userPermissions array includes this module+action
  return userPermissions.some(
    p => p.module === module && p.action === action
  );
}
```

---

## Custom Hooks

### **useRole()**

**Location**: `lib/hooks/useRole.ts`

**Purpose**: Check if current user has specific role

**Usage**:
```typescript
const { hasRole, hasAnyRole } = useRole();

if (hasRole('Owner')) {
  // Show owner-only feature
}

if (hasAnyRole(['Owner', 'Admin'])) {
  // Show admin feature
}
```

**Returns**:
- hasRole(roleName: string) → boolean
- hasAnyRole(roleNames: string[]) → boolean
- isOwner → boolean (shortcut for hasRole('Owner'))
- isAdmin → boolean (shortcut for hasRole('Admin'))
- roles → string[] (all role names)

---

### **usePermission()**

**Location**: `lib/hooks/usePermission.ts`

**Purpose**: Check if current user can perform specific action

**Usage**:
```typescript
const { canPerform, permissions, isLoading } = usePermission();

if (canPerform('leads', 'create')) {
  // Show "Create Lead" button
}
```

**Returns**:
- canPerform(module: string, action: string) → boolean
- permissions → array of {module, action, permission_id}
- isLoading → boolean

**Implementation Logic**:
1. Get userPermissions from RBACContext (fetched from API)
2. canPerform checks if module+action exists in userPermissions array
3. NO hardcoded permissions - always uses API data

**Example**:
```typescript
export function usePermission() {
  const { userPermissions, isLoading } = useRBAC();

  const canPerform = useCallback((module: string, action: string) => {
    return userPermissions.some(
      p => p.module === module && p.action === action
    );
  }, [userPermissions]);

  return { canPerform, permissions: userPermissions, isLoading };
}
```

---

### **usePermissionMatrix()**

**Location**: `lib/hooks/usePermissionMatrix.ts`

**Purpose**: Fetch complete permission matrix (for admin UI)

**Usage**:
```typescript
const { matrix, modules, isLoading } = usePermissionMatrix();
```

**Returns**:
- matrix → object {role_name: {module_name: [actions]}}
- modules → array of modules with available permissions
- isLoading → boolean

**Implementation**:
- Fetches from GET /permissions/matrix
- Dynamically generated from database
- Used by admin to display permission matrix table

---

### **useCurrentUser()**

**Location**: `lib/hooks/useCurrentUser.ts`

**Purpose**: Get current user with roles

**Usage**:
```typescript
const { user, roles, isLoading } = useCurrentUser();
```

**Returns**:
- user (User object)
- roles (string[])
- isLoading (boolean)

---

## Role-Based Component Wrapper

**Component**: `RoleRequiredWrapper.tsx`

**Location**: `components/rbac/RoleRequiredWrapper.tsx`

**Purpose**: Wrap components that require specific roles

**Usage**:
```typescript
<RoleRequiredWrapper roles={['Owner', 'Admin']}>
  <EditBusinessSettingsButton />
</RoleRequiredWrapper>
```

**Behavior**:
- If user has at least one required role: Render children
- If user lacks required roles: Render nothing (or optional fallback)
- Loading state: Show skeleton or nothing

**Props**:
- roles (string[], required roles)
- fallback (ReactNode, optional - shown if user lacks roles)
- showUpgradeBadge (boolean, show "Upgrade to Pro" if role restricted by plan)

---

---

## Platform Admin: Role Management UI

**Purpose**: Allow Platform Admin to create, edit, and manage roles and permissions

---

### **Role Management Page** (Platform Admin Only)

**Route**: `/admin/roles`

**Layout**:
- Search bar (by role name)
- Filter: System roles / Custom roles / All
- Role cards or table
- "Create Custom Role" button

**Role Card/Row Display**:
- Role name
- Description
- Type badge (System / Custom)
- Permission count (e.g., "15 permissions")
- Status (Active / Inactive)
- Actions (Edit Permissions, Clone, Deactivate, Delete)

**Behavior**:
- Search filters roles real-time
- Click "Edit Permissions" → Navigate to Permission Builder page
- Click "Clone" → Open modal to enter new name → Clone role with all permissions
- Click "Deactivate" → Set is_active=false (role remains but doesn't grant permissions)
- Click "Delete" → Confirmation modal → Delete (only if no users have role)

---

### **Create Custom Role Page**

**Route**: `/admin/roles/new`

**Layout**:
```
[Header: "Create Custom Role"]

[Form:]
Role Name (required)
Description
[Save & Add Permissions Button]

OR

[Section: "Start from Template"]
[RoleTemplateCard x7] - Click to create from template
```

**Create from Scratch**:
1. Enter name and description
2. Click "Save & Add Permissions"
3. Role created with no permissions
4. Redirect to Permission Builder page

**Create from Template**:
1. Click template card
2. Modal asks for role name
3. Role created with template's permissions
4. Redirect to Permission Builder page

---

### **Permission Builder Page**

**Route**: `/admin/roles/[id]`

**Purpose**: Assign permissions to role using checkbox matrix

**Layout**:
```
[Header: "Edit Permissions - {Role Name}"]
[Breadcrumb: Roles > {Role Name}]

[Action Buttons:]
[Select All] [Deselect All] [Save Changes]

[Permission Matrix:]
├── 📊 Dashboard Module
│   ├── ☑ View Dashboard
│
├── 👥 Lead Management Module (expanded)
│   ├── ☑ View Leads
│   ├── ☑ Create Leads
│   ├── ☑ Edit Leads
│   ├── ☐ Delete Leads
│   ├── ☑ Export Leads
│
├── 📝 Quote Builder Module
│   ├── ☑ View Quotes
│   ├── ☑ Create Quotes
│   ├── ☑ Edit Quotes
│   ├── ☐ Delete Quotes
│   ├── ☑ Send Quotes
│
├── ... (all modules)

[Bottom Actions:]
[Cancel] [Save Changes]
```

**Component**: `PermissionBuilder.tsx`

**Behavior**:
1. On mount: Fetch role's current permissions
2. Display all modules (from API)
3. For each module, show all available permissions
4. Checkbox for each permission (checked if role has it)
5. User checks/unchecks permissions
6. Click "Save Changes"
7. Calculate diff (added permissions, removed permissions)
8. API call: PATCH /roles/:id/permissions/batch
9. Success toast → Stay on page (or redirect to role list)

**Module Permission Group Component**: `ModulePermissionGroup.tsx`

Props:
- module (Module object)
- permissions (Permission array for this module)
- selectedPermissionIds (array of currently selected)
- onChange (callback when permissions change)

**Features**:
- Expand/collapse module
- "Select All" / "Deselect All" for module
- Visual grouping by action type:
  - Read: view
  - Write: create, edit
  - Delete: delete
  - Special: send, export, approve, etc.

---

### **Clone Role Modal**

**Component**: `CloneRoleModal.tsx`

**Purpose**: Clone existing role with all permissions

**Layout**:
```
[Modal Header: "Clone Role"]

You are cloning "{Original Role Name}"

New Role Name (required)
Description (optional)

[Cancel] [Create Clone]
```

**Behavior**:
1. User enters new name
2. Click "Create Clone"
3. API call: POST /roles/:id/clone
4. Success toast
5. Redirect to new role's permission builder page

---

### **Module Management Page** (Platform Admin Only)

**Route**: `/admin/modules`

**Purpose**: Manage platform modules (add/edit/deactivate)

**Layout**:
- Table of modules
- Columns: Name, Display Name, Permission Count, Status, Sort Order
- "Add Module" button

**Module Form (Modal)**:
- Name (unique identifier, lowercase, no spaces)
- Display Name (human-readable)
- Description
- Icon (optional)
- Sort Order (integer)
- Is Active (toggle)

**Behavior**:
- Add module → Create module record
- Edit module → Update display name, description, status
- Cannot edit "name" (breaking change - immutable)
- Cannot delete module if permissions exist (show warning)

---

### **Permission Management** (Per Module)

**Route**: `/admin/modules/[moduleId]/permissions`

**Purpose**: Manage permissions for specific module

**Layout**:
- Table of permissions for module
- Columns: Action, Display Name, Description, Status
- "Add Permission" button

**Permission Form (Modal)**:
- Action (e.g., "approve", "archive")
- Display Name (e.g., "Approve Quotes")
- Description
- Is Active (toggle)

**Behavior**:
- Add permission → Create permission record
- Edit permission → Update display name, description, status
- Cannot edit "action" (breaking change)
- Delete permission → Confirmation → Removes from all roles

---

### **Role Template Management Page**

**Route**: `/admin/role-templates`

**Purpose**: Manage role templates for quick role creation

**Layout**:
- List of templates (7 system + custom)
- Template cards showing:
  - Template name
  - Description
  - Permission count
  - Type (System / Custom)
- "Create Template" button

**Template Card**: `RoleTemplateCard.tsx`

Display:
- Template name
- Description
- Permission summary (e.g., "Full access to Leads, Quotes, Projects")
- "Create Role from Template" button

**Create Template**:
1. Click "Create Template"
2. Enter name and description
3. Use Permission Builder to select permissions
4. Save as template
5. Template available for future role creation

---

### **Batch Role Assignment Modal**

**Component**: `BatchRoleAssignModal.tsx`

**Purpose**: Assign same role(s) to multiple users

**Usage**: From User Management page, select multiple users, click "Assign Roles"

**Layout**:
```
[Modal Header: "Assign Roles to Multiple Users"]

Selected Users: {count}
- User 1 Name
- User 2 Name
- User 3 Name

Select Roles to Assign:
☐ Owner
☑ Estimator
☐ Project Manager
☑ Employee

[Cancel] [Assign Roles]
```

**Behavior**:
1. User selects multiple users (checkboxes on user list)
2. Click "Assign Roles" button
3. Modal opens with selected users
4. User checks roles to assign
5. Click "Assign Roles"
6. API call: POST /users/roles/batch
7. Success toast with summary
8. Refresh user list

---

## User Management Page

**Route**: `/settings/users`

**Layout**:
- Search bar (by name, email)
- User table/list
- "Invite User" button (Owner/Admin only)

**Table Columns**:
- Name
- Email
- Roles (badges for each role)
- Status (Active/Inactive)
- Last Login
- Actions (Edit, Edit Roles, Deactivate)

**Behavior**:
- Search filters real-time
- Click "Edit Roles" → Open EditUserRolesModal
- Only Owner/Admin see this page (menu hidden for others)

---

## Edit User Roles Modal

**Component**: `EditUserRolesModal.tsx`

**Location**: `components/rbac/EditUserRolesModal.tsx`

**Props**:
- isOpen (boolean)
- onClose (function)
- user (User object)
- currentRoles (string[] - user's current roles)
- onSave (function)

**Layout**:
```
[Modal Header: "Edit Roles - {User Name}"]

[Checkbox List:]
☑ Owner - Full access including billing
☐ Admin - Full access except billing
☑ Estimator - Create quotes and estimates
☐ Project Manager - Manage projects and tasks
☐ Bookkeeper - Manage financials
☐ Employee - Time tracking and assigned tasks
☐ Read-only - View reports only

[Cancel Button] [Save Changes Button]
```

**Behavior**:
1. Load user's current roles on open
2. Pre-check checkboxes for current roles
3. User checks/unchecks roles
4. Click "Save Changes"
5. Compare current vs. new roles
6. For new roles: Call assignRole() API
7. For removed roles: Call removeRole() API
8. Show loading spinner during save
9. On success: Close modal, refresh user list, show success toast
10. On error: Show error modal

**Special Handling**:
- If unchecking "Owner" and user is last Owner:
  - API returns 400 error
  - Show error modal: "Cannot remove last Owner. Please assign another Owner first."
  - Re-check "Owner" checkbox
  - Do not close modal

**Role Descriptions**:
- Each checkbox shows role name + short description
- "Learn more" link opens role information page

---

## Role Information Page

**Route**: `/settings/roles`

**Purpose**: Educational page showing all roles and their permissions

**Layout**:
```
[Header: "Roles & Permissions"]
[Subtitle: "Understand what each role can do"]

[Section: Role Descriptions]
[RoleDescriptionCard x7 - one for each role]

[Section: Permission Matrix]
[PermissionMatrixTable - full permission breakdown]
```

**RoleDescriptionCard Component**:
- Role name (badge with color)
- Description
- Key permissions (bullet list of main capabilities)
- Expand button for full permission list

**PermissionMatrixTable Component**:
- Table with modules as rows, actions as columns
- Checkmarks show which roles can perform which actions
- Color-coded for readability
- Exportable to PDF (future)

---

## Menu Visibility Logic

**Requirement**: Hide menu items user cannot access

**Implementation**: In sidebar/navigation component

**Pattern**:
```typescript
const { canPerform } = usePermission();

// Only show "Leads" menu if user can view leads
{canPerform('leads', 'view') && (
  <MenuItem href="/leads" icon={Users}>Leads</MenuItem>
)}

// Only show "Invoices" if user can view invoices
{canPerform('invoices', 'view') && (
  <MenuItem href="/invoices" icon={FileText}>Invoices</MenuItem>
)}

// Only show "Settings → Users" if Owner/Admin
{hasAnyRole(['Owner', 'Admin']) && (
  <MenuItem href="/settings/users" icon={Users}>User Management</MenuItem>
)}
```

**Result**: Employee sees minimal menu (Dashboard, Time Clock). Owner sees full menu.

---

## Button Visibility Logic

**Requirement**: Hide action buttons user cannot perform

**Pattern**:
```typescript
const { canPerform } = usePermission();

// Only show "Create Lead" if user can create leads
{canPerform('leads', 'create') && (
  <Button onClick={openCreateLeadModal}>
    Create Lead
  </Button>
)}

// Only show "Edit" if user can edit
{canPerform('leads', 'edit') && (
  <Button onClick={openEditModal}>
    Edit
  </Button>
)}

// Only show "Delete" if user can delete
{canPerform('leads', 'delete') && (
  <Button variant="danger" onClick={confirmDelete}>
    Delete
  </Button>
)}
```

---

## Route Protection (403 Page)

**Requirement**: If user manually navigates to restricted route, show 403 page

**Implementation**: In route component (page.tsx)

**Pattern**:
```typescript
export default function LeadsPage() {
  const { canPerform, isLoading } = usePermission();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!canPerform('leads', 'view')) {
    return <Forbidden403Page />;
  }

  return <LeadsListComponent />;
}
```

**403 Page Component**:
- Heading: "Access Denied"
- Message: "You don't have permission to access this page."
- Subtext: "Contact your administrator if you need access."
- Button: "Back to Dashboard"

---

## Role Change Handling

**Scenario**: User's roles change while they're logged in

**Implementation**:
1. **On navigation**: Re-fetch roles from API
2. **On visibility change (tab focus)**: Re-fetch roles
3. **On WebSocket event** (future): Real-time role update

**Pattern** (in RBACContext):
```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      refreshRoles();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, []);
```

**Result**: If admin changes user's roles, user sees updated permissions on next page navigation or tab focus.

---

## Multiple Roles Display

**Requirement**: Show all user's roles clearly

**Pattern** (in UserTable):
```typescript
<td>
  {user.roles.map(role => (
    <Badge key={role} color={getRoleColor(role)}>
      {role}
    </Badge>
  ))}
</td>
```

**Role Colors**:
- Owner: Purple
- Admin: Blue
- Estimator: Green
- Project Manager: Yellow
- Bookkeeper: Orange
- Employee: Gray
- Read-only: Light Gray

---

## Conditional Form Fields

**Requirement**: Some form fields only visible to certain roles

**Pattern**:
```typescript
const { canPerform } = usePermission();

<Form>
  <Input label="Quote Amount" />
  
  {canPerform('invoices', 'view') && (
    <Input label="Invoice Amount" />
  )}
  
  {hasRole('Owner') && (
    <Input label="Profit Margin" />
  )}
</Form>
```

---

## Testing Requirements

### **Component Tests** (>70% coverage)

1. **EditUserRolesModal**
   - ✅ Shows current roles checked
   - ✅ Allows checking/unchecking roles
   - ✅ Shows role descriptions
   - ✅ Calls assignRole API on save
   - ✅ Calls removeRole API on save
   - ✅ Shows error if removing last Owner
   - ✅ Closes on successful save

2. **RoleRequiredWrapper**
   - ✅ Renders children if user has required role
   - ✅ Renders nothing if user lacks required role
   - ✅ Renders fallback if provided

3. **PermissionMatrixTable**
   - ✅ Displays all roles and permissions
   - ✅ Checkmarks shown correctly

4. **useRole() Hook**
   - ✅ hasRole() returns true if user has role
   - ✅ hasRole() returns false if user lacks role
   - ✅ hasAnyRole() returns true if user has at least one
   - ✅ hasAnyRole() returns false if user has none

5. **usePermission() Hook**
   - ✅ canPerform() returns true if allowed
   - ✅ canPerform() returns false if not allowed
   - ✅ Works with multiple roles (additive)

---

### **Integration Tests (E2E)**

1. **Role Assignment Flow**
   - ✅ Owner logs in
   - ✅ Navigates to User Management
   - ✅ Clicks "Edit Roles" on user
   - ✅ Checks "Estimator" role
   - ✅ Saves
   - ✅ User now has "Estimator" role
   - ✅ User can now access Leads and Quotes

2. **Menu Visibility**
   - ✅ Owner sees full menu
   - ✅ Admin sees full menu (except billing)
   - ✅ Estimator sees Leads, Quotes, Dashboard
   - ✅ Employee sees Dashboard, Time Clock only
   - ✅ Read-only sees Dashboard, Reports only

3. **Button Visibility**
   - ✅ Owner sees "Create Lead" button
   - ✅ Estimator sees "Create Lead" button
   - ✅ Employee does NOT see "Create Lead" button
   - ✅ Owner sees "Delete" buttons
   - ✅ Estimator does NOT see "Delete" buttons

4. **403 Page**
   - ✅ Employee navigates to /invoices
   - ✅ Sees 403 page
   - ✅ Cannot access invoices

5. **Last Owner Protection**
   - ✅ Owner tries to remove own Owner role (is last Owner)
   - ✅ Modal shows error
   - ✅ Role not removed
   - ✅ Checkbox re-checked

---

## Completion Checklist

- [ ] All TypeScript interfaces defined
- [ ] RBAC API client implemented (all methods)
- [ ] Permission matrix copied to frontend
- [ ] RBACContext implemented
- [ ] useRole() hook implemented
- [ ] usePermission() hook implemented
- [ ] useCurrentUser() hook implemented
- [ ] RoleRequiredWrapper component
- [ ] User Management page
- [ ] EditUserRolesModal component
- [ ] Role Information page
- [ ] RoleDescriptionCard component
- [ ] PermissionMatrixTable component
- [ ] Menu visibility logic (all modules)
- [ ] Button visibility logic (all actions)
- [ ] 403 page
- [ ] Route protection on all pages
- [ ] Role change handling (re-fetch on navigation)
- [ ] Component tests >70% coverage
- [ ] E2E tests passing
- [ ] No TypeScript errors
- [ ] No console errors

---

## Modern UI/UX Checklist

- [ ] Role badges color-coded
- [ ] Role descriptions clear and helpful
- [ ] Permission matrix table readable
- [ ] Modal for role editing (not separate page)
- [ ] Loading states on role save
- [ ] Success toast on role save
- [ ] Error modal for last Owner removal
- [ ] Smooth transitions when hiding/showing UI elements
- [ ] 403 page user-friendly
- [ ] Menu items hidden (not disabled) if inaccessible
- [ ] Buttons hidden (not disabled) if user cannot perform action
- [ ] Mobile responsive (role badges stack properly)

---

## Common Pitfalls to Avoid

1. **Don't disable buttons** - Hide them instead (cleaner UI)
2. **Don't show empty menus** - Hide entire section if no accessible items
3. **Don't cache roles indefinitely** - Re-fetch on navigation/tab focus
4. **Don't forget loading states** - Show spinner while checking permissions
5. **Don't hardcode role checks** - Use useRole() and usePermission() hooks
6. **Don't skip 403 page** - Users will manually navigate to restricted URLs
7. **Don't forget multiple roles** - User can have multiple roles (additive)
8. **Don't show cryptic errors** - "Cannot remove last Owner" is clear, "400 Bad Request" is not

---

## Edge Cases to Handle

1. **User has no roles**
   - Default to Read-only behavior
   - Show message: "No roles assigned. Contact administrator."

2. **API returns stale roles**
   - Re-fetch on every navigation (acceptable overhead)
   - Cache for 5 minutes max

3. **User's roles change mid-session**
   - Re-fetch on tab focus
   - Show notification: "Your permissions have changed. Please refresh."

4. **Last Owner tries to remove own role**
   - Prevent in UI (show error immediately)
   - Backend also validates (double protection)

5. **User removes role A and adds role B in same save**
   - Handle sequentially (remove, then add)
   - Show loading during both operations

---

**End of Frontend Module Documentation**

RBAC UI must be clear, intuitive, and foolproof. Users should understand their permissions without confusion.