# Sprint 3 — Employee Profiles Management Page
**Module:** time-clock | **Type:** Frontend — Page | **Depends On:** Sprint 1
**Gate:** STOP — Full CRUD for employee profiles works, PIN management works
**Complexity:** Medium

---

## Code Quality Standard
> You are a **Google / Amazon / Apple senior-level frontend engineer**. Every file you produce must be production-grade: clean, accessible, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Mobile-first. Review your own output as if submitting a PR to a FAANG codebase.

## Mandatory Rules (Apply to EVERY sprint)

### RULE 1 — Test Live API First (NON-NEGOTIABLE)
Before implementing ANY page or component:
1. Read `api/documentation/time-clock_REST_API.md` for the endpoints you will consume
2. Login and get a JWT:
   ```bash
   curl -s -X POST http://localhost:8000/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq .access_token
   ```
3. Hit EVERY endpoint you will use with real credentials. Verify response shapes.
4. **If the live API returns different field names or data than the REST_API doc → USE THE LIVE API DATA.**
5. **If an endpoint is missing, broken, or returns unexpected data → STOP. Tell the human: "Endpoint X is not working. Issue: [describe]. Cannot proceed until backend is fixed."**

### RULE 2 — Sidebar Links
Every page MUST have a sidebar navigation entry. Update `DashboardSidebar.tsx` if needed.

### RULE 3 — Mobile-First
- Design for 375px first, enhance at md: (768px) and lg: (1024px)
- Inputs: 16px+ font (prevents iOS zoom). Touch targets: 48px min height.
- No horizontal scrolling. Use flex-col default, md:flex-row for desktop.

### RULE 4 — Production UI
- Use existing components from `/app/src/components/ui/` (Button, Input, Select, Modal, Badge, etc.)
- Masked inputs for money (CurrencyInput), hours (HoursInput)
- Icons from lucide-react on every action/status
- LoadingSpinner for all async. Toast for user feedback. Empty states with icon+message.
- Form validation with inline error messages (React Hook Form + Zod)

### RULE 5 — Full CRUD
Never implement endpoints halfway. If a resource has list/create/read/update/delete, build ALL with full UI. 100% endpoint coverage.

### RULE 6 — Existing Patterns
- Forms: React Hook Form + Zod. HTTP: Axios from `/app/src/lib/api/axios.ts`. Toasts: react-hot-toast. Icons: lucide-react. Dates: date-fns.
- DO NOT install new libraries without human approval.

### RULE 7 — Stop on Problems
If anything is missing, broken, or ambiguous → STOP and tell the human. Do not guess.

## Test Credentials
- **Admin**: `ludsonaiello@gmail.com` / `978@F32c`
- **Tenant User**: `contact@honeydo4you.com` / `978@F32c`

## Environment
- **This project does NOT use PM2.**
- Frontend port: **7000** | Dev server: `cd /var/www/lead360.app/app && npm run dev`
- Backend API: `http://127.0.0.1:8000/api/v1`
- Swagger: `http://127.0.0.1:8000/api/docs`
- Working directory: `/var/www/lead360.app/app/`
- **NEVER touch backend code** (`/api/` folder is off-limits)

## Dev Server
CHECK port 7000: lsof -i :7000
KILL if found: kill {PID}
START: cd /var/www/lead360.app/app && npm run dev
VERIFY: open http://localhost:7000 in browser
KEEP running entire sprint. SHUTDOWN before marking complete.

---

## Objective

Build the Employee Profiles management page. This is where Owners and Admins create, view, edit, and manage employee profiles that bridge the `user` (login identity) to the `crew_member` (financial record) for time-clock purposes. Includes PIN management for kiosk mode.

**Page:** Can be implemented as either:
- A separate page at `/settings/time-clock/employees` (with its own route), OR
- An "Employees" tab within the Settings page from Sprint 2

**Recommended approach:** Add as a new tab ("Employees") in the existing Settings page at `/settings/time-clock/page.tsx`, since the contract's Section 7.9 lists Employees as a tab. If the Settings page becomes too large, extract into a child component file: `app/src/components/time-clock/EmployeeProfilesTab.tsx`.

**Roles:** Owner, Admin only

---

## Task 1 — Test All 7 Endpoints

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)

# 1. List employees (paginated)
curl -s -X GET "http://localhost:8000/api/v1/time-clock/employees?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 2. Create employee profile (use an actual user_id from the response of /users list)
# First, get a list of users to find a valid user_id:
curl -s -X GET "http://localhost:8000/api/v1/users" \
  -H "Authorization: Bearer $TOKEN" | jq '.data[0].id'

# Then create (replace USER_ID with actual value):
# curl -s -X POST http://localhost:8000/api/v1/time-clock/employees \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"user_id":"USER_ID","hourly_rate":25.00}' | jq .

# 3. Get single employee (replace ID)
# curl -s -X GET http://localhost:8000/api/v1/time-clock/employees/{ID} \
#   -H "Authorization: Bearer $TOKEN" | jq .

# 4. Update employee (replace ID)
# curl -s -X PATCH http://localhost:8000/api/v1/time-clock/employees/{ID} \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"hourly_rate":30.00}' | jq .

# 5. Set PIN (replace ID)
# curl -s -X POST http://localhost:8000/api/v1/time-clock/employees/{ID}/pin \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"pin":"1234"}' | jq .

# 6. Remove PIN (replace ID)
# curl -s -X DELETE http://localhost:8000/api/v1/time-clock/employees/{ID}/pin \
#   -H "Authorization: Bearer $TOKEN" | jq .

# 7. Save push subscription (for current user)
# curl -s -X POST http://localhost:8000/api/v1/time-clock/employees/me/push-subscription \
#   -H "Authorization: Bearer $TOKEN" \
#   -H "Content-Type: application/json" \
#   -d '{"subscription_json":"{\"endpoint\":\"test\"}"}' | jq .
```

Record all response shapes. Pay special attention to:
- Whether the employee list includes `user` and `crew_member` relation data
- The `has_pin` and `is_locked` derived fields
- How `search` query parameter works (if supported)
- Pagination meta shape

---

## Task 2 — Employee List View

Build the employee list as either a page or tab component.

### Desktop Layout (md: and above)

```
+--------------------------------------------------------------------+
| Employee Profiles                          [+ Add Employee]         |
+--------------------------------------------------------------------+
| [Search: ___________________]                                      |
+--------------------------------------------------------------------+
| Name          | Email            | Crew    | Rate   | PIN | Active |
|---------------|------------------|---------|--------|-----|--------|
| John Smith    | john@example.com | Linked  | $25/hr | Yes | Active |
| Jane Doe      | jane@example.com | —       | $30/hr | No  | Active |
| Bob Wilson    | bob@example.com  | Linked  | —      | Yes | Inactive|
+--------------------------------------------------------------------+
| [< Prev]  Page 1 of 3  [Next >]                                   |
+--------------------------------------------------------------------+
```

### Mobile Layout (below md:)

Card-based layout:

```
+------------------------------------------+
| John Smith                     [Active]  |
| john@example.com                         |
| Crew: Linked | Rate: $25/hr | PIN: Yes  |
| [Edit] [PIN]                             |
+------------------------------------------+
```

### Table Columns

| Column | Content | Component |
|--------|---------|-----------|
| Name | `{user.first_name} {user.last_name}` | Plain text, bold |
| Email | `{user.email}` | Plain text, `text-gray-500` |
| Crew Member | "Linked" (green Badge) if `crew_member_id` is set, else "Not Linked" (neutral Badge). Show crew member name on hover/tooltip if linked | `Badge` |
| Hourly Rate | `${hourly_rate}/hr` or "—" if null | `CurrencyInput` display format |
| PIN Status | "Set" (green Badge) if `has_pin === true`, "Not Set" (neutral Badge) | `Badge` |
| Active | "Active" (success Badge) or "Inactive" (neutral Badge) | `Badge` |
| Actions | Edit button, PIN management button | `Button` icons |

### Search

- Search input at the top with `Search` icon from lucide-react
- Use debounced search (300ms) — pass `search` query param to `listEmployeeProfiles({ search, page, limit })`
- If backend doesn't support search param, filter client-side

### Pagination

- Use `PaginationControls` component
- Default page size: 20
- Track `page` and `meta` state

### Empty State

If no employee profiles exist:
```
[Users icon]
No Employee Profiles
Create employee profiles to enable time tracking for your team.
[+ Add Employee Profile]
```

---

## Task 3 — Create Employee Modal

**Trigger:** "Add Employee" button at the top of the list.

**Modal:** Use `Modal` + `ModalContent` + `ModalActions` pattern.

### Form Fields

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| User | `Select` | Required | Dropdown of tenant users. Fetch user list from `/users` endpoint (or whatever the existing user list endpoint is). Show `{first_name} {last_name} ({email})`. Only show users who DON'T already have an employee profile (check against existing profile list or let the backend 409 handle it) |
| Crew Member | `Select` | Optional | Dropdown of crew members. Fetch from crew member list endpoint. Show `{first_name} {last_name}`. Include "— None —" option. Show note: "Link to a crew member for automatic labor cost tracking." |
| Hourly Rate | `CurrencyInput` or `MoneyInput` | Optional, min 0 | "Override the crew member's default hourly rate. Leave blank to use the crew member's rate." |
| Overtime Rule Override | `ToggleSwitch` | — | "Use custom overtime thresholds for this employee instead of the tenant default" |
| Daily Threshold (hours) | `HoursInput` | 0-24, conditional | Only visible when overtime_rule_override is ON |
| Weekly Threshold (hours) | `HoursInput` | 0-168, conditional | Only visible when overtime_rule_override is ON |

### Auto-Link Note

Show an informational text below the Crew Member field:
"If a crew member exists with the same user account, it will be linked automatically."

### Zod Schema

```typescript
const createEmployeeSchema = z.object({
  user_id: z.string().min(1, 'User is required'),
  crew_member_id: z.string().optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  overtime_rule_override: z.boolean().default(false),
  overtime_daily_threshold_hours: z.number().min(0).max(24).optional().nullable(),
  overtime_weekly_threshold_hours: z.number().min(0).max(168).optional().nullable(),
});
```

### Submit Handler

```typescript
const handleCreate = async (data: CreateEmployeeProfileRequest) => {
  try {
    setSubmitting(true);
    await createEmployeeProfile(data);
    toast.success('Employee profile created');
    setShowCreateModal(false);
    loadEmployees(); // Refresh list
  } catch (error: any) {
    if (error?.response?.status === 409) {
      toast.error('An employee profile already exists for this user');
    } else {
      toast.error(error?.response?.data?.message || 'Failed to create employee profile');
    }
  } finally {
    setSubmitting(false);
  }
};
```

---

## Task 4 — Edit Employee Modal

**Trigger:** Edit button (pencil icon) on each row/card.

Same form as Create, except:
- `user_id` field is read-only (display user name, cannot change)
- Pre-fill all fields with current values
- Add `is_active` toggle at the top: "Active — Inactive employees cannot clock in"
- Call `updateEmployeeProfile(id, data)` on submit

### Zod Schema

```typescript
const updateEmployeeSchema = z.object({
  crew_member_id: z.string().optional().nullable(),
  hourly_rate: z.number().min(0).optional().nullable(),
  overtime_rule_override: z.boolean(),
  overtime_daily_threshold_hours: z.number().min(0).max(24).optional().nullable(),
  overtime_weekly_threshold_hours: z.number().min(0).max(168).optional().nullable(),
  is_active: z.boolean(),
});
```

---

## Task 5 — PIN Management

Two actions per employee:

### Set PIN

**Trigger:** "Set PIN" or "Change PIN" button on the employee row.

**Modal:** Small modal with:
- Employee name displayed at top (read-only)
- PIN input: Use `MaskedInput` or a custom PIN input, 4-6 digits only, masked (dots)
- Confirm PIN input: Must match the first entry
- Submit button

```typescript
const pinSchema = z.object({
  pin: z.string().min(4, 'PIN must be 4-6 digits').max(6, 'PIN must be 4-6 digits').regex(/^\d+$/, 'PIN must contain only digits'),
  confirmPin: z.string(),
}).refine(data => data.pin === data.confirmPin, {
  message: 'PINs do not match',
  path: ['confirmPin'],
});
```

On submit: Call `setEmployeePin(employeeId, { pin })`. On success: toast "PIN set successfully", refresh list.

### Remove PIN

**Trigger:** "Remove PIN" button (only visible when `has_pin === true`).

**Confirmation:** Use `ConfirmModal`:
- Title: "Remove Kiosk PIN"
- Message: "Remove the kiosk PIN for {employee name}? They will no longer be able to use the kiosk to clock in."
- On confirm: Call `removeEmployeePin(employeeId)`. On success: toast "PIN removed", refresh list.

### PIN Status Display

In the table/card, show PIN status:
- `has_pin === true` AND `is_locked === false`: Green Badge "PIN Set" + "Change" and "Remove" buttons
- `has_pin === true` AND `is_locked === true`: Red Badge "Locked" + "Change" and "Remove" buttons. Show lockout info if available.
- `has_pin === false`: Neutral Badge "No PIN" + "Set PIN" button

---

## Task 6 — Detail View (Optional Slide-Over)

When clicking an employee name or a "View" button, show a detail panel/slide-over with:

- Full name and email
- Active status
- Crew member link status (with crew member name if linked)
- Hourly rate (employee override or crew member default)
- Overtime rule details (override or tenant default)
- PIN status
- Created/updated timestamps
- List of project assignments (from `employee_project_assignment` — if this data is included in the employee detail response, show it. Otherwise, note it will be built in Sprint 4)

This is optional but recommended. If time is short, a simple modal with the same info is acceptable.

---

## Task 7 — Loading, Empty, and Error States

### Loading State
- Initial list load: `SkeletonTable` (rows=5, cols=6) on desktop, skeleton cards on mobile
- Modal submit: `Loader2` spinner on submit button, disable all inputs

### Empty State
- No employees: Icon (`Users`), text "No Employee Profiles", description "Create employee profiles to enable time tracking for your team.", CTA button "Add Employee Profile"

### Error State
- List load failure: Toast error, show retry button
- Create/update failure: Toast with server error message. 409 for duplicate user → "An employee profile already exists for this user"
- PIN set failure: Toast error
- PIN remove failure: Toast error

---

## Task 8 — Fetching User and Crew Member Lists for Dropdowns

The Create Employee form needs two dropdown lists:

### Users List
- Find the existing endpoint that lists tenant users: likely `GET /users` or `GET /api/v1/users`
- Read the existing user list page (e.g., `app/src/app/(dashboard)/users/page.tsx`) to see how users are fetched
- The dropdown should show: `{first_name} {last_name} ({email})`
- Filter out users who already have an employee profile (compare `user_id` values from the employee list)

### Crew Members List
- Find the existing endpoint that lists crew members: likely `GET /crew-members` or `GET /api/v1/crew`
- Read the existing crew page (e.g., `app/src/app/(dashboard)/crew/page.tsx`) to see how crew members are fetched
- The dropdown should show: `{first_name} {last_name}`
- Include a "— No Crew Member —" option for null

### Implementation Notes
- Fetch both lists on modal open (not on page load — lazy load)
- Show `Loader2` spinner inside the Select while loading
- If either fetch fails, show toast error and disable the Select

---

## Task 9 — Dark Mode Support

All elements MUST include `dark:` Tailwind variants. Follow the established pattern:

- Table headers: `bg-gray-50 dark:bg-gray-800`
- Table rows: `bg-white dark:bg-gray-900`, hover: `hover:bg-gray-50 dark:hover:bg-gray-800`
- Cards: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700`
- Text: `text-gray-900 dark:text-white`, `text-gray-500 dark:text-gray-400`
- Badges: Follow existing Badge component dark mode support
- Modals: Follow existing Modal component dark mode support

---

## Acceptance Criteria

- [ ] All 7 employee endpoints verified and working (list, create, get, update, set PIN, remove PIN, push subscription)
- [ ] Employee list renders with search, pagination, and all 6 columns
- [ ] Desktop table and mobile cards both render correctly
- [ ] "Add Employee" button opens create modal
- [ ] Create modal shows user dropdown (filtered to exclude existing profiles), crew member dropdown, hourly rate, overtime override fields
- [ ] Create modal validates with Zod and shows inline errors
- [ ] Create succeeds with toast "Employee profile created", refreshes list
- [ ] Create with duplicate user returns toast "An employee profile already exists for this user"
- [ ] Edit modal pre-fills all fields, allows updating, shows is_active toggle
- [ ] Edit succeeds with toast, refreshes list
- [ ] "Set PIN" modal accepts 4-6 digit PIN with confirmation
- [ ] "Set PIN" validates matching PINs
- [ ] "Remove PIN" shows ConfirmModal, removes PIN on confirm
- [ ] PIN status badges show correctly: "PIN Set" (green), "Locked" (red), "No PIN" (neutral)
- [ ] Empty state shows when no employees exist
- [ ] Loading skeleton shows during initial load
- [ ] Error toasts show on all failure cases
- [ ] All inputs have 16px+ font size
- [ ] All touch targets are 48px+ height
- [ ] Page renders correctly at 375px viewport (no horizontal scroll)
- [ ] Dark mode classes applied throughout
- [ ] No new npm packages installed
- [ ] No TODO comments
- [ ] Dev server runs without errors
