# Sprint 2 — Time Clock Settings Page
**Module:** time-clock | **Type:** Frontend — Page | **Depends On:** Sprint 1
**Gate:** STOP — Settings page loads, saves, shows kiosk token
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

Build the Time Clock Settings page at `/settings/time-clock`. This is the admin configuration hub where Owners and Admins configure all time-clock behavior: clock-in mode, GPS/geofence rules, overtime thresholds, pay period, kiosk mode, and kiosk token management.

**Page:** `/settings/time-clock`
**File:** `app/src/app/(dashboard)/settings/time-clock/page.tsx`
**Roles:** Owner, Admin only (`timeclock:manage_settings`)

---

## Task 1 — Test Live Endpoints

Before writing any code, verify these 3 endpoints work:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r .access_token)

# 1. GET settings (first call may return defaults or null id — document what you see)
curl -s -X GET http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" | jq .

# 2. PATCH settings (update a single field)
curl -s -X PATCH http://localhost:8000/api/v1/time-clock/settings \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"gps_required": true}' | jq .

# 3. POST regenerate kiosk token
curl -s -X POST http://localhost:8000/api/v1/time-clock/settings/kiosk-token/regenerate \
  -H "Authorization: Bearer $TOKEN" | jq .
```

Record actual response shapes. If the GET returns `{ id: null }` or empty, that means settings haven't been initialized yet — the PATCH should auto-create them (upsert). Confirm this behavior.

---

## Task 2 — Build Settings Page with Tabbed Layout

**File:** `app/src/app/(dashboard)/settings/time-clock/page.tsx`

### Page Structure

Use the `Tabs` component from `@/components/ui/Tabs` to organize settings into logical sections. The page loads settings on mount, and each tab section has its own save button.

```
+-------------------------------------------------------+
| Settings > Time Clock                    [Breadcrumb]  |
+-------------------------------------------------------+
| [General] [Geofence] [Overtime] [Pay Period] [Kiosk]  |
+-------------------------------------------------------+
|                                                        |
|  (Active tab content)                                  |
|                                                        |
|  [Save Settings]                                       |
+-------------------------------------------------------+
```

### Header

- Breadcrumb: `Settings > Time Clock` using the `Breadcrumb` component
- Page title: "Time Clock Settings" with `Settings` icon from lucide-react
- Permission check on mount: redirect or show "Access Denied" if user lacks `timeclock:manage_settings`

### State Management

```typescript
const [settings, setSettings] = useState<TimeClockSettings | null>(null);
const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [activeTab, setActiveTab] = useState<string>('general');
```

### On Mount

1. Call `getTimeClockSettings()`
2. If response has `id: null` or is empty — show defaults (the form should show default values matching the Prisma schema defaults)
3. If response has data — populate form
4. Show `LoadingSpinner` while loading

---

## Task 3 — General Tab

Fields in the General tab:

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Clock-In Mode | `Select` | Required | Options: "Anywhere", "Specific Addresses", "Active Job Sites". Values: `anywhere`, `specific_addresses`, `active_job_sites` |
| GPS Required | `ToggleSwitch` | — | Default: true |
| GPS Unavailable Action | `Select` | Required when gps_required=true | Options: "Block Clock-In" (`block`), "Allow but Flag" (`allow_flagged`). Gray out or hide when gps_required is false |
| Require Project Tag | `ToggleSwitch` | — | "Employees must select a project when clocking in" |
| Require Task Tag | `ToggleSwitch` | — | "Employees must select a task when clocking in". Only relevant when Require Project Tag is on — show note |

### Conditional UI

- When `gps_required = false`: Show a warning alert below the toggle: "GPS is disabled. Geofence enforcement will not work regardless of clock-in mode." Use the `Alert` component from `@/components/ui/alert`.
- When `clock_in_mode = 'anywhere'`: Show a note below the select: "Geofence enforcement is disabled in Anywhere mode. Employees can clock in from any location."

### Form Implementation

Use React Hook Form + Zod for the General tab:

```typescript
const generalSchema = z.object({
  clock_in_mode: z.enum(['anywhere', 'specific_addresses', 'active_job_sites']),
  gps_required: z.boolean(),
  gps_unavailable_action: z.enum(['block', 'allow_flagged']),
  require_job_tag: z.boolean(),
  require_task_tag: z.boolean(),
});
```

Save handler calls `updateTimeClockSettings()` with only the changed fields. Show toast on success/error.

---

## Task 4 — Geofence Tab

Only meaningful when `clock_in_mode !== 'anywhere'`. If mode is `anywhere`, show an informational message: "Geofence settings are only applicable when Clock-In Mode is set to 'Specific Addresses' or 'Active Job Sites'."

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Geofence Violation Action | `Select` | Required | Options: "Block Clock-In" (`block`), "Warn Only — Allow but Flag" (`warn_only`) |

Include descriptive help text for each option:
- **Block**: "Employees outside all configured addresses will be prevented from clocking in. An admin notification will be sent."
- **Warn Only**: "Employees outside configured addresses can still clock in, but their session will be flagged for review. An admin notification will be sent."

### Link to Addresses

Show a link/button: "Manage Clock-In Addresses →" that navigates to the Addresses tab (or to `/settings/time-clock` with the Addresses tab pre-selected, if addresses are managed in this same page in Sprint 4).

---

## Task 5 — Overtime Tab

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Overtime Enabled | `ToggleSwitch` | — | Default: true |
| Daily Threshold (hours) | `HoursInput` | 0-24, required when enabled | Default: 8.00. "Hours per day before overtime kicks in" |
| Weekly Threshold (hours) | `HoursInput` | 0-168, required when enabled | Default: 40.00. "Hours per week before overtime kicks in" |
| Overtime Multiplier | `Input` type="number" | 1.00-5.00, step 0.01, required when enabled | Default: 1.50. "Multiplier applied to overtime hours for payroll calculations (e.g., 1.5x)" |

### Conditional UI

When `overtime_enabled = false`: Gray out or collapse the threshold fields. Show note: "Overtime tracking is disabled. All hours will be recorded as regular hours."

### Form Implementation

```typescript
const overtimeSchema = z.object({
  overtime_enabled: z.boolean(),
  overtime_daily_threshold_hours: z.number().min(0).max(24).nullable(),
  overtime_weekly_threshold_hours: z.number().min(0).max(168).nullable(),
  overtime_multiplier: z.number().min(1).max(5).nullable(),
});
```

---

## Task 6 — Pay Period Tab

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Pay Period Type | `Select` | Required | Options: "Weekly", "Biweekly", "Semi-monthly", "Monthly". Values: `weekly`, `biweekly`, `semimonthly`, `monthly` |
| Start Day of Week | `Select` | Required when weekly or biweekly | Options: Sunday (0) through Saturday (6). "Which day starts the work week?" |
| Anchor Date | `DatePicker` | Required ONLY when biweekly | "Reference date for biweekly period calculation. Pick any date that starts a pay period." |

### Conditional UI

- When `pay_period_type = 'weekly'`: Show Start Day of Week only
- When `pay_period_type = 'biweekly'`: Show Start Day of Week AND Anchor Date
- When `pay_period_type = 'semimonthly'` or `'monthly'`: Hide Start Day and Anchor Date. Show note: "Periods are automatically calculated: 1st-15th and 16th-end of month (semi-monthly) or 1st-end of month (monthly)."

### Form Implementation

```typescript
const payPeriodSchema = z.object({
  pay_period_type: z.enum(['weekly', 'biweekly', 'semimonthly', 'monthly']),
  pay_period_start_day: z.number().min(0).max(6).nullable(),
  pay_period_anchor_date: z.string().nullable(), // ISO date string
});
```

---

## Task 7 — Kiosk Tab

| Field | Component | Notes |
|-------|-----------|-------|
| Kiosk Mode Enabled | `ToggleSwitch` | "Enable PIN-based clock-in from a shared device" |
| Kiosk Token | Read-only display | Show masked (last 4 chars) or "Not generated" |
| Regenerate Token | `Button` with `ConfirmModal` | Danger action — invalidates current token |

### Kiosk Token Flow

1. When kiosk is first enabled and no token exists: Show "No kiosk token generated" with a "Generate Token" button
2. When a token exists: Show `••••••••{last4}` (the backend should NOT return the full token on GET — it's hashed. Show "Token configured" or the last 4 chars if available)
3. **Regenerate Token button**: 
   - Opens `ConfirmModal`: "This will invalidate the current kiosk token. Any active kiosk devices will need to be reconfigured with the new token. Continue?"
   - On confirm: Call `regenerateKioskToken()`
   - On success: The response should contain the new plaintext token **once**. Display it in a `SuccessModal` with:
     - The full token in a monospace text field
     - A "Copy to Clipboard" button (use `navigator.clipboard.writeText()`)
     - Warning text: "Save this token now. It cannot be viewed again after closing this dialog."
     - The kiosk URL preview: `https://app.lead360.app/kiosk?token={token}` (also copyable)
   - On error: Toast error message

### Conditional UI

When `kiosk_mode_enabled = false`: Show a note: "Kiosk mode is disabled. Enable it to allow PIN-based clock-in from shared devices." Gray out the token section.

### Shift Settings (add to this tab or General)

| Field | Component | Validation | Notes |
|-------|-----------|------------|-------|
| Shift Reminder (minutes) | `Input` type="number" | 5-120 | "How many minutes before a shift to send a reminder notification" |
| Missed Shift Threshold (minutes) | `Input` type="number" | 5-120 | "How many minutes after a shift starts before marking it as missed" |

---

## Task 8 — Save Handler

Create a unified save handler that sends only the fields from the active tab section:

```typescript
const handleSaveSettings = async (sectionData: Partial<TimeClockSettings>) => {
  try {
    setSaving(true);
    const response = await updateTimeClockSettings(sectionData);
    setSettings(response.data);
    toast.success('Settings saved successfully');
  } catch (error: any) {
    const message = error?.response?.data?.message || error?.message || 'Failed to save settings';
    toast.error(message);
  } finally {
    setSaving(false);
  }
};
```

Each tab's Save button calls this with only its own fields. This prevents unintended overwrites.

### Save Button Pattern

Every tab has a save button at the bottom:

```tsx
<div className="flex justify-end pt-6 border-t">
  <Button onClick={handleSave} disabled={saving}>
    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
    {saving ? 'Saving...' : 'Save Settings'}
  </Button>
</div>
```

---

## Task 9 — Dark Mode Support

All elements MUST include `dark:` Tailwind variants. The Lead360 platform supports dark mode. Follow the established pattern from other settings pages (read `app/src/app/(dashboard)/settings/` for reference).

Example class patterns:
- Backgrounds: `bg-white dark:bg-gray-900`, `bg-gray-50 dark:bg-gray-800`
- Text: `text-gray-900 dark:text-white`, `text-gray-500 dark:text-gray-400`
- Borders: `border-gray-200 dark:border-gray-700`
- Cards: `bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg`

---

## Acceptance Criteria

- [ ] Settings page loads at `/settings/time-clock` without errors
- [ ] Page shows `LoadingSpinner` while fetching settings
- [ ] Page shows "Access Denied" or redirects for users without `timeclock:manage_settings` permission
- [ ] Breadcrumb renders: `Settings > Time Clock`
- [ ] 5 tabs render and switch correctly: General, Geofence, Overtime, Pay Period, Kiosk
- [ ] **General tab**: Clock-in mode select, GPS toggle, GPS unavailable action select, project tag toggle, task tag toggle all render and save
- [ ] **General tab**: Warning shows when GPS is disabled
- [ ] **Geofence tab**: Geofence violation action select renders and saves. Shows informational message when mode is "Anywhere"
- [ ] **Overtime tab**: All 4 fields render. Fields disable/collapse when overtime is toggled off
- [ ] **Pay Period tab**: All 3 fields render. Conditional visibility works (start day hidden for monthly/semimonthly, anchor date only for biweekly)
- [ ] **Kiosk tab**: Toggle, token display, and regenerate button all work
- [ ] Regenerate token shows `ConfirmModal` before action
- [ ] After regeneration, `SuccessModal` shows full token with copy button
- [ ] Shift reminder and missed shift threshold fields render and save
- [ ] Each tab has its own Save button that sends only that section's fields
- [ ] Toast shows on successful save ("Settings saved successfully")
- [ ] Toast shows on save error with server message
- [ ] All inputs have 16px+ font size (no iOS zoom)
- [ ] All touch targets are 48px+ height
- [ ] Page renders correctly at 375px viewport (no horizontal scroll)
- [ ] Tabs use horizontal scroll on mobile if needed
- [ ] Dark mode classes are applied throughout
- [ ] No new npm packages installed
- [ ] No TODO comments
- [ ] Dev server runs without errors
