# Admin Sprint 9 — Platform Admin: Create User in Tenant + Admin Tenant Users View
**Module:** Users (Frontend — Platform Admin)
**File:** ./documentation/sprints/users/admin_sprint_9.md
**Type:** Frontend
**Depends On:** Admin Sprint 8 (Admin User Detail + Actions)
**Gate:** NONE — This is the final sprint
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit the admin tenant user endpoints** to verify actual responses.
4. **Use existing components.** Follow patterns established in Sprints 7-8.
5. **Platform admin only.** All features protected by `platform_admin:view_all_tenants`.
6. **Production-quality UI.** This is the FINAL sprint — everything must be polished.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin |

---

## Objective

Complete the platform admin Users module with:
1. **Admin Tenant Users View** — View all memberships within a specific tenant (`GET /admin/tenants/:tenantId/users`)
2. **Create User in Tenant** — Admin can create a user + membership directly, bypassing invite (`POST /admin/tenants/:tenantId/users`)
3. **Final polish** — Verify all 9 sprints work together end-to-end

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/users.ts` has `adminListTenantUsers()` and `adminCreateUserInTenant()`
- [ ] Confirm `app/src/lib/types/users.ts` has `CreateUserAdminDto`
- [ ] Read `app/src/app/(dashboard)/admin/users/[id]/page.tsx` — admin detail page from Sprint 8
- [ ] Read `app/src/components/users/InviteUserModal.tsx` — similar form pattern for create user

---

## Task 1 — Hit the Endpoints

```bash
# Login as platform admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Get a tenant ID
curl -s "http://localhost:8000/api/v1/admin/tenants?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 2000

# GET /admin/tenants/:tenantId/users — List users in a specific tenant
curl -s "http://localhost:8000/api/v1/admin/tenants/{TENANT_ID}/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# GET /rbac/roles — List roles for the create form
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TOKEN"

# POST /admin/tenants/:tenantId/users — Create user directly
curl -s -X POST "http://localhost:8000/api/v1/admin/tenants/{TENANT_ID}/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-created-user@example.com","first_name":"Admin","last_name":"Created","role_id":"ROLE_ID","password":"TestP@ss123"}'
```

**Note the response shapes.** The tenant users endpoint returns the same shape as the tenant-scoped `GET /users` (with `data` + `meta`), but does NOT filter soft-deleted users.

---

## Task 2 — Create AdminCreateUserModal Component

**File to create:** `/var/www/lead360.app/app/src/components/admin/users/AdminCreateUserModal.tsx`

**Props:**
```typescript
interface AdminCreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
  tenantName: string;
}
```

**Form fields:**
- **Email** — Input, type="email", required
- **First Name** — Input, required, max 100 chars
- **Last Name** — Input, required, max 100 chars
- **Role** — Select dropdown, required. **IMPORTANT:** Use `getAllRoles()` from `@/lib/api/rbac` (admin endpoint `GET /admin/rbac/roles`) — NOT `listRoles()` from users API. The users API roles endpoint requires Owner/Admin role which a pure platform admin may not have. The admin RBAC endpoint is protected by `PlatformAdminGuard` and always works for platform admins.
- **Password** — Input, type="password", required, min 8 chars, complexity regex
- **Phone** — Input, optional, max 20 chars

**Password validation regex (same as invite accept):**
```typescript
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
```

**Submit:** `adminCreateUserInTenant(tenantId, { email, first_name, last_name, role_id, password, phone })`

**Error handling:**
- 400: validation errors inline
- 404: "Tenant not found" or "Role not found"
- 409 "active membership in this tenant": inline error
- 409 "active in another org": inline error

**Success:** `toast.success('User created successfully')`, `onSuccess()`, `onClose()`

**Layout (same as InviteUserModal but with password + phone fields):**
```
<Modal isOpen onClose title={`Create User in ${tenantName}`} size="lg">
  <ModalContent>
    {error && <error banner>}
    <Input label="Email" ... />
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input label="First Name" ... />
      <Input label="Last Name" ... />
    </div>
    <select label="Role" ... />
    <Input label="Password" type="password" ... />
    <p className="text-xs text-gray-500">Password: 8+ chars, 1 upper, 1 lower, 1 number, 1 special</p>
    <Input label="Phone (optional)" ... />
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button loading>Create User</Button>
  </ModalActions>
</Modal>
```

---

## Task 3 — Add Tenant Filter Support to Admin Users List + Link from Detail Page

**What:** Two changes:

**A) Update the Admin Users List page (Sprint 7) to read `tenant_id` from URL query params:**

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/admin/users/page.tsx`

Add URL query param reading so the page can be linked with a pre-set tenant filter:

```typescript
import { useSearchParams } from 'next/navigation';

// Inside the component:
const searchParams = useSearchParams();
const urlTenantId = searchParams.get('tenant_id') || '';

// Initialize the tenant filter state from URL:
const [tenantIdFilter, setTenantIdFilter] = useState(urlTenantId);

// Include tenant_id in the fetch params:
// Inside fetchUsers:
if (tenantIdFilter) params.tenant_id = tenantIdFilter;
```

This allows the detail page to link to `/admin/users?tenant_id=xxx` and have the list pre-filtered.

**B) Add a link in the Admin User Detail page:**

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/admin/users/[id]/page.tsx`

Add to the Tenant & Roles card:
```typescript
{userDetail.tenant && (
  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
    <Link href={`/admin/users?tenant_id=${userDetail.tenant.id}`}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
      View all users in {userDetail.tenant.company_name}
    </Link>
  </div>
)}
```

**IMPORTANT:** The admin list page (part A above) MUST be updated to read the `tenant_id` query param. Without it, the link does nothing.

---

## Task 4 — Add Create User Button to Admin Users List

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/admin/users/page.tsx`

**What:** Add a "Create User" button to the admin users list page header. When clicked, it shows a modal to select a tenant first, then opens the AdminCreateUserModal.

**Simple approach:** Add a "Create User" button that opens a two-step flow:
1. First, show a modal asking for the tenant (a simple select dropdown populated from `GET /admin/tenants`)
2. Then open the AdminCreateUserModal with the selected tenantId

**Alternatively (simpler):** Just add a button that links to a dedicated create page. But to keep it modal-based per project patterns:

```typescript
const [showCreateModal, setShowCreateModal] = useState(false);
const [createTenantId, setCreateTenantId] = useState('');
const [createTenantName, setCreateTenantName] = useState('');

// Tenant selection modal:
// 1. Fetch tenants from /admin/tenants
// 2. Select dropdown
// 3. On select + confirm → open AdminCreateUserModal
```

**Import existing admin API:**
```typescript
import { getAllTenants } from '@/lib/api/admin';
```

This is a two-modal flow:
1. **SelectTenantModal** — simple select dropdown of tenants
2. **AdminCreateUserModal** — the user creation form

Create a simple SelectTenantModal inline in the page (or as a small component):

```typescript
// State
const [showSelectTenantModal, setShowSelectTenantModal] = useState(false);
const [tenants, setTenants] = useState<{id: string, company_name: string}[]>([]);

// Fetch tenants when modal opens
useEffect(() => {
  if (showSelectTenantModal) {
    getAllTenants({ limit: 100 }).then(res => {
      setTenants(res.data.map(t => ({ id: t.id, company_name: t.company_name })));
    });
  }
}, [showSelectTenantModal]);
```

**Or keep it simple:** Just put a "Create User" button in the header. On click, open a single modal that has both tenant selection and user fields. Let the agent decide the best UX.

---

## Task 5 — Final End-to-End Verification

**Verify ALL 9 sprints work together:**

### Tenant-Scoped (login as `contact@honeydo4you.com`):
1. [ ] Sidebar shows "Users" link → navigates to `/settings/users`
2. [ ] Users list loads with real data, pagination works
3. [ ] Search filters by name/email
4. [ ] Status filter dropdown works
5. [ ] "Invite User" → fill form → submit → new INVITED user appears
6. [ ] "Change Role" → select new role → submit → role badge updates
7. [ ] "Deactivate" → confirm → user becomes INACTIVE
8. [ ] "Reactivate" → confirm → user becomes ACTIVE
9. [ ] "Delete" (Owner only) → confirm → user removed from list

### Invite Accept (no login):
10. [ ] Navigate to `/invite/{token}` (if a real token is available)
11. [ ] Shows invite metadata (tenant, role, inviter, email)
12. [ ] Invalid token → shows 404 error page
13. [ ] Set password + accept → tokens stored → redirected to dashboard

### Platform Admin (login as `ludsonaiello@gmail.com`):
14. [ ] Admin sidebar shows "User Accounts" under Users group
15. [ ] `/admin/users` shows cross-tenant user list with search and filters
16. [ ] Click "View Details" → shows user detail page
17. [ ] Reset Password action works
18. [ ] Deactivate/Activate actions work
19. [ ] Delete action works → redirects to list
20. [ ] "Create User" flow works (select tenant → fill form → submit)

---

## Acceptance Criteria

- [ ] `AdminCreateUserModal` exists at `app/src/components/admin/users/AdminCreateUserModal.tsx`
- [ ] Create User form: email, first_name, last_name, role, password (with validation), phone
- [ ] Submit calls `POST /admin/tenants/:tenantId/users`
- [ ] Error handling: 400, 404, 409 (duplicate, active elsewhere)
- [ ] Admin users list has "Create User" button
- [ ] All 20 end-to-end checks above pass
- [ ] Dark mode works everywhere
- [ ] Responsive on mobile
- [ ] No modifications to any file under `/var/www/lead360.app/api/`
- [ ] No TypeScript compilation errors

---

## Gate Marker

**NONE** — This is the final sprint. The Users Module frontend is COMPLETE.

---

## Summary: All Files Created/Modified Across 9 Sprints

### Files Created:
| Sprint | File |
|---|---|
| 1 | `app/src/lib/types/users.ts` |
| 1 | `app/src/lib/api/users.ts` |
| 2 | `app/src/app/(dashboard)/settings/users/page.tsx` |
| 3 | `app/src/components/users/InviteUserModal.tsx` |
| 4 | `app/src/components/users/ChangeRoleModal.tsx` |
| 4 | `app/src/components/users/DeactivateUserModal.tsx` |
| 5 | `app/src/components/users/ReactivateUserModal.tsx` |
| 5 | `app/src/components/users/DeleteUserModal.tsx` |
| 6 | `app/src/app/(auth)/invite/[token]/page.tsx` |
| 7 | `app/src/app/(dashboard)/admin/users/page.tsx` |
| 8 | `app/src/app/(dashboard)/admin/users/[id]/page.tsx` |
| 8 | `app/src/components/admin/users/AdminResetPasswordModal.tsx` |
| 8 | `app/src/components/admin/users/AdminDeactivateModal.tsx` |
| 8 | `app/src/components/admin/users/AdminActivateModal.tsx` |
| 8 | `app/src/components/admin/users/AdminDeleteUserModal.tsx` |
| 9 | `app/src/components/admin/users/AdminCreateUserModal.tsx` |

### Files Modified:
| Sprint | File | Change |
|---|---|---|
| 1 | `app/src/components/dashboard/DashboardSidebar.tsx` | Added "Users" tenant nav item |
| 5 | `app/src/app/(dashboard)/settings/profile/page.tsx` | Added "Current Membership" section using `/users/me` |
| 6 | `app/src/contexts/AuthContext.tsx` | Added `/invite` to isPublicRoute |
| 7 | `app/src/components/dashboard/DashboardSidebar.tsx` | Added "User Accounts" admin nav item |
