# Admin Sprint 2 — Users List Page (Settings > Users)
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_2.md
**Type:** Frontend
**Depends On:** Admin Sprint 1 (types, API client, sidebar)
**Gate:** STOP — Page must render the real user list from the API before Sprint 3 starts
**Estimated Complexity:** High

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit the endpoint** `GET /api/v1/users` to verify the actual response before building the UI.
4. **Use existing components** — Button, Input, Badge, Modal, LoadingSpinner, ProtectedRoute. Do NOT create new primitives.
5. **Follow existing page patterns** — Read `app/src/app/(dashboard)/settings/profile/page.tsx` and `app/src/app/(dashboard)/settings/tags/page.tsx` for the exact layout pattern.
6. **Production-quality UI.** Dark mode support, responsive, loading states, empty states, proper error handling with toast notifications.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — full access to Users page |
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin — for admin endpoints |

---

## Objective

Build the **Settings > Users** list page that displays all team members in the current tenant. This page includes:
- Paginated data table with Name, Email, Role (badge), Status (badge), Joined Date, and Actions column
- Search input to filter by name/email
- Status filter dropdown (All, Invited, Active, Inactive)
- Pagination controls
- RBAC protection (Owner and Admin only — redirect others to /forbidden)
- Loading skeleton, empty state

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/types/users.ts` exists (from Sprint 1)
- [ ] Confirm `app/src/lib/api/users.ts` exists (from Sprint 1)
- [ ] Read `app/src/app/(dashboard)/settings/profile/page.tsx` — layout pattern
- [ ] Read `app/src/app/(dashboard)/settings/tags/page.tsx` — settings page with list pattern
- [ ] Read `app/src/components/ui/Badge.tsx` — badge variants
- [ ] Read `app/src/components/ui/Button.tsx` — button variants and sizes
- [ ] Read `app/src/components/ui/LoadingSpinner.tsx` — loading state
- [ ] Read `app/src/components/rbac/shared/ProtectedRoute.tsx` — how to protect pages

---

## Task 1 — Hit the API and Verify Response Shape

**What:** Login as tenant user and hit `GET /api/v1/users` to see the real response.

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# List users
curl -s "http://localhost:8000/api/v1/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool 2>/dev/null || \
curl -s "http://localhost:8000/api/v1/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Also hit /rbac/roles to see available roles (for the filter)
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TOKEN"
```

**Note the actual field names and values.** Build your UI from the REAL data, not assumptions.

**Acceptance:** You have seen the actual response and confirmed it matches or differs from the `PaginatedMemberships` type.
**Do NOT:** Skip this step.

---

## Task 2 — Create the Users List Page

**What:** Create the main Users management page.

**File to create:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/users/page.tsx`

**Layout pattern to follow** (from profile/page.tsx):

```
<ProtectedRoute requiredRole={['Owner', 'Admin']}>
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Breadcrumb -->
      <!-- Header with title + "Invite User" button -->
      <!-- Filters row: search + status dropdown -->
      <!-- Table or cards -->
      <!-- Pagination -->
    </div>
  </div>
</ProtectedRoute>
```

**Required imports:**

```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Search, UserPlus, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import ProtectedRoute from '@/components/rbac/shared/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { listUsers } from '@/lib/api/users';
import type { MembershipItem, PaginatedMemberships, MembershipStatus } from '@/lib/types/users';
```

**Page structure:**

1. **Breadcrumb**: Dashboard > Settings > Users
2. **Header row**: "Team Members" title on left, "Invite User" button on right (button does nothing yet — Sprint 3 adds the modal)
3. **Filters row**:
   - Search input (left) — debounced, filters client-side or refetches
   - Status dropdown (right) — "All Statuses", "Invited", "Active", "Inactive"
4. **Table** (desktop) / **Cards** (mobile):

| Column | Source | Rendering |
|---|---|---|
| Name | `first_name + ' ' + last_name` | Bold text |
| Email | `email` | Gray text below name on mobile, separate column on desktop |
| Role | `role.name` | `<Badge variant="info">{role.name}</Badge>` |
| Status | `status` | Badge with variant: ACTIVE=success, INVITED=warning, INACTIVE=neutral |
| Joined | `joined_at` | Formatted date or "—" if null |
| Actions | — | Three-dot menu or action buttons (placeholder for Sprint 4) |

5. **Pagination**: "Showing X to Y of Z results" + Previous/Next buttons
6. **Empty state**: "No team members found" with icon
7. **Loading state**: `<LoadingSpinner centered />` while fetching

**Status badge mapping:**

```typescript
const statusBadgeVariant: Record<MembershipStatus, string> = {
  ACTIVE: 'success',
  INVITED: 'warning',
  INACTIVE: 'neutral',
};
```

**Date formatting helper:**

```typescript
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
```

**`[Deactivated User]` display helper (BR-07):**

The contract requires that soft-deleted users display as `[Deactivated User]` in historical records. The `invited_by` column in the Users List is the first place this applies. Create this utility function and use it whenever rendering a user name that might be null (because the user was soft-deleted):

```typescript
/**
 * Returns a display name for a user reference.
 * If the user object is null (soft-deleted), returns '[Deactivated User]'.
 * Used for invited_by, assigned_by, and any other user FK references.
 */
function displayUserName(user: { first_name: string; last_name: string } | null): string {
  if (!user) return '[Deactivated User]';
  return `${user.first_name} ${user.last_name}`;
}
```

**Use this helper** in the `invited_by` column:
```typescript
// In the table row for invited_by:
<span className="text-sm text-gray-500 dark:text-gray-400">
  {displayUserName(member.invited_by)}
</span>
```

This ensures that if an inviter is soft-deleted, the table shows `[Deactivated User]` instead of a blank cell. Apply the same convention everywhere a user reference could be null due to soft deletion.

**Data fetching pattern:**

**IMPORTANT:** Use a separate `page` state variable for the current page number. Do NOT derive the page from the `meta` response object — that causes an infinite re-render loop (fetch updates meta → meta changes → dependency triggers re-fetch → infinite loop).

```typescript
const [members, setMembers] = useState<MembershipItem[]>([]);
const [page, setPage] = useState(1);
const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, total_pages: 0 });
const [loading, setLoading] = useState(true);
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState<MembershipStatus | ''>('');

const fetchUsers = useCallback(async () => {
  try {
    setLoading(true);
    const params: any = { page, limit: 20 };
    if (statusFilter) params.status = statusFilter;
    const response = await listUsers(params);
    setMembers(response.data);
    setMeta(response.meta);
  } catch (error: any) {
    toast.error(error.message || 'Failed to load users');
  } finally {
    setLoading(false);
  }
}, [page, statusFilter]);

useEffect(() => {
  fetchUsers();
}, [fetchUsers]);

// Pagination handlers:
// const goToNextPage = () => setPage(p => Math.min(p + 1, meta.total_pages));
// const goToPrevPage = () => setPage(p => Math.max(p - 1, 1));
// Reset to page 1 when status filter changes:
// useEffect(() => { setPage(1); }, [statusFilter]);
```

**Search filtering:**
The backend `GET /users` endpoint does NOT have a search parameter. Implement client-side filtering on the fetched page:

```typescript
const filteredMembers = members.filter((m) => {
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  return (
    m.first_name.toLowerCase().includes(q) ||
    m.last_name.toLowerCase().includes(q) ||
    m.email.toLowerCase().includes(q)
  );
});
```

**Responsive design:**
- Desktop (lg+): Full table with all columns visible
- Mobile (<lg): Card layout with stacked info
- Use Tailwind responsive classes: `hidden lg:table-cell`, `lg:hidden`, etc.

**Dark mode:** All components must work in dark mode. Use `dark:` Tailwind prefix following existing patterns.

**Acceptance:**
- Page renders at `/settings/users`
- Shows real data from the API
- Status badges show correct colors
- Search filters the list
- Status dropdown filters the list (refetches from API)
- Pagination works
- Loading spinner shows while fetching
- Empty state shows when no results
- Protected by ProtectedRoute — non-Owner/Admin gets redirected to /forbidden
- Responsive on mobile
- "Invite User" button exists but does nothing (Sprint 3)
- Actions column exists as placeholder (Sprint 4)

**Do NOT:**
- Create sub-components in separate files for this sprint (keep it in one page file for now)
- Implement the invite modal (Sprint 3)
- Implement action buttons functionality (Sprint 4)
- Modify any backend file

---

## Acceptance Criteria

- [ ] Page exists at `app/src/app/(dashboard)/settings/users/page.tsx`
- [ ] Protected by `<ProtectedRoute requiredRole={['Owner', 'Admin']}>`
- [ ] Shows real user data from `GET /api/v1/users`
- [ ] Table has columns: Name, Email, Role (badge), Status (badge), Joined Date, Actions
- [ ] Status badges: ACTIVE=green, INVITED=yellow, INACTIVE=gray
- [ ] Search input filters by name/email
- [ ] Status dropdown filter works (All, Invited, Active, Inactive)
- [ ] Pagination controls work (Previous/Next, showing count)
- [ ] Loading spinner displayed while fetching
- [ ] Empty state shown when no results
- [ ] "Invite User" button visible in header (no action yet)
- [ ] Responsive — table on desktop, cards on mobile
- [ ] Dark mode works correctly
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] `invited_by` column shows `[Deactivated User]` when the inviter is null (soft-deleted) — not blank
- [ ] `displayUserName()` helper created and used for all user name references
- [ ] No TypeScript errors

---

## Gate Marker

**STOP** — The Users list page must render real data from the API with working pagination and filters before Sprint 3 can begin.

---

## Handoff Notes

**Files created:**
- `app/src/app/(dashboard)/settings/users/page.tsx` — Main Users management page

**State exposed for downstream sprints:**
- `fetchUsers()` callback — Sprint 3 will call this after invite success to refresh the list
- "Invite User" button — Sprint 3 will wire this to open the InviteUserModal
- Actions column — Sprint 4 will add role change, deactivate, reactivate, delete actions
- The page uses `useState` for the member list — Sprint 3/4 components will need `onSuccess` callbacks to trigger `fetchUsers()`
