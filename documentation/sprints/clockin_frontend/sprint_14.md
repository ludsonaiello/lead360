# Sprint 14 — Push Notifications + Navigation Polish + Final Review
**Module:** time-clock
**File:** ./documentation/sprints/clockin_frontend/sprint_14.md
**Type:** Frontend — Polish
**Depends On:** All previous sprints (1-13)
**Gate:** NONE (final frontend sprint)
**Estimated Complexity:** Low

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

**RULE 1 — Test live API first.** Before writing any code, hit every endpoint this sprint consumes via curl. Confirm the response shape matches the documentation. Only then start building.

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

Implement Web Push notification subscription for time-clock alerts, polish all navigation across the module, perform cross-page integration verification, run accessibility checks, and ensure error boundaries exist on every page.

---

## Pre-Sprint Checklist
- [ ] ALL previous sprints (1-13) complete and functional
- [ ] Read every page created in previous sprints — inventory all routes and components
- [ ] Read `app/src/components/time-clock/` — full component inventory
- [ ] Read the sidebar navigation — verify all workforce links exist
- [ ] Read `api/documentation/clockin_REST_API.md` — push subscription endpoint
- [ ] Backend running and healthy at port 8000

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

The backend must be running. If not:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT for health check:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

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

## Endpoint Consumed (1)

**POST /api/v1/time-clock/employees/me/push-subscription**

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

curl -s -X POST http://localhost:8000/api/v1/time-clock/employees/me/push-subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscription_json": "{\"endpoint\":\"https://example.com\",\"keys\":{\"p256dh\":\"test\",\"auth\":\"test\"}}"}' \
  | jq '.'
```

This saves the Web Push subscription for the current employee profile, enabling server-side push notifications for shift reminders, missed shift alerts, and dispute status updates.

---

## Tasks

### Task 1 — Web Push Notification Subscription

**Where:** Add to the Clock page (`/workforce/clock`) on mount, since it is the most frequently visited time-clock page.

**Implementation:**

1. On Clock page mount, check if the browser supports push notifications:
   ```typescript
   if ('serviceWorker' in navigator && 'PushManager' in window) {
     // Browser supports push
   }
   ```

2. Check current permission state:
   ```typescript
   const permission = Notification.permission;
   // 'default' = not yet asked
   // 'granted' = already subscribed
   // 'denied' = user blocked
   ```

3. If `permission === 'default'`:
   - Show a non-intrusive prompt banner at the top of the Clock page:
     ```
     +------------------------------------------------------+
     | [Bell Icon] Enable notifications to receive shift     |
     | reminders and alerts.  [Enable]  [Maybe Later]       |
     +------------------------------------------------------+
     ```
   - "Enable" button calls `Notification.requestPermission()`
   - "Maybe Later" dismisses the banner and stores a flag in `localStorage` (`kiosk_push_dismissed_at`) so it does not reappear for 7 days

4. If `permission === 'granted'`:
   - Check if subscription already saved to backend (use a `localStorage` flag: `push_subscription_saved`)
   - If not saved:
     ```typescript
     const registration = await navigator.serviceWorker.ready;
     const subscription = await registration.pushManager.subscribe({
       userVisibleOnly: true,
       applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
     });
     const subscriptionJson = JSON.stringify(subscription);
     await apiClient.post('/time-clock/employees/me/push-subscription', {
       subscription_json: subscriptionJson,
     });
     localStorage.setItem('push_subscription_saved', 'true');
     ```
   - If `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is not set, skip push subscription silently (do NOT break the page)

5. If `permission === 'denied'`:
   - Do nothing. Do not prompt. Do not break the page.

6. **What notifications this enables** (handled server-side, just documenting for context):
   - Shift reminders (X minutes before scheduled shift)
   - Missed shift alerts (if employee does not clock in after threshold)
   - Dispute status updates (approved, rejected, resolved)

**Error handling:** All push subscription logic must be wrapped in try/catch. If any step fails (service worker not registered, subscription fails, API call fails), log to console and continue silently. Push is a nice-to-have — it must NEVER break the clock page.

---

### Task 2 — Navigation Polish

Verify and fix ALL sidebar navigation links for the time-clock module.

**Expected sidebar structure (under "Workforce" or similar section):**

| Label | Route | Icon | Roles |
|-------|-------|------|-------|
| Dashboard | `/workforce/dashboard` | `LayoutDashboard` | Owner, Admin, Manager |
| Clock In/Out | `/workforce/clock` | `Clock` | All authenticated |
| My Hours | `/workforce/my-hours` | `CalendarClock` | All authenticated |
| My Shifts | `/workforce/my-shifts` | `CalendarDays` | All authenticated |
| Timesheets | `/workforce/timesheets` | `FileSpreadsheet` | Owner, Admin, Manager |
| Shifts | `/workforce/shifts` | `CalendarRange` | Owner, Admin, Manager |
| Disputes | `/workforce/disputes` | `AlertTriangle` | Owner, Admin, Manager |
| Reports | `/workforce/reports` | `BarChart3` | Owner, Admin, Manager, Bookkeeper |

**Verification steps:**
1. Click every sidebar link — verify it navigates to the correct page without 404
2. Verify active route highlighting works (current page is visually highlighted in sidebar)
3. Verify RBAC: links only appear for users with the correct roles
4. Verify mobile hamburger menu includes ALL workforce links
5. If breadcrumbs pattern exists in the codebase, verify breadcrumbs render correctly on each time-clock page

**Page titles:** Verify each route sets a meaningful `<title>` (via Next.js `metadata` export or `<Head>` component):
- `/workforce/dashboard` → "Dashboard — Time Clock"
- `/workforce/clock` → "Clock In/Out — Time Clock"
- `/workforce/my-hours` → "My Hours — Time Clock"
- `/workforce/my-shifts` → "My Shifts — Time Clock"
- `/workforce/timesheets` → "Timesheets — Time Clock"
- `/workforce/shifts` → "Shift Scheduling — Time Clock"
- `/workforce/disputes` → "Disputes — Time Clock"
- `/workforce/reports` → "Reports — Time Clock"
- `/kiosk` → "Kiosk — Time Clock"

---

### Task 3 — Cross-Page Integration Verification

Perform end-to-end verification across all time-clock pages. Each step must be tested in the browser with real API calls.

**Flow 1: Clock In → Dashboard → My Hours**
1. Navigate to `/workforce/clock`
2. Clock in (submit location + click Clock In)
3. Navigate to `/workforce/dashboard` — verify the "Who's In" section shows the employee as clocked in
4. Navigate back to `/workforce/clock` — verify the page shows "Clocked In" status with a running timer

**Flow 2: Clock Out → My Hours**
1. From `/workforce/clock`, clock out
2. Navigate to `/workforce/my-hours` — verify the completed session appears with correct times
3. Verify hours are calculated correctly (duration matches clock-in to clock-out)

**Flow 3: Dispute from My Hours → Disputes Page**
1. From `/workforce/my-hours`, find the completed session
2. Submit a dispute (flag or correction request)
3. Navigate to `/workforce/disputes` — verify the dispute appears with "Pending" status
4. As an admin, approve the dispute — verify the session was updated in `/workforce/timesheets`

**Flow 4: Shift Scheduling → My Shifts**
1. As admin, navigate to `/workforce/shifts`
2. Create a new shift for an employee
3. Switch to that employee's account (or if same user, navigate to `/workforce/my-shifts`)
4. Verify the shift appears with correct date/time and status

**Flow 5: Payroll Export**
1. Navigate to `/workforce/reports`
2. Select the Payroll tab
3. Set a date range that includes the clocked session
4. Click "Export CSV"
5. Verify the CSV file downloads successfully

**If any flow fails:** Fix the issue. Document what was broken and how you fixed it.

---

### Task 4 — Accessibility Check

Run through each time-clock page and verify:

1. **Labels:** All `<input>` elements have associated `<label>` elements (via `htmlFor` or wrapping)
2. **Aria labels:** Icon-only buttons have `aria-label` attributes:
   - Edit buttons: `aria-label="Edit {item name}"`
   - Delete buttons: `aria-label="Delete {item name}"`
   - Close buttons: `aria-label="Close"`
   - Navigation arrows: `aria-label="Previous page"` / `aria-label="Next page"`
3. **Color independence:** Status indicators use BOTH color AND text:
   - Green dot + "Clocked In" (not just green dot)
   - Red badge + "Rejected" (not just red badge)
   - Yellow badge + "Pending" (not just yellow badge)
4. **Keyboard navigation:** Tab through all forms and verify:
   - Focus order is logical (top to bottom, left to right)
   - Focus ring is visible on all interactive elements
   - Enter key submits forms
   - Escape key closes modals
5. **Kiosk page:** Verify the numpad is accessible:
   - Each number button has `aria-label="digit N"`
   - Backspace button has `aria-label="Delete last digit"`
   - OK button has `aria-label="Submit PIN"`
   - PIN dots region has `aria-label="PIN entry, N of M digits entered"`

**Fix any issues found.** Do not just report them — fix them in this sprint.

---

### Task 5 — Error Boundaries

Verify every time-clock page handles API failures gracefully.

**For each page:**
1. Wrap the main data-fetching section in a try/catch
2. On API error: display an error state (not a blank page, not an unhandled exception)
3. Error state must include:
   - An error message (user-friendly, not a stack trace)
   - A "Retry" button that re-fetches the data
4. Test by temporarily making the API URL invalid and verifying the error UI appears

**Pages to check:**
- `/workforce/dashboard`
- `/workforce/clock`
- `/workforce/my-hours`
- `/workforce/my-shifts`
- `/workforce/timesheets`
- `/workforce/shifts`
- `/workforce/disputes`
- `/workforce/reports`
- `/kiosk`
- `/settings/time-clock` (settings page)

If a page already has proper error handling, leave it. Only add error handling where it is missing.

---

## Acceptance Criteria
- [ ] Push notification permission prompt appears on Clock page (if browser supports it)
- [ ] "Enable" button requests permission and subscribes to push
- [ ] "Maybe Later" dismisses for 7 days
- [ ] Push subscription JSON saved to backend via POST /employees/me/push-subscription
- [ ] Push logic never breaks the Clock page (all errors caught silently)
- [ ] ALL sidebar links navigate to correct pages without 404
- [ ] Active route highlighting works in sidebar
- [ ] RBAC on sidebar links enforced
- [ ] Mobile hamburger menu includes all workforce links
- [ ] Page titles set on every route
- [ ] Flow 1 verified: Clock in → Dashboard shows employee → Clock page shows status
- [ ] Flow 2 verified: Clock out → My Hours shows completed session
- [ ] Flow 3 verified: Submit dispute → Disputes page shows it → Approve → Session updated
- [ ] Flow 4 verified: Create shift → My Shifts shows it
- [ ] Flow 5 verified: Payroll CSV export downloads
- [ ] All inputs have labels
- [ ] Icon-only buttons have aria-labels
- [ ] Color is not the sole status indicator (text labels present)
- [ ] Tab navigation works logically on all forms
- [ ] Kiosk numpad has proper aria-labels
- [ ] Every page has error handling for API failures (error state + Retry button)
- [ ] No backend code was modified
- [ ] `npm run lint` passes (from `/var/www/lead360.app/app/`)
- [ ] Dev servers shut down before sprint is marked complete

---

## Files Created / Modified in This Sprint

| File | Action | Purpose |
|---|---|---|
| `app/src/app/(dashboard)/workforce/clock/page.tsx` | Modified | Add push notification subscription logic |
| `app/src/components/time-clock/PushNotificationBanner.tsx` | Created | "Enable notifications" banner component |
| Various page files | Modified | Add/fix error boundaries, aria-labels, page titles |
| Sidebar navigation file | Modified | Verify/fix all workforce links |

---

## Handoff Notes
- This is the final frontend sprint for the time-clock module
- After this sprint, all 10 pages + kiosk + supporting components should be fully functional
- Push notifications require a VAPID key pair — the `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var must be set for subscription to work. If not set, push is silently skipped.
- The service worker file for push notifications may need to be created at `app/public/sw.js` if one does not already exist. Check the codebase first.
- Cross-page flows depend on all previous sprints working correctly — if any sprint has regressions, fix them here
- Accessibility fixes in this sprint ensure the module meets WCAG 2.1 AA baseline
