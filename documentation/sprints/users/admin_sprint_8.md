# Admin Sprint 8 — Platform Admin: User Detail + Actions
**Module:** Users (Frontend — Platform Admin)
**File:** ./documentation/sprints/users/admin_sprint_8.md
**Type:** Frontend
**Depends On:** Admin Sprint 7 (Platform Admin Users List)
**Gate:** STOP — User detail page must display real data and all actions must work before Sprint 9
**Estimated Complexity:** High

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit the admin user detail and action endpoints** to verify actual responses.
4. **Use existing components.** Modals, Buttons, Badges, Cards.
5. **No browser alerts.** Use Modal components for all confirmations.
6. **Platform admin only.** Protected by `platform_admin:view_all_tenants` permission.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Platform Admin | `ludsonaiello@gmail.com` | `978@F32c` | Platform admin |

---

## Objective

Build the **Platform Admin User Detail** page at `/admin/users/[id]`. This page shows:
- Full user profile: name, email, phone, status, roles, tenant, dates
- Action buttons: Deactivate/Activate, Reset Password, Delete
- All actions use Modal confirmations

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/lib/api/users.ts` has: `adminGetUser()`, `adminDeactivateUser()`, `adminActivateUser()`, `adminResetPassword()`, `adminDeleteUser()`
- [ ] Confirm `app/src/lib/types/users.ts` has `AdminUserDetail` type
- [ ] Read `app/src/app/(dashboard)/admin/users/page.tsx` — users list page from Sprint 7
- [ ] Read any existing admin detail page for pattern reference

---

## Task 1 — Hit the Endpoints

```bash
# Login as platform admin
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Get a user ID from the list
curl -s "http://localhost:8000/api/v1/admin/users?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | head -c 2000

# GET /admin/users/:id — User detail
curl -s http://localhost:8000/api/v1/admin/users/{USER_ID} \
  -H "Authorization: Bearer $TOKEN"

# Test POST /admin/users/:id/reset-password (pick a non-admin user)
curl -s -X POST http://localhost:8000/api/v1/admin/users/{USER_ID}/reset-password \
  -H "Authorization: Bearer $TOKEN"

# Test PATCH /admin/users/:id/deactivate (pick a non-admin active user)
curl -s -X PATCH http://localhost:8000/api/v1/admin/users/{USER_ID}/deactivate \
  -H "Authorization: Bearer $TOKEN"

# Test POST /admin/users/:id/activate (reactivate the user you just deactivated)
curl -s -X POST http://localhost:8000/api/v1/admin/users/{USER_ID}/activate \
  -H "Authorization: Bearer $TOKEN"

# Test DELETE /admin/users/:id (use an expendable user)
curl -s -X DELETE http://localhost:8000/api/v1/admin/users/{USER_ID} \
  -H "Authorization: Bearer $TOKEN"
```

**Note all response shapes carefully.** Platform admin responses have different shapes from tenant-scoped endpoints.

---

## Task 2 — Create the Admin User Detail Page

**File to create:** `/var/www/lead360.app/app/src/app/(dashboard)/admin/users/[id]/page.tsx`

**Create directory:** `app/src/app/(dashboard)/admin/users/[id]/`

**Page layout:**

```
<ProtectedRoute requiredPermission="platform_admin:view_all_tenants">
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Breadcrumb: Admin > Users > {Name} -->
      <!-- Header: Name + Status badge + Action buttons -->
      <!-- Profile Card -->
      <!-- Tenant & Roles Card -->
      <!-- Activity Card (last login, created, updated) -->
    </div>
  </div>
</ProtectedRoute>
```

**Profile Card:**
```
bg-white dark:bg-gray-800 rounded-lg shadow border
  - Email: user.email
  - Phone: user.phone || "Not provided"
  - Email Verified: Yes/No badge
  - Platform Admin: Yes/No badge
  - Account Created: formatted date
```

**Tenant & Roles Card:**
```
  - Tenant: tenant.company_name (tenant.subdomain) or "No Tenant"
  - Roles: array of role badges with name and description
```

**Action buttons in header (right side):**
```typescript
<div className="flex items-center gap-3">
  {/* Reset Password */}
  <Button variant="secondary" size="sm" onClick={() => setShowResetPasswordModal(true)}>
    Reset Password
  </Button>

  {/* Deactivate or Activate based on current status */}
  {userDetail.is_active ? (
    <Button variant="secondary" size="sm" onClick={() => setShowDeactivateModal(true)}>
      Deactivate
    </Button>
  ) : (
    <Button variant="secondary" size="sm" onClick={() => setShowActivateModal(true)}>
      Activate
    </Button>
  )}

  {/* Delete */}
  <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
    Delete
  </Button>
</div>
```

**Fetch user on mount:**
```typescript
const { id } = useParams<{ id: string }>();
const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
const [loading, setLoading] = useState(true);

const fetchUser = useCallback(async () => {
  try {
    setLoading(true);
    const data = await adminGetUser(id as string);
    setUserDetail(data);
  } catch (error: any) {
    toast.error('User not found');
    router.push('/admin/users');
  } finally {
    setLoading(false);
  }
}, [id]);
```

---

## Task 3 — Create Admin Action Modals

Create simple confirmation modals for each action. These are simpler than the tenant-scoped modals — they just confirm and execute.

**All modals go in:** `/var/www/lead360.app/app/src/components/admin/users/`

### AdminResetPasswordModal.tsx

```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: AdminUserDetail | null;
}
```
- Confirm: "Send a password reset email to {email}?"
- Submit: `adminResetPassword(user.id)`
- Success: `toast.success('Password reset email sent to {email}')`

### AdminDeactivateModal.tsx

- Confirm: "Deactivate {name}? They will be immediately logged out."
- Submit: `adminDeactivateUser(user.id)`
- Success: `toast.success('{name} has been deactivated')`
- 409 error: inline "User is already inactive"

### AdminActivateModal.tsx

- Confirm: "Activate {name}? They will be able to log in again."
- Submit: `adminActivateUser(user.id)`
- Success: `toast.success('{name} has been activated')`
- 409 error: inline "User is already active"

### AdminDeleteUserModal.tsx

- Red warning: "This will soft-delete {name}. They will be marked as deleted and deactivated."
- Submit: `adminDeleteUser(user.id)`
- Success: `toast.success('{name} has been deleted')`, redirect to `/admin/users`
- 409 error: inline "User is already deleted"

**All modals follow the same pattern:**
```
<Modal isOpen onClose title="..." size="md">
  <ModalContent>
    <p>{confirmation message}</p>
    {error && <error banner>}
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary|danger" loading>Confirm</Button>
  </ModalActions>
</Modal>
```

---

## Task 4 — Wire Modals into Detail Page

Add state and modal components to the detail page:

```typescript
const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
const [showDeactivateModal, setShowDeactivateModal] = useState(false);
const [showActivateModal, setShowActivateModal] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);

// In JSX, add all 4 modals with onSuccess={() => fetchUser()} to refresh the detail
```

---

## Task 5 — Test All Flows

1. Navigate to `/admin/users` → click "View Details" on a user
2. Verify detail page shows all user info correctly
3. **Reset Password:** Click → confirm → verify success toast
4. **Deactivate:** Click on active user → confirm → verify status badge changes
5. **Activate:** Click on inactive user → confirm → verify status badge changes
6. **Delete:** Click → confirm → verify redirect to users list
7. **Back link:** Verify breadcrumb back to `/admin/users` works
8. Dark mode + responsive

---

## Acceptance Criteria

- [ ] Detail page exists at `app/src/app/(dashboard)/admin/users/[id]/page.tsx`
- [ ] Shows full user profile: name, email, phone, status, roles, tenant, dates
- [ ] Protected by `platform_admin:view_all_tenants` permission
- [ ] Reset Password action: sends email, shows success toast
- [ ] Deactivate action: deactivates user, refreshes status badge
- [ ] Activate action: activates user, refreshes status badge
- [ ] Delete action: soft-deletes user, redirects to list
- [ ] All actions use Modal confirmations (no browser alerts)
- [ ] Error handling for 409 conflicts (already active/inactive/deleted)
- [ ] Breadcrumb navigation back to users list
- [ ] Dark mode, responsive
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — All admin detail actions must work before Sprint 9.

---

## Handoff Notes

**Files created:**
- `app/src/app/(dashboard)/admin/users/[id]/page.tsx` — Admin user detail page
- `app/src/components/admin/users/AdminResetPasswordModal.tsx`
- `app/src/components/admin/users/AdminDeactivateModal.tsx`
- `app/src/components/admin/users/AdminActivateModal.tsx`
- `app/src/components/admin/users/AdminDeleteUserModal.tsx`

**Sprint 9 will:** Add the admin create-user-in-tenant flow + final polish.
