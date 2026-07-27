# Sprint 13 — Kiosk Mode (Standalone Page)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_frontend/sprint_13.md
**Type:** Frontend — Standalone Page
**Depends On:** Sprint 1
**Gate:** STOP — Kiosk PIN entry and clock-in/out works without JWT
**Estimated Complexity:** Medium

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

**RULE 1 — Test live API first.** Before writing any component, hit every endpoint this sprint consumes via curl. Confirm the response shape matches the documentation. Only then start building.

**RULE 2 — Credentials.** Use these test accounts for all API testing:
- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contact@honeydo4you.com` / `978@F32c`

**RULE 3 — Environment.** This project does **NOT** use PM2. Do not reference or run any PM2 command.

**RULE 4 — Dev server.** The frontend dev server runs via `npm run dev` (Next.js) on port **7000**. The backend must also be running on port **8000** for API calls. Start the backend with `cd /var/www/lead360.app/api && npm run start:dev` and wait for `curl -s http://localhost:8000/health` to return 200 before testing.

**RULE 5 — No backend code.** You CANNOT touch any backend code. Only frontend code in `/var/www/lead360.app/app/`. You CAN read backend API documentation at `/var/www/lead360.app/api/documentation/` as much as you need.

**RULE 6 — Follow existing patterns.** Read existing files first. Use the same API call pattern, error handling, loading state pattern, and component conventions already in the codebase. Never recreate a component that already exists in `app/src/components/ui/`. New time-clock components go in `app/src/components/time-clock/` only.

**RULE 7 — Clean shutdown.** Before marking the sprint complete, stop any dev servers you started. Confirm ports 7000 and 8000 are free: `lsof -i :7000` and `lsof -i :8000` must return nothing.

---

## Objective

Build a standalone Kiosk Mode page at `/kiosk` that operates entirely outside the dashboard layout (no sidebar, no top nav, no JWT). Kiosk authentication uses the `X-Kiosk-Token` header. Employees tap their name, enter a PIN, and clock in or out.

---

## Pre-Sprint Checklist
- [ ] Sprint 1 complete — API client, types, and sidebar navigation working
- [ ] Read `app/src/app/(dashboard)/layout.tsx` — understand the dashboard layout so you can avoid it
- [ ] Read `app/src/lib/api.ts` or equivalent — understand the axios instance pattern
- [ ] Read `app/src/components/ui/` — inventory of existing UI components
- [ ] Read `api/documentation/clockin_REST_API.md` — kiosk endpoint section
- [ ] Backend Sprint 13 complete — kiosk endpoints implemented

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

The backend must be running for kiosk API calls. If not:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT for health check:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

CHECK if port 7000 is already in use:
  lsof -i :7000

START the frontend dev server:
  cd /var/www/lead360.app/app && npm run dev

KEEP both servers running for the entire duration of the sprint.

BEFORE marking the sprint COMPLETE:
  lsof -i :7000
  lsof -i :8000
  kill {PIDs}
  Confirm both ports are free.
```

---

## Endpoints Consumed (3 — all PUBLIC, no JWT)

These endpoints use `X-Kiosk-Token` header instead of `Authorization: Bearer`. You must generate a kiosk token first using an admin JWT.

**Generate a kiosk token (one-time setup):**
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Regenerate kiosk token (returns plaintext token — save it)
curl -s -X POST http://localhost:8000/api/v1/time-clock/settings/kiosk-token/regenerate \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

Save the returned plaintext token as `KIOSK_TOKEN` for all subsequent calls.

**Endpoint 1: GET /api/v1/time-clock/kiosk/employees**
```bash
curl -s http://localhost:8000/api/v1/time-clock/kiosk/employees \
  -H "X-Kiosk-Token: $KIOSK_TOKEN" | jq '.'
```
Response: `{ data: [{ id, user: { first_name, last_name }, has_pin, is_clocked_in }] }`

**Endpoint 2: POST /api/v1/time-clock/kiosk/clock-in**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/kiosk/clock-in \
  -H "X-Kiosk-Token: $KIOSK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_profile_id": "UUID_HERE", "pin": "1234"}' | jq '.'
```
Response: Clock session object on success.

**Endpoint 3: POST /api/v1/time-clock/kiosk/clock-out**
```bash
curl -s -X POST http://localhost:8000/api/v1/time-clock/kiosk/clock-out \
  -H "X-Kiosk-Token: $KIOSK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employee_profile_id": "UUID_HERE", "pin": "1234"}' | jq '.'
```
Response: Clock session object on success.

---

## Tasks

### Task 1 — Test All 3 Kiosk Endpoints Live

Before writing any code, verify each endpoint works:

1. Generate a kiosk token using the admin JWT (see above).
2. Call `GET /time-clock/kiosk/employees` with `X-Kiosk-Token` header. Confirm it returns employee data with truncated last names.
3. Call `POST /time-clock/kiosk/clock-in` with a valid employee ID and PIN. Confirm it returns a clock session.
4. Call `POST /time-clock/kiosk/clock-out` with the same employee. Confirm it returns a completed session.
5. Test error cases:
   - Missing `X-Kiosk-Token` header → 401
   - Invalid token → 401
   - Wrong PIN → 401 with `remaining_attempts`
   - 5 wrong PINs → 423 (locked for 15 minutes)

Record the response shapes. Only proceed to Task 2 after all endpoints are confirmed working.

---

### Task 2 — Kiosk Layout

**Path:** `/var/www/lead360.app/app/src/app/kiosk/layout.tsx`

This layout is **OUTSIDE** the `(dashboard)` folder — it must NOT inherit the dashboard sidebar, top nav, or auth context.

**Requirements:**
- Minimal full-screen layout: no sidebar, no top navigation bar
- Dark background (`bg-gray-900` or similar dark theme)
- Large white text (optimized for tablet/TV kiosk display)
- Company logo placeholder at top center (if available from a public endpoint or static asset)
- Vertically and horizontally centered content area
- No scroll — content fits viewport (use `min-h-screen`, `overflow-hidden`)
- Meta tags: prevent zoom on mobile (`user-scalable=no` via viewport meta)
- No `AuthProvider` or `RBACProvider` wrappers — kiosk is unauthenticated

```typescript
// app/src/app/kiosk/layout.tsx
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  // Full-screen dark layout, no dashboard chrome
}
```

---

### Task 3 — Kiosk Page + Token Handling

**Path:** `/var/www/lead360.app/app/src/app/kiosk/page.tsx`

**Token handling logic:**
1. On mount, read `?token=xxx` from URL query parameters (`useSearchParams()`)
2. If token found in URL → store it in `sessionStorage.setItem('kiosk_token', token)`
3. If no token in URL → check `sessionStorage.getItem('kiosk_token')`
4. If no token anywhere → render "Invalid kiosk configuration" error screen (large text, centered, with a brief instruction: "Please contact your administrator to set up kiosk access")

**Custom axios instance:**
Create a kiosk-specific axios instance (do NOT reuse the JWT-based instance):

```typescript
// app/src/lib/kiosk-api.ts
import axios from 'axios';

export function createKioskApi(token: string) {
  return axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1',
    headers: {
      'X-Kiosk-Token': token,
      'Content-Type': 'application/json',
    },
  });
}
```

**Page state machine:** The kiosk page manages three screens via state:
- `'employee_list'` — default screen
- `'pin_entry'` — after selecting an employee
- `'success'` — after successful clock-in/out (auto-returns to employee_list after 3 seconds)

---

### Task 4 — Employee List Screen

This is the default view within the kiosk page.

**Data fetch:**
- Call `GET /time-clock/kiosk/employees` using the kiosk axios instance
- On error (401): show "Kiosk token expired or invalid. Please contact your administrator."

**Layout:**
```
+------------------------------------------------------+
|                   [Company Logo]                      |
|                                                        |
|  [Search: ________________________]                   |
|                                                        |
|  +------------+  +------------+  +------------+       |
|  | John D.    |  | Sarah M.   |  | Mike R.    |       |
|  | [Clocked   |  | [Not       |  | [Clocked   |       |
|  |  In]       |  |  Clocked]  |  |  In]       |       |
|  +------------+  +------------+  +------------+       |
|                                                        |
|  +------------+  +------------+  +------------+       |
|  | Lisa K.    |  | Tom W.     |  | Amy B.     |       |
|  | [Not       |  | [Not       |  | [Clocked   |       |
|  |  Clocked]  |  |  Clocked]  |  |  In]       |       |
|  +------------+  +------------+  +------------+       |
+------------------------------------------------------+
```

**Features:**
1. Responsive grid: 3 columns on tablet/desktop, 2 on small tablets, 1 on phone
2. Each card shows: `first_name` + `last_name` (already truncated by backend, e.g., "John D.")
3. Clocked-in status indicator:
   - Green dot + "Clocked In" if `is_clocked_in === true`
   - Gray dot + "Not Clocked In" if `is_clocked_in === false`
4. Cards are large and tappable (minimum 120px height, large font)
5. Search bar at top: filters employees client-side by first name or last name (case-insensitive)
6. Tap on a card → transition to PIN entry screen with selected employee

**Auto-refresh:** Set up a `setInterval` to re-fetch the employee list every **30 seconds** to update clocked-in status. Clear the interval on unmount. Do NOT refresh while the user is on the PIN entry or success screen.

---

### Task 5 — PIN Entry Screen

**Component:** `/var/www/lead360.app/app/src/components/time-clock/KioskPINPad.tsx`

This screen appears after tapping an employee from the list.

**Layout:**
```
+------------------------------------------------------+
|                                                        |
|              [<- Back to employees]                   |
|                                                        |
|                   John D.                              |
|              [Clocked In / Not Clocked In]            |
|                                                        |
|              +-------------------+                    |
|              |   * * * *         |                    |
|              +-------------------+                    |
|                                                        |
|              +-----+ +-----+ +-----+                 |
|              |  1  | |  2  | |  3  |                 |
|              +-----+ +-----+ +-----+                 |
|              +-----+ +-----+ +-----+                 |
|              |  4  | |  5  | |  6  |                 |
|              +-----+ +-----+ +-----+                 |
|              +-----+ +-----+ +-----+                 |
|              |  7  | |  8  | |  9  |                 |
|              +-----+ +-----+ +-----+                 |
|              +-----+ +-----+ +-----+                 |
|              |  <X | |  0  | |  OK |                 |
|              +-----+ +-----+ +-----+                 |
|                                                        |
+------------------------------------------------------+
```

**Requirements:**
1. Display selected employee name prominently (large, bold, white text)
2. Show current clocked-in/out status below the name
3. PIN input display: show filled dots (`\u25CF`) for each digit entered, empty dots for remaining (support 4-6 digits)
4. Numpad buttons:
   - Digits 0-9
   - Backspace (`<X`) — removes last digit
   - Enter/OK — submits PIN
   - Each button minimum **72px x 72px** (touch-friendly for tablet)
   - Large font (24px minimum)
   - Visible tap feedback (`:active` state with scale or color change)
5. "Back" button at top-left to return to employee list (clears entered PIN)
6. PIN is stored in component state as a string, never displayed as plaintext
7. Enter/OK button disabled until at least 4 digits entered
8. Maximum 6 digits — stop accepting input after 6

---

### Task 6 — PIN Validation + Clock Action

On PIN submit (Enter/OK tapped with 4-6 digits):

**Logic:**
1. Determine the action based on the selected employee's `is_clocked_in` status:
   - If `is_clocked_in === false` → POST `/time-clock/kiosk/clock-in` with `{ employee_profile_id, pin }`
   - If `is_clocked_in === true` → POST `/time-clock/kiosk/clock-out` with `{ employee_profile_id, pin }`

2. Show a loading spinner on the OK button while the request is in flight. Disable all numpad buttons during the request.

3. **Error handling by HTTP status:**

   | Status | Meaning | UI Response |
   |--------|---------|-------------|
   | 401 | Invalid PIN | Show "Invalid PIN" message in red below the dots. Display remaining attempts from response body (`remaining_attempts`). Clear PIN input. Keep user on PIN screen to retry. |
   | 423 | Account locked | Show "Account locked for 15 minutes" in red. Disable numpad. After 3 seconds, return to employee list. |
   | 429 | Rate limited | Show "Too many attempts, please wait" in yellow/orange. Disable numpad for 10 seconds, then re-enable. |
   | 409 | Already clocked in/out | Show "Already clocked in" or "Already clocked out" as appropriate. After 3 seconds, return to employee list and refresh. |
   | Other 4xx/5xx | Unexpected error | Show "Something went wrong. Please try again." in red. After 5 seconds, return to employee list. |

4. **Success handling:**
   - Transition to the success screen (Task 7)

---

### Task 7 — Success Screen

After a successful clock-in or clock-out, show a full-screen success confirmation.

**Layout:**
```
+------------------------------------------------------+
|                                                        |
|                                                        |
|                  [Large Green Check]                  |
|                                                        |
|               Clocked In!                              |
|                  — or —                                |
|               Clocked Out!                             |
|                                                        |
|               John D.                                  |
|               10:32 AM                                 |
|                                                        |
|                                                        |
+------------------------------------------------------+
```

**Requirements:**
1. Large animated green checkmark icon (use lucide-react `CheckCircle2` or similar, scale up with CSS animation)
2. "Clocked In!" or "Clocked Out!" in large bold text based on the action taken
3. Employee name displayed below
4. Current time displayed (formatted with `Intl.DateTimeFormat` or `date-fns`)
5. Auto-return to employee list after **3 seconds** (use `setTimeout`)
6. On return, trigger a re-fetch of the employee list to update clocked-in statuses
7. No buttons needed — purely a confirmation screen with auto-redirect

---

## Acceptance Criteria
- [ ] All 3 kiosk endpoints tested live via curl before any code was written
- [ ] Kiosk layout at `/kiosk` — full-screen, dark, no sidebar, no top nav, no JWT
- [ ] Token read from URL `?token=xxx` and stored in `sessionStorage`
- [ ] Missing token shows "Invalid kiosk configuration" error
- [ ] Custom kiosk axios instance sends `X-Kiosk-Token` header (NOT `Authorization: Bearer`)
- [ ] Employee list displays names with clocked-in status indicators
- [ ] Search bar filters employees client-side
- [ ] Employee list auto-refreshes every 30 seconds
- [ ] Tap employee → PIN entry screen with numpad
- [ ] PIN dots display correctly (4-6 digits)
- [ ] Numpad buttons are 72px minimum, touch-friendly
- [ ] PIN submit calls correct endpoint based on clocked-in status
- [ ] 401 (Invalid PIN) → shows error, remaining attempts, clears PIN, stays on screen
- [ ] 423 (Locked) → shows lockout message, returns to employee list
- [ ] 429 (Rate limited) → shows wait message, disables numpad temporarily
- [ ] Success → green check, "Clocked In!" / "Clocked Out!", employee name, time
- [ ] Success screen auto-returns to employee list after 3 seconds
- [ ] Employee list refreshes after returning from success screen
- [ ] Mobile responsive (works on phone, tablet, and TV kiosk displays)
- [ ] No backend code was modified
- [ ] `npm run lint` passes (from `/var/www/lead360.app/app/`)
- [ ] Dev servers shut down before sprint is marked complete

---

## Files Created in This Sprint

| File | Purpose |
|---|---|
| `app/src/app/kiosk/layout.tsx` | Standalone kiosk layout (no dashboard chrome) |
| `app/src/app/kiosk/page.tsx` | Kiosk page — state machine (employee list, PIN entry, success) |
| `app/src/lib/kiosk-api.ts` | Custom axios instance with X-Kiosk-Token header |
| `app/src/components/time-clock/KioskPINPad.tsx` | PIN numpad component (72px buttons, dots display) |

---

## Handoff Notes
- The kiosk page lives at `/kiosk` — completely outside the `(dashboard)` route group
- No JWT, no auth context, no RBAC — kiosk uses a shared token per tenant
- The kiosk token is generated by an admin via `POST /time-clock/settings/kiosk-token/regenerate` (requires admin JWT)
- The kiosk URL format for deployment: `https://app.lead360.app/kiosk?token=PLAINTEXT_TOKEN`
- Employee last names are already truncated by the backend (e.g., "D.") for privacy
- The `is_clocked_in` field determines which action to take — clock-in or clock-out
- Rate limiting is per kiosk token (10 attempts per minute); PIN lockout is per employee (5 wrong PINs = 15 min lock)
- Sprint 14 will add push notifications and cross-page polish
