# Admin Sprint 7 — Platform Admin: Users List Page
**Module:** Users (Frontend — Platform Admin)
**File:** ./documentation/sprints/users/admin_sprint_7.md
**Type:** Frontend
**Depends On:** Admin Sprint 1 (Types + API Client)
**Gate:** STOP — Admin users list must show real cross-tenant user data before Sprint 8
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit the admin endpoints** to verify actual response shapes.
4. **Use existing components and patterns.** Follow the admin pages pattern from `app/src/app/(dashboard)/admin/`.
5. **Platform admin only.** Use `ProtectedRoute` with platform admin permission.
6. **Production-quality UI.** Dark mode, responsive, search, filters, pagination.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin — required for all admin endpoints |

---

## Objective

Build the **Platform Admin > Users** list page at `/admin/users`. This page shows ALL users across ALL tenants, with:
- Paginated table: Name, Email, Tenant, Role(s), Status, Last Login, Actions
- Search input (searches name/email)
- Status filter (active, inactive, deleted)
- Pagination controls
- RBAC protection (platform admin only)

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/users.ts` has `adminListUsers()` function
- [ ] Confirm `app/src/lib/types/users.ts` has `AdminUserListItem`, `AdminUserListResponse`, `AdminUserListParams`
- [ ] Read `app/src/app/(dashboard)/admin/rbac/roles/page.tsx` — admin page pattern
- [ ] Read `app/src/components/rbac/shared/ProtectedRoute.tsx` — platform admin protection
- [ ] Read `app/src/components/dashboard/DashboardSidebar.tsx` — admin navigation already has "Users" group (lines 263-273)

---

## Task 1 — Hit the Admin Endpoints

```bash
# Login as platform admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# GET /admin/users — List all users
curl -s "http://localhost:8000/api/v1/admin/users?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | head -c 5000

# GET /admin/users with search
curl -s "http://localhost:8000/api/v1/admin/users?page=1&limit=10&search=honey" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000

# GET /admin/users with status filter
curl -s "http://localhost:8000/api/v1/admin/users?page=1&limit=10&status=active" \
  -H "Authorization: Bearer $TOKEN" | head -c 3000
```

**IMPORTANT:** Note the response shape carefully:
- The pagination key is `pagination` (NOT `meta` like tenant endpoints)
- The `roles` field is an array of role name strings (NOT objects)
- Some users may not have a `tenant_id` (platform admins without membership)

**Acceptance:** You know the actual response shape for admin user list.

---

## Task 2 — Add Admin Users Nav Link to Sidebar

**What:** The admin sidebar already has a "Users" group (lines 263-273 in DashboardSidebar.tsx) that contains RBAC items. Add a "User Accounts" link that goes to `/admin/users`.

**File to modify:** `/var/www/lead360.app/app/src/components/dashboard/DashboardSidebar.tsx`

**Find the existing admin "Users" nav group (around line 263-273):**
```typescript
{
  name: 'Users',
  icon: Users,
  permission: 'rbac:view',
  items: [
    { name: 'Roles', href: '/admin/rbac/roles', icon: Shield, permission: 'rbac:view' },
    { name: 'Permissions', href: '/admin/rbac/permissions', icon: Key, permission: 'rbac:view' },
    { name: 'Modules', href: '/admin/rbac/modules', icon: Layers, permission: 'rbac:view' },
    { name: 'Templates', href: '/admin/rbac/templates', icon: LayoutTemplate, permission: 'rbac:view' },
  ],
},
```

**Add at the TOP of the items array:**
```typescript
{ name: 'User Accounts', href: '/admin/users', icon: Users, permission: 'rbac:view' },
```

So it becomes:
```typescript
{
  name: 'Users',
  icon: Users,
  permission: 'rbac:view',
  items: [
    { name: 'User Accounts', href: '/admin/users', icon: Users, permission: 'rbac:view' },
    { name: 'Roles', href: '/admin/rbac/roles', icon: Shield, permission: 'rbac:view' },
    { name: 'Permissions', href: '/admin/rbac/permissions', icon: Key, permission: 'rbac:view' },
    { name: 'Modules', href: '/admin/rbac/modules', icon: Layers, permission: 'rbac:view' },
    { name: 'Templates', href: '/admin/rbac/templates', icon: LayoutTemplate, permission: 'rbac:view' },
  ],
},
```

---

## Task 3 — Create the Admin Users List Page

**File to create:** `/var/www/lead360.app/app/src/app/(dashboard)/admin/users/page.tsx`

**Create directory first:** `app/src/app/(dashboard)/admin/users/`

**Pattern to follow:** Read `app/src/app/(dashboard)/admin/rbac/roles/page.tsx` for admin page structure.

**Page layout:**

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { adminListUsers } from '@/lib/api/users';
import type { AdminUserListItem, AdminUserListParams } from '@/lib/types/users';
```

**Key differences from tenant Users List:**
- Uses `adminListUsers()` not `listUsers()`
- Pagination key is `pagination` not `meta`
- Shows tenant info column (company name or "No Tenant")
- Shows `roles` as string array (not single role object)
- Status is based on `is_active` boolean, not membership status enum
- Has a `search` query param that the backend supports
- Protected by platform admin permission, not Owner/Admin role

**Table columns:**

| Column | Source | Rendering |
|---|---|---|
| Name | `first_name + ' ' + last_name` | Bold, with email below in gray |
| Email | `email` | Separate column on desktop, below name on mobile |
| Tenant | `tenant_company_name` | Text or "No Tenant" badge if undefined |
| Role(s) | `roles` (string[]) | Badge(s) — may be empty array |
| Status | `is_active` | Badge: active=success, inactive=neutral. If `is_platform_admin`, show "Platform Admin" badge |
| Last Login | `last_login_at` | Formatted date or "Never" |
| Actions | — | Link to detail page (Sprint 8) |

**Status badge logic:**
```typescript
function getUserStatusBadge(user: AdminUserListItem) {
  if (user.is_platform_admin) {
    return <Badge variant="purple">Platform Admin</Badge>;
  }
  return user.is_active
    ? <Badge variant="success">Active</Badge>
    : <Badge variant="neutral">Inactive</Badge>;
}
```

**Filters:**
- Search input: uses `search` query param (backend filters server-side)
- Status dropdown: "All", "Active", "Inactive", "Deleted"
- Debounce search input (300ms) before refetching

**Debounced search pattern:**
```typescript
const [searchInput, setSearchInput] = useState('');
const [debouncedSearch, setDebouncedSearch] = useState('');

useEffect(() => {
  const timer = setTimeout(() => setDebouncedSearch(searchInput), 300);
  return () => clearTimeout(timer);
}, [searchInput]);

// Use debouncedSearch in the fetchUsers dependency
```

**Pagination (uses `pagination` not `meta`):**

**IMPORTANT:** Use a separate `page` state variable — do NOT use `pagination.page` in dependencies (causes infinite re-render loop).

```typescript
const [page, setPage] = useState(1);
const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, total_pages: 0 });

const fetchUsers = useCallback(async () => {
  setLoading(true);
  try {
    const params: AdminUserListParams = { page, limit: 20 };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter as any;
    const response = await adminListUsers(params);
    setUsers(response.data);
    setPagination(response.pagination);
  } catch (error: any) {
    toast.error(error.message || 'Failed to load users');
  } finally {
    setLoading(false);
  }
}, [page, debouncedSearch, statusFilter]);

// Reset to page 1 when search or filter changes:
// useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter]);
```

**Actions column (for now — detail page in Sprint 8):**
```typescript
<Link href={`/admin/users/${user.id}`}
  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
  View Details
</Link>
```

**Protection:**
```typescript
<ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
  {/* page content */}
</ProtectedRoute>
```

---

## Task 4 — Test the Page

1. Login as `ludsonaiello@gmail.com` (platform admin)
2. Navigate to `/admin/users`
3. Verify: table shows users from ALL tenants
4. Verify: search filters by name/email (server-side)
5. Verify: status filter works
6. Verify: pagination works
7. Verify: "View Details" link exists (goes to `/admin/users/{id}` — page won't exist yet, that's Sprint 8)
8. Verify: dark mode works
9. Verify: responsive on mobile

---

## Acceptance Criteria

- [ ] Page exists at `app/src/app/(dashboard)/admin/users/page.tsx`
- [ ] Protected by `platform_admin:view_all_tenants` permission
- [ ] Shows users from ALL tenants (cross-tenant view)
- [ ] Table columns: Name, Email, Tenant, Role(s), Status, Last Login, Actions
- [ ] Platform admin users show "Platform Admin" purple badge
- [ ] Search filters server-side via `search` query param
- [ ] Status dropdown filter works (active/inactive/deleted)
- [ ] Pagination works (note: uses `pagination` key, not `meta`)
- [ ] "View Details" link present for each row
- [ ] "User Accounts" nav item added to admin sidebar
- [ ] Loading state, empty state
- [ ] Dark mode, responsive
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — Admin users list must render real data with working search and filters before Sprint 8.

---

## Handoff Notes

**Files created:**
- `app/src/app/(dashboard)/admin/users/page.tsx` — Platform admin users list

**Files modified:**
- `app/src/components/dashboard/DashboardSidebar.tsx` — Added "User Accounts" to admin nav

**Sprint 8 will:** Create the user detail page at `/admin/users/[id]` with all admin actions.
**Sprint 9 will:** Add admin create-user-in-tenant flow.
