# Admin Sprint 3 — Invite User Modal
**Module:** Users (Frontend)
**File:** ./documentation/sprints/users/admin_sprint_3.md
**Type:** Frontend
**Depends On:** Admin Sprint 2 (Users List Page)
**Gate:** STOP — Invite modal must successfully create an INVITED membership via the API before Sprint 4
**Estimated Complexity:** Medium

---

## CRITICAL RULES — READ BEFORE ANYTHING

1. **DO NOT TOUCH THE BACKEND.** Do not modify any file under `/var/www/lead360.app/api/`.
2. **Backend runs on `http://localhost:8000`**. Frontend runs on `http://localhost:7000`**.
3. **You MUST hit both endpoints** (`GET /rbac/roles` and `POST /users/invite`) to verify actual responses.
4. **Use existing components** — Modal, ModalContent, ModalActions, Button, Input, Badge, LoadingSpinner. Do NOT create new UI primitives.
5. **Follow the form modal pattern** from `app/src/components/quotes/tags/TagFormModal.tsx`.
6. **Production-quality UI.** Proper validation, error display, loading states, success toast, dark mode.

---

## Test Accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Tenant Owner | `contact@honeydo4you.com` | `978@F32c` | Owner — can invite users |

---

## Objective

Build the **Invite User Modal** that allows Owners and Admins to invite new users to their organization. The modal includes:
- Email, First Name, Last Name text inputs
- Role dropdown (fetched from `GET /api/v1/rbac/roles`)
- Form validation matching backend rules
- Submit to `POST /api/v1/users/invite`
- Error handling (409 duplicate, 400 validation, 404 role not found)
- Success toast + refresh user list + close modal

Wire the "Invite User" button on the Users List page to open this modal.

---

## Pre-Sprint Checklist

- [ ] Confirm `app/src/app/(dashboard)/settings/users/page.tsx` exists (from Sprint 2)
- [ ] Confirm `app/src/lib/api/users.ts` has `inviteUser()` and `listRoles()` functions (from Sprint 1)
- [ ] Read `app/src/components/ui/Modal.tsx` — Modal, ModalContent, ModalActions components
- [ ] Read `app/src/components/ui/Input.tsx` — Input component props
- [ ] Read `app/src/components/ui/Button.tsx` — Button component props

---

## Task 1 — Hit the Endpoints

**What:** Verify the actual responses from both endpoints.

```bash
# Login as tenant owner
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)

# 1. GET /rbac/roles — List available roles for dropdown
curl -s http://localhost:8000/api/v1/rbac/roles \
  -H "Authorization: Bearer $TOKEN"

# 2. POST /users/invite — Test invite (use a test email)
# NOTE: This will actually create an invite. Use a throwaway email.
curl -s -X POST http://localhost:8000/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-invite-sprint3@example.com","first_name":"Test","last_name":"User","role_id":"ROLE_ID_FROM_ABOVE"}'

# 3. Try duplicate invite to see 409 error
curl -s -X POST http://localhost:8000/api/v1/users/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-invite-sprint3@example.com","first_name":"Test","last_name":"User","role_id":"ROLE_ID_FROM_ABOVE"}'
```

**Note the roles response shape and the invite response/error shapes.**

**Acceptance:** You know the exact role list shape and invite response/error shapes.
**Do NOT:** Skip this step.

---

## Task 2 — Create InviteUserModal Component

**What:** Create a reusable modal component for inviting users.

**File to create:** `/var/www/lead360.app/app/src/components/users/InviteUserModal.tsx`

**Props interface:**

```typescript
interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void; // Called after successful invite — parent should refetch user list
}
```

**Component requirements:**

1. **Form fields:**
   - **Email** — `<Input>` with type="email", required, auto-lowercased
   - **First Name** — `<Input>`, required, max 100 chars
   - **Last Name** — `<Input>`, required, max 100 chars
   - **Role** — `<select>` dropdown populated from `GET /api/v1/rbac/roles`, required

2. **Role dropdown:** Fetch roles on modal open using `listRoles()` from the API client. Show a loading spinner inside the select while loading. Each option: `<option value={role.id}>{role.name}</option>`.

3. **Validation (client-side, before submit):**
   - Email: must be non-empty and valid email format
   - First name: must be non-empty, max 100 chars
   - Last name: must be non-empty, max 100 chars
   - Role: must be selected (non-empty)

4. **Submit handler:**
   - Set loading state
   - Call `inviteUser({ email, role_id, first_name, last_name })`
   - On success: `toast.success('Invitation sent to {email}')`, call `onSuccess()`, call `onClose()`
   - On error: display error message inline in the modal (NOT a toast for 409/400 errors — show inline)

5. **Error handling by status code:**
   - `400` — Show validation errors inline
   - `404` — "Role not found" (should not happen with dropdown, but handle)
   - `409` — "This email already has an active membership in this organization."
   - Other — Generic error message

6. **Reset form** when modal opens (useEffect on `isOpen`)

7. **Layout:**
```
<Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member" size="lg">
  <ModalContent>
    <form className="space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">{error}</div>}
      <Input label="Email Address" ... />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="First Name" ... />
        <Input label="Last Name" ... />
      </div>
      <div>
        <label>Role</label>
        <select>...</select>
      </div>
    </form>
  </ModalContent>
  <ModalActions>
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <Button loading={submitting} onClick={handleSubmit}>Send Invite</Button>
  </ModalActions>
</Modal>
```

8. **Style the select dropdown** to match the project's dark mode:
```typescript
<select
  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
  value={roleId}
  onChange={(e) => setRoleId(e.target.value)}
  required
>
  <option value="">Select a role...</option>
  {roles.map((role) => (
    <option key={role.id} value={role.id}>{role.name}</option>
  ))}
</select>
```

**Acceptance:** Component renders, fetches roles, validates form, submits invite, handles errors.
**Do NOT:** Create a separate roles API client — use `listRoles()` from `app/src/lib/api/users.ts`.

---

## Task 3 — Wire InviteUserModal into Users List Page

**What:** Modify the Users List page to open the InviteUserModal when "Invite User" button is clicked.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/settings/users/page.tsx`

**Changes:**

1. Import the modal:
```typescript
import InviteUserModal from '@/components/users/InviteUserModal';
```

2. Add state:
```typescript
const [showInviteModal, setShowInviteModal] = useState(false);
```

3. Wire the "Invite User" button:
```typescript
<Button onClick={() => setShowInviteModal(true)}>
  <UserPlus className="w-5 h-5" />
  Invite User
</Button>
```

4. Add the modal to the JSX (at the bottom, before closing tags):
```typescript
<InviteUserModal
  isOpen={showInviteModal}
  onClose={() => setShowInviteModal(false)}
  onSuccess={() => fetchUsers()}
/>
```

**Acceptance:** Clicking "Invite User" opens the modal. Submitting a valid invite closes the modal, shows success toast, and refreshes the user list. The new invite shows as "INVITED" status in the table.

**Do NOT:** Restructure the Users List page. Just add the modal integration.

---

## Task 4 — Test End-to-End

**What:** Verify the full invite flow:

1. Navigate to `/settings/users`
2. Click "Invite User"
3. Fill in a test email (e.g., `testuser123@example.com`), first name, last name, select a role
4. Click "Send Invite"
5. Verify: success toast appears, modal closes, user list refreshes, new entry shows with INVITED status
6. Try inviting the same email again → verify 409 error shows inline in modal
7. Try submitting with empty fields → verify client-side validation prevents submit

**Acceptance:** All 7 checks pass.

---

## Acceptance Criteria

- [ ] `InviteUserModal` component exists at `app/src/components/users/InviteUserModal.tsx`
- [ ] Modal fetches roles from `GET /api/v1/rbac/roles` on open
- [ ] Role dropdown shows all available roles
- [ ] Form validates: email required + valid, first/last name required, role required
- [ ] Submit calls `POST /api/v1/users/invite` with correct payload
- [ ] Success: toast + close modal + refresh list
- [ ] 409 error: shows inline error "This email already has an active membership..."
- [ ] 400 error: shows validation errors inline
- [ ] Loading state on submit button
- [ ] Form resets when modal opens
- [ ] Users List page: "Invite User" button opens modal
- [ ] Users List page: list refreshes after successful invite
- [ ] Dark mode works
- [ ] No modifications to any file under `/var/www/lead360.app/api/`

---

## Gate Marker

**STOP** — The invite modal must successfully create an INVITED membership visible in the Users list before Sprint 4 starts.

---

## Handoff Notes

**Files created:**
- `app/src/components/users/InviteUserModal.tsx` — Invite user modal component

**Files modified:**
- `app/src/app/(dashboard)/settings/users/page.tsx` — Added invite modal integration

**Key decisions for downstream sprints:**
- The `onSuccess` callback pattern is established — Sprint 4 action modals should follow the same pattern
- `listRoles()` is called inside the modal — the same function will be reused in the ChangeRoleModal (Sprint 4)
- Error display pattern: inline error div inside modal for business rule errors, toast for success
