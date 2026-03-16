# Admin Sprint 4 — Change Role Modal + Deactivate User Modal
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_4.md
**Type:** Frontend
**Depends On:** Admin Sprint 3 (Invite modal wired into Users List)
**Gate:** STOP — Both modals must work end-to-end before Sprint 5
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit each action endpoint** to verify actual request/response shapes before building.
4. **Use existing components** — Modal, ModalContent, ModalActions, Button, Input. No new UI primitives.
5. **No browser alerts.** No `window.confirm()`. Use Modal components only.
6. **Production-quality UI.** Inline error messages, loading states, success toasts, dark mode.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can do all actions |

---

## Objective

Build two action modals for the Users List page:
1. **Change Role** — Modal with role dropdown, calls `PATCH /users/:id/role`
2. **Deactivate** — Confirmation modal with optional reason, calls `PATCH /users/:id/deactivate`

These modals are NOT wired into the page yet — Sprint 5 handles wiring all actions.

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/app/(dashboard)/settings/users/page.tsx` exists with working list and invite
- [ ] Confirm `app/src/lib/api/users.ts` has `changeUserRole()`, `deactivateUser()`, `listRoles()`
- [ ] Read `app/src/components/ui/Modal.tsx` — Modal, ModalContent, ModalActions
- [ ] Read `app/src/components/users/InviteUserModal.tsx` — follow same component patterns

---

## Task 1 — Hit the Endpoints

```bash
# Login as tenant owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Get user list to find a membership ID
curl -s "http://localhost:8000/api/v1/users?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Get roles for dropdown
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TOKEN"

# Test PATCH /users/:id/role (use a real membership ID + role ID from above)
curl -s -X PATCH http://localhost:8000/api/v1/users/{MEMBERSHIP_ID}/role \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role_id":"ROLE_ID_FROM_ABOVE"}'

# Test PATCH /users/:id/deactivate (use a non-owner membership)
curl -s -X PATCH http://localhost:8000/api/v1/users/{MEMBERSHIP_ID}/deactivate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Testing"}'
```

**IMPORTANT:** Do NOT deactivate the `contact@honeydo4you.com` owner — you'll lock yourself out.

**Acceptance:** You know the actual response shapes for both endpoints.

---

## Task 2 — Create ChangeRoleModal Component

**File to create:** `/var/www/lead360.app/app/src/components/users/ChangeRoleModal.tsx`

**Props:**
```typescript
import type { MembershipItem } from '@/lib/types/users';

interface ChangeRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}
```

**Behavior:**
- On open: fetch roles via `listRoles()`, pre-select member's current role
- Show member name + email for context
- Role dropdown (same select style as InviteUserModal)
- Disable submit if selected role equals current role
- Submit: `changeUserRole(member.id, { role_id: selectedRoleId })`
- Success: `toast.success('Role updated for {name}')`, `onSuccess()`, `onClose()`
- 403 error: inline "Only an Owner or platform administrator can change the role of an Owner."
- 404 error: inline "Role not found" or "Membership not found"

**Layout:**
```
<Modal isOpen onClose title="Change Role" size="md">
  <ModalContent>
    <p>Changing role for <strong>{name}</strong> ({email})</p>
    {error && <error banner>}
    <label + select dropdown>
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button loading disabled={!changed}>Update Role</Button>
  </ModalActions>
</Modal>
```

**Select styling (match InviteUserModal):**
```typescript
<select
  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
  value={roleId}
  onChange={(e) => setRoleId(e.target.value)}
>
  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
</select>
```

**Acceptance:** Modal opens, shows roles, changes role, handles errors.

---

## Task 3 — Create DeactivateUserModal Component

**File to create:** `/var/www/lead360.app/app/src/components/users/DeactivateUserModal.tsx`

**Props:**
```typescript
interface DeactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}
```

**Behavior:**
- Warning banner: "This will immediately log {Name} out of the platform. Their session will be terminated."
- Optional reason text input (max 500 chars)
- Submit: `deactivateUser(member.id, { reason })`
- Success: `toast.success('{Name} has been deactivated')`, `onSuccess()`, `onClose()`
- 400 error (last owner): inline "Tenant must have at least one active Owner."
- 404 error: inline "Active membership not found."

**Layout:**
```
<Modal isOpen onClose title="Deactivate User" size="md">
  <ModalContent>
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
      <p>This will immediately log <strong>{name}</strong> out. Are you sure?</p>
    </div>
    {error && <error banner>}
    <Input label="Reason (optional)" placeholder="e.g., Employee terminated" />
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button variant="danger" loading>Deactivate</Button>
  </ModalActions>
</Modal>
```

**Acceptance:** Modal opens, shows warning, submits deactivation, handles last-owner error.

---

## Task 4 — Quick Smoke Test

1. Import both modals in the Users List page temporarily for testing
2. Add temporary buttons to open each modal with a selected member
3. Verify Change Role works end-to-end
4. Verify Deactivate works end-to-end
5. Verify error cases (last owner deactivation blocked)
6. Remove temporary test buttons (Sprint 5 will wire the real action buttons)

**Acceptance:** Both modals confirmed working. Temporary test code removed.

---

## Acceptance Criteria

- [ ] `ChangeRoleModal` exists at `app/src/components/users/ChangeRoleModal.tsx`
- [ ] `DeactivateUserModal` exists at `app/src/components/users/DeactivateUserModal.tsx`
- [ ] Change Role: fetches roles, pre-selects current, submits, handles 403
- [ ] Deactivate: shows warning, optional reason, submits, handles 400 (last owner)
- [ ] Both modals use inline error display (not browser alerts)
- [ ] Both modals have loading states on submit buttons
- [ ] Dark mode works
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — Both modals must function correctly before Sprint 5 starts.

---

## Handoff Notes

**Files created:**
- `app/src/components/users/ChangeRoleModal.tsx`
- `app/src/components/users/DeactivateUserModal.tsx`

**Sprint 5 will:**
- Create ReactivateUserModal and DeleteUserModal
- Wire ALL 4 action modals into the Users List page Actions column
