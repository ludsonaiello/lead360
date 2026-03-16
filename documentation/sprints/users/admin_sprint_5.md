# Admin Sprint 5 — Reactivate + Delete Modals + Wire All Actions
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_5.md
**Type:** Frontend
**Depends On:** Admin Sprint 4 (ChangeRole + Deactivate modals)
**Gate:** STOP — All 4 actions must work from the Users List Actions column before Sprint 6
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit the reactivate and delete endpoints** to verify actual responses.
4. **Use existing components** — Modal, ModalContent, ModalActions, Button. No new UI primitives.
5. **No browser alerts.** Use Modal components only.
6. **Production-quality UI.** Follow the same patterns from ChangeRoleModal and DeactivateUserModal (Sprint 4).

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can do all actions |

---

## Objective

1. Create **ReactivateUserModal** and **DeleteUserModal** components
2. Wire ALL 4 action modals into the Users List page with contextual action buttons per row

---

## Pre-Sprint Checklist

- [ ] Confirm `ChangeRoleModal` and `DeactivateUserModal` exist (from Sprint 4)
- [ ] Confirm `app/src/lib/api/users.ts` has `reactivateUser()` and `deleteUser()`
- [ ] Read `app/src/components/users/DeactivateUserModal.tsx` — follow same pattern

---

## Task 1 — Hit the Endpoints

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# Get users — find an INACTIVE membership to test reactivation
curl -s "http://localhost:8000/api/v1/users?page=1&limit=20&status=INACTIVE" \
  -H "Authorization: Bearer $TOKEN"

# Test PATCH /users/:id/reactivate
curl -s -X PATCH http://localhost:8000/api/v1/users/{INACTIVE_MEMBERSHIP_ID}/reactivate \
  -H "Authorization: Bearer $TOKEN"

# Test DELETE /users/:id (use an INVITED membership that's expendable)
curl -s -X DELETE http://localhost:8000/api/v1/users/{MEMBERSHIP_ID} \
  -H "Authorization: Bearer $TOKEN" -v 2>&1 | head -20
# NOTE: Returns 204 No Content on success
```

---

## Task 2 — Create ReactivateUserModal Component

**File to create:** `/var/www/lead360.app/app/src/components/users/ReactivateUserModal.tsx`

**Props:**
```typescript
import type { MembershipItem } from '@/lib/types/users';

interface ReactivateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}
```

**Behavior:**
- Confirmation text: "Reactivate {Name}? They will be able to log in again."
- Submit: `reactivateUser(member.id)`
- Success: `toast.success('{Name} has been reactivated')`, `onSuccess()`, `onClose()`
- **409 error (CRITICAL):** Show persistent inline error: "User is currently active in another organization." Disable the submit button when this error shows — the user can only close the modal.
- 404 error: inline "Inactive membership not found."

**Layout:**
```
<Modal isOpen onClose title="Reactivate User" size="md">
  <ModalContent>
    <p>Reactivate <strong>{name}</strong>? They will be able to log in and access the platform again.</p>
    {error && <error banner>}
    {conflictError && <warning banner explaining user is active elsewhere>}
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button loading disabled={!!conflictError}>Reactivate</Button>
  </ModalActions>
</Modal>
```

---

## Task 3 — Create DeleteUserModal Component

**File to create:** `/var/www/lead360.app/app/src/components/users/DeleteUserModal.tsx`

**Props:**
```typescript
interface DeleteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  member: MembershipItem | null;
}
```

**Behavior:**
- Red warning banner: "This action cannot be undone. {Name} will be removed from this organization."
- Backend decides soft vs hard delete — frontend doesn't differentiate.
- Submit: `deleteUser(member.id)` — returns 204 No Content (void)
- Success: `toast.success('{Name} has been removed')`, `onSuccess()`, `onClose()`
- 404: inline "Membership not found."

**Layout:**
```
<Modal isOpen onClose title="Delete User" size="md">
  <ModalContent>
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
      <p>This action cannot be undone. <strong>{name}</strong> will be permanently removed.</p>
    </div>
    {error && <error banner>}
  </ModalContent>
  <ModalActions>
    <Button variant="ghost">Cancel</Button>
    <Button variant="danger" loading>Delete User</Button>
  </ModalActions>
</Modal>
```

---

## Task 4 — Wire All 4 Actions into Users List Page

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/users/page.tsx`

**Add imports:**
```typescript
import ChangeRoleModal from '@/components/users/ChangeRoleModal';
import DeactivateUserModal from '@/components/users/DeactivateUserModal';
import ReactivateUserModal from '@/components/users/ReactivateUserModal';
import DeleteUserModal from '@/components/users/DeleteUserModal';
import { useRBAC } from '@/contexts/RBACContext';
```

**Add state:**
```typescript
const { hasRole } = useRBAC();
const [selectedMember, setSelectedMember] = useState<MembershipItem | null>(null);
const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
const [showDeactivateModal, setShowDeactivateModal] = useState(false);
const [showReactivateModal, setShowReactivateModal] = useState(false);
const [showDeleteModal, setShowDeleteModal] = useState(false);
```

**Actions column rendering per row:**

Show different actions based on member status:

| Member Status | Visible Actions |
|---|---|
| `ACTIVE` | Change Role, Deactivate, Delete (Owner only) |
| `INVITED` | Change Role, Delete (Owner only) |
| `INACTIVE` | Reactivate, Delete (Owner only) |

```typescript
<div className="flex items-center gap-2 flex-wrap">
  {member.status !== 'INACTIVE' && (
    <button onClick={() => { setSelectedMember(member); setShowChangeRoleModal(true); }}
      className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium">
      Change Role
    </button>
  )}
  {member.status === 'ACTIVE' && (
    <button onClick={() => { setSelectedMember(member); setShowDeactivateModal(true); }}
      className="text-sm text-yellow-600 dark:text-yellow-400 hover:underline font-medium">
      Deactivate
    </button>
  )}
  {member.status === 'INACTIVE' && (
    <button onClick={() => { setSelectedMember(member); setShowReactivateModal(true); }}
      className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
      Reactivate
    </button>
  )}
  {hasRole('Owner') && (
    <button onClick={() => { setSelectedMember(member); setShowDeleteModal(true); }}
      className="text-sm text-red-600 dark:text-red-400 hover:underline font-medium">
      Delete
    </button>
  )}
</div>
```

**Add all 4 modals at the bottom of the JSX (before closing tags):**
```typescript
<ChangeRoleModal
  isOpen={showChangeRoleModal}
  onClose={() => { setShowChangeRoleModal(false); setSelectedMember(null); }}
  onSuccess={() => fetchUsers()}
  member={selectedMember}
/>
<DeactivateUserModal
  isOpen={showDeactivateModal}
  onClose={() => { setShowDeactivateModal(false); setSelectedMember(null); }}
  onSuccess={() => fetchUsers()}
  member={selectedMember}
/>
<ReactivateUserModal
  isOpen={showReactivateModal}
  onClose={() => { setShowReactivateModal(false); setSelectedMember(null); }}
  onSuccess={() => fetchUsers()}
  member={selectedMember}
/>
<DeleteUserModal
  isOpen={showDeleteModal}
  onClose={() => { setShowDeleteModal(false); setSelectedMember(null); }}
  onSuccess={() => fetchUsers()}
  member={selectedMember}
/>
```

---

## Task 5 — Verify Self-Service Profile Integration (/users/me)

**What:** The contract (Section 7.3) includes self-service endpoints: `GET /users/me`, `PATCH /users/me`, `PATCH /users/me/password`. The existing profile page at `/settings/profile` currently uses auth module endpoints (`/auth/me`, `/auth/change-password`). Verify that the existing profile page works correctly and optionally enhance it to show membership data from the new Users module.

**File to read:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/profile/page.tsx`

**Steps:**

1. **Hit the new `/users/me` endpoint** and compare with `/auth/me`:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# New Users module endpoint
curl -s http://localhost:8000/api/v1/users/me -H "Authorization: Bearer $TOKEN"

# Existing Auth endpoint
curl -s http://localhost:8000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

2. **Verify the existing profile page works.** Navigate to `/settings/profile`, confirm:
   - Profile form loads with correct name, email, phone
   - Updating profile (first_name, last_name, phone) saves correctly
   - Change password modal works

3. **Add membership info to the profile page.** The `/users/me` endpoint returns additional membership data (role, tenant, status) that the auth endpoint doesn't. Add a read-only "Current Membership" section to the profile page:

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/profile/page.tsx`

**Add after the Personal Information section:**
```typescript
import { getMe } from '@/lib/api/users';
import type { UserMeResponse } from '@/lib/types/users';
import { Badge } from '@/components/ui/Badge';

// In the component, add state and fetch:
const [membership, setMembership] = useState<UserMeResponse['membership'] | null>(null);

useEffect(() => {
  getMe().then(data => setMembership(data.membership)).catch(() => {});
}, []);
```

**Add this card after the Personal Information card:**
```typescript
{/* Current Membership Section */}
{membership && (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Current Membership</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Role</p>
        <Badge variant="info">{membership.role.name}</Badge>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</p>
        <Badge variant="success">{membership.status}</Badge>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Member Since</p>
        <p className="text-sm text-gray-900 dark:text-gray-100">
          {membership.joined_at ? new Date(membership.joined_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
        </p>
      </div>
    </div>
  </div>
)}
```

4. **Do NOT change the profile update or password change to use the new endpoints.** The existing auth endpoints (`/auth/me` PATCH, `/auth/change-password`) continue to work. Do NOT replace them — both endpoint sets remain functional. The new `/users/me` endpoint is used only for reading membership data.

5. **Do NOT send `avatar_url`** in profile updates. The backend accepts it in the DTO but does NOT persist it (DEV-01 deviation). The existing profile page doesn't send it — verify this remains the case.

**Acceptance:**
- Existing profile page continues to work (no regressions)
- New "Current Membership" section shows role, status, and join date
- No `avatar_url` sent in profile updates

---

## Task 6 — Test All Actions + Profile End-to-End

1. **Change Role:** Click "Change Role" on an ACTIVE user → pick different role → submit → role badge updates
2. **Deactivate:** Click "Deactivate" on an ACTIVE user → enter reason → submit → status changes to INACTIVE
3. **Reactivate:** Click "Reactivate" on the INACTIVE user → submit → status changes to ACTIVE
4. **Delete:** (Owner only) Click "Delete" on a user → confirm → user removed from list
5. **Last Owner error:** Try deactivating the only Owner → verify error shows inline
6. **Visibility:** Verify Delete button only appears for Owner role
7. **Verify all modals refresh the list** after successful action
8. **Profile page:** Navigate to `/settings/profile` → verify "Current Membership" section shows role, status, join date

---

## Acceptance Criteria

- [ ] `ReactivateUserModal` exists at `app/src/components/users/ReactivateUserModal.tsx`
- [ ] `DeleteUserModal` exists at `app/src/components/users/DeleteUserModal.tsx`
- [ ] Reactivate handles 409 "active in another org" with persistent inline message
- [ ] Delete returns 204, handles 404 error
- [ ] Users List page Actions column shows contextual buttons per status
- [ ] All 4 modals wired with `onSuccess={() => fetchUsers()}`
- [ ] "Delete" visible only for Owner role (uses `hasRole('Owner')`)
- [ ] Dark mode works for all modals
- [ ] Profile page at `/settings/profile` shows "Current Membership" section with role, status, join date
- [ ] Profile page does NOT send `avatar_url` in PATCH requests
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — All 4 action flows must work from the Users List page before Sprint 6. The tenant-scoped Users management page is now COMPLETE.

---

## Handoff Notes

**Files created:**
- `app/src/components/users/ReactivateUserModal.tsx`
- `app/src/components/users/DeleteUserModal.tsx`

**Files modified:**
- `app/src/app/(dashboard)/settings/users/page.tsx` — All 4 action modals wired
- `app/src/app/(dashboard)/settings/profile/page.tsx` — Added "Current Membership" section using `/users/me`

**The Settings > Users page is now feature-complete.** It supports:
- List users with search, filters, pagination
- Invite new users
- Change role, deactivate, reactivate, delete users

**Sprint 6** builds the public invite accept page.
**Sprints 7–9** build platform admin user management.
